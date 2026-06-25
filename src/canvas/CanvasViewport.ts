export interface CanvasSize {
  width: number;
  height: number;
}

export interface SourceSize {
  width: number;
  height: number;
}

export interface CanvasViewport {
  scale: number;
  position: { x: number; y: number };
}

export function calculateInitialViewport(input: {
  source: SourceSize;
  viewport: CanvasSize;
  margin?: number;
}): CanvasViewport {
  const margin = input.margin ?? 24;
  const scale = 1;
  const fitsWidth = input.source.width + margin * 2 <= input.viewport.width;
  const fitsHeight = input.source.height + margin * 2 <= input.viewport.height;

  return {
    scale,
    position: {
      x: fitsWidth ? (input.viewport.width - input.source.width) / 2 : margin,
      y: fitsHeight ? (input.viewport.height - input.source.height) / 2 : margin,
    },
  };
}

export function shouldCommitStageDrag(stage: unknown, dragTarget: unknown): boolean {
  return stage === dragTarget;
}
