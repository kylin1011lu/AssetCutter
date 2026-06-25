import { describe, expect, test } from 'vitest';
import {
  applyBackgroundModeToProject,
  addAssetGroup,
  applyAssetGroupRules,
  createDefaultProject,
  createRegion,
  createWholeImageRegion,
  createSourceRef,
  deleteRegionFromProject,
  getNextAssetGroupId,
  getNextRegionId,
  isSameSourceImage,
  normalizeRegionsToFrame,
  parseProjectJson,
  serializeProjectJson,
} from '../model/project';

describe('project JSON', () => {
  test('round-trips source, settings, and regions without losing data', () => {
    const project = createDefaultProject({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: true,
    });
    project.background.settings.mode = 'chromaKey';
    project.background.settings.chromaKey = '#ffffff';
    project.background.settings.tolerance = 24;
    project.regions.push(
      createRegion({
        id: 'fruit.apple',
        crop: { x: 4, y: 8, width: 32, height: 48 },
        backgroundMode: project.background.settings.mode,
      }),
    );

    const parsed = parseProjectJson(serializeProjectJson(project));

    expect(parsed).toEqual(project);
  });

  test('creates version 2 projects with a replayable source reference and background settings', () => {
    const project = createDefaultProject({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: false,
    });

    expect(project.version).toBe(2);
    expect(project.projectId).toMatch(/^project-/);
    expect(project.name).toBe('sheet');
    expect(project.sourceRef).toEqual({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: false,
      fingerprint: 'sheet.png:128x96:opaque',
    });
    expect(project.background.settings).toEqual({
      mode: 'source',
      chromaKey: '#00ff00',
      tolerance: 18,
      maskMode: 'edgeConnected',
      softEdge: 24,
      edgeGrow: 0,
      edgeSmoothing: 0,
      spillRemoval: 0,
    });
    expect(project.background.edits).toEqual([]);
    expect(project.groups).toEqual([]);
  });

  test('loads older version 2 project JSON files without groups', () => {
    const project = createDefaultProject({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: false,
    });
    const json = JSON.parse(serializeProjectJson(project));
    delete json.groups;

    const parsed = parseProjectJson(JSON.stringify(json));

    expect(parsed.groups).toEqual([]);
  });

  test('rejects version 1 project JSON because no legacy project files are supported', () => {
    const v1Json = JSON.stringify({
      version: 1,
      source: {
        fileName: 'hud.png',
        width: 300,
        height: 200,
        hasAlpha: false,
      },
      settings: {
        backgroundMode: 'chromaKey',
        chromaKey: '#11ee22',
        tolerance: 34,
      },
      regions: [
        {
          id: 'asset.1',
          label: 'Asset 1',
          enabled: true,
          crop: { x: 10, y: 20, width: 30, height: 40 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          exportSize: null,
          backgroundMode: 'chromaKey',
          anchor: { x: 0.5, y: 0.5 },
          tags: [],
        },
      ],
    });

    expect(() => parseProjectJson(v1Json)).toThrow('Unsupported project version.');
  });

  test('serializes version 2 projects without embedding runtime processed image data', () => {
    const project = {
      ...createDefaultProject({
        fileName: 'sheet.png',
        width: 128,
        height: 96,
        hasAlpha: false,
      }),
      processedSource: 'runtime-only',
    };

    const json = serializeProjectJson(project);

    expect(json).toContain('"version": 2');
    expect(json).not.toContain('processedSource');
  });
});

describe('isSameSourceImage', () => {
  const source = { fileName: 'sheet.png', width: 100, height: 80, hasAlpha: false };

  test('matches the same source image identity', () => {
    expect(isSameSourceImage(source, { ...source })).toBe(true);
  });

  test('does not match a different imported image', () => {
    expect(isSameSourceImage(source, { ...source, fileName: 'other.png' })).toBe(false);
    expect(isSameSourceImage(source, { ...source, width: 120 })).toBe(false);
    expect(isSameSourceImage(source, { ...source, hasAlpha: true })).toBe(false);
  });

  test('matches imported images against source references by fingerprint', () => {
    const sourceRef = createSourceRef(source);

    expect(isSameSourceImage(sourceRef, { ...source })).toBe(true);
    expect(isSameSourceImage(sourceRef, { ...source, fileName: 'copy.png' })).toBe(false);
  });
});

describe('getNextRegionId', () => {
  test('starts at 1 when there are no regions', () => {
    expect(getNextRegionId([])).toBe('1');
  });

  test('increments from the highest numeric resource id', () => {
    const project = createDefaultProject({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({
        id: '1',
        crop: { x: 0, y: 0, width: 16, height: 16 },
        backgroundMode: 'source',
      }),
      createRegion({
        id: '3',
        crop: { x: 20, y: 0, width: 16, height: 16 },
        backgroundMode: 'source',
      }),
    );

    expect(getNextRegionId(project.regions)).toBe('4');
  });
});

describe('applyBackgroundModeToProject', () => {
  test('updates default-mode regions when global mode changes', () => {
    const project = createDefaultProject({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({
        id: 'ui.panel',
        crop: { x: 0, y: 0, width: 32, height: 32 },
        backgroundMode: 'source',
      }),
    );

    const nextProject = applyBackgroundModeToProject(project, 'chromaKey');

    expect(nextProject.background.settings.mode).toBe('chromaKey');
    expect(nextProject.regions[0].backgroundMode).toBe('chromaKey');
  });

  test('keeps regions with custom mode when global mode changes', () => {
    const project = createDefaultProject({
      fileName: 'sheet.png',
      width: 128,
      height: 96,
      hasAlpha: true,
    });
    project.regions.push(
      createRegion({
        id: 'sprite.alpha',
        crop: { x: 0, y: 0, width: 32, height: 32 },
        backgroundMode: 'alpha',
      }),
    );
    project.background.settings.mode = 'source';

    const nextProject = applyBackgroundModeToProject(project, 'chromaKey');

    expect(nextProject.regions[0].backgroundMode).toBe('alpha');
  });
});

describe('normalizeRegionsToFrame', () => {
  test('expands only selected regions around their current centers', () => {
    const project = createDefaultProject({
      fileName: 'fruit.png',
      width: 500,
      height: 400,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({
        id: 'fruit.apple',
        crop: { x: 100, y: 80, width: 80, height: 100 },
        backgroundMode: 'chromaKey',
      }),
      createRegion({
        id: 'fruit.banana',
        crop: { x: 260, y: 100, width: 140, height: 70 },
        backgroundMode: 'chromaKey',
      }),
      createRegion({
        id: 'panel.top',
        crop: { x: 20, y: 20, width: 300, height: 60 },
        backgroundMode: 'chromaKey',
      }),
    );

    const normalized = normalizeRegionsToFrame(project, ['fruit.apple', 'fruit.banana'], {
      width: 160,
      height: 160,
    });

    expect(normalized.regions[0].crop).toEqual({ x: 60, y: 50, width: 160, height: 160 });
    expect(normalized.regions[1].crop).toEqual({ x: 250, y: 55, width: 160, height: 160 });
    expect(normalized.regions[2].crop).toEqual({ x: 20, y: 20, width: 300, height: 60 });
  });

  test('keeps normalized frames centered when they extend past the source bounds', () => {
    const project = createDefaultProject({
      fileName: 'edge.png',
      width: 200,
      height: 160,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({
        id: 'edge.item',
        crop: { x: 4, y: 6, width: 30, height: 40 },
        backgroundMode: 'chromaKey',
      }),
    );

    const normalized = normalizeRegionsToFrame(project, ['edge.item'], {
      width: 80,
      height: 80,
    });

    expect(normalized.regions[0].crop).toEqual({ x: -21, y: -14, width: 80, height: 80 });
  });
});

describe('asset groups', () => {
  test('generates stable group ids with conflict suffixes', () => {
    expect(getNextAssetGroupId([], 'UI Buttons')).toBe('ui-buttons');
    expect(getNextAssetGroupId([{ id: 'ui-buttons' }], 'UI Buttons')).toBe('ui-buttons-2');
    expect(getNextAssetGroupId([], '   ')).toBe('asset-group');
  });

  test('creates a group from existing regions and keeps one group per region', () => {
    const project = createDefaultProject({
      fileName: 'buttons.png',
      width: 300,
      height: 200,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({ id: 'play', crop: { x: 0, y: 0, width: 40, height: 20 }, backgroundMode: 'source' }),
      createRegion({ id: 'pause', crop: { x: 50, y: 0, width: 30, height: 20 }, backgroundMode: 'source' }),
      createRegion({ id: 'coin', crop: { x: 100, y: 0, width: 20, height: 20 }, backgroundMode: 'source' }),
    );

    const withButtons = addAssetGroup(project, { name: 'UI Buttons', regionIds: ['play', 'pause', 'missing'] });
    const withIcons = addAssetGroup(withButtons, { name: 'Icons', regionIds: ['pause', 'coin'] });

    expect(withButtons.groups[0]).toMatchObject({
      id: 'ui-buttons',
      name: 'UI Buttons',
      regionIds: ['play', 'pause'],
      frame: null,
      anchor: null,
      tags: [],
      exportPathPrefix: '',
    });
    expect(withIcons.groups.find((group) => group.id === 'ui-buttons')?.regionIds).toEqual(['play']);
    expect(withIcons.groups.find((group) => group.id === 'icons')?.regionIds).toEqual(['pause', 'coin']);
  });

  test('removes deleted regions from group members', () => {
    const project = createDefaultProject({
      fileName: 'buttons.png',
      width: 300,
      height: 200,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({ id: 'play', crop: { x: 0, y: 0, width: 40, height: 20 }, backgroundMode: 'source' }),
      createRegion({ id: 'pause', crop: { x: 50, y: 0, width: 30, height: 20 }, backgroundMode: 'source' }),
    );
    const grouped = addAssetGroup(project, { name: 'UI Buttons', regionIds: ['play', 'pause'] });

    const nextProject = deleteRegionFromProject(grouped, 'pause');

    expect(nextProject.regions.map((region) => region.id)).toEqual(['play']);
    expect(nextProject.groups[0].regionIds).toEqual(['play']);
  });

  test('applies saved group frame anchor and tags only to group members', () => {
    const project = createDefaultProject({
      fileName: 'buttons.png',
      width: 300,
      height: 200,
      hasAlpha: false,
    });
    project.regions.push(
      createRegion({ id: 'play', crop: { x: 0, y: 0, width: 40, height: 20 }, backgroundMode: 'source' }),
      createRegion({ id: 'pause', crop: { x: 60, y: 0, width: 30, height: 20 }, backgroundMode: 'source' }),
      createRegion({ id: 'coin', crop: { x: 120, y: 0, width: 20, height: 20 }, backgroundMode: 'source' }),
    );
    const grouped = addAssetGroup(project, { name: 'UI Buttons', regionIds: ['play', 'pause'] });
    grouped.groups[0] = {
      ...grouped.groups[0],
      frame: { width: 64, height: 64 },
      anchor: { x: 0.5, y: 0.5 },
      tags: ['ui', 'button'],
      exportPathPrefix: 'ui/buttons',
    };

    const nextProject = applyAssetGroupRules(grouped, 'ui-buttons');

    expect(nextProject.regions.find((region) => region.id === 'play')?.crop).toEqual({ x: -12, y: -22, width: 64, height: 64 });
    expect(nextProject.regions.find((region) => region.id === 'pause')?.crop).toEqual({ x: 43, y: -22, width: 64, height: 64 });
    expect(nextProject.regions.find((region) => region.id === 'play')?.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(nextProject.regions.find((region) => region.id === 'pause')?.tags).toEqual(['ui', 'button']);
    expect(nextProject.regions.find((region) => region.id === 'coin')?.crop).toEqual({ x: 120, y: 0, width: 20, height: 20 });
  });
});

describe('createWholeImageRegion', () => {
  test('creates a virtual region covering the entire source image', () => {
    const project = createDefaultProject({
      fileName: 'hud-controls-source.png',
      width: 1774,
      height: 887,
      hasAlpha: false,
    });
    project.background.settings.mode = 'chromaKey';

    const region = createWholeImageRegion(project);

    expect(region).toMatchObject({
      id: 'hud-controls-source',
      label: 'Whole image',
      enabled: true,
      crop: { x: 0, y: 0, width: 1774, height: 887 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      backgroundMode: 'chromaKey',
    });
  });
});
