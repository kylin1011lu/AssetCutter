export interface ChromaKeyResult {
  imageData: ImageData;
  clearedPixelCount: number;
  interiorClearedPixelCount: number;
}

export interface ChromaKeyOptions {
  keyColor: string;
  tolerance: number;
  maskMode: 'edgeConnected' | 'globalColor';
  softEdge: number;
  edgeGrow: number;
  edgeSmoothing?: number;
  spillRemoval: number;
}

export interface LocalChromaKeyOptions {
  point: { x: number; y: number };
  keyColor: string;
  tolerance: number;
  softEdge: number;
  spillRemoval: number;
}

export function applyChromaKeyToImageData(
  source: ImageData,
  keyColorOrOptions: string | ChromaKeyOptions,
  tolerance = 18,
): ChromaKeyResult {
  const options =
    typeof keyColorOrOptions === 'string'
      ? {
          keyColor: keyColorOrOptions,
          tolerance,
          maskMode: 'edgeConnected' as const,
          softEdge: Math.max(24, tolerance * 1.5),
          edgeGrow: 0,
          edgeSmoothing: 0,
          spillRemoval: 0,
        }
      : keyColorOrOptions;
  const [keyR, keyG, keyB] = parseHexColor(options.keyColor);
  const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  const hardTolerance = Math.max(0, options.tolerance);
  const softTolerance = hardTolerance + Math.max(0, options.softEdge);
  const initialMask =
    options.maskMode === 'globalColor'
      ? collectGlobalBackground(source, [keyR, keyG, keyB], softTolerance)
      : collectEdgeConnectedBackground(source, [keyR, keyG, keyB], softTolerance);
  const backgroundMask =
    options.edgeGrow > 0
      ? growBackgroundMask(source, initialMask, [keyR, keyG, keyB], softTolerance, options.edgeGrow)
      : initialMask;
  let clearedPixelCount = 0;
  let interiorClearedPixelCount = 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = y * source.width + x;
      if (!backgroundMask[index]) continue;

      const offset = (y * source.width + x) * 4;
      const distance = Math.sqrt(
        (output.data[offset] - keyR) ** 2 +
          (output.data[offset + 1] - keyG) ** 2 +
          (output.data[offset + 2] - keyB) ** 2,
      );
      const sourceAlpha = output.data[offset + 3];
      const nextAlpha = getKeyedAlpha(sourceAlpha, distance, hardTolerance, softTolerance);

      if (nextAlpha < sourceAlpha) {
        output.data[offset + 3] = nextAlpha;
        if (options.spillRemoval > 0) {
          removeKeySpill(output.data, offset, [keyR, keyG, keyB], options.spillRemoval, nextAlpha);
        }
        clearedPixelCount += 1;
        if (x > 0 && y > 0 && x < source.width - 1 && y < source.height - 1) {
          interiorClearedPixelCount += 1;
        }
      }
    }
  }

  if ((options.edgeSmoothing ?? 0) > 0) {
    smoothOpaqueEdgeAlpha(output, options.edgeSmoothing ?? 0);
  }

  return {
    imageData: output,
    clearedPixelCount,
    interiorClearedPixelCount,
  };
}

export function applyLocalChromaKeyToImageData(
  source: ImageData,
  output: ImageData,
  options: LocalChromaKeyOptions,
): ChromaKeyResult {
  const [keyR, keyG, keyB] = parseHexColor(options.keyColor);
  const hardTolerance = Math.max(0, options.tolerance);
  const softTolerance = hardTolerance + Math.max(0, options.softEdge);
  const backgroundMask = collectLocalConnectedBackground(source, [keyR, keyG, keyB], softTolerance, options.point);
  let clearedPixelCount = 0;
  let interiorClearedPixelCount = 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = y * source.width + x;
      if (!backgroundMask[index]) continue;

      const offset = index * 4;
      const distance = colorDistanceAt(source, offset, [keyR, keyG, keyB]);
      const sourceAlpha = output.data[offset + 3];
      const nextAlpha = getKeyedAlpha(sourceAlpha, distance, hardTolerance, softTolerance);

      if (nextAlpha < sourceAlpha) {
        output.data[offset + 3] = nextAlpha;
        if (options.spillRemoval > 0) {
          removeKeySpill(output.data, offset, [keyR, keyG, keyB], options.spillRemoval, nextAlpha);
        }
        clearedPixelCount += 1;
        if (x > 0 && y > 0 && x < source.width - 1 && y < source.height - 1) {
          interiorClearedPixelCount += 1;
        }
      }
    }
  }

  return {
    imageData: output,
    clearedPixelCount,
    interiorClearedPixelCount,
  };
}

