# Asset Cutter MVP Technical Plan

> Status: product reference for the standalone tool
> Date: 2026-06-22

## Goal

Build a standalone local web app that lets users import an AI-generated source image, draw multiple crop regions, inspect export settings, and export individual PNG files plus project metadata.

The MVP should produce general PNG assets first. Framework-specific outputs such as PixiJS, Phaser, CSS sprites, Godot, Cocos, or Arcadity presets can be added after the core cutting workflow is stable.

## Recommended Stack

- Vite
- React
- TypeScript
- Konva through `react-konva`
- JSZip for batch export
- FileSaver or browser download APIs for downloads
- Zustand or plain React state for MVP state management
- Vitest for unit tests
- Playwright for browser smoke tests

Rationale:

- Vite keeps the standalone tool simple and fast.
- React is a good fit for panels, lists, inspectors, and export controls.
- Konva is a mature canvas interaction layer for draggable and resizable shapes.
- Canvas APIs are enough for crop, alpha inspection, and PNG export.
- The app can stay fully local with no backend.

## Project Structure

Suggested standalone repository layout:

```text
gpt-asset-cutter/
  package.json
  vite.config.ts
  index.html
  src/
    main.tsx
    app/
      App.tsx
      App.css
    canvas/
      AssetCanvas.tsx
      CanvasViewport.ts
      RegionShape.tsx
      cropExport.ts
      imageAnalysis.ts
      chromaKey.ts
    model/
      project.ts
      region.ts
      manifest.ts
    panels/
      ImportPanel.tsx
      RegionList.tsx
      RegionInspector.tsx
      ExportPanel.tsx
      PreviewPanel.tsx
    state/
      projectStore.ts
    io/
      loadImageFile.ts
      saveProject.ts
      exportZip.ts
    tests/
      cropExport.test.ts
      chromaKey.test.ts
      manifest.test.ts
  docs/
    prd.md
    asset-format.md
    export-presets.md
```

## Core Data Types

```ts
export type BackgroundMode = 'source' | 'alpha' | 'chromaKey';

export interface SourceImageMeta {
  fileName: string;
  width: number;
  height: number;
  hasAlpha: boolean;
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
  version: 1;
  source: SourceImageMeta;
  settings: {
    backgroundMode: BackgroundMode;
    chromaKey: string;
    tolerance: number;
  };
  regions: AssetRegion[];
}
```

## UI Layout

MVP layout:

- Top toolbar:
  - Import image
  - Save project
  - Load project
  - Export selected
  - Export all
- Center:
  - Pan-and-zoom canvas
  - Source image
  - Crop rectangles
- Left panel:
  - Region list
  - Add region
  - Duplicate region
  - Delete region
- Right panel:
  - Region inspector
  - Asset id
  - Crop values
  - Padding
  - Background mode
  - Chroma-key color and tolerance
  - Export size
  - Anchor
- Bottom or side preview:
  - Selected export preview
  - Edge/alpha warning messages

## MVP Workflow

1. User imports an image file.
2. App decodes it into an `HTMLImageElement`.
3. App analyzes whether alpha exists.
4. App displays the image on a Konva stage.
5. User creates crop regions.
6. User selects a region and edits metadata.
7. App renders a preview of the selected region through an offscreen canvas.
8. User exports selected or all enabled regions.
9. App generates PNG blobs through canvas.
10. App downloads either one PNG or a ZIP containing PNG files plus JSON metadata.

## Image Import

Implementation notes:

- Use `URL.createObjectURL(file)` for local preview.
- Decode with `createImageBitmap(file)` where available, or `HTMLImageElement` fallback.
- Store the image object separately from serializable project JSON.
- Read image dimensions from the decoded image.
- Analyze alpha by sampling image data from a canvas.

Alpha detection:

- Draw the source image to an offscreen canvas.
- Read `ImageData`.
- If any pixel alpha is below 255, set `hasAlpha: true`.
- For large images, sample every N pixels for performance, then run a full check only if needed.

## Canvas Interaction

Use Konva for:

- Image display.
- Stage pan and zoom.
- Region rectangles.
- Selection outline.
- Resize handles through `Transformer`.

Rules:

- Region coordinates must be stored in source-image pixel space, not screen space.
- Stage zoom and pan should never change region source coordinates.
- Minimum region size should be enforced, for example 4x4 px.
- Rectangle movement should clamp inside source image bounds.

## Crop Export

Export pipeline:

