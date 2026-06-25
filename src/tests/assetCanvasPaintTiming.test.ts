import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('AssetCanvas paint timing', () => {
  test('initial viewport measurement runs before browser paint', () => {
    const source = readFileSync(resolve('src/canvas/AssetCanvas.tsx'), 'utf8');

    expect(source).toContain('useLayoutEffect');
    expect(source).not.toContain('useEffect');
  });
});
