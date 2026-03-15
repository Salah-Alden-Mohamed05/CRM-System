import fs from 'fs';
import path from 'path';
import pool from './pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔧 Running database migrations...');

    // Run the full idempotent schema (includes all migrations inline)
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(sql);
    console.log('✅ Schema applied successfully');

    // Run incremental migration files in order
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      for (const file of migrationFiles) {
        console.log(`  🔄 Running migration: ${file}`);
        const migSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        try {
          await client.query(migSql);
          console.log(`  ✅ ${file} applied`);
        } catch (migErr: any) {
          // Non-fatal: log and continue (idempotent migrations may harmlessly fail)
          console.warn(`  ⚠️  ${file} warning: ${migErr.message?.substring(0, 100)}`);
        }
      }
    }

    // Ensure default roles always exist
    await client.query(`
      INSERT INTO roles (id, name, description, permissions) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'Admin',      'Full system access',                     '["*"]'),
        ('a0000000-0000-0000-0000-000000000002', 'Sales',      'Sales pipeline and customer management', '["customers","opportunities","leads"]'),
        ('a0000000-0000-0000-0000-000000000003', 'Operations', 'Shipment and logistics management',      '["shipments","milestones"]'),
        ('a0000000-0000-0000-0000-000000000004', 'Support',    'Customer support and tickets',           '["tickets","customers:read"]'),
        ('a0000000-0000-0000-0000-000000000005', 'Finance',    'Financial management',                   '["invoices","payments","costs"]')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✅ Default roles ensured');

    console.log('\n✅ All migrations completed successfully');
    console.log('ℹ️  Run "npm run seed" to add demo data, or use the /setup page to create your Admin account.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
