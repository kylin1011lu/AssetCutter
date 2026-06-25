# AssetCutter 资源组功能设计

> 日期：2026-06-24
> 状态：方案草案
> 目标：把资源组定义为可保存、可复用的批量规范化与导出组织单元。

## 背景

当前 AssetCutter 已经有完整的基础切图流程：

1. 导入原图并创建 `CutterProject`。
2. 通过背景处理得到运行时 `processedSource`。
3. 自动识别或手动画出多个 `AssetRegion`。
4. 对选中区域做批量规范化。
5. 导出 PNG、`project.json` 和扁平 `manifest.json`。

代码里已经预留了 `assetGroups` 工具入口，但目前只是占位提示：

- `src/app/App.tsx` 中有 `ActiveTool = 'background' | 'crop' | 'assetGroups'`。
- `src/i18n/translations.ts` 中说明资源组用于“统一尺寸、居中和 anchor”。
- `CutterProject` 目前只有扁平 `regions`，没有资源组 schema。
- `manifest.json` 目前只有扁平 `assets` 列表。

因此资源组不应该从零重做一套裁剪模型，而应该建立在已有 `regions` 和 `selectedRegionIds` 之上。

## 产品定义

资源组是“一组同类资源的批量规范化与导出组织单元”。

第一版资源组解决这些问题：

- 把多个已识别/已裁剪的区域归为一组。
- 为这一组保存统一输出框尺寸。
- 为这一组保存统一 anchor。
- 为这一组保存公共 tags。
- 为这一组保存导出路径前缀或逻辑分组名。
- 在 manifest 中表达组与资源的关系。

第一版资源组不做这些事情：

- 不替代 `AssetRegion`。
- 不做 Arcadity 专用 asset pack。
- 不做 PixiJS、Phaser、Cocos 等框架专用导出。
- 不做 atlas packing。
- 不做复杂层级目录管理。
- 不做同一个 region 同时属于多个组的复杂关系。

## 推荐方案

采用显式 `AssetGroup` 模型。

`regions` 仍然是唯一真实裁剪数据；`groups` 只引用 region id，并保存一组可复用的批量规则。

```ts
export interface AssetGroup {
  id: string;
  name: string;
  regionIds: string[];
  frame: { width: number; height: number } | null;
  anchor: { x: number; y: number } | null;
  tags: string[];
  exportPathPrefix: string;
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
```

### 为什么不用 tags 替代资源组

只用 tags 的改动最小，但 tags 只能表达分类，不能稳定表达“一组按钮都导出 256 x 96、anchor 0.5/0.5、路径是 ui/buttons/”这种规则。

资源组应该保存规则，而不是只保存标签。

### 为什么不做目录树

目录树适合后续资源包、框架 preset 或大型项目管理。但当前工具的核心是本地切图和通用 PNG 导出，过早做目录树会把 UI、manifest 和导出规则都复杂化。

第一版保留 `exportPathPrefix` 字段即可，后续可以自然演进为目录导出或框架 preset。

## 数据规则

### 组 ID

组 ID 使用稳定字符串，建议从组名生成：

- `UI Buttons` -> `ui-buttons`
- `Main Character` -> `main-character`
- `Tiles` -> `tiles`

如果冲突，则追加数字后缀：

- `ui-buttons-2`
- `ui-buttons-3`

### 成员关系

第一版建议一个 region 最多属于一个资源组。

原因：

- UI 更直观。
- 导出 manifest 更简单。
- 批量规范化规则不会冲突。

后续如果需要多重分类，可以用 `tags` 解决，而不是让一个 region 同时套多组 frame/anchor 规则。

### 删除和清理

- 删除 region 时，从所有 group 的 `regionIds` 中移除该 id。
- 删除 group 时，不删除 region，只删除组规则。
- 加载旧 project JSON 时，如果没有 `groups`，默认补 `groups: []`。
- 加载 project JSON 时，清理不存在的 `regionIds`。

## UI 设计

### 左侧区域列表

保留现有区域列表和复选框选择模型。

新增轻量状态：

- 未分组
- 所属组名

选中多个区域后，资源组工具可以直接使用当前 `selectedRegionIds` 创建组或加入组。

### 中间画布

资源组模式下不需要编辑裁剪框。

第一版可以保持当前逻辑：当 `activeTool === 'assetGroups'` 时，画布不显示可编辑 region 框。

后续可以增强为组预览视图：

- 网格显示组内资源缩略图。
- 叠加统一输出框。
- 标记 anchor 点。
- 对尺寸不一致或边缘裁切风险给出提示。

### 右侧资源组 Inspector

资源组工具右侧面板显示：

- 资源组列表。
- 当前资源组名称。
- 当前资源组成员数量。
- 输出框宽高。
- anchor X/Y。
- 公共 tags。
- 导出路径前缀。
- 操作按钮。

核心操作：

- 用当前选中区域新建资源组。
- 把当前选中区域加入当前组。
- 从当前组移除选中区域。
- 使用选中最大尺寸作为组 frame。
- 应用组规则到成员。
- 删除资源组。

### 复用现有批量规范化

现有 `BatchNormalizePanel` 是一次性的批量操作。

资源组第一版应把它升级为“可保存规则并重复应用”的工作流：

1. 从选中区域创建组。
2. 点击“使用选中最大尺寸”得到 frame。
3. 保存到 group.frame。
4. 点击“应用到组”时调用现有 `normalizeRegionsToFrame(project, group.regionIds, group.frame)`。

## Manifest 设计

当前 manifest 是 v1：

```json
{
  "version": 1,
  "assets": []
}
```

资源组上线后建议升级为 v2，同时保持扁平 `assets`，新增 `groups`：

