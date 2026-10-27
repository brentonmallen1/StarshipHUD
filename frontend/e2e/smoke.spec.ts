import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Auth is disabled for these runs, so the UI role comes from localStorage
const ROLE_KEY = 'starship-hud-role';

interface PanelSummary {
  id: string;
  slug: string;
  role_visibility: string[];
}

async function seededShipId(request: APIRequestContext): Promise<string> {
  const ships = await (await request.get('/api/ships')).json();
  return ships[0].id;
}

async function playerPanelWithWidgets(request: APIRequestContext, shipId: string): Promise<PanelSummary> {
  const panels: PanelSummary[] = await (await request.get(`/api/panels?ship_id=${shipId}`)).json();
  for (const panel of panels.filter((p) => p.role_visibility.includes('player'))) {
    const full = await (await request.get(`/api/panels/${panel.id}`)).json();
    if (full.widgets.length > 0) return panel;
  }
  throw new Error('Seed data has no player panel with widgets');
}

async function asRole(page: Page, role: 'player' | 'gm') {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [ROLE_KEY, role]);
}

test('player panel fits the viewport without scrolling', async ({ page, request }) => {
  const shipId = await seededShipId(request);
  const panel = await playerPanelWithWidgets(request, shipId);
  await asRole(page, 'player');

  await page.goto(`/${shipId}/panel/${panel.slug}`);
  await expect(page.locator('.react-grid-item').first()).toBeVisible();

  const container = page.locator('.panel-grid-container');
  const metrics = await container.evaluate((el) => ({
    overflowY: getComputedStyle(el).overflowY,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(metrics.overflowY).toBe('hidden');

  // Everything the grid renders must sit inside the visible container
  const containerBox = await container.boundingBox();
  const grid = await page.locator('.panel-grid').boundingBox();
  expect(containerBox && grid).toBeTruthy();
  expect(grid!.y + grid!.height).toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
});

test('draft alerts stay off player screens until transmitted, then arrive live', async ({ page, request }) => {
  const shipId = await seededShipId(request);
  const panel = await playerPanelWithWidgets(request, shipId);

  const createAlert = (message: string, transmitted: boolean) =>
    request.post('/api/events', {
      data: {
        ship_id: shipId,
        type: 'alert',
        severity: 'critical',
        message,
        data: { ship_wide: true },
        transmitted,
      },
    });

  // A transmitted alert guarantees the ticker is on screen to inspect
  await createAlert('E2E visible alert', true);
  const draft = await (await createAlert('E2E draft alert', false)).json();

  await asRole(page, 'player');
  await page.goto(`/${shipId}/panel/${panel.slug}`);
  await page.locator('.alert-ticker-header').click();
  const list = page.locator('.alert-ticker-list');
  await expect(list).toContainText('E2E visible alert');
  await expect(list).not.toContainText('E2E draft alert');

  // Transmit it; the change stream should deliver it without a reload and
  // well before the 30s fallback poll
  await request.patch(`/api/events/${draft.id}`, { data: { transmitted: true } });
  await expect(list).toContainText('E2E draft alert', { timeout: 8000 });
});

test('opening the panel editor does not save an unchanged layout', async ({ page, request }) => {
  const shipId = await seededShipId(request);
  const panel = await playerPanelWithWidgets(request, shipId);
  await asRole(page, 'gm');

  const layoutSaves: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/layout')) layoutSaves.push(req.url());
  });

  await page.goto(`/${shipId}/admin/panel/${panel.slug}`);
  await expect(page.locator('.edit-toolbar')).toBeVisible();
  await expect(page.locator('.react-grid-item').first()).toBeVisible();
  // Longer than the 1.5s auto-save delay
  await page.waitForTimeout(3000);

  expect(layoutSaves).toEqual([]);
  await expect(page.locator('.edit-toolbar')).not.toContainText('UNSAVED');
});

test('unknown console routes show a diegetic not-found screen', async ({ page, request }) => {
  const shipId = await seededShipId(request);
  await asRole(page, 'player');

  await page.goto(`/${shipId}/no-such-place`);
  await expect(page.getByText('No such console')).toBeVisible();

  await page.goto(`/${shipId}/panel/definitely-not-a-panel`);
  await expect(page.getByText('No such console')).toBeVisible();
});
