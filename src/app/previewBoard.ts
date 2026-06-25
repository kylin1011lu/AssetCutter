export interface PreviewBoardRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewBoardItem {
  regionId: string;
  x: number;
  y: number;
  scale: number;
}

export interface PreviewBoardWorkspace {
  height: number;
  originX: number;
  originY: number;
  width: number;
}

export function createPreviewBoardLayout({
  regions,
  previousItems,
}: {
  regions: PreviewBoardRegion[];
  previousItems: PreviewBoardItem[];
}): PreviewBoardItem[] {
  const previousByRegionId = new Map(previousItems.map((item) => [item.regionId, item]));

  return regions.map((region) => {
    const previous = previousByRegionId.get(region.id);
    if (previous) {
      return previous;
    }

    return {
      regionId: region.id,
      x: Math.round(region.x),
      y: Math.round(region.y),
      scale: 1,
    };
  });
}

export function movePreviewBoardItem(
  items: PreviewBoardItem[],
  regionId: string,
  position: { x: number; y: number },
): PreviewBoardItem[] {
  return items.map((item) =>
    item.regionId === regionId
      ? {
          ...item,
          x: Math.round(position.x),
          y: Math.round(position.y),
        }
      : item,
  );
}

export function getPreviewBoardWorkspace({
  sourceSize,
  viewportSize,
  zoom,
}: {
  sourceSize: { width: number; height: number } | null;
  viewportSize: { width: number; height: number };
  zoom: number;
}): PreviewBoardWorkspace {
  const sourceWidth = sourceSize?.width ?? viewportSize.width;
  const sourceHeight = sourceSize?.height ?? viewportSize.height;
  const originX = Math.max(0, Math.round(viewportSize.width));
  const originY = Math.max(0, Math.round(viewportSize.height));

  return {
    originX,
    originY,
    width: Math.max(viewportSize.width, Math.round(sourceWidth * zoom + originX * 2)),
    height: Math.max(viewportSize.height, Math.round(sourceHeight * zoom + originY * 2)),
  };
}
