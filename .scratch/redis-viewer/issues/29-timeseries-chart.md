# 29: 把已读取的 TimeSeries 样本显示为曲线

**What to build:** 用户在样本表格与曲线之间切换，查看选定时间范围中的实际已读数据。

**Blocked by:** 16 按时间范围查看 TimeSeries 样本

**Status:** in-progress

**Priority:** P1

- [ ] 曲线保留时间精度与时区说明，不把局部样本画成完整范围。
- [ ] 大量样本有可说明的显示预算/抽样规则，不悄悄删除异常值。
- [ ] 空范围、重复刷新、布局和数据点提示可验证；不额外查询无限历史。
- [ ] 验证本票读取的只读命令、字节身份、目标代次、权限/消失/类型变化、取消/超时和实际结果边界；输出截断不冒充驱动接收内存受限。
- [ ] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## Comments

2026-10-16：28完成提交a02d065后开始，依赖16已done。曲线只使用已读TimeSeries cache，不新增Host RPC/范围或无限历史查询。首512按读取顺序取、再按时间升序绘制；其余仍留表格且明确未绘制数，屏幕坐标近似、原始Unix毫秒/值完整，UTC只在Date范围内作辅助。BigInt差后投影，double先归一避免极值减法溢出，非法/重复整幅拒画不静默过滤。先纯投影/10项测试，后表格/曲线切换、键盘/点详情与真实原生验收。

一次性内存原型：prototype/timeseries-chart-state分支d66eebd625a91822f0fd7072da53687609f768bf，src/client/prototypes/timeseries-chart.prototype.html；双击副本E:/项目demo/dsh-redis/.scratch/artifacts/timeseries-chart.prototype.html。三个引导/自由操作观察近53位/Int64极值、512前缀/反向/空与故障/Date范围。根模型选定上述数值和预算方案，待生产测试验证，不等于用户认可视觉；HTML壳不进main。
