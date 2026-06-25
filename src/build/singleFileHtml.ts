import type { Plugin } from 'vite';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';

type BundleItem = OutputAsset | OutputChunk;

const normalizeRef = (ref: string) =>
  ref.replace(/^\/+/, '').replace(/^\.\//, '');

const escapeInlineScript = (code: string) =>
  code.replace(/<\/script/gi, '<\\/script');

const assetSourceToString = (asset: OutputAsset) =>
  typeof asset.source === 'string'
    ? asset.source
    : new TextDecoder().decode(asset.source);

const getBundleItem = (bundle: Record<string, BundleItem>, ref: string) => {
  const normalizedRef = normalizeRef(ref);
  return (
    bundle[normalizedRef] ??
    Object.values(bundle).find((item) => item.fileName === normalizedRef)
  );
};

export function inlineViteAssets(html: string, bundle: Record<string, BundleItem>) {
  let nextHtml = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (tag, beforeSrc: string, src: string, afterSrc: string) => {
      const item = getBundleItem(bundle, src);
      if (!item || item.type !== 'chunk') {
        return tag;
      }

      const attrs = `${beforeSrc}${afterSrc}`
        .replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const attributeText = attrs ? ` ${attrs}` : '';

      return `<script${attributeText}>${escapeInlineScript(item.code)}</script>`;
    },
  );

  nextHtml = nextHtml.replace(
    /<link\b([^>]*)\brel=["']stylesheet["']([^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi,
    (tag, beforeRel: string, afterRel: string, href: string, afterHref: string) => {
      const item = getBundleItem(bundle, href);
      if (!item || item.type !== 'asset') {
        return tag;
      }

      return `<style>${assetSourceToString(item)}</style>`;
    },
  );

  return nextHtml;
}

export function singleFileHtmlPlugin(): Plugin {
  return {
    name: 'asset-cutter-single-file-html',
    enforce: 'post',
    generateBundle(_, bundle) {
      const htmlAsset = Object.values(bundle).find(
        (item): item is OutputAsset =>
          item.type === 'asset' && item.fileName.endsWith('.html'),
      );

      if (!htmlAsset) {
        return;
      }

      const html = assetSourceToString(htmlAsset);
      htmlAsset.source = inlineViteAssets(html, bundle);

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.fileName === htmlAsset.fileName) {
          continue;
        }

        delete bundle[fileName];
      }
    },
  };
}
