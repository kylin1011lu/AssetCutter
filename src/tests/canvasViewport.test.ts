import { describe, expect, test } from 'vitest';
import { calculateInitialViewport, shouldCommitStageDrag } from '../canvas/CanvasViewport';

describe('calculateInitialViewport', () => {
  test('starts a wide source image at original size', () => {
    const viewport = calculateInitialViewport({
      source: { width: 1774, height: 887 },
      viewport: { width: 1530, height: 880 },
      margin: 24,
    });

    expect(viewport.scale).toBe(1);
    expect(viewport.position.x).toBe(24);
    expect(viewport.position.y).toBe(24);
  });

  test('centers a small source image without upscaling', () => {
    const viewport = calculateInitialViewport({
      source: { width: 200, height: 120 },
      viewport: { width: 1000, height: 600 },
      margin: 24,
    });

    expect(viewport.scale).toBe(1);
    expect(viewport.position.x).toBe(400);
    expect(viewport.position.y).toBe(240);
  });
});

describe('shouldCommitStageDrag', () => {
  test('commits position only when the stage itself was dragged', () => {
    const stage = { id: 'stage' };
    const rect = { id: 'rect' };

    expect(shouldCommitStageDrag(stage, stage)).toBe(true);
    expect(shouldCommitStageDrag(stage, rect)).toBe(false);
  });
});
