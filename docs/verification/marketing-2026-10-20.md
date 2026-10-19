# 2026-10-20：定位、推广与 README 检查

本轮按 product-marketing → oil-tone → beautify-github-readme → oil-cover Agent 自主模式执行，下文记录定位、文案、README与封面的本地交付和验证范围。

## 定位与文案

- `.agents/product-marketing.md` 记录产品、读者、使用流程、卖点、限制和证据；当前v2记录维护者已确认个人开发者定位。没有把维护者确认当成市场调查或客户证言。
- `PROMOTION.md` 包含中文介绍、简短介绍和英文介绍；oil-tone脚本通过，人工核对没有虚构经历、群体反馈、效率数字或公开下载地址。
- 当前功能仍为六类型只读查看、同屏行详情、同会话原生工具读取。DB切换需要明确要求，工具结果的模型数据去向保留；后续写入规划未变成现有卖点。

## README 调整

两份README都使用“用途 → 原生界面 → 流程 → 安装与首次操作 → 详细能力与边界”的顺序。完整功能和Stream图可展开查看；工具、限额、资料保存、已知样式问题和写入候选均保留。

保留原生截图，不重画产品界面。新增的 `docs/screenshots/readme-flow.svg` 是静态流程示意，包含title/desc、明确背景、系统字体，无脚本、外部资源或foreignObject，文件位于既有成品包白名单覆盖的目录。

| 检查 | 结果 |
| --- | --- |
| oil-tone | 中英文README及PROMOTION通过 |
| README/SVG审计 | 两种语言各3张图片引用及SVG基本检查通过 |
| 双语一致 | 工具名、图片、构建命令一致；各保留5条未来候选 |
| 相对链接 | 两份README共40处有效，其中12处包含本地章节锚点 |
| 原生截图 | Hash/Stream的SHA256与原文件一致 |
| 原生浏览器预览 | 中英文×明暗×宽窄共8组；图片均加载，无整页横向溢出 |
| 展开详情 | 中英文均展示2张完整表格及Stream原生图，展开后无整页横向溢出 |

宽屏检查使用980px视口和900px内容列；窄屏使用360px视口，原生滚动条占用后内容列约344.8px，符合实际可用宽度。8组已保存原始截图并人工查看；截图API返回JPEG，文件按真实类型命名为 `.jpg`，未修改图像内容。

预览使用原生in-app browser与本地Markdown渲染，不冒称GitHub线上验收。检查文件位于忽略目录 `.scratch/artifacts/marketing-20261020/`，机器可读结果为 `readme-preview-checks.json`。浏览器临时视口覆盖已复位，所属预览页及服务已关闭，没有操作日常DSH标签页。

本轮没有运行产品服务、真实Redis或真实模型，没有更改运行源码、依赖、锁文件或安装，也没有为文档修改重复执行既有205项产品回归。仅做本地文档与视觉检查，不发布或推送。

## 封面交付

复用已有隔离Hash截图与项目icon.svg。参考图先归档并查看，原图标仅原样栅格化为供内置工具参考的PNG；三份prompt在调用前写入[素材sidecar目录](../promotion/dsh-redis-demo.oil-cover/)。使用内置 `image_gen.imagegen`，每画幅独立调用一次，无外部服务Key、无头像、无返工或额外候选。

| 画幅 | 本地文件 | 实际尺寸与检查 |
| --- | --- | --- |
| 3:4 | [竖版](../promotion/dsh-redis-demo_3x4.png) | 1086×1448，精确3:4 |
| 4:3 | [横版主封面](../promotion/dsh-redis-demo_4x3.png) | 1448×1086，精确4:3 |
| 16:9 | [横向伴随版](../promotion/dsh-redis-demo_16x9.png) | 1672×941，近似16:9；没有裁切凑比例 |

三幅完整解码通过；最终图、保存的无人物底图及工具原始PNG逐字节一致。逐张人工核对标题“在 DSH 里 / 查看 Redis”、副标题“六种类型 · 只读查看”、项目图标、选中Hash行与同屏预览，无人物、写入、图表、性能或官方合作暗示。界面是工具重绘的推广视觉，不是产品原始截图或新增运行验收证据。

原生浏览器并列预览的实际图片宽约298.7px，三幅主标题可辨识、图片完整加载。预览页已关闭、视口已复位、所属服务已停止；证据为忽略目录内 `cover-thumbnails.jpg` 与 `cover-thumbnail-checks.json`。没有对最终图进行本地贴字、贴Logo、拼贴、裁切或视觉修补。

[素材索引](../promotion/README.md)、[方案与提示词入口](../promotion/dsh-redis-demo.oil-cover/cover_plan.md)、[生成与校验记录](../promotion/dsh-redis-demo.oil-cover/generation-record.json)均已保存。记录只保留实际工具返回字段名、MIME、源文件名和可验证文件数据，不伪造模型名，省略本机默认输出绝对路径。README仍只使用原生Hash/Stream截图与确定性流程示意。

最终检查覆盖12份相关Markdown、90处本地链接，围栏和路径通过，无机器盘符绝对路径或明显凭据内容。三个成品、底图及源工具文件哈希一致，三份prompt齐全；源截图、项目SVG图标、运行源码、依赖与锁文件未变。双语README与PROMOTION的oil-tone检查、两份README图片/SVG审计再次通过。三个小目标分别本地Git提交，不推送、不发布。
