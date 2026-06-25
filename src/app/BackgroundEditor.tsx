import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Check, X } from 'lucide-react';
import { processBackground } from '../canvas/backgroundProcessing';
import type { BackgroundEdit, BackgroundSettings } from '../model/project';
import type { Translation } from '../i18n/translations';
import { BufferedNumberInput } from './BufferedNumberInput';
import { getAnchoredPreviewScroll } from './previewZoom';

type BackgroundEditorView = 'result' | 'original' | 'alpha' | 'edges';

interface BackgroundEditorProps {
  sourceData: ImageData;
  settings: BackgroundSettings;
  edits: BackgroundEdit[];
  t: Translation;
  layout?: 'dialog' | 'workbench';
  onApply: (settings: BackgroundSettings) => void;
  onCancel: () => void;
}

export function BackgroundEditor({
  sourceData,
  settings,
  edits,
  t,
  layout = 'dialog',
  onApply,
  onCancel,
}: BackgroundEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
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
  const [draft, setDraft] = useState<BackgroundSettings>(settings);
  const [view, setView] = useState<BackgroundEditorView>('result');
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const processed = useMemo(() => processBackground(sourceData, draft, edits), [draft, edits, sourceData]);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const imageData = getViewImageData(sourceData, processed.imageData, view);
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    context.putImageData(imageData, 0, 0);
  }, [processed.imageData, sourceData, view]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportElement = viewport;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      scheduleAnchoredZoom(viewportElement, event.clientX, event.clientY, event.deltaY < 0 ? 0.25 : -0.25);
    }

    viewportElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewportElement.removeEventListener('wheel', handleWheel);
  }, []);

  useLayoutEffect(() => {
    const pendingAnchor = pendingZoomAnchorRef.current;
    const canvas = canvasRef.current;
    if (!pendingAnchor || !canvas) return;

    const viewportRect = pendingAnchor.element.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const nextScroll = getAnchoredPreviewScroll({
      anchorX: pendingAnchor.anchorX,
      anchorY: pendingAnchor.anchorY,
      imageHeight: canvasRect.height,
      imageOffsetLeft: canvasRect.left - viewportRect.left + pendingAnchor.element.scrollLeft,
      imageOffsetTop: canvasRect.top - viewportRect.top + pendingAnchor.element.scrollTop,
      imageWidth: canvasRect.width,
      viewportX: pendingAnchor.viewportX,
      viewportY: pendingAnchor.viewportY,
    });

    pendingAnchor.element.scrollLeft = nextScroll.left;
    pendingAnchor.element.scrollTop = nextScroll.top;
    pendingZoomAnchorRef.current = null;
  }, [zoom]);

  function patchDraft(patch: Partial<BackgroundSettings>) {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  function scheduleAnchoredZoom(element: HTMLDivElement, clientX: number, clientY: number, step: number) {
    const canvas = canvasRef.current;
    if (canvas) {
      const viewportRect = element.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      pendingZoomAnchorRef.current = {
        anchorX: (clientX - canvasRect.left) / canvasRect.width,
        anchorY: (clientY - canvasRect.top) / canvasRect.height,
        element,
        viewportX: clientX - viewportRect.left,
        viewportY: clientY - viewportRect.top,
      };
    }

    setZoom((current) => {
      const nextZoom = clampEditorZoom(current + step);
      if (nextZoom === current) {
        pendingZoomAnchorRef.current = null;
      }
      return nextZoom;
    });
  }

  function handleViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      element: event.currentTarget,
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
    setPanning(true);
  }

  function handleViewportPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    pan.element.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    pan.element.scrollTop = pan.scrollTop - (event.clientY - pan.y);
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

  const editor = (
      <section
        className={layout === 'workbench' ? 'backgroundEditorDialog backgroundEditorWorkbench' : 'backgroundEditorDialog'}
        role={layout === 'dialog' ? 'dialog' : undefined}
        aria-modal={layout === 'dialog' ? true : undefined}
        aria-label={t.backgroundEditorTitle}
        data-testid={layout === 'workbench' ? 'background-editor-workbench' : undefined}
      >
        <header className="backgroundEditorHeader">
          <div>
            <h2>{t.backgroundEditorTitle}</h2>
            <p>{processed.stats.clearedPixelCount ? t.backgroundClearedPixels(processed.stats.clearedPixelCount) : t.backgroundNoPixelsCleared}</p>
          </div>
          <button type="button" className="iconButton" aria-label={t.cancel} title={t.cancel} onClick={onCancel}>
            <X size={17} />
          </button>
        </header>

        <div className="backgroundEditorBody">
          <div className="backgroundEditorCanvasColumn">
            <div className="backgroundEditorViewTabs" role="radiogroup" aria-label={t.backgroundViewMode}>
              <ViewButton active={view === 'result'} testId="background-editor-view-result" onClick={() => setView('result')}>
                {t.viewResult}
              </ViewButton>
              <ViewButton active={view === 'original'} testId="background-editor-view-original" onClick={() => setView('original')}>
                {t.viewOriginal}
              </ViewButton>
              <ViewButton active={view === 'alpha'} testId="background-editor-view-alpha" onClick={() => setView('alpha')}>
                {t.viewAlphaMask}
              </ViewButton>
              <ViewButton active={view === 'edges'} testId="background-editor-view-edges" onClick={() => setView('edges')}>
                {t.viewEdges}
              </ViewButton>
            </div>
            <div
              ref={viewportRef}
              className={panning ? 'backgroundEditorViewport backgroundEditorViewportPanning' : 'backgroundEditorViewport'}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={finishViewportPan}
              onPointerCancel={finishViewportPan}
              onLostPointerCapture={() => {
                panRef.current = null;
                setPanning(false);
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: `${sourceData.width * zoom}px`,
                  height: `${sourceData.height * zoom}px`,
                }}
              />
            </div>
          </div>

          <aside className="backgroundEditorControls">
            <label>
              {t.keyColor}
              <input type="color" value={draft.chromaKey} onChange={(event) => patchDraft({ chromaKey: event.target.value })} />
            </label>
            <label>
              {t.tolerance}
              <BufferedNumberInput
                min={0}
                max={255}
                value={draft.tolerance}
                onCommit={(value) => patchDraft({ tolerance: value })}
              />
            </label>
            <label>
              {t.softEdge}
              <input
                type="range"
                min={0}
                max={128}
                value={draft.softEdge}
                onChange={(event) => patchDraft({ softEdge: Number(event.target.value) })}
              />
            </label>
            <label>
              {t.edgeGrow}
              <BufferedNumberInput
                min={-16}
                max={16}
                value={draft.edgeGrow}
                onCommit={(value) => patchDraft({ edgeGrow: value })}
              />
            </label>
            <label>
              {t.edgeSmoothing}
              <input
                type="range"
                min={0}
                max={100}
                value={draft.edgeSmoothing}
                onChange={(event) => patchDraft({ edgeSmoothing: Number(event.target.value) })}
              />
            </label>
            <label>
              {t.spillRemoval}
              <input
                type="range"
                min={0}
                max={100}
                value={draft.spillRemoval}
                onChange={(event) => patchDraft({ spillRemoval: Number(event.target.value) })}
              />
            </label>
            <label>
              {t.previewZoomLabel}
              <input
                type="range"
                min={0.25}
                max={4}
                step={0.25}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <div className="modeActions">
              <button type="button" onClick={onCancel}>
                <X size={17} /> {t.cancel}
              </button>
              <button type="button" className="primaryButton" onClick={() => onApply(draft)}>
                <Check size={17} /> {t.apply}
              </button>
            </div>
          </aside>
        </div>
      </section>
  );

  if (layout === 'workbench') {
    return editor;
  }

  return (
    <div className="previewDialogBackdrop" role="presentation">
      {editor}
    </div>
  );
}

function ViewButton({
  active,
  children,
  onClick,
  testId,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={active ? 'primaryButton activeMode' : ''}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getViewImageData(source: ImageData, processed: ImageData, view: BackgroundEditorView): ImageData {
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

function clampEditorZoom(value: number): number {
  return Math.min(4, Math.max(0.25, Math.round(value * 100) / 100));
}