function smoothOpaqueEdgeAlpha(imageData: ImageData, edgeSmoothing: number) {
  const strength = Math.min(1, Math.max(0, edgeSmoothing / 100));
  if (strength <= 0) return;

  const sourceAlpha = new Uint8ClampedArray(imageData.width * imageData.height);
  for (let index = 0; index < sourceAlpha.length; index += 1) {
    sourceAlpha[index] = imageData.data[index * 4 + 3];
  }

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const index = y * imageData.width + x;
      const currentAlpha = sourceAlpha[index];
      if (currentAlpha === 0 || !hasLowerAlphaNeighbor(sourceAlpha, imageData.width, imageData.height, x, y, currentAlpha)) {
        continue;
      }

      const averageAlpha = getNeighborhoodAlphaAverage(sourceAlpha, imageData.width, imageData.height, x, y);
      const smoothedAlpha = Math.round(currentAlpha * (1 - strength) + averageAlpha * strength);
      imageData.data[index * 4 + 3] = Math.min(currentAlpha, Math.max(1, smoothedAlpha));
    }
  }
}

function hasLowerAlphaNeighbor(alpha: Uint8ClampedArray, width: number, height: number, x: number, y: number, currentAlpha: number): boolean {
  for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
    for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
      if (nx === x && ny === y) continue;
      if (alpha[ny * width + nx] < currentAlpha) return true;
    }
  }
  return false;
}

function getNeighborhoodAlphaAverage(alpha: Uint8ClampedArray, width: number, height: number, x: number, y: number): number {
  let total = 0;
  let count = 0;
  for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
    for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
      total += alpha[ny * width + nx];
      count += 1;
    }
  }
  return count ? total / count : alpha[y * width + x];
}

function collectEdgeConnectedBackground(
  source: ImageData,
  keyColor: [number, number, number],
  tolerance: number,
): Uint8Array {
  const visited = new Uint8Array(source.width * source.height);
  const stack: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return;
    const index = y * source.width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (source.data[offset + 3] === 0) return;
    if (colorDistanceAt(source, offset, keyColor) > tolerance) return;
    visited[index] = 1;
    stack.push(index);
  }

  for (let x = 0; x < source.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, source.height - 1);
  }
  for (let y = 1; y < source.height - 1; y += 1) {
    enqueue(0, y);
    enqueue(source.width - 1, y);
  }

  while (stack.length) {
    const index = stack.pop();
    if (index === undefined) break;
    const x = index % source.width;
    const y = Math.floor(index / source.width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return visited;
}

function collectGlobalBackground(
  source: ImageData,
  keyColor: [number, number, number],
  tolerance: number,
): Uint8Array {
  const selected = new Uint8Array(source.width * source.height);
  for (let index = 0; index < source.width * source.height; index += 1) {
    const offset = index * 4;
    if (source.data[offset + 3] === 0) continue;
    if (colorDistanceAt(source, offset, keyColor) <= tolerance) {
      selected[index] = 1;
    }
  }
  return selected;
}

function collectLocalConnectedBackground(
  source: ImageData,
  keyColor: [number, number, number],
  tolerance: number,
  point: { x: number; y: number },
): Uint8Array {
  const visited = new Uint8Array(source.width * source.height);
  const stack: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return;
    const index = y * source.width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (source.data[offset + 3] === 0) return;
    if (colorDistanceAt(source, offset, keyColor) > tolerance) return;
    visited[index] = 1;
    stack.push(index);
  }

  enqueue(Math.round(point.x), Math.round(point.y));

  while (stack.length) {
    const index = stack.pop();
    if (index === undefined) break;
    const x = index % source.width;
    const y = Math.floor(index / source.width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return visited;
}

function growBackgroundMask(
  source: ImageData,
  backgroundMask: Uint8Array,
  keyColor: [number, number, number],
  tolerance: number,
  radius: number,
): Uint8Array {
  const output = new Uint8Array(backgroundMask);
  const steps = Math.max(0, Math.round(radius));
  for (let step = 0; step < steps; step += 1) {
    const previous = new Uint8Array(output);
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const index = y * source.width + x;
        if (previous[index]) continue;
        if (!hasMaskedNeighbor(previous, source.width, source.height, x, y)) continue;
        if (colorDistanceAt(source, index * 4, keyColor) > tolerance) continue;
        output[index] = 1;
      }
    }
  }
  return output;
}

