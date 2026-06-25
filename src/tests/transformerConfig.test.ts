import { describe, expect, test } from 'vitest';
import { getRegionShapeStyle, regionShapeConfig, regionTransformerConfig } from '../canvas/transformerConfig';

describe('regionTransformerConfig', () => {
  test('allows free corner resize by default and keeps ratio only with Shift', () => {
    expect(regionTransformerConfig.keepRatio).toBe(false);
    expect(regionTransformerConfig.shiftBehavior).toBe('default');
  });
});

describe('regionShapeConfig', () => {
  test('keeps selection stroke visually stable while resizing', () => {
    expect(regionShapeConfig.strokeScaleEnabled).toBe(false);
  });

  test('does not draw a second region stroke for the selected transformer target', () => {
    expect(getRegionShapeStyle({ selected: true, scale: 1 })).toMatchObject({
      fill: 'rgba(0, 145, 255, 0.12)',
      strokeEnabled: false,
      dash: [],
    });
  });

  test('keeps dashed region outlines visible for unselected regions', () => {
    expect(getRegionShapeStyle({ selected: false, scale: 2 })).toMatchObject({
      fill: 'rgba(255, 255, 255, 0.08)',
      stroke: '#f6d365',
      strokeEnabled: true,
      strokeWidth: 2,
      strokeScaleEnabled: false,
      dash: [8, 6],
    });
  });

  test('keeps unselected region outlines stable when zoomed out', () => {
    expect(getRegionShapeStyle({ selected: false, scale: 0.25 })).toMatchObject({
      strokeWidth: 2,
      strokeScaleEnabled: false,
      dash: [8, 6],
    });
  });
});
