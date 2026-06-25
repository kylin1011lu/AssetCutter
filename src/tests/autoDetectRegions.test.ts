import { describe, expect, test } from 'vitest';
import { detectAssetRegionsFromImageData, detectEdgeBackgroundColor } from '../canvas/autoDetectRegions';

function createSolidImageData(width: number, height: number, rgba: [number, number, number, number]) {
  const imageData = new ImageData(width, height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    imageData.data[index] = rgba[0];
    imageData.data[index + 1] = rgba[1];
    imageData.data[index + 2] = rgba[2];
    imageData.data[index + 3] = rgba[3];
  }
  return imageData;
}

function paintRect(
  imageData: ImageData,
  rect: { x: number; y: number; width: number; height: number },
  rgba: [number, number, number, number],
) {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const offset = (y * imageData.width + x) * 4;
      imageData.data[offset] = rgba[0];
      imageData.data[offset + 1] = rgba[1];
      imageData.data[offset + 2] = rgba[2];
      imageData.data[offset + 3] = rgba[3];
    }
  }
}

describe('detectAssetRegionsFromImageData', () => {
  test('detects a near-solid edge background color', () => {
    const imageData = createSolidImageData(40, 30, [4, 238, 9, 255]);
    paintRect(imageData, { x: 12, y: 9, width: 10, height: 8 }, [255, 245, 190, 255]);

    const result = detectEdgeBackgroundColor(imageData);

    expect(result).toMatchObject({
      color: '#04ee09',
    });
  });

  test('detects separate opaque components from a transparent result image', () => {
    const imageData = createSolidImageData(100, 80, [0, 0, 0, 0]);
    paintRect(imageData, { x: 10, y: 8, width: 30, height: 12 }, [250, 240, 180, 255]);
    paintRect(imageData, { x: 60, y: 40, width: 16, height: 18 }, [250, 240, 180, 255]);

    const result = detectAssetRegionsFromImageData(imageData);

    expect(result.warning).toBeNull();
    expect(result.rects).toEqual([
      { x: 6, y: 4, width: 38, height: 20 },
      { x: 56, y: 36, width: 24, height: 26 },
    ]);
  });

  test('filters tiny noise pixels', () => {
    const imageData = createSolidImageData(80, 80, [0, 0, 0, 0]);
    paintRect(imageData, { x: 20, y: 20, width: 18, height: 18 }, [255, 230, 160, 255]);
    paintRect(imageData, { x: 70, y: 70, width: 1, height: 1 }, [255, 230, 160, 255]);

    const result = detectAssetRegionsFromImageData(imageData);

    expect(result.rects).toHaveLength(1);
    expect(result.rects[0]).toMatchObject({ x: 16, y: 16, width: 26, height: 26 });
  });

  test('ignores color drift and uses only alpha during detection', () => {
    const imageData = createSolidImageData(90, 60, [0, 230, 14, 0]);
    paintRect(imageData, { x: 12, y: 10, width: 20, height: 10 }, [255, 245, 190, 255]);
    paintRect(imageData, { x: 58, y: 32, width: 12, height: 12 }, [255, 245, 190, 255]);

    const result = detectAssetRegionsFromImageData(imageData);

    expect(result.rects).toHaveLength(2);
    expect(result.rects[0]).toMatchObject({ x: 8, y: 6, width: 28, height: 18 });
    expect(result.rects[1]).toMatchObject({ x: 54, y: 28, width: 20, height: 20 });
  });

  test('uses alpha as the foreground mask for transparent sources', () => {
    const imageData = createSolidImageData(50, 40, [0, 0, 0, 0]);
    paintRect(imageData, { x: 12, y: 9, width: 10, height: 8 }, [255, 255, 255, 255]);

    const result = detectAssetRegionsFromImageData(imageData);

    expect(result.warning).toBeNull();
    expect(result.rects).toEqual([{ x: 8, y: 5, width: 18, height: 16 }]);
  });

  test('detects the whole image when the result image is fully opaque', () => {
    const imageData = createSolidImageData(30, 30, [255, 255, 255, 255]);

    const result = detectAssetRegionsFromImageData(imageData);

    expect(result.warning).toBeNull();
    expect(result.rects).toEqual([{ x: 0, y: 0, width: 30, height: 30 }]);
  });

  test('reports no regions when the result image is fully transparent', () => {
    const imageData = createSolidImageData(30, 30, [0, 0, 0, 0]);

    const result = detectAssetRegionsFromImageData(imageData);

    expect(result.warning).toBe('autoDetectNoRegions');
    expect(result.rects).toEqual([]);
  });
});