function hasMaskedNeighbor(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  return (
    (x > 0 && Boolean(mask[y * width + x - 1])) ||
    (x < width - 1 && Boolean(mask[y * width + x + 1])) ||
    (y > 0 && Boolean(mask[(y - 1) * width + x])) ||
    (y < height - 1 && Boolean(mask[(y + 1) * width + x]))
  );
}

function colorDistanceAt(source: ImageData, offset: number, [keyR, keyG, keyB]: [number, number, number]): number {
  return Math.sqrt(
    (source.data[offset] - keyR) ** 2 +
      (source.data[offset + 1] - keyG) ** 2 +
      (source.data[offset + 2] - keyB) ** 2,
  );
}

function removeKeySpill(
  data: Uint8ClampedArray,
  offset: number,
  keyColor: [number, number, number],
  spillRemoval: number,
  alpha: number,
) {
  const keyChannel = getDominantKeyChannel(keyColor);
  const spillStrength = Math.min(1, Math.max(0, spillRemoval / 100)) * (1 - alpha / 255);
  if (spillStrength <= 0) return;

  const channels = [data[offset], data[offset + 1], data[offset + 2]];
  const otherChannels = channels.filter((_, index) => index !== keyChannel);
  const neutral = Math.max(...otherChannels);
  const excess = Math.max(0, channels[keyChannel] - neutral);
  channels[keyChannel] = Math.round(channels[keyChannel] - excess * spillStrength);
  data[offset] = channels[0];
  data[offset + 1] = channels[1];
  data[offset + 2] = channels[2];
}

function getDominantKeyChannel(keyColor: [number, number, number]): number {
  if (keyColor[1] >= keyColor[0] && keyColor[1] >= keyColor[2]) return 1;
  if (keyColor[0] >= keyColor[2]) return 0;
  return 2;
}

function getKeyedAlpha(sourceAlpha: number, distance: number, hardTolerance: number, softTolerance: number): number {
  if (distance <= hardTolerance) {
    return 0;
  }
  if (distance >= softTolerance) {
    return sourceAlpha;
  }
  const ratio = (distance - hardTolerance) / Math.max(1, softTolerance - hardTolerance);
  return Math.round(sourceAlpha * ratio);
}

export function getChromaKeyDamageWarning(input: {
  width: number;
  height: number;
  clearedPixelCount: number;
  interiorClearedPixelCount: number;
}): string | null {
  const total = input.width * input.height;
  const clearedRatio = total === 0 ? 0 : input.clearedPixelCount / total;
  const interiorRatio = total === 0 ? 0 : input.interiorClearedPixelCount / total;

  if (clearedRatio > 0.45 || interiorRatio > 0.12) {
    return 'Tolerance may be damaging the subject; inspect edges before export.';
  }

  return null;
}

export function parseHexColor(color: string): [number, number, number] {
  const normalized = color.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid chroma key color: ${color}`);
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
