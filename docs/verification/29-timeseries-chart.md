# 29：已读 TimeSeries 样本曲线（进行中）

01–28 done，29进行中；原29票图不变。

## 数值来源与最简范围

既有domain/TimeSeries Host双端严格DTO给出timestamp/value字符串；当前固定Redis8.2.6、TimeSeries80210语义由16实际证据及本轮后续实连核对。时间0..Int64最大值、每页100/缓存5000或2MiB，finite value，RANGE/REVRANGE按方向严格顺序。新曲线只读取同一cache，既有Host/API不改。

依据[BigInt转换的精度约束](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)先用BigInt计算时间差，再生成百万分之一归一化屏幕比例，绝对时间不先转Number；[Date显示边界](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)为8.64e15毫秒以内，可安全转Number后toISOString辅助UTC，超限仍完整显示原始毫秒。当前浏览工具访问TS.RANGE页面未获得正文，不据此增加任何服务器语法；沿用已验证的16实现与实际DTO。

取已读前512点（按读取顺序），排序副本按时间升序绘制，报告loaded/drawn/omitted与实际起止；其余完整保留原表格，不做平均/抽样改值。不把局部已读图当全历史，屏幕坐标近似，原始毫秒和值为准。数值先按最大绝对值归一再减，避免相反double极值溢出；常量/单点居中、空不造零、非法/重复任一项拒绝整图不静默丢弃。

原型指针见原29票，无DB/浏览器/测试；以下保留模型阶段记录；界面/原生尚未验收，五项不勾。

## 投影模型里程碑

严格Host/Client/tests类型、构建、29文件296项通过，含10项新曲线模型行为；[原始控制台](artifacts/29-timeseries-chart/model-check-console.log)。验证相邻53位/Int64上界、全跨度、反向前512点与不改源、极值/微小值原文、空/单点/常量/零、异常整幅拒绝（含第513点）、UTC边界及5000缓存行的有限有界坐标。纯投影不调用Host；尚未接UI或真实原生。
