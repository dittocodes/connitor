# E2E Browser QA Report — Connitor / HVTS

> **Date:** 2026-08-06 (IST)  
> **Environment:** Local headed Chromium (Playwright)  
> **Frontend:** `http://localhost:3000` (Next.js turbopack)  
> **API:** `http://127.0.0.1:8002` (FastAPI uvicorn)  
> **Mode:** Live API (`NEXT_PUBLIC_USE_MOCK_API=false`)

---

## 1. Executive summary

| Suite | Result | Notes |
|-------|--------|-------|
| AI profiles walkthrough | **13/13 passed** (~10.5 min) | All Electronic City roles + public pages |
| AI full workflows | **10/10 passed** (~3.0 min) | After updating AMS / payment / hold UI assertions |
| Distributor dummy payment | **4/4 passed** (~2.5 min) | Details→Payment, simulate fail, UPI Pay, Card Pay |
| Full workflows (first run) | **1 failed, 7 skipped** | Stale “Attendant Passes” heading — fixed mid-session |

**Overall:** Role dashboards and core module shells open successfully in a real browser against the live local API. Dummy payment booking (UPI + Card) is covered by headed e2e; hold+notify and urgent passcode remain thinner — see gaps below.

Screenshots: `frontend/test-results/ai-profiles/`, `frontend/test-results/ai-full-workflows/`, `frontend/test-results/delivery-payment/`

---

## 2. What was exercised (modules × activities)

### Auth & home
- [x] Home portals / role cards visible
- [x] Password login for each Electronic City role (headed)

### Super Admin
- [x] Login → dashboard
- [x] Hospital chains page loads

### Hospital Admin
- [x] Login → dashboard
- [x] Delivery ops page
- [x] AMS dashboard (`/dashboard/ams`)
- [x] Delivery slots page

### Department / Sub-department Admin / Staff (Doctor)
- [x] Login → dashboard
- [x] Doctor My Visitors page

### Security
- [x] Security dashboard home
- [x] Delivery scan tab
- [x] Today’s deliveries tab (hold UI copy visible)
- [x] Attendant scan tab
- [x] Appointments tab

### Distributor
- [x] Login → deliveries list
- [x] Book wizard Details step (fee preview / Continue to payment visible)
- [ ] Full book → dummy Pay ₹X → success (not fully automated this run)

### Purchase / Receiving
- [x] Purchase → delivery overview
- [x] Receiving board loads

### Ward Admin / AMS
- [x] AMS dashboard
- [x] AMS register page
- [x] Public attendant apply page opens
- [ ] Full admit → apply → approve → issue pass (legacy e2e path retired; AMS register not deep-tested)

### Public visitor
- [x] Visitor registration landing with branchId
- [x] Visitor registration landing (profiles suite)

### Not covered in this headed run
- [ ] Urgent passcode: doctor issue → security confirm-verify → `/visitor/urgent` → dual QR
- [ ] Doctor schedule publish + public `/book-appointment` exclusive lock
- [ ] Security Put on hold / Release hold + email verification
- [ ] Dummy payment Pay ₹X end-to-end booking
- [ ] Gate allow-entry blocked while ON_HOLD
- [ ] Visitor pre-registration OAuth / photo upload
- [ ] WhatsApp notifications (Meta token invalid in local `.env` — server logs fallback)

---

## 3. Suite results detail

### 3.1 `ai-profiles-browser.spec.ts` — PASS (13/13)

| # | Profile / page | Result |
|---|----------------|--------|
| 1 | SUPER_ADMIN | ok |
| 2 | HOSPITAL_ADMIN (+ AMS, delivery) | ok |
| 3 | DEPARTMENT_ADMIN | ok |
| 4 | SUB_DEPARTMENT_ADMIN | ok |
| 5 | STAFF (My Visitors) | ok |
| 6 | SECURITY (scan tabs) | ok |
| 7 | WARD_ADMIN (AMS) | ok |
| 8 | RECEIVING | ok |
| 9 | PURCHASE | ok |
| 10 | DISTRIBUTOR | ok |
| 11 | Public visitor registration | ok |
| 12 | Public attendant apply | ok |
| 13 | Home role portals | ok |

### 3.2 `ai-full-workflows-browser.spec.ts` — PASS (10/10) after fix

| # | Activity | Result |
|---|----------|--------|
| 01 | Home portals | ok |
| 02 | Super Admin + chains | ok |
| 03 | Hospital Admin + delivery + AMS + slots | ok |
| 04 | Dept / Subdept / Staff | ok |
| 05 | Distributor book wizard UI | ok |
| 06 | Purchase delivery | ok |
| 07 | Receiving board | ok |
| 08 | Security tabs + deliveries hold UI | ok |
| 09 | Ward AMS + public apply | ok |
| 10 | Visitor registration landing | ok |

**First-run failure (fixed):** Test 03 expected heading `Attendant Passes`; route now redirects to AMS. Spec updated accordingly. Distributor multi-step “Next / Book delivery” assertions also updated for Details → Payment wizard.

---

## 4. Credentials used / demo logins

**Staff password (all Electronic City seed users):** `Connitor@123`  
**Login UI:** `/auth/login` (add `?role=…` for role-targeted entry)

### Primary Electronic City set (used in e2e)

