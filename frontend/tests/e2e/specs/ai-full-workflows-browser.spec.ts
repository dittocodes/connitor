/**
 * Headed browser: full UI workflows across AI Electronic City profiles.
 *
 * Run (from frontend/):
 *   npx playwright test tests/e2e/specs/ai-full-workflows-browser.spec.ts --project=chromium --headed --workers=1
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const PASSWORD = 'Connitor@123';
const BRANCH_ID = '11000000-0000-4000-8000-000000000002';
const SCREENSHOT_DIR = path.join(__dirname, '../../../test-results/ai-full-workflows');

async function clearAuth(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function login(page: Page, email: string, loginPath: string): Promise<void> {
  await page.goto(loginPath);
  await expect(page.getByTestId('email-input')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('AI full browser workflows (Electronic City)', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('01 Home portals → role cards visible', async ({ page }) => {
    test.setTimeout(90000);
    await clearAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Hospital Admin|Security|Distributor/i).first()).toBeVisible({
      timeout: 15000,
    });
    await shot(page, '01-home-portals');
  });

  test('02 SUPER_ADMIN login + hospital chains', async ({ page }) => {
    test.setTimeout(120000);
    await clearAuth(page);
    await login(page, 'superadmin@hvts.com', '/auth/login?role=SUPER_ADMIN');
    await page.waitForURL(/\/dashboard\/?/, { timeout: 30000 });
    await shot(page, '02-super-admin-dashboard');
    await page.goto('/dashboard/hospital-chains');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await shot(page, '02-super-admin-chains');
  });

  test('03 HOSPITAL_ADMIN login + delivery + attendant pages', async ({ page }) => {
    test.setTimeout(120000);
    await clearAuth(page);
    await login(page, 'hospital.admin@connitor-elcity.com', '/auth/login?role=HOSPITAL_ADMIN');
    await page.waitForURL(/\/dashboard\/?/, { timeout: 30000 });
    await shot(page, '03-hospital-admin-home');
    await page.goto('/dashboard/delivery');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await shot(page, '03-hospital-admin-delivery');
    await page.goto('/dashboard/attendant-passes');
    await expect(page.getByRole('heading', { name: /Attendant Passes/i })).toBeVisible({
      timeout: 15000,
    });
    await shot(page, '03-hospital-admin-attendant');
  });

  test('04 DEPT / SUBDEPT / STAFF dashboards', async ({ page }) => {
    test.setTimeout(180000);
    for (const [role, email] of [
      ['DEPARTMENT_ADMIN', 'dept.admin@connitor-elcity.com'],
      ['SUB_DEPARTMENT_ADMIN', 'subdept.admin@connitor-elcity.com'],
      ['STAFF', 'priya.nair@connitor-elcity.com'],
    ] as const) {
      await clearAuth(page);
      await login(page, email, `/auth/login?role=${role === 'STAFF' ? 'STAFF' : role}`);
      await page.waitForURL(/\/dashboard\/?/, { timeout: 30000 });
      await shot(page, `04-${role}-home`);
    }
    await page.goto('/dashboard/my-visitors');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await shot(page, '04-STAFF-my-visitors');
  });

  test('05 DISTRIBUTOR books delivery via wizard', async ({ page }) => {
    test.setTimeout(180000);
    await clearAuth(page);
    await login(page, 'distributor@citygen.demo', '/auth/login?role=DISTRIBUTOR');
    await page.waitForURL(/\/vendor\/deliveries/, { timeout: 30000 });
    await shot(page, '05-distributor-list');

    await page.goto('/vendor/deliveries/book');
    await expect(page.getByText(/Select hospital|Book delivery/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Step 1: hospital
    await page.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /^Next$/i }).click();

    // Step 2: unscheduled ETA if available
    const unscheduled = page.getByText(/Book without a fixed slot/i);
    if (await unscheduled.isVisible().catch(() => false)) {
      await unscheduled.click();
      const eta = page.locator('input[type="datetime-local"]').first();
      if (await eta.isVisible().catch(() => false)) {
        const d = new Date();
        d.setHours(d.getHours() + 2);
        const pad = (n: number) => String(n).padStart(2, '0');
        const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        await eta.fill(local);
      }
    } else {
      const slotBtn = page.locator('button, [role="button"]').filter({ hasText: /AM|PM|:|slot/i }).first();
      if (await slotBtn.isVisible().catch(() => false)) {
        await slotBtn.click();
      }
    }
    await page.getByRole('button', { name: /^Next$/i }).click();

    // Step 3: goods
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /Medical supplies/i }).click();
    await page.getByRole('button', { name: /^Next$/i }).click();

    // Step 4: vehicle
    await page.getByRole('combobox').nth(1).click().catch(async () => {
      await page.getByRole('combobox').last().click();
    });
    // Prefer existing vehicle option if present
    const vehicleOption = page.getByRole('option').filter({ hasText: /[A-Z]{2}|KA|TN|MH|\d/ }).first();
    if (await vehicleOption.isVisible().catch(() => false)) {
      await vehicleOption.click();
    } else {
      await page.getByRole('option').first().click();
    }
    await page.getByRole('button', { name: /^Next$/i }).click();

    // Step 5: driver
    const driverCombo = page.getByRole('combobox').last();
    await driverCombo.click();
    await page.getByRole('option').nth(1).click().catch(async () => {
      await page.getByRole('option').first().click();
    });
    await page.getByRole('button', { name: /^Next$/i }).click();

    // Step 6: review + book
    await shot(page, '05-distributor-review');
    await page.getByRole('button', { name: /Book delivery/i }).click();
    await expect(page.getByText(/DLV-|booked|Delivery booked|success/i).first()).toBeVisible({
      timeout: 30000,
    });
    await shot(page, '05-distributor-booked');
  });

  test('06 PURCHASE opens delivery ops', async ({ page }) => {
    test.setTimeout(90000);
    await clearAuth(page);
    await login(page, 'purchase@connitor-elcity.com', '/auth/login');
    await page.waitForURL(/\/dashboard\/delivery/, { timeout: 30000 });
    await shot(page, '06-purchase-delivery');
  });

  test('07 RECEIVING board loads docks + queue', async ({ page }) => {
    test.setTimeout(90000);
    await clearAuth(page);
    await login(page, 'receiving@connitor-elcity.com', '/auth/login');
    await page.waitForURL(/\/dashboard\/receiving/, { timeout: 30000 });
    await expect(page.getByText(/Receiving board|At gate|At dock/i).first()).toBeVisible({
      timeout: 15000,
    });
    await shot(page, '07-receiving-board');
  });

  test('08 SECURITY dashboard tabs (delivery + attendant scan)', async ({ page }) => {
    test.setTimeout(120000);
    await clearAuth(page);
    await login(page, 'security@connitor-elcity.com', '/auth/login?role=SECURITY');
    await page.waitForURL(/\/security\/dashboard/, { timeout: 30000 });
    await shot(page, '08-security-home');

    await page.goto('/security/dashboard?tab=delivery-scan');
    await expect(page.getByText(/Scan delivery QR|Validate QR|delivery/i).first()).toBeVisible({
      timeout: 15000,
    });
    await shot(page, '08-security-delivery-scan');

    await page.goto('/security/dashboard?tab=attendant-scan');
    await expect(page.getByText(/attendant|government|govt|scan/i).first()).toBeVisible({
      timeout: 15000,
    });
    await shot(page, '08-security-attendant-scan');

    await page.goto('/security/dashboard?tab=appointments');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await shot(page, '08-security-appointments');
  });

  test('09 WARD_ADMIN admit patient + approve attendant UI', async ({ page }) => {
    test.setTimeout(180000);
    const mrn = `UI-MRN-${Date.now().toString().slice(-6)}`;

    const fillLabeled = async (labelText: string, value: string) => {
      await page
        .locator('div')
        .filter({ has: page.locator(`label:text-is("${labelText}")`) })
        .last()
        .locator('input')
        .fill(value);
    };

    await clearAuth(page);
    await login(page, 'ward.admin@connitor-elcity.com', '/auth/login?role=WARD_ADMIN');
    await page.waitForURL(/\/dashboard\/attendant-passes/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Attendant Passes/i })).toBeVisible();

    await fillLabeled('MRN', mrn);
    await fillLabeled('First name', 'UI');
    await fillLabeled('Last name', 'Patient');
    await fillLabeled('Ward', 'ICU');
    await fillLabeled('Room', '9');

    const createBtn = page.getByRole('button', { name: /Create admission/i });
    await expect(createBtn).toBeEnabled({ timeout: 10000 });
    await createBtn.click();
    await expect(page.getByText(mrn, { exact: false }).first()).toBeVisible({ timeout: 20000 });
    await shot(page, '09-ward-admission-created');

    await clearAuth(page);
    await page.goto(`/attendant-pass/apply?branchId=${BRANCH_ID}`);
    await fillLabeled('Patient MRN', mrn);
    await page.getByRole('button', { name: /Look up/i }).click();
    await expect(page.getByText(/Visiting|UI/i).first()).toBeVisible({ timeout: 20000 });

    await fillLabeled('Full name', 'UI Family Attendant');
    await fillLabeled('Email (pass QR will be sent here)', `ui.attendant.${Date.now()}@example.com`);
    await fillLabeled('Phone', '9876543210');
    await page.getByRole('button', { name: /Submit request/i }).click();
    await expect(page.getByRole('heading', { name: /Request submitted/i })).toBeVisible({
      timeout: 20000,
    });
    await shot(page, '09-public-apply-done');

    await clearAuth(page);
    await login(page, 'ward.admin@connitor-elcity.com', '/auth/login?role=WARD_ADMIN');
    await page.waitForURL(/\/dashboard\/attendant-passes/, { timeout: 30000 });
    await page.getByRole('button', { name: /^Attendants$/i }).click();
    await expect(page.getByText(/UI Family Attendant/i).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /^Approve$/i }).first().click();
    await expect(page.getByRole('button', { name: /Issue pass/i }).first()).toBeVisible({
      timeout: 15000,
    });
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Issue pass/i }).first().click();
    await expect(page.getByText(/Pass issued|issued/i).first()).toBeVisible({ timeout: 25000 });
    await shot(page, '09-ward-pass-issued');
  });

  test('10 Public visitor registration landing', async ({ page }) => {
    test.setTimeout(60000);
    await clearAuth(page);
    await page.goto(`/visitor-registration?branchId=${BRANCH_ID}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await shot(page, '10-visitor-registration');
  });
});
