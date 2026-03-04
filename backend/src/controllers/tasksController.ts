import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

/**
 * Tasks Controller
 * ────────────────
 * Each user can create, view, update, and complete their own tasks.
 * Admin can view ALL tasks across the team.
 * Linked optionally to: opportunity, lead, customer.
 */

// ── GET /tasks ───────────────────────────────────────────────
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status, priority, taskType, userId,
      from, to, search,
      page = 1, limit = 50,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    // Non-admin users only see their own tasks
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin) {
      params.push(req.user!.id);
      conditions.push(`t.user_id = $${params.length}`);
    } else if (userId) {
      // Admin filtering by specific user
      params.push(userId);
      conditions.push(`t.user_id = $${params.length}`);
    }

    if (status)   { params.push(status);           conditions.push(`t.status = $${params.length}`); }
    if (priority) { params.push(priority);          conditions.push(`t.priority = $${params.length}`); }
    if (taskType) { params.push(taskType);          conditions.push(`t.task_type = $${params.length}`); }
    if (from)     { params.push(from);              conditions.push(`t.created_at >= $${params.length}`); }
    if (to)       { params.push(to);                conditions.push(`t.created_at <= $${params.length}`); }
    if (search)   {
      params.push(`%${search}%`);
      conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) FROM tasks t ${where}`, params
    );

    const dataRes = await query(
      `SELECT t.*,
              u.first_name || ' ' || u.last_name AS user_name,
              u.email AS user_email,
              o.title AS opportunity_title,
              l.company_name AS lead_company,
              c.company_name AS customer_name
       FROM tasks t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN opportunities o ON t.opportunity_id = o.id
       LEFT JOIN leads l ON t.lead_id = l.id
       LEFT JOIN customers c ON t.customer_id = c.id
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
        COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('completed','cancelled')) AS overdue,
        COUNT(*) AS total
      FROM tasks t ${userFilter}
    `);

    // Per-user breakdown (admin only)
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
      title, taskType, description, outcome, status = 'pending',
      priority = 'medium', dueDate, opportunityId, leadId, customerId,
    } = req.body;

    if (!title || !taskType) {
      res.status(400).json({ success: false, message: 'Title and task type are required' });
      return;
    }

    const result = await query(
      `INSERT INTO tasks
         (user_id, title, task_type, description, outcome, status, priority,
          due_date, opportunity_id, lead_id, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user!.id, title, taskType, description || null, outcome || null,
        status, priority, dueDate || null,
        opportunityId || null, leadId || null, customerId || null,
      ]
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
    const {
      title, taskType, description, outcome, status, priority, dueDate,
      opportunityId, leadId, customerId,
    } = req.body;

    // Verify ownership (non-admin can only edit their own tasks)
    const existing = await query('SELECT user_id FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only edit your own tasks' });
      return;
    }

    const completedAt = status === 'completed' ? 'NOW()' : 'NULL';

    const result = await query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         task_type = COALESCE($2, task_type),
         description = $3,
         outcome = $4,
         status = COALESCE($5, status),
         priority = COALESCE($6, priority),
         due_date = $7,
         opportunity_id = $8,
         lead_id = $9,
         customer_id = $10,
         completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        title || null, taskType || null, description ?? null, outcome ?? null,
        status || null, priority || null, dueDate ?? null,
        opportunityId ?? null, leadId ?? null, customerId ?? null,
        id,
      ]
    );

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
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only complete your own tasks' });
      return;
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
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only delete your own tasks' });
      return;
    }

    await query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
};
