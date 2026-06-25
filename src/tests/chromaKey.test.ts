import { describe, expect, test } from 'vitest';
import { applyChromaKeyToImageData, getChromaKeyDamageWarning } from '../canvas/chromaKey';

function pixels(values: Array<[number, number, number, number]>): ImageData {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach(([r, g, b, a], index) => {
    data.set([r, g, b, a], index * 4);
  });
  return new ImageData(data, values.length, 1);
}

function grid(width: number, height: number, fill: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(fill, index * 4);
  }
  return new ImageData(data, width, height);
}

function setPixel(imageData: ImageData, x: number, y: number, color: [number, number, number, number]) {
  imageData.data.set(color, (y * imageData.width + x) * 4);
}

function alphaAt(imageData: ImageData, x: number, y: number): number {
  return imageData.data[(y * imageData.width + x) * 4 + 3];
}

describe('applyChromaKeyToImageData', () => {
  test('clears only pixels within tolerance', () => {
    const source = pixels([
      [0, 255, 0, 255],
      [4, 250, 4, 255],
      [60, 180, 60, 255],
    ]);

    const result = applyChromaKeyToImageData(source, '#00ff00', 12);

    expect(result.imageData.data[3]).toBe(0);
    expect(result.imageData.data[7]).toBe(0);
    expect(result.imageData.data[11]).toBe(255);
    expect(result.clearedPixelCount).toBe(2);
  });

  test('preserves key-like pixels enclosed inside the subject', () => {
    const source = grid(5, 5, [0, 255, 0, 255]);
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        setPixel(source, x, y, [220, 40, 40, 255]);
      }
    }
    setPixel(source, 2, 2, [0, 255, 0, 255]);

    const result = applyChromaKeyToImageData(source, '#00ff00', 12);

    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 2, 2)).toBe(255);
    expect(alphaAt(result.imageData, 1, 1)).toBe(255);
    expect(result.clearedPixelCount).toBe(16);
    expect(result.interiorClearedPixelCount).toBe(0);
  });

  test('softens connected near-key edge pixels instead of leaving a hard fringe', () => {
    const source = pixels([
      [0, 255, 0, 255],
      [20, 240, 20, 255],
      [220, 40, 40, 255],
    ]);

    const result = applyChromaKeyToImageData(source, '#00ff00', 12);

    expect(result.imageData.data[3]).toBe(0);
    expect(result.imageData.data[7]).toBeGreaterThan(0);
    expect(result.imageData.data[7]).toBeLessThan(255);
    expect(result.imageData.data[11]).toBe(255);
  });

  test('uses configured soft edge distance for alpha feathering', () => {
    const source = pixels([
      [0, 255, 0, 255],
      [0, 220, 0, 255],
    ]);

    const hardEdge = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'edgeConnected',
      softEdge: 10,
      edgeGrow: 0,
      spillRemoval: 0,
    });
    const softEdge = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'edgeConnected',
      softEdge: 80,
      edgeGrow: 0,
      spillRemoval: 0,
    });

    expect(hardEdge.imageData.data[7]).toBe(255);
    expect(softEdge.imageData.data[7]).toBeGreaterThan(0);
    expect(softEdge.imageData.data[7]).toBeLessThan(255);
  });

  test('expands the cleared edge mask into adjacent near-background pixels', () => {
    const source = grid(3, 3, [220, 40, 40, 255]);
    for (let y = 0; y < 3; y += 1) {
      setPixel(source, 0, y, [0, 255, 0, 255]);
    }
    setPixel(source, 1, 1, [18, 238, 18, 255]);

    const result = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'edgeConnected',
      softEdge: 24,
      edgeGrow: 1,
      spillRemoval: 0,
    });

    expect(alphaAt(result.imageData, 1, 1)).toBeLessThan(255);
  });

  test('removes key color spill from partially transparent edge pixels', () => {
    const source = pixels([[40, 220, 40, 128]]);

    const result = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'edgeConnected',
      softEdge: 80,
      edgeGrow: 0,
      spillRemoval: 80,
    });

    expect(result.imageData.data[1]).toBeLessThan(220);
  });

  test('smooths only opaque subject pixels on the keyed edge', () => {
    const source = grid(5, 5, [0, 255, 0, 255]);
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        setPixel(source, x, y, [220, 40, 40, 255]);
      }
    }

    const hardEdge = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'edgeConnected',
      softEdge: 0,
      edgeGrow: 0,
      edgeSmoothing: 0,
      spillRemoval: 0,
    });
    const smoothedEdge = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'edgeConnected',
      softEdge: 0,
      edgeGrow: 0,
      edgeSmoothing: 100,
      spillRemoval: 0,
    });

    expect(alphaAt(hardEdge.imageData, 1, 1)).toBe(255);
    expect(alphaAt(smoothedEdge.imageData, 1, 1)).toBeGreaterThan(0);
    expect(alphaAt(smoothedEdge.imageData, 1, 1)).toBeLessThan(255);
    expect(alphaAt(smoothedEdge.imageData, 2, 2)).toBe(255);
    expect(alphaAt(smoothedEdge.imageData, 0, 0)).toBe(0);
  });

  test('can clear matching key colors across the full image when requested', () => {
    const source = grid(5, 5, [0, 255, 0, 255]);
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        setPixel(source, x, y, [220, 40, 40, 255]);
      }
    }
    setPixel(source, 2, 2, [0, 255, 0, 255]);

    const result = applyChromaKeyToImageData(source, {
      keyColor: '#00ff00',
      tolerance: 12,
      maskMode: 'globalColor',
      softEdge: 24,
      edgeGrow: 0,
      spillRemoval: 0,
    });

    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 2, 2)).toBe(0);
    expect(result.interiorClearedPixelCount).toBe(1);
  });
});

describe('getChromaKeyDamageWarning', () => {
  test('warns when many interior pixels are removed', () => {
    const result = getChromaKeyDamageWarning({
      width: 10,
      height: 10,
      clearedPixelCount: 60,
      interiorClearedPixelCount: 20,
    });

    expect(result).toContain('Tolerance');
  });
});
