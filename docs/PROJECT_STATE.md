# 🟢 Project State

> **Mission:** Build a Hospital Visitor Tracking System to streamline entry/exit, enhance security with QR codes, and manage multi-branch chains.
> **Phase:** MVP - Feature Implementation

## 1. The Stack

- **Core:** Node.js v20+, NestJS (Backend), Next.js 15 (Frontend).
- **Key Libs:** Prisma (ORM), PostgreSQL, Tailwind CSS, ShadCN UI, Passport.js (Auth).

## 2. Active Tasks

| Task                      | Status         | Owner     | Notes                                    |
| :------------------------ | :------------- | :-------- | :--------------------------------------- |
| **F-001** Auth System     | 🟢 Live        | Tech Lead | Spec: `docs/specs/F-001-auth-system`     |
| **F-002** Hospital Chains | 🟢 Live        | Developer | Spec: `docs/specs/F-002-hospital-chains` |
| **F-003** Branches        | 🏗 In Progress | Developer | Spec: `docs/specs/F-003-branches`        |
| **F-004** User Mgmt       | 🏗 In Progress | Developer | Spec: `docs/specs/F-004-user-mgmt`       |
| **Dept Hierarchy**        | 🟢 Live        | Developer | Spec: `docs/features/department-hierarchy/` |
| **Hospital Admin Role**   | 🟢 Live        | Agent     | `docs/features/hospital-admin/` |
| **Delivery Management**   | 🟢 Live        | Agent     | Full suite redesign: distributor portal, hospital ops, receiving board, security gate (`frontend/src/features/delivery-management/`) |
| **Distributor Onboarding** | 🟢 Live        | Agent     | Self-serve apply `/vendor/register`; hospital review on delivery vendors; `docs/features/distributor-onboarding/` |
| **Urgent visit passcode**  | 🟢 Live        | Agent     | Gate verify → visitor register/book (auto-approved) → Entry/Exit QR — `docs/features/urgent-visit-passcode/` |
| **Doctor schedule slots**  | 🟢 Live        | Agent     | Doctors publish slots in My Visitors → Schedule; booked exclusive; urgent bypasses calendar — `docs/features/doctor-schedule-slots/` |
| **Delivery shared-minute slots** | 🟢 Live | Agent | Hospital 2h windows; distributors consume unload minutes — `docs/features/delivery-shared-minute-slots/` |
| **3-module completion doc** | 🟢 Done     | Agent     | Detailed what’s-complete for urgent + schedule + delivery: `docs/MODULES-COMPLETE.md` |
| **App completion checklist** | 🟢 Done    | Agent     | Full-app deep analysis + checkboxes: `docs/APPLICATION-COMPLETION-CHECKLIST.md` |
| **Attendant Management (AMS)** | 🟢 Live | Agent | Full AMS under `/dashboard/ams` on attendant-pass foundation — `docs/features/attendant-management/` |
| **Rule/UI alignment**     | 🟢 Done        | Agent     | Delivery status transitions + exit-after-GRN; attendant expired ACTIVE + branch scan + honest email toast; El City demo portals |
| **F-005** Visitor Mgmt    | 🏗 In Progress | Developer | Spec: `docs/specs/F-005-visitor-mgmt`    |
| **Visitor Pre-Registration** | 🟢 Live     | Agent     | `docs/features/visitor-pre-registration/` |
| **F-006** Navigation      | 🏗 In Progress | Developer | Spec: `docs/specs/F-006-navigation`      |
| **F-007** Messaging       | 🏗 In Progress | Developer | Spec: `docs/specs/F-007-messaging`       |
| **E2E Test Setup**        | 🟢 Live        | Developer | Spec: `docs/features/e2e-test-setup/`    |

## 3. Knowledge / Constraints

- **Auth:** OTP-based (No passwords). JWT Strategy.
- **RBAC:** Hospital hierarchy: **Super Admin → Hospital Admin → Department Admin → Sub-Department Admin → Staff** (Doctor, Nurse, Security, and other clinical/support types). Legacy chain/branch admin roles remain for multi-site setup.
- **Department Hierarchy:** Spec: `docs/features/department-hierarchy/`
- **Visitor Types:** "Meeting" (High security/friction) vs "Delivery" (Low friction).
- **Messaging:** WhatsApp is primary channel for Gate Passes.
- **Testing:**
  - Backend unit tests: `npm test`
  - E2E Testing: Uses TEST_MODE env var to mock SMS/WhatsApp and use fixed OTP
  - Deterministic Seeding: Fixed UUIDs for core entities (Super Admin, Chain Admins, Branch Admins)
- **Strictness:** No `any`, strictNullChecks enabled.
- **ESLint:** TypeScript unsafe rules disabled for test files (see `docs/features/unified-visitor-workflow/ESLINT-JEST-INVESTIGATION.md`)
- **E2E Test Constants:**
  - Super Admin ID: `11111111-1111-1111-1111-111111111111`, Phone: `6987456321`
  - Department Admin (Cardiology): `22222222-2222-2222-2222-222222222222`, Phone: `8482022111`
  - Sub-Dept Admin (Chennai): `33333333-3333-3333-3333-333333333333`, Phone: `7980427511`
  - Mock API: set `NEXT_PUBLIC_USE_MOCK_API=true` for in-browser departments/sub-departments CRUD
  - Dept Admin dashboard: `/dashboard` (mock persona `22222222-2222-2222-2222-222222222222`)
  - Public booking: `/book-appointment` (also linked from HomePage)
  - Cardiology Dept ID: `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee`
  - ICU Cardiology Sub-Dept ID: `ffffffff-ffff-4fff-8fff-ffffffffffff`
  - Apollo Chain ID: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
  - Chennai Branch ID: `dddddddd-dddd-4ddd-8ddd-dddddddddddd`
  - Hospital Admin ID: `55554444-4444-4444-4444-444444444444`, Phone: `9123456780`
- **AMS:** Staff UI at `/dashboard/ams/*` (dashboard, register, search, active, shift-change, emergency, reports, settings). Migration: `python scripts/migrate_ams_register_fields.py --yes` in `python_backend/`. Legacy `/dashboard/attendant-passes` redirects to AMS.
- **Gate exit + duration:** Same-QR exit for deliveries (after GRN) and attendants; duration emails; one-inside booking block.
- **Urgent visit passcode:** Doctor issues code → security **confirm-verify** → visitor `/visitor/urgent` registers + books (auto-APPROVED) → Entry/Exit QR for check-in/out. Migrate: `python scripts/migrate_doctor_urgent_passcode.py --yes`, `migrate_urgent_passcode_share.py --yes`, `migrate_urgent_passcode_gate_flow.py --yes`.
- **Doctor schedule:** My Visitors → Schedule publishes `DoctorAvailabilitySlot`s; public booking locks exclusivity; urgent passcode bypasses calendar.
- **Delivery volume pricing:** Distributor book form uses package types (Small→Custom) + vehicle type (Bike→LCV) fees with over-capacity handling; wallet debit on book. Legacy volume formula still accepted by API without packages.
- **Delivery windows:** Hospital admin publishes multi-hour windows on `/dashboard/delivery-slots`; each booking consumes unload minutes (`slotMinutes`); remaining minutes stay available. Migrate: `python scripts/migrate_delivery_slot_minutes.py --yes`.
