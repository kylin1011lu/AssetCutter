export type BackgroundMode = 'source' | 'alpha' | 'chromaKey';
export type BackgroundMaskMode = 'edgeConnected' | 'globalColor';

export interface SourceImageMeta {
  fileName: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}

export interface SourceImageRef extends SourceImageMeta {
  fingerprint: string;
}

export interface BackgroundSettings {
  mode: BackgroundMode;
  chromaKey: string;
  tolerance: number;
  maskMode: BackgroundMaskMode;
  softEdge: number;
  edgeGrow: number;
  edgeSmoothing: number;
  spillRemoval: number;
}

export interface BackgroundEdit {
  id: string;
  type: 'local-chroma-key' | 'erase' | 'restore';
  point?: Anchor;
  keyColor?: string;
  tolerance?: number;
  softEdge?: number;
  spillRemoval?: number;
}

export interface AssetGroup {
  id: string;
  name: string;
  regionIds: string[];
  frame: { width: number; height: number } | null;
  anchor: Anchor | null;
  tags: string[];
  exportPathPrefix: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Anchor {
  x: number;
  y: number;
}

export interface AssetRegion {
  id: string;
  label: string;
  enabled: boolean;
  crop: Rect;
  padding: Padding;
  exportSize: { width: number; height: number } | null;
  backgroundMode: BackgroundMode;
  chromaKey?: string;
  tolerance?: number;
  anchor: Anchor;
  tags: string[];
}

export interface CutterProject {
  version: 2;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceRef: SourceImageRef;
  background: {
    settings: BackgroundSettings;
    edits: BackgroundEdit[];
  };
  regions: AssetRegion[];
  groups: AssetGroup[];
}

export function createDefaultProject(source: SourceImageMeta): CutterProject {
  const now = new Date().toISOString();
  return {
    version: 2,
    projectId: createProjectId(),
    name: stripImageExtension(source.fileName) || 'Untitled project',
    createdAt: now,
    updatedAt: now,
    sourceRef: createSourceRef(source),
    background: {
      settings: createBackgroundSettings(source),
      edits: [],
    },
    regions: [],
    groups: [],
  };
}

export function createSourceRef(source: SourceImageMeta): SourceImageRef {
  return {
    ...source,
    fingerprint: createSourceFingerprint(source),
  };
}

export function sourceRefToMeta(sourceRef: SourceImageRef): SourceImageMeta {
  return {
    fileName: sourceRef.fileName,
    width: sourceRef.width,
    height: sourceRef.height,
    hasAlpha: sourceRef.hasAlpha,
  };
}

export function createBackgroundSettings(source: SourceImageMeta): BackgroundSettings {
  return {
    mode: source.hasAlpha ? 'alpha' : 'source',
    chromaKey: '#00ff00',
    tolerance: 18,
    maskMode: 'edgeConnected',
    softEdge: 24,
    edgeGrow: 0,
    edgeSmoothing: 0,
    spillRemoval: 0,
  };
}

export function isSameSourceImage(left: SourceImageMeta | SourceImageRef, right: SourceImageMeta): boolean {
  if ('fingerprint' in left) {
    return left.fingerprint === createSourceFingerprint(right);
  }
  return (
    left.fileName === right.fileName &&
    left.width === right.width &&
    left.height === right.height &&
    left.hasAlpha === right.hasAlpha
  );
}

export function createRegion(input: {
  id: string;
  crop: Rect;
  label?: string;
  backgroundMode: BackgroundMode;
}): AssetRegion {
  return {
    id: input.id,
    label: input.label ?? input.id,
    enabled: true,
    crop: normalizeRect(input.crop),
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    exportSize: null,
    backgroundMode: input.backgroundMode,
    anchor: { x: 0.5, y: 0.5 },
    tags: [],
  };
}

export function getNextRegionId(regions: AssetRegion[]): string {
  const usedIds = new Set(regions.map((region) => region.id));
  const highestNumericId = regions.reduce((highest, region) => {
    if (!/^\d+$/.test(region.id)) {
      return highest;
    }
    return Math.max(highest, Number(region.id));
  }, 0);
  let nextId = String(highestNumericId + 1);
  while (usedIds.has(nextId)) {
    nextId = String(Number(nextId) + 1);
  }
  return nextId;
}

export function serializeProjectJson(project: CutterProject): string {
  const serializableProject: CutterProject = {
    version: 2,
    projectId: project.projectId,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sourceRef: project.sourceRef,
    background: project.background,
    regions: project.regions,
    groups: project.groups ?? [],
  };
  return JSON.stringify(serializableProject, null, 2);
}

export function parseProjectJson(json: string): CutterProject {
  const value = JSON.parse(json) as CutterProject;
  if (value.version !== 2) {
    throw new Error('Unsupported project version.');
  }
  if (!value.sourceRef || !value.background?.settings || !Array.isArray(value.regions)) {
    throw new Error('Invalid project file.');
  }
  return {
    ...value,
    sourceRef: {
      ...value.sourceRef,
      fingerprint: value.sourceRef.fingerprint || createSourceFingerprint(value.sourceRef),
    },
    background: {
      settings: normalizeBackgroundSettings(value.background.settings, value.sourceRef),
      edits: Array.isArray(value.background.edits) ? value.background.edits : [],
    },
    groups: normalizeAssetGroups(Array.isArray(value.groups) ? value.groups : [], value.regions),
  };
}

export function normalizeRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

export function clampRegionToSource(region: AssetRegion, source: SourceImageMeta, minimumSize = 4): AssetRegion {
  const width = Math.min(Math.max(minimumSize, Math.round(region.crop.width)), source.width);
  const height = Math.min(Math.max(minimumSize, Math.round(region.crop.height)), source.height);
  const x = Math.min(Math.max(0, Math.round(region.crop.x)), Math.max(0, source.width - width));
  const y = Math.min(Math.max(0, Math.round(region.crop.y)), Math.max(0, source.height - height));

  return {
    ...region,
    crop: { x, y, width, height },
  };
}

export function normalizeRegionCrop(region: AssetRegion, minimumSize = 4): AssetRegion {
  return {
    ...region,
    crop: {
      x: Math.round(region.crop.x),
      y: Math.round(region.crop.y),
      width: Math.max(minimumSize, Math.round(region.crop.width)),
      height: Math.max(minimumSize, Math.round(region.crop.height)),
    },
  };
}

export function duplicateRegion(region: AssetRegion, existingRegions: AssetRegion[], source: SourceImageMeta): AssetRegion {
  void source;
  return normalizeRegionCrop(
    {
      ...region,
      id: getNextRegionId(existingRegions),
      label: `${region.label} Copy`,
      crop: {
        ...region.crop,
        x: region.crop.x + 16,
        y: region.crop.y + 16,
      },
    },
  );
}

export function getNextAssetGroupId(groups: Array<Pick<AssetGroup, 'id'>>, name: string): string {
  const base = slugifyGroupId(name) || 'asset-group';
  const usedIds = new Set(groups.map((group) => group.id));
  if (!usedIds.has(base)) return base;

  let suffix = 2;
  let nextId = `${base}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${base}-${suffix}`;
  }
  return nextId;
}

