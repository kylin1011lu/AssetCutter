import type { AssetGroup, AssetRegion } from './project';

export interface ExportManifest {
  version: 2;
  assets: Array<{
    id: string;
    file: string;
    path: string;
    width: number;
    height: number;
    anchor: { x: number; y: number };
    tags: string[];
    groupId?: string;
  }>;
  groups: Array<{
    id: string;
    name: string;
    assets: string[];
    frame: { width: number; height: number } | null;
    anchor: { x: number; y: number } | null;
    tags: string[];
    exportPathPrefix: string;
  }>;
}

export function sanitizeAssetFileName(id: string): string {
  const base = id
    .trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${base || 'asset'}.png`;
}

export function getRegionExportDimensions(region: AssetRegion): { width: number; height: number } {
  const paddedWidth = region.crop.width + region.padding.left + region.padding.right;
  const paddedHeight = region.crop.height + region.padding.top + region.padding.bottom;
  return region.exportSize ?? { width: paddedWidth, height: paddedHeight };
}

export function buildManifest(regions: AssetRegion[], groups: AssetGroup[] = []): ExportManifest {
  const groupByRegionId = new Map<string, AssetGroup>();
  for (const group of groups) {
    for (const regionId of group.regionIds) {
      groupByRegionId.set(regionId, group);
    }
  }
  const exportableRegions = regions.filter((region) => region.enabled);
  const exportableRegionIds = new Set(exportableRegions.map((region) => region.id));

  return {
    version: 2,
    assets: exportableRegions
      .map((region) => {
        const dimensions = getRegionExportDimensions(region);
        const group = groupByRegionId.get(region.id);
        const file = sanitizeAssetFileName(region.id);
        const exportPathPrefix = group ? normalizeExportPathPrefix(group.exportPathPrefix) : '';
        const tags = group ? mergeTags(region.tags, group.tags) : region.tags;
        return {
          id: region.id,
          file,
          path: exportPathPrefix ? `${exportPathPrefix}/${file}` : file,
          width: dimensions.width,
          height: dimensions.height,
          anchor: region.anchor,
          tags,
          ...(group ? { groupId: group.id } : {}),
        };
      }),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      assets: group.regionIds.filter((regionId) => exportableRegionIds.has(regionId)),
      frame: group.frame,
      anchor: group.anchor,
      tags: group.tags,
      exportPathPrefix: normalizeExportPathPrefix(group.exportPathPrefix),
    })),
  };
}

function mergeTags(regionTags: string[], groupTags: string[]): string[] {
  return [...new Set([...regionTags, ...groupTags].map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeExportPathPrefix(prefix: string): string {
  return prefix.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}
