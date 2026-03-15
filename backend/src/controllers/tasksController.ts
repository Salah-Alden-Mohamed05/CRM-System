import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

/**
 * Tasks Controller v8
 * ─────────────────────
 * - Full RBAC: Sales/Support/Finance/Ops see own tasks; Admin sees all
 * - Checklist/subtasks support
 * - Links to deals, customers, shipments
 */

// ── GET /tasks ───────────────────────────────────────────────
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status, priority, taskType, userId, dealId, customerId, shipmentId,
      from, to, search, page = 1, limit = 50,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin) {
      params.push(req.user!.id);
      conditions.push(`(t.user_id = $${params.length} OR t.assigned_to = $${params.length})`);
    } else if (userId) {
      params.push(userId);
      conditions.push(`t.user_id = $${params.length}`);
    }

    if (status)   { params.push(status);     conditions.push(`t.status = $${params.length}`); }
    if (priority) { params.push(priority);   conditions.push(`t.priority = $${params.length}`); }
    if (taskType) { params.push(taskType);   conditions.push(`t.task_type = $${params.length}`); }
    if (dealId)   { params.push(dealId);     conditions.push(`t.deal_id = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`t.customer_id = $${params.length}`); }
    if (shipmentId) { params.push(shipmentId); conditions.push(`t.shipment_id = $${params.length}`); }
    if (from)     { params.push(from);       conditions.push(`t.created_at >= $${params.length}`); }
    if (to)       { params.push(to);         conditions.push(`t.created_at <= $${params.length}`); }
    if (search)   {
      params.push(`%${search}%`);
      conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM tasks t ${where}`, params);
    const dataRes = await query(
      `SELECT t.*,
        u.first_name || ' ' || u.last_name AS user_name,
        u.email AS user_email,
        asn.first_name || ' ' || asn.last_name AS assigned_to_name,
        d.title AS deal_title, d.deal_number,
        c.company_name AS customer_name,
        s.reference_number AS shipment_reference,
        (SELECT COUNT(*) FROM task_checklist tc WHERE tc.task_id = t.id) AS checklist_total,
        (SELECT COUNT(*) FROM task_checklist tc WHERE tc.task_id = t.id AND tc.is_done = TRUE) AS checklist_done
       FROM tasks t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users asn ON t.assigned_to = asn.id
       LEFT JOIN deals d ON t.deal_id = d.id
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN shipments s ON t.shipment_id = s.id
       ${where}
       ORDER BY
         CASE t.status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.due_date ASC NULLS LAST,
         t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error('getTasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

// ── GET /tasks/:id ───────────────────────────────────────────
export const getTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT t.*,
        u.first_name || ' ' || u.last_name AS user_name,
        asn.first_name || ' ' || asn.last_name AS assigned_to_name,
        d.title AS deal_title, d.deal_number,
        c.company_name AS customer_name,
        s.reference_number AS shipment_reference,
        (SELECT JSON_AGG(tc.* ORDER BY tc.sort_order ASC) FROM task_checklist tc WHERE tc.task_id = t.id) AS checklist,
        (SELECT JSON_AGG(doc.* ORDER BY doc.created_at DESC) FROM documents doc WHERE doc.task_id = t.id) AS documents
       FROM tasks t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users asn ON t.assigned_to = asn.id
       LEFT JOIN deals d ON t.deal_id = d.id
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN shipments s ON t.shipment_id = s.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Task not found' }); return;
    }

    const isAdmin = req.user?.role === 'Admin';
    const task = result.rows[0];
    if (!isAdmin && task.user_id !== req.user!.id && task.assigned_to !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch task' });
  }
};

// ── GET /tasks/stats ─────────────────────────────────────────
export const getTaskStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'Admin';
    const userFilter = isAdmin ? '' : `WHERE t.user_id = '${req.user!.id}'`;

    const stats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE t.status = 'completed')   AS completed,
        COUNT(*) FILTER (WHERE t.status = 'cancelled')   AS cancelled,
        COUNT(*) FILTER (WHERE t.status = 'blocked')     AS blocked,
        COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('completed','cancelled')) AS overdue,
        COUNT(*) AS total
      FROM tasks t ${userFilter}
    `);

    let perUser: unknown[] = [];
    if (isAdmin) {
      const perUserRes = await query(`
        SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE t.status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE t.status = 'pending')   AS pending
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total DESC
      `);
      perUser = perUserRes.rows;
    }

    res.json({ success: true, data: { ...stats.rows[0], perUser } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch task stats' });
  }
};

// ── POST /tasks ──────────────────────────────────────────────
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title, taskType, description, requiredActions, outcome, notes, status = 'pending',
      priority = 'medium', dueDate, dealId, customerId, shipmentId, assignedTo, checklist = [],
      blockedReason, blocked_reason
    } = req.body;

    if (!title || !taskType) {
      res.status(400).json({ success: false, message: 'Title and task type are required' });
      return;
    }

    const finalBlockedReason = blockedReason || blocked_reason || null;

    const result = await query(
      `INSERT INTO tasks
         (user_id, assigned_to, title, task_type, description, required_actions, outcome, notes,
          status, priority, due_date, deal_id, customer_id, shipment_id, blocked_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        req.user!.id, assignedTo || null, title, taskType, description || null,
        requiredActions || null, outcome || null, notes || null,
        status, priority, dueDate || null,
        dealId || null, customerId || null, shipmentId || null,
        finalBlockedReason,
      ]
    );

    const taskId = result.rows[0].id;

    // Add checklist items
    if (checklist.length > 0) {
      for (let i = 0; i < checklist.length; i++) {
        await query(
          `INSERT INTO task_checklist (task_id, title, sort_order) VALUES ($1,$2,$3)`,
          [taskId, checklist[i].title || checklist[i], i]
        );
      }
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'created', 'task', $2, $3)`,
      [req.user!.id, taskId, JSON.stringify({ label: title, role: req.user!.role, name: `${req.user!.firstName} ${req.user!.lastName}` })]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

// ── PUT /tasks/:id ───────────────────────────────────────────
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Task not found' }); return;
    }

    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only edit your own tasks' }); return;
    }

    const {
      title, taskType, description, requiredActions, outcome, notes, status, priority,
      dueDate, dealId, customerId, shipmentId, assignedTo, checklist,
      blockedReason, blocked_reason
    } = req.body;

    const finalBlockedReason = blockedReason !== undefined ? blockedReason : blocked_reason;

    const result = await query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         task_type = COALESCE($2, task_type),
         description = COALESCE($3, description),
         required_actions = COALESCE($4, required_actions),
         outcome = COALESCE($5, outcome),
         notes = COALESCE($6, notes),
         status = COALESCE($7, status),
         priority = COALESCE($8, priority),
         due_date = COALESCE($9, due_date),
         deal_id = COALESCE($10, deal_id),
         customer_id = COALESCE($11, customer_id),
         shipment_id = COALESCE($12, shipment_id),
         assigned_to = COALESCE($13, assigned_to),
         blocked_reason = CASE WHEN $15::text IS NOT NULL THEN $15 ELSE blocked_reason END,
         completed_at = CASE WHEN $7 = 'completed' THEN NOW() ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [title, taskType, description, requiredActions, outcome, notes, status, priority,
       dueDate, dealId, customerId, shipmentId, assignedTo, id, finalBlockedReason || null]
    );

    // Update checklist if provided
    if (checklist !== undefined) {
      await query('DELETE FROM task_checklist WHERE task_id = $1', [id]);
      for (let i = 0; i < checklist.length; i++) {
        const item = checklist[i];
        await query(
          `INSERT INTO task_checklist (task_id, title, is_done, sort_order) VALUES ($1,$2,$3,$4)`,
          [id, item.title || item, item.is_done || false, i]
        );
      }
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

// ── PATCH /tasks/:id/complete ────────────────────────────────
export const completeTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { outcome } = req.body;
    const existing = await query('SELECT user_id FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Task not found' }); return;
    }
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }
    const result = await query(
      `UPDATE tasks SET status = 'completed', completed_at = NOW(),
       outcome = COALESCE($1, outcome), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [outcome || null, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to complete task' });
  }
};

// ── DELETE /tasks/:id ────────────────────────────────────────
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT user_id FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Task not found' }); return;
    }
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }
    await query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
};

// ── CHECKLIST ENDPOINTS ────────────────────────────────────────

// GET /tasks/:id/checklist
export const getChecklist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT tc.*, u.first_name || ' ' || u.last_name as completed_by_name
       FROM task_checklist tc
       LEFT JOIN users u ON tc.completed_by = u.id
       WHERE tc.task_id = $1
       ORDER BY tc.sort_order ASC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch checklist' });
  }
};

// POST /tasks/:id/checklist
export const addChecklistItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) { res.status(400).json({ success: false, message: 'Title required' }); return; }

    const maxOrder = await query('SELECT COALESCE(MAX(sort_order), -1) as max FROM task_checklist WHERE task_id = $1', [id]);
    const sortOrder = (maxOrder.rows[0].max || 0) + 1;

    const result = await query(
      `INSERT INTO task_checklist (task_id, title, sort_order) VALUES ($1,$2,$3) RETURNING *`,
      [id, title, sortOrder]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add checklist item' });
  }
};

// PATCH /tasks/:taskId/checklist/:itemId
export const toggleChecklistItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { isDone } = req.body;
    const result = await query(
      `UPDATE task_checklist SET
        is_done = $1,
        completed_by = CASE WHEN $1 = TRUE THEN $2 ELSE NULL END,
        completed_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
       WHERE id = $3 RETURNING *`,
      [isDone, req.user!.id, itemId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update checklist item' });
  }
};

// DELETE /tasks/:taskId/checklist/:itemId
export const deleteChecklistItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    await query('DELETE FROM task_checklist WHERE id = $1', [itemId]);
    res.json({ success: true, message: 'Checklist item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete checklist item' });
  }
};
