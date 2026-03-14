/**
 * clean-seed.ts – Create clean testing dataset
 *
 * Creates:
 *   - 1 Admin user (admin@crm.com / Admin@123)
 *   - 3 Sales reps (sales1-3@crm.com / Sales@123)
 *   - 1 Operations user (ops@crm.com / Ops@123)
 *   - 1 Finance user (finance@crm.com / Finance@123)
 *   - 30 unassigned leads (from diverse companies)
 *   - 0 deals, 0 RFQs, 0 quotations, 0 customers
 *
 * To REMOVE all demo data first, run with --clean flag:
 *   npx ts-node src/db/clean-seed.ts --clean
 *   npx ts-node src/db/clean-seed.ts --clean --seed
 *
 * To just seed (without cleaning):
 *   npx ts-node src/db/clean-seed.ts --seed
 */

import pool from './pool';
import bcrypt from 'bcryptjs';

const LEAD_COMPANIES = [
  { company: 'Gulf Shipping Co.', contact: 'Ahmed Al-Rashid', email: 'ahmed@gulfshipping.ae', phone: '+971501234567', source: 'website' },
  { company: 'Pharma Logistics Ltd', contact: 'Sarah Chen', email: 'sarah@pharmalogistics.com', phone: '+85291234567', source: 'referral' },
  { company: 'AutoParts Global', contact: 'Klaus Mueller', email: 'k.mueller@autoparts-global.de', phone: '+4915112345678', source: 'cold_call' },
  { company: 'Textiles of India Pvt Ltd', contact: 'Raj Patel', email: 'raj@textilesindia.in', phone: '+919876543210', source: 'exhibition' },
  { company: 'Nordics Frozen Foods', contact: 'Anna Lindqvist', email: 'anna@nordicsfrozen.se', phone: '+46701234567', source: 'website' },
  { company: 'East Africa Trade Hub', contact: 'Kofi Mensah', email: 'kofi@eatrade.co.ke', phone: '+254712345678', source: 'referral' },
  { company: 'Pacific Tech Exports', contact: 'Min-Jun Lee', email: 'mj.lee@pacifictech.kr', phone: '+82101234567', source: 'linkedin' },
  { company: 'Brazilian Coffee Exports', contact: 'Carlos Ferreira', email: 'carlos@braziliancoffee.br', phone: '+5511912345678', source: 'cold_call' },
  { company: 'UK Industrial Parts', contact: 'James Wilson', email: 'j.wilson@ukiparts.co.uk', phone: '+447911123456', source: 'website' },
  { company: 'Canadian Lumber Corp', contact: 'Marie Tremblay', email: 'm.tremblay@canlumber.ca', phone: '+14165551234', source: 'referral' },
  { company: 'Mediterranean Olive Oil', contact: 'Nikos Papadopoulos', email: 'nikos@medoliveoil.gr', phone: '+30697123456', source: 'exhibition' },
  { company: 'Singapore Electronics Hub', contact: 'Wei Tan', email: 'wei@seghub.sg', phone: '+6591234567', source: 'website' },
  { company: 'Nigerian Oil & Gas Supply', contact: 'Emeka Okonkwo', email: 'emeka@nogss.ng', phone: '+2348051234567', source: 'cold_call' },
  { company: 'Mexican Agricultural Export', contact: 'Luis Hernandez', email: 'luis@mexagro.mx', phone: '+525512345678', source: 'linkedin' },
  { company: 'Australian Mining Equipment', contact: 'Steve Thompson', email: 's.thompson@ausmine.com.au', phone: '+61412345678', source: 'referral' },
  { company: 'Turkish Textile Factory', contact: 'Mehmet Yilmaz', email: 'mehmet@turktextile.tr', phone: '+905301234567', source: 'exhibition' },
  { company: 'Swiss Pharmaceutical Import', contact: 'Hans Schmidt', email: 'h.schmidt@swisspharma.ch', phone: '+41791234567', source: 'website' },
  { company: 'Poland Construction Supply', contact: 'Piotr Kowalski', email: 'piotr@polconstruct.pl', phone: '+48501234567', source: 'cold_call' },
  { company: 'Thailand Chemical Trade', contact: 'Somchai Phongphan', email: 's.phong@thaichem.th', phone: '+66812345678', source: 'linkedin' },
  { company: 'Argentina Soy Export', contact: 'Sofia Rodriguez', email: 'sofia@argsoy.ar', phone: '+541112345678', source: 'website' },
  { company: 'Netherlands Flower Export', contact: 'Jan de Vries', email: 'jan@nlflowers.nl', phone: '+31651234567', source: 'referral' },
  { company: 'Vietnam Seafood Export', contact: 'Nguyen Van Thanh', email: 'thanh@vietseafood.vn', phone: '+84901234567', source: 'exhibition' },
  { company: 'Chile Wine Export', contact: 'Pedro Sanchez', email: 'pedro@chilewine.cl', phone: '+56912345678', source: 'cold_call' },
  { company: 'Indonesia Palm Oil', contact: 'Budi Santoso', email: 'budi@indopalmoil.id', phone: '+62812345678', source: 'website' },
  { company: 'Morocco Phosphate Trade', contact: 'Fatima Benali', email: 'fatima@morposphate.ma', phone: '+212661234567', source: 'linkedin' },
  { company: 'France Luxury Goods Export', contact: 'Pierre Dubois', email: 'pierre@frluxury.fr', phone: '+33612345678', source: 'referral' },
  { company: 'Egypt Cotton Export', contact: 'Mohamed Hassan', email: 'm.hassan@egyptcotton.eg', phone: '+20101234567', source: 'exhibition' },
  { company: 'Japan Electronics OEM', contact: 'Takashi Yamamoto', email: 't.yamamoto@japanoem.jp', phone: '+81901234567', source: 'website' },
  { company: 'Russia Metals Export', contact: 'Alexei Petrov', email: 'a.petrov@rusmetals.ru', phone: '+79161234567', source: 'cold_call' },
  { company: 'Colombia Coffee Trade', contact: 'Santiago Gomez', email: 'santiago@colcoffee.co', phone: '+573101234567', source: 'linkedin' },
];

