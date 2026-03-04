/**
 * seed.ts – Minimal seed: roles only.
 *
 * No demo users, no sample data.
 * The first Admin account is created through the web setup page (/login → "Create Admin Account").
 * After that, the Admin logs in and creates employee accounts from the Users Management page.
 *
 * Run: npx ts-node src/db/seed.ts
 * Or via start.sh: bash start.sh --seed
 */

import pool from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database (roles only)...');

    // ── Roles ────────────────────────────────────────────────
    await client.query(`
      INSERT INTO roles (id, name, description, permissions) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'Admin',      'Full system access',                      '["*"]'),
        ('a0000000-0000-0000-0000-000000000002', 'Sales',      'Sales pipeline and customer management',  '["customers","opportunities","leads","tasks"]'),
        ('a0000000-0000-0000-0000-000000000003', 'Operations', 'Shipment and logistics management',       '["shipments","milestones"]'),
        ('a0000000-0000-0000-0000-000000000004', 'Support',    'Customer support and tickets',            '["tickets","customers:read"]'),
        ('a0000000-0000-0000-0000-000000000005', 'Finance',    'Financial management',                    '["invoices","payments","costs"]')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('  ✅ Roles inserted (Admin, Sales, Operations, Support, Finance)');

    // ── Ensure user_preferences exist for any existing users ─
    await client.query(`
      INSERT INTO user_preferences (user_id, language, timezone)
      SELECT id, 'en', 'UTC' FROM users
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // ── Backfill email_lower for any existing users ──────────
    await client.query(`
      UPDATE users SET email_lower = LOWER(email)
      WHERE email_lower IS NULL OR email_lower = '' OR email_lower != LOWER(email);
    `);

    console.log('\n✅ Database setup completed successfully.');
    console.log('');
    console.log('📌 Next steps:');
    console.log('  1. Open the app in your browser');
    console.log('  2. Click "Create Admin Account" to set up your first admin');
    console.log('  3. Log in as admin and go to Users Management to add employees');
    console.log('');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