export function addAssetGroup(
  project: CutterProject,
  input: {
    name: string;
    regionIds: string[];
  },
): CutterProject {
  const regionIds = getUniqueExistingRegionIds(project, input.regionIds);
  const group: AssetGroup = {
    id: getNextAssetGroupId(project.groups ?? [], input.name),
    name: input.name.trim() || 'Asset Group',
    regionIds,
    frame: null,
    anchor: null,
    tags: [],
    exportPathPrefix: '',
  };

  return {
    ...project,
    groups: [
      ...removeRegionIdsFromGroups(project.groups ?? [], regionIds),
      group,
    ],
  };
}

export function updateAssetGroup(project: CutterProject, groupId: string, patch: Partial<Omit<AssetGroup, 'id'>>): CutterProject {
  return {
    ...project,
    groups: (project.groups ?? []).map((group) =>
      group.id === groupId
        ? normalizeAssetGroup(
            {
              ...group,
              ...patch,
            },
            project.regions,
          )
        : group,
    ),
  };
}

export function assignRegionsToGroup(project: CutterProject, groupId: string, regionIds: string[]): CutterProject {
  const nextRegionIds = getUniqueExistingRegionIds(project, regionIds);
  return {
    ...project,
    groups: removeRegionIdsFromGroups(project.groups ?? [], nextRegionIds).map((group) =>
      group.id === groupId
        ? {
            ...group,
            regionIds: getUniqueIds([...group.regionIds, ...nextRegionIds]),
          }
        : group,
    ),
  };
}

export function removeRegionsFromGroup(project: CutterProject, groupId: string, regionIds: string[]): CutterProject {
  const removeIds = new Set(regionIds);
  return {
    ...project,
    groups: (project.groups ?? []).map((group) =>
      group.id === groupId
        ? {
            ...group,
            regionIds: group.regionIds.filter((id) => !removeIds.has(id)),
          }
        : group,
    ),
  };
}

export function deleteAssetGroup(project: CutterProject, groupId: string): CutterProject {
  return {
    ...project,
    groups: (project.groups ?? []).filter((group) => group.id !== groupId),
  };
}

export function deleteRegionFromProject(project: CutterProject, regionId: string): CutterProject {
  return {
    ...project,
    regions: project.regions.filter((region) => region.id !== regionId),
    groups: (project.groups ?? []).map((group) => ({
      ...group,
      regionIds: group.regionIds.filter((id) => id !== regionId),
    })),
  };
}