async function cleanDemoData(client: any) {
  console.log('🧹 Removing all demo data...');

  // Delete in reverse FK order
  await client.query('DELETE FROM quotation_emails');
  await client.query('DELETE FROM quotation_items');
  await client.query('DELETE FROM quotations');
  await client.query('DELETE FROM rfqs');
  await client.query('DELETE FROM deal_activities');
  await client.query('DELETE FROM deals');
  await client.query('DELETE FROM task_checklist');
  await client.query('DELETE FROM tasks');
  await client.query('DELETE FROM ticket_comments');
  await client.query('DELETE FROM tickets');
  await client.query('DELETE FROM invoice_items');
  await client.query('DELETE FROM payments');
  await client.query('DELETE FROM invoices');
  await client.query('DELETE FROM costs');
  await client.query('DELETE FROM shipment_milestones');
  await client.query('DELETE FROM shipments');
  await client.query('DELETE FROM documents');
  await client.query('DELETE FROM contacts');
  await client.query('DELETE FROM customers');
  await client.query('DELETE FROM leads');
  // Remove non-system users (keep nothing)
  await client.query('DELETE FROM user_sessions');
  await client.query('DELETE FROM login_attempts');
  await client.query('DELETE FROM user_preferences');
  await client.query('DELETE FROM users');
  await client.query('DELETE FROM activity_logs');
  await client.query('DELETE FROM opportunity_activities');
  await client.query('DELETE FROM opportunities');

  console.log('  ✅ All demo data removed');
}

