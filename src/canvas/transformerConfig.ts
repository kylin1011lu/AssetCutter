export const regionTransformerConfig = {
  keepRatio: false,
  shiftBehavior: 'default',
} as const;

export const regionShapeConfig = {
  strokeScaleEnabled: false,
} as const;

interface RegionShapeStyleInput {
  selected: boolean;
  scale: number;
}

export function getRegionShapeStyle({ selected, scale }: RegionShapeStyleInput) {
  return {
    fill: selected ? 'rgba(0, 145, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)',
    stroke: selected ? '#0091ff' : '#f6d365',
    strokeEnabled: !selected,
    strokeWidth: 2,
    strokeScaleEnabled: regionShapeConfig.strokeScaleEnabled,
    dash: selected ? [] : [8, 6],
  };
}
