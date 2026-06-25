export function hasFileDragData(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types).includes('Files');
}

export function hasImageDragData(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;

  const items = Array.from(dataTransfer.items);
  if (items.length > 0) {
    return items.some((item) => item.kind === 'file' && item.type.startsWith('image/'));
  }

  return Array.from(dataTransfer.files).some((file) => file.type.startsWith('image/'));
}

export function getImageFileFromDataTransfer(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) return null;
  return Array.from(dataTransfer.files).find((file) => file.type.startsWith('image/')) ?? null;
}