1. Resolve region crop in source coordinates.
2. Create an offscreen canvas sized to crop plus padding.
3. Draw the source image crop into the canvas with padding offset.
4. Apply background processing only on the exported canvas copy.
5. Resize to `exportSize` if specified.
6. Convert to PNG blob with `canvas.toBlob`.

Background modes:

- `source`: preserve source pixels exactly.
- `alpha`: preserve existing alpha. If source has no alpha, this is equivalent to `source` and should show a warning.
- `chromaKey`: remove pixels close to the selected key color during export preview and export.

Chroma-key rule:

- Chroma key must never run automatically on import.
- It runs only for preview and export.
- The source image remains unchanged.
- If too many non-border pixels become transparent, show a warning that the tolerance may be damaging the subject.

## Project Save And Load

Project JSON should contain:

- Source metadata.
- Global settings.
- Region list.
- Export metadata.

Project JSON should not embed the image by default in MVP. On load:

1. User imports the image.
2. User loads the project JSON.
3. Tool checks dimensions and warns if source dimensions differ.
4. Tool restores regions.

Future option:

- Add a `.gac` archive format containing source image plus project JSON.

## Manifest Export

Batch export should include:

```json
{
  "version": 1,
  "assets": [
    {
      "id": "fruit.apple",
      "file": "fruit.apple.png",
      "width": 256,
      "height": 256,
      "anchor": { "x": 0.5, "y": 0.5 },
      "tags": ["sprite", "fruit"]
    }
  ]
}
```

Keep this manifest generic. Framework presets can transform this generic manifest later.

## Testing Plan

Unit tests:

- `cropExport` exports the expected output dimensions.
- `cropExport` respects padding.
- `cropExport` preserves source pixels in `source` mode.
- `chromaKey` removes only pixels within tolerance.
- `manifest` sanitizes filenames deterministically.
- Project JSON round-trips without losing region data.

Browser smoke tests:

- Import a fixture PNG.
- Create a region.
- Rename it.
- Export selected PNG.
- Save project JSON.
- Reload project JSON.
- Confirm region is restored.

Manual verification:

- Test one transparent PNG source.
- Test one solid-background GPT sheet.
- Test one UI control sheet.
- Inspect exported PNG files in a browser and in at least one game canvas.

## Milestones

### Milestone 1: Local App Shell

Deliverables:

- Vite React app.
- Basic layout.
- Image import.
- Canvas display.
- Alpha detection.

Exit criteria:

- User can import and view a local image.
- Tool displays image dimensions and alpha status.

### Milestone 2: Region Editing

Deliverables:

- Add region.
- Select region.
- Move and resize region.
- Region list.
- Region inspector.

Exit criteria:

- User can create and adjust multiple named regions.
- Region coordinates remain stable under zoom and pan.

### Milestone 3: PNG Export

Deliverables:

- Export selected region.
- Export all enabled regions as ZIP.
- Padding support.
- Filename sanitization.

Exit criteria:

- User can export usable PNG files without writing code.

### Milestone 4: Project Persistence

Deliverables:

- Save project JSON.
- Load project JSON.
- Dimension mismatch warning.

Exit criteria:

- User can resume a cutting session.

### Milestone 5: Chroma-Key Preview

Deliverables:

- Sample or enter key color.
- Tolerance control.
- Preview transparent result.
- Damage warning for aggressive tolerance.

Exit criteria:

- User can cut solid-background GPT sheets without automatic destructive processing.

## First Version Acceptance Checklist

- [ ] Import works for PNG and JPEG.
- [ ] True alpha PNG is detected.
- [ ] Fake checkerboard is not treated as alpha unless it actually contains alpha.
- [ ] Multiple crop regions can be edited.
- [ ] Regions can be named.
- [ ] Selected PNG export works.
- [ ] Batch ZIP export works.
- [ ] Project JSON save/load works.
- [ ] Source image is never modified.
- [ ] Chroma-key removal is previewed before export.
- [ ] Exported PNG files can be used directly in a browser game.

## Recommended First Development Prompt

Use this prompt in the new development conversation:

```text
We are building a standalone local web app named GPT Asset Cutter.

Read these docs first:
- docs/guides/gpt-asset-cutter-prd.md
- docs/guides/gpt-asset-cutter-mvp-technical-plan.md

Goal: implement the MVP as a new standalone project, preferably outside the Arcadity game code, using Vite + React + TypeScript + react-konva.

Do not make it Arcadity-specific. The core output is individual PNG files plus generic JSON metadata. Arcadity/Pixi/Phaser export presets can come later.

Start by creating the app shell, image import, source image display, alpha detection, and a pan/zoom canvas.
```
