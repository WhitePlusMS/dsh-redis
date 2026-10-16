# 28: 受控自动刷新当前选中 Key

**What to build:** 用户手动开启当前 Key 的自动刷新，能看到时间与失败状态，隐藏或关闭面板后停止。

**Blocked by:** 19 取消读取并从超时或断线中恢复

**Status:** done

**Priority:** P1

- [x] 定时读取不叠加无界请求，不跟随旧会话/旧 DB/旧 Key 继续刷新。
- [x] 可见性、取消和连接状态共同控制刷新，恢复可见时不自动新建连接。
- [x] 验证最小间隔、慢请求、断线、退出与资源释放，不引入持续订阅。
- [x] 验证本票读取的只读命令、字节身份、目标代次、权限/消失/类型变化、取消/超时和实际结果边界；输出截断不冒充驱动接收内存受限。
- [x] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## Comments

2026-10-16：27完整提交44d0043后开始，依赖19已done。只针对当前已打开Key，默认关闭、手动开启；复用原reader与原生slot useTabInfo可见性，不增加Host RPC。最小1秒、默认5秒，完成后再等待，失败/隐藏/取消/Key或查看器切换停用，恢复不重连/不重放；游标集合重读首个有界页，Bloom自动仅统计。

状态原型：prototype/key-auto-refresh-state分支355df0c14a319cbdb58b9a29cd4d62e6d6701c5a，src/client/prototypes/key-auto-refresh.prototype.html；本机双击副本E:/项目demo/dsh-redis/.scratch/artifacts/key-auto-refresh.prototype.html。四个引导和自由操作覆盖正常、慢请求隐藏、换owner迟到、失败取消；根模型以该状态推演提取单一调度模块，不等于用户已确认界面/状态。HTML壳不进main。

2026-10-16：最终4cc78d01完整验收：严格286、自动刷新原生26、完整12类型/双会话/实际27方法SDK87、工作台24通过；取消27ms、实际Host截止10058ms、真实生命周期/权限/预算/精确参数与保留成功时间均有证据。52原件含三次测试失败和旧checkpoint，明确不混作新包通过。全部自建资源已停，完整实现/边界见docs/verification/28-key-auto-refresh.md；29仍待实现（独立内存曲线原型已准备）。
