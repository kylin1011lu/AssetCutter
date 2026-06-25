# Preview Board MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-version resource preview board under Asset Groups where selected or grouped cut assets render as draggable preview items without changing export data.

**Architecture:** Keep `regions` and `groups` as the source of truth. Add a small pure layout helper for board item positions, a React preview-board component that renders cropped PNG object URLs, and wire the Asset Groups inspector to open the board for the current group, selected regions, or all enabled regions.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, existing crop export and preview zoom helpers.

---

### Task 1: Preview Board Layout Helpers

**Files:**
- Create: `src/app/previewBoard.ts`
- Test: `src/tests/previewBoard.test.ts`

- [x] **Step 1: Write failing tests**

Create tests for deterministic image-space placement from source crop positions, preserving existing item positions, filtering stale item ids, and moving one item.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- src/tests/previewBoard.test.ts`
Expected: fails because `src/app/previewBoard.ts` does not exist.

- [x] **Step 3: Implement layout helpers**

Export `createPreviewBoardLayout()` and `movePreviewBoardItem()` with simple `{ regionId, x, y, scale }` items.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- src/tests/previewBoard.test.ts`
Expected: pass.

### Task 2: Preview Board UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`
- Modify: `src/i18n/translations.ts`

- [x] **Step 1: Add board mode and controls**

Extend `ActiveTool` with `previewBoard`, add buttons in Asset Groups for current group, current selection, and all enabled assets.

- [x] **Step 2: Render draggable board items**

Use existing background processing plus `exportCropImageDataToPngBlob()` to generate item URLs. Render absolute-positioned preview assets with pointer drag.

- [x] **Step 3: Keep board preview-only**

Do not write item positions to `project`, `project.json`, or `manifest.json`.

### Task 3: Verification

**Files:**
- Test: `src/tests/previewBoard.test.ts`
- Test: existing test suite

- [x] **Step 1: Run unit tests**

Run: `npm test -- src/tests/previewBoard.test.ts`
Expected: pass.

- [x] **Step 2: Run full build**

Run: `npm run build`
Expected: TypeScript and Vite build pass.

- [x] **Step 3: Start dev server for manual/browser verification**

Run: `npm run dev -- --port 5173`
Expected: local Vite URL is available for the user.
