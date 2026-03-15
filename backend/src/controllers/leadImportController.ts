import { Request, Response } from 'express';
import { query } from '../db/pool';
import * as XLSX from 'xlsx';

interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string; firstName?: string; lastName?: string };
}

// ── Lead Import ──────────────────────────────────────────────────────────────
export const importLeads = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const userId = req.user!.id;
    const batchName = (req.body.batchName as string) || `Import ${new Date().toLocaleDateString()}`;

    // Parse the uploaded file
    let rows: Record<string, unknown>[] = [];
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file format. Use .xlsx, .xls, or .csv' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data found in the file' });
    }

    // Column mapping (flexible)
    const COLUMN_ALIASES: Record<string, string[]> = {
      company_name:   ['Company Name', 'company_name', 'Company', 'company', 'اسم الشركة'],
      contact_name:   ['Contact Name', 'Contact Person', 'contact_name', 'contact_person', 'Contact', 'Name', 'contact', 'اسم جهة الاتصال'],
      email:          ['Email', 'email', 'Email Address', 'email_address', 'البريد الإلكتروني'],
      phone:          ['Phone', 'phone', 'Phone Number', 'phone_number', 'الهاتف'],
      source:         ['Source', 'source', 'Lead Source', 'lead_source', 'المصدر'],
      notes:          ['Notes', 'notes', 'Note', 'Comments', 'comments', 'ملاحظات'],
    };

    const mapRow = (row: Record<string, unknown>) => {
      const mapped: Record<string, string> = {};
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
          if (alias in row && row[alias] !== undefined && row[alias] !== '') {
            mapped[field] = String(row[alias]);
            break;
          }
        }
        if (!mapped[field]) mapped[field] = '';
      }
      return mapped;
    };

    const validRows: Record<string, string>[] = [];
    const invalidRows: { row: number; error: string }[] = [];

    rows.forEach((row, i) => {
      const mapped = mapRow(row);
      if (!mapped.company_name?.trim()) {
        invalidRows.push({ row: i + 2, error: 'Company Name is required' });
      } else {
        validRows.push(mapped);
      }
    });

    if (validRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid records found. Company Name is required for all rows.',
        details: { invalidRows: invalidRows.slice(0, 10) },
      });
    }

    // Create import batch
    const batchRes = await query(
      `INSERT INTO lead_import_batches (batch_name, imported_by, file_name, total_records, valid_records, invalid_records)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [batchName, userId, file.originalname, rows.length, validRows.length, invalidRows.length]
    );
    const batchId = batchRes.rows[0].id;

    // Insert valid leads
    let inserted = 0;
    for (const row of validRows) {
      try {
        await query(
          `INSERT INTO leads (company_name, contact_name, email, phone, source, notes,
            status, created_by, import_batch_id)
           VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8)`,
          [row.company_name, row.contact_name || '', row.email, row.phone,
           row.source || 'import', row.notes, userId, batchId]
        );
        inserted++;
      } catch {
        // Skip duplicate or invalid rows
      }
    }

    return res.json({
      success: true,
      data: {
        batchId,
        batchName,
        totalRecords: rows.length,
        validRecords: validRows.length,
        invalidRecords: invalidRows.length,
        inserted,
        invalidRows: invalidRows.slice(0, 20),
      },
    });
  } catch (err) {
    console.error('Import leads error:', err);
    return res.status(500).json({ success: false, error: 'Failed to import leads' });
  }
};

// ── Get Import Batches ────────────────────────────────────────────────────────
export const getImportBatches = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT b.*, u.first_name || ' ' || u.last_name AS imported_by_name
       FROM lead_import_batches b
       LEFT JOIN users u ON b.imported_by = u.id
       ORDER BY b.created_at DESC LIMIT 50`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get import batches error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get import batches' });
  }
};

