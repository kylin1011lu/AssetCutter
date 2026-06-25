import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import {
  CheckSquare,
  Copy,
  Crosshair,
  Download,
  Eye,
  FileJson,
  FolderOpen,
  ImagePlus,
  Maximize2,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AssetCanvas } from '../canvas/AssetCanvas';
import { detectAssetRegionsFromImageData, detectEdgeBackgroundColor } from '../canvas/autoDetectRegions';
import { processBackground } from '../canvas/backgroundProcessing';
import { exportCropImageDataToPngBlob } from '../canvas/cropExport';
import { downloadProjectZip } from '../io/exportZip';
import { loadImageFile, type LoadedImageFile } from '../io/loadImageFile';
import { downloadProjectJson, readTextFile } from '../io/saveProject';
import {
  addAssetGroup,
  applyAssetGroupRules,
  assignRegionsToGroup,
  createDefaultProject,
  createRegion,
  createSourceRef,
  createWholeImageRegion,
  deleteAssetGroup,
  deleteRegionFromProject,
  duplicateRegion,
  getNextAssetGroupId,
  getNextRegionId,
  isSameSourceImage,
  normalizeRegionCrop,
  parseProjectJson,
  removeRegionsFromGroup,
  touchProject,
  updateAssetGroup,
  type AssetGroup,
  type AssetRegion,
  type BackgroundEdit,
  type BackgroundSettings,
  type CutterProject,
} from '../model/project';
import {
  getInitialLanguage,
  languageStorageKey,
  translations,
  type Language,
  type Translation,
} from '../i18n/translations';
import {
  getAnchoredPreviewScroll,
  getNextPreviewZoom,
  previewZoomButtonStep,
  previewZoomMax,
  previewZoomMin,
  previewZoomWheelStep,
  type PreviewZoom,
} from './previewZoom';
import {
  createPreviewBoardLayout,
  getPreviewBoardWorkspace,
  movePreviewBoardItem,
  type PreviewBoardItem,
  type PreviewBoardRegion,
} from './previewBoard';
import './App.css';

type ActiveTool = 'background' | 'crop' | 'assetGroups' | 'previewBoard';
type CanvasView = 'original' | 'result' | 'alpha' | 'edges';
type PreviewBackgroundMode = 'transparent' | 'solid';

