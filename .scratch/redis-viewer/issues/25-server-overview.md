# 25: 查看 Redis 服务器概览快照

**What to build:** 用户打开概览查看 INFO 中的选定服务器、内存、连接和计数信息，并手动刷新。

**Blocked by:** 06 查看 String 的元信息和四种基础格式

**Status:** done

**Priority:** P1

- [x] 缺字段、权限不足、计数/单位和采集时间明确。
- [x] 只调用固定只读诊断入口，结果有预算，不修改服务器配置。
- [x] 读取、解析、卡片展示和真实版本样本验证形成闭环；持续图表不塞入本票。
- [x] 验证本票读取的只读命令、字节身份、目标代次、权限/消失/类型变化、取消/超时和实际结果边界；输出截断不冒充驱动接收内存受限。
- [x] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## Comments

2026-10-16：24完整提交6927426后开始25，阻塞06已done。LUNA只读描述现有DTO/transport白名单/10秒read-context/目标代次/RESP预算；已读Redis官方INFO字段定义。沿用一条固定无参数INFO，不向客户端开放命令或section输入；Host选16个服务器/内存/连接/统计字段，缺失/非法值为未报告，计数保持uint64十进制文本与单位/本机采集时间。先做纯解析/严格DTO/Host读取和专项，再在独立概览入口按卡片手动查看，不堆主工作台或加入持续图表。五项尚未验收。

状态原型：[可双击文件](../../artifacts/server-overview.prototype.html)，单文件内存reducer+自由操作+3组引导，源捕获于 prototype/server-overview-state / d1feeac050ff7a2f060128bf0b3964876fcc728a，路径 src/client/prototypes/server-overview.prototype.html（不进main）。根据动作与代次规则，正式实现采用显式打开/刷新、关闭清空/abort、旧请求丢弃；这是实现判断，不声称用户已经试用确认。

完成：模型里程碑5518993后，同包01a92d9通过prepack258、原生INFO21、完整SDK/数据/会话87、布局24；全部自建进程/夹具/代理停止。正式证据见[25验收](../../../docs/verification/25-server-overview.md)，真实/注入/预算/版本边界在该文档分别说明。
