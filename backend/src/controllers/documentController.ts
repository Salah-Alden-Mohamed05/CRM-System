import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── GET DOCUMENTS (by entity) ───────────────────────────────────────────────
export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dealId, rfqId, quotationId, shipmentId, customerId, taskId, category, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (dealId) { params.push(dealId); conditions.push(`d.deal_id = $${params.length}`); }
    if (rfqId) { params.push(rfqId); conditions.push(`d.rfq_id = $${params.length}`); }
    if (quotationId) { params.push(quotationId); conditions.push(`d.quotation_id = $${params.length}`); }
    if (shipmentId) { params.push(shipmentId); conditions.push(`d.shipment_id = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`d.customer_id = $${params.length}`); }
    if (taskId) { params.push(taskId); conditions.push(`d.task_id = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`d.document_category = $${params.length}`); }

    // Non-admin: hide internal documents
    if (!['Admin', 'Finance', 'Operations'].includes(req.user?.role || '')) {
      conditions.push(`d.is_internal = FALSE`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM documents d ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows, total });
  } catch (error) {
    console.error('getDocuments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};

// ─── GET SINGLE DOCUMENT ─────────────────────────────────────────────────────
export const getDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name
       FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch document' });
  }
};

// ─── UPLOAD / CREATE DOCUMENT ─────────────────────────────────────────────────
export const createDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, dealId, rfqId, quotationId, shipmentId, customerId, taskId,
      documentCategory, description, isInternal, fileUrl, originalFilename,
      fileType, fileSize, mimeType
    } = req.body;

    // Handle multer uploaded file OR URL-based document
    let finalFileUrl = fileUrl;
    let finalFilename = originalFilename || name;
    let finalMimeType = mimeType;
    let finalFileSize = fileSize;
    let finalFileType = fileType;
    let filePath: string | null = null;

    if ((req as any).file) {
      const uploadedFile = (req as any).file;
      finalFileUrl = `/uploads/${uploadedFile.filename}`;
      finalFilename = uploadedFile.originalname;
      finalMimeType = uploadedFile.mimetype;
      finalFileSize = uploadedFile.size;
      filePath = uploadedFile.path;
      // Determine file type
      const ext = path.extname(uploadedFile.originalname).toLowerCase().replace('.', '');
      if (['pdf'].includes(ext)) finalFileType = 'pdf';
      else if (['jpg','jpeg','png','gif','webp'].includes(ext)) finalFileType = 'image';
      else if (['xlsx','xls'].includes(ext)) finalFileType = 'xlsx';
      else if (['docx','doc'].includes(ext)) finalFileType = 'docx';
      else finalFileType = ext || 'other';
    }

    if (!finalFileUrl && !filePath) {
      res.status(400).json({ success: false, message: 'File URL or upload required' });
      return;
    }

    const result = await query(
      `INSERT INTO documents (
        name, original_filename, file_url, file_path, file_type, file_size, mime_type,
        document_category, description, is_internal,
        deal_id, rfq_id, quotation_id, shipment_id, customer_id, task_id,
        uploaded_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [name || finalFilename, finalFilename, finalFileUrl, filePath,
       finalFileType, finalFileSize, finalMimeType,
       documentCategory, description, isInternal || false,
       dealId || null, rfqId || null, quotationId || null, shipmentId || null,
       customerId || null, taskId || null, req.user!.id]
    );

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'uploaded', 'document', $2, $3)`,
      [req.user!.id, result.rows[0].id,
       JSON.stringify({ label: name || finalFilename, role: req.user!.role })]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Document uploaded successfully' });
  } catch (error) {
    console.error('createDocument error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// ─── DELETE DOCUMENT ─────────────────────────────────────────────────────────
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM documents WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Document not found' }); return;
    }

    // Delete physical file if local
    if (existing.rows[0].file_path && fs.existsSync(existing.rows[0].file_path)) {
      fs.unlinkSync(existing.rows[0].file_path);
    }

    await query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
};

// ─── DOWNLOAD / SERVE DOCUMENT ────────────────────────────────────────────────
export const downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Document not found' }); return;
    }

    const doc = result.rows[0];
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      res.setHeader('Content-Disposition', `attachment; filename="${doc.original_filename}"`);
      if (doc.mime_type) res.setHeader('Content-Type', doc.mime_type);
      res.sendFile(path.resolve(doc.file_path));
    } else if (doc.file_url) {
      res.redirect(doc.file_url);
    } else {
      res.status(404).json({ success: false, message: 'File not available' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to download document' });
  }
};
