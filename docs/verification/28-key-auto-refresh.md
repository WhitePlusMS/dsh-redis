# 28：受控自动刷新当前 Key（进行中）

01–27 done，28进行中，29 ready。原29票图不变。

## 基础与范围

依据固定rc.2的ui-sidebar-right/src/client/contract/slots.ts和tab-info.ts，PropsRuntime注入useTabInfo返回tab.visible及记录寿命signal；隐藏与session switch不会abort记录signal，必须同时观察visible。浏览器[visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)覆盖页面隐藏；[React external store](https://react.dev/reference/react/useSyncExternalStore)遵守缓存不可变snapshot与稳定订阅。实际React仍锁18.3.1，未采用新版本API。

一个Key边界一个纯调度器，Reader token只归属当前查看方式；一个完成后计时的one-shot timer，1/5/10/30秒、默认5秒。不会更换连接/DB或新增Host方法。原只读命令、字节/代次、取消/10秒和RESP接收/语义预算继续由既有Host负责，自动读取不提高边界。

隐藏/取消/失败/变型或owner变更停止且不自动恢复；正在排队的React自动effect在停用后不得发起读取。默认工具栏小开关；查询范围沿用已提交状态，集合重新读取首个有界页、无游标自动排空，Bloom只统计不重放成员判断。不持久化enabled、计时器、读值。

原型指针与状态裁决见原28票，HTML仅throwaway分支。模型、UI、真实原生验证尚未完成，五项未勾。

## 调度模型里程碑

严格三层TS、构建、28文件286项通过，其中9项新调度行为：默认不读/最小间隔、慢读不重叠/完成后计时、手动读取重置等待、隐藏取消/恢复不启用、tick同步复核可见、停用后排队effect拒发、错误/消失/变型停用、旧owner不可影响新、卸载/订阅释放。原始输出见[model-check-console.log](artifacts/28-key-auto-refresh/model-check-console.log)。当前模型尚未接UI，真实原生验证未执行。