// ── Get Lead Pool Stats ───────────────────────────────────────────────────────
export const getLeadPoolStats = async (req: AuthRequest, res: Response) => {
  try {
    const [total, assigned, byStatus, bySource, recentBatches] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM leads WHERE status != 'converted'`),
      query(`SELECT COUNT(*) as count FROM leads WHERE assigned_to IS NOT NULL AND status != 'converted'`),
      query(`SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC`),
      query(`SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count FROM leads GROUP BY source ORDER BY count DESC LIMIT 10`),
      query(
        `SELECT b.*, u.first_name || ' ' || u.last_name AS imported_by_name,
          (SELECT COUNT(*) FROM leads WHERE import_batch_id = b.id) as actual_count
         FROM lead_import_batches b
         LEFT JOIN users u ON b.imported_by = u.id
         ORDER BY b.created_at DESC LIMIT 5`
      ),
    ]);

    const totalCount = Number(total.rows[0].count);
    const assignedCount = Number(assigned.rows[0].count);

    return res.json({
      success: true,
      data: {
        total: totalCount,
        assigned: assignedCount,
        unassigned: totalCount - assignedCount,
        byStatus: byStatus.rows,
        bySource: bySource.rows,
        recentBatches: recentBatches.rows,
      },
    });
  } catch (err) {
    console.error('Get lead pool stats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get lead pool stats' });
  }
};

// ── Distribute Leads ──────────────────────────────────────────────────────────
export const distributeLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { mode, salesReps, leadIds, customCounts, notes } = req.body as {
      mode: 'manual' | 'equal' | 'round_robin' | 'custom';
      salesReps: string[];     // array of user IDs
      leadIds?: string[];      // specific lead IDs (for manual)
      customCounts?: Record<string, number>; // userId -> count (for custom)
      notes?: string;
    };

    if (!mode || !salesReps || salesReps.length === 0) {
      return res.status(400).json({ success: false, error: 'mode and salesReps are required' });
    }

    const userId = req.user!.id;

    // Get unassigned leads pool based on mode
    let leadsToDistribute: { id: string }[] = [];

    if (mode === 'manual' && leadIds && leadIds.length > 0) {
      // Use specific leads
      const result = await query(
        `SELECT id FROM leads WHERE id = ANY($1) AND status != 'converted'`,
        [leadIds]
      );
      leadsToDistribute = result.rows;
    } else {
      // Get all unassigned non-converted leads
      const result = await query(
        `SELECT id FROM leads WHERE assigned_to IS NULL AND status != 'converted' ORDER BY created_at ASC`
      );
      leadsToDistribute = result.rows;
    }

    if (leadsToDistribute.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads available for distribution' });
    }

    // Build assignments based on mode
    const assignments: { userId: string; leadIds: string[] }[] = salesReps.map(uid => ({ userId: uid, leadIds: [] }));

    if (mode === 'equal') {
      const perRep = Math.floor(leadsToDistribute.length / salesReps.length);
      leadsToDistribute.forEach((lead, idx) => {
        const repIdx = idx < perRep * salesReps.length ? Math.floor(idx / perRep) : salesReps.length - 1;
        const safeIdx = Math.min(repIdx, salesReps.length - 1);
        assignments[safeIdx].leadIds.push(lead.id);
      });
    } else if (mode === 'round_robin') {
      leadsToDistribute.forEach((lead, idx) => {
        assignments[idx % salesReps.length].leadIds.push(lead.id);
      });
    } else if (mode === 'custom' && customCounts) {
      let offset = 0;
      for (const assignment of assignments) {
        const count = customCounts[assignment.userId] || 0;
        assignment.leadIds = leadsToDistribute.slice(offset, offset + count).map(l => l.id);
        offset += count;
      }
    } else if (mode === 'manual') {
      // Distribute evenly among selected reps
      leadsToDistribute.forEach((lead, idx) => {
        assignments[idx % salesReps.length].leadIds.push(lead.id);
      });
    }

    // Apply assignments to DB
    let totalAssigned = 0;
    for (const assignment of assignments) {
      if (assignment.leadIds.length === 0) continue;
      await query(
        `UPDATE leads SET assigned_to = $1, assigned_at = NOW(), status = CASE WHEN status = 'new' THEN 'new' ELSE status END
         WHERE id = ANY($2)`,
        [assignment.userId, assignment.leadIds]
      );
      totalAssigned += assignment.leadIds.length;
    }

    // Record distribution
    await query(
      `INSERT INTO lead_distributions (distributed_by, distribution_mode, lead_ids, assignments, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        mode,
        JSON.stringify(leadsToDistribute.map(l => l.id)),
        JSON.stringify(assignments),
        notes || null,
      ]
    );

    return res.json({
      success: true,
      data: {
        totalLeads: leadsToDistribute.length,
        totalAssigned,
        assignments: assignments.map(a => ({ userId: a.userId, count: a.leadIds.length })),
      },
    });
  } catch (err) {
    console.error('Distribute leads error:', err);
    return res.status(500).json({ success: false, error: 'Failed to distribute leads' });
  }
};

// ── Get Assigned Leads (with rep info) ───────────────────────────────────────
export const getAssignedLeads = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT l.id, l.company_name, l.contact_name, l.email, l.phone, l.status, l.source,
              l.assigned_to, l.assigned_at, l.created_at,
              u.first_name || ' ' || u.last_name AS assigned_to_name, u.email AS assigned_to_email
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE l.assigned_to IS NOT NULL AND l.status != 'converted'
       ORDER BY l.assigned_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get assigned leads error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get assigned leads' });
  }
};

// ── Reassign Leads ────────────────────────────────────────────────────────────
export const reassignLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, newAssigneeId, unassign } = req.body as {
      leadIds: string[];
      newAssigneeId?: string;
      unassign?: boolean;
    };

    if (!leadIds || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: 'leadIds is required' });
    }

    if (unassign) {
      // Unassign — remove from rep's list
      await query(
        `UPDATE leads SET assigned_to = NULL, assigned_at = NULL WHERE id = ANY($1)`,
        [leadIds]
      );
      return res.json({ success: true, data: { updated: leadIds.length, action: 'unassigned' } });
    }

    if (!newAssigneeId) {
      return res.status(400).json({ success: false, error: 'newAssigneeId is required when not unassigning' });
    }

    // Reassign to new rep
    await query(
      `UPDATE leads SET assigned_to = $1, assigned_at = NOW() WHERE id = ANY($2)`,
      [newAssigneeId, leadIds]
    );

    return res.json({ success: true, data: { updated: leadIds.length, action: 'reassigned', newAssigneeId } });
  } catch (err) {
    console.error('Reassign leads error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reassign leads' });
  }
};


export const getDistributionHistory = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT d.*, u.first_name || ' ' || u.last_name AS distributed_by_name
       FROM lead_distributions d
       LEFT JOIN users u ON d.distributed_by = u.id
       ORDER BY d.created_at DESC LIMIT 50`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get distribution history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get distribution history' });
  }
};

// ── Download Import Template ──────────────────────────────────────────────────
export const downloadTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const templateData = [
      {
        'Company Name': 'Acme Corp',
        'Contact Name': 'John Smith',
        'Email': 'john@acme.com',
        'Phone': '+1234567890',
        'Source': 'website',
        'Notes': 'Interested in air freight',
      },
      {
        'Company Name': 'Beta Ltd',
        'Contact Name': 'Jane Doe',
        'Email': 'jane@beta.com',
        'Phone': '+9876543210',
        'Source': 'referral',
        'Notes': 'Need sea freight quote',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_import_template.xlsx');
    return res.send(buffer);
  } catch (err) {
    console.error('Download template error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate template' });
  }
};
