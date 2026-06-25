import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fixturePath = path.resolve(
  'tests/fixtures/tile-stack-blitz-v2-layered/hud-controls-source.png',
);
const alternateFixturePath = path.resolve(
  'tests/fixtures/tile-stack-blitz-v2-layered/playfield-background-source.png',
);

async function detectEdgeBackground(page: Page) {
  await page.getByTestId('tool-background').click();
  const backgroundInspector = page.getByRole('complementary').filter({ hasText: /Background properties|去色属性/ });
  await backgroundInspector.getByRole('button', { name: 'Detect edge background' }).click();
  await expect(page.locator('footer.statusbar')).toContainText('Sampled background');
}

test('starts on the enabled background tool before importing an image', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('zh');

  await expect(page.getByTestId('tool-background')).toBeEnabled();
  await expect(page.getByTestId('tool-background')).toHaveClass(/active/);
  await expect(page.getByTestId('tool-crop')).not.toHaveClass(/active/);
  await expect(page.getByTestId('current-tool-status')).toContainText(/当前工具 背景/);

  await page.getByTestId('tool-crop').click();
  await expect(page.getByTestId('tool-crop')).toHaveClass(/active/);

  await page.getByTestId('tool-background').click();
  await expect(page.getByTestId('tool-background')).toHaveClass(/active/);
});

test('imports fixture, edits region, exports png, saves and reloads project JSON', async ({ page }, testInfo) => {
  await page.goto('/');

  await page.getByTestId('language-select').selectOption('en');
  await expect(page.getByRole('button', { name: /Import/ })).toBeVisible();
  await page.getByTestId('language-select').selectOption('zh');
  await expect(page.getByRole('button', { name: /导入/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '工具与资源' })).toBeVisible();
  await page.getByTestId('language-select').selectOption('en');

  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await expect(page.getByTestId('source-meta')).toContainText('hud-controls-source.png');
  await expect(page.getByTestId('source-meta')).toContainText('1774 x 887');
  await expect(page.getByTestId('current-tool-status')).toContainText(/Current tool Background|当前工具 背景/);
  await expect(page.getByTestId('tool-background')).toHaveClass(/active/);
  await expect(page.getByTestId('region-selection-actions')).not.toBeVisible();
  await expect(page.getByTestId('region-list')).not.toBeVisible();
  await expect(page.getByTestId('tool-background')).toBeVisible();
  await expect(page.getByTestId('tool-asset-groups')).toBeVisible();
  await expect(page.getByRole('button', { name: /Result|结果/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Output frame|输出框/ })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: /Background properties|去色属性/ })).toBeVisible();
  await expect(page.getByText('1 去色')).not.toBeVisible();
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('add-region').click();
  await expect(page.getByTestId('region-list-section')).toBeVisible();
  await expect(page.getByLabel('Resource ID')).toHaveCount(0);
  await expect(page.getByTestId('resource-id-value')).toHaveText('1');
  await expect(page.getByTestId('region-list')).toContainText('Asset 1');
  await expect(page.getByTestId('region-id-badge-1')).toContainText('#1');
  await expect(page.getByTestId('canvas-region-id-1')).toHaveText('1');
  await page.getByTestId('tool-background').click();
  await expect(page.getByTestId('tool-background')).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: /去色属性|Background properties/ })).toBeVisible();
  const backgroundInspector = page.getByRole('complementary').filter({ hasText: /Background properties|去色属性/ });
  await expect(backgroundInspector.getByLabel('Global background')).toHaveCount(0);
  await expect(backgroundInspector.getByLabel('Key color')).toHaveValue('#00ff00');
  await expect(backgroundInspector.getByLabel('Tolerance')).toHaveValue('18');
  await expect(backgroundInspector.getByLabel('Cleanup scope')).toHaveValue('edgeConnected');
  await backgroundInspector.getByRole('button', { name: 'Detect edge background' }).click();
  await expect(page.locator('footer.statusbar')).toContainText('Sampled background');
  await page.getByTestId('tool-crop').click();
  await expect(page.getByRole('button', { name: 'Edit points' })).toHaveCount(0);
  await expect(page.getByLabel('Background mode')).toHaveCount(0);

  await page.getByLabel('Label').fill('Pause Button');
  await expect(page.getByTestId('region-list')).toContainText('Pause Button');
  await expect(page.getByTestId('preview-image')).toBeVisible();
  await expect(page.getByLabel('Enabled for ZIP export')).toHaveCount(0);

  const zipDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export ZIP/ }).click();
  const zipDownload = await zipDownloadPromise;
  expect(zipDownload.suggestedFilename()).toBe('asset-cutter-export.zip');

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save JSON/ }).click();
  const jsonDownload = await jsonDownloadPromise;
  const projectPath = testInfo.outputPath('project.json');
  await jsonDownload.saveAs(projectPath);
  const savedProject = JSON.parse(await readFile(projectPath, 'utf8'));
  expect(savedProject.version).toBe(2);
  expect(savedProject.sourceRef.fileName).toBe('hud-controls-source.png');
  expect(savedProject.background.settings.mode).toBe('chromaKey');
  expect(savedProject.background.settings.maskMode).toBe('edgeConnected');
  expect(savedProject.processedSource).toBeUndefined();

  await page.reload();
  await page.setInputFiles('[data-testid="project-input"]', projectPath);

  await expect(page.getByText('Project loaded. Re-import the matching source image before exporting.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Export ZIP/ })).toBeDisabled();
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);

  await expect(page.getByTestId('region-list')).toContainText('Pause Button');
  await page.getByTestId('tool-crop').click();
  await expect(page.getByTestId('resource-id-value')).toHaveText('1');
  await expect(page.getByText('Image reconnected to project.')).toBeVisible();
});

