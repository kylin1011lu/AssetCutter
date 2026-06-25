export interface AlphaAnalysis {
  hasAlpha: boolean;
  transparentPixelCount: number;
  totalPixelCount: number;
}

export function analyzeAlphaFromImageData(imageData: ImageData): AlphaAnalysis {
  let transparentPixelCount = 0;

  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] < 255) {
      transparentPixelCount += 1;
    }
  }

  return {
    hasAlpha: transparentPixelCount > 0,
    transparentPixelCount,
    totalPixelCount: imageData.width * imageData.height,
  };
}

export function analyzeImageElementAlpha(image: CanvasImageSource, width: number, height: number): AlphaAnalysis {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not create canvas context for alpha analysis.');
  }

  context.drawImage(image, 0, 0, width, height);
  return analyzeAlphaFromImageData(context.getImageData(0, 0, width, height));
}
