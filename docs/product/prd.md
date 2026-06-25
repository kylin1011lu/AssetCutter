# Asset Cutter PRD

> Status: product reference for the standalone tool
> Date: 2026-06-22

## Summary

Asset Cutter is a general-purpose local image cutting tool for turning AI-generated source images into individual PNG assets.

The tool is not an Arcadity-specific asset pipeline and not a full image editor. Its first job is simple: import one GPT or AI-generated source image, manually mark multiple regions, inspect the result, and export clean individual PNG files that can be used directly in games, web apps, mobile apps, UI prototypes, or design systems.

Arcadity can use the exported PNG files like any other game project. Arcadity-specific manifests, PixiJS manifests, atlases, and asset-pack conventions are export presets, not core product assumptions.

## Problem

GPT and other AI image tools can generate useful visual material, but the raw output is rarely production-ready:

- A prompt for a transparent image may produce true alpha, fake checkerboard transparency, white backgrounds, soft dirty edges, or shadows.
- A prompt for a sheet of assets may produce many usable objects in one image, but not separated files.
- Automatic chroma-key removal can damage subjects when object colors are close to the background color.
- One-off scripts are hard to review, hard to reuse, and unsafe for visual assets that need human judgment.
- Game and UI assets need stable filenames, dimensions, padding, anchors, and sometimes metadata, not just cropped screenshots.

The tool should move this work from ad hoc scripts to an inspectable local workflow.

## Users

Primary users:

- Game developers creating 2D sprites, icons, tiles, UI controls, panels, and effects from GPT output.
- Designers or product builders who need to turn AI-generated sheets into reusable PNG components.
- Codex-assisted development workflows where AI generates the source image, but a human should approve the final cuts.

Secondary users:

- Web or app developers who need quick icon and UI asset extraction.
- Small teams building multiple visual themes or skin packs.

## Product Positioning

GPT Asset Cutter is a browser-based local workbench for cutting AI-generated source images into reusable PNG assets.

It should be:

- General-purpose: output normal PNG files first.
- Local-first: no account, upload, or server required for MVP.
- Human-confirmed: no destructive automatic background removal.
- Source-preserving: never modify the imported source image.
- Export-oriented: optimized for getting clean files out, not for complex painting.
- Extensible: export presets can be added later for PixiJS, Phaser, CSS sprites, Cocos, Godot, or Arcadity.

## Non-Goals

MVP is not:

- Photoshop or a full raster editor.
- An AI image generator.
- A full automatic background-removal tool.
- An automatic object detection system.
- An Arcadity-only tool.
- A cloud collaboration product.
- An asset CDN, version manager, or game runtime loader.

## Core Use Cases

### Use Case 1: Cut a Transparent PNG Sheet

1. User imports a PNG that already has a real alpha channel.
2. Tool displays the image over a visible checkerboard or solid preview background.
3. User draws crop regions around individual objects.
4. User names each region.
5. User exports individual PNG files.

Success: exported PNG files preserve transparency and match the selected regions.

### Use Case 2: Cut a Solid-Background GPT Sheet

1. User imports a GPT-generated image on a flat solid background.
2. Tool lets the user sample or enter the background color.
3. Tool previews background removal on each selected region.
4. User adjusts tolerance and padding while inspecting the edge result.
5. User exports only after confirming the preview.

Success: exported PNG files do not damage the subject and do not contain obvious background remnants.

### Use Case 3: Cut UI Controls

1. User imports a source image containing buttons, panels, badges, or controls.
2. User marks each control manually.
3. User exports each control as a standalone PNG.
4. Optional metadata stores the intended asset role, such as button, panel, icon, or nine-slice candidate.

Success: controls are exported as reusable files without being tied to a screenshot layout.

### Use Case 4: Save and Resume a Cutting Project

1. User imports a source image and creates crop regions.
2. User saves a project JSON file.
3. Later, user reloads the source image and project JSON.
4. Tool restores all regions, names, export settings, and metadata.

Success: users can iterate on asset cutting instead of finishing everything in one session.

## MVP Scope

