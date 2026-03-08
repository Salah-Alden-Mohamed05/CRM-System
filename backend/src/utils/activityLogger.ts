import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export interface LogActivityParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  description?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  userName?: string;
  userRole?: string;
}

/**
 * Centralized activity logging helper.
 * Logs major actions to the activity_logs table for audit trail.
 */
export const logActivity = async (params: LogActivityParams): Promise<void> => {
  try {
    const {
      userId, action, entityType, entityId, entityLabel,
      description, oldValues, newValues, metadata,
      ipAddress, userAgent, userName, userRole
    } = params;

    await query(
      `INSERT INTO activity_logs (
        user_id, user_name, user_role, action,
        entity_type, entity_id, entity_label,
        description, old_values, new_values,
        ip_address, user_agent, metadata, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
      [
        userId,
        userName || null,
        userRole || null,
        action,
        entityType,
        entityId || null,
        entityLabel || null,
        description || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
        userAgent || null,
        JSON.stringify(metadata || {})
      ]
    );
  } catch (err) {
    // Non-blocking: just log to console if activity logging fails
    console.error('[ActivityLogger] Failed to log activity:', err);
  }
};

/**
 * Helper to extract activity context from an AuthRequest
 */
export const getActivityContext = (req: AuthRequest) => ({
  userId: req.user!.id,
  userName: `${req.user!.firstName} ${req.user!.lastName}`,
  userRole: req.user!.role,
  ipAddress: req.ip || req.socket?.remoteAddress || undefined,
  userAgent: req.headers['user-agent'] || undefined,
});
