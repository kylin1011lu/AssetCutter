import { describe, expect, test } from 'vitest';
import { buildManifest, sanitizeAssetFileName } from '../model/manifest';
import type { AssetGroup, AssetRegion } from '../model/project';

function region(id: string): AssetRegion {
  return {
    id,
    label: id,
    enabled: true,
    crop: { x: 0, y: 0, width: 16, height: 24 },
    padding: { top: 2, right: 2, bottom: 2, left: 2 },
    exportSize: null,
    backgroundMode: 'source',
    anchor: { x: 0.5, y: 0.75 },
    tags: ['sprite'],
  };
}

describe('sanitizeAssetFileName', () => {
  test('replaces path separators and unsafe characters deterministically', () => {
    expect(sanitizeAssetFileName('button/primary big')).toBe('button_primary_big.png');
    expect(sanitizeAssetFileName('fruit.apple')).toBe('fruit.apple.png');
  });
});

describe('buildManifest', () => {
  test('includes export dimensions group metadata and paths for all assets', () => {
    const disabledRegion = {
      ...region('button/disabled'),
      enabled: false,
    };
    const groups: AssetGroup[] = [
      {
        id: 'ui-buttons',
        name: 'UI Buttons',
        regionIds: ['button/primary'],
        frame: { width: 20, height: 28 },
        anchor: { x: 0.5, y: 0.75 },
        tags: ['ui'],
        exportPathPrefix: '/ui/buttons/',
      },
    ];
    const manifest = buildManifest([region('button/primary'), disabledRegion], groups);

    expect(manifest).toEqual({
      version: 2,
      assets: [
        {
          id: 'button/primary',
          file: 'button_primary.png',
          path: 'ui/buttons/button_primary.png',
          width: 20,
          height: 28,
          anchor: { x: 0.5, y: 0.75 },
          tags: ['sprite', 'ui'],
          groupId: 'ui-buttons',
        },
      ],
      groups: [
        {
          id: 'ui-buttons',
          name: 'UI Buttons',
          assets: ['button/primary'],
          frame: { width: 20, height: 28 },
          anchor: { x: 0.5, y: 0.75 },
          tags: ['ui'],
          exportPathPrefix: 'ui/buttons',
        },
      ],
    });
  });
});
