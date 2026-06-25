import { describe, expect, test } from 'vitest';
import {
  createPreviewBoardLayout,
  getPreviewBoardWorkspace,
  movePreviewBoardItem,
  type PreviewBoardItem,
} from '../app/previewBoard';

describe('preview board helpers', () => {
  test('creates an image-space layout from source crop positions', () => {
    const layout = createPreviewBoardLayout({
      regions: [
        { id: 'idle', x: 24, y: 40, width: 64, height: 80 },
        { id: 'run', x: 188, y: 44, width: 96, height: 80 },
        { id: 'jump', x: 72, y: 220, width: 72, height: 120 },
      ],
      previousItems: [],
    });

    expect(layout).toEqual([
      { regionId: 'idle', x: 24, y: 40, scale: 1 },
      { regionId: 'run', x: 188, y: 44, scale: 1 },
      { regionId: 'jump', x: 72, y: 220, scale: 1 },
    ]);
  });

  test('preserves existing positions and drops stale items', () => {
    const previousItems: PreviewBoardItem[] = [
      { regionId: 'idle', x: 420, y: 90, scale: 1 },
      { regionId: 'removed', x: 8, y: 8, scale: 1 },
    ];

    const layout = createPreviewBoardLayout({
      regions: [
        { id: 'idle', x: 24, y: 40, width: 64, height: 80 },
        { id: 'run', x: 188, y: 44, width: 96, height: 80 },
      ],
      previousItems,
    });

    expect(layout).toEqual([
      { regionId: 'idle', x: 420, y: 90, scale: 1 },
      { regionId: 'run', x: 188, y: 44, scale: 1 },
    ]);
  });

  test('moves a single preview item', () => {
    const items: PreviewBoardItem[] = [
      { regionId: 'idle', x: 32, y: 32, scale: 1 },
      { regionId: 'run', x: 144, y: 32, scale: 1 },
    ];

    expect(movePreviewBoardItem(items, 'run', { x: 180, y: 72 })).toEqual([
      { regionId: 'idle', x: 32, y: 32, scale: 1 },
      { regionId: 'run', x: 180, y: 72, scale: 1 },
    ]);
  });

  test('adds viewport-sized workspace margins around the source image', () => {
    expect(
      getPreviewBoardWorkspace({
        sourceSize: { width: 1774, height: 887 },
        viewportSize: { width: 900, height: 560 },
        zoom: 0.7,
      }),
    ).toEqual({
      originX: 900,
      originY: 560,
      width: 3042,
      height: 1741,
    });
  });
});
