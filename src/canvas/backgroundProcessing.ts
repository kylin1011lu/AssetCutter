import { applyChromaKeyToImageData, applyLocalChromaKeyToImageData, getChromaKeyDamageWarning } from './chromaKey';
import type { BackgroundEdit, BackgroundSettings } from '../model/project';

export interface BackgroundProcessingResult {
  imageData: ImageData;
  warnings: string[];
  stats: {
    clearedPixelCount: number;
    interiorClearedPixelCount: number;
  };
}

export function processBackground(
  source: ImageData,
  settings: BackgroundSettings,
  edits: BackgroundEdit[],
): BackgroundProcessingResult {
  if (settings.mode !== 'chromaKey') {
    return {
      imageData: copyImageData(source),
      warnings: [],
      stats: {
        clearedPixelCount: 0,
        interiorClearedPixelCount: 0,
      },
    };
  }

  const keyed = applyChromaKeyToImageData(source, {
    keyColor: settings.chromaKey,
    tolerance: settings.tolerance,
    maskMode: settings.maskMode,
    softEdge: settings.softEdge,
    edgeGrow: settings.edgeGrow,
    edgeSmoothing: settings.edgeSmoothing,
    spillRemoval: settings.spillRemoval,
  });
  let clearedPixelCount = keyed.clearedPixelCount;
  let interiorClearedPixelCount = keyed.interiorClearedPixelCount;

  for (const edit of edits) {
    if (edit.type !== 'local-chroma-key' || !edit.point) continue;
    const localResult = applyLocalChromaKeyToImageData(source, keyed.imageData, {
      point: edit.point,
      keyColor: settings.chromaKey,
      tolerance: settings.tolerance,
      softEdge: settings.softEdge,
      spillRemoval: settings.spillRemoval,
    });
    clearedPixelCount += localResult.clearedPixelCount;
    interiorClearedPixelCount += localResult.interiorClearedPixelCount;
  }

  const warning = getChromaKeyDamageWarning({
    width: keyed.imageData.width,
    height: keyed.imageData.height,
    clearedPixelCount,
    interiorClearedPixelCount,
  });

  return {
    imageData: keyed.imageData,
    warnings: warning ? [warning] : [],
    stats: {
      clearedPixelCount,
      interiorClearedPixelCount,
    },
  };
}

function copyImageData(source: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
}