test('shows canvas zoom controls and supports buttons and wheel zoom', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);

  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('100%');
  await expect(page.getByTestId('canvas-background-transparent')).toBeChecked();
  await expect
    .poll(() => page.getByTestId('asset-canvas').evaluate((node) => getComputedStyle(node).backgroundImage))
    .not.toBe('none');
  await page.getByTestId('canvas-background-solid').check();
  await page.getByTestId('canvas-background-color-text').fill('#ff00ff');
  await expect(page.getByTestId('canvas-background-solid')).toBeChecked();
  await expect(page.getByTestId('canvas-background-color-text')).toHaveValue('#ff00ff');
  await expect
    .poll(() =>
      page.getByTestId('asset-canvas').evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
        };
      }),
    )
    .toEqual({
      backgroundColor: 'rgb(255, 0, 255)',
      backgroundImage: 'none',
    });
  await page.getByTestId('canvas-background-transparent').check();
  await expect(page.getByTestId('canvas-background-transparent')).toBeChecked();

  const stageCanvas = page.getByTestId('asset-canvas').locator('canvas').first();
  const konvaContent = page.getByTestId('asset-canvas').locator('.konvajs-content');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const shell = document.querySelector('[data-testid="asset-canvas"]');
        const content = document.querySelector('[data-testid="asset-canvas"] .konvajs-content') as HTMLElement | null;
        const canvas = document.querySelector('[data-testid="asset-canvas"] canvas') as HTMLCanvasElement | null;
        const pointTarget = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        return {
          canvas: canvas ? getComputedStyle(canvas).cursor : '',
          content: content ? getComputedStyle(content).cursor : '',
          shell: shell ? getComputedStyle(shell).cursor : '',
          contentInline: content?.style.cursor ?? '',
          canvasInline: canvas?.style.cursor ?? '',
          htmlInline: document.documentElement.style.cursor,
          bodyInline: document.body.style.cursor,
          point: pointTarget ? getComputedStyle(pointTarget).cursor : '',
        };
      }),
    )
    .toMatchObject({ canvas: 'pointer', content: 'pointer', shell: 'pointer', contentInline: 'pointer', canvasInline: 'pointer' });
  await expect
    .poll(() => stageCanvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe('pointer');

  await page.getByRole('button', { name: 'Zoom canvas in' }).click();
  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('125%');

  await page.getByRole('button', { name: 'Reset canvas zoom' }).click();
  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('100%');

  await page.getByRole('button', { name: 'Zoom canvas in' }).click();
  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('125%');

  await page.getByRole('button', { name: 'Zoom canvas out' }).click();
  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('100%');

  const canvas = page.getByTestId('asset-canvas');
  await canvas.hover();
  await expect
    .poll(() => page.evaluate(() => ({ html: document.documentElement.style.cursor, body: document.body.style.cursor })))
    .toEqual({ html: 'pointer', body: 'pointer' });
  await page.mouse.down();
  await expect
    .poll(() =>
      Promise.all([
        stageCanvas.evaluate((node) => getComputedStyle(node).cursor),
        konvaContent.evaluate((node) => getComputedStyle(node).cursor),
        canvas.evaluate((node) => getComputedStyle(node).cursor),
      ]),
    )
    .toEqual(['grabbing', 'grabbing', 'grabbing']);
  await expect
    .poll(() => page.evaluate(() => document.body.style.cursor))
    .toBe('grabbing');
  await expect
    .poll(() => stageCanvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe('grabbing');
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => ({ html: document.documentElement.style.cursor, body: document.body.style.cursor })))
    .toEqual({ html: 'pointer', body: 'pointer' });

  await page.mouse.wheel(0, -180);
  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('108%');
});

