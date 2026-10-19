# Screenshot provenance / 截图来源

These are native DSH interface captures, copied without image editing from the repository's existing slim-viewer verification evidence. All Redis content shown is **isolated fixture data**, not customer or production data.

这些图片是原生 DSH 界面截图，从仓库已有精简版验收材料原样复制，未重新绘制或修改图片。图中 Redis 内容均为**隔离测试数据**，不含客户或业务数据。

| File / 文件 | Recorded / 日期 | Host and view / 环境与视图 |
| --- | --- | --- |
| [hash-workbench-dark.jpg](hash-workbench-dark.jpg) | 2026-10-19 | DSH Web `0.2.0-rc.2`, Windows, dark theme, expanded Hash workbench, 1280 × 720 |
| [stream-sidebar-dark.jpg](stream-sidebar-dark.jpg) | 2026-10-19 | Same Host/theme, Stream in an approximately 464 px sidebar within a 1280 × 720 native workspace |

The originals are under `docs/verification/artifacts/slim-2026-10-19/` in the source checkout: `slim-native-hash-full-dark.png` and `slim-native-stream-dark-464.png`. Their bytes are JPEG despite the original extensions; these copies use `.jpg` without conversion. They document the six-type UI at that checkpoint, before subsequent chat-tool work. They do not establish new runtime acceptance of this documentation revision, live business data or the newer AI integration.

历史源图虽然以 `.png` 命名，实际字节为 JPEG；交付副本按实际格式命名为 `.jpg`，未进行格式转换。源图早于后续对话工具接入，不把复用截图当成本次重新运行验收、真实业务数据验收或新增 AI 能力的证据。两个入口 README 使用相同图片和一致说明；后续更换图片时同时更新本文件与日期。

## Workflow diagram / 流程示意

[readme-flow.svg](readme-flow.svg) is a deterministic, editable SVG explaining manual connection, DB/Key browsing, selected-row inspection and a request in the same DSH conversation. It reuses the interface's cyan/purple/orange palette. It is a diagram, not a screenshot or acceptance result. The adjacent Markdown carries the complete operating instructions.

该图为可编辑矢量流程示意，使用界面已有青紫橘配色，未重绘产品界面，也不代替原生截图。操作条件和完整步骤仍保留在 Markdown 中。

## Animated title / 动画标题

[readme-header.gif](readme-header.gif) is a 1200 × 280 title animation based on the layout approach of the maintainer's GitGraph README. It uses this project's existing cylinder paths and cyan/purple/orange navigation palette. The DB, folder and Key highlights appear in sequence, hold still, then fade; the name and purpose remain visible. It illustrates browsing order, not live server activity or a product screen recording.

[readme-header.svg](readme-header.svg) is the static fallback. [readme-header-motion.svg](readme-header-motion.svg) and its [motion spec](readme-header-motion.json) preserve the editable source: 30 source frames per second, a 5-second loop and a 2.3-second fully settled hold. The 150 source frames may merge into fewer encoded GIF frames; timings are retained.

这是 README 顶部的轻量标题示意，复用现有数据库图标路径和青紫橘导航配色；不是原生截图，也不代表实际 Redis 活动。两种语言共用同一 GIF，并保留静态 SVG 入口，操作说明、真实截图和版本要求仍在正文中。维护源文件时同步重新导出 GIF；不要把 SVG 自身当成 GitHub 可播放的动画。
