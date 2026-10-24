import { expect, test, type Page } from '@playwright/test';

const navigation = [
  { path: '/closing', label: 'Fechamento', labelEn: 'Month close', section: 'closing' },
  { path: '/balances', label: 'Saldos de horas', labelEn: 'Hour balances', section: 'closing' },
  { path: '/reports', label: 'Relatórios', labelEn: 'Reports', section: 'reports' },
];
const grants = [
  'closing.read',
  'closing.submit',
  'closing.approve',
  'closing.recalculate',
  'balances.read',
  'balances.write',
  'rates.read',
  'reports.export',
].map((permission) => ({ permission, scope: 'all' }));
const user = {
  id: 1,
  name: 'Finance reviewer',
  email: 'reviewer@example.invalid',
  roleId: 3,
  role: { id: 3, name: 'Consultant' },
};
const fixture = async (
  page: Page,
  mode: 'finance' | 'none' | 'public' = 'finance',
  loseFirstMovementResponse = false
) => {
  let version = 1,
    publishedVersion = 1,
    state = 'CLOSED',
    balance = 600;
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const appliedMovements = new Set<string>();
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const body = request.method() === 'GET' ? {} : (request.postDataJSON() ?? {});
    requests.push({ path, body });
    const respond = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: status === 200, data }),
      });
    if (path === '/api/auth/refresh')
      return mode === 'public' ? respond(null, 401) : respond({ token: 'ui-test-token', user });
    if (path === '/api/auth/setup-status')
      return respond({ needsSetup: false, registrationEnabled: false });
    if (path === '/api/capabilities')
      return respond({
        locale: 'en',
        navigation: mode === 'none' ? [] : navigation,
        grants: mode === 'none' ? [] : grants,
        flows: { closing: true, clientHourPool: true, personalHourBank: true },
      });
    if (path === '/api/preferences') return respond(body);
    if (path === '/api/closing-periods/options')
      return respond({ clients: [{ id: 10, name: 'Example client' }], accounts: [] });
    if (path === '/api/clients')
      return respond([{ id: 10, name: 'Example client', isActive: true }]);
    if (path === '/api/admin/reports/hour-pool') return respond([]);
    const snapshot = (minutes: number) => ({
      clientName: 'Example client',
      startDate: '2026-08-21',
      endDate: '2026-09-20',
      policy: { clientAccountId: null, consume: 'BILLABLE', individualBank: false },
      lines: [
        {
          userId: 1,
          name: 'Alex',
          workedMinutes: minutes,
          targetMinutes: 60,
          overtimeMinutes: 0,
          billableMinutes: minutes,
          billableAmount: minutes,
          issues: [],
        },
      ],
    });
    if (path === '/api/closing-periods')
      return respond({
        period: { id: 1, state, version, publishedVersion },
        preview: snapshot(31),
        published: snapshot(publishedVersion === 1 ? 61 : 31),
        needsRecalculation: publishedVersion === 1,
        revisions: [
          {
            version,
            reason: 'Verified service period',
            createdAt: '2026-10-01',
            approvedAt: state === 'CLOSED' ? '2026-10-02' : null,
            createdBy: 2,
          },
        ],
      });
    if (path === '/api/closing-periods/recalculate') {
      version = 2;
      state = 'REVIEW';
      return respond({ id: 1, version });
    }
    if (path === '/api/closing-periods/1/approve') {
      state = 'CLOSED';
      publishedVersion = version;
      return respond({ id: 1 });
    }
    const accounts = [
      {
        id: 1,
        name: 'Contract pool',
        kind: 'CLIENT',
        clientId: 10,
        balanceMinutes: balance,
        nextExpiry: null,
      },
      {
        id: 2,
        name: 'Alex personal bank',
        kind: 'PERSONAL',
        userId: 1,
        clientId: null,
        balanceMinutes: -90,
        nextExpiry: null,
      },
    ];
    if (path === '/api/hour-accounts/options')
      return respond({
        users: [{ id: 1, name: 'Alex' }],
        clients: [{ id: 10, name: 'Example client' }],
      });
    if (path === '/api/hour-accounts') return respond({ items: accounts, nextCursor: null });
    if (path === '/api/hour-accounts/1/movements') {
      if (!appliedMovements.has(String(body.requestKey))) {
        balance += Number(body.deltaMinutes);
        appliedMovements.add(String(body.requestKey));
      }
      if (loseFirstMovementResponse) {
        loseFirstMovementResponse = false;
        return route.abort('failed');
      }
      return respond({ id: 3 });
    }
    if (/^\/api\/hour-accounts\/\d+$/.test(path))
      return respond({
        ...accounts[Number(path.split('/').pop()) - 1],
        movements: [],
        movementCount: 0,
      });
    return respond({});
  });
  return requests;
};