test('keeps canvas zoom while background tolerance refreshes the result image', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);

  await page.getByRole('button', { name: 'Zoom canvas in' }).click();
  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('125%');

  await detectEdgeBackground(page);
  const backgroundInspector = page.getByRole('complementary').filter({ hasText: /Background properties|去色属性/ });
  await backgroundInspector.getByLabel('Tolerance').fill('60');
  await expect(backgroundInspector.getByLabel('Tolerance')).toHaveValue('60');
  await page.waitForTimeout(500);

  await expect(page.getByTestId('canvas-zoom-label')).toHaveText('125%');
});

test('auto-detects from result image alpha, using the whole image before cleanup', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await page.getByTestId('tool-crop').click();

  await page.getByTestId('auto-detect-regions').click();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(1);
  await expect(page.getByTestId('region-list')).toContainText('1774 x 887');
  await expect(page.getByText('Auto-detected 1 regions.')).toBeVisible();

  await page.reload();
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);

  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();

  await page.getByTestId('tool-background').click();
  const backgroundInspector = page.getByRole('complementary').filter({ hasText: /Background properties|去色属性/ });
  await expect(backgroundInspector.getByLabel('Global background')).toHaveCount(0);
  await expect(backgroundInspector.getByLabel('Key color')).not.toHaveValue('#00ff00');
  await expect(backgroundInspector.getByLabel('Tolerance')).not.toHaveValue('18');
  await page.getByTestId('tool-crop').click();
  await expect(page.getByTestId('region-list')).toContainText('Asset 1');
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);
  await expect(page.getByText('Auto-detected 3 regions.')).toBeVisible();
});

test('keeps normalization controls out of the crop inspector', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();

  await expect(page.getByTestId('region-list')).toContainText('1565 x 319');
  await page.getByTestId('region-batch-select-2').check();
  await page.getByTestId('region-batch-select-3').check();
  await expect(page.getByTestId('batch-normalize-panel')).toHaveCount(0);
  await expect(page.getByLabel('Frame width')).toHaveCount(0);
  await expect(page.getByLabel('Frame height')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Normalize selected' })).toHaveCount(0);
});

test('deletes selected crop boxes from the inspector button and keyboard shortcut', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);

  await page.getByRole('button', { name: /Asset 2/ }).click();
  await expect(page.getByTestId('crop-action-section')).toBeVisible();
  await expect(page.getByTestId('crop-object-section')).toBeVisible();
  const deleteButton = page.getByRole('button', { name: 'Delete crop box' });
  const deleteButtonBox = await deleteButton.boundingBox();
  const cropGroupBox = await page.getByRole('group', { name: 'Crop' }).boundingBox();
  expect(deleteButtonBox).not.toBeNull();
  expect(cropGroupBox).not.toBeNull();
  expect(deleteButtonBox!.y).toBeLessThan(cropGroupBox!.y);
  await page.getByLabel('Label').click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);
  await expect(page.getByTestId('resource-id-value')).toHaveText('2');

  await deleteButton.click();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(2);
  await expect(page.getByTestId('region-id-badge-2')).toHaveCount(0);

  await page.getByRole('button', { name: /Asset 3/ }).click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(1);
  await expect(page.getByTestId('region-id-badge-3')).toHaveCount(0);
});

