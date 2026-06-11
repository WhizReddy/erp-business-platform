# ERP Business Management Platform

> **Built on SAP CAP · Node.js · TypeScript · PostgreSQL · SAP Fiori Elements**

A production-ready, full-stack ERP system demonstrating enterprise-grade application development with the **SAP Cloud Application Programming Model (CAP)**. Transformed from the official [SAP cap-sflight](https://github.com/SAP-samples/cap-sflight) sample into a comprehensive business management platform covering Clients, Employees, Products, Orders, Invoices, and Approval Workflows.

---

## ✨ Features

| Domain | Capabilities |
|--------|-------------|
| **Clients** | Full CRUD, credit limits, multi-country support |
| **Employees** | Staff management across departments (Engineering, Sales, Finance, HR, Operations, IT) |
| **Products** | Catalog with SKU, pricing, stock tracking |
| **Orders** | Draft → Submit → Approve/Reject → Fulfill lifecycle |
| **Invoices** | Auto-generated from approved orders, partial payment tracking |
| **Approvals** | Workflow engine linked to orders with audit trail |
| **Analytics** | Real-time OData analytics projections |
| **Dashboard** | Dark-mode analytics UI with Chart.js charts |
| **Travel Module** | Original SAP Fiori travel processor & analytics (preserved) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients / UIs                        │
│  ┌──────────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Fiori: Travel    │  │ Fiori:      │  │ ERP Dashboard │  │
│  │ Processor        │  │ Analytics   │  │ /erp-dashboard│  │
│  └────────┬─────────┘  └──────┬──────┘  └───────┬───────┘  │
│           │                   │                  │           │
│  ┌────────▼──────────────────▼──────────────────▼───────┐  │
│  │              SAP CAP Node.js Server (:4004)            │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │TravelService│  │ERPService    │  │ERPAnalytics   │  │  │
│  │  │/processor  │  │/erp          │  │/erp-analytics │  │  │
│  │  └────────────┘  └──────────────┘  └───────────────┘  │  │
│  └──────────────────────────┬─────────────────────────────┘  │
│                             │                                 │
│  ┌──────────────────────────▼─────────────────────────────┐  │
│  │          Database (SQLite dev | PostgreSQL prod)         │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Option 1: Local (SQLite, zero setup)

```bash
# Clone and install
git clone <your-fork>
cd cap-sflight
npm ci

# Install CDS toolkit globally
npm install -g @sap/cds-dk

# Start with hot reload
cds watch
```

Open: [http://localhost:4004](http://localhost:4004)

### Option 2: Docker Compose (PostgreSQL)

```bash
# Copy env template
cp .env.example .env

# Start everything (Postgres + CAP app)
docker compose up --build
```

Open: [http://localhost:4004](http://localhost:4004)

---

## 🔑 Users & Roles

| User | Password | Roles | Capabilities |
|------|----------|-------|-------------|
| `alice` | `alice` | `clerk` | Create/manage Orders, Clients, Products |
| `bob` | `bob` | `manager` | Approve/reject orders, generate invoices |
| `hr` | `hr` | `hr` | Manage Employees |
| `amy` | `amy` | `processor` | Process travel records |
| `martha` | `martha` | `reviewer` | Review travel records |
| `admin` | `admin` | All roles | Full access to everything |

---

## 📡 API Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| ERP Service | `GET /erp/Orders` | List all orders |
| ERP Service | `POST /erp/Orders` | Create a draft order |
| ERP Service | `POST /erp/Orders(uuid)/ERPService.submitOrder` | Submit for approval |
| ERP Service | `POST /erp/Orders(uuid)/ERPService.approveOrder` | Approve (manager+) |
| ERP Service | `POST /erp/Orders(uuid)/ERPService.rejectOrder` | Reject (manager+) |
| ERP Service | `POST /erp/Orders(uuid)/ERPService.generateInvoice` | Generate invoice |
| ERP Service | `POST /erp/Invoices(uuid)/ERPService.recordPayment` | Record payment |
| Analytics | `GET /erp-analytics/OrdersByStatus` | Orders with status |
| Analytics | `GET /erp-analytics/RevenueByMonth` | Revenue data |
| Analytics | `GET /erp-analytics/TopClients` | Client overview |
| Travel | `GET /processor/Travel` | Travel records |
| Metadata | `GET /erp/$metadata` | OData EDMX metadata |
| Dashboard | `GET /erp-dashboard/` | Custom analytics UI |

---

## 📊 ERP Order Lifecycle

```
  ┌─────────┐     submitOrder()    ┌───────────┐
  │  Draft  │ ──────────────────► │ Submitted │
  └─────────┘                     └─────┬─────┘
                                        │
                           ┌────────────┴────────────┐
                           ▼                         ▼
                    approveOrder()           rejectOrder()
                           │                         │
                    ┌──────▼──────┐          ┌───────▼──────┐
                    │  Approved   │          │   Rejected   │
                    └──────┬──────┘          └──────────────┘
                           │
                  generateInvoice()
                           │
                    ┌──────▼──────┐
                    │  Fulfilled  │  → Invoice created (Unpaid)
                    └─────────────┘       │
                                   recordPayment()
                                          │
                                   ┌──────▼──────┐
                                   │    Paid ✓   │
                                   └─────────────┘
```

---

## 🛡️ Security

- **Development**: SAP CAP mocked-auth with role-based users
- **Production (BTP)**: SAP XSUAA via `@sap/xssec`
- **Standalone JWT**: `srv/auth/jwt-config.ts` provides the role mapping layer

All service endpoints are restricted via `@restrict` annotations in CDS:

```cds
@(restrict: [
  { grant: 'READ',  to: 'authenticated-user' },
  { grant: ['approveOrder', 'rejectOrder'], to: ['manager', 'admin'] }
])
entity Orders as projection on erp.Order actions { ... };
```

---

## 🗄️ Database

| Profile | Command | Database |
|---------|---------|----------|
| Development (default) | `cds watch` | SQLite (in-memory) |
| PostgreSQL (local) | `CDS_ENV=pg cds watch` | PostgreSQL 16 |
| Production | `docker compose up` | PostgreSQL 16 |

### PostgreSQL Setup (manual)

```bash
# Start Postgres
docker run -d --name erp_db \
  -e POSTGRES_DB=erp_platform \
  -e POSTGRES_USER=erp_user \
  -e POSTGRES_PASSWORD=erp_secret \
  -p 5432:5432 postgres:16-alpine

# Deploy schema
CDS_ENV=pg cds deploy

# Run with Postgres
CDS_ENV=pg cds watch
```

---

## 🧪 Testing

```bash
# Run all Jest tests (travel + ERP)
npm test

# Run only ERP tests
npx jest test/erp-service.test.ts --verbose

# Run Mocha tests
npm run test:mocha

# Lint
npm run lint
```

### Test Coverage

| Test Suite | Coverage |
|------------|---------|
| CRUD: Clients, Products, Orders, OrderItems | ✅ |
| Business Logic: LineTotal, TotalAmount | ✅ |
| Workflow: Submit → Approve → Invoice → Payment | ✅ |
| Workflow: Submit → Reject path | ✅ |
| Validation: Bad dates, negative prices | ✅ |
| RBAC: Clerk forbidden from manager actions | ✅ |
| RBAC: Anonymous gets 401 | ✅ |
| Analytics service projections | ✅ |

---

## 📁 Project Structure

```
cap-sflight/
├── db/
│   ├── schema.cds          # Travel domain (original)
│   ├── master-data.cds     # Airlines, Airports, Passengers (original)
│   ├── erp-schema.cds      # ERP domain: Employee, Client, Product, Order, Invoice, Approval
│   ├── erp-data/           # CSV seed data for all ERP entities
│   └── data/               # Travel seed data (original)
│
├── srv/
│   ├── travel-service.cds  # Travel OData service (original)
│   ├── travel-service.ts   # Travel business logic (original)
│   ├── analytics-service.cds # Travel analytics (original)
│   ├── erp-service.cds     # ERP OData service + RBAC + actions
│   ├── erp-service.ts      # ERP business logic handlers
│   └── auth/
│       └── jwt-config.ts   # Auth role definitions & JWT utilities
│
├── app/
│   ├── travel_processor/   # SAP Fiori Elements: Travel Processor
│   ├── travel_analytics/   # SAP Fiori Elements: Travel Analytics
│   └── erp_dashboard/      # Custom dark-mode analytics dashboard
│       ├── index.html
│       └── dashboard.js
│
├── test/
│   ├── odata.test.ts       # Travel service tests (original)
│   └── erp-service.test.ts # ERP service tests (new)
│
├── docker-compose.yml      # PostgreSQL + CAP app
├── Dockerfile              # Multi-stage production build
├── .env.example            # Environment variable template
└── package.json
```

---

## 🏆 CV Description

```
ERP Business Management Platform
Tech Stack: SAP CAP, SAP Fiori Elements, Node.js, TypeScript, PostgreSQL, Docker

• Architected a full ERP system on SAP Cloud Application Programming Model (CAP)
  covering Client management, Employee records, Product catalog, Order lifecycle,
  Invoice processing, and Approval workflows.

• Implemented role-based access control (RBAC) with 6 distinct roles enforced
  at the OData service layer via CDS @restrict annotations.

• Built a custom approval workflow engine (Draft → Submit → Approve/Reject →
  Fulfill) with automatic invoice generation and payment tracking.

• Designed RESTful OData v4 APIs with business action endpoints, server-side
  validation, and computed fields (LineTotal, TotalAmount auto-recalculation).

• Delivered PostgreSQL production support via @cap-js/postgres with Docker
  Compose orchestration (multi-stage Dockerfile, health checks, named volumes).

• Wrote 30+ Jest integration tests covering CRUD, business logic, RBAC
  enforcement, and the full order-to-payment workflow.

• Built a responsive dark-mode analytics dashboard (Chart.js) with live KPI
  cards, revenue charts, order status distribution, and client insights.
```

---

## 📜 License

Based on [SAP cap-sflight](https://github.com/SAP-samples/cap-sflight) (SAP Sample Code License).
ERP extensions authored as portfolio work.
