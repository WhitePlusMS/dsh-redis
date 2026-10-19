# 2026-10-20：README 动画标题检查

## 范围与来源

用户指定参考维护者的 GitGraph README 顶部标题。已读取该 README，确认其嵌入 `readme-header.gif`、提供 `readme-header.svg` 静态入口；当前 GitGraph 工作树未保留这些素材，故只读提取其 HEAD 中的素材查看，不恢复文件或修改该项目。参考 GIF 实际为1200×280、5秒、589794字节；没有将其 Git 图标、版本和功能移植到 Redis。

Redis 标题复用现有 icon.svg 数据库路径和青紫橘导航色，按 DB→目录→Key 依次强调。文字始终可见，图标静止停留后淡出，不模拟真实数据活动。它是可编辑的标题示意，不是产品操作录像。两份 README 顶部共用 GIF，并提供静态 SVG 入口；去除这两处新增后，正文与上次提交逐字相同。

## 文件

- [动画成品](../screenshots/readme-header.gif)
- [静态标题](../screenshots/readme-header.svg)
- [动画源 SVG](../screenshots/readme-header-motion.svg) 与 [运动配置](../screenshots/readme-header-motion.json)
- [素材来源说明](../screenshots/README.md)

## 导出与动效

环境没有 ffmpeg、ffprobe 或 rsvg-convert，未安装新依赖。使用 beautify-github-readme 的命名层提取、缓动与 `build_frames` 合成逻辑，以本机已存在的 Sharp 栅格化，Pillow 共享调色板编码 GIF；直接完整解码核对，未声称执行 ffprobe。

第一轮导出发现色键在调色板中重复，透明角落断言失败；编码器去除重复色键后重新导出，只有通过下列检查的最终 GIF 交付。临时生成器、150张源帧、检查 JSON 和接触表均在忽略目录 `.scratch/artifacts/readme-header-20261020/`，不属于运行源码或成品包。

| 项目 | 最终结果 |
| --- | --- |
| 画布 | 1200 × 280 |
| 源帧 | 150帧，30 FPS |
| GIF 帧 | 75个编码帧；相同帧按时长合并 |
| 时长 | 5000 ms，无限循环 |
| 体积 | 199871字节，约195.2 KiB |
| 静止停留 | 1.6–3.9秒逐像素一致 |
| 首尾 | 第一帧与末帧逐像素一致 |
| 透明度 | 全帧透明轮廓一致，四角色键正确透明，无抖色 |
| SHA256 | `18da152aa658a49292b66a71359262f59324c9f4ab8fbd480a17edf8a3639597` |

已人工查看进入、首次稳定、停留、退出与循环边界接触表，并查看静态标题。名称、用途文字和透明边角无裁切；动效只有三个图标强调层，不改变背景或文字位置。

## 文档与浏览器检查

- 两份 README 图片审计均通过，每份4个图片引用；两份新增 SVG 的XML、viewBox、title/desc、ID唯一性检查通过，无脚本、外部图片、foreignObject或SVG内置动画。
- 两份 README 与素材说明共51处本地引用、12处章节锚点有效。两种语言去除顶部GIF及静态入口后与 HEAD 正文一致。
- 原始项目icon.svg、Hash/Stream原生截图、已有readme-flow.svg字节不变；运行源码、依赖、锁文件、包清单和版本未变。当前目录已在成品白名单中，无需扩大打包范围。
- 原生 in-app browser 中完成中英文 × 明暗 × 宽窄共8组预览：宽屏980px视口、900px内容列，窄屏360px视口、实际约344.8px内容列。GIF实际宽约834.4/311.2px，所有图片加载、静态入口存在、无整页横向溢出；8张原始JPEG和双语接触表已保存并人工查看。
- 预览为本机 Markdown 页面，不代表 GitHub 线上发布或验收。临时视口已复位、所属预览标签已关闭、所属HTTP服务确认停止，日常DSH标签及服务未操作。

只交付文档素材，不重复执行205项产品回归，不启动开发服务、不连接业务Redis、不使用网页GPT评审。按既有授权本地Git提交，不发布、不推送。
