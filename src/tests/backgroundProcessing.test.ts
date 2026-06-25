import { describe, expect, test } from 'vitest';
import { processBackground } from '../canvas/backgroundProcessing';
import type { BackgroundEdit, BackgroundSettings } from '../model/project';

function imageFromPixels(width: number, pixels: Array<[number, number, number, number]>): ImageData {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((pixel, index) => data.set(pixel, index * 4));
  return new ImageData(data, width, pixels.length / width);
}

function baseSettings(patch: Partial<BackgroundSettings> = {}): BackgroundSettings {
  return {
    mode: 'source',
    chromaKey: '#00ff00',
    tolerance: 18,
    maskMode: 'edgeConnected',
    softEdge: 24,
    edgeGrow: 0,
    edgeSmoothing: 0,
    spillRemoval: 0,
    ...patch,
  };
}

function setPixel(imageData: ImageData, x: number, y: number, color: [number, number, number, number]) {
  imageData.data.set(color, (y * imageData.width + x) * 4);
}

function grid(width: number, height: number, fill: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(fill, index * 4);
  }
  return new ImageData(data, width, height);
}

function alphaAt(imageData: ImageData, x: number, y: number): number {
  return imageData.data[(y * imageData.width + x) * 4 + 3];
}

describe('processBackground', () => {
  test('returns a copied source image for source mode', () => {
    const source = imageFromPixels(1, [[0, 255, 0, 255]]);

    const result = processBackground(source, baseSettings({ mode: 'source' }), []);

    expect(result.imageData).not.toBe(source);
    expect(Array.from(result.imageData.data)).toEqual([0, 255, 0, 255]);
    expect(result.warnings).toEqual([]);
  });

  test('uses alpha mode as a copied runtime processed source', () => {
    const source = imageFromPixels(1, [[24, 36, 48, 96]]);

    const result = processBackground(source, baseSettings({ mode: 'alpha' }), []);

    expect(result.imageData).not.toBe(source);
    expect(result.imageData.data[3]).toBe(96);
  });

  test('applies chroma key to create transparent runtime processed source', () => {
    const source = imageFromPixels(3, [
      [0, 255, 0, 255],
      [2, 250, 2, 255],
      [220, 40, 40, 255],
    ]);

    const result = processBackground(source, baseSettings({ mode: 'chromaKey', tolerance: 12 }), []);

    expect(result.imageData.data[3]).toBe(0);
    expect(result.imageData.data[7]).toBe(0);
    expect(result.imageData.data[11]).toBe(255);
    expect(result.stats.clearedPixelCount).toBe(2);
  });

  test('replays a local chroma-key edit to clear a clicked enclosed background hole', () => {
    const source = grid(7, 7, [0, 255, 0, 255]);
    for (let y = 1; y <= 5; y += 1) {
      for (let x = 1; x <= 5; x += 1) {
        setPixel(source, x, y, [220, 40, 40, 255]);
      }
    }
    setPixel(source, 3, 3, [0, 255, 0, 255]);
    setPixel(source, 2, 2, [0, 255, 0, 255]);
    const edit: BackgroundEdit = {
      id: 'edit-1',
      type: 'local-chroma-key',
      point: { x: 3, y: 3 },
      keyColor: '#00ff00',
      tolerance: 12,
      softEdge: 0,
      spillRemoval: 0,
    };

    const result = processBackground(source, baseSettings({ mode: 'chromaKey', tolerance: 12, softEdge: 0 }), [edit]);

    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 3, 3)).toBe(0);
    expect(alphaAt(result.imageData, 2, 2)).toBe(255);
    expect(alphaAt(result.imageData, 2, 3)).toBe(255);
    expect(result.stats.interiorClearedPixelCount).toBe(1);
  });

  test('replays local chroma-key edits with the latest background settings', () => {
    const source = grid(5, 5, [220, 40, 40, 255]);
    for (let y = 0; y < 5; y += 1) {
      setPixel(source, 0, y, [0, 255, 0, 255]);
    }
    setPixel(source, 2, 2, [5, 250, 5, 255]);
    const edit: BackgroundEdit = {
      id: 'edit-1',
      type: 'local-chroma-key',
      point: { x: 2, y: 2 },
      keyColor: '#00ff00',
      tolerance: 0,
      softEdge: 0,
      spillRemoval: 0,
    };

    const result = processBackground(source, baseSettings({ mode: 'chromaKey', tolerance: 12, softEdge: 0 }), [edit]);

    expect(alphaAt(result.imageData, 2, 2)).toBe(0);
  });
});