MVP must include:

- Import local image files.
- Detect whether the source image has real alpha.
- Display the image on a pan-and-zoom canvas.
- Create, move, resize, select, duplicate, and delete rectangular crop regions.
- Rename each crop region.
- Show a region list with selection state.
- Export one selected region as PNG.
- Export all enabled regions as a ZIP of PNG files.
- Save project JSON.
- Load project JSON.
- Preserve the source image unchanged.
- Support transparent PNG input.
- Support solid-background input through previewed, export-time background removal.
- Let users choose whether an export keeps the original background or uses transparent output.

MVP should not include:

- Automatic detection of all objects.
- Brush-based editing.
- Layer editing.
- Atlas packing.
- Framework-specific runtime integration.
- Online storage.
- Multi-user collaboration.

## Asset Model

Each cut region should have:

- `id`: stable export id, for example `fruit.apple` or `ui.pause_button`.
- `label`: optional human-readable label.
- `enabled`: whether the region is included in batch export.
- `crop`: source-space rectangle.
- `padding`: export-time padding in pixels.
- `exportSize`: optional output resize target.
- `backgroundMode`: `source`, `alpha`, or `chromaKey`.
- `anchor`: optional normalized point, default `{ "x": 0.5, "y": 0.5 }`.
- `tags`: optional role labels such as `sprite`, `button`, `panel`, or `icon`.

Example project JSON:

```json
{
  "version": 1,
  "source": {
    "fileName": "fruit-sheet.png",
    "width": 2048,
    "height": 2048,
    "hasAlpha": false
  },
  "settings": {
    "backgroundMode": "chromaKey",
    "chromaKey": "#00ff00",
    "tolerance": 18
  },
  "regions": [
    {
      "id": "fruit.apple",
      "label": "Apple",
      "enabled": true,
      "crop": { "x": 120, "y": 180, "width": 256, "height": 256 },
      "padding": { "top": 8, "right": 8, "bottom": 8, "left": 8 },
      "exportSize": null,
      "backgroundMode": "chromaKey",
      "anchor": { "x": 0.5, "y": 0.5 },
      "tags": ["sprite", "fruit"]
    }
  ]
}
```

## Export Rules

Default export:

- Export every enabled region as one PNG.
- Use `id` as the filename after sanitizing unsafe characters.
- Preserve alpha if the source has alpha and the region uses `alpha` mode.
- Only remove a solid background when the user has enabled and previewed `chromaKey` mode.
- Never modify the source file.

Suggested filename mapping:

- `fruit.apple` -> `fruit.apple.png`
- `ui.pause_button` -> `ui.pause_button.png`
- `button/primary` -> `button_primary.png`

Batch export should produce:

- PNG files.
- `project.json`, containing the editable project data.
- `manifest.json`, containing only export-facing metadata.

## Quality Gates

Before a region is considered ready, the tool should help the user verify:

- The subject is not cropped at the edge.
- The output includes enough padding.
- The background mode is correct.
- Transparent corners are actually transparent when expected.
- Chroma-key removal has not damaged subject colors.
- No fake checkerboard background is being treated as real alpha.
- Output size matches the intended use.

MVP can surface these as visual warnings instead of blocking export.

## Future Versions

Possible post-MVP features:

- Nine-slice metadata editor and preview.
- Atlas packing.
- PixiJS manifest export.
- Phaser atlas export.
- CSS sprite export.
- Arcadity asset pack export preset.
- Auto-detect separated transparent regions.
- Auto-suggest crop boxes for solid-background images.
- Edge inspection zoom view.
- Side-by-side before/after export preview.
- Keyboard shortcuts.
- Recent projects.
- Template presets for icon sheets, tile sheets, buttons, and panels.

## Success Criteria

MVP is successful when:

- A user can import one GPT-generated sheet and export at least 10 named PNG assets without writing code.
- The source image remains untouched.
- The user can save the project, reload it, adjust cuts, and export again.
- Transparent input and solid-background input both work.
- Exported PNG files can be dropped into a normal browser game or web app without additional manual processing.
