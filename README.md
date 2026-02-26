# 🚢 Logistics CRM System

A **full-stack, production-ready CRM** built for international logistics companies. Unifies **Sales, Operations, Customer Support, and Finance** in a single platform.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React, TypeScript, TailwindCSS, Recharts |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (with full schema & migrations) |
| **Auth** | JWT + Role-Based Access Control (RBAC) |
| **AI/ML** | Rule-based AI engine (delay prediction, risk scoring, revenue forecasting) |

---

## 🚀 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:5000 |
| **API Health** | http://localhost:5000/health |

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@logisticscrm.com | Admin@1234 |
| **Sales** | sales@logisticscrm.com | Sales@1234 |
| **Operations** | ops@logisticscrm.com | Ops@1234 |
| **Finance** | finance@logisticscrm.com | Finance@1234 |
| **Support** | support@logisticscrm.com | Support@1234 |

---

## 📦 Modules

### 1. 🔐 Authentication & Users
- JWT-based login/register
- Role-Based Access Control (Admin, Sales, Operations, Support, Finance)
- Password hashing (bcrypt)
- User activity audit logs
- Last login tracking

### 2. 👥 Customers
- Full CRUD with search & filters
- Company details (country, industry, contacts)
- Revenue & shipment metrics per customer
- Contact management (multiple contacts per customer)
- Document attachment support

### 3. 📊 Sales Pipeline
- **Kanban Board** and **List view**
- Stages: Lead → Contacted → Quotation → Negotiation → Won → Lost
- Expected deal value and probability tracking
- **Auto-creates shipment when deal is Won**
- Activity logging (calls, emails, meetings, notes)
- Revenue forecasting with weighted pipeline

### 4. 🚢 Shipments (Operations)
- Multi-mode: Sea, Air, Road, Rail, Multimodal
- Origin/destination tracking with ports
- **8-milestone tracking** (Booking → Pickup → Customs → Departure → Transit → Arrival → Customs → Delivery)
- Delay flagging with reason tracking
- ETD/ETA management
- BL#, AWB#, Container# tracking

### 5. 🎫 Support Tickets
- Priority levels: Low, Medium, High, Critical
- Categories: Delay, Damage, Billing, Documentation, Customs, Other
- **SLA tracking with automatic breach detection**
- Internal vs customer-facing comments
- Link tickets to shipments
- Resolution time tracking

### 6. 💰 Finance
- Invoice creation with line items
- Tax and discount calculation
- Payment recording (Bank Transfer, Credit Card, LOC, etc.)
- Payment status: Draft → Sent → Partial → Paid → Overdue
- **Auto-overdue detection** (daily check)
- Cost tracking per shipment for profit calculation

### 7. 📈 Dashboard & Reports
- Real-time KPI widgets
- Revenue trend charts (Area charts)
- Shipment status distribution (Pie charts)
- Sales pipeline funnel (Bar charts)
- Customer profitability ranking
- Delayed shipment alerts
- Overdue invoice tracker

### 8. 🤖 AI Features
- **Shipment Delay Prediction** — Probability score + estimated delay days
- **Customer Risk Scoring** — 0–100 score with risk factors
- **Revenue Forecasting** — Linear regression on 6-month history
- **Deal Scoring (Hot/Warm/Cool/Cold)** — Based on activity, history, value
- **Automated SLA Breach Detection** — Background checks every request
- **AI Insights Panel** — Real-time alerts on dashboard

---

## 🗄️ Database Schema

```
roles                 → User roles with permissions
users                 → System users with roles
customers             → Customer companies
contacts              → Customer contacts
leads                 → Sales leads
opportunities         → Sales deals with stages
opportunity_activities → Call/email/meeting logs
shipments             → Freight shipments
shipment_milestones   → Tracking checkpoints
shipment_documents    → Attached documents
tickets               → Support tickets
ticket_comments       → Ticket conversation
invoices              → Customer invoices with line items
invoice_items         → Invoice line items
payments              → Payment records
costs                 → Shipment cost tracking
activity_logs         → Full audit trail
```

---

