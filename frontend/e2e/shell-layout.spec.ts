import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 900 },
  { name: '375', width: 375, height: 812 },
] as const;

async function openWorkspaceHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('tt-shell-layout', 'b');
    localStorage.setItem('time-tracker-theme', 'light');
  });
  await page.goto('/dev/layout-preview?layout=b&role=consultant');
  await page.waitForSelector('[data-testid="app-shell"]');
  await page.waitForSelector('[data-testid="layout-preview-ready"]');
}

test.describe('Workspace layout B', () => {
  test.describe.configure({ mode: 'serial' });

  test('skip link targets main; account panel is dialog with Escape focus return', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop a11y chrome');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspaceHome(page);

    const skip = page.locator('a.tt-skip-link');
    await expect(skip).toHaveAttribute('href', '#workspace-content');
    await expect(page.locator('#workspace-content')).toHaveAttribute('tabindex', '-1');

    const trigger = page.getByTestId('user-menu-trigger');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger.focus();
    await trigger.click();
    const popover = page.getByTestId('user-menu-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('role', 'dialog');
    await expect(popover).toHaveAttribute('aria-modal', 'true');

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('header tools include theme; no duplicate collapse in header', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop chrome assertions');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspaceHome(page);

    const search = page.getByTestId('global-search');
    const actions = page.getByTestId('shell-header-actions');
    await expect(search).toBeVisible();
    await expect(actions).toBeVisible();

    const headerTheme = actions.getByTestId('theme-toggle');
    await expect(headerTheme).toBeVisible();

    const aligned = await page.evaluate(() => {
      const searchEl = document.querySelector('[data-testid="global-search"]');
      const actionsEl = document.querySelector('[data-testid="shell-header-actions"]');
      if (!searchEl || !actionsEl) return { ok: false, delta: 999 };
      const s = searchEl.getBoundingClientRect();
      const a = actionsEl.getBoundingClientRect();
      const searchMid = s.top + s.height / 2;
      const actionsMid = a.top + a.height / 2;
      return { ok: Math.abs(searchMid - actionsMid) <= 4, delta: Math.abs(searchMid - actionsMid) };
    });
    expect(aligned.ok, `search/actions midY delta=${aligned.delta}`).toBe(true);

    const headerCollapse = page.getByTestId('header-sidebar-collapse');
    await expect(headerCollapse).toBeHidden();

    // Desktop rail only (mobile <details> also mounts a Sidebar with the same control).
    const sidebarCollapse = page.locator(
      '.tt-shell-sidebar-slot [data-testid="sidebar-collapse"]'
    );
    await expect(sidebarCollapse).toBeVisible();

    await expect(page.locator('.tt-shell-sidebar-slot .tt-brand-mark').first()).toBeVisible();

    const density = await page.evaluate(() => {
      const workspace = document.querySelector('.tt-shell-workspace');
      const main = document.querySelector('.tt-shell-main');
      const grid = document.querySelector('[data-testid="layout-preview-panels"]');
      if (!workspace || !main || !grid) return null;
      const w = workspace.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      const g = grid.getBoundingClientRect();
      return {
        workspaceFill: w.width / m.width,
        gridFill: g.width / w.width,
      };
    });
    expect(density).not.toBeNull();
    expect(density!.workspaceFill).toBeGreaterThan(0.92);
    expect(density!.gridFill).toBeGreaterThan(0.95);
  });

  test('sidebar collapse toggle stays at top; rail labels expose tooltips on focus', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop rail chrome');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspaceHome(page);

    const sidebar = page.locator('.tt-shell-sidebar-slot [data-testid="app-sidebar"]');
    const collapse = page.locator('.tt-shell-sidebar-slot [data-testid="sidebar-collapse"]');
    await expect(collapse).toBeVisible();

    const expandedTop = await collapse.evaluate((el) => el.getBoundingClientRect().top);
    await expect(sidebar.locator('.tt-sidebar-brand-row [data-testid="sidebar-collapse"]')).toHaveCount(
      1
    );

    await collapse.click();
    await expect(sidebar).toHaveClass(/tt-sidebar--rail/);

    const collapsedCollapse = page.locator(
      '.tt-shell-sidebar-slot [data-testid="sidebar-collapse"]'
    );
    await expect(collapsedCollapse).toBeVisible();
    await expect(
      sidebar.locator('.tt-sidebar-brand-row [data-testid="sidebar-collapse"]')
    ).toHaveCount(1);
    await expect(sidebar.locator('.tt-sidebar-footer [data-testid="sidebar-collapse"]')).toHaveCount(
      0
    );

    const collapsedTop = await collapsedCollapse.evaluate((el) => el.getBoundingClientRect().top);
    expect(
      Math.abs(collapsedTop - expandedTop),
      `collapse jumped: expandedTop=${expandedTop} collapsedTop=${collapsedTop}`
    ).toBeLessThanOrEqual(8);

    const railLink = sidebar.locator('.tt-rail-link').first();
    await expect(railLink).toBeVisible();
    const label = await railLink.getAttribute('aria-label');
    expect(label).toBeTruthy();

    const tipId = await railLink.getAttribute('aria-describedby');
    expect(tipId).toBeTruthy();
    const tip = page.locator(`[id="${tipId}"]`);
    await expect(tip).toHaveAttribute('role', 'tooltip');
    await expect(tip).toHaveText(label!);

    await railLink.focus();
    await expect(railLink).toBeFocused();
    await expect(tip).toBeVisible();
  });

  test('no horizontal overflow across workspace viewports', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Viewport matrix on desktop project');
    await openWorkspaceHome(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        metrics.scrollWidth,
        `overflow at ${vp.name}: scroll=${metrics.scrollWidth} client=${metrics.clientWidth}`
      ).toBeLessThanOrEqual(metrics.clientWidth + 1);

      if (vp.name === '375') {
        await expect(
          page.locator('.tt-shell-header-brand .tt-brand-mark')
        ).toBeVisible();
        await expect(page.getByTestId('shell-header-actions').getByTestId('theme-toggle')).toBeVisible();
        await expect(page.getByTestId('mobile-nav')).toBeVisible();
        await expect(page.locator('.tt-mobile-nav-label')).toHaveText(/Menu/i);
      }

    }
  });

  test('consultant time-entry view mounts real form chrome without seed login', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop consultant route preview');
    await page.addInitScript(() => {
      localStorage.setItem('tt-shell-layout', 'b');
      localStorage.setItem('time-tracker-theme', 'light');
    });
    await page.goto('/dev/layout-preview?layout=b&role=consultant&view=time-entry');
    await page.waitForSelector('[data-testid="layout-preview-ready"]');
    await expect(page.getByTestId('layout-preview-time-entry')).toBeVisible();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('time-entry-form')).toBeVisible();
    await expect(page.getByTestId('shell-header-actions').getByTestId('theme-toggle')).toBeVisible();
    await expect(page.getByRole('heading', { name: /lançar horas|log time/i })).toBeVisible();

    // Toolbar is sticky/in-flow — must not cover the form (fixed bottom overlay did on mobile).
    await page.setViewportSize({ width: 375, height: 812 });
    const overlap = await page.evaluate(() => {
      const toolbar = document.querySelector('[data-testid="layout-preview-toolbar"]');
      const form = document.querySelector('[data-testid="time-entry-form"]');
      if (!toolbar || !form) return { ok: false, reason: 'missing' };
      const t = toolbar.getBoundingClientRect();
      const f = form.getBoundingClientRect();
      const coversForm = t.bottom > f.top + 8 && t.top < f.bottom;
      return { ok: !coversForm, toolbarBottom: t.bottom, formTop: f.top };
    });
    expect(overlap.ok, `toolbar covers form: ${JSON.stringify(overlap)}`).toBe(true);
  });

  test('login light/dark at desktop and 375', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Login viewport matrix');

    for (const theme of ['light', 'dark'] as const) {
      for (const vp of [
        { name: 'desktop', width: 1440, height: 900 },
        { name: '375', width: 375, height: 812 },
      ]) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          baseURL: testInfo.project.use.baseURL as string,
          serviceWorkers: 'block',
        });
        await context.addInitScript((t) => {
          localStorage.setItem('time-tracker-theme', t);
          localStorage.setItem('tt-shell-layout', 'b');
        }, theme);
        const page = await context.newPage();
        await page.goto('/login', { waitUntil: 'networkidle' });
        await expect(page.locator('.tt-auth-stage')).toBeVisible();
        // The neutral mark stays visible on both desktop and mobile.
        await expect(page.locator('.tt-auth-card .tt-brand-mark')).toBeVisible();
        await expect(page.getByTestId('theme-toggle')).toBeVisible();

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

        await context.close();
      }
    }
  });
});
