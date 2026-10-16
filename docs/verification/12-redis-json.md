# 12 RedisJSON 根值和 JSONPath 验收

验证日期2026-10-16，用户指定DSH0.2.0-rc.2（RC），精确CLI/SDK，Node22.22.1、pnpm11.22.0，独立DSH_HOME/test profile；只证明本票和所列回归，不代表完整29票或所有服务器/平台通过。

## 环境与产物

- Redis8.2.6官方固定镜像文件，显式wsl-image执行；image sha256 ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e，amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e。不是Docker验收。
- 实际MODULE LIST：ReJSON ver80209，TYPE ReJSON-RL；只声明该实际环境，未虚构其他模块或版本通过。
- 包SHA256 `02c557bc4d2d5ca3bc7615f9eaa909e29636260ed59b5862fefa0440f2f082ea`，SHA命名安装，安装lib与当前构建54文件逐字节一致。
- 三层严格类型、构建与155项回归通过（JSON13项），真实Redis8组、原生安装包51组通过，包含所有既有基础类型及TLS/DB回归。根值和路径两张截图均已查看。

## 功能与只读证据

1. 按真实ReJSON-RL进入专用视图；原始Key保持Base64字节身份。只接受显式JSONPath（$开头、最多1024字符、无控制字符），Redis检验完整语法；不回退旧路径语法。根值和路径保留服务器序列化匹配数组，$显示[root]，不擅自去掉数组或经Number重写。
2. 实际9007199254740993路径原文为[9007199254740993]，UTF8、根数组、数组切片、多匹配与类型信息通过；原生Text/JSON/Hex/Base64与服务器原文一致。JSON解析仅验证形状，展示和外发仍是原字节。模块本身会规范化输入JSON，本票承诺保留读取回复，不承诺还原最初写入拼写。
3. JSON null匹配[null]、空数组值[[]]、无匹配path-missing、缺Key missing、普通String unsupported、语法invalid-path和权限permission分别验证。未知命令unavailable由专项及取得真实服务器未知命令回复后的明确Host fault injection证明；**未冒称无模块服务器的完整实连验收**。无模块服务器不可能已有该模块Key，不能为造场景破坏用户服务器。
4. 固定TYPE/PTTL/JSON.TYPE/JSON.GET及后置检查，无JSON.SET/DEL/其他写命令入口；实际DUMP、绝对过期时刻、JSON/核心写命令计数不变。最小ACL成功，独立拒绝JSON.TYPE/GET均为permission，JSON.SET被禁止。连接层只在Host内部保留服务器拒绝供reader分类，先检查目标守卫；固定DTO不含原始错误文本。
5. 完整匹配序列化结果最多64KiB/4096项，接收全帧和外发JSON各1MiB。65536边界成功，65537字节、4097匹配、70KiB根值均拒绝整结果，不显示半段JSON或伪页；缩小路径可在同socket恢复。2MiB单节点在有界接收层拒绝并关闭自身socket，其他会话不受影响，手动重连恢复。原生根值超限后$.small成功，无Next window假分页。
6. 一次操作共用10秒截止，调用方取消与旧session/DB/代次、迟到服务器拒绝由13项专项覆盖；真实DB切换隔离旧目标。实际JSON.GET前/后管理员只改自有race Key，类型改变、删除和匹配基数变化均丢弃结果；读取不是原子快照，同类型/同基数的内容替换仍可能不可检测。
7. UI路径草稿不查询，提交后旧数据清除；客户端无效路径保留已提交数据并报错。原生路径切片、null/空/无匹配、服务端语法错误、超限恢复和删除/转String均通过。取消UI代码沿用独立AbortController；本票没有额外慢服务器UI取消验收，统一恢复流程仍由19负责。

## 失败与范围记录

首次专项暴露连接层过早将服务器拒绝变为network，修正内部错误边界后155项通过；首次真实race脚本未清除上一轮留下的String导致下一轮JSON.SET失败，修正仅为每轮预置前DEL自有race Key，真实8组随后通过。尝试启动重命名模块JSON.GET被Redis初始化顺序拒绝，已撤回全部fixture参数/配置改动，未计通过；不尝试卸载注册自定义类型的模块。

自有Redis/DSH/浏览器均停止，证书与UUID目录已清理，报告均确认；未改用户业务Redis或日常profile。安装提示peer warning，具体归属仍按真实隔离profile依赖事实核对，不以原生通过冒充全部peer要求已无告警。

证据：[Redis](12-redis-json-smoke.json)、[原生](12-native-json-smoke.json)、[根值截图](12-native-json-data.png)、[路径截图](12-native-json-path.png)。官方语义：[JSON.GET](https://redis.io/docs/latest/commands/json.get/)、[JSON.TYPE](https://redis.io/docs/latest/commands/json.type/)、[JSONPath](https://redis.io/docs/latest/develop/data-types/json/path/)。
