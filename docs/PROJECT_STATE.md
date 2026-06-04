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
| **F-005** Visitor Mgmt    | 🏗 In Progress | Developer | Spec: `docs/specs/F-005-visitor-mgmt`    |
| **F-006** Navigation      | 🏗 In Progress | Developer | Spec: `docs/specs/F-006-navigation`      |
| **F-007** Messaging       | 🏗 In Progress | Developer | Spec: `docs/specs/F-007-messaging`       |
| **E2E Test Setup**        | 🟢 Live        | Developer | Spec: `docs/features/e2e-test-setup/`    |

## 3. Knowledge / Constraints

- **Auth:** OTP-based (No passwords). JWT Strategy.
- **RBAC:** Hierarchy: Super Admin -> Chain Admin -> Branch Admin -> Staff.
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
  - Chain Admin (Apollo): `22222222-2222-2222-2222-222222222222`, Phone: `8482022111`
  - Branch Admin (Chennai): `33333333-3333-3333-3333-333333333333`, Phone: `7980427511`
  - Apollo Chain ID: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
  - Chennai Branch ID: `dddddddd-dddd-4ddd-8ddd-dddddddddddd`
- **Directory Map:**
  - Specs: `docs/specs/`
  - Architecture/Guides: `docs/knowledge/`
  - Feature Specs: `docs/features/e2e-test-setup/`
