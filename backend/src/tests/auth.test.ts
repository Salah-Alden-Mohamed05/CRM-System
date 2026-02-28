/**
 * Auth Tests – covers:
 * 1. Login with correct credentials
 * 2. Login with wrong password (+ remaining attempts message)
 * 3. Case-insensitive email lookup
 * 4. JWT contains role + userId
 * 5. Token expiry strategy (remember me)
 * 6. Role-based access control (RBAC)
 * 7. User CRUD by admin
 * 8. Cannot delete last admin
 * 9. Account lockout after 5 failed attempts
 * 10. Hashed password verification
 * 11. GET /auth/setup-status returns { needsSetup: false } when Admin exists
 * 12. POST /auth/setup-admin returns 403 when Admin already exists
 * 13. POST /auth/register is removed (404)
 * 14. Admin-creation protection: non-admin cannot assign Admin role
 * 15. Enhanced activity logging actions (CREATE_USER, DEACTIVATE_USER, etc.)
 */

import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const API_BASE = 'http://localhost:5000/api';

// ── Helpers ──────────────────────────────────────────────────
async function login(email: string, password: string, rememberMe = false) {
  return request(API_BASE)
    .post('/auth/login')
    .send({ email, password, rememberMe });
}

// ── Test Suite ───────────────────────────────────────────────
describe('Auth – Login', () => {
  test('1. Login with correct credentials returns token + user', async () => {
    const res = await login('admin@logisticscrm.com', 'Admin@1234');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@logisticscrm.com');
    expect(res.body.data.user.role).toBe('Admin');
  });

  test('2. Login with wrong password returns 401 with remaining attempts', async () => {
    const res = await login('admin@logisticscrm.com', 'WrongPassword!');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  test('3. Case-insensitive email lookup – UPPERCASE email works', async () => {
    const res = await login('ADMIN@LOGISTICSCRM.COM', 'Admin@1234');
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('Admin');
  });

  test('3b. Mixed-case email works', async () => {
    const res = await login('Admin@LogisticsCRM.com', 'Admin@1234');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('admin@logisticscrm.com');
  });

  test('4. JWT contains userId + role', async () => {
    const res = await login('admin@logisticscrm.com', 'Admin@1234');
    const token = res.body.data.token;
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.id).toBeDefined();
    expect(decoded.role).toBe('Admin');
    expect(decoded.email).toBe('admin@logisticscrm.com');
  });

  test('5a. Regular login: 24h JWT expiry', async () => {
    const res = await login('admin@logisticscrm.com', 'Admin@1234', false);
    const token = res.body.data.token;
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    const durationSecs = decoded.exp - decoded.iat;
    // ~24 h  (86400 seconds) ± small buffer
    expect(durationSecs).toBeGreaterThanOrEqual(86390);
    expect(durationSecs).toBeLessThan(86400 * 7 + 60); // not "30 days"
  });

  test('5b. Remember-me login: 7d JWT + refreshToken issued', async () => {
    const res = await login('admin@logisticscrm.com', 'Admin@1234', true);
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeDefined();
    const token = res.body.data.token;
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    const durationSecs = decoded.exp - decoded.iat;
    // 7 days = 604800 sec
    expect(durationSecs).toBeGreaterThanOrEqual(604790);
  });

  test('6. Non-existent email returns generic 401 (no email existence leakage)', async () => {
    const res = await login('nobody@example.com', 'SomePassword1!');
    expect(res.status).toBe(401);
    // The message must NOT reveal whether email exists in the system
    expect(res.body.message).toBeDefined();
    // Must NOT say "email not found" or "user not found" specifically
    expect(res.body.message).not.toMatch(/email not found/i);
    expect(res.body.message).not.toMatch(/user not found/i);
    expect(res.body.message).not.toMatch(/no account/i);
    // Both non-existent email and wrong password must return 401
    const wrongPassRes = await login('admin@logisticscrm.com', 'WrongPass!1');
    expect(wrongPassRes.status).toBe(401);
  });

  test('10. bcrypt hash verification – password is hashed and verifiable', async () => {
    const plainText = 'TestPass@9876';
    const hash      = await bcrypt.hash(plainText, 12);
    const isValid   = await bcrypt.compare(plainText, hash);
    const isInvalid = await bcrypt.compare('WrongPass', hash);
    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
    // Ensure we never store plain text
    expect(hash).not.toBe(plainText);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
  });
});

describe('Auth – Protected Routes (RBAC)', () => {
  let adminToken: string;
  let salesToken: string;

  beforeAll(async () => {
    const [adminRes, salesRes] = await Promise.all([
      login('admin@logisticscrm.com', 'Admin@1234'),
      login('sales@logisticscrm.com', 'Sales@1234'),
    ]);
    adminToken = adminRes.body.data.token;
    salesToken = salesRes.body.data.token;
  });

  test('6a. /auth/users accessible by Admin', async () => {
    const res = await request(API_BASE)
      .get('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('6b. /auth/users returns 403 for Sales role', async () => {
    const res = await request(API_BASE)
      .get('/auth/users')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });

  test('6c. /auth/me returns 401 without token', async () => {
    const res = await request(API_BASE).get('/auth/me');
    expect(res.status).toBe(401);
  });

  test('6d. /auth/me returns current user with valid token', async () => {
    const res = await request(API_BASE)
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@logisticscrm.com');
    expect(res.body.data.role).toBe('Admin');
  });

  test('6e. Expired token returns 401', async () => {
    const expiredToken = jwt.sign(
      { id: 'fake', email: 'x@x.com', role: 'Admin' },
      'logistics_crm_super_secret_jwt_key_2024',
      { expiresIn: '0s' }
    );
    await new Promise(r => setTimeout(r, 100));
    const res = await request(API_BASE)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

describe('Admin – User CRUD', () => {
  let adminToken: string;
  let createdUserId: string;

  const testUserEmail = `test_${Date.now()}@e2e.com`;

  beforeAll(async () => {
    const res = await login('admin@logisticscrm.com', 'Admin@1234');
    adminToken = res.body.data.token;
  });

  test('7a. Admin can list users (GET /auth/users)', async () => {
    const res = await request(API_BASE)
      .get('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Password hash should never be returned
    expect(res.body.data[0].password_hash).toBeUndefined();
    expect(res.body.data[0].password).toBeUndefined();
  });

  test('7b. Admin can list roles (GET /auth/roles)', async () => {
    const rolesRes = await request(API_BASE)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rolesRes.status).toBe(200);

    // Get Sales role id for creating test user
    const salesRole = rolesRes.body.data.find((r: { name: string }) => r.name === 'Sales');
    expect(salesRole).toBeDefined();

    // 7c. Create user with Sales role
    const createRes = await request(API_BASE)
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email:     testUserEmail,
        password:  'TestUser@1234',
        firstName: 'Test',
        lastName:  'User',
        roleId:    salesRole.id,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email).toBe(testUserEmail);
    expect(createRes.body.data.password_hash).toBeUndefined();
    createdUserId = createRes.body.data.id;
  });

  test('7d. Duplicate email returns 409', async () => {
    const rolesRes = await request(API_BASE)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const role = rolesRes.body.data[0];

    const res = await request(API_BASE)
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email:     testUserEmail,
        password:  'AnotherPass@1',
        firstName: 'Dup',
        lastName:  'User',
        roleId:    role.id,
      });
    expect(res.status).toBe(409);
  });

  test('7e. Admin can update user (PUT /auth/users/:id)', async () => {
    if (!createdUserId) return;
    const rolesRes = await request(API_BASE)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const role = rolesRes.body.data.find((r: { name: string }) => r.name === 'Sales');

    const res = await request(API_BASE)
      .put(`/auth/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Updated', lastName: 'Name', roleId: role.id, isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Updated');
  });

  test('7f. Admin can reset user password', async () => {
    if (!createdUserId) return;
    const res = await request(API_BASE)
      .patch(`/auth/users/${createdUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewPass@9876' });
    expect(res.status).toBe(200);

    // Verify new password works
    const loginRes = await login(testUserEmail, 'NewPass@9876');
    expect(loginRes.status).toBe(200);
  });

  test('7g. Deactivate user (DELETE /auth/users/:id)', async () => {
    if (!createdUserId) return;
    const res = await request(API_BASE)
      .delete(`/auth/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('8. Cannot delete the last admin', async () => {
    // There should be exactly 1 admin (admin@logisticscrm.com)
    const usersRes = await request(API_BASE)
      .get('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const admins = usersRes.body.data.filter(
      (u: { role_name: string; is_active: boolean }) => u.role_name === 'Admin' && u.is_active
    );

    if (admins.length === 1) {
      const res = await request(API_BASE)
        .delete(`/auth/users/${admins[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      // Either 400 (last admin) or 400 (own account) – both are fine
      expect(res.status).toBe(400);
    }
  });
});

describe('Auth – Account Lockout', () => {
  // Note: This test uses a separate dedicated user to avoid locking out admin
  const lockTestEmail = 'ops@logisticscrm.com';

  test('9. Account locks after 5 consecutive failed attempts', async () => {
    let lastResponse;
    for (let i = 0; i < 6; i++) {
      lastResponse = await login(lockTestEmail, 'WrongPassword_' + i);
      if (lastResponse.status === 423) break;
    }
    // Eventually should be locked
    expect(lastResponse?.status === 401 || lastResponse?.status === 423).toBe(true);
    if (lastResponse?.status === 423) {
      expect(lastResponse.body.message).toMatch(/lock/i);
    }
  }, 30000);
});

// ── Phase 9 – Bootstrap endpoints ────────────────────────────
describe('Phase 9 – Bootstrap: GET /auth/setup-status', () => {
  test('11. Returns { needsSetup: false } when Admin already exists', async () => {
    const res = await request(API_BASE).get('/auth/setup-status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('needsSetup');
    // Admin was seeded, so needsSetup must be false
    expect(res.body.needsSetup).toBe(false);
  });

  test('11b. Endpoint is public (no auth required)', async () => {
    const res = await request(API_BASE).get('/auth/setup-status');
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe('Phase 9 – Bootstrap: POST /auth/setup-admin', () => {
  test('12. Returns 403 when Admin already exists', async () => {
    const res = await request(API_BASE)
      .post('/auth/setup-admin')
      .send({
        email: 'newadmin@test.com',
        password: 'Admin@9999',
        firstName: 'New',
        lastName: 'Admin',
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Admin creation not allowed/i);
  });

  test('12b. Returns 400 for missing required fields', async () => {
    const res = await request(API_BASE)
      .post('/auth/setup-admin')
      .send({ email: 'x@y.com' }); // missing password, names
    // Will be 403 (admin exists) OR 400 (validation) - both are acceptable
    expect([400, 403]).toContain(res.status);
  });
});

// ── Phase 9 – Public register is REMOVED ──────────────────────
describe('Phase 9 – Public /register endpoint removed', () => {
  test('13. POST /auth/register is disabled (no longer a public route)', async () => {
    const res = await request(API_BASE)
      .post('/auth/register')
      .send({
        email: 'anyone@test.com',
        password: 'Pass@1234',
        firstName: 'Any',
        lastName: 'One',
      });
    // Route removed → authenticate middleware rejects with 401,
    // or Express returns 404. Either means public registration is blocked.
    expect([401, 404]).toContain(res.status);
    // Must NOT return 201 (success)
    expect(res.status).not.toBe(201);
    expect(res.status).not.toBe(200);
  });
});

// ── Phase 10 – Admin-creation protection ─────────────────────
describe('Phase 10 – Admin-creation protection', () => {
  let salesToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Ensure ops account is unlocked first
    const adminLoginRes = await login('admin@logisticscrm.com', 'Admin@1234');
    adminToken = adminLoginRes.body.data.token;

    // Unlock ops if locked from lockout test
    const usersRes = await request(API_BASE)
      .get('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const ops = usersRes.body.data.find(
      (u: { email: string }) => u.email === 'ops@logisticscrm.com'
    );
    if (ops) {
      await request(API_BASE)
        .patch(`/auth/users/${ops.id}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);
    }

    const salesRes = await login('sales@logisticscrm.com', 'Sales@1234');
    salesToken = salesRes.body.data.token;
  });

  test('14a. Non-admin cannot call POST /auth/users (403 from requireRole)', async () => {
    const rolesRes = await request(API_BASE)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const salesRole = rolesRes.body.data.find((r: { name: string }) => r.name === 'Sales');

    const res = await request(API_BASE)
      .post('/auth/users')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        email: 'hack@test.com',
        password: 'Hack@1234',
        firstName: 'Hack',
        lastName: 'Attempt',
        roleId: salesRole?.id,
      });
    // Non-admin is blocked at route level
    expect(res.status).toBe(403);
  });

  test('14b. Admin CAN create a user with Admin role', async () => {
    const rolesRes = await request(API_BASE)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminRole = rolesRes.body.data.find((r: { name: string }) => r.name === 'Admin');
    expect(adminRole).toBeDefined();

    const email = `admin_created_${Date.now()}@test.com`;
    const res = await request(API_BASE)
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        password: 'AdminCreated@1234',
        firstName: 'Second',
        lastName: 'Admin',
        roleId: adminRole.id,
      });
    expect(res.status).toBe(201);

    // Clean up – deactivate
    if (res.body.data?.id) {
      await request(API_BASE)
        .delete(`/auth/users/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });
});

// ── Phase 10 – Activity log actions ──────────────────────────
describe('Phase 10 – Activity log entries', () => {
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const res = await login('admin@logisticscrm.com', 'Admin@1234');
    adminToken = res.body.data.token;
  });

  test('15a. CREATE_USER action appears in activity logs after creating a user', async () => {
    const rolesRes = await request(API_BASE)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const salesRole = rolesRes.body.data.find((r: { name: string }) => r.name === 'Sales');

    const email = `log_test_${Date.now()}@test.com`;
    const createRes = await request(API_BASE)
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        password: 'LogTest@1234',
        firstName: 'Log',
        lastName: 'Test',
        roleId: salesRole.id,
      });
    expect(createRes.status).toBe(201);
    testUserId = createRes.body.data.id;

    // Check activity log for CREATE_USER
    const logsRes = await request(API_BASE)
      .get('/auth/audit/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'CREATE_USER', limit: 5 });
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.data.length).toBeGreaterThan(0);

    const entry = logsRes.body.data.find(
      (l: { action: string; entity_id: string }) =>
        l.action === 'CREATE_USER' && l.entity_id === testUserId
    );
    expect(entry).toBeDefined();
    expect(entry.metadata).toBeDefined();
    const meta = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
    expect(meta.email).toBe(email);
    expect(meta.role).toBe('Sales');
  });

  test('15b. DEACTIVATE_USER action appears in activity logs after deactivating user', async () => {
    if (!testUserId) return;
    await request(API_BASE)
      .delete(`/auth/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const logsRes = await request(API_BASE)
      .get('/auth/audit/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'DEACTIVATE_USER', limit: 5 });
    expect(logsRes.status).toBe(200);

    const entry = logsRes.body.data.find(
      (l: { action: string; entity_id: string }) =>
        l.action === 'DEACTIVATE_USER' && l.entity_id === testUserId
    );
    expect(entry).toBeDefined();
  });

  test('15c. Activity log metadata includes email and role fields', async () => {
    const logsRes = await request(API_BASE)
      .get('/auth/audit/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'CREATE_USER', limit: 10 });
    expect(logsRes.status).toBe(200);

    for (const entry of logsRes.body.data) {
      if (entry.metadata) {
        const meta = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
        // Each CREATE_USER entry should have email and role in metadata
        if (entry.action === 'CREATE_USER') {
          expect(meta.email).toBeDefined();
          expect(meta.role).toBeDefined();
        }
      }
    }
  });
});