## 🔗 API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/auth/users
GET    /api/auth/roles
```

### Customers
```
GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PUT    /api/customers/:id
DELETE /api/customers/:id
POST   /api/customers/:id/contacts
```

### Sales
```
GET    /api/sales/opportunities
POST   /api/sales/opportunities
GET    /api/sales/opportunities/:id
PUT    /api/sales/opportunities/:id
PATCH  /api/sales/opportunities/:id/stage
POST   /api/sales/opportunities/:id/activities
GET    /api/sales/leads
POST   /api/sales/leads
```

### Shipments
```
GET    /api/shipments
POST   /api/shipments
GET    /api/shipments/:id
PATCH  /api/shipments/:id/status
PATCH  /api/shipments/:id/milestones/:milestoneId
```

### Tickets
```
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PATCH  /api/tickets/:id
POST   /api/tickets/:id/comments
```

### Finance
```
GET    /api/finance/invoices
POST   /api/finance/invoices
GET    /api/finance/invoices/:id
POST   /api/finance/payments
GET    /api/finance/shipments/:id/costs
POST   /api/finance/shipments/:id/costs
```

### Dashboard
```
GET    /api/dashboard/stats
GET    /api/dashboard/revenue-chart
GET    /api/dashboard/shipment-chart
GET    /api/dashboard/sales-funnel
GET    /api/dashboard/customer-profitability
GET    /api/dashboard/kpis
```

### AI/ML
```
GET    /api/ai/insights
GET    /api/ai/predict/shipment/:id
GET    /api/ai/risk/customer/:id
GET    /api/ai/forecast/revenue
GET    /api/ai/score/deal/:id
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### 1. Setup Database
```bash
sudo -u postgres psql -c "CREATE DATABASE logistics_crm;"
sudo -u postgres psql -d logistics_crm -f backend/src/db/schema.sql
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # Edit with your DB credentials
npm run build
node dist/db/seed.js   # Seed demo data
node dist/server.js    # Start server on port 5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run build
npm run start          # Start on port 3000
```

---

## 🔐 Role Permissions

| Module | Admin | Sales | Operations | Finance | Support |
|--------|-------|-------|-----------|---------|---------|
| Customers | ✅ Full | ✅ Full | 👁 Read | 👁 Read | 👁 Read |
| Sales Pipeline | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| Shipments | ✅ Full | 👁 Read | ✅ Full | 👁 Read | 👁 Read |
| Tickets | ✅ Full | ❌ | ✅ Update | ❌ | ✅ Full |
| Finance | ✅ Full | ❌ | 👁 Read | ✅ Full | ❌ |
| Reports | ✅ Full | 👁 Read | 👁 Read | ✅ Full | ❌ |
| Users | ✅ Full | ❌ | ❌ | ❌ | ❌ |

---

## 🔄 Key Workflows

### Sales → Shipment Automation
1. Create Lead → Convert to Opportunity
2. Move opportunity to **Won** stage
3. System **auto-creates shipment** with default milestones
4. Operations team tracks milestones
5. Finance creates invoice linked to shipment

### Support Ticket Flow
1. Issue reported → Ticket created
2. Linked to shipment (optional)
3. SLA clock starts → **Auto-breach detection**
4. Agent comments (internal or customer-facing)
5. Status: Open → In Progress → Resolved → Closed

---

## 🏗️ Project Structure

```
webapp/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   │   ├── authController.ts
│   │   │   ├── customerController.ts
│   │   │   ├── salesController.ts
│   │   │   ├── shipmentController.ts
│   │   │   ├── ticketController.ts
│   │   │   ├── financeController.ts
│   │   │   └── dashboardController.ts
│   │   ├── routes/          # Express routes
│   │   ├── middleware/       # Auth, validation
│   │   ├── services/         # AI service
│   │   ├── db/              # Schema, migrations, seed
│   │   └── server.ts        # Main entry
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/             # Next.js App Router pages
    │   │   ├── login/
    │   │   ├── dashboard/
    │   │   ├── customers/
    │   │   ├── sales/
    │   │   ├── shipments/
    │   │   ├── tickets/
    │   │   ├── finance/
    │   │   └── reports/
    │   ├── components/      # Reusable UI components
    │   │   ├── ui/          # Buttons, Cards, Modals, etc.
    │   │   ├── layout/      # MainLayout, Sidebar
    │   │   └── dashboard/   # AIInsightsPanel
    │   ├── context/         # AuthContext
    │   ├── lib/             # API client (axios)
    │   └── types/           # TypeScript interfaces
    └── package.json
```

---

## 📊 Sample Data Included

- **5 Customers**: Global Trade Corp, Pacific Rim Imports, Euro Pharma GmbH, Middle East Traders, Asian Electronics Ltd
- **4 Opportunities**: Including won/active deals across different stages
- **3 Shipments**: In-transit, at customs (delayed), delivered
- **3 Invoices**: Paid, sent, overdue
- **2 Tickets**: High-priority customs delay, billing dispute
- **7 Shipment milestones** with realistic tracking data

---

Built with ❤️ for the logistics industry
