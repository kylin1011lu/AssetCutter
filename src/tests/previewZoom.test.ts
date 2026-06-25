import { describe, expect, test } from 'vitest';
import { getAnchoredPreviewScroll, getNextPreviewZoom } from '../app/previewZoom';

describe('preview zoom helpers', () => {
  test('uses fine wheel steps without changing button zoom steps', () => {
    expect(getNextPreviewZoom(1, 0.05)).toBe(1.05);
    expect(getNextPreviewZoom(1.25, 0.05)).toBe(1.3);
    expect(getNextPreviewZoom(1.3, 0.25)).toBe(1.55);
    expect(getNextPreviewZoom(1, -0.05)).toBe(0.95);
    expect(getNextPreviewZoom(0.25, -0.05)).toBe(0.25);
  });

  test('keeps the image point under the cursor fixed after zooming', () => {
    const scroll = getAnchoredPreviewScroll({
      anchorX: 0.42,
      anchorY: 0.63,
      imageHeight: 1094.7,
      imageOffsetLeft: 14,
      imageOffsetTop: 14,
      imageWidth: 1061.9,
      viewportX: 520,
      viewportY: 340,
    });

    expect(scroll.left).toBeCloseTo(-60.002, 3);
    expect(scroll.top).toBeCloseTo(363.661, 3);
  });
});
