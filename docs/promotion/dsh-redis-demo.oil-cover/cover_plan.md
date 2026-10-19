# 封面方案与交付

主标题为“在 DSH 里 / 查看 Redis”，副标题为“六种类型 · 只读查看”。使用原有DSH Redis图标与产品名，不扩展为官方品牌合作。中文为现代黑体，Redis采用衬线层次，标题为深石墨色，Redis后有浅紫色高亮。背景为雾蓝/淡紫纸面氛围与细网格，界面保留青紫橘导航。

| 画幅 | 最终图片 | 实际尺寸 | 构图与检查 |
| --- | --- | --- | --- |
| 3:4竖版 | [dsh-redis-demo_3x4.png](../dsh-redis-demo_3x4.png) | 1086×1448，精确3:4 | 标题在上、选中Hash与预览在下；文字正确，选行可识别，无人物或写入暗示 |
| 4:3横版主封面 | [dsh-redis-demo_4x3.png](../dsh-redis-demo_4x3.png) | 1448×1086，精确4:3 | 标题在左、Hash证据在右；标题与图标完整，数据查看逻辑与素材一致 |
| 16:9横向伴随版 | [dsh-redis-demo_16x9.png](../dsh-redis-demo_16x9.png) | 1672×941，近似16:9 | 横向延展、选中行与JSON预览突出；保留工具实际尺寸，没有本地裁切凑比例 |

三幅各由内置 `image_gen.imagegen` 独立调用、一次整图生成。主标题、副标题、产品识别、无人物、选中行和预览均已人工查看。没有因纯审美偏好返工，不生成额外变体。

原生浏览器中以约299px宽并列查看三幅缩略图，主标题和产品名称仍可辨识，图片均完整加载；预览服务已关闭，临时视口覆盖已复位。

## 参考与提示词

- 屏幕证据：[frames/hash-workbench-dark.jpg](frames/hash-workbench-dark.jpg)，来自[原生Hash截图](../../screenshots/hash-workbench-dark.jpg)，仅含隔离测试数据；输入副本为[dsh-redis-demo.jpg](../dsh-redis-demo.jpg)。
- 图标：[frames/dsh-redis-icon.png](frames/dsh-redis-icon.png)，由[项目原icon.svg](../../../icon.svg)原样栅格化，保留[SVG副本](frames/dsh-redis-icon.svg)。没有替换项目图标。
- [3:4完整提示词](cover_3x4.prompt.md)、[4:3完整提示词](cover_4x3.prompt.md)、[16:9完整提示词](cover_16x9.prompt.md)。三份均在对应调用前保存。
- [生成与文件校验记录](generation-record.json)保留实际工具返回字段名、MIME、源文件名、图片尺寸和SHA256；不编造模型名或内部响应结构。电脑默认输出路径只在忽略目录保留，不放进可移植素材记录。
- 无人物底图分别是[3x4.generated-base.png](3x4.generated-base.png)、[4x3.generated-base.png](4x3.generated-base.png)、[16x9.generated-base.png](16x9.generated-base.png)，与最终图及工具原始PNG逐字节一致。

未启用创作者头像，没有上传头像或执行头像合成。最终图片没有本地贴字、贴Logo、拼贴、裁切、重排或视觉修补。

这些是参考真实素材重构的推广封面，界面细节经过生图工具重绘，不是产品原始截图、真实模型回答或新的验收证据。README继续使用未改动的原生截图。
