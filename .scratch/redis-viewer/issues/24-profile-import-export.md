# 24: 整理、导入和导出连接资料

**What to build:** 用户重命名/分组连接、录入 URI，预览导入配置并导出非敏感资料。

**Blocked by:** 04 保存和重新选择个人连接配置

**Status:** done

**Priority:** P1

- [x] 导出无密码等秘密，URI 输入不进入日志或错误回显。
- [x] 导入冲突有明确处理，保存后不自动连接。
- [x] 导入/导出/分组与重开后的实际选择流程通过，保持配置与秘密分离。
- [x] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## Comments

2026-10-16：23完成并提交e55b255后开始本票。状态原型在独立prototype/profile-transfer-state分支10ff150b962c997bf8d2bfb02deaa0163136205c，源src/client/prototypes/profile-transfer.prototype.html，ignored副本.scratch/artifacts/profile-transfer.prototype.html可双击；纯内存、无Redis/测试/服务，主分支不合原型壳。保持现有设置对话框和默认左右工作台；同组同名导入须改名或跳过，Host整批拒绝并发新冲突，不自动覆盖/连接。导出只白名单字段，不含密码/CA/运行身份；URI密码只留表单、DB仅填会话草稿。四项尚未验收。

2026-10-16：第24项模型/Host首批三层类型/完整构建/250回归通过（新增12项），真实结果见docs/verification/24-profile-import-export.md及两份原始日志。可选group/严格无秘密资料、基础URI解析、Host队列内原子批导入和24方法codec已接入；界面与实际安装包/Redis重开流程尚未验证，四项继续为空。按小目标先本地提交，不将原型或模型结果冒充本票完成。

2026-10-16：同包37b335dd严格类型/构建/250回归、资料18/17两轮实际DSH、全类型/双会话/24方法SDK87、中英明暗工作台24及TLS冷重启17/17全部通过。43原始证据/完整输入与包清单、文件格式和逐步实现见docs/verification/24-profile-import-export.md。实际上传下载、无密码/CA导出、冲突改名/跳过/整批拒绝、分组稳定id重开、URI草稿和手动DB/连接、关闭秘密与迟到预览均据范围勾选；当前01–24done、25–29ready。全部本轮进程/Redis/目录与精确owner测试资料清除；原29票图不改，核对后本地提交。
