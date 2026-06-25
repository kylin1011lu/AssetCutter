import { describe, expect, test } from 'vitest';
import { analyzeAlphaFromImageData } from '../canvas/imageAnalysis';

function imageDataFromAlpha(alphaValues: number[]): ImageData {
  const data = new Uint8ClampedArray(alphaValues.length * 4);
  alphaValues.forEach((alpha, index) => {
    data[index * 4] = 20;
    data[index * 4 + 1] = 40;
    data[index * 4 + 2] = 60;
    data[index * 4 + 3] = alpha;
  });
  return new ImageData(data, alphaValues.length, 1);
}

describe('analyzeAlphaFromImageData', () => {
  test('reports false for fully opaque RGB-like image data', () => {
    const result = analyzeAlphaFromImageData(imageDataFromAlpha([255, 255, 255, 255]));

    expect(result.hasAlpha).toBe(false);
    expect(result.transparentPixelCount).toBe(0);
  });

  test('reports true when any pixel has real alpha', () => {
    const result = analyzeAlphaFromImageData(imageDataFromAlpha([255, 128, 255, 0]));

    expect(result.hasAlpha).toBe(true);
    expect(result.transparentPixelCount).toBe(2);
  });
});