test('creates an asset group, applies saved rules, reloads it, and exports manifest groups', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();

  await page.getByTestId('region-batch-select-2').check();
  await page.getByTestId('region-batch-select-3').check();
  await page.getByTestId('tool-asset-groups').click();
  await page.getByLabel('Group name').fill('UI Buttons');
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.locator('footer.statusbar')).toContainText('Created UI Buttons with 2 regions.');

  await page.getByLabel('Path prefix').fill('ui/buttons');
  await page.getByLabel('Frame width').fill('300');
  await page.getByLabel('Frame height').fill('300');
  await page.getByLabel('Anchor X').fill('0.5');
  await page.getByLabel('Anchor Y').fill('0.5');
  await page.getByLabel('Tags').fill('ui, button');
  await page.getByRole('button', { name: 'Apply group' }).click();

  await expect(page.locator('footer.statusbar')).toContainText('Applied UI Buttons rules to 2 regions.');
  await expect(page.getByTestId('region-list').getByText('UI Buttons · 300 x 300')).toHaveCount(2);
  await expect(page.getByTestId('region-list')).toContainText('Ungrouped · 1565 x 319');
  await expect(page.getByTestId('canvas-region-id-2')).toHaveText('2');

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save JSON/ }).click();
  const jsonDownload = await jsonDownloadPromise;
  const projectPath = testInfo.outputPath('asset-groups-project.json');
  await jsonDownload.saveAs(projectPath);
  const savedProject = JSON.parse(await readFile(projectPath, 'utf8'));
  expect(savedProject.groups).toEqual([
    expect.objectContaining({
      id: 'ui-buttons',
      name: 'UI Buttons',
      regionIds: ['2', '3'],
      frame: { width: 300, height: 300 },
      anchor: { x: 0.5, y: 0.5 },
      tags: ['ui', 'button'],
      exportPathPrefix: 'ui/buttons',
    }),
  ]);

  await page.reload();
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="project-input"]', projectPath);
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await page.getByTestId('tool-asset-groups').click();
  await expect(page.getByLabel('Current group')).toHaveValue('ui-buttons');
  await expect(page.getByLabel('Path prefix')).toHaveValue('ui/buttons');

  const zipDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export ZIP/ }).click();
  const zipDownload = await zipDownloadPromise;
  const zipPath = testInfo.outputPath('asset-groups-export.zip');
  await zipDownload.saveAs(zipPath);
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const manifestFile = zip.file('manifest.json');
  expect(manifestFile).not.toBeNull();
  const manifest = JSON.parse(await manifestFile!.async('string'));

  expect(zip.file('ui/buttons/2.png')).not.toBeNull();
  expect(zip.file('2.png')).toBeNull();
  expect(manifest.version).toBe(2);
  expect(manifest.groups).toEqual([
    expect.objectContaining({
      id: 'ui-buttons',
      assets: ['2', '3'],
      exportPathPrefix: 'ui/buttons',
    }),
  ]);
  expect(manifest.assets.filter((asset: { groupId?: string }) => asset.groupId === 'ui-buttons')).toHaveLength(2);
  expect(manifest.assets.find((asset: { id: string }) => asset.id === '2').path).toBe('ui/buttons/2.png');
});

test('confirms before replacing existing regions with auto-detect results', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);

  await page.getByRole('button', { name: /Asset 2/ }).click();
  await page.getByLabel('Label').fill('Custom Asset');
  await expect(page.getByTestId('region-list')).toContainText('Custom Asset');

  await page.getByTestId('auto-detect-regions').click();
  await expect(page.getByRole('dialog', { name: 'Run auto-detect again?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog', { name: 'Run auto-detect again?' })).not.toBeVisible();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);
  await expect(page.getByTestId('region-list')).toContainText('Custom Asset');

  await page.getByTestId('auto-detect-regions').click();
  await page.getByRole('button', { name: 'Clear and re-detect' }).click();

  await expect(page.getByRole('dialog', { name: 'Run auto-detect again?' })).not.toBeVisible();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);
  await expect(page.getByTestId('region-list')).not.toContainText('Custom Asset');
  await expect(page.getByText('Auto-detected 3 regions.')).toBeVisible();
});

test('selects and clears all regions from visible controls and the shortcut', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();

  await expect(page.getByTestId('region-selection-actions')).toBeVisible();
  await page.getByTestId('select-all-regions').click();

  await expect(page.getByTestId('batch-normalize-panel')).toHaveCount(0);
  await expect(page.getByTestId('region-batch-select-1')).toBeChecked();
  await expect(page.getByTestId('region-batch-select-2')).toBeChecked();
  await expect(page.getByTestId('region-batch-select-3')).toBeChecked();

  await page.getByTestId('clear-region-selection').click();

  await expect(page.getByTestId('batch-normalize-panel')).toHaveCount(0);
  await expect(page.getByTestId('region-batch-select-1')).not.toBeChecked();
  await expect(page.getByTestId('region-batch-select-2')).not.toBeChecked();
  await expect(page.getByTestId('region-batch-select-3')).not.toBeChecked();

  await page.keyboard.press('ControlOrMeta+A');

  await expect(page.getByTestId('batch-normalize-panel')).toHaveCount(0);
  await expect(page.getByTestId('region-batch-select-1')).toBeChecked();
  await expect(page.getByTestId('region-batch-select-2')).toBeChecked();
  await expect(page.getByTestId('region-batch-select-3')).toBeChecked();
});