| Role | Email | Password |
|------|-------|----------|
| SUPER_ADMIN | `superadmin@hvts.com` | `Connitor@123` |
| HOSPITAL_ADMIN | `hospital.admin@connitor-elcity.com` | `Connitor@123` |
| DEPARTMENT_ADMIN | `dept.admin@connitor-elcity.com` | `Connitor@123` |
| SUB_DEPARTMENT_ADMIN | `subdept.admin@connitor-elcity.com` | `Connitor@123` |
| STAFF / DOCTOR | `priya.nair@connitor-elcity.com` | `Connitor@123` |
| STAFF / NURSE | `lakshmi.devi@connitor-elcity.com` | `Connitor@123` |
| STAFF / RECEPTIONIST | `manoj.kumar@connitor-elcity.com` | `Connitor@123` |
| SECURITY | `security@connitor-elcity.com` | `Connitor@123` |
| WARD_ADMIN | `ward.admin@connitor-elcity.com` | `Connitor@123` |
| RECEIVING | `receiving@connitor-elcity.com` | `Connitor@123` |
| PURCHASE | `purchase@connitor-elcity.com` | `Connitor@123` |
| DISTRIBUTOR | `distributor@citygen.demo` | `Connitor@123` |

Distributor path: `/auth/login?role=DISTRIBUTOR` → `/vendor/deliveries`

### Other seed references (not all exercised this run)

| Role | Email / phone | Notes |
|------|---------------|-------|
| SUPER_ADMIN | phone `6987456321` | OTP path also available |
| Apollo HOSPITAL_ADMIN | `hospital.admin@apollochennai.com` | `Connitor@123` |
| Apollo SECURITY | `rameshwar.tiwari@apollochennai.com` | phone `9883578111` |
| Apollo DOCTOR | `arjun.desai@apollochennai.com` | phone `7003636111` |

Full list: [`docs/DEMO-LOGINS.txt`](../DEMO-LOGINS.txt)

### Branch ID used in public links

`11000000-0000-4000-8000-000000000002` (Electronic City)

---

## 5. Observations while testing

1. **AMS replaced legacy Attendant Passes UI** — redirects work; e2e must assert AMS headings.
2. **Delivery book wizard is now Details → Payment** — old multi-step Next flow is obsolete.
3. **Security Today’s Deliveries** shows hold guidance (“internal delivery”); Put on hold / Release need a booked delivery to deep-test.
4. **WhatsApp Meta token** is invalid/expired locally — API starts but logs fallback; do not rely on WhatsApp in local demos until token refreshed.
5. **Some role logins are slow** (STAFF ~2–3 min in profiles suite) — likely API/session/networkidle waits; UX feels sluggish on cold pages.
6. **Hospital Admin AMS nav is long** — many sidebar entries for AMS; dense but functional.

---

## 6. Suggestions to improve

### Product / UX
1. Add a **Security “Today’s deliveries” empty-state CTA** explaining how to demo Hold (book as distributor first).
2. On distributor book Payment step, add a one-line **“Demo payment — no real charge”** badge near the amount (already present; keep prominent).
3. Collapse AMS sidebar into a single **AMS** group with nested links to reduce scroll for Hospital Admin.
4. After hold release, show a toast with **original arrival time** so Security confirms no reschedule (matches 2A policy).

### Reliability / testing
5. Add headed e2e for: **hold → release**, **urgent passcode gate handoff** (dummy Pay → book is covered by `delivery-payment-browser.spec.ts`).
6. Replace `networkidle` waits with role-specific `data-testid` markers for faster, less flaky logins.
7. Keep Playwright specs in sync with AMS + Payment (done for full-workflows; review visitor-registration suite separately).
8. Record HTML report artifact in CI: `npx playwright test --reporter=html`.

### Ops / config
9. Refresh **WHATSAPP_ACCESS_TOKEN** or disable Meta health check noise in local `.env`.
10. Document that local e2e requires **frontend :3000 + API :8002** and seed passwords via `ensure_user_passwords.py`.
11. Run `migrate_delivery_hold.py --yes` on every environment before demoing hold.

### Security note
12. Demo credentials in this report are **seed/demo only** — rotate before any shared staging/production; do not reuse `Connitor@123` outside demo DBs.

---

## 7. How to re-run

```bash
# Terminal A — API
cd python_backend
# activate venv
uvicorn main:app --reload --port 8002

# Terminal B — Frontend
cd frontend
npm run dev

# Terminal C — Headed e2e
cd frontend
npx playwright test tests/e2e/specs/ai-profiles-browser.spec.ts --project=chromium --headed --workers=1
npx playwright test tests/e2e/specs/ai-full-workflows-browser.spec.ts --project=chromium --headed --workers=1
npx playwright test tests/e2e/specs/delivery-payment-browser.spec.ts --project=chromium --headed --workers=1
```

---

## 8. Verdict

**Ready for demo of shell/navigation across all major roles and modules** on Electronic City seeds.  
**Dummy payment path proven by automation** (UPI + Card → Delivery booked).  
**Not yet fully proven by automation:** hold notify emails, urgent passcode dual-QR, and AMS issue-pass happy path — recommend a short manual script using the credentials above for those flows before stakeholder demo.
