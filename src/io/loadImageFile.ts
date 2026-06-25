import { analyzeImageElementAlpha } from '../canvas/imageAnalysis';
import type { SourceImageMeta } from '../model/project';

export interface LoadedImageFile {
  file: File;
  image: HTMLImageElement;
  objectUrl: string;
  source: SourceImageMeta;
}

export async function loadImageFile(file: File): Promise<LoadedImageFile> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a PNG or JPEG image.');
  }

  const objectUrl = URL.createObjectURL(file);
  const image = await loadHtmlImage(objectUrl);
  const alpha = analyzeImageElementAlpha(image, image.naturalWidth, image.naturalHeight);

  return {
    file,
    image,
    objectUrl,
    source: {
      fileName: file.name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      hasAlpha: alpha.hasAlpha,
    },
  };
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode image file.'));
    image.src = url;
  });
}