test('keeps canvas resource id badge attached while dragging a crop box', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();
  await page.getByRole('button', { name: /Asset 1/ }).click();

  const badge = page.getByTestId('canvas-region-id-1');
  const beforeDrag = await badge.boundingBox();
  expect(beforeDrag).not.toBeNull();

  await page.mouse.move(beforeDrag!.x + 40, beforeDrag!.y + 40);
  await page.mouse.down();
  await page.mouse.move(beforeDrag!.x + 120, beforeDrag!.y + 80, { steps: 6 });

  const duringDrag = await badge.boundingBox();
  expect(duringDrag).not.toBeNull();
  expect(duringDrag!.x - beforeDrag!.x).toBeGreaterThan(40);
  expect(duringDrag!.y - beforeDrag!.y).toBeGreaterThan(20);

  await page.mouse.up();
});

test('keeps crop boxes outside the source image instead of snapping them back', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('add-region').click();

  const cropGroup = page.getByRole('group', { name: 'Crop' });
  await cropGroup.getByLabel('x').fill('2000');
  await cropGroup.getByLabel('y').fill('-50');

  await expect(cropGroup.getByLabel('x')).toHaveValue('2000');
  await expect(cropGroup.getByLabel('y')).toHaveValue('-50');
});

test('zooms inline preview and opens a large preview inspector', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();
  await page.getByRole('button', { name: /Asset 3/ }).click();

  await expect(page.getByTestId('preview-image')).toBeVisible();
  await expect(page.getByTestId('preview-zoom-label')).toHaveText('100%');

  await page.getByRole('button', { name: 'Zoom preview out' }).click();

  await expect(page.getByTestId('preview-zoom-label')).toHaveText('75%');

  await page.getByRole('button', { name: 'Zoom preview in' }).click();

  await expect(page.getByTestId('preview-zoom-label')).toHaveText('100%');

  await page.getByRole('button', { name: 'Zoom preview in' }).click();

  await expect(page.getByTestId('preview-zoom-label')).toHaveText('125%');
  await expect
    .poll(() =>
      page.getByTestId('preview-viewport').evaluate((node) => node.scrollWidth > node.clientWidth),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Open large preview' }).click();

  await expect(page.getByRole('dialog', { name: 'Large preview' })).toBeVisible();
  await expect(page.getByTestId('large-preview-image')).toBeVisible();
  await expect(page.getByTestId('large-preview-zoom-label')).toHaveText('125%');
  await expect(page.getByTestId('large-preview-background-transparent')).toBeChecked();
  await expect
    .poll(() =>
      page.getByTestId('large-preview-viewport').evaluate((node) => getComputedStyle(node).backgroundImage),
    )
    .not.toBe('none');

  await page.getByTestId('large-preview-background-solid').check();
  await page.getByTestId('large-preview-background-color-text').fill('#00ff00');

  await expect(page.getByTestId('large-preview-background-solid')).toBeChecked();
  await expect(page.getByTestId('large-preview-background-color-text')).toHaveValue('#00ff00');
  await expect
    .poll(() =>
      page.getByTestId('large-preview-viewport').evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
        };
      }),
    )
    .toEqual({
      backgroundColor: 'rgb(0, 255, 0)',
      backgroundImage: 'none',
    });

  await page.getByTestId('large-preview-background-transparent').check();
  await expect(page.getByTestId('large-preview-background-transparent')).toBeChecked();

  await page.getByTestId('large-preview-viewport').hover();
  await page.mouse.wheel(0, -180);

  await expect(page.getByTestId('large-preview-zoom-label')).toHaveText('130%');

  await page.getByRole('button', { name: 'Zoom large preview in' }).click();

  await expect(page.getByTestId('large-preview-zoom-label')).toHaveText('155%');

  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: 'Zoom large preview in' }).click();
  }
  await expect(page.getByTestId('large-preview-zoom-label')).toHaveText('405%');

  const largePreviewViewport = page.getByTestId('large-preview-viewport');
  await largePreviewViewport.evaluate((node) => {
    node.scrollLeft = 240;
    node.scrollTop = 240;
  });
  const viewportBox = await largePreviewViewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const anchorPoint = {
    x: viewportBox!.x + viewportBox!.width * 0.62,
    y: viewportBox!.y + viewportBox!.height * 0.58,
  };
  const beforeWheelAnchor = await page.evaluate(({ x, y }) => {
    const image = document.querySelector('[data-testid="large-preview-image"]');
    if (!(image instanceof HTMLElement)) throw new Error('Large preview image not found');
    const rect = image.getBoundingClientRect();
    return {
      x: (x - rect.left) / rect.width,
      y: (y - rect.top) / rect.height,
    };
  }, anchorPoint);
  await page.mouse.move(anchorPoint.x, anchorPoint.y);
  await page.mouse.wheel(0, -180);

  await expect(page.getByTestId('large-preview-zoom-label')).toHaveText('410%');
  const afterWheelAnchor = await page.evaluate(({ x, y }) => {
    const image = document.querySelector('[data-testid="large-preview-image"]');
    if (!(image instanceof HTMLElement)) throw new Error('Large preview image not found');
    const rect = image.getBoundingClientRect();
    return {
      x: (x - rect.left) / rect.width,
      y: (y - rect.top) / rect.height,
    };
  }, anchorPoint);
  expect(Math.abs(afterWheelAnchor.x - beforeWheelAnchor.x)).toBeLessThan(0.01);
  expect(Math.abs(afterWheelAnchor.y - beforeWheelAnchor.y)).toBeLessThan(0.01);

  for (let index = 0; index < 16; index += 1) {
    await page.getByRole('button', { name: 'Zoom large preview in' }).click();
  }
  await expect(page.getByTestId('large-preview-zoom-label')).toHaveText('800%');

  await largePreviewViewport.evaluate((node) => {
    node.scrollLeft = 240;
    node.scrollTop = 240;
  });
  const beforeDragScroll = await largePreviewViewport.evaluate((node) => ({
    left: node.scrollLeft,
    top: node.scrollTop,
  }));
  await page.mouse.move(viewportBox!.x + 160, viewportBox!.y + 160);
  await page.mouse.down();
  await page.mouse.move(viewportBox!.x + 80, viewportBox!.y + 80, { steps: 4 });
  await page.mouse.up();

  await expect
    .poll(() =>
      largePreviewViewport.evaluate((node) => ({
        left: node.scrollLeft,
        top: node.scrollTop,
      })),
    )
    .not.toEqual(beforeDragScroll);

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Large preview' })).not.toBeVisible();
});

