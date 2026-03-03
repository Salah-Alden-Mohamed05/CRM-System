import bcrypt from 'bcryptjs';
import pool from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Insert roles
    await client.query(`
      INSERT INTO roles (id, name, description, permissions) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'Admin', 'Full system access', '["*"]'),
        ('a0000000-0000-0000-0000-000000000002', 'Sales', 'Sales pipeline and customer management', '["customers","opportunities","leads"]'),
        ('a0000000-0000-0000-0000-000000000003', 'Operations', 'Shipment and logistics management', '["shipments","milestones"]'),
        ('a0000000-0000-0000-0000-000000000004', 'Support', 'Customer support and tickets', '["tickets","customers:read"]'),
        ('a0000000-0000-0000-0000-000000000005', 'Finance', 'Financial management', '["invoices","payments","costs"]')
      ON CONFLICT (name) DO NOTHING;
    `);

    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    const salesHash = await bcrypt.hash('Sales@1234', 12);
    const opsHash = await bcrypt.hash('Ops@1234', 12);
    const finHash = await bcrypt.hash('Finance@1234', 12);
    const suppHash = await bcrypt.hash('Support@1234', 12);

    // Insert users
    await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active) VALUES
        ('b0000000-0000-0000-0000-000000000001', 'admin@logisticscrm.com', $1, 'System', 'Admin', 'a0000000-0000-0000-0000-000000000001', true),
        ('b0000000-0000-0000-0000-000000000002', 'sales@logisticscrm.com', $2, 'Sarah', 'Johnson', 'a0000000-0000-0000-0000-000000000002', true),
        ('b0000000-0000-0000-0000-000000000003', 'ops@logisticscrm.com', $3, 'Mike', 'Chen', 'a0000000-0000-0000-0000-000000000003', true),
        ('b0000000-0000-0000-0000-000000000004', 'finance@logisticscrm.com', $4, 'Emma', 'Williams', 'a0000000-0000-0000-0000-000000000005', true),
        ('b0000000-0000-0000-0000-000000000005', 'support@logisticscrm.com', $5, 'David', 'Brown', 'a0000000-0000-0000-0000-000000000004', true)
      ON CONFLICT (email) DO NOTHING;
    `, [passwordHash, salesHash, opsHash, finHash, suppHash]);

    // Insert sample customers
    await client.query(`
      INSERT INTO customers (id, company_name, industry, country, city, status, assigned_to, created_by) VALUES
        ('c0000000-0000-0000-0000-000000000001', 'Global Trade Corp', 'Manufacturing', 'USA', 'New York', 'active', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
        ('c0000000-0000-0000-0000-000000000002', 'Pacific Rim Imports', 'Retail', 'Australia', 'Sydney', 'active', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
        ('c0000000-0000-0000-0000-000000000003', 'Euro Pharma GmbH', 'Pharmaceuticals', 'Germany', 'Frankfurt', 'active', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
        ('c0000000-0000-0000-0000-000000000004', 'Middle East Traders', 'Commodities', 'UAE', 'Dubai', 'prospect', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
        ('c0000000-0000-0000-0000-000000000005', 'Asian Electronics Ltd', 'Electronics', 'China', 'Shenzhen', 'active', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001')
      ON CONFLICT DO NOTHING;
    `);

    // Insert sample opportunities
    await client.query(`
      INSERT INTO opportunities (id, title, customer_id, stage, value, probability, service_type, shipping_mode, origin_country, destination_country, assigned_to, created_by) VALUES
        ('d0000000-0000-0000-0000-000000000001', 'Q1 Container Shipment', 'c0000000-0000-0000-0000-000000000001', 'negotiation', 45000, 75, 'FCL Import', 'sea', 'China', 'USA', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
        ('d0000000-0000-0000-0000-000000000002', 'Pharma Air Freight', 'c0000000-0000-0000-0000-000000000003', 'quotation', 28000, 60, 'Air Freight', 'air', 'Germany', 'USA', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
        ('d0000000-0000-0000-0000-000000000003', 'Electronics Supply Chain', 'c0000000-0000-0000-0000-000000000005', 'won', 120000, 100, 'LCL Consolidation', 'sea', 'China', 'Australia', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
        ('d0000000-0000-0000-0000-000000000004', 'Dubai Trade Expansion', 'c0000000-0000-0000-0000-000000000004', 'contacted', 15000, 30, 'Road Freight', 'road', 'UAE', 'Saudi Arabia', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002')
      ON CONFLICT DO NOTHING;
    `);

    // Insert sample shipments
    await client.query(`
      INSERT INTO shipments (id, reference_number, customer_id, opportunity_id, shipping_mode, status, origin_country, origin_port, destination_country, destination_port, carrier, eta, etd, is_delayed, assigned_to, created_by) VALUES
        ('e0000000-0000-0000-0000-000000000001', 'SHP-2024-0001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'sea', 'in_transit', 'China', 'Shanghai', 'Australia', 'Sydney', 'COSCO', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE - INTERVAL '10 days', false, 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
        ('e0000000-0000-0000-0000-000000000002', 'SHP-2024-0002', 'c0000000-0000-0000-0000-000000000003', NULL, 'air', 'customs_import', 'Germany', 'Frankfurt', 'USA', 'JFK', 'Lufthansa Cargo', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE - INTERVAL '1 days', true, 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
        ('e0000000-0000-0000-0000-000000000003', 'SHP-2024-0003', 'c0000000-0000-0000-0000-000000000002', NULL, 'sea', 'delivered', 'China', 'Ningbo', 'Australia', 'Melbourne', 'MSC', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '30 days', false, 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001')
      ON CONFLICT DO NOTHING;
    `);

    // Insert milestones
    await client.query(`
      INSERT INTO shipment_milestones (shipment_id, milestone_type, status, planned_date, actual_date, location) VALUES
        ('e0000000-0000-0000-0000-000000000001', 'Booking Confirmed', 'completed', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', 'Shanghai'),
        ('e0000000-0000-0000-0000-000000000001', 'Cargo Pickup', 'completed', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days', 'Shanghai Factory'),
        ('e0000000-0000-0000-0000-000000000001', 'Export Customs', 'completed', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 'Shanghai Port'),
        ('e0000000-0000-0000-0000-000000000001', 'Vessel Departure', 'completed', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 'Shanghai Port'),
        ('e0000000-0000-0000-0000-000000000001', 'Vessel Arrival', 'pending', NOW() + INTERVAL '15 days', NULL, 'Sydney Port'),
        ('e0000000-0000-0000-0000-000000000001', 'Import Customs', 'pending', NOW() + INTERVAL '16 days', NULL, 'Sydney'),
        ('e0000000-0000-0000-0000-000000000001', 'Final Delivery', 'pending', NOW() + INTERVAL '18 days', NULL, 'Sydney Warehouse')
      ON CONFLICT DO NOTHING;
    `);

    // Insert sample invoices
    await client.query(`
      INSERT INTO invoices (id, invoice_number, customer_id, shipment_id, status, issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, paid_amount, outstanding_amount, currency, created_by) VALUES
        ('f0000000-0000-0000-0000-000000000001', 'INV-2024-0001', 'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'paid', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '5 days', 18000, 10, 1800, 19800, 19800, 0, 'USD', 'b0000000-0000-0000-0000-000000000004'),
        ('f0000000-0000-0000-0000-000000000002', 'INV-2024-0002', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'sent', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 42000, 10, 4200, 46200, 0, 46200, 'USD', 'b0000000-0000-0000-0000-000000000004'),
        ('f0000000-0000-0000-0000-000000000003', 'INV-2024-0003', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'overdue', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days', 25000, 10, 2500, 27500, 10000, 17500, 'USD', 'b0000000-0000-0000-0000-000000000004')
      ON CONFLICT DO NOTHING;
    `);

    // Insert sample tickets
    await client.query(`
      INSERT INTO tickets (ticket_number, title, description, customer_id, shipment_id, category, priority, status, assigned_to, created_by) VALUES
        ('TKT-2024-0001', 'Shipment delayed at customs', 'The pharmaceutical shipment has been held at JFK customs for 2 days without explanation', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'customs', 'high', 'in_progress', 'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005'),
        ('TKT-2024-0002', 'Invoice dispute on INV-2024-0003', 'Customer disputes the freight charges on the invoice', 'c0000000-0000-0000-0000-000000000003', NULL, 'billing', 'medium', 'open', 'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005')
      ON CONFLICT (ticket_number) DO NOTHING;
    `);

    // Ensure email_lower is populated for existing users (idempotent)
    // The trigger handles new inserts, but we need to backfill existing rows
    await client.query(`
      UPDATE users SET email_lower = LOWER(email)
      WHERE email_lower IS NULL OR email_lower = '';
    `);

    // Also ensure all users have correct email_lower even if trigger was added later
    await client.query(`
      UPDATE users SET email_lower = LOWER(email)
      WHERE email_lower != LOWER(email);
    `);

    // Ensure user_preferences exist for all users
    await client.query(`
      INSERT INTO user_preferences (user_id, language, timezone)
      SELECT id, 'en', 'UTC' FROM users
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // Unlock any users that may have been locked during testing
    await client.query(`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE email IN ('ops@logisticscrm.com')
        AND (locked_until IS NOT NULL OR failed_login_attempts > 0);
    `);

    console.log('✅ Database seeding completed successfully');
    console.log('\n📋 Demo Credentials:');
    console.log('  Admin:   admin@logisticscrm.com / Admin@1234');
    console.log('  Sales:   sales@logisticscrm.com / Sales@1234');
    console.log('  Ops:     ops@logisticscrm.com / Ops@1234');
    console.log('  Finance: finance@logisticscrm.com / Finance@1234');
    console.log('  Support: support@logisticscrm.com / Support@1234');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
