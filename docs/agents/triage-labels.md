# 任务状态词汇

- `ready-for-agent`：已审阅，须在前置完成后执行。
- `in-progress`：当前正在实现或验证。
- `done`：所有验收项有实际证据，已记录验证与未覆盖范围。
- `verification-blocked`：实现已有结果，但外部环境或人工步骤仍缺，不能视为完成。

`Blocked by` 单独表示依赖；ready 不会自动解除依赖。实际进度看任务文件及索引。
