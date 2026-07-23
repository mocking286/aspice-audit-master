param(
  [string]$Root = "C:\Users\YuMeng Li\OneDrive - JE\Desktop\aspice-audit-master-refactored"
)

$ErrorActionPreference = "Stop"
$out = Join-Path $Root "aspice-audit-master_vs_Sharpen360_Trace_gap_assessment_20260723.docx"
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("trace-gap-docx-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $temp -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

function X([object]$Value) {
  return [System.Security.SecurityElement]::Escape([string]$Value)
}

$items = New-Object System.Collections.Generic.List[object]
function Add-P([string]$Text, [string]$Style = "Normal") {
  $script:items.Add([pscustomobject]@{ type = "p"; text = $Text; style = $Style })
}
function Add-T([string[]]$Headers, [object[]]$Rows) {
  $script:items.Add([pscustomobject]@{ type = "t"; headers = $Headers; rows = $Rows })
}

Add-P "aspice-audit-master 对标 Sharpen360 Trace 差距评估与改进建议" "Title"
Add-P "生成日期：2026-07-23"

Add-P "一、结论摘要" "Heading1"
Add-P "aspice-audit-master 当前定位更接近“ASPICE 证据解析与 AI 预审助手”：能在浏览器/Edge 插件中解析本地文档、读取 Helix 项目快照、生成 BP/GP 评分候选和 Codex 审核建议。Sharpen360 Trace 则是面向正式 ASPICE 评估执行的评估管理平台，核心能力在 Assessment/Instance/Workspace、Evidence Inventory、Finding/Record 生命周期、Guideline/TAA 规则引擎、访谈协同、正式评分和 Word/PPT/Excel 模板化报告输出。"
Add-P "若目标是接近 Sharpen360 Trace 的专业评估师软件形态，应优先从“文件级 AI 助手”升级为“评估对象、证据台账、发现记录、评分确认和报告模板的系统性管理平台”。"

Add-P "二、资料来源" "Heading1"
Add-T @("资料", "在本报告中的使用方式") @(
  @("Trace-Assessor-Guide-r1563.pdf", "提取 Trace 基础概念、评估计划、Schedule/Interview、Evidence Inventory、Records、Guidelines/TAA、Record Template 和 Report 的整体框架。"),
  @("HOW015_PlanningAndScoping.pdf", "提取 Planning、Project、Milestone、Org Unit/Location、Start/End Date、Participants、Workspace、Scoping、Model/Profile 与过程范围能力。"),
  @("HOW003_FindingsAndEvidences.pdf", "提取 Findings/Records 类型、Evidence、Evidence reference、Evidence Linking Map Set、Expected Evidence 和 AI 合并/改写线索。"),
  @("HOW005_TraceReporting.pdf", "提取 Trace Assessment、详细报告、Outbriefing/Record List/Improvement Plan、ReportBO、Word/PPT/Excel 模板扩展能力。"),
  @("HOW006_RatingGuidelinesAndTraceAssessorAssist.pdf", "提取 Guideline overlay、Indicator 保存触发自动评价、Met/Not Ready/Manual/Broken、handled/suspect/broken 管理能力。"),
  @("Bootstrap_Assessments.xlsx", "提取批量创建评估所需字段：Cluster、Model、Profile、Name、Project、Start/End Date、Milestone、Organization、OrgUnitLoc、Lead Assessor、Assessor 等。"),
  @("aspice-audit-master 当前代码与 v1.4.10 插件包", "盘点已实现功能：文档解析、知识库、过程域选择、BP/GP 候选评分、Helix 快照/DOCM、Codex bridge、PDF 报告和本地记忆。")
)

Add-P "三、Sharpen360 Trace 核心能力拆解" "Heading1"
Add-T @("能力域", "Sharpen360 Trace 的表现", "对正式 ASPICE 评估的价值") @(
  @("计划与范围", "评估绑定 Project/Milestone/组织单元/地点/起止日期/时区/参与人；支持 Lead Assessor、Assessor、Interviewee 等角色；按 Model/Profile/Scope 建立评估范围。", "保证评估对象、组织边界、过程范围、人员职责和目标 CL 在评估开始前受控。"),
  @("Instance 与 Workspace", "Instance 承载被评估项目/组织样本；Workspace 支持不同 assessor 小组独立记录、移动/复制 Record，并形成 Consolidated workspace。", "支持多评估人协作、分组访谈、记录合并和最终一致性确认。"),
  @("Bootstrap 批量建评估", "Excel 模板可批量创建评估，字段覆盖 Cluster、Model、Profile、Name、Project、日期、里程碑、组织、角色等。", "适合评估机构/企业批量管理项目，降低手工建项和范围录入错误。"),
  @("Evidence Inventory", "Evidence 有唯一 ID、分类序列、URL/文件、引用计数、下载/上传、删除保护，可按过程生成证据清单和 Linking Map Set。", "让证据从上传文件变成可引用、可追踪、可报告、可审计的评估对象。"),
  @("Findings / Records", "支持 Comment、Recommendation、Observation、Weakness、Major Weakness、Strength、Question；可绑定 Indicator 和 Evidence，支持改写/合并。", "将审核发现、问题、强项、建议和访谈问题结构化，并与 BP/GP/PA 直接关联。"),
  @("访谈支撑", "Schedule、Interview Session、Interviewee 分配、Notepad，访谈后可转 Record。", "覆盖正式评估中从文档审查到访谈取证的完整执行流程。"),
  @("评分与 Guideline/TAA", "Grid/Tree 视图下对 PAM 节点评分；Guideline overlay；Indicator 保存后触发 TAA 自动评价；支持 handled、suspect、broken。", "使评分依据可解释、可复核，并能把规则违背转化为报告项。"),
  @("报告体系", "基于 ReportBO 的 Word/PPT/Excel 模板扩展，输出详细评估报告、Outbriefing、Record List、Improvement Plan、图表、证据和 Guideline justification。", "满足正式评估交付物、客户模板、管理层汇报和改进计划跟踪。")
)

Add-P "四、aspice-audit-master 当前能力盘点" "Heading1"
Add-T @("能力域", "当前已实现", "成熟度判断") @(
  @("本地文档解析", "支持 DOCX/DOCM/PPTX/XLSX/XLSM/文本型 PDF，提取标题、正文、表格、图片、形状、连接线、流程图候选和元数据。", "强，适合作为证据预处理入口。"),
  @("ASPICE 过程映射", "覆盖 MAN、SUP、SYS、SWE、SPL、ACQ、REU、HWE、MLE、VAL、SEC 等过程域，支持多过程域选择和手动锁定。", "中高，适合预审，但还不是正式 Scope/Instance 模型。"),
  @("证据保留库", "页面会话内最多保留 20 份文档，支持多文件组合分析和文件角色识别。", "中，属于文件库，不是 Trace 式 Evidence Inventory。"),
  @("BP/GP/PA 候选评分", "具备本地候选评分、CL2 加权、PA1.1/PA2.1/PA2.2 门槛、负面证据降级和 Codex 最终建议输入。", "中，适合评审参考，但缺少正式手动确认、历史和审计日志。"),
  @("SUP 闭环与 Helix 检查", "内置 SUP.8/SUP.9/SUP.10 闭环样例、Helix export completeness 和审核员挑战问题。", "中高，适合作为过程性问题提示。"),
  @("Helix 集成", "通过本地 bridge 读取 requirements、documents、issues、testCases、testRuns、folders，并可导出/导入 Helix DOCM 证据包。", "中，已能补充项目进度和工具侧证据，但尚未映射为 Evidence/Record/Rating 数据模型。"),
  @("Codex 审核建议", "通过本地 Codex bridge 调用企业 provider，生成中文结构化审核建议，并要求区分上传证据、Helix 快照、本地规则和公开参考。", "中高，AI 助手能力突出，但需从直接建议降级为 assessor 决策支持。"),
  @("报告输出", "支持浏览器打印式 PDF 正式报告。", "中，缺少 Word/PPT/Excel 模板、ReportBO、Record List 和 Improvement Plan。"),
  @("本地记忆与插件化", "Edge 插件、本地项目/文件索引、登录门控和中英界面。", "中，适合试验部署，但不等同企业多用户服务端。")
)

Add-P "五、关键差距矩阵" "Heading1"
Add-T @("差距项", "Trace 标准能力", "当前应用状态", "优先级", "建议改进") @(
  @("Assessment Project 数据模型", "Project、Milestone、OrgUnit、Location、Participant、Role、Instance、Workspace、Model/Profile、ProcessScope 为受控对象。", "当前主要是单页状态和本地记忆，没有完整评估对象模型。", "P1", "新增 Assessment/Scope/Instance/Workspace/Participant/ProcessScope 数据模型和持久化层。"),
  @("Scoping / Bootstrap", "支持 Excel 批量创建评估和范围。", "未支持 Bootstrap_Assessments.xlsx 直接导入建项。", "P1", "实现 Bootstrap 导入、字段校验、EndOfTable 识别和评估初始化向导。"),
  @("Evidence Inventory", "证据唯一 ID、分类、引用计数、URL/文件、Expected Evidence、删除保护。", "当前是文件解析库，缺少证据编号和引用生命周期。", "P1", "引入 Evidence 表、EvidenceRef、引用计数、证据状态、证据列表导入导出。"),
  @("Findings / Records", "C/R/O/W/M/S/Q 类型化 Record，绑定 Indicator 与 Evidence。", "已有补充发现输入和建议表，但不是完整 Record 生命周期。", "P1", "新增 Finding/Record 工作台：类型、严重度、过程域、BP/GP、Evidence 引用、状态和审计历史。"),
  @("正式评分引擎", "PAM 节点级 N/P/L/F，手动确认，评分历史，多评估人合并。", "本地评分候选 + Codex 建议，缺少正式评分状态机。", "P1", "建立 IndicatorRating、PARating、CapabilityLevel、评分确认、变更日志和 hard gate。"),
  @("Guideline / TAA", "Overlay、Guideline、Indicator Annotation、自动 Met/Not Ready/Manual/Broken、handled/suspect。", "只有规则提示和 AI prompt，没有可配置规则引擎。", "P2", "实现 Guideline/TAA Lite：规则配置、评价状态、broken/handled/suspect 和报告引用。"),
  @("访谈管理", "Schedule、Interview Session、Interviewee、Notepad、访谈转 Record。", "暂未覆盖正式访谈流程。", "P2", "新增 Interview 模块，将文档审查问题转成访谈问题并支持访谈记录转 Findings。"),
  @("报告模板体系", "ReportBO 驱动 Word/PPT/Excel 模板扩展。", "只有 HTML/PDF 打印报告。", "P2", "先生成 ReportBO JSON/XML，再接 Word/PPT/Excel 模板输出。"),
  @("协同与权限", "多人 Workspace、角色权限、聊天/在线状态、Consolidated workspace。", "本地单用户试验后台。", "P3", "服务端化：RBAC、审计日志、多人评审、项目历史指标。"),
  @("工具链映射", "Trace 将证据/发现/评分统一入评估对象。", "Helix 数据仍是辅助快照和 DOCM 文本包。", "P2", "把 Helix REQ/RE/issues/tests/baseline 映射为 Evidence、Finding、Rating 支撑对象。")
)

Add-P "六、优先改进项" "Heading1"
Add-P "P1：建立 Trace-compatible 核心数据模型：Assessment、Scope、Instance、Workspace、Participant、ProcessScope、Evidence、Finding、Rating、Guideline、Report。"
Add-P "P1：实现 Evidence Inventory 与 Finding Record：证据 ID 编号、批量 XLSX 导入导出、Evidence 引用、Record 类型、BP/GP 绑定、引用计数和闭环样例。"
Add-P "P1：实现 Scoping/Bootstrap：支持 Bootstrap_Assessments.xlsx 导入，按 Model/Profile、Instance、过程域和目标 CL 创建评估。"
Add-P "P1：强化评分引擎：Indicator 级 N/P/L/F、PA/CL hard gate、手动确认、评分历史、负面证据 cap，Codex 只作为建议来源。"
Add-P "P2：实现 Guideline/TAA Lite：Overlay、Guideline rule、broken/handled/suspect、Record Template 和报告引用。"
Add-P "P2：升级报告输出：先输出 ReportBO JSON/XML，再套 Word/PPT/Excel 模板，保留现有 PDF 作为轻量导出。"
Add-P "P2：升级 Helix 原生映射：把 Helix requirements/issues/tests/baselines 映射为 Evidence 和闭环样本，而不是仅作为快照文本。"
Add-P "P3：企业化加固：RBAC、审计日志、OCR、模板管理、项目历史指标、多人协作和安全配置。"

Add-P "七、建议路线图" "Heading1"
Add-T @("阶段", "周期", "目标", "主要交付") @(
  @("阶段 1：Trace-like 最小闭环", "0-4 周", "让应用从文件预审工具升级为可保存评估范围、证据和发现的最小评估工作台。", "Bootstrap 导入；Assessment/Scope/Instance/Workspace；Evidence Inventory；Finding Record；手动 BP/GP 评分；现有 PDF 报告接入。"),
  @("阶段 2：可执行评估工作台", "5-10 周", "覆盖正式评估执行中最关键的访谈、规则、证据引用和模板报告。", "Interview/Notepad；Guideline/TAA Lite；Expected Evidence Map；Helix 对象到 Evidence/Record 映射；ReportBO；Word/PPT/Excel 模板输出。"),
  @("阶段 3：企业级平台化", "11-16 周", "支撑多项目、多用户、可审计、可复用的评估平台。", "RBAC；审计日志；项目历史指标；模板权限；OCR；评估包归档；Helix/Jira/Git 扩展接口；真实项目试点评审。")
)

Add-P "八、GitHub 上传状态与建议" "Heading1"
Add-P "已确认远程仓库 mocking286/aspice-audit-master 存在，默认分支为 main。本机当前环境未安装 git/gh，且未发现 GITHUB_TOKEN/GH_TOKEN 或可用 GitHub 写入凭据。因此出于安全和权限边界，本次无法直接向远程仓库推送。"
Add-P "已准备上传目录和 GitHub API 上传脚本。用户在本机设置 GITHUB_TOKEN 后，可直接运行脚本将准备好的开发资料上传到 mocking286/aspice-audit-master。"

Add-P "九、总体建议" "Heading1"
Add-P "短期不要直接追求完整复制 Sharpen360 Trace，而应把 aspice-audit-master 的优势定位为：本地证据解析、Helix 快照、AI 评审建议和过程缺口提示。下一步最关键的是建立正式评估对象模型和 Evidence/Finding/Rating 三件套，让 AI 输出服务于评估师确认，而不是替代评估师评分。"

$doc = New-Object System.Text.StringBuilder
[void]$doc.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
[void]$doc.Append('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>')

function Add-Run([string]$Text, [string]$Style) {
  $pPr = ""
  if ($Style -eq "Title") { $pPr = '<w:pPr><w:pStyle w:val="Title"/></w:pPr>' }
  elseif ($Style -eq "Heading1") { $pPr = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' }
  elseif ($Style -eq "Heading2") { $pPr = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' }
  [void]$script:doc.Append('<w:p>' + $pPr + '<w:r><w:t xml:space="preserve">' + (X $Text) + '</w:t></w:r></w:p>')
}

function Add-Table([string[]]$Headers, [object[]]$Rows) {
  [void]$script:doc.Append('<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>')
  [void]$script:doc.Append('<w:tr>')
  foreach ($h in $Headers) {
    [void]$script:doc.Append('<w:tc><w:tcPr><w:shd w:fill="D9EAF7"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + (X $h) + '</w:t></w:r></w:p></w:tc>')
  }
  [void]$script:doc.Append('</w:tr>')
  foreach ($row in $Rows) {
    [void]$script:doc.Append('<w:tr>')
    foreach ($cell in $row) {
      [void]$script:doc.Append('<w:tc><w:p><w:r><w:t xml:space="preserve">' + (X $cell) + '</w:t></w:r></w:p></w:tc>')
    }
    [void]$script:doc.Append('</w:tr>')
  }
  [void]$script:doc.Append('</w:tbl><w:p/>')
}

foreach ($item in $items) {
  if ($item.type -eq "p") { Add-Run $item.text $item.style }
  elseif ($item.type -eq "t") { Add-Table $item.headers $item.rows }
}
[void]$doc.Append('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1008" w:right="1008" w:bottom="1008" w:left="1008"/></w:sectPr></w:body></w:document>')

function Write-TextPart([string]$RelativePath, [string]$Text) {
  $target = Join-Path $temp $RelativePath
  $parent = Split-Path -Parent $target
  if ($parent -and !(Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  [System.IO.File]::WriteAllText($target, $Text, $utf8)
}

Write-TextPart "[Content_Types].xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
Write-TextPart "_rels\.rels" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
Write-TextPart "word\document.xml" $doc.ToString()
Write-TextPart "word\styles.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:eastAsia="Microsoft YaHei" w:ascii="Arial"/><w:sz w:val="21"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:rFonts w:eastAsia="Microsoft YaHei" w:ascii="Arial"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:rFonts w:eastAsia="Microsoft YaHei" w:ascii="Arial"/><w:sz w:val="28"/><w:color w:val="1F4E79"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:rFonts w:eastAsia="Microsoft YaHei" w:ascii="Arial"/><w:sz w:val="24"/><w:color w:val="2F75B5"/></w:rPr></w:style></w:styles>'
Write-TextPart "docProps\core.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>aspice-audit-master vs Sharpen360 Trace gap assessment</dc:title><dc:creator>Codex</dc:creator><dc:subject>ASPICE assessment tool gap analysis</dc:subject></cp:coreProperties>'
Write-TextPart "docProps\app.xml" '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>aspice-audit-master report generator</Application><Company>JE</Company></Properties>'

if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipStream = [System.IO.File]::Open($out, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in Get-ChildItem -LiteralPath $temp -Recurse -File) {
    $relative = ($file.FullName.Substring($temp.Length) -replace '^[\\/]+', '' -replace '\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $archive.Dispose()
  $zipStream.Dispose()
}
Remove-Item -LiteralPath $temp -Recurse -Force
Get-Item -LiteralPath $out
