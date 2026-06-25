import { describe, expect, it } from 'vitest';
import type { OutputAsset, OutputChunk } from 'rollup';

import { inlineViteAssets } from '../build/singleFileHtml';

const chunk = (fileName: string, code: string): OutputChunk =>
  ({
    type: 'chunk',
    fileName,
    code,
  }) as OutputChunk;

const asset = (fileName: string, source: string): OutputAsset =>
  ({
    type: 'asset',
    fileName,
    name: fileName,
    originalFileName: fileName,
    source,
    needsCodeReference: false,
    names: [],
    originalFileNames: [],
  }) as OutputAsset;

describe('inlineViteAssets', () => {
  it('inlines built scripts and styles into a single HTML document', () => {
    const html = [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <link rel="stylesheet" crossorigin href="/assets/index.css">',
      '  </head>',
      '  <body>',
      '    <script type="module" crossorigin src="/assets/index.js"></script>',
      '  </body>',
      '</html>',
    ].join('\n');

    const bundledHtml = inlineViteAssets(html, {
      'assets/index.js': chunk('assets/index.js', 'console.log("</script>");'),
      'assets/index.css': asset('assets/index.css', 'body { color: red; }'),
    });

    expect(bundledHtml).toContain('<style>body { color: red; }</style>');
    expect(bundledHtml).toContain('<script type="module">console.log("<\\/script>");</script>');
    expect(bundledHtml).not.toContain('src="/assets/index.js"');
    expect(bundledHtml).not.toContain('href="/assets/index.css"');
  });
});
