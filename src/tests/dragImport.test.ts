import { describe, expect, test } from 'vitest';

import { getImageFileFromDataTransfer, hasFileDragData, hasImageDragData } from '../app/dragImport';

const file = (name: string, type: string) => new File(['fixture'], name, { type });

function dataTransfer({
  files = [],
  items = [],
  types = [],
}: {
  files?: File[];
  items?: Array<{ kind: string; type: string }>;
  types?: string[];
}) {
  return {
    files,
    items,
    types,
  } as unknown as DataTransfer;
}

describe('drag import helpers', () => {
  test('detects file drag data before files are readable', () => {
    expect(hasFileDragData(dataTransfer({ types: ['Files'] }))).toBe(true);
    expect(hasImageDragData(dataTransfer({ items: [{ kind: 'file', type: 'image/png' }] }))).toBe(true);
  });

  test('selects the first image file from dropped files', () => {
    const textFile = file('notes.txt', 'text/plain');
    const imageFile = file('source.png', 'image/png');

    expect(getImageFileFromDataTransfer(dataTransfer({ files: [textFile, imageFile] }))).toBe(imageFile);
  });

  test('ignores drops without image files', () => {
    expect(getImageFileFromDataTransfer(dataTransfer({ files: [file('notes.txt', 'text/plain')] }))).toBeNull();
    expect(hasImageDragData(dataTransfer({ items: [{ kind: 'file', type: 'text/plain' }] }))).toBe(false);
  });
});
