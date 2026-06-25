# AssetCutter 背景移除工作台 + 轻量项目管理架构计划

## Summary

主流程升级为：**导入原图自动创建项目 → 背景移除工作台生成 clean source → 基于 clean source 自动识别区域 → 优化区域/规范尺寸/导出**。  
项目文件采用 **外链+重连**：JSON 保存源图指纹、背景参数、编辑记录和区域数据，不内嵌原图；打开已有项目后提示导入匹配原图继续编辑。

## Key Changes

- 新增轻量项目模型，使用 `project.version: 2`。
  - 项目包含 `projectId`、`name`、`createdAt`、`updatedAt`、`sourceRef`、`background`、`regions`。
  - `sourceRef` 保存文件名、尺寸、alpha、可计算 hash/指纹；用于判断重新导入的图片是否匹配。
  - 不支持 v1 JSON 自动迁移；当前没有历史项目文件，旧版本 JSON 直接提示不支持。

- 调整工程入口和项目管理体验。
  - “导入图片”默认新建项目，并绑定这张图为源图。
  - “加载项目”可在没有图片时打开项目壳，状态显示“等待导入匹配原图”。
  - 导入图片时，如果匹配当前项目 `sourceRef`，恢复为可编辑状态；不匹配则提示新建项目或替换源图。
  - 保存项目只保存可重放数据，不保存 `processedSource` 位图。

- 引入 `processedSource` 运行时派生数据。
  - 原图永远不破坏。
  - `processedSource = processBackground(originalSource, background.settings, background.edits)`。
  - 自动识别默认读取 `processedSource` 的 alpha。
  - 导出默认从 `processedSource` 裁剪；区域级背景处理保留为高级覆盖项。

- 新增 `BackgroundEditor` 工作台。
  - 左侧大画布支持缩放、拖动、结果/原图/Alpha Mask/边缘高亮视图。
  - 右侧参数面板支持背景色、容差、软边、边缘扩张/收缩、去色溢出。
  - 参数进入工作台后使用 draft 临时态，实时预览；“应用”才写入项目，“取消”丢弃 draft。
  - 主界面右下角小预览只展示已应用结果，不再承担主要调参职责。

- 重构背景算法接口。
  - 保留 `applyChromaKeyToImageData` 作为基础算法。
  - 新增 `processBackground(source, settings, edits): BackgroundProcessingResult`。
  - `settings` 包含 `mode`、`chromaKey`、`tolerance`、`softEdge`、`edgeGrow`、`spillRemoval`。
  - `edits` 预留局部去背景区域、手动擦除、手动恢复，均可重放。

## Development Phases

- Phase 1：项目管理底座 + 主流程重排
  - 完成 v2 项目模型、源图重连状态。
  - 导入图片自动新建项目；加载项目可等待匹配原图。
  - 建立 `processedSource` 派生层。
  - 自动识别和导出优先使用 `processedSource`。

- Phase 2：背景编辑工作台 MVP
  - 增加“背景编辑”主入口。
  - 工作台支持 draft 参数、实时预览、应用/取消。
  - 支持结果/原图/Alpha Mask/边缘高亮基础视图。
  - 小预览同步显示已应用结果。

- Phase 3：全图算法增强
  - 把边缘连通背景 mask、软边 alpha、边缘扩张/收缩纳入统一 pipeline。
  - 增加只作用于 mask 边界附近的去色溢出。
  - 自动背景检测结果可一键写入工作台 draft 参数。

- Phase 4：局部处理区域
  - 用户粗略圈/涂一个区域。
  - 只在该区域内按当前参数运行去背景算法。
  - 支持撤销、重置局部处理、重复叠加。
  - 局部处理写入 `background.edits`，不破坏原图。

- Phase 5：手动兜底工具
  - 增加手动擦除背景画笔和恢复主体画笔。
  - 支持画笔大小、硬度、撤销/重做。
  - 手动工具只修改 mask/edit layer。

- Phase 6：高级算法评估
  - 优先评估 magic-wand-js 类 fuzzy selection 是否适合局部区域。
  - OpenCV GrabCut 或 AI 背景移除只作为后续增强，不进入当前核心依赖。
  - 产品边界保持为资源切割背景工作台，不扩展成通用 Web PS。

## Test Plan

- 单元测试：
  - v2 项目解析、序列化；非 v2 项目提示不支持。
  - 源图指纹匹配与不匹配状态。
  - `processBackground` 的 source/alpha/chromaKey pipeline。
  - `processedSource` 派生后自动识别读取 alpha。
  - 局部编辑只影响指定 mask 范围。

- E2E 测试：
  - 导入图片 → 自动新建项目 → 保存 JSON → 重新加载项目 → 重连原图。
  - 加载项目但未导入原图时，编辑/导出禁用，提示重连。
  - 进入背景工作台 → 调参数 → 取消，不写入项目。
  - 进入背景工作台 → 调参数 → 应用，主界面预览、自动识别、导出均使用新结果。
  - 局部处理后自动识别区域更贴近透明主体。

- 视觉验证：
  - 工作台大画布缩放/拖动稳定。
  - Alpha Mask、边缘高亮、结果预览一致。
  - 主界面小预览与工作台应用后的结果一致。
  - 项目等待重连状态、已重连状态、源图不匹配状态清晰可见。

## Assumptions

- 项目文件默认不内嵌原图，采用外链+重连。
- `processedSource` 是运行时派生数据，不直接写入 JSON。
- 第一轮实现不引入重型 Web PS、OpenCV.js 或 AI 抠图依赖。
- 区域级背景参数继续保留为高级覆盖项，但不再是主流程核心。
- 当前计划优先落地可持续架构和可用工作台，再逐步增强算法与局部工具。