```json
{
  "version": 2,
  "assets": [
    {
      "id": "play",
      "file": "play.png",
      "width": 256,
      "height": 96,
      "anchor": { "x": 0.5, "y": 0.5 },
      "tags": ["ui", "button"],
      "groupId": "ui-buttons",
      "path": "ui/buttons/play.png"
    }
  ],
  "groups": [
    {
      "id": "ui-buttons",
      "name": "UI Buttons",
      "assets": ["play"],
      "frame": { "width": 256, "height": 96 },
      "anchor": { "x": 0.5, "y": 0.5 },
      "tags": ["ui", "button"],
      "exportPathPrefix": "ui/buttons"
    }
  ]
}
```

第一版 ZIP 可以继续把 PNG 平铺在根目录，只在 manifest 里输出 `path` 字段。

第二版再让 ZIP 根据 `exportPathPrefix` 写入目录结构：

```text
asset-cutter-export.zip
  ui/buttons/play.png
  ui/buttons/pause.png
  project.json
  manifest.json
```

## 导出规则

导出 PNG 时仍以 region 为单位。

资源组只影响：

- manifest 中的 `groupId`。
- manifest 中的 `path`。
- 可选的公共 tags 合并。
- 已应用到 region 的 frame/anchor。

资源组不应该在导出时临时修改 crop，否则用户在预览和实际导出之间会看到不一致结果。

推荐规则：

1. 组规则必须先显式“应用到组”。
2. 应用后写回对应 regions。
3. 导出只读取 regions 的最终状态。
4. manifest 从 groups 和 regions 合成导出元数据。

## 实施阶段

### Phase 1: 模型打底

- 新增 `AssetGroup` 类型。
- `CutterProject` 增加 `groups: AssetGroup[]`。
- `createDefaultProject()` 默认创建空 groups。
- `serializeProjectJson()` 写入 groups。
- `parseProjectJson()` 兼容旧 JSON，缺少 groups 时补空数组。
- 增加 group id 生成、清理 orphan region id 的工具函数。
- 增加单元测试。

### Phase 2: 资源组 UI MVP

- 替换 `assetGroupsReserved` 占位内容。
- 显示资源组列表。
- 支持用当前选中区域创建资源组。
- 支持选中资源组。
- 支持把选中区域加入资源组。
- 支持从资源组移除选中区域。
- 支持删除资源组。
- 区域列表显示所属组名。

### Phase 3: 组规则应用

- 资源组保存 frame 宽高。
- 支持使用选中最大尺寸作为 frame。
- 支持设置统一 anchor。
- 支持设置公共 tags。
- 点击“应用到组”后更新组内 regions。
- 复用 `normalizeRegionsToFrame()`。

### Phase 4: Manifest 与导出增强

- `ExportManifest` 升级到 v2。
- `buildManifest()` 接收 `regions` 和 `groups`。
- assets 输出 `groupId` 和 `path`。
- groups 输出成员和规则。
- 单元测试覆盖 manifest v2。
- E2E 覆盖保存、加载、导出 manifest。

### Phase 5: 后续增强

- 资源组缩略图网格预览。
- ZIP 目录结构导出。
- 组内排序。
- 框架导出 preset。
- Arcadity asset pack preset。

## 验收标准

第一版资源组完成时，应满足：

1. 导入图片并自动识别多个区域后，可以勾选两个或多个区域创建资源组。
2. 创建资源组后，保存 JSON 再重新加载，资源组仍然存在。
3. 删除 region 后，资源组成员关系自动清理。
4. 可以为资源组设置统一 frame，并应用到组内 regions。
5. 应用统一 frame 后，组内 regions 尺寸变化，组外 regions 不变。
6. 可以为资源组设置统一 anchor，并应用到组内 regions。
7. 导出 ZIP 后，manifest 能看到 group 和成员关系。
8. 旧项目 JSON 没有 `groups` 字段时仍能正常加载。

## 测试计划

### 单元测试

- `createDefaultProject()` 包含空 groups。
- `parseProjectJson()` 兼容缺少 groups 的 JSON。
- group id 生成稳定且能处理冲突。
- 删除 region 后清理 group members。
- 应用 group frame 只影响组内 regions。
- `buildManifest()` 输出 assets 和 groups。

### E2E 测试

- 导入 fixture。
- 自动识别 regions。
- 勾选两个 regions。
- 创建资源组。
- 设置 frame 为 `300 x 300`。
- 应用到组。
- 验证组内两个 regions 显示 `300 x 300`，组外 region 保持原尺寸。
- 保存 project JSON。
- 重新加载 project JSON 和原图。
- 验证资源组仍存在。
- 导出 ZIP。
- 验证 manifest 包含 group 信息。

## 开放问题

1. 第一版是否允许一个 region 同时属于多个资源组？
   - 建议：不允许。多重分类用 tags 解决。
2. 第一版 ZIP 是否真的按目录输出？
   - 建议：暂时不做。先在 manifest 输出 `path`，第二版再启用目录结构。
3. 资源组 tags 应该覆盖 region tags 还是合并？
   - 建议：导出 manifest 时合并；应用组规则时可选择写回 region tags。
4. 资源组 anchor 应该自动写回 region 还是只作为导出元数据？
   - 建议：显式“应用到组”后写回 region，保证预览和导出一致。

## 推荐结论

资源组第一版应该做成“可保存、可复用的批量规范化与导出分组”。

它的核心不是新的裁剪工具，而是把现有多个 `AssetRegion` 组织成一个有规则的集合，让同类资源可以统一输出框、统一 anchor、统一 tags，并在 manifest 里形成清晰的组关系。

这个方案能贴合当前代码结构，复用已有选择模型和批量规范化能力，同时为后续 PixiJS、Phaser、Cocos、Arcadity 等导出 preset 留出扩展空间。
