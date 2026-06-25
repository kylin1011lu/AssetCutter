export type PreviewZoom = number;

export const previewZoomMin = 0.25;
export const previewZoomMax = 8;
export const previewZoomButtonStep = 0.25;
export const previewZoomWheelStep = 0.05;

export function getNextPreviewZoom(current: PreviewZoom, step: number): PreviewZoom {
  if (step > 0) {
    return Math.min(previewZoomMax, roundPreviewZoom(current + step));
  }

  const nextZoom = roundPreviewZoom(current + step);
  return Math.max(previewZoomMin, nextZoom);
}

export function getAnchoredPreviewScroll({
  anchorX,
  anchorY,
  imageHeight,
  imageOffsetLeft,
  imageOffsetTop,
  imageWidth,
  viewportX,
  viewportY,
}: {
  anchorX: number;
  anchorY: number;
  imageHeight: number;
  imageOffsetLeft: number;
  imageOffsetTop: number;
  imageWidth: number;
  viewportX: number;
  viewportY: number;
}): { left: number; top: number } {
  return {
    left: imageOffsetLeft + imageWidth * anchorX - viewportX,
    top: imageOffsetTop + imageHeight * anchorY - viewportY,
  };
}

function roundPreviewZoom(value: number): number {
  return Math.round(value * 100) / 100;
}
