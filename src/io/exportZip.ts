import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { processBackground } from '../canvas/backgroundProcessing';
import { exportCropImageDataToPngBlob } from '../canvas/cropExport';
import { buildManifest } from '../model/manifest';
import { serializeProjectJson, type CutterProject } from '../model/project';

export async function downloadProjectZip(
  image: HTMLImageElement,
  project: CutterProject,
): Promise<string[]> {
  const zip = new JSZip();
  const warnings: string[] = [];
  const sourceData = getImageData(image, project.sourceRef.width, project.sourceRef.height);
  const processed = processBackground(sourceData, project.background.settings, project.background.edits);
  warnings.push(...processed.warnings);

  const manifest = buildManifest(project.regions, project.groups);
  const regionById = new Map(project.regions.map((region) => [region.id, region]));

  for (const asset of manifest.assets) {
    const region = regionById.get(asset.id);
    if (!region) continue;
    const result = await exportCropImageDataToPngBlob(
      processed.imageData,
      region,
      project.background.settings,
    );
    zip.file(asset.path, result.blob);
    warnings.push(...result.warnings.map((warning) => `${region.id}: ${warning}`));
  }

  zip.file('project.json', serializeProjectJson(project));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'asset-cutter-export.zip');

  return warnings;
}

function getImageData(image: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not create source canvas.');
  }
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}
