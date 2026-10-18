# A方案状态控件 P0+P1 验证

用户授权：按A“就近收纳”直接修改P0+P1，更新日常DSH，每个小目标本地提交。实施起点`6233a26`，固定DSH/SDK 0.2.0-rc.2；只修改查看器显示层，不增加写入或任意命令。

## 修改、原因和影响

| 文件 | 修改与原因 | 影响 |
|---|---|---|
| AutoRefresh、KeyBrowser | 自动刷新组合开关/间隔位于页签旁，读取时间按需展开，provider覆盖当前Key | 启停不增加状态行；复用原Clock，不增加轮询 |
| BytePreview、Icon | 原复制按钮短暂对勾，失败就近；补同风格状态图标 | 双预览独立；切行/格式/卸载清迟到反馈 |
| KeyPresentation、ReadControls（新增） | 叶视图只提升元信息，统一刷新/取消/范围/进度/按需时间 | 所有权清理；原结果、游标和reader仍各自持有 |
| KeyBrowser、Hash/List/Set/ZSet/Stream | 类型/TTL集中标题，数量/部分/MATCH/非零范围简化，范围按需展开 | 不拿全Key总数伪造筛选进度，选行和触底续读保留 |
| KeyDetails、JsonView、BitmapView | 字节/位范围、下一窗口、JSON提交路径与摘要 | 手动刷新用提交条件，下一窗口不使用未提交count；null与无匹配不同 |
| Geo/Hll/Bloom/TimeSeriesView、TimeSeriesChart | 专用读取控件与关键结果，其他属性留元信息/原字节折叠 | 保留GEO解释/量化、HLL估算、Bloom概率与INFO权限、图表已读范围 |
| RedisWorkspace、ConnectionForm | 只读具名锁，Host/版本按需；测试反馈在按钮，正常底栏压缩 | 测试不等于连接；草稿变化清旧结果；实际错误继续可见 |
| ProfileChooser/ConnectionUri/ProfileTransfer | 清重复说明、重载/文件忙态就地、导入资料提示精简 | 保存/连接/导入仍保留短文字和原显式动作 |
| SnapshotDialog、ClientList/SlowLog/Overview | 快照刷新/取消/按需时间，数量及部分标记 | 无持续监控；客户端截断、慢日志更多、未报告字段不丢失 |
| HelpDetails（删除）、locales、styles | 无调用后清组件/CSS及17组双语长文，统一布局/焦点/减少动态效果 | 无新依赖或兼容层，技术边界留文档 |
| README、审查/实施清单、UPDATE_LOG | 同步实际操作、历史与当前边界、检查/安装记录 | 不将历史原型或旧包验证当作本包通过 |

## 已执行的候选验证

候选SHA256：`2e8238dac92f3f14a9bdb8bdd40fbf10e278571750a289b510012f5acc2e5d23`。默认`pnpm pack`触发三层严格类型、standalone构建、32文件318回归，全部通过。

独占官方Redis8.2.6与隔离DSH，用CUA操作实际页面，18组记录见`artifacts/state-controls/candidate-native-checks.json`：

- 连接测试原位通过；修改草稿清除旧结果，测试未自动连接。
- 字段复制不误亮值按钮；自动刷新真实发起下一轮，工具带保持33px；时间按需展开，聚焦显示DB。
- List非零范围和未提交草稿；Set238/ZSet237/Stream235选行继续加载，重复Stream字段保留第二次值。
- 取消忙态在控件，取消提示一次，迟到回复不污染新Key；大String显示65536/131073字节部分。
- Bitmap原始24位、HLL约3、RedisJSON大整数/null/无匹配/提交路径、GEO解释及坐标。
- Bloom可能存在/本次阴性、查询原字节折叠；TS700样本绘制512点，188未绘，显示已读范围。
- BF.INFO/TS.INFO权限拒绝明确，BF.EXISTS/TS.RANGE仍可用；三个快照数量/部分/16字段与按需时间。
- 464px深浅、全屏布局无工作区溢出，表格与预览局部滚动。合成截图保存在同目录。

14份Key DUMP与Stream消费组状态不变；代理只观察固定读取、没有KEYS/写命令/协议错误。DSH/代理/Redis已停止，新fixture已清理。候选后仅收尾List/GEO重复错误及测试失败按钮反馈；以下最终包专项单列，不把候选操作冒称最终包全量复跑。

## 最终包专项与日常安装

最终SHA256：`6194353d9b58f2f74a17fdff00546995ba3488c5646296152b20b511d63fd319`。默认prepack再次完成三层严格类型、standalone构建和32文件/318回归；未在仅文档归档后重复运行。

最终原生CUA专项7组通过（`final-native-checks.json`）：

1. 测试连接失败原按钮为警告，详细错误一次；修改草稿清除旧状态，重测可恢复通过。
2. 用独占夹具的LRANGE/GEOPOS拒绝用户验证List/GEO实际权限错误各一条。
3. Hash字段复制仅字段按钮对勾，值按钮保持原状。
4. 自动刷新实际触发读取，工具带保持33px；间隔可恢复5s。
5. 元信息仍可查询；Host/版本按需展开，正常不占底栏。
6. 464px深色侧栏实际宽464.11px，工作区scrollWidth/clientWidth均464；无全局溢出。
7. DB3的5100 Key自动扫描停止于5000，显示“部分”，没有100%或全量完成误报。

最终14份Key DUMP和Stream消费组状态不变，代理未观察到写命令/KEYS/协议错误；所属DSH、代理、Redis停止且新fixture已清理。`final-read-summary.json`/`final-cleanup.json`保留证据。历史smoke-dsh全模式未在本轮执行，本轮原生检查为CUA实际操作，不将旧脚本结果计为本包通过。

日常web profile五文件先备份；安装唯一SHA包后，98个发布文件与实际安装逐字节一致，88个lib同时与本机构建一致（`package-manifest.json`）。仅package.json/pnpm-lock.yaml插件引用变化，其他依赖、bundles、cordis配置未变。核对旧7198/PID11652归属后，仅停止该所属进程树，隐藏重启为PID39180，仍监听127.0.0.1:7198。

实际页面已手动连接用户127.0.0.1:6379，DB0自动读到760/760，打开8字段Hash、选行并切换值JSON；新工具带33px。业务内容/截图与认证URL只在忽略目录，入库报告仅保留数量和安装校验。日常页面已打开并保留供用户查看，自动刷新仍需用户手动开启。

日常7198按用户明确要求保留，临时验证服务完成后停止；业务数据、凭据、认证URL与profile备份不入Git。没有运行npm dev/start:dev、网页端GPT审查或推送。

![最终包合成Hash效果](E:/项目demo/dsh-redis/docs/verification/artifacts/state-controls/final-hash-dark.png)

上图为最终包在独占Redis上的合成数据，用户真实业务截图不随报告提交。