test('clears regions when importing a different source image', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);
  await detectEdgeBackground(page);
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('auto-detect-regions').click();
  await expect(page.getByTestId('region-list').getByRole('button')).toHaveCount(3);

  await page.setInputFiles('[data-testid="image-input"]', alternateFixturePath);

  await expect(page.getByTestId('source-meta')).toContainText('playfield-background-source.png');
  await expect(page.getByTestId('region-list')).not.toBeVisible();
  await expect(page.getByText('No regions yet.')).not.toBeVisible();
});

test('edits background settings immediately without apply or cancel controls', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);

  await page.getByTestId('tool-background').click();
  const backgroundInspector = page.getByRole('complementary').filter({ hasText: /Background properties|去色属性/ });
  await expect(page.getByRole('dialog', { name: 'Background editor' })).not.toBeVisible();
  await expect(page.getByTestId('background-editor-workbench')).not.toBeVisible();
  await expect(page.getByTestId('asset-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Result' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alpha mask' })).toBeVisible();
  await expect(backgroundInspector.getByRole('button', { name: 'Cancel' })).not.toBeVisible();
  await expect(backgroundInspector.getByRole('button', { name: 'Apply' })).not.toBeVisible();
  await expect(backgroundInspector.getByRole('button', { name: 'Detect edge background' })).toBeVisible();
  await expect(backgroundInspector.getByLabel('Cleanup scope')).toHaveValue('edgeConnected');
  await expect(backgroundInspector.getByLabel('Soft edge')).toHaveValue('24');
  await expect(backgroundInspector.getByLabel('Edge grow')).toHaveValue('0');
  await expect(backgroundInspector.getByLabel('Anti-alias')).toHaveValue('0');
  await expect(backgroundInspector.getByLabel('Spill removal')).toHaveValue('0');
  const antiAliasLabelGap = await backgroundInspector.evaluate(() => {
    const label = document.querySelector('label[for="background-edge-smoothing"]');
    const button = document.querySelector('[data-testid="parameter-help-toggle-edgeSmoothing"]');
    if (!(label instanceof HTMLElement) || !(button instanceof HTMLElement)) return Number.POSITIVE_INFINITY;
    return button.getBoundingClientRect().left - label.getBoundingClientRect().right;
  });
  expect(antiAliasLabelGap).toBeGreaterThanOrEqual(0);
  expect(antiAliasLabelGap).toBeLessThan(12);
  const toleranceBoxBeforeHelp = await backgroundInspector.getByLabel('Tolerance').boundingBox();
  expect(toleranceBoxBeforeHelp).not.toBeNull();
  await backgroundInspector.getByTestId('parameter-help-toggle-tolerance').click();
  await expect(page.getByTestId('parameter-help-tolerance')).toContainText('color can differ');
  await expect(page.getByTestId('parameter-help-tolerance')).toHaveAttribute('role', 'tooltip');
  const toleranceBoxAfterHelp = await backgroundInspector.getByLabel('Tolerance').boundingBox();
  expect(toleranceBoxAfterHelp).not.toBeNull();
  expect(Math.abs(toleranceBoxAfterHelp!.y - toleranceBoxBeforeHelp!.y)).toBeLessThan(1);
  await backgroundInspector.getByTestId('parameter-help-toggle-softEdge').click();
  await expect(page.getByTestId('parameter-help-softEdge')).toContainText('Feathers');
  await backgroundInspector.getByTestId('parameter-help-toggle-edgeSmoothing').click();
  await expect(page.getByTestId('parameter-help-edgeSmoothing')).toContainText('stair-step');

  await backgroundInspector.getByRole('button', { name: 'Detect edge background' }).click();
  await expect(page.locator('footer.statusbar')).toContainText('Sampled background');

  await backgroundInspector.getByLabel('Cleanup scope').selectOption('globalColor');
  await backgroundInspector.getByLabel('Tolerance').fill('60');
  await backgroundInspector.getByLabel('Soft edge').fill('48');
  await backgroundInspector.getByLabel('Edge grow').fill('2');
  await backgroundInspector.getByLabel('Anti-alias').fill('70');
  await backgroundInspector.getByLabel('Spill removal').fill('35');
  await page.getByRole('button', { name: 'Alpha mask' }).click();
  await expect(page.getByRole('button', { name: 'Alpha mask' })).toHaveClass(/activeMode/);

  await expect(page.getByTestId('background-editor-workbench')).not.toBeVisible();
  await expect(page.getByTestId('asset-canvas')).toBeVisible();
  await page.getByTestId('tool-crop').click();
  await page.getByTestId('tool-background').click();
  const reopenedBackgroundInspector = page.getByRole('complementary').filter({ hasText: /Background properties|去色属性/ });
  await expect(reopenedBackgroundInspector.getByLabel('Cleanup scope')).toHaveValue('globalColor');
  await expect(reopenedBackgroundInspector.getByLabel('Tolerance')).toHaveValue('60');
  await expect(reopenedBackgroundInspector.getByLabel('Soft edge')).toHaveValue('48');
  await expect(reopenedBackgroundInspector.getByLabel('Edge grow')).toHaveValue('2');
  await expect(reopenedBackgroundInspector.getByLabel('Anti-alias')).toHaveValue('70');
  await expect(reopenedBackgroundInspector.getByLabel('Spill removal')).toHaveValue('35');
});

test('keeps the same main canvas while using the background tool', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('language-select').selectOption('en');
  await page.setInputFiles('[data-testid="image-input"]', fixturePath);

  await expect(page.getByTestId('asset-canvas')).toBeVisible();
  const canvasBefore = await page.getByTestId('asset-canvas').boundingBox();
  expect(canvasBefore).not.toBeNull();

  await page.getByTestId('tool-background').click();

  await expect(page.getByTestId('asset-canvas')).toBeVisible();
  await expect(page.getByTestId('background-editor-workbench')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Background properties' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Background editor' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Result' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Alpha mask' })).toHaveCount(1);
});