interface PreviewBoardAsset {
  regionId: string;
  label: string;
  groupName: string | null;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const defaultLargePreviewBackgroundColor = '#00ff00';
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function App() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [loadedImage, setLoadedImage] = useState<LoadedImageFile | null>(null);
  const [project, setProject] = useState<CutterProject | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() =>
    getInitialLanguage(window.localStorage.getItem(languageStorageKey), window.navigator.language),
  );
  const t = translations[language];
  const [status, setStatus] = useState<string>(t.startStatus);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [canvasBackgroundMode, setCanvasBackgroundMode] = useState<PreviewBackgroundMode>('transparent');
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState(defaultLargePreviewBackgroundColor);
  const [assetGroupName, setAssetGroupName] = useState('');
  const [selectedAssetGroupId, setSelectedAssetGroupId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('background');
  const [previewBoardRegionIds, setPreviewBoardRegionIds] = useState<string[]>([]);
  const [previewBoardTitle, setPreviewBoardTitle] = useState('');
  const [previewBoardAssets, setPreviewBoardAssets] = useState<PreviewBoardAsset[]>([]);
  const [previewBoardItems, setPreviewBoardItems] = useState<PreviewBoardItem[]>([]);
  const [previewBoardWarnings, setPreviewBoardWarnings] = useState<string[]>([]);
  const [canvasView, setCanvasView] = useState<CanvasView>('result');
  const [canvasDisplayImage, setCanvasDisplayImage] = useState<HTMLImageElement | null>(null);
  const [autoDetectConfirmOpen, setAutoDetectConfirmOpen] = useState(false);
  const [openParameterHelp, setOpenParameterHelp] = useState<keyof Translation['parameterHelp'] | null>(null);
  const [backgroundPointPickEnabled, setBackgroundPointPickEnabled] = useState(false);

  const selectedRegion = useMemo(
    () => project?.regions.find((region) => region.id === selectedRegionId) ?? null,
    [project, selectedRegionId],
  );
  const selectedRegions = useMemo(
    () => project?.regions.filter((region) => selectedRegionIds.includes(region.id)) ?? [],
    [project?.regions, selectedRegionIds],
  );
  const selectedAssetGroup = useMemo(
    () => project?.groups.find((group) => group.id === selectedAssetGroupId) ?? project?.groups[0] ?? null,
    [project?.groups, selectedAssetGroupId],
  );
  const selectedAssetGroupRegions = useMemo(
    () => project?.regions.filter((region) => selectedAssetGroup?.regionIds.includes(region.id)) ?? [],
    [project?.regions, selectedAssetGroup],
  );
  const selectedPreviewBoardAsset = useMemo(
    () => previewBoardAssets.find((asset) => asset.regionId === selectedRegionId) ?? null,
    [previewBoardAssets, selectedRegionId],
  );
  const wholeImageRegion = useMemo(() => (project ? createWholeImageRegion(project) : null), [project]);
  const previewRegion = selectedRegion ?? wholeImageRegion;
  const isWholeImageSelection = Boolean(project && !selectedRegion);
  const sourceConnection = useMemo(() => {
    if (!project) return 'none';
    if (!loadedImage) return 'missing';
    return isSameSourceImage(project.sourceRef, loadedImage.source) ? 'ready' : 'mismatch';
  }, [loadedImage, project]);
  const sourceReady = sourceConnection === 'ready';
  const editingDisabled = !sourceReady;

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    if (!project) {
      setSelectedRegionIds([]);
      setSelectedAssetGroupId(null);
      return;
    }
    const regionIds = new Set(project.regions.map((region) => region.id));
    setSelectedRegionIds((previous) => previous.filter((id) => regionIds.has(id)));
    if (selectedAssetGroupId && !project.groups.some((group) => group.id === selectedAssetGroupId)) {
      setSelectedAssetGroupId(project.groups[0]?.id ?? null);
    }
  }, [project]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!project?.regions.length || isEditableShortcutTarget(event.target)) return;
      if (event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setSelectedRegionIds(project.regions.map((region) => region.id));
        setStatus(t.selectedAllStatus(project.regions.length));
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && activeTool === 'crop' && selectedRegion) {
        event.preventDefault();
        deleteSelectedRegion();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, project?.regions, selectedRegion, t]);

  useEffect(() => {
    return () => {
      if (loadedImage?.objectUrl) URL.revokeObjectURL(loadedImage.objectUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [loadedImage?.objectUrl, previewUrl]);

  useEffect(() => {
    if (activeTool !== 'background' || !sourceReady) {
      setBackgroundPointPickEnabled(false);
    }
  }, [activeTool, sourceReady]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function renderCanvasImage() {
      if (!loadedImage || !project || !sourceReady) {
        setCanvasDisplayImage(null);
        return;
      }
      if (canvasView === 'original') {
        setCanvasDisplayImage(loadedImage.image);
        return;
      }

      const sourceData = getSourceImageData(loadedImage.image, project.sourceRef.width, project.sourceRef.height);
      const processed = processBackground(sourceData, project.background.settings, project.background.edits);
      const imageData = getCanvasViewImageData(sourceData, processed.imageData, canvasView);
      const image = await createImageFromImageData(imageData);
      objectUrl = image.objectUrl;
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setCanvasDisplayImage(image.image);
    }

    void renderCanvasImage().catch((error: unknown) => setStatus(error instanceof Error ? error.message : t.previewFailed));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canvasView, loadedImage, project, sourceReady, t.previewFailed]);

  useEffect(() => {
    let cancelled = false;

    async function renderPreview() {
      if (!loadedImage || !project || !previewRegion || !sourceReady) {
        setPreviewUrl(null);
        return;
      }

      const processed = getProcessedSourceImageData(loadedImage.image, project);
      const result = await exportCropImageDataToPngBlob(
        processed.imageData,
        previewRegion,
        project.background.settings,
      );
      if (cancelled) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(result.blob));
      setWarnings([...processed.warnings, ...result.warnings]);
    }

    void renderPreview().catch((error: unknown) => setStatus(error instanceof Error ? error.message : t.previewFailed));
    return () => {
      cancelled = true;
    };
  }, [loadedImage, project, previewRegion, sourceReady]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function renderPreviewBoardAssets() {
      if (activeTool !== 'previewBoard' || !loadedImage || !project || !sourceReady) {
        setPreviewBoardAssets([]);
        setPreviewBoardWarnings([]);
        return;
      }

      const regionIdSet = new Set(previewBoardRegionIds);
      const boardRegions = project.regions.filter((region) => region.enabled && regionIdSet.has(region.id));
      if (!boardRegions.length) {
        setPreviewBoardAssets([]);
        setPreviewBoardWarnings([]);
        return;
      }

      const processed = getProcessedSourceImageData(loadedImage.image, project);
      const groupByRegionId = new Map<string, AssetGroup>();
      for (const group of project.groups) {
        for (const regionId of group.regionIds) {
          groupByRegionId.set(regionId, group);
        }
      }
      const nextWarnings = [...processed.warnings];
      const nextAssets = await Promise.all(
        boardRegions.map(async (region) => {
          const result = await exportCropImageDataToPngBlob(
            processed.imageData,
            region,
            project.background.settings,
          );
          const url = URL.createObjectURL(result.blob);
          objectUrls.push(url);
          nextWarnings.push(...result.warnings.map((warning) => `${region.id}: ${warning}`));
          return {
            regionId: region.id,
            label: region.label || region.id,
            groupName: groupByRegionId.get(region.id)?.name ?? null,
            url,
            x: region.crop.x - region.padding.left,
            y: region.crop.y - region.padding.top,
            width: result.width,
            height: result.height,
          };
        }),
      );

      if (cancelled) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setPreviewBoardAssets(nextAssets);
      setPreviewBoardWarnings(nextWarnings);
    }

    void renderPreviewBoardAssets().catch((error: unknown) => setStatus(error instanceof Error ? error.message : t.previewFailed));
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [activeTool, loadedImage, project, previewBoardRegionIds, sourceReady, t.previewFailed]);

  useEffect(() => {
    const regions: PreviewBoardRegion[] = previewBoardAssets.map((asset) => ({
      id: asset.regionId,
      x: asset.x,
      y: asset.y,
      width: asset.width,
      height: asset.height,
    }));
    setPreviewBoardItems((previousItems) =>
      createPreviewBoardLayout({
        regions,
        previousItems,
      }),
    );
  }, [previewBoardAssets]);

  async function handleImageFile(file: File) {
    const nextImage = await loadImageFile(file);
    setLoadedImage((previous) => {
      if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      return nextImage;
    });

    const reconnectingToCurrentProject = project ? isSameSourceImage(project.sourceRef, nextImage.source) : false;
    const nextStatus = reconnectingToCurrentProject
      ? t.loadedForProject
      : t.loadedImageStatus(file.name, nextImage.source.width, nextImage.source.height);
    setProject((previous) => {
      if (!previous || !isSameSourceImage(previous.sourceRef, nextImage.source)) {
        setSelectedRegionId(null);
        setSelectedRegionIds([]);
        return createDefaultProject(nextImage.source);
      }
      return {
        ...previous,
        sourceRef: createSourceRef(nextImage.source),
      };
    });
    setStatus(nextStatus);
  }

  function addRegion() {
    if (!project) return;
    const nextId = getNextRegionId(project.regions);
    const index = Number(nextId);
    const cropWidth = Math.min(180, project.sourceRef.width);
    const cropHeight = Math.min(140, project.sourceRef.height);
    const region = createRegion({
      id: nextId,
      label: t.defaultRegionLabel(index),
      crop: {
        x: Math.max(0, Math.round((project.sourceRef.width - cropWidth) / 2)),
        y: Math.max(0, Math.round((project.sourceRef.height - cropHeight) / 2)),
        width: cropWidth,
        height: cropHeight,
      },
      backgroundMode: project.background.settings.mode,
    });
    updateProject({ ...project, regions: [...project.regions, region] });
    setSelectedRegionId(region.id);
  }

  function handleAutoDetectRegions() {
    if (!project?.regions.length) {
      autoDetectRegions({ replaceExisting: false });
      return;
    }
    setAutoDetectConfirmOpen(true);
  }

  function confirmAutoDetectReplacement() {
    setAutoDetectConfirmOpen(false);
    autoDetectRegions({ replaceExisting: true });
  }

  function autoDetectRegions({ replaceExisting }: { replaceExisting: boolean }) {
    if (!project || !loadedImage || !sourceReady) return;
    const processed = getProcessedSourceImageData(loadedImage.image, project);
    const result = detectAssetRegionsFromImageData(processed.imageData);

    if (result.warning === 'autoDetectNoRegions' || result.rects.length === 0) {
      if (replaceExisting) {
        updateProject({ ...project, regions: [] });
        setSelectedRegionId(null);
        setSelectedRegionIds([]);
      }
      setStatus(t.autoDetectNoRegions);
      return;
    }

    const existingRegions = replaceExisting ? [] : project.regions;
    const nextRegions = result.rects.reduce<AssetRegion[]>((regions, crop) => {
      const nextId = getNextRegionId([...existingRegions, ...regions]);
      return [
        ...regions,
        createRegion({
          id: nextId,
          label: t.defaultRegionLabel(Number(nextId)),
          crop,
          backgroundMode: 'source',
        }),
      ];
    }, []);
    updateProject({ ...project, regions: [...existingRegions, ...nextRegions] });
    setSelectedRegionId(nextRegions[0].id);
    if (replaceExisting) {
      setSelectedRegionIds([]);
    }
    setStatus(t.autoDetectedStatus(nextRegions.length));
  }

  function updateProject(nextProject: CutterProject) {
    setProject(touchProject(nextProject));
  }

  function updateRegion(nextRegion: AssetRegion, matchId = nextRegion.id) {
    if (!project) return;
    updateProject({
      ...project,
      regions: project.regions.map((region) => (region.id === matchId ? nextRegion : region)),
    });
  }

  function patchSelectedRegion(patch: Partial<AssetRegion>) {
    if (!project || !selectedRegion) return;
    const nextRegion = normalizeRegionCrop({ ...selectedRegion, ...patch });
    updateRegion(nextRegion, selectedRegion.id);
    if (patch.id && patch.id !== selectedRegionId) {
      setSelectedRegionId(patch.id);
    }
  }

  function deleteSelectedRegion() {
    if (!project || !selectedRegion) return;
    const deletedLabel = selectedRegion.label || selectedRegion.id;
    updateProject(deleteRegionFromProject(project, selectedRegion.id));
    setSelectedRegionId(null);
    setSelectedRegionIds((previous) => previous.filter((id) => id !== selectedRegion.id));
    setStatus(t.regionDeleted(deletedLabel));
  }

  function duplicateSelectedRegion() {
    if (!project || !selectedRegion) return;
    const duplicate = duplicateRegion(selectedRegion, project.regions, project.sourceRef);
    updateProject({ ...project, regions: [...project.regions, duplicate] });
    setSelectedRegionId(duplicate.id);
  }

  async function exportAll() {
    if (!loadedImage || !project || !sourceReady) return;
    const zipWarnings = await downloadProjectZip(loadedImage.image, project);
    setWarnings(zipWarnings);
    setStatus(t.exportAllStatus(project.regions.filter((region) => region.enabled).length));
  }

  async function handleProjectFile(file: File) {
    const parsed = parseProjectJson(await readTextFile(file));
    setProject(parsed);
    setSelectedRegionId(parsed.regions[0]?.id ?? null);
    setSelectedRegionIds([]);
    if (!loadedImage) {
      setStatus(t.loadProjectFirst);
      return;
    }
    if (!isSameSourceImage(parsed.sourceRef, loadedImage.source)) {
      setStatus(t.loadProjectMismatch);
      return;
    }
    setStatus(t.loadProjectSuccess);
  }

  function autoSampleBackground() {
    if (!loadedImage || !project || !sourceReady) {
      setStatus(t.loadProjectFirst);
      return;
    }
    const detectedBackground = detectEdgeBackgroundColor(
      getSourceImageData(loadedImage.image, project.sourceRef.width, project.sourceRef.height),
    );
    if (!detectedBackground) {
      setStatus(t.autoSampleBackgroundFailed);
      return;
    }
    updateBackgroundSettings({
      mode: 'chromaKey',
      chromaKey: detectedBackground.color,
      tolerance: detectedBackground.tolerance,
    });
    setStatus(t.autoSampleBackgroundStatus(detectedBackground.color, detectedBackground.tolerance));
  }

  function updateBackgroundSettings(patch: Partial<BackgroundSettings>) {
    if (!project) return;
    const previousMode = project.background.settings.mode;
    const settings = {
      ...project.background.settings,
      ...patch,
    };
    const shouldSyncRegionMode = patch.mode !== undefined && patch.mode !== previousMode;
    updateProject({
      ...project,
      background: {
        ...project.background,
        settings,
      },
      regions: project.regions.map((region) =>
        shouldSyncRegionMode && region.backgroundMode === previousMode
          ? {
              ...region,
              backgroundMode: settings.mode,
            }
          : region,
      ),
    });
  }

  function addLocalBackgroundEdit(point: { x: number; y: number }) {
    if (!project || editingDisabled) return;
    const settings = project.background.settings;
    const edit: BackgroundEdit = {
      id: `local-chroma-${Date.now().toString(36)}-${project.background.edits.length + 1}`,
      type: 'local-chroma-key',
      point,
    };
    updateProject({
      ...project,
      background: {
        settings: {
          ...settings,
          mode: 'chromaKey',
        },
        edits: [...project.background.edits, edit],
      },
    });
    setCanvasView('result');
    setStatus(t.localBackgroundEditAdded(point.x, point.y));
  }

  function undoLastLocalBackgroundEdit() {
    if (!project) return;
    let lastLocalEditIndex = -1;
    for (let index = project.background.edits.length - 1; index >= 0; index -= 1) {
      if (project.background.edits[index].type === 'local-chroma-key') {
        lastLocalEditIndex = index;
        break;
      }
    }
    if (lastLocalEditIndex < 0) return;
    updateProject({
      ...project,
      background: {
        ...project.background,
        edits: project.background.edits.filter((_, index) => index !== lastLocalEditIndex),
      },
    });
    setStatus(t.localBackgroundEditRemoved);
  }

  function enterBackgroundTool() {
    setActiveTool('background');
  }

  function toggleRegionSelection(regionId: string, selected: boolean) {
    setSelectedRegionIds((previous) => {
      if (selected) {
        return previous.includes(regionId) ? previous : [...previous, regionId];
      }
      return previous.filter((id) => id !== regionId);
    });
  }

  function selectAllRegions() {
    if (!project?.regions.length) return;
    setSelectedRegionIds(project.regions.map((region) => region.id));
    setStatus(t.selectedAllStatus(project.regions.length));
  }

  function clearRegionSelection() {
    if (!selectedRegionIds.length) return;
    setSelectedRegionIds([]);
    setStatus(t.clearedSelectionStatus);
  }

  function createGroupFromSelection() {
    if (!project || selectedRegionIds.length === 0) return;
    const name = assetGroupName.trim() || t.defaultAssetGroupName(project.groups.length + 1);
    const nextProject = addAssetGroup(project, {
      name,
      regionIds: selectedRegionIds,
    });
    const groupId = getNextAssetGroupId(project.groups, name);
    updateProject(nextProject);
    setSelectedAssetGroupId(groupId);
    setAssetGroupName('');
    setStatus(t.assetGroupCreated(name, selectedRegionIds.length));
  }

  function patchSelectedAssetGroup(patch: Partial<Omit<AssetGroup, 'id'>>) {
    if (!project || !selectedAssetGroup) return;
    updateProject(updateAssetGroup(project, selectedAssetGroup.id, patch));
  }

  function addSelectedRegionsToGroup() {
    if (!project || !selectedAssetGroup || selectedRegionIds.length === 0) return;
    updateProject(assignRegionsToGroup(project, selectedAssetGroup.id, selectedRegionIds));
    setStatus(t.assetGroupMembersUpdated(selectedRegionIds.length));
  }

  function removeSelectedRegionsFromGroup() {
    if (!project || !selectedAssetGroup || selectedRegionIds.length === 0) return;
    updateProject(removeRegionsFromGroup(project, selectedAssetGroup.id, selectedRegionIds));
    setStatus(t.assetGroupMembersUpdated(selectedRegionIds.length));
  }

  function removeSelectedAssetGroup() {
    if (!project || !selectedAssetGroup) return;
    updateProject(deleteAssetGroup(project, selectedAssetGroup.id));
    setSelectedAssetGroupId(project.groups.find((group) => group.id !== selectedAssetGroup.id)?.id ?? null);
    setStatus(t.assetGroupDeleted(selectedAssetGroup.name));
  }

  function useMaxFrameForSelectedGroup() {
    if (!selectedAssetGroup) return;
    const frameSource = selectedRegions.length > 0 ? selectedRegions : selectedAssetGroupRegions;
    if (!frameSource.length) return;
    patchSelectedAssetGroup({
      frame: {
        width: Math.max(...frameSource.map((region) => region.crop.width)),
        height: Math.max(...frameSource.map((region) => region.crop.height)),
      },
    });
  }

  function applySelectedAssetGroupRules() {
    if (!project || !selectedAssetGroup) return;
    updateProject(applyAssetGroupRules(project, selectedAssetGroup.id));
    setStatus(t.assetGroupApplied(selectedAssetGroup.name, selectedAssetGroup.regionIds.length));
  }

  function openPreviewBoard(regionIds: string[], title: string) {
    if (!project) return;
    const existingEnabledIds = new Set(project.regions.filter((region) => region.enabled).map((region) => region.id));
    const nextRegionIds = [...new Set(regionIds)].filter((regionId) => existingEnabledIds.has(regionId));
    if (!nextRegionIds.length) return;
    setPreviewBoardRegionIds(nextRegionIds);
    setPreviewBoardTitle(title);
    setActiveTool('previewBoard');
    setStatus(t.previewBoardOpened(nextRegionIds.length));
  }

  function openSelectedGroupPreviewBoard() {
    if (!selectedAssetGroup) return;
    openPreviewBoard(selectedAssetGroup.regionIds, selectedAssetGroup.name);
  }

  function openSelectionPreviewBoard() {
    openPreviewBoard(selectedRegionIds, t.previewBoardSelectionTitle);
  }

  function openAllPreviewBoard() {
    if (!project) return;
    openPreviewBoard(project.regions.filter((region) => region.enabled).map((region) => region.id), t.previewBoardAllTitle);
  }

  function resetPreviewBoardLayout() {
    const regions: PreviewBoardRegion[] = previewBoardAssets.map((asset) => ({
      id: asset.regionId,
      x: asset.x,
      y: asset.y,
      width: asset.width,
      height: asset.height,
    }));
    setPreviewBoardItems(createPreviewBoardLayout({ regions, previousItems: [] }));
    setStatus(t.previewBoardLayoutReset);
  }

  const previewDimensions = previewRegion
    ? previewRegion.exportSize ?? {
        width: previewRegion.crop.width + previewRegion.padding.left + previewRegion.padding.right,
        height: previewRegion.crop.height + previewRegion.padding.top + previewRegion.padding.bottom,
      }
    : null;
  const previewDisplayLabel = isWholeImageSelection ? t.wholeImageName : previewRegion?.label;
  const canvasBackgroundStyle = getPreviewBackgroundStyle(canvasBackgroundMode, canvasBackgroundColor);
  const localBackgroundEditCount = project?.background.edits.filter((edit) => edit.type === 'local-chroma-key').length ?? 0;

  return (
    <main className="appRoot">
      <input
        ref={imageInputRef}
        className="visuallyHidden"
        type="file"
        accept="image/png,image/jpeg"
        data-testid="image-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImageFile(file).catch((error: unknown) => setStatus(error instanceof Error ? error.message : t.importFailed));
        }}
      />
      <input
        ref={projectInputRef}
        className="visuallyHidden"
        type="file"
        accept="application/json"
        data-testid="project-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleProjectFile(file).catch((error: unknown) => setStatus(error instanceof Error ? error.message : t.projectLoadFailed));
        }}
      />

      <header className="topbar prototypeTopbar">
        <div className="brandBlock">
          <h1>Asset Cutter</h1>
          <p data-testid="source-meta">
            {project
              ? `${project.sourceRef.fileName} · ${project.sourceRef.width} x ${project.sourceRef.height} · ${project.sourceRef.hasAlpha ? t.alpha : t.opaque}`
              : t.localTagline}
          </p>
        </div>
        <div className="toolbar prototypeToolbar">
          <span className="topContext" data-testid="current-tool-status">
            {t.currentToolStatus(getActiveToolLabel(activeTool, t), project?.regions.length ?? 0, warnings.length)}
          </span>
          <label className="languageSelect compactLanguage">
            {t.language}
            <select data-testid="language-select" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="button" onClick={() => imageInputRef.current?.click()}>
            <ImagePlus size={18} /> {t.importImage}
          </button>
          <button type="button" onClick={() => projectInputRef.current?.click()}>
            <FolderOpen size={18} /> {t.loadJson}
          </button>
          <button type="button" disabled={!project} onClick={() => project && downloadProjectJson(project)}>
            <Save size={18} /> {t.saveJson}
          </button>
          <button type="button" disabled>
            <RotateCcw size={18} /> {t.previewResetZoom}
          </button>
          <button type="button" className="primaryButton" disabled={!project?.regions.length || !sourceReady} onClick={() => void exportAll()}>
            <Download size={18} /> {t.selectedExport}
          </button>
        </div>
      </header>

      <section className="workspace prototypeWorkspace">
        <aside className="panel leftPanel toolPanel">
          <div className="panelHeader prototypePanelHeader">
            <h2>{t.toolsAndAssets}</h2>
            <button type="button" className="iconButton" disabled={!project || editingDisabled} onClick={addRegion} data-testid="add-region">
              <Plus size={17} />
            </button>
          </div>
          <div className="panelBody">
            <div className="toolGroup">
              <ToolButton
                active={activeTool === 'background'}
                icon={<Sparkles size={16} />}
                label={t.backgroundTool}
                hint={t.backgroundToolHint}
                testId="tool-background"
                onClick={enterBackgroundTool}
              />
              <ToolButton
                active={activeTool === 'crop'}
                icon={<Scissors size={16} />}
                label={t.cropTool}
                hint={t.cropToolHint}
                testId="tool-crop"
                onClick={() => setActiveTool('crop')}
              />
              <ToolButton
                active={activeTool === 'assetGroups' || activeTool === 'previewBoard'}
                icon={<Square size={16} />}
                label={t.assetGroupsTool}
                hint={t.assetGroupsToolHint}
                testId="tool-asset-groups"
                onClick={() => setActiveTool('assetGroups')}
              />
            </div>

            {Boolean(project?.regions.length) && (
              <section className="regionListSection" data-testid="region-list-section">
                <div className="regionSelectionActions" data-testid="region-selection-actions">
                  <button type="button" data-testid="select-all-regions" onClick={selectAllRegions}>
                    <CheckSquare size={15} /> {t.selectAll}
                  </button>
                  <button
                    type="button"
                    data-testid="clear-region-selection"
                    disabled={selectedRegionIds.length === 0}
                    onClick={clearRegionSelection}
                  >
                    <Square size={15} /> {t.clearSelection}
                  </button>
                </div>
                <div className="regionList prototypeRegionList" data-testid="region-list">
                  {project?.regions.map((region) => (
                    <div
                      key={region.id}
                      className={region.id === selectedRegionId ? 'regionRowShell selected' : 'regionRowShell'}
                    >
                      <label className="regionSelect" aria-label={t.selectRegionForBatch(region.label || region.id)}>
                        <input
                          type="checkbox"
                          checked={selectedRegionIds.includes(region.id)}
                          data-testid={`region-batch-select-${region.id}`}
                          onChange={(event) => toggleRegionSelection(region.id, event.target.checked)}
                        />
                      </label>
                      <button
                        type="button"
                        className="regionRow"
                        onClick={() => {
                          setSelectedRegionId(region.id);
                          setActiveTool('crop');
                        }}
                      >
                        <span className="regionRowTitle">
                          <span className="regionIdBadge" data-testid={`region-id-badge-${region.id}`}>
                            #{region.id}
                          </span>
                          <span>{region.label || region.id}</span>
                        </span>
                        <small>
                          {project.groups.find((group) => group.regionIds.includes(region.id))?.name ?? t.ungrouped} · {region.crop.width} x {region.crop.height}
                        </small>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        <section className="canvasWorkbench prototypeCanvasWorkbench" data-testid="canvas-workbench">
          <div className="workbenchToolbar prototypeCanvasToolbar" data-testid="workbench-toolbar">
            {activeTool === 'previewBoard' ? (
              <div className="previewBoardToolbarTitle">
                <strong>{t.previewBoardTool}</strong>
                <span>{previewBoardTitle || t.previewBoardAllTitle}</span>
              </div>
            ) : (
              <div className="viewModes">
                {(['original', 'result', 'alpha', 'edges'] as CanvasView[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    className={canvasView === view ? 'activeMode' : ''}
                    onClick={() => setCanvasView(view)}
                  >
                    {getCanvasViewLabel(view, t)}
                  </button>
                ))}
              </div>
            )}
            <PreviewBackgroundControls
              mode={canvasBackgroundMode}
              color={canvasBackgroundColor}
              onModeChange={setCanvasBackgroundMode}
              onColorChange={setCanvasBackgroundColor}
              t={t}
              testIdPrefix="canvas-background"
            />
            <span className="canvasMeta">
              {activeTool === 'previewBoard'
                ? t.previewBoardAssetCount(previewBoardAssets.length)
                : project ? `${project.sourceRef.width} x ${project.sourceRef.height}` : t.sizeLabel}
            </span>
          </div>

          {activeTool === 'previewBoard' ? (
            <PreviewBoard
              assets={previewBoardAssets}
              backgroundStyle={canvasBackgroundStyle}
              emptyMessage={sourceReady ? t.previewBoardEmpty : getCanvasEmptyMessage(sourceConnection, t)}
              items={previewBoardItems}
              selectedRegionId={selectedRegionId}
              sourceSize={project?.sourceRef ?? null}
              t={t}
              warnings={previewBoardWarnings}
              onBack={() => setActiveTool('assetGroups')}
              onItemMove={(regionId, position) => setPreviewBoardItems((items) => movePreviewBoardItem(items, regionId, position))}
              onResetLayout={resetPreviewBoardLayout}
              onSelectRegion={setSelectedRegionId}
            />
          ) : (
            <AssetCanvas
              image={sourceReady ? canvasDisplayImage : null}
              source={project?.sourceRef ?? null}
              regions={sourceReady ? project?.regions ?? [] : []}
              selectedRegionId={selectedRegionId}
              emptyMessage={getCanvasEmptyMessage(sourceConnection, t)}
              backgroundStyle={canvasBackgroundStyle}
              pointPickEnabled={backgroundPointPickEnabled && activeTool === 'background' && sourceReady}
              zoomInLabel={t.canvasZoomIn}
              zoomOutLabel={t.canvasZoomOut}
              zoomResetLabel={t.canvasZoomReset}
              onSelectRegion={setSelectedRegionId}
              onUpdateRegion={updateRegion}
              onImagePointClick={addLocalBackgroundEdit}
            />
          )}
        </section>

        <aside className="panel inspector prototypeInspector">
          <div className="panelHeader prototypePanelHeader">
            <h2>{getInspectorTitle(activeTool, t)}</h2>
            <span className="muted">{selectedRegion ? selectedRegion.id : t.wholeImageName}</span>
          </div>
          <div className="panelBody inspectorBody">
            {activeTool === 'background' && project && (
              <section className="inspectorSection inspectorStack">
                <h3>{t.backgroundTool}</h3>
                <button type="button" disabled={editingDisabled} onClick={autoSampleBackground} title={t.autoSampleBackgroundHint}>
                  <Sparkles size={17} /> {t.autoSampleBackground}
                </button>
                <div className="modeActions">
                  <button
                    type="button"
                    className={backgroundPointPickEnabled ? 'primaryButton activeMode' : ''}
                    disabled={editingDisabled}
                    aria-pressed={backgroundPointPickEnabled}
                    onClick={() => setBackgroundPointPickEnabled((current) => !current)}
                  >
                    <Crosshair size={17} /> {t.pickInnerBackground}
                  </button>
                  <button
                    type="button"
                    disabled={editingDisabled || localBackgroundEditCount === 0}
                    onClick={undoLastLocalBackgroundEdit}
                  >
                    <Undo2 size={17} /> {t.undoInnerBackground}
                  </button>
                </div>
                <p className="selectionHint">{t.localBackgroundEditCount(localBackgroundEditCount)}</p>
                <ParameterField
                  controlId="background-mask-mode"
                  label={t.backgroundMaskMode}
                  helpKey="maskMode"
                  openHelp={openParameterHelp}
                  setOpenHelp={setOpenParameterHelp}
                  t={t}
                >
                  <select
                    id="background-mask-mode"
                    value={project.background.settings.maskMode}
                    disabled={editingDisabled}
                    onChange={(event) =>
                      updateBackgroundSettings({
                        maskMode: event.target.value as BackgroundSettings['maskMode'],
                      })
                    }
                  >
                    <option value="edgeConnected">{t.edgeConnectedMask}</option>
                    <option value="globalColor">{t.globalColorMask}</option>
                  </select>
                </ParameterField>
                <div className="grid2">
                  <ParameterField
                    controlId="background-key-color"
                    label={t.keyColor}
                    helpKey="keyColor"
                    openHelp={openParameterHelp}
                    setOpenHelp={setOpenParameterHelp}
                    t={t}
                  >
                    <input
                      id="background-key-color"
                      type="color"
                      value={project.background.settings.chromaKey}
                      disabled={editingDisabled}
                      onChange={(event) => updateBackgroundSettings({ chromaKey: event.target.value })}
                    />
                  </ParameterField>
                  <ParameterField
                    controlId="background-tolerance"
                    label={t.tolerance}
                    helpKey="tolerance"
                    openHelp={openParameterHelp}
                    setOpenHelp={setOpenParameterHelp}
                    t={t}
                  >
                    <input
                      id="background-tolerance"
                      type="number"
                      min={0}
                      max={255}
                      value={project.background.settings.tolerance}
                      disabled={editingDisabled}
                      onChange={(event) => updateBackgroundSettings({ tolerance: Number(event.target.value) })}
                    />
                  </ParameterField>
                </div>
                <div className="grid2">
                  <ParameterField
                    controlId="background-soft-edge"
                    label={t.softEdge}
                    helpKey="softEdge"
                    openHelp={openParameterHelp}
                    setOpenHelp={setOpenParameterHelp}
                    t={t}
                  >
                    <input
                      id="background-soft-edge"
                      type="number"
                      min={0}
                      max={255}
                      value={project.background.settings.softEdge}
                      disabled={editingDisabled}
                      onChange={(event) => updateBackgroundSettings({ softEdge: Number(event.target.value) })}
                    />
                  </ParameterField>
                  <ParameterField
                    controlId="background-edge-grow"
                    label={t.edgeGrow}
                    helpKey="edgeGrow"
                    openHelp={openParameterHelp}
                    setOpenHelp={setOpenParameterHelp}
                    t={t}
                  >
                    <input
                      id="background-edge-grow"
                      type="number"
                      min={0}
                      max={16}
                      value={project.background.settings.edgeGrow}
                      disabled={editingDisabled}
                      onChange={(event) => updateBackgroundSettings({ edgeGrow: Number(event.target.value) })}
                    />
                  </ParameterField>
                </div>
                <div className="grid2">
                  <ParameterField
                    controlId="background-edge-smoothing"
                    label={t.edgeSmoothing}
                    helpKey="edgeSmoothing"
                    openHelp={openParameterHelp}
                    setOpenHelp={setOpenParameterHelp}
                    t={t}
                  >
                    <input
                      id="background-edge-smoothing"
                      type="number"
                      min={0}
                      max={100}
                      value={project.background.settings.edgeSmoothing}
                      disabled={editingDisabled}
                      onChange={(event) => updateBackgroundSettings({ edgeSmoothing: Number(event.target.value) })}
                    />
                  </ParameterField>
                  <ParameterField
                    controlId="background-spill-removal"
                    label={t.spillRemoval}
                    helpKey="spillRemoval"
                    openHelp={openParameterHelp}
                    setOpenHelp={setOpenParameterHelp}
                    t={t}
                  >
                    <input
                      id="background-spill-removal"
                      type="number"
                      min={0}
                      max={100}
                      value={project.background.settings.spillRemoval}
                      disabled={editingDisabled}
                      onChange={(event) => updateBackgroundSettings({ spillRemoval: Number(event.target.value) })}
                    />
                  </ParameterField>
                </div>
                <p className="selectionHint">{warnings.length ? warnings.join(' ') : t.backgroundNoPixelsCleared}</p>
              </section>
            )}

            {activeTool === 'assetGroups' && project && (
              <section className="inspectorSection inspectorStack">
                <h3>{t.assetGroupsTool}</h3>
                <p className="selectionHint">{t.batchSelectedCount(selectedRegions.length)}</p>
                <label>
                  {t.assetGroupName}
                  <input
                    value={assetGroupName}
                    disabled={editingDisabled}
                    placeholder={t.defaultAssetGroupName((project.groups.length || 0) + 1)}
                    onChange={(event) => setAssetGroupName(event.target.value)}
                  />
                </label>
                <button type="button" className="primaryButton" disabled={editingDisabled || selectedRegionIds.length === 0} onClick={createGroupFromSelection}>
                  <Plus size={17} /> {t.createAssetGroup}
                </button>
                <section className="inspectorSubsection inspectorStack" data-testid="preview-board-entry">
                  <h3>{t.previewBoardTool}</h3>
                  <div className="modeActions">
                    <button type="button" disabled={!sourceReady || selectedRegionIds.length === 0} onClick={openSelectionPreviewBoard}>
                      <Eye size={17} /> {t.previewBoardSelection}
                    </button>
                    <button type="button" disabled={!sourceReady || !project.regions.some((region) => region.enabled)} onClick={openAllPreviewBoard}>
                      <Eye size={17} /> {t.previewBoardAll}
                    </button>
                  </div>
                </section>

                {project.groups.length > 0 && (
                  <>
                    <label>
                      {t.assetGroupSelect}
                      <select
                        value={selectedAssetGroup?.id ?? ''}
                        disabled={editingDisabled}
                        onChange={(event) => setSelectedAssetGroupId(event.target.value)}
                      >
                        {project.groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedAssetGroup && (
                      <section className="inspectorSubsection inspectorStack" data-testid="asset-group-editor">
                        <p className="selectionHint">{t.assetGroupMemberCount(selectedAssetGroup.regionIds.length)}</p>
                        <label>
                          {t.assetGroupName}
                          <input
                            value={selectedAssetGroup.name}
                            disabled={editingDisabled}
                            onChange={(event) => patchSelectedAssetGroup({ name: event.target.value })}
                          />
                        </label>
                        <label>
                          {t.assetGroupPathPrefix}
                          <input
                            value={selectedAssetGroup.exportPathPrefix}
                            disabled={editingDisabled}
                            onChange={(event) => patchSelectedAssetGroup({ exportPathPrefix: event.target.value })}
                          />
                        </label>
                        <div className="grid2">
                          <label>
                            {t.normalizeWidth}
                            <input
                              type="number"
                              min={1}
                              value={selectedAssetGroup.frame?.width ?? ''}
                              disabled={editingDisabled}
                              onChange={(event) =>
                                patchSelectedAssetGroup({
                                  frame: {
                                    width: Number(event.target.value),
                                    height: selectedAssetGroup.frame?.height ?? 1,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            {t.normalizeHeight}
                            <input
                              type="number"
                              min={1}
                              value={selectedAssetGroup.frame?.height ?? ''}
                              disabled={editingDisabled}
                              onChange={(event) =>
                                patchSelectedAssetGroup({
                                  frame: {
                                    width: selectedAssetGroup.frame?.width ?? 1,
                                    height: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="grid2">
                          <label>
                            {t.anchorX}
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={selectedAssetGroup.anchor?.x ?? ''}
                              disabled={editingDisabled}
                              onChange={(event) =>
                                patchSelectedAssetGroup({
                                  anchor: {
                                    x: Number(event.target.value),
                                    y: selectedAssetGroup.anchor?.y ?? 0.5,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            {t.anchorY}
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={selectedAssetGroup.anchor?.y ?? ''}
                              disabled={editingDisabled}
                              onChange={(event) =>
                                patchSelectedAssetGroup({
                                  anchor: {
                                    x: selectedAssetGroup.anchor?.x ?? 0.5,
                                    y: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          {t.tags}
                          <input
                            value={selectedAssetGroup.tags.join(', ')}
                            disabled={editingDisabled}
                            onChange={(event) => patchSelectedAssetGroup({ tags: parseTagsInput(event.target.value) })}
                          />
                        </label>
                        <div className="modeActions">
                          <button type="button" disabled={editingDisabled || selectedRegionIds.length === 0} onClick={addSelectedRegionsToGroup}>
                            {t.addSelectedToGroup}
                          </button>
                          <button type="button" disabled={editingDisabled || selectedRegionIds.length === 0} onClick={removeSelectedRegionsFromGroup}>
                            {t.removeSelectedFromGroup}
                          </button>
                        </div>
                        <div className="modeActions">
                          <button type="button" disabled={editingDisabled || (selectedRegions.length === 0 && selectedAssetGroupRegions.length === 0)} onClick={useMaxFrameForSelectedGroup}>
                            {t.useMaxSelected}
                          </button>
                          <button type="button" className="primaryButton" disabled={editingDisabled || selectedAssetGroup.regionIds.length === 0} onClick={applySelectedAssetGroupRules}>
                            {t.applyAssetGroupRules}
                          </button>
                        </div>
                        <button type="button" disabled={!sourceReady || selectedAssetGroup.regionIds.length === 0} onClick={openSelectedGroupPreviewBoard}>
                          <Eye size={17} /> {t.previewBoardCurrentGroup}
                        </button>
                        <button type="button" disabled={editingDisabled} onClick={removeSelectedAssetGroup}>
                          <Trash2 size={17} /> {t.deleteAssetGroup}
                        </button>
                      </section>
                    )}
                  </>
                )}
              </section>
            )}

            {activeTool === 'previewBoard' && (
              <section className="inspectorSection inspectorStack" data-testid="preview-board-inspector">
                <h3>{t.previewBoardTool}</h3>
                <p className="selectionHint">{t.previewBoardAssetCount(previewBoardAssets.length)}</p>
                <button type="button" onClick={() => setActiveTool('assetGroups')}>
                  {t.backToAssetGroups}
                </button>
                <button type="button" disabled={previewBoardAssets.length === 0} onClick={resetPreviewBoardLayout}>
                  <RotateCcw size={17} /> {t.previewBoardResetLayout}
                </button>
                {selectedPreviewBoardAsset ? (
                  <section className="inspectorSubsection inspectorStack">
                    <div className="readonlyFieldGroup">
                      <span className="readonlyFieldLabel">{t.assetId}</span>
                      <span className="readonlyFieldValue">{selectedPreviewBoardAsset.regionId}</span>
                    </div>
                    <div className="readonlyFieldGroup">
                      <span className="readonlyFieldLabel">{t.label}</span>
                      <span className="readonlyFieldValue">{selectedPreviewBoardAsset.label}</span>
                    </div>
                    <div className="readonlyFieldGroup">
                      <span className="readonlyFieldLabel">{t.sizeLabel}</span>
                      <span className="readonlyFieldValue">
                        {selectedPreviewBoardAsset.width} x {selectedPreviewBoardAsset.height}
                      </span>
                    </div>
                    <p className="selectionHint">
                      {selectedPreviewBoardAsset.groupName ?? t.ungrouped}
                    </p>
                  </section>
                ) : (
                  <p className="muted">{t.previewBoardSelectAsset}</p>
                )}
              </section>
            )}

            {activeTool === 'crop' && (
              <>
                <section className="inspectorSection inspectorStack cropActionSection" data-testid="crop-action-section">
                  <h3>{t.modeLabel}</h3>
                  <div className="modeActions segmentedActions">
                    <button type="button" disabled={!project || !sourceReady} onClick={handleAutoDetectRegions} data-testid="auto-detect-regions">
                      {t.autoDetect}
                    </button>
                    <button type="button" className="primaryButton activeMode" disabled={editingDisabled} onClick={addRegion}>
                      {t.crop}
                    </button>
                  </div>
                </section>

                {previewRegion ? (
                  <section className="inspectorSection inspectorStack cropObjectSection" data-testid="crop-object-section">
                    <div className="inspectorTitleRow">
                      <h3>{t.objectSection}</h3>
                      {!isWholeImageSelection && (
                        <button type="button" className="deleteCropButton" disabled={editingDisabled} onClick={deleteSelectedRegion}>
                          <Trash2 size={16} /> {t.deleteCropBox}
                        </button>
                      )}
                    </div>
                    {isWholeImageSelection && <p className="selectionHint">{t.wholeImageHint}</p>}
                    <div className="readonlyFieldGroup">
                      <span className="readonlyFieldLabel">{t.assetId}</span>
                      <span className="readonlyFieldValue" data-testid="resource-id-value">
                        {previewRegion.id}
                      </span>
                    </div>
                    <label>
                      {t.label}
                      <input
                        value={previewDisplayLabel ?? ''}
                        disabled={isWholeImageSelection || editingDisabled}
                        onChange={(event) => patchSelectedRegion({ label: event.target.value })}
                      />
                    </label>
                    {!isWholeImageSelection && (
                      <>
                        <NumberGrid
                          title={t.crop}
                          values={previewRegion.crop}
                          disabled={editingDisabled}
                          onChange={(crop) => patchSelectedRegion({ crop: { ...previewRegion.crop, ...crop } })}
                        />
                        <NumberGrid
                          title={t.padding}
                          values={previewRegion.padding}
                          disabled={editingDisabled}
                          onChange={(padding) => patchSelectedRegion({ padding: { ...previewRegion.padding, ...padding } })}
                        />
                      </>
                    )}
                    <div className="grid2">
                      <label>
                        {t.anchorX}
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={previewRegion.anchor.x}
                          disabled={isWholeImageSelection || editingDisabled}
                          onChange={(event) =>
                            patchSelectedRegion({ anchor: { ...previewRegion.anchor, x: Number(event.target.value) } })
                          }
                        />
                      </label>
                      <label>
                        {t.anchorY}
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={previewRegion.anchor.y}
                          disabled={isWholeImageSelection || editingDisabled}
                          onChange={(event) =>
                            patchSelectedRegion({ anchor: { ...previewRegion.anchor, y: Number(event.target.value) } })
                          }
                        />
                      </label>
                    </div>
                    <PreviewPane
                      previewUrl={previewUrl}
                      warnings={warnings}
                      t={t}
                      dimensions={previewDimensions}
                    />
                  </section>
                ) : (
                  <p className="muted">{t.selectOrAddRegion}</p>
                )}

              </>
            )}
          </div>
        </aside>
      </section>

      <footer className="statusbar">{status}</footer>

      {autoDetectConfirmOpen && (
        <div className="confirmDialogBackdrop" data-testid="auto-detect-confirmation">
          <section className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="auto-detect-confirm-title">
            <h2 id="auto-detect-confirm-title">{t.autoDetectReplaceTitle}</h2>
            <p>{t.autoDetectReplaceMessage}</p>
            <div className="confirmDialogActions">
              <button type="button" onClick={() => setAutoDetectConfirmOpen(false)}>
                {t.cancel}
              </button>
              <button type="button" className="primaryButton" onClick={confirmAutoDetectReplacement}>
                {t.autoDetectReplaceConfirm}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function NumberGrid<TValues extends Record<keyof TValues, number>>({
  disabled = false,
  title,
  values,
  onChange,
}: {
  disabled?: boolean;
  title: string;
  values: TValues;
  onChange: (patch: Partial<TValues>) => void;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="grid4">
        {(Object.entries(values) as Array<[Extract<keyof TValues, string>, number]>).map(([key, value]) => (
          <label key={key}>
            {key}
            <input
              type="number"
              value={value}
              disabled={disabled}
              onChange={(event) => onChange({ [key]: Number(event.target.value) } as Partial<TValues>)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ToolButton({
  active,
  disabled = false,
  hint,
  icon,
  label,
  testId,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  hint: string;
  icon: ReactNode;
  label: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? 'toolButton active' : 'toolButton'}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="toolIcon">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </button>
  );
}

function PreviewBoard({
  assets,
  backgroundStyle,
  emptyMessage,
  items,
  selectedRegionId,
  sourceSize,
  t,
  warnings,
  onBack,
  onItemMove,
  onResetLayout,
  onSelectRegion,
}: {
  assets: PreviewBoardAsset[];
  backgroundStyle?: CSSProperties;
  emptyMessage: string;
  items: PreviewBoardItem[];
  selectedRegionId: string | null;
  sourceSize: { width: number; height: number } | null;
  t: Translation;
  warnings: string[];
  onBack: () => void;
  onItemMove: (regionId: string, position: { x: number; y: number }) => void;
  onResetLayout: () => void;
  onSelectRegion: (regionId: string) => void;
}) {
  const [zoom, setZoom] = useState<PreviewZoom>(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 560 });
  const dragRef = useRef<{
    itemX: number;
    itemY: number;
    pointerId: number;
    regionId: string;
    startX: number;
    startY: number;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
    startX: number;
    startY: number;
  } | null>(null);
  const pendingZoomAnchorRef = useRef<{
    anchorX: number;
    anchorY: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const [draggingRegionId, setDraggingRegionId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const assetByRegionId = useMemo(() => new Map(assets.map((asset) => [asset.regionId, asset])), [assets]);
  const visibleItems = items
    .map((item) => {
      const asset = assetByRegionId.get(item.regionId);
      return asset ? { asset, item } : null;
    })
    .filter((entry): entry is { asset: PreviewBoardAsset; item: PreviewBoardItem } => Boolean(entry));
  const workspace = getPreviewBoardWorkspace({ sourceSize, viewportSize, zoom });
  const boardWidth = Math.max(
    workspace.width,
    ...visibleItems.map(({ asset, item }) => workspace.originX + (item.x + asset.width * item.scale + 96) * zoom),
  );
  const boardHeight = Math.max(
    workspace.height,
    ...visibleItems.map(({ asset, item }) => workspace.originY + (item.y + asset.height * item.scale + 96) * zoom),
  );
  const zoomLabel = `${Math.round(zoom * 100)}%`;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function updateViewportSize() {
      const rect = viewport?.getBoundingClientRect();
      if (!rect) return;
      setViewportSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(320, Math.round(rect.height)),
      });
    }

    updateViewportSize();
    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || assets.length === 0) return;
    viewport.scrollLeft = workspace.originX;
    viewport.scrollTop = workspace.originY;
  }, [assets, workspace.originX, workspace.originY]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const stage = viewport?.querySelector('.previewBoardStage');
      if (!(stage instanceof HTMLElement) || !viewport) return;
      const viewportRect = viewport.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      pendingZoomAnchorRef.current = {
        anchorX: (event.clientX - stageRect.left) / stageRect.width,
        anchorY: (event.clientY - stageRect.top) / stageRect.height,
        viewportX: event.clientX - viewportRect.left,
        viewportY: event.clientY - viewportRect.top,
      };
      setZoom((current) => {
        const nextZoom = getNextPreviewZoom(current, event.deltaY < 0 ? previewZoomWheelStep : -previewZoomWheelStep);
        if (nextZoom === current) {
          pendingZoomAnchorRef.current = null;
        }
        return nextZoom;
      });
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  useLayoutEffect(() => {
    const pendingAnchor = pendingZoomAnchorRef.current;
    const viewport = viewportRef.current;
    if (!pendingAnchor || !viewport) return;
    const stage = viewport.querySelector('.previewBoardStage');
    if (!(stage instanceof HTMLElement)) {
      pendingZoomAnchorRef.current = null;
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const nextScroll = getAnchoredPreviewScroll({
      anchorX: pendingAnchor.anchorX,
      anchorY: pendingAnchor.anchorY,
      imageHeight: stageRect.height,
      imageOffsetLeft: stageRect.left - viewportRect.left + viewport.scrollLeft,
      imageOffsetTop: stageRect.top - viewportRect.top + viewport.scrollTop,
      imageWidth: stageRect.width,
      viewportX: pendingAnchor.viewportX,
      viewportY: pendingAnchor.viewportY,
    });

    viewport.scrollLeft = nextScroll.left;
    viewport.scrollTop = nextScroll.top;
    pendingZoomAnchorRef.current = null;
  }, [zoom]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, item: PreviewBoardItem) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      itemX: item.x,
      itemY: item.y,
      pointerId: event.pointerId,
      regionId: item.regionId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDraggingRegionId(item.regionId);
    onSelectRegion(item.regionId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    onItemMove(drag.regionId, {
      x: drag.itemX + (event.clientX - drag.startX) / zoom,
      y: drag.itemY + (event.clientY - drag.startY) / zoom,
    });
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDraggingRegionId(null);
  }

  function handleViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.previewBoardItem')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      startX: event.clientX,
      startY: event.clientY,
    };
    setPanning(true);
  }

  function handleViewportPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
    event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
  }

  function finishViewportPan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panRef.current = null;
    setPanning(false);
  }

  return (
    <section className="previewBoardShell" data-testid="preview-board">
      <div className="previewBoardHeader">
        <div className="previewToolbar">
          <button type="button" onClick={onBack}>
            {t.backToAssetGroups}
          </button>
          <button type="button" disabled={assets.length === 0} onClick={onResetLayout}>
            <RotateCcw size={16} /> {t.previewBoardResetLayout}
          </button>
        </div>
        <PreviewZoomControls
          zoomLabel={zoomLabel}
          zoomLabelTestId="preview-board-zoom-label"
          zoomInLabel={t.previewZoomIn}
          zoomOutLabel={t.previewZoomOut}
          resetLabel={t.previewResetZoom}
          canZoomOut={zoom > previewZoomMin}
          canZoomIn={zoom < previewZoomMax}
          onZoomIn={() => setZoom((current) => getNextPreviewZoom(current, previewZoomButtonStep))}
          onZoomOut={() => setZoom((current) => getNextPreviewZoom(current, -previewZoomButtonStep))}
          onReset={() => setZoom(1)}
        />
      </div>
      <div
        ref={viewportRef}
        className={['previewBoardViewport', panning ? 'panning' : ''].filter(Boolean).join(' ')}
        style={backgroundStyle}
        onPointerCancel={finishViewportPan}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={finishViewportPan}
      >
        {visibleItems.length ? (
          <div className="previewBoardStage" style={{ width: boardWidth, height: boardHeight }}>
            {visibleItems.map(({ asset, item }) => {
              const width = asset.width * item.scale * zoom;
              const height = asset.height * item.scale * zoom;
              return (
                <button
                  key={asset.regionId}
                  type="button"
                  className={[
                    'previewBoardItem',
                    selectedRegionId === asset.regionId ? 'selected' : '',
                    draggingRegionId === asset.regionId ? 'dragging' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    height,
                    left: workspace.originX + item.x * zoom,
                    top: workspace.originY + item.y * zoom,
                    width,
                  }}
                  data-testid={`preview-board-item-${asset.regionId}`}
                  onClick={() => onSelectRegion(asset.regionId)}
                  onPointerCancel={finishDrag}
                  onPointerDown={(event) => handlePointerDown(event, item)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishDrag}
                >
                  <img src={asset.url} alt={asset.label} draggable={false} />
                  <span>{asset.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span className="previewBoardEmpty">{emptyMessage}</span>
        )}
      </div>
      {warnings.map((warning) => (
        <p className="warning" key={warning}>{warning}</p>
      ))}
    </section>
  );
}

function ParameterField({
  children,
  controlId,
  helpKey,
  label,
  openHelp,
  setOpenHelp,
  t,
}: {
  children: ReactNode;
  controlId: string;
  helpKey: keyof Translation['parameterHelp'];
  label: string;
  openHelp: keyof Translation['parameterHelp'] | null;
  setOpenHelp: (key: keyof Translation['parameterHelp'] | null) => void;
  t: Translation;
}) {
  const expanded = openHelp === helpKey;

  return (
    <div className="parameterField">
      <span className="parameterLabelRow">
        <label htmlFor={controlId}>{label}</label>
        <button
          type="button"
          className="parameterHelpButton"
          aria-expanded={expanded}
          aria-label="Parameter help"
          data-testid={`parameter-help-toggle-${helpKey}`}
          onClick={(event) => {
            event.preventDefault();
            setOpenHelp(expanded ? null : helpKey);
          }}
        >
          ?
        </button>
      </span>
      {children}
      {expanded && (
        <span className="parameterHelpText" data-testid={`parameter-help-${helpKey}`} role="tooltip">
          {t.parameterHelp[helpKey]}
        </span>
      )}
    </div>
  );
}

function getActiveToolLabel(activeTool: ActiveTool, t: Translation): string {
  if (activeTool === 'background') return t.backgroundWorkbench;
  if (activeTool === 'assetGroups') return t.assetGroupsTool;
  if (activeTool === 'previewBoard') return t.previewBoardTool;
  return t.cropWorkbench;
}

function getInspectorTitle(activeTool: ActiveTool, t: Translation): string {
  if (activeTool === 'background') return t.backgroundProperties;
  if (activeTool === 'assetGroups') return t.assetGroupsTool;
  if (activeTool === 'previewBoard') return t.previewBoardTool;
  return t.cropProperties;
}

function getCanvasViewLabel(view: CanvasView, t: Translation): string {
  if (view === 'original') return t.viewOriginal;
  if (view === 'alpha') return t.viewAlphaMask;
  if (view === 'edges') return t.viewEdges;
  return t.viewResult;
}

function getAppliedPreviewBackgroundColor(color: string): string {
  return hexColorPattern.test(color) ? color : defaultLargePreviewBackgroundColor;
}

function getPreviewBackgroundStyle(mode: PreviewBackgroundMode, color: string): CSSProperties | undefined {
  if (mode !== 'solid') return undefined;
  return {
    backgroundColor: getAppliedPreviewBackgroundColor(color),
    backgroundImage: 'none',
  };
}

function normalizePreviewBackgroundColorInput(value: string): string | null {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{0,6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function parseTagsInput(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

function getSourceImageData(image: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not create source canvas.');
  }
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function getProcessedSourceImageData(image: CanvasImageSource, project: CutterProject) {
  const sourceData = getSourceImageData(image, project.sourceRef.width, project.sourceRef.height);
  return processBackground(sourceData, project.background.settings, project.background.edits);
}

function getCanvasViewImageData(source: ImageData, processed: ImageData, view: CanvasView): ImageData {
  if (view === 'original') {
    return copyImageData(source);
  }
  if (view === 'alpha') {
    return createAlphaMask(processed);
  }
  if (view === 'edges') {
    return createEdgeHighlight(source, processed);
  }
  return copyImageData(processed);
}

async function createImageFromImageData(imageData: ImageData): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create canvas view.');
  }
  context.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }
      reject(new Error('Could not render canvas view.'));
    }, 'image/png');
  });
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not load canvas view.'));
    image.src = objectUrl;
  });
  return { image, objectUrl };
}

function createAlphaMask(source: ImageData): ImageData {
  const output = new ImageData(source.width, source.height);
  for (let offset = 0; offset < source.data.length; offset += 4) {
    const alpha = source.data[offset + 3];
    output.data.set([alpha, alpha, alpha, 255], offset);
  }
  return output;
}

function createEdgeHighlight(original: ImageData, processed: ImageData): ImageData {
  const output = copyImageData(original);
  for (let y = 1; y < processed.height - 1; y += 1) {
    for (let x = 1; x < processed.width - 1; x += 1) {
      const offset = (y * processed.width + x) * 4;
      const alpha = processed.data[offset + 3];
      const alphaDelta = Math.max(
        Math.abs(alpha - processed.data[offset - 1]),
        Math.abs(alpha - processed.data[offset + 7]),
        Math.abs(alpha - processed.data[offset - processed.width * 4 + 3]),
        Math.abs(alpha - processed.data[offset + processed.width * 4 + 3]),
      );
      if (alphaDelta > 48) {
        output.data.set([255, 48, 48, 255], offset);
      }
    }
  }
  return output;
}

function copyImageData(source: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
}

function getCanvasEmptyMessage(sourceConnection: 'none' | 'missing' | 'ready' | 'mismatch', t: Translation): string {
  if (sourceConnection === 'missing') {
    return t.reconnectSourceHint;
  }
  if (sourceConnection === 'mismatch') {
    return t.sourceMismatchHint;
  }
  return t.startStatus;
}


function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest('input, textarea, select'));
}

function PreviewBackgroundControls({
  mode,
  color,
  onModeChange,
  onColorChange,
  t,
  testIdPrefix,
}: {
  mode: PreviewBackgroundMode;
  color: string;
  onModeChange: (mode: PreviewBackgroundMode) => void;
  onColorChange: (color: string) => void;
  t: Translation;
  testIdPrefix: string;
}) {
  const appliedColor = getAppliedPreviewBackgroundColor(color);

  function handleTextColorChange(value: string) {
    const normalized = normalizePreviewBackgroundColorInput(value);
    if (normalized) {
      onColorChange(normalized);
    }
  }

  return (
    <div className="previewBackgroundControls" role="group" aria-label={t.previewBackgroundLabel}>
      <label className="previewBackgroundChoice">
        <input
          type="radio"
          name={`${testIdPrefix}-mode`}
          checked={mode === 'transparent'}
          data-testid={`${testIdPrefix}-transparent`}
          onChange={() => onModeChange('transparent')}
        />
        <span>{t.previewBackgroundTransparent}</span>
      </label>
      <label className="previewBackgroundChoice">
        <input
          type="radio"
          name={`${testIdPrefix}-mode`}
          checked={mode === 'solid'}
          data-testid={`${testIdPrefix}-solid`}
          onChange={() => onModeChange('solid')}
        />
        <span>{t.previewBackgroundSolid}</span>
      </label>
      {mode === 'solid' && (
        <div className="previewBackgroundColorControls">
          <input
            type="color"
            aria-label={t.previewBackgroundColor}
            data-testid={`${testIdPrefix}-color-picker`}
            value={appliedColor}
            onChange={(event) => onColorChange(event.target.value.toLowerCase())}
          />
          <input
            type="text"
            aria-label={t.previewBackgroundColorValue}
            data-testid={`${testIdPrefix}-color-text`}
            value={color}
            onChange={(event) => handleTextColorChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function PreviewPane({
  previewUrl,
  warnings,
  t,
  dimensions,
}: {
  previewUrl: string | null;
  warnings: string[];
  t: Translation;
  dimensions?: { width: number; height: number } | null;
}) {
  const [zoom, setZoom] = useState<PreviewZoom>(1);
  const [largePreviewOpen, setLargePreviewOpen] = useState(false);
  const [largePreviewBackgroundMode, setLargePreviewBackgroundMode] = useState<PreviewBackgroundMode>('transparent');
  const [largePreviewBackgroundColor, setLargePreviewBackgroundColor] = useState(defaultLargePreviewBackgroundColor);
  const [previewPanning, setPreviewPanning] = useState(false);
  const largePreviewViewportRef = useRef<HTMLDivElement>(null);
  const previewPanRef = useRef<{
    element: HTMLDivElement;
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
    x: number;
    y: number;
  } | null>(null);
  const pendingZoomAnchorRef = useRef<{
    anchorX: number;
    anchorY: number;
    element: HTMLDivElement;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const zoomed = zoom !== 1;
  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const previewImageStyle =
    dimensions
      ? {
          width: `${dimensions.width * zoom}px`,
          height: `${dimensions.height * zoom}px`,
        }
      : undefined;
  const largePreviewViewportStyle = getPreviewBackgroundStyle(largePreviewBackgroundMode, largePreviewBackgroundColor);

  useEffect(() => {
    if (!previewUrl) {
      setLargePreviewOpen(false);
      setZoom(1);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!largePreviewOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLargePreviewOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [largePreviewOpen]);

  useEffect(() => {
    if (!largePreviewOpen) return;
    const element = largePreviewViewportRef.current;
    if (!element) return;
    const viewportElement = element;

    function handleWheel(event: WheelEvent) {
      handleLargePreviewWheel(event, viewportElement);
    }

    viewportElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewportElement.removeEventListener('wheel', handleWheel);
  }, [largePreviewOpen]);

  useLayoutEffect(() => {
    const pendingAnchor = pendingZoomAnchorRef.current;
    if (!pendingAnchor) return;

    const image = pendingAnchor.element.querySelector('img');
    if (!(image instanceof HTMLElement)) {
      pendingZoomAnchorRef.current = null;
      return;
    }

    const viewportRect = pendingAnchor.element.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const nextScroll = getAnchoredPreviewScroll({
      anchorX: pendingAnchor.anchorX,
      anchorY: pendingAnchor.anchorY,
      imageHeight: imageRect.height,
      imageOffsetLeft: imageRect.left - viewportRect.left + pendingAnchor.element.scrollLeft,
      imageOffsetTop: imageRect.top - viewportRect.top + pendingAnchor.element.scrollTop,
      imageWidth: imageRect.width,
      viewportX: pendingAnchor.viewportX,
      viewportY: pendingAnchor.viewportY,
    });

    pendingAnchor.element.scrollLeft = nextScroll.left;
    pendingAnchor.element.scrollTop = nextScroll.top;
    pendingZoomAnchorRef.current = null;
  }, [zoom]);

  function zoomIn(step = previewZoomButtonStep) {
    setZoom((current) => getNextPreviewZoom(current, step));
  }

  function zoomOut(step = previewZoomButtonStep) {
    setZoom((current) => getNextPreviewZoom(current, -step));
  }

  function handleLargePreviewWheel(event: WheelEvent, element: HTMLDivElement) {
    event.preventDefault();
    event.stopPropagation();
    scheduleAnchoredZoom(element, event.clientX, event.clientY, event.deltaY < 0 ? previewZoomWheelStep : -previewZoomWheelStep);
  }

  function scheduleAnchoredZoom(element: HTMLDivElement, clientX: number, clientY: number, step: number) {
    const image = element.querySelector('img');
    if (image instanceof HTMLElement) {
      const viewportRect = element.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      pendingZoomAnchorRef.current = {
        anchorX: (clientX - imageRect.left) / imageRect.width,
        anchorY: (clientY - imageRect.top) / imageRect.height,
        element,
        viewportX: clientX - viewportRect.left,
        viewportY: clientY - viewportRect.top,
      };
    }

    setZoom((current) => {
      const nextZoom = getNextPreviewZoom(current, step);
      if (nextZoom === current) {
        pendingZoomAnchorRef.current = null;
      }
      return nextZoom;
    });
  }

  function handlePreviewPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!zoomed || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewPanRef.current = {
      element: event.currentTarget,
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
    setPreviewPanning(true);
  }

  function handlePreviewPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = previewPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    pan.element.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    pan.element.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  }

  function finishPreviewPan(event: PointerEvent<HTMLDivElement>) {
    const pan = previewPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    previewPanRef.current = null;
    setPreviewPanning(false);
  }

  function toggleQuickZoom() {
    if (!previewUrl) return;
    setZoom((current) => (current === 1 ? 2 : 1));
  }

  const imageContent = previewUrl ? (
    <img
      src={previewUrl}
      alt={t.previewAlt}
      data-testid="preview-image"
      style={previewImageStyle}
    />
  ) : (
    <span>{t.noPreview}</span>
  );

  return (
    <section className="previewPane">
      <div className="previewHeader">
        <div className="previewTitleLine">
          <h3>{t.preview}</h3>
          {dimensions && <span>{dimensions.width} x {dimensions.height}</span>}
        </div>
        {previewUrl && (
          <div className="previewToolbar">
            <PreviewZoomControls
              zoomLabel={zoomLabel}
              zoomLabelTestId="preview-zoom-label"
              zoomInLabel={t.previewZoomIn}
              zoomOutLabel={t.previewZoomOut}
              resetLabel={t.previewResetZoom}
              canZoomOut={zoom > previewZoomMin}
              canZoomIn={zoom < previewZoomMax}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={() => setZoom(1)}
            />
            <button
              type="button"
              className="iconButton"
              aria-label={t.previewOpenLarge}
              title={t.previewOpenLarge}
              onClick={() => setLargePreviewOpen(true)}
            >
              <Maximize2 size={16} />
            </button>
          </div>
        )}
      </div>
      <div
        className={[
          'previewBackground',
          zoomed ? 'previewBackgroundZoomed' : '',
          previewPanning ? 'previewPanning' : '',
        ].filter(Boolean).join(' ')}
        data-testid="preview-viewport"
        onDoubleClick={toggleQuickZoom}
        onPointerCancel={finishPreviewPan}
        onPointerDown={handlePreviewPointerDown}
        onPointerMove={handlePreviewPointerMove}
        onPointerUp={finishPreviewPan}
      >
        <div className="previewImageFrame">
          {imageContent}
        </div>
      </div>
      {warnings.map((warning) => (
        <p className="warning" key={warning}>{warning}</p>
      ))}
      {largePreviewOpen && previewUrl && (
        <div
          className="previewDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLargePreviewOpen(false);
            }
          }}
        >
          <section className="previewDialog" role="dialog" aria-modal="true" aria-label={t.previewLargeTitle}>
            <div className="previewDialogHeader">
              <div className="previewTitleLine">
                <h3>{t.previewLargeTitle}</h3>
                {dimensions && <span>{dimensions.width} x {dimensions.height}</span>}
              </div>
              <div className="previewToolbar">
                <PreviewBackgroundControls
                  mode={largePreviewBackgroundMode}
                  color={largePreviewBackgroundColor}
                  onModeChange={setLargePreviewBackgroundMode}
                  onColorChange={setLargePreviewBackgroundColor}
                  t={t}
                  testIdPrefix="large-preview-background"
                />
                <PreviewZoomControls
                  zoomLabel={zoomLabel}
                  zoomLabelTestId="large-preview-zoom-label"
                  zoomInLabel={t.previewZoomLargeIn}
                  zoomOutLabel={t.previewZoomLargeOut}
                  resetLabel={t.previewResetZoom}
                  canZoomOut={zoom > previewZoomMin}
                  canZoomIn={zoom < previewZoomMax}
                  onZoomIn={zoomIn}
                  onZoomOut={zoomOut}
                  onReset={() => setZoom(1)}
                />
                <button
                  type="button"
                  className="iconButton"
                  aria-label={t.previewCloseLarge}
                  title={t.previewCloseLarge}
                  onClick={() => setLargePreviewOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
            </div>
            <div
              ref={largePreviewViewportRef}
              className={[
                'largePreviewViewport',
                zoomed ? 'largePreviewViewportZoomed' : '',
                previewPanning ? 'previewPanning' : '',
              ].filter(Boolean).join(' ')}
              data-testid="large-preview-viewport"
              style={largePreviewViewportStyle}
              onDoubleClick={toggleQuickZoom}
              onPointerCancel={finishPreviewPan}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={finishPreviewPan}
            >
              <div className="largePreviewFrame">
                <img
                  src={previewUrl}
                  alt={t.previewAlt}
                  data-testid="large-preview-image"
                  style={previewImageStyle}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PreviewZoomControls({
  zoomLabel,
  zoomLabelTestId,
  zoomInLabel,
  zoomOutLabel,
  resetLabel,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoomLabel: string;
  zoomLabelTestId: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  resetLabel: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="previewZoomControls">
      <button
        type="button"
        className="iconButton"
        aria-label={zoomOutLabel}
        title={zoomOutLabel}
        disabled={!canZoomOut}
        onClick={() => onZoomOut()}
      >
        <ZoomOut size={16} />
      </button>
      <span className="previewZoomLabel" data-testid={zoomLabelTestId}>{zoomLabel}</span>
      <button
        type="button"
        className="iconButton"
        aria-label={zoomInLabel}
        title={zoomInLabel}
        disabled={!canZoomIn}
        onClick={() => onZoomIn()}
      >
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        className="iconButton"
        aria-label={resetLabel}
        title={resetLabel}
        disabled={!canZoomOut}
        onClick={() => onReset()}
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
