# AuditFlow AI Web 工作台

这是在现有 `aspice-audit-master` 证据分析原型之外新增的完整评估师工作台。它覆盖 ASPICE 评估计划、过程实例、参与者与工作区、访谈日程、Tree/Grid 现场执行、六类记录、Evidence Inventory、Indicator–Evidence Trace Studio、Guideline/TAA、AI 初评、合并定稿、质量门禁、版本历史、本地整改闭环与多场景报告。

## 启动

在仓库根目录执行：

```bash
npm start
```

然后访问 <http://127.0.0.1:4173/web/>。首次运行需先执行 `npm install`，以安装本地 Office/PDF 解析依赖。

也可以直接打开 `web/index.html`。推荐使用本地服务器，以避免浏览器对 `file://` 下载、跨页面链接和模型接口的限制。

## 当前数据模式

- 项目、方案、评分、证据索引与设置保存在浏览器 `localStorage`。
- DOCX、PPTX、XLSX/XLSM、PDF、CSV、JSON、HTML 和文本均在浏览器内解析；Office 表格保留 Sheet/Slide、表名和行定位。
- Helix 导出会按唯一 ID、状态、责任/批准、版本/基线、上下游追溯、影响/关闭字段生成完整性分析。
- 首页 Dashboard 每 5 秒刷新项目阶段、证据解析、AI/人工复核、开放弱项、阻塞项和 Helix 状态统计。
- 项目“追溯”页使用三栏工作台：左侧 ASPICE 过程/PA/BP/GP 模型树，中间指标—证据关系与 Map Set，右侧按过程相关性、可定位性和 Helix 字段排序的证据候选。
- AI 推断关系可由评估师确认或取消；人工确认不会改变 direct/corroborating/index-only 的证据强度，也不会绕过正式范围和评分护栏。
- Finding Template 会按当前指标、过程域、类型和历史使用次数推荐，可直接生成六类评估师记录并要求补充项目事实、定位、风险与关闭证据。
- “标准知识库 → 审核模型”管理 Reference Model、Main Audit Model、Indicator Linking、评分 Profile 和发布门禁；组织裁剪模型必须保留 PAM BP/GP 映射。
- AI 默认使用内置审核规则，可在“设置 → AI 模型”切换到企业代理或 OpenAI Responses 兼容接口。
- “高级证据实验室”会打开原有 `app/aspice-audit-master.html`，用于对比更细粒度的单文件证据扫描。
- 正式报告包含跨过程分析和 Indicator–Evidence Trace Matrix，列出 AI/人工评分、直接证据、关联佐证、人工确认关系及最小补证路径。
- Word 使用浏览器生成兼容 `.doc`；PDF 使用系统打印对话框“存储为 PDF”。
- `S/W/R/O/C/Q` 可在执行页面直接打开对应记录编辑器；Evidence ID 会随引用动态展示，被引用证据不能删除。

## 生产部署建议

正式多用户环境应补充后端数据库、对象存储、SSO/RBAC、不可篡改审计日志、模型密钥托管、电子签署和报告归档。AuditFlow 不依赖外部项目或整改平台，证据导入和整改闭环均在工作区内完成。
