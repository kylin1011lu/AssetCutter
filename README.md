# Asset Cutter

[English](#english) | [中文](#中文)

## English

Asset Cutter is a local-first browser workbench for turning source images into reusable PNG assets. It is built for cutting AI-generated sheets, UI controls, sprites, icons, backgrounds, and other visual source material into named export regions with project metadata.

The app runs entirely in the browser. Images stay on the user's machine; there is no backend, upload step, account, or cloud dependency.

### Features

- Import a local PNG/JPEG/WebP source image.
- Keep the original image unchanged while editing a derived result image.
- Remove solid backgrounds explicitly through the background tool.
- Auto-detect regions from result-image alpha, or add crop regions manually.
- Select, edit, normalize, preview, and organize asset regions.
- Save and reload editable project JSON.
- Export enabled regions as PNG files in a ZIP with `project.json` and `manifest.json`.
- Build a portable single-file HTML version for sharing or offline use.
- Use English or Simplified Chinese UI text.

### Quick Start

```bash
npm install
npm run dev
```

Open the printed local Vite URL, usually `http://127.0.0.1:5173`.

### Build

Standard web build:

```bash
npm run build
```

Portable single-file build:

```bash
npm run build:single
```

The single-file build writes `dist-single/index.html`. It inlines the app's JavaScript and CSS, so the generated HTML file can be opened directly in a browser.

### Tests

Run unit tests:

```bash
npm test
```

Run the browser smoke suite:

```bash
npm run test:e2e
```

The e2e suite uses Playwright with the system Chrome channel. Install Chrome before running it locally.

### Project Structure

```text
src/
  app/        React application shell, panels, preview board, and UI logic
  build/      single-file HTML build plugin
  canvas/     Konva canvas, viewport math, crop/export, image processing
  i18n/       English and Simplified Chinese strings
  io/         local image loading, ZIP export, and project save helpers
  model/      serializable project and manifest types
  tests/      unit tests
tests/
  e2e/        Playwright smoke tests
  fixtures/   raw source images used by tests
docs/
  product/    product requirements and technical reference
  roadmap/    design notes and future feature plans
  prototypes/ static UI prototypes
```

### Workflow Notes

Asset Cutter is intentionally source-preserving:

- Importing an image creates a project from the original image.
- Background cleanup only happens when the user explicitly uses the background tool.
- Crop detection reads the current result image's alpha channel.
- Exported PNGs and metadata are derived outputs; the original source image is not modified.

### Documentation

- [Product requirements](docs/product/prd.md)
- [MVP technical plan](docs/product/mvp-technical-plan.md)
- [Background workbench plan](docs/roadmap/background-workbench-plan.md)
- [Asset groups design](docs/roadmap/asset-groups-design.md)
- [Preview board MVP plan](docs/roadmap/preview-board-mvp-plan.md)

### Contributing

This is a Vite + React + TypeScript app. Please run `npm test` and `npm run build` before sending changes. For UI behavior changes, add or update focused tests in `src/tests/` or `tests/e2e/` when the behavior is user-visible.

Generated outputs such as `dist/`, `dist-single/`, `.vite/`, Playwright reports, and local browser snapshots should not be committed.

### License

MIT. See [LICENSE](LICENSE).

## 中文

Asset Cutter 是一个本地优先的浏览器切图工作台，用来把源图片切成可复用的 PNG 资源。它适合处理 AI 生成的资源图、UI 控件、精灵、图标、背景，以及其他需要按区域命名、预览、导出并保留项目元数据的视觉素材。

应用完全在浏览器中运行。图片保留在用户本机，不需要后端、上传、账号或云服务。

### 功能

- 导入本地 PNG/JPEG/WebP 源图片。
- 保留原图不变，在派生的结果图上编辑。
- 通过去色工具显式移除纯色背景。
- 基于结果图 alpha 自动识别区域，也可以手动画切图框。
- 选择、编辑、规范化、预览和组织资源区域。
- 保存并重新加载可编辑的项目 JSON。
- 将启用的区域导出为 PNG ZIP，并包含 `project.json` 和 `manifest.json`。
- 构建可离线分享的单文件 HTML 版本。
- 支持英文和简体中文界面。

### 快速开始

```bash
npm install
npm run dev
```

打开终端输出的本地 Vite 地址，通常是 `http://127.0.0.1:5173`。

### 构建

标准 Web 构建：

```bash
npm run build
```

单文件 HTML 构建：

```bash
npm run build:single
```

单文件构建会输出 `dist-single/index.html`。它会把应用的 JavaScript 和 CSS 内联到 HTML 中，因此生成的 HTML 文件可以直接用浏览器打开。

### 测试

运行单元测试：

```bash
npm test
```

运行浏览器冒烟测试：

```bash
npm run test:e2e
```

e2e 测试使用 Playwright 的系统 Chrome 通道。本地运行前请先安装 Chrome。

### 项目结构

```text
src/
  app/        React 应用壳、面板、预览板和 UI 逻辑
  build/      单文件 HTML 构建插件
  canvas/     Konva 画布、视口计算、裁剪导出和图像处理
  i18n/       英文和简体中文文案
  io/         本地图片加载、ZIP 导出和项目保存工具
  model/      可序列化的项目与 manifest 类型
  tests/      单元测试
tests/
  e2e/        Playwright 冒烟测试
  fixtures/   测试使用的原始源图片
docs/
  product/    产品需求和技术参考
  roadmap/    设计说明和后续功能计划
  prototypes/ 静态 UI 原型
```

### 工作流说明

Asset Cutter 的核心原则是保留源图：

- 导入图片会基于原图创建项目。
- 只有用户显式使用去色工具时才进行背景处理。
- 切图识别读取当前结果图的 alpha 通道。
- 导出的 PNG 和元数据都是派生产物，原始源图片不会被修改。

### 文档

- [产品需求](docs/product/prd.md)
- [MVP 技术计划](docs/product/mvp-technical-plan.md)
- [背景工作台计划](docs/roadmap/background-workbench-plan.md)
- [资源组设计](docs/roadmap/asset-groups-design.md)
- [预览板 MVP 计划](docs/roadmap/preview-board-mvp-plan.md)

### 贡献

这是一个 Vite + React + TypeScript 应用。提交修改前请运行 `npm test` 和 `npm run build`。如果修改了用户可见的 UI 行为，请在 `src/tests/` 或 `tests/e2e/` 中补充或更新聚焦的测试。

不要提交生成产物，例如 `dist/`、`dist-single/`、`.vite/`、Playwright 报告和本地浏览器快照。

### 许可证

MIT。详见 [LICENSE](LICENSE)。