async function seedTestData(client: any) {
  console.log('🌱 Seeding clean testing dataset...');

  const passwordAdmin  = await bcrypt.hash('Admin@123', 12);
  const passwordSales  = await bcrypt.hash('Sales@123', 12);
  const passwordOps    = await bcrypt.hash('Ops@123',   12);
  const passwordFin    = await bcrypt.hash('Finance@123', 12);

  // Get role IDs
  const roles = await client.query(`SELECT id, name FROM roles`);
  const roleMap: Record<string, string> = {};
  roles.rows.forEach((r: any) => { roleMap[r.name] = r.id; });

  // Create Admin user
  const adminResult = await client.query(
    `INSERT INTO users (email, email_lower, password_hash, first_name, last_name, role_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (email_lower) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       role_id = EXCLUDED.role_id
     RETURNING id`,
    ['admin@crm.com', 'admin@crm.com', passwordAdmin, 'Admin', 'User', roleMap['Admin']]
  );
  const adminId = adminResult.rows[0].id;
  await client.query(`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [adminId]);
  console.log('  ✅ Admin user created: admin@crm.com / Admin@123');

  // Create Sales users
  const salesIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const res = await client.query(
      `INSERT INTO users (email, email_lower, password_hash, first_name, last_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (email_lower) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         role_id = EXCLUDED.role_id
       RETURNING id`,
      [`sales${i}@crm.com`, `sales${i}@crm.com`, passwordSales, `Sales Rep`, `${i}`, roleMap['Sales']]
    );
    salesIds.push(res.rows[0].id);
    await client.query(`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [res.rows[0].id]);
  }
  console.log('  ✅ 3 Sales users created: sales1-3@crm.com / Sales@123');

  // Create Operations user
  const opsResult = await client.query(
    `INSERT INTO users (email, email_lower, password_hash, first_name, last_name, role_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (email_lower) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       role_id = EXCLUDED.role_id
     RETURNING id`,
    ['ops@crm.com', 'ops@crm.com', passwordOps, 'Operations', 'Manager', roleMap['Operations']]
  );
  const opsId = opsResult.rows[0].id;
  await client.query(`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [opsId]);
  console.log('  ✅ Operations user created: ops@crm.com / Ops@123');

  // Create Finance user
  const finResult = await client.query(
    `INSERT INTO users (email, email_lower, password_hash, first_name, last_name, role_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (email_lower) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       role_id = EXCLUDED.role_id
     RETURNING id`,
    ['finance@crm.com', 'finance@crm.com', passwordFin, 'Finance', 'Manager', roleMap['Finance']]
  );
  await client.query(`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [finResult.rows[0].id]);
  console.log('  ✅ Finance user created: finance@crm.com / Finance@123');

  // Create 30 unassigned leads
  const leadSources = ['website', 'referral', 'cold_call', 'exhibition', 'linkedin'];
  const leadStatuses = ['new', 'new', 'new', 'new', 'new', 'new', 'new', 'new', 'contacted', 'new'];
  let createdLeads = 0;

  for (const lead of LEAD_COMPANIES) {
    const status = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];
    try {
      await client.query(
        `INSERT INTO leads (company_name, contact_name, email, phone, source, status, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          lead.company,
          lead.contact,
          lead.email,
          lead.phone,
          lead.source,
          status,
          `Initial inquiry from ${lead.company}. Contact: ${lead.contact}.`,
          adminId
        ]
      );
      createdLeads++;
    } catch (e: any) {
      // Skip duplicates silently
    }
  }
  console.log(`  ✅ ${createdLeads}/30 leads created (unassigned, ready for distribution)`);

  console.log('\n✅ Clean testing dataset created successfully!');
  console.log('');
  console.log('📋 Login Credentials:');
  console.log('  Admin:      admin@crm.com    / Admin@123');
  console.log('  Sales Rep 1: sales1@crm.com  / Sales@123');
  console.log('  Sales Rep 2: sales2@crm.com  / Sales@123');
  console.log('  Sales Rep 3: sales3@crm.com  / Sales@123');
  console.log('  Operations: ops@crm.com      / Ops@123');
  console.log('  Finance:    finance@crm.com  / Finance@123');
  console.log('');
  console.log('📦 30 unassigned leads ready for distribution via Admin > Lead Distribution');
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClean = args.includes('--clean');
  const shouldSeed = args.includes('--seed') || (!args.includes('--clean') && args.length === 0);

  if (!shouldClean && !shouldSeed) {
    console.log('Usage:');
    console.log('  npx ts-node src/db/clean-seed.ts --seed           # Seed only (no clean)');
    console.log('  npx ts-node src/db/clean-seed.ts --clean          # Remove all data only');
    console.log('  npx ts-node src/db/clean-seed.ts --clean --seed   # Remove all then seed');
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    if (shouldClean) {
      await cleanDemoData(client);
    }
    if (shouldSeed) {
      await seedTestData(client);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
