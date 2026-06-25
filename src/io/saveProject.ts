import { saveAs } from 'file-saver';
import { serializeProjectJson, type CutterProject } from '../model/project';

export function downloadProjectJson(project: CutterProject): void {
  const blob = new Blob([serializeProjectJson(project)], { type: 'application/json' });
  saveAs(blob, 'project.json');
}

export function readTextFile(file: File): Promise<string> {
  return file.text();
}
