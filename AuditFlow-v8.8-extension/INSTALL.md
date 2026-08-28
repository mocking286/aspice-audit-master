# Install AuditFlow v8.8 in Microsoft Edge

## 1. 加载扩展

1. 打开 edge://extensions。
2. 开启开发人员模式。
3. v8.8 首次启动会保留唯一的 CEP XP ASPICE CL2 工作区，并移除旧项目及非 CEP folder 资料；如需保留旧工作区，请先导出本地备份。
4. 新安装时解压 `AuditFlow-v8.8.0-extension.zip`，选择“加载解压缩的扩展”，并选择包含根级 `manifest.json` 的文件夹。
5. 固定 AuditFlow 图标。

插件 manifest 已精确声明当前协作服务 `http://120.25.197.24/*` 的主机权限；如果你把协作服务迁移到其他主机，请在扩展设置中改用新的端点，并同步更新服务器端 CORS 允许来源。

## 2. 使用工具栏弹窗

- 点击浏览器工具栏中的 AuditFlow 图标。
- 弹窗会列出正在进行的审核项目，并显示 AI 服务和 Helix Bridge 的就绪状态。
- 选择项目可直接打开相应审核；选择进入首页可打开工作台总览。

## 3. 复核 BP / GP AI 初稿

1. 进入 ASPICE 项目并运行“AI 预评估”或打开顶部“AI 评审”。
2. 在“评定结果（BP + GP · AI 初稿，可复核改定）”按过程、指标或复核状态筛选。
3. 用评分下拉快速改定；需要补充理由、证据引用或 O/W/R 时点击“核对详情”。
4. Codex 参考评审仅使用已定稿记录，并另存版本；结果必须由评估师复核。

## 4. 使用内嵌 Audit Master 与受控基线

1. 进入项目“范围与资料”，点击右上角 `Audit Master` 小按钮。
2. 选择已上传文件或 Helix 条目，确认 Direct / Corroborating / Index-only。模型开关启用时只发送所选摘要和定位，不发送文件 Blob。
3. 点击“分析并回流意见”。结果以 Index-only 的 AI Review Opinion 保存，并自动转到 AI 评审等待人工复核。
4. 在“版本与基线”先确认全部文档条目，再创建 Draft；提交 Independent Reviewer 完成独立回复后，由 Lead Assessor 或 Configuration Manager 批准。

## 5. MAN.3 / SUP.8 支持域专项子项目

1. 在“审核总览”或“ASPICE 评估”列表中，点击父项目行的图层按钮“生成 MAN.3 / SUP.8 专项子项目”。
2. 选择 MAN.3、SUP.8 和需要继承的父项目证据；子项目只处理上传文件实际出现的问题，不生成完整 BP/GP 清单。
3. 在子项目“范围与资料 / Scope”阶段上传问题清单、项目计划或配置管理材料，点击“识别问题并配对 BP/GP”。
4. 在“评定结果（BP + GP · AI 初稿，可复核改定）”逐条核对 Issue 定位、候选 BP/GP、评分、证据作用和最小关闭证据。AI 初稿必须由评估师人工复核。
5. 全部问题复核后点击“一键回写原项目”。系统追加草稿弱项和候选追溯，保留原项目已有人工评分和正式范围；回写本身不代表过程关闭或能力等级达成。

## 6. 启动本机 bridge（可选）

扩展本身不需要 Node.js。报告、导出和评估计算直接在浏览器中执行。本机 bridge 只用于显式启用的 Codex 对话；安装包不包含 `node_modules`。

```bash
npm ci --omit=dev
node server.mjs health
node server.mjs serve
```

只有 `node server.mjs health` 成功后，才可认为本机 bridge 可用。`Local rules available`、`Local bridge reachable` 和 `Model session available` 是三个独立状态。

## 7. 配置模型复核（可选）

1. 在工作台右上角进入设置。
2. 打开 AI 与本地解析设置，再选择 Codex / Virtual Key。
3. 模型复核默认关闭；任何可能产生费用或把评估摘要发送到外部模型的配置，都必须由用户在操作当时明确授权。AuditFlow 不购买服务或资源。
4. 输入 Virtual Key 并保存。该 Key 仅保存在本机 AI 服务进程内存中，浏览器存储、扩展压缩包和日志均不会保留它。
5. AI 服务未就绪时，AuditFlow 自动使用本地规则评估；这不会阻塞文件解析、人工审核或项目操作。

## 8. 功能安全与网络安全审核

1. 打开“自定义审核”，选择“ISO 26262 功能安全审核”或“ISO/SAE 21434 网络安全审核”。
2. 依次完成范围、计划、证据、AI 分析、人工复核和关闭；上传文件后先核对抽取文本、作用域和原文定位。
3. 旧版 `.doc` 使用本地启发式抽取，可能丢失表格和页码；可转换为 `.docx` 后重新上传，正式判断必须核对原件。
4. AI 初稿受证据护栏限制，关联过程只作佐证；全部审核项人工复核、证据充分且开放弱项关闭后才允许主审核员关闭项目。

## 9. 多用户协作与 ECS / MySQL

1. 打开设置 → 项目多人协作，配置 API Endpoint、Microsoft Tenant/SPA Client ID、API Audience 和工作区 ID。
2. 本地预览可切换当前操作人，验证证据登记、AI 分析、评分改定和关闭权限；修订号与事件保存在当前浏览器工作区。
3. ECS 网站服务可通过 `AUDITFLOW_MYSQL_URL` 启用 MySQL InnoDB；服务启动时自动创建协作表，并在 `AUDITFLOW_USER_DATA_DIR` 下为每个用户建立独立目录。公司正式身份接入时再配置 Microsoft Entra；数据库连接串和 AI 密钥只放在服务器环境变量，不放入浏览器或扩展包。

## 10. 语言与夜间模式

- 右上角月亮/太阳按钮切换白天和 GitHub Dark 夜间模式。
- 紧邻的 EN / ZH 按钮切换中文和英文。英文模式会将界面、可见评估内容和模型输出统一为英文。

## 本地数据

- 项目与评估元数据：扩展 localStorage。
- 记录附件 Blob：IndexedDB。
- 报告与备份：本机受控输出目录（仅在 AI 服务可用时生成）。
- Helix Bridge：仍可使用 helix-bridge.ps1 或 start-helix-bridge.cmd；其状态独立于 AI 服务。
