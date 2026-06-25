import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva';
import Konva from 'konva';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { normalizeRegionCrop, type AssetRegion, type SourceImageMeta } from '../model/project';
import { calculateInitialViewport, shouldCommitStageDrag, type CanvasSize } from './CanvasViewport';
import { getRegionShapeStyle, regionTransformerConfig } from './transformerConfig';

interface AssetCanvasProps {
  image: HTMLImageElement | null;
  source: SourceImageMeta | null;
  regions: AssetRegion[];
  selectedRegionId: string | null;
  emptyMessage: string;
  backgroundStyle?: CSSProperties;
  pointPickEnabled?: boolean;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomResetLabel: string;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegion: (region: AssetRegion) => void;
  onImagePointClick?: (point: { x: number; y: number }) => void;
}

const fallbackStageSize: CanvasSize = { width: 860, height: 640 };
const canvasZoomButtonStep = 1.25;
const canvasZoomWheelStep = 1.08;
const canvasZoomMin = 0.05;
const canvasZoomMax = 8;
const canvasCursor = 'pointer';
const canvasPanningCursor = 'grabbing';
const canvasPointPickCursor = 'crosshair';
type RegionDragPositionMap = Record<string, { x: number; y: number }>;

export function AssetCanvas({
  image,
  source,
  regions,
  selectedRegionId,
  emptyMessage,
  backgroundStyle,
  pointPickEnabled = false,
  zoomInLabel,
  zoomOutLabel,
  zoomResetLabel,
  onSelectRegion,
  onUpdateRegion,
  onImagePointClick,
}: AssetCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const selectedRectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState<CanvasSize>(fallbackStageSize);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingRegionPositions, setDraggingRegionPositions] = useState<RegionDragPositionMap>({});

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  );
  const sourceViewportKey = source
    ? `${source.fileName}:${source.width}x${source.height}:${source.hasAlpha ? 'alpha' : 'opaque'}`
    : null;
  const zoomLabel = `${Math.round(scale * 100)}%`;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    function updateSize() {
      const rect = shell?.getBoundingClientRect();
      if (!rect) return;
      setStageSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      });
    }

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(shell);
    return () => resizeObserver.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (source) {
      const nextViewport = calculateInitialViewport({
        source,
        viewport: stageSize,
        margin: 24,
      });
      setScale(nextViewport.scale);
      setPosition(nextViewport.position);
    }
  }, [sourceViewportKey]);

  useLayoutEffect(() => {
    if (selectedRectRef.current && transformerRef.current) {
      transformerRef.current.nodes([selectedRectRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedRegion]);

  useLayoutEffect(() => {
    const container = stageRef.current?.container();
    const shell = shellRef.current;
    if (!container || !shell) return;
    const cursor = pointPickEnabled ? canvasPointPickCursor : isPanning ? canvasPanningCursor : canvasCursor;
    shell.style.cursor = cursor;
    container.style.cursor = cursor;
    shell.querySelectorAll<HTMLElement>('.konvajs-content, canvas').forEach((element) => {
      element.style.cursor = cursor;
    });
  }, [isPanning, pointPickEnabled, stageSize]);

  useLayoutEffect(() => {
    return () => {
      clearGlobalCanvasCursor();
    };
  }, []);

  function setGlobalCanvasCursor(cursor: typeof canvasCursor | typeof canvasPanningCursor | typeof canvasPointPickCursor) {
    document.documentElement.style.cursor = cursor;
    document.body.style.cursor = cursor;
  }

  function clearGlobalCanvasCursor() {
    if (
      document.documentElement.style.cursor === canvasCursor ||
      document.documentElement.style.cursor === canvasPanningCursor ||
      document.documentElement.style.cursor === canvasPointPickCursor
    ) {
      document.documentElement.style.cursor = '';
    }
    if (
      document.body.style.cursor === canvasCursor ||
      document.body.style.cursor === canvasPanningCursor ||
      document.body.style.cursor === canvasPointPickCursor
    ) {
      document.body.style.cursor = '';
    }
  }

  function zoomAtPoint(nextScale: number, point: { x: number; y: number }) {
    const oldScale = scale;
    const clampedScale = Math.min(canvasZoomMax, Math.max(canvasZoomMin, nextScale));
    const mousePointTo = {
      x: (point.x - position.x) / oldScale,
      y: (point.y - position.y) / oldScale,
    };

    setScale(clampedScale);
    setPosition({
      x: point.x - mousePointTo.x * clampedScale,
      y: point.y - mousePointTo.y * clampedScale,
    });
  }

  function zoomFromCenter(multiplier: number) {
    zoomAtPoint(scale * multiplier, {
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    });
  }

  function resetZoom() {
    if (!source) {
      setScale(1);
      setPosition({ x: 24, y: 24 });
      return;
    }
    const nextViewport = calculateInitialViewport({
      source,
      viewport: stageSize,
      margin: 24,
    });
    setScale(nextViewport.scale);
    setPosition(nextViewport.position);
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const nextScale = event.evt.deltaY > 0 ? scale / canvasZoomWheelStep : scale * canvasZoomWheelStep;
    zoomAtPoint(nextScale, pointer);
  }

  function getImagePointFromStage(): { x: number; y: number } | null {
    if (!source) return null;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    const x = Math.round((pointer.x - position.x) / scale);
    const y = Math.round((pointer.y - position.y) / scale);
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return null;
    return { x, y };
  }

  function handlePointPick() {
    const point = getImagePointFromStage();
    if (!point) return;
    onImagePointClick?.(point);
  }

  function updateSelectedFromNode(node: Konva.Rect, region: AssetRegion) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    onUpdateRegion(
      normalizeRegionCrop({
        ...region,
        crop: {
          x: node.x(),
          y: node.y(),
          width: Math.max(4, node.width() * scaleX),
          height: Math.max(4, node.height() * scaleY),
        },
      }),
    );
  }

  function updateDraggingRegionPosition(regionId: string, node: Konva.Rect) {
    setDraggingRegionPositions((current) => ({
      ...current,
      [regionId]: {
        x: node.x(),
        y: node.y(),
      },
    }));
  }

  function clearDraggingRegionPosition(regionId: string) {
    setDraggingRegionPositions((current) => {
      if (!current[regionId]) return current;
      const next = { ...current };
      delete next[regionId];
      return next;
    });
  }

  return (
    <div
      ref={shellRef}
      className={isPanning ? 'canvasShell panning' : 'canvasShell'}
      data-testid="asset-canvas"
      style={backgroundStyle}
      onPointerEnter={() => setGlobalCanvasCursor(pointPickEnabled ? canvasPointPickCursor : isPanning ? canvasPanningCursor : canvasCursor)}
      onPointerDown={(event) => {
        if (pointPickEnabled) return;
        const target = event.target;
        if (target instanceof Element && target.closest('button')) return;
        setIsPanning(true);
        setGlobalCanvasCursor(canvasPanningCursor);
      }}
      onPointerUp={() => {
        setIsPanning(false);
        setGlobalCanvasCursor(canvasCursor);
      }}
      onPointerCancel={() => {
        setIsPanning(false);
        clearGlobalCanvasCursor();
      }}
      onPointerLeave={() => {
        setIsPanning(false);
        clearGlobalCanvasCursor();
      }}
    >
      {image && (
        <div className="canvasZoomControls" aria-label="Canvas zoom controls">
          <button
            type="button"
            aria-label={zoomOutLabel}
            title={zoomOutLabel}
            disabled={scale <= canvasZoomMin}
            onClick={() => zoomFromCenter(1 / canvasZoomButtonStep)}
          >
            <ZoomOut size={15} />
          </button>
          <span data-testid="canvas-zoom-label">{zoomLabel}</span>
          <button
            type="button"
            aria-label={zoomResetLabel}
            title={zoomResetLabel}
            disabled={scale === 1}
            onClick={resetZoom}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            aria-label={zoomInLabel}
            title={zoomInLabel}
            disabled={scale >= canvasZoomMax}
            onClick={() => zoomFromCenter(canvasZoomButtonStep)}
          >
            <ZoomIn size={15} />
          </button>
        </div>
      )}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable={!pointPickEnabled}
        x={position.x}
        y={position.y}
        scaleX={scale}
        scaleY={scale}
        onDragEnd={(event) => {
          const stage = stageRef.current;
          if (shouldCommitStageDrag(stage, event.target)) {
            setPosition({ x: event.target.x(), y: event.target.y() });
          }
          setIsPanning(false);
          setGlobalCanvasCursor(canvasCursor);
        }}
        onDragMove={(event) => {
          const stage = stageRef.current;
          if (shouldCommitStageDrag(stage, event.target)) {
            setPosition({ x: event.target.x(), y: event.target.y() });
          }
        }}
        onWheel={handleWheel}
        onMouseDown={(event) => {
          if (pointPickEnabled) {
            event.cancelBubble = true;
            handlePointPick();
            return;
          }
          setIsPanning(true);
          setGlobalCanvasCursor(canvasPanningCursor);
          if (event.target === event.target.getStage()) {
            onSelectRegion(null);
          }
        }}
        onMouseUp={() => {
          setIsPanning(false);
          setGlobalCanvasCursor(canvasCursor);
        }}
        onMouseLeave={() => {
          setIsPanning(false);
          clearGlobalCanvasCursor();
        }}
        onTouchStart={() => {
          if (pointPickEnabled) {
            handlePointPick();
            return;
          }
          setIsPanning(true);
          setGlobalCanvasCursor(canvasPanningCursor);
        }}
        onTouchEnd={() => {
          setIsPanning(false);
          setGlobalCanvasCursor(canvasCursor);
        }}
      >
        <Layer>
          {image && <KonvaImage image={image} width={source?.width} height={source?.height} listening={false} />}
          {regions.map((region) => {
            const selected = region.id === selectedRegionId;
            const shapeStyle = getRegionShapeStyle({ selected, scale });
            const dragPosition = draggingRegionPositions[region.id];
            return (
              <Rect
                key={region.id}
                ref={selected ? selectedRectRef : undefined}
                x={dragPosition?.x ?? region.crop.x}
                y={dragPosition?.y ?? region.crop.y}
                width={region.crop.width}
                height={region.crop.height}
                draggable
                fill={shapeStyle.fill}
                stroke={shapeStyle.stroke}
                strokeEnabled={shapeStyle.strokeEnabled}
                strokeWidth={shapeStyle.strokeWidth}
                strokeScaleEnabled={shapeStyle.strokeScaleEnabled}
                dash={shapeStyle.dash}
                listening={!pointPickEnabled}
                onClick={() => onSelectRegion(region.id)}
                onTap={() => onSelectRegion(region.id)}
                onDragMove={(event) => updateDraggingRegionPosition(region.id, event.target as Konva.Rect)}
                onDragEnd={(event) => {
                  updateSelectedFromNode(event.target as Konva.Rect, region);
                  clearDraggingRegionPosition(region.id);
                }}
                onTransformEnd={(event) => updateSelectedFromNode(event.target as Konva.Rect, region)}
              />
            );
          })}
          {selectedRegion && (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              keepRatio={regionTransformerConfig.keepRatio}
              shiftBehavior={regionTransformerConfig.shiftBehavior}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 4 || newBox.height < 4) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>
      {image && (
        <div className="canvasRegionLabels" aria-hidden="true">
          {regions.map((region) => {
            const dragPosition = draggingRegionPositions[region.id];
            const labelX = dragPosition?.x ?? region.crop.x;
            const labelY = dragPosition?.y ?? region.crop.y;
            return (
              <span
                key={region.id}
                className={region.id === selectedRegionId ? 'canvasRegionIdBadge selected' : 'canvasRegionIdBadge'}
                data-testid={`canvas-region-id-${region.id}`}
                style={{
                  left: `${position.x + labelX * scale}px`,
                  top: `${position.y + labelY * scale}px`,
                }}
              >
                {region.id}
              </span>
            );
          })}
        </div>
      )}
      {!image && <div className="canvasEmpty">{emptyMessage}</div>}
    </div>
  );
}
