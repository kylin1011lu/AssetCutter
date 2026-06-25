import { describe, expect, test } from 'vitest';
import { exportCropFromImageData } from '../canvas/cropExport';
import type { AssetRegion } from '../model/project';

function makeSourceImage(): ImageData {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data.set([x * 40, y * 40, 200, 255], offset);
    }
  }
  return new ImageData(data, width, height);
}

function baseRegion(): AssetRegion {
  return {
    id: 'ui.button',
    label: 'Button',
    enabled: true,
    crop: { x: 1, y: 1, width: 2, height: 2 },
    padding: { top: 1, right: 2, bottom: 0, left: 1 },
    exportSize: null,
    backgroundMode: 'source',
    anchor: { x: 0.5, y: 0.5 },
    tags: ['button'],
  };
}

describe('exportCropFromImageData', () => {
  test('exports crop dimensions including padding', () => {
    const result = exportCropFromImageData(makeSourceImage(), baseRegion(), {
      chromaKey: '#00ff00',
      tolerance: 12,
    });

    expect(result.imageData.width).toBe(5);
    expect(result.imageData.height).toBe(3);
  });

  test('preserves source pixels in source mode', () => {
    const result = exportCropFromImageData(makeSourceImage(), baseRegion(), {
      chromaKey: '#00ff00',
      tolerance: 12,
    });
    const sourcePixelOffsetInExport = ((1 * result.imageData.width) + 1) * 4;

    expect(Array.from(result.imageData.data.slice(sourcePixelOffsetInExport, sourcePixelOffsetInExport + 4))).toEqual([
      40,
      40,
      200,
      255,
    ]);
  });

  test('keeps pixels outside the source image transparent', () => {
    const result = exportCropFromImageData(
      makeSourceImage(),
      {
        ...baseRegion(),
        crop: { x: -1, y: -1, width: 3, height: 3 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      {
        chromaKey: '#00ff00',
        tolerance: 12,
      },
    );

    expect(result.imageData.width).toBe(3);
    expect(result.imageData.height).toBe(3);
    expect(Array.from(result.imageData.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(result.imageData.data.slice((1 * result.imageData.width + 1) * 4, (1 * result.imageData.width + 1) * 4 + 4))).toEqual([
      0,
      0,
      200,
      255,
    ]);
    expect(Array.from(result.imageData.data.slice((2 * result.imageData.width + 2) * 4, (2 * result.imageData.width + 2) * 4 + 4))).toEqual([
      40,
      40,
      200,
      255,
    ]);
  });

  test('does not apply background removal while exporting a crop from the result image', () => {
    const image = new ImageData(5, 5);
    for (let index = 0; index < image.width * image.height; index += 1) {
      image.data.set([0, 255, 0, 255], index * 4);
    }
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        image.data.set([220, 40, 40, 255], (y * image.width + x) * 4);
      }
    }
    image.data.set([0, 255, 0, 255], (2 * image.width + 2) * 4);

    const result = exportCropFromImageData(
      image,
      {
        ...baseRegion(),
        crop: { x: 0, y: 0, width: 5, height: 5 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundMode: 'chromaKey',
      },
      {
        chromaKey: '#00ff00',
        tolerance: 12,
      },
    );

    expect(result.imageData.data[3]).toBe(255);
    expect(result.imageData.data[(2 * result.imageData.width + 2) * 4 + 3]).toBe(255);
    expect(result.warnings).toEqual([]);
  });
});
