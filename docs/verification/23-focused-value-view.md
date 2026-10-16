# 23：聚焦详情、搜索与 JSON 折叠（进行中）

前置20及22均已完成。原票23仍为P1/in-progress，24–29未开始；不将当前模型检查记成实际界面或完整项目完成。

## 状态预览

交互问题是：显式进入/退出聚焦、查找当前已读内容、折叠和复制后，是否保留同一份Key/格式/预览而不重读。默认继续现有左右工作台，按钮进入原位聚焦时才临时收起左导航，退出回原位置。

原型在独立分支`prototype/redis-focus-state` / `b024bbedf084b87c97149b5a51cd2f4435fcc6de`，源路径`src/client/prototypes/redis-focus.prototype.html`；本地ignored副本`.scratch/artifacts/redis-focus.prototype.html`可双击。它是纯内存reducer、状态面板和聚焦往返/搜索范围/折叠复制三引导，未接Redis，未浏览器/宿主验收。主分支不合HTML壳，也不绕过之前file://浏览器限制打开。可选偏好已发；未收到不同偏好时按该原位方式继续，不称用户已经确认。

## 已完成的纯模型

- [value-preview.ts](../../src/client/value-preview.ts)将原512Ki字符输出上限以`MAX_PREVIEW_CHARACTERS`导出供同一预览链路复用，数值、UTF-8处理和保留数值token的formatter行为不变。
- [loaded-content.ts](../../src/client/loaded-content.ts)只接收本地已读预览文本。字面、区分大小写、不规范化Unicode、不重叠搜索；查询最多256 UTF-16代码单元且有效Unicode。完整统计当前预览命中数量，最多保留前1000范围供导航/高亮；限制状态必须在UI如实显示，不能冒充已搜索Redis完整值。
- JSON折叠输入是已经过原formatter校验且保留token的文本。扫描引号/转义和括号原位置，不JSON.stringify、不读取解析后的JS数值；深度沿用64。至多记录512个多行块控件，保留根块，其他内容仍作为原文可见，标明控件上限。
- 折叠投影仅引用源字符串范围：折叠祖先时省略后代控件，展开可精确恢复源文本；省略号属于显示片段。复制必须继续使用完整当前formatter文本，不从折叠DOM回拼。
- [loaded-content.test.ts](../../tests/loaded-content.test.ts)覆盖字面元字符、Unicode形式/emoji、空/无命中/无效查询、命中与文本上限、转义括号、重复字段、大整数/指数/-0、父子折叠及完全恢复、1200对象下512控件上限和结构失败。

## 当前验证与待办

三层严格类型、完整构建和238回归通过，含新增6项模型专项。[实际输出](artifacts/23-focused-value-view/model-check-console.log)归档当前完整check。首轮专项一处测试将emoji后UTF-16偏移手算17而非16（结束20），逐字符核实并仅修测试预期；18/19通过阶段不冒充最终通过。

尚未接入生产BytePreview和聚焦布局，尚未打包/安装/真实Redis或DSH验证。接续内容是共享预览内的有界高亮与JSON控件、局部快捷键与复制、保持同一DOM/选择/滚动的显式聚焦，然后对当前包验证无额外Redis命令、跨类型、预算/代次、取消/超时、主题/宽窄/位置及实际源字节边界。界面继续紧凑，详细解释放按需帮助，错误/部分读取不隐藏。
