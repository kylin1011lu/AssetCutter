import type { Rect } from '../model/project';

export type AutoDetectWarning = 'autoDetectNoRegions';

export interface AutoDetectInput {
  padding?: number;
  minArea?: number;
}

export interface AutoDetectResult {
  rects: Rect[];
  warning: AutoDetectWarning | null;
}

interface ComponentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

export interface EdgeBackgroundColorResult {
  color: string;
  tolerance: number;
}

export function detectAssetRegionsFromImageData(imageData: ImageData, input: AutoDetectInput = {}): AutoDetectResult {
  const alphaStats = getAlphaStats(imageData);
  if (alphaStats.opaquePixelCount === 0) {
    return { rects: [], warning: 'autoDetectNoRegions' };
  }
  if (alphaStats.transparentPixelCount === 0) {
    return {
      rects: [{ x: 0, y: 0, width: imageData.width, height: imageData.height }],
      warning: null,
    };
  }

  const visited = new Uint8Array(imageData.width * imageData.height);
  const rects: Rect[] = [];
  const minArea = input.minArea ?? Math.max(16, Math.round(imageData.width * imageData.height * 0.0005));
  const padding = input.padding ?? 4;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const index = y * imageData.width + x;
      if (visited[index] || !isOpaquePixel(imageData, x, y)) continue;

      const bounds = collectComponentBounds(imageData, visited, x, y);
      if (bounds.area < minArea) continue;

      rects.push({
        x: Math.max(0, bounds.minX - padding),
        y: Math.max(0, bounds.minY - padding),
        width: Math.min(imageData.width, bounds.maxX + padding + 1) - Math.max(0, bounds.minX - padding),
        height: Math.min(imageData.height, bounds.maxY + padding + 1) - Math.max(0, bounds.minY - padding),
      });
    }
  }

  rects.sort((left, right) => left.y - right.y || left.x - right.x);
  return {
    rects,
    warning: rects.length ? null : 'autoDetectNoRegions',
  };
}

export function detectEdgeBackgroundColor(imageData: ImageData): EdgeBackgroundColorResult | null {
  const samples = collectEdgeSamples(imageData);
  if (!samples.length) return null;

  const mean = averageColor(samples);
  const averageDistance =
    samples.reduce((total, sample) => total + colorDistance(sample, mean), 0) / samples.length;
  const maxSideDistance = getMaxSideDistance(imageData, mean);

  if (averageDistance > 32 || maxSideDistance > 58) {
    return null;
  }

  return {
    color: rgbToHex(mean),
    tolerance: Math.max(48, Math.min(112, Math.ceil(averageDistance * 2 + maxSideDistance + 18))),
  };
}

type ColorSample = [number, number, number];

function collectEdgeSamples(imageData: ImageData): ColorSample[] {
  const samples: ColorSample[] = [];
  const band = Math.max(1, Math.min(6, Math.floor(Math.min(imageData.width, imageData.height) * 0.02)));
  const stride = Math.max(1, Math.floor(Math.max(imageData.width, imageData.height) / 240));

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const nearEdge = x < band || y < band || x >= imageData.width - band || y >= imageData.height - band;
      if (!nearEdge || (x + y) % stride !== 0) continue;
      const sample = getOpaqueColorSample(imageData, x, y);
      if (sample) samples.push(sample);
    }
  }

  return samples;
}

function getMaxSideDistance(imageData: ImageData, mean: ColorSample): number {
  const sideMeans = [
    averageColor(collectSideSamples(imageData, 'top')),
    averageColor(collectSideSamples(imageData, 'right')),
    averageColor(collectSideSamples(imageData, 'bottom')),
    averageColor(collectSideSamples(imageData, 'left')),
  ].filter(Boolean);

  return sideMeans.reduce((maxDistance, sideMean) => Math.max(maxDistance, colorDistance(sideMean, mean)), 0);
}

function collectSideSamples(imageData: ImageData, side: 'top' | 'right' | 'bottom' | 'left'): ColorSample[] {
  const samples: ColorSample[] = [];
  const stride = Math.max(1, Math.floor(Math.max(imageData.width, imageData.height) / 160));
  const band = Math.max(1, Math.min(6, Math.floor(Math.min(imageData.width, imageData.height) * 0.02)));

  if (side === 'top' || side === 'bottom') {
    const startY = side === 'top' ? 0 : imageData.height - band;
    for (let y = startY; y < startY + band; y += 1) {
      for (let x = 0; x < imageData.width; x += stride) {
        const sample = getOpaqueColorSample(imageData, x, y);
        if (sample) samples.push(sample);
      }
    }
    return samples;
  }

  const startX = side === 'left' ? 0 : imageData.width - band;
  for (let x = startX; x < startX + band; x += 1) {
    for (let y = 0; y < imageData.height; y += stride) {
      const sample = getOpaqueColorSample(imageData, x, y);
      if (sample) samples.push(sample);
    }
  }

  return samples;
}

function getOpaqueColorSample(imageData: ImageData, x: number, y: number): ColorSample | null {
  const offset = (y * imageData.width + x) * 4;
  if (imageData.data[offset + 3] <= 8) return null;
  return [imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2]];
}

function averageColor(samples: ColorSample[]): ColorSample {
  if (!samples.length) return [0, 0, 0];
  const total = samples.reduce(
    (sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]] as ColorSample,
    [0, 0, 0],
  );
  return [
    Math.round(total[0] / samples.length),
    Math.round(total[1] / samples.length),
    Math.round(total[2] / samples.length),
  ];
}

function colorDistance(left: ColorSample, right: ColorSample): number {
  return Math.sqrt((left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2);
}

function rgbToHex([red, green, blue]: ColorSample): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function collectComponentBounds(
  imageData: ImageData,
  visited: Uint8Array,
  startX: number,
  startY: number,
): ComponentBounds {
  const stack: Array<[number, number]> = [[startX, startY]];
  const bounds: ComponentBounds = {
    minX: startX,
    minY: startY,
    maxX: startX,
    maxY: startY,
    area: 0,
  };

  while (stack.length) {
    const next = stack.pop();
    if (!next) break;
    const [x, y] = next;
    if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) continue;

    const index = y * imageData.width + x;
    if (visited[index]) continue;
    visited[index] = 1;
    if (!isOpaquePixel(imageData, x, y)) continue;

    bounds.area += 1;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  return bounds;
}

function isOpaquePixel(imageData: ImageData, x: number, y: number): boolean {
  return imageData.data[(y * imageData.width + x) * 4 + 3] > 8;
}

function getAlphaStats(imageData: ImageData): { opaquePixelCount: number; transparentPixelCount: number } {
  let opaquePixelCount = 0;
  let transparentPixelCount = 0;
  for (let offset = 3; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] > 8) {
      opaquePixelCount += 1;
    } else {
      transparentPixelCount += 1;
    }
  }
  return { opaquePixelCount, transparentPixelCount };
}