export function applyAssetGroupRules(project: CutterProject, groupId: string): CutterProject {
  const group = (project.groups ?? []).find((candidate) => candidate.id === groupId);
  if (!group) return project;

  const framedProject = group.frame ? normalizeRegionsToFrame(project, group.regionIds, group.frame) : project;
  const groupTags = group.tags.map((tag) => tag.trim()).filter(Boolean);
  const memberIds = new Set(group.regionIds);

  return {
    ...framedProject,
    regions: framedProject.regions.map((region) => {
      if (!memberIds.has(region.id)) return region;
      return {
        ...region,
        anchor: group.anchor ?? region.anchor,
        tags: getUniqueIds([...region.tags, ...groupTags]),
      };
    }),
  };
}

export function applyBackgroundModeToProject(project: CutterProject, backgroundMode: BackgroundMode): CutterProject {
  const previousMode = project.background.settings.mode;
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: {
      ...project.background,
      settings: {
        ...project.background.settings,
        mode: backgroundMode,
      },
    },
    regions: project.regions.map((region) =>
      region.backgroundMode === previousMode
        ? {
            ...region,
            backgroundMode,
          }
        : region,
    ),
  };
}

export function normalizeRegionsToFrame(
  project: CutterProject,
  regionIds: string[],
  frame: { width: number; height: number },
): CutterProject {
  const selectedIds = new Set(regionIds);
  const width = Math.max(1, Math.round(frame.width));
  const height = Math.max(1, Math.round(frame.height));

  return {
    ...project,
    regions: project.regions.map((region) => {
      if (!selectedIds.has(region.id)) {
        return region;
      }

      const centerX = region.crop.x + region.crop.width / 2;
      const centerY = region.crop.y + region.crop.height / 2;

      return normalizeRegionCrop({
        ...region,
        crop: {
          x: Math.round(centerX - width / 2),
          y: Math.round(centerY - height / 2),
          width,
          height,
        },
      });
    }),
  };
}

export function touchProject(project: CutterProject): CutterProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
  };
}

export function createWholeImageRegion(project: CutterProject): AssetRegion {
  return {
    id: stripImageExtension(project.sourceRef.fileName) || 'whole-image',
    label: 'Whole image',
    enabled: true,
    crop: {
      x: 0,
      y: 0,
      width: project.sourceRef.width,
      height: project.sourceRef.height,
    },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    exportSize: null,
    backgroundMode: project.background.settings.mode,
    anchor: { x: 0.5, y: 0.5 },
    tags: [],
  };
}

function stripImageExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function createSourceFingerprint(source: SourceImageMeta): string {
  return `${source.fileName}:${source.width}x${source.height}:${source.hasAlpha ? 'alpha' : 'opaque'}`;
}

function createProjectId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `project-${Date.now().toString(36)}-${random}`;
}

function normalizeBackgroundSettings(settings: Partial<BackgroundSettings>, source: SourceImageMeta): BackgroundSettings {
  return {
    ...createBackgroundSettings(source),
    ...settings,
  };
}

function normalizeAssetGroups(groups: AssetGroup[], regions: AssetRegion[]): AssetGroup[] {
  const usedRegionIds = new Set<string>();
  return groups.map((group) => {
    const normalizedGroup = normalizeAssetGroup(group, regions);
    const regionIds = normalizedGroup.regionIds.filter((regionId) => {
      if (usedRegionIds.has(regionId)) return false;
      usedRegionIds.add(regionId);
      return true;
    });
    return {
      ...normalizedGroup,
      regionIds,
    };
  });
}

function normalizeAssetGroup(group: AssetGroup, regions: AssetRegion[]): AssetGroup {
  return {
    id: group.id || getNextAssetGroupId([], group.name),
    name: group.name || group.id || 'Asset Group',
    regionIds: getUniqueExistingRegionIds({ regions }, Array.isArray(group.regionIds) ? group.regionIds : []),
    frame: group.frame
      ? {
          width: Math.max(1, Math.round(group.frame.width)),
          height: Math.max(1, Math.round(group.frame.height)),
        }
      : null,
    anchor: group.anchor
      ? {
          x: Number(group.anchor.x),
          y: Number(group.anchor.y),
        }
      : null,
    tags: Array.isArray(group.tags) ? getUniqueIds(group.tags.map((tag) => tag.trim()).filter(Boolean)) : [],
    exportPathPrefix: group.exportPathPrefix?.trim().replace(/^\/+|\/+$/g, '') ?? '',
  };
}

function getUniqueExistingRegionIds(project: Pick<CutterProject, 'regions'>, regionIds: string[]): string[] {
  const existingIds = new Set(project.regions.map((region) => region.id));
  return getUniqueIds(regionIds).filter((id) => existingIds.has(id));
}

function getUniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function removeRegionIdsFromGroups(groups: AssetGroup[], regionIds: string[]): AssetGroup[] {
  const regionIdSet = new Set(regionIds);
  return groups.map((group) => ({
    ...group,
    regionIds: group.regionIds.filter((id) => !regionIdSet.has(id)),
  }));
}

function slugifyGroupId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
