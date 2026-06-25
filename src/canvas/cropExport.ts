import type { AssetRegion } from '../model/project';

export interface CropExportSettings {
  chromaKey: string;
  tolerance: number;
}

export interface CropExportResult {
  imageData: ImageData;
  warnings: string[];
}

export function exportCropFromImageData(
  source: ImageData,
  region: AssetRegion,
  settings: CropExportSettings,
): CropExportResult {
  void settings;
  const width = region.crop.width + region.padding.left + region.padding.right;
  const height = region.crop.height + region.padding.top + region.padding.bottom;
  const output = new ImageData(width, height);

  for (let cropY = 0; cropY < region.crop.height; cropY += 1) {
    for (let cropX = 0; cropX < region.crop.width; cropX += 1) {
      const sourceX = region.crop.x + cropX;
      const sourceY = region.crop.y + cropY;
      if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) {
        continue;
      }
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const outputX = region.padding.left + cropX;
      const outputY = region.padding.top + cropY;
      const outputOffset = (outputY * width + outputX) * 4;

      output.data.set(source.data.slice(sourceOffset, sourceOffset + 4), outputOffset);
    }
  }

  return { imageData: output, warnings: [] };
}

export async function exportCropToPngBlob(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  region: AssetRegion,
  settings: CropExportSettings,
): Promise<{ blob: Blob; warnings: string[]; width: number; height: number }> {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) {
    throw new Error('Could not create source canvas.');
  }
  sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const sourceData = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);
  return exportCropImageDataToPngBlob(sourceData, region, settings);
}

export async function exportCropImageDataToPngBlob(
  sourceData: ImageData,
  region: AssetRegion,
  settings: CropExportSettings,
): Promise<{ blob: Blob; warnings: string[]; width: number; height: number }> {
  const result = exportCropFromImageData(sourceData, region, settings);
  const imageData = resizeImageDataIfNeeded(result.imageData, region.exportSize);
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create export canvas.');
  }
  context.putImageData(imageData, 0, 0);
  const blob = await canvasToBlob(canvas);

  return {
    blob,
    warnings: result.warnings,
    width: imageData.width,
    height: imageData.height,
  };
}

function resizeImageDataIfNeeded(
  imageData: ImageData,
  exportSize: { width: number; height: number } | null,
): ImageData {
  if (!exportSize || (exportSize.width === imageData.width && exportSize.height === imageData.height)) {
    return imageData;
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    throw new Error('Could not create resize source canvas.');
  }
  sourceContext.putImageData(imageData, 0, 0);

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = exportSize.width;
  targetCanvas.height = exportSize.height;
  const targetContext = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetContext) {
    throw new Error('Could not create resize target canvas.');
  }
  targetContext.drawImage(sourceCanvas, 0, 0, exportSize.width, exportSize.height);
  return targetContext.getImageData(0, 0, exportSize.width, exportSize.height);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('PNG export failed.'));
      }
    }, 'image/png');
  });
}