test('login supports Portuguese and English without losing the typed email', async ({ page }) => {
  await fixture(page, 'public');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('person@example.invalid');
  await page.getByLabel('Idioma').selectOption('en');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('person@example.invalid');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
test('custom finance access can review, recalculate and approve independently of the base role', async ({
  page,
}) => {
  const requests = await fixture(page);
  await page.goto('/closing');
  await expect(page.getByRole('heading', { name: 'Month close', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Published revision' }).click();
  await expect(page.getByRole('cell', { name: '1h 01m', exact: true }).first()).toBeVisible();
  await page
    .getByLabel('Reason for submission, recalculation or return')
    .fill('Corrected an authorized entry');
  await page.getByRole('button', { name: 'Generate recalculation for review' }).click();
  await expect(page.getByRole('button', { name: 'Approve and post balances' })).toBeVisible();
  expect(requests.find((item) => item.path.endsWith('/recalculate'))?.body.expectedVersion).toBe(1);
  await page.getByRole('button', { name: 'Approve and post balances' }).click();
  await expect(page.getByRole('cell', { name: '31m', exact: true }).first()).toBeVisible();
  expect(requests.find((item) => item.path.endsWith('/approve'))?.body.expectedVersion).toBe(2);
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth)
  );
  await page.locator('main').evaluate((element) => {
    element.scrollTop = 0;
  });
});
test('client pool and personal bank have separate views and retain negative balances', async ({
  page,
}) => {
  const requests = await fixture(page);
  await page.goto('/balances');
  await page.getByRole('button', { name: /Contract pool/ }).click();
  await page
    .getByLabel('Reason (also used for reversals and transfers)')
    .fill('Purchased contract credit');
  await page.getByRole('button', { name: 'Record movement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contract pool · 11h 00m' })).toBeVisible();
  expect(requests.find((item) => item.path.endsWith('/movements'))?.body.deltaMinutes).toBe(60);
  await page.getByRole('tab', { name: 'Personal bank', exact: true }).click();
  await expect(page.getByRole('button', { name: /Alex personal bank/ })).toContainText('-1h 30m');
  await expect(page.getByRole('button', { name: /Contract pool/ })).toHaveCount(0);
});
test('an empty custom membership cannot open a restricted route', async ({ page }) => {
  const requests = await fixture(page, 'none');
  await page.goto('/closing');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Ask an administrator to assign you to a group.')).toBeVisible();
  expect(requests.some((item) => item.path === '/api/closing-periods')).toBe(false);
});
test('legacy report links preserve filters and open the allowed workspace tab', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/admin/hour-pool?clientId=10');
  await expect(page).toHaveURL(/\/reports\?clientId=10&tab=billing$/);
  await expect(page.getByRole('tab', { name: 'Billing', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('tab', { name: 'Insights', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Export', exact: true })).toBeVisible();
  await expect(page.locator('main')).toHaveCount(1);
});
test('retrying after a lost movement response reuses the same idempotency key', async ({
  page,
}) => {
  const requests = await fixture(page, 'finance', true);
  await page.goto('/balances');
  await page.getByRole('button', { name: /Contract pool/ }).click();
  await page
    .getByLabel('Reason (also used for reversals and transfers)')
    .fill('Contract credit with lost response');
  await page.getByRole('button', { name: 'Record movement', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Record movement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contract pool · 11h 00m' })).toBeVisible();
  const attempts = requests.filter((item) => item.path.endsWith('/movements'));
  expect(attempts).toHaveLength(2);
  expect(attempts[0].body.requestKey).toBe(attempts[1].body.requestKey);
});
