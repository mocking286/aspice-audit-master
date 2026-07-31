(function () {
  "use strict";

  const DB_KEY = "auditflow-ai-workspace-v1";
  const DB_VERSION = 11;
  const ATTACHMENT_DB_NAME = "auditflow-attachments-v1";
  const ATTACHMENT_STORE = "attachments";
  const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
  const pendingRecordAttachments = new Map();
  const ASPICE_MASTER_URL = "file:///C:/Users/YuMeng%20Li/OneDrive%20-%20JE/Desktop/aspice-audit-master-refactored/aspice-audit-master.html";
  const ASPICE_BRIDGE_PROTOCOL = "auditflow-aspice-evidence/v1";
  const aspiceTransfers = new Map();
  const HELIX_DEFAULTS = { bridgeUrl: "http://127.0.0.1:8787", baseUrl: "https://10.214.41.6:8443/helix-alm/api/v0", username: "YuMeng Li", password: "", projectId: "", search: "", itemLimit: 100, ignoreCertificateErrors: true, selectedTypes: ["requirements", "documents", "issues", "testCases", "testRuns", "folders"] };
  const helixUi = { ...HELIX_DEFAULTS, selectedTypes: [...HELIX_DEFAULTS.selectedTypes], projects: [], snapshot: null, selectedKeys: new Set(), status: "Helix 项目数据尚未读取。", busy: false, target: null };
  const RATING_SCORE = { "N": 7.5, "P-": 23.75, "P": 32.5, "P+": 41.25, "L-": 58.75, "L": 67.5, "L+": 76.25, "F": 92.5 };
  const RATING_ORDER = ["N", "P-", "P", "P+", "L-", "L", "L+", "F"];
  const STATUS_LABEL = { draft: "草稿", ready: "待评估", running: "AI 评估中", review: "待复核", complete: "已完成", archived: "已归档" };
  const STATUS_CLASS = { draft: "neutral", ready: "info", running: "warn", review: "purple", complete: "success", archived: "neutral" };
  const RECORD_TYPES = {
    strength: { code: "S", label: "优势", tone: "success" },
    weakness: { code: "W", label: "弱项", tone: "danger" },
    recommendation: { code: "R", label: "建议", tone: "warn" },
    observation: { code: "O", label: "观察", tone: "info" },
    comment: { code: "C", label: "备注", tone: "neutral" },
    question: { code: "Q", label: "访谈问题", tone: "purple" }
  };
  const ASSESSMENT_PHASES = [
    ["plan", "计划"], ["schedule", "日程"], ["conduct", "执行"], ["evidence", "证据"], ["trace", "追溯"], ["consolidate", "合并"], ["history", "版本"], ["close", "关闭与报告"]
  ];
  const PROCESS_CATALOG = [
    ["ACQ.4", "供应商监控", "Supplier Monitoring", "ACQ", 7],
    ["SPL.2", "产品发布", "Product Release", "SPL", 7],
    ["SYS.1", "需求挖掘", "Requirements Elicitation", "SYS", 6],
    ["SYS.2", "系统需求分析", "System Requirements Analysis", "SYS", 8],
    ["SYS.3", "系统架构设计", "System Architectural Design", "SYS", 8],
    ["SYS.4", "系统集成与集成验证", "System Integration and Integration Verification", "SYS", 8],
    ["SYS.5", "系统验证", "System Verification", "SYS", 7],
    ["SWE.1", "软件需求分析", "Software Requirements Analysis", "SWE", 6],
    ["SWE.2", "软件架构设计", "Software Architectural Design", "SWE", 5],
    ["SWE.3", "软件详细设计与单元构建", "Software Detailed Design and Unit Construction", "SWE", 5],
    ["SWE.4", "软件单元验证", "Software Unit Verification", "SWE", 5],
    ["SWE.5", "软件组件验证与集成验证", "Software Component Verification and Integration Verification", "SWE", 7],
    ["SWE.6", "软件验证", "Software Verification", "SWE", 5],
    ["HWE.1", "硬件需求分析", "Hardware Requirements Analysis", "HWE", 8],
    ["HWE.2", "硬件设计", "Hardware Design", "HWE", 8],
    ["HWE.3", "硬件设计验证", "Verification against Hardware Design", "HWE", 7],
    ["HWE.4", "硬件需求验证", "Verification against Hardware Requirements", "HWE", 7],
    ["MLE.1", "机器学习需求分析", "Machine Learning Requirements Analysis", "MLE", 7],
    ["MLE.2", "机器学习架构", "Machine Learning Architecture", "MLE", 7],
    ["MLE.3", "机器学习训练", "Machine Learning Training", "MLE", 8],
    ["MLE.4", "机器学习模型测试", "Machine Learning Model Testing", "MLE", 8],
    ["SUP.1", "质量保证", "Quality Assurance", "SUP", 7],
    ["SUP.8", "配置管理", "Configuration Management", "SUP", 8],
    ["SUP.9", "问题解决管理", "Problem Resolution Management", "SUP", 7],
    ["SUP.10", "变更请求管理", "Change Request Management", "SUP", 6],
    ["MAN.3", "项目管理", "Project Management", "MAN", 10],
    ["REU.2", "复用产品管理", "Reuse Product Management", "REU", 7],
    ["PIM.3", "过程改进", "Process Improvement", "PIM", 8]
  ].map(([id, zh, en, group, bp]) => ({ id, zh, en, group, bp }));

  const PRACTICE_LIBRARY = {
    "SYS.3": [
      ["BP1", "建立系统架构", "定义系统元素、边界和分解原则，并与系统需求保持一致。"],
      ["BP2", "分配系统需求", "将需求分配至系统元素并保留双向追溯与分配理由。"],
      ["BP3", "定义接口", "定义内外部接口、数据、时序、资源与安全约束。"],
      ["BP4", "描述动态行为", "使用状态、序列或数据流视图描述关键动态行为。"],
      ["BP5", "评估架构方案", "基于质量属性与约束评估替代方案并记录决策。"],
      ["BP6", "确保一致性", "分析需求、架构视图和接口之间的一致性。"],
      ["BP7", "沟通架构", "向受影响方沟通架构及其变更并留存记录。"],
      ["BP8", "维护架构", "受控维护架构基线、变体及变更影响。"]
    ],
    "SWE.1": [
      ["BP1", "定义软件需求", "从系统需求、接口和运行环境约束推导并记录软件需求。"],
      ["BP2", "结构化软件需求", "按功能、非功能、接口、约束和变体建立可管理的软件需求结构。"],
      ["BP3", "分析软件需求", "分析正确性、完整性、可行性、可验证性、风险与优先级。"],
      ["BP4", "分析对运行环境的影响", "识别软件需求对运行环境、硬件资源和外部接口的影响。"],
      ["BP5", "确保一致性和建立双向可追溯性", "证明系统需求、软件需求、变更和后续工作产品之间一致且双向可追溯。"],
      ["BP6", "沟通约定的软件需求和运行环境影响", "对软件需求基线、未决项及运行环境影响进行评审、批准与沟通。"]
    ],
    "SWE.2": [
      ["BP1", "定义软件架构的静态方面", "定义软件组件、职责、分解、接口和部署关系。"],
      ["BP2", "定义软件架构的动态方面", "描述关键场景、状态、时序、并发、资源和异常行为。"],
      ["BP3", "分析软件架构", "针对质量属性、资源、功能安全、网络安全和技术约束分析架构方案。"],
      ["BP4", "确保一致性和建立双向可追溯性", "维护软件需求、架构元素、接口和架构决策之间一致性与双向追溯。"],
      ["BP5", "沟通约定的软件架构", "评审、批准并向开发和验证相关方沟通架构基线及变更影响。"]
    ],
    "SWE.3": [
      ["BP1", "开发软件详细设计", "将架构组件细化为可实现、可验证的软件单元设计。"],
      ["BP2", "构建软件单元", "依据详细设计和编码规范实现软件单元，并保留受控版本。"],
      ["BP3", "分析软件详细设计和软件单元", "分析接口、数据流、控制流、资源、复杂度和关键异常处理。"],
      ["BP4", "确保一致性和建立双向可追溯性", "证明架构、详细设计、代码和相关变更之间一致且双向可追溯。"],
      ["BP5", "沟通约定的软件详细设计和软件单元", "完成评审、问题闭环、批准和基线沟通。"]
    ],
    "SWE.4": [
      ["BP1", "开发软件单元验证措施", "定义验证对象、方法、覆盖准则、环境、期望结果和回归策略。"],
      ["BP2", "选择软件单元验证措施", "根据风险、变更影响和发布范围选择充分的验证集合。"],
      ["BP3", "验证软件单元", "在受控环境执行验证并保存原始结果、失败分析和复测记录。"],
      ["BP4", "确保一致性和建立双向可追溯性", "维护详细设计、软件单元、验证措施和结果之间的一致性与双向追溯。"],
      ["BP5", "汇总并沟通软件单元验证结果", "汇总覆盖、失败、偏差、剩余风险并完成评审和沟通。"]
    ],
    "SWE.5": [
      ["BP1", "开发软件集成策略", "定义集成顺序、增量、环境、入口/出口准则和回归策略。"],
      ["BP2", "开发软件集成验证措施", "建立针对组件交互和接口的验证措施、期望结果与覆盖准则。"],
      ["BP3", "选择软件集成验证措施", "根据架构、风险和变更范围选择验证集合。"],
      ["BP4", "集成软件组件和软件单元", "按策略执行集成并记录版本、环境、结果和异常。"],
      ["BP5", "执行软件集成验证", "执行选定措施并对失败、偏差和重新验证形成闭环。"],
      ["BP6", "确保一致性和建立双向可追溯性", "维护架构接口、组件、集成增量、验证措施和结果之间的双向追溯。"],
      ["BP7", "汇总并沟通软件集成验证结果", "汇总覆盖、质量状态、剩余风险并完成评审与沟通。"]
    ],
    "SWE.6": [
      ["BP1", "开发软件验证措施", "从软件需求和风险导出验证措施、环境、期望结果与覆盖准则。"],
      ["BP2", "选择软件验证措施", "根据发布范围、风险、变更和回归需要选择验证集合。"],
      ["BP3", "验证集成软件", "在代表性环境执行验证，保存结果并闭环失败和偏差。"],
      ["BP4", "确保一致性和建立双向可追溯性", "维护软件需求、验证措施、执行结果和缺陷之间一致性与双向追溯。"],
      ["BP5", "汇总并沟通软件验证结果", "汇总需求覆盖、通过率、剩余缺陷、偏差和发布风险。"]
    ],
    "SUP.1": [
      ["BP1", "制定质量保证策略", "定义独立性、范围、频率、准则、角色和升级路径。"],
      ["BP2", "保证工作产品质量", "按计划检查关键工作产品的完整性、一致性和符合性。"],
      ["BP3", "保证过程活动质量", "按计划检查过程活动是否符合适用流程、裁剪和承诺。"],
      ["BP4", "识别并记录不符合项", "客观记录不符合项、影响、责任人、截止时间和证据。"],
      ["BP5", "处理质量保证不符合项", "跟踪纠正措施、升级逾期事项并验证关闭有效性。"],
      ["BP6", "跟踪质量保证状态", "维护覆盖、趋势、开放风险和质量门状态。"],
      ["BP7", "沟通质量保证结果", "向管理层和相关方独立报告质量状态、重大偏差和剩余风险。"]
    ],
    "SUP.8": [
      ["BP1", "制定配置管理策略", "明确配置范围、角色、工具、基线和审计方式。"],
      ["BP2", "识别配置项", "识别配置项并维护标识、版本、状态和责任人。"],
      ["BP3", "建立配置管理系统", "提供访问、变更、备份、恢复和并发控制。"],
      ["BP4", "建立基线", "按计划建立可重现、获批并可追溯的基线。"],
      ["BP5", "控制变更", "配置项变更经授权、实施、验证并形成记录。"],
      ["BP6", "记录状态", "维护配置项与基线状态并生成状态报告。"],
      ["BP7", "验证完整性", "通过配置审计验证基线完整性和一致性。"],
      ["BP8", "管理存储与交付", "保护、归档、恢复并受控交付配置项和基线。"]
    ],
    "SUP.9": [
      ["BP1", "制定问题解决管理策略", "定义问题分类、优先级、角色、状态、升级和关闭准则。"],
      ["BP2", "识别并记录问题", "记录问题现象、环境、影响、发现版本和可复现信息。"],
      ["BP3", "调查并诊断问题", "完成根因、影响范围、相关工作产品和安全影响分析。"],
      ["BP4", "制定问题解决方案", "定义措施、责任人、计划、验证方法和回退方案。"],
      ["BP5", "实施并验证问题解决方案", "受控实施措施并通过复测或审查验证有效性。"],
      ["BP6", "跟踪问题状态", "监控时效、升级、关联变更、验证和关闭状态。"],
      ["BP7", "分析问题趋势", "分析重复问题、逃逸缺陷和系统性原因并推动预防措施。"]
    ],
    "SUP.10": [
      ["BP1", "制定变更请求管理策略", "定义变更入口、状态、角色、授权和关闭准则。"],
      ["BP2", "识别并记录变更请求", "记录变更原因、范围、优先级、来源和受影响对象。"],
      ["BP3", "分析变更请求", "分析技术、进度、成本、质量、安全和配置影响。"],
      ["BP4", "批准变更请求", "基于完整影响分析由授权角色作出可追溯决策。"],
      ["BP5", "实施并验证变更", "受控实施获批变更，更新受影响工作产品并完成验证。"],
      ["BP6", "跟踪并沟通变更状态", "维护状态、版本、验证、关闭和相关方沟通记录。"]
    ],
    "MAN.3": [
      ["BP1", "定义工作范围", "明确目标、范围、交付物、边界与假设。"],
      ["BP2", "定义生命周期", "选择生命周期、里程碑、过程与裁剪策略。"],
      ["BP3", "评估可行性", "评估目标、资源、进度、技术和依赖可行性。"],
      ["BP4", "定义活动与估算", "分解活动并估算工作量、资源与持续时间。"],
      ["BP5", "定义资源需求", "确定人员、技能、工具、环境和预算。"],
      ["BP6", "定义接口", "识别内部、外部及供应商接口和承诺。"],
      ["BP7", "制定项目计划", "建立一致、获批并可追踪的项目计划。"],
      ["BP8", "监控项目", "比较计划与实际，识别偏差和趋势。"],
      ["BP9", "采取纠正措施", "对偏差、问题和风险采取措施并验证效果。"],
      ["BP10", "沟通项目状态", "定期向利益相关方沟通客观项目状态。"]
    ]
  };

  const GP_LIBRARY = [
    ["GP 2.1.1", "识别目标并定义过程实施策略", "目标、范围、裁剪、约束和完成准则明确。"],
    ["GP 2.1.2", "计划过程的实施", "活动、里程碑、依赖、责任与输出纳入可执行计划。"],
    ["GP 2.1.3", "确定资源需求", "人员能力、工具、环境、信息和预算需求被识别。"],
    ["GP 2.1.4", "识别并提供资源", "资源按计划提供，可用性和能力满足过程需要。"],
    ["GP 2.1.5", "监控和调整过程的实施", "实际状态、偏差、趋势、措施和有效性可追踪。"],
    ["GP 2.1.6", "管理参与方之间的接口", "内部及外部接口、承诺、依赖和信息交换受管理。"],
    ["GP 2.2.1", "定义工作产品要求", "模板、必填字段、准则与完成定义明确。"],
    ["GP 2.2.2", "定义工作产品存储和控制要求", "评审、审批、配置、存储、访问与变更控制方式明确。"],
    ["GP 2.2.3", "识别并控制工作产品", "标识、版本、状态、基线和访问受控。"],
    ["GP 2.2.4", "评审并调整工作产品", "按准则评审并闭环问题，保持一致性。"]
  ];

  const EVIDENCE_GUIDE = {
    "SWE.1": ["软件需求规格", "需求评审记录", "系统↔软件需求追踪矩阵", "需求变更记录"],
    "SWE.2": ["软件架构设计", "接口规格", "动态行为/资源分析", "架构评审与需求↔架构追踪"],
    "SWE.3": ["软件详细设计", "代码/构建记录", "编码与静态检查结果", "设计评审与设计↔代码追踪"],
    "SWE.4": ["单元验证策略与规格", "原始测试结果/覆盖率", "详细设计↔单元↔测试追踪", "失败与复测闭环"],
    "SWE.5": ["软件集成策略", "集成增量与环境记录", "接口/集成验证结果", "架构↔集成↔验证追踪"],
    "SWE.6": ["软件验证策略/规格", "需求覆盖与执行结果", "缺陷和偏差闭环", "软件需求↔验证追踪"],
    "SUP.1": ["质量保证计划", "过程/工作产品审核记录", "不符合项与升级记录", "质量状态报告"],
    "SUP.8": ["配置管理计划", "配置项/基线清单", "变更与状态报告", "配置审计/备份恢复记录"],
    "SUP.9": ["问题管理流程", "问题单与根因分析", "措施/复测/关闭证据", "问题趋势统计"],
    "SUP.10": ["变更管理流程", "变更请求与影响分析", "审批/实施/验证记录", "变更↔工作产品追踪"],
    "MAN.3": ["项目计划与估算", "进度/里程碑监控", "风险问题与措施", "资源/接口/状态沟通记录"],
    "SYS.3": ["系统架构设计", "接口与动态行为视图", "架构分析/决策记录", "需求↔架构追踪与评审"]
  };

  const ENGINEERING_CHAINS = [
    ["SYS.1", "SYS.2", "SYS.3", "SYS.4", "SYS.5"],
    ["SWE.1", "SWE.2", "SWE.3", "SWE.4", "SWE.5", "SWE.6"],
    ["HWE.1", "HWE.2", "HWE.3", "HWE.4"],
    ["MLE.1", "MLE.2", "MLE.3", "MLE.4"]
  ];
  const PROCESS_BRIDGES = [
    ["SYS.2", "SYS.5", "verification-pair", "系统资格验证应反向证明系统需求，覆盖、结果与偏差需双向追溯。"],
    ["SYS.3", "SYS.4", "integration-pair", "系统集成与集成验证应对照系统架构、接口和动态行为。"],
    ["SWE.1", "SWE.6", "verification-pair", "软件资格验证应反向证明软件需求及其验证准则。"],
    ["SWE.2", "SWE.5", "integration-pair", "软件集成验证应对照软件架构、接口和动态行为。"],
    ["SWE.3", "SWE.4", "unit-verification-pair", "软件单元验证应对照详细设计、单元要求和实现。"],
    ["SYS.2", "SWE.1", "allocation", "系统需求向软件需求分配，并传递接口、资源和验证约束。"],
    ["SYS.2", "HWE.1", "allocation", "系统需求向硬件需求分配，并传递接口、资源和验证约束。"],
    ["SWE.6", "SYS.4", "integration-input", "完成软件验证的受控版本和剩余问题进入系统集成。"],
    ["HWE.4", "SYS.4", "integration-input", "完成硬件需求验证的受控版本和剩余问题进入系统集成。"],
    ["SYS.5", "SPL.2", "release-input", "系统验证覆盖、偏差和剩余风险是产品发布决策输入。"],
    ["ACQ.4", "MAN.3", "supplier-dependency", "供应商承诺、交付状态和升级影响项目计划与纠正措施。"]
    ,["SUP.1", "SUP.9", "nonconformance-to-problem", "质量保证发现的不符合项可进入问题解决过程并跟踪关闭。"]
    ,["SUP.9", "SUP.10", "problem-to-change", "问题解决措施需要变更时，应建立问题与变更请求的双向追溯。"]
    ,["SUP.8", "MAN.3", "configuration-status", "配置项和基线状态为项目进展、里程碑与偏差判断提供客观输入。"]
    ,["SUP.8", "SPL.2", "release-baseline", "产品发布应从受控配置项和获批基线装配并验证完整性。"]
  ];
  const CROSS_PROCESS_PASSES = [
    ["qualified-flow","合格输入 → 合格输出","确认每个过程使用经评审/批准的输入，并向价值链下一过程提供合格输出。"],
    ["agree-summarize","约定与汇总沟通","检查需求/设计是否达成共同理解，验证结果、策略、计划和状态是否被汇总并沟通。"],
    ["divide-control","分解、委派、集成与控制","检查系统—域—组件—单元分解、责任委派，以及按设计逐级集成验证。"],
    ["trace-consistency","追溯、一致性、影响与完整性","沿来源与验证双向追溯，检查语义一致、变更影响和覆盖完整性。"]
  ];
  const SUPPORT_PROCESS_RELATIONS = [
    ["MAN.3", "governance", "计划、依赖、资源、接口、里程碑监控和纠正措施"],
    ["SUP.1", "assurance", "独立质量保证覆盖、不符合项升级和关闭有效性"],
    ["SUP.8", "configuration", "配置项标识、版本、基线、状态、完整性和可重现性"],
    ["SUP.9", "problem", "问题关联、根因、影响、修复验证、趋势和关闭"],
    ["SUP.10", "change", "变更请求、跨过程影响、批准、实施、验证和关闭"]
  ];
  const REVIEW_WORKFLOW = [
    ["upload", "上传证据包", "接收 DOCX、PPTX、XLSX/XLSM、PDF 与文本证据。"],
    ["parse", "本地解析与映射", "读取正文、表格、Sheet/Slide、Helix 字段和稳定来源定位。"],
    ["review", "全证据 AI 复核", "按过程、BP/GP、证据强度与跨文件依赖生成候选结论。"],
    ["support", "SUP 闭环检查", "联合检查 SUP.8 配置、SUP.9 问题与 SUP.10 变更链。"],
    ["dependency", "依赖与影响分析", "识别上下游工作产品、跨过程关系和断裂点。"],
    ["gate", "评估师确认与导出", "人工改判、记录理由、通过质量门禁后形成报告。"]
  ];
  const HELIX_FIELD_GROUPS = [
    ["identity", "唯一标识", ["item id", "requirement id", "issue id", "defect id", "problem id", "cr id", "change id", "test id", "id", "编号", "标识"]],
    ["content", "对象内容", ["title", "summary", "description", "requirement", "text", "name", "标题", "摘要", "描述", "需求"]],
    ["state", "状态", ["state", "status", "workflow", "resolution", "状态", "阶段", "解决状态"]],
    ["ownership", "责任与批准", ["owner", "author", "assignee", "reviewer", "approver", "approved by", "责任人", "作者", "审核人", "批准人"]],
    ["control", "版本与基线", ["version", "revision", "baseline", "build", "modified", "updated", "版本", "修订", "基线", "更新时间"]],
    ["trace", "上下游追溯", ["upstream", "downstream", "parent", "child", "trace", "linked", "relationship", "source id", "target id", "上游", "下游", "父项", "子项", "追溯", "关联"]],
    ["impact", "影响与闭环", ["impact", "root cause", "verification", "closure", "closed by", "change request", "problem", "affected", "影响", "根因", "验证", "关闭", "变更", "问题", "受影响"]]
  ];
  const HELIX_STATUS_TERMS = {
    open: ["open", "new", "draft", "active", "in progress", "analysis", "处理中", "打开", "新建", "草稿"],
    review: ["review", "verify", "verification", "approval", "pending", "待评审", "待验证", "待批准", "审核中"],
    closed: ["closed", "done", "resolved", "approved", "verified", "complete", "已关闭", "完成", "已解决", "已批准", "已验证"],
    blocked: ["blocked", "rejected", "overdue", "failed", "阻塞", "拒绝", "逾期", "失败"]
  };

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    package: '<path d="m16.5 9.4-9-5.2"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    layers: '<path d="m12.83 2.18 8 4a2 2 0 0 1 0 3.58l-8 4a2 2 0 0 1-1.66 0l-8-4a2 2 0 0 1 0-3.58l8-4a2 2 0 0 1 1.66 0Z"/><path d="m22 12.5-9.17 4.59a2 2 0 0 1-1.66 0L2 12.5"/><path d="m22 17.5-9.17 4.59a2 2 0 0 1-1.66 0L2 17.5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    flask: '<path d="M9 3h6"/><path d="M10 9V3h4v6l5 9a2 2 0 0 1-1.7 3H6.7A2 2 0 0 1 5 18l5-9Z"/><path d="M8.5 14h7"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sparkles: '<path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z"/><path d="m5 15-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7L5 15Z"/><path d="m19 14-.5 1.5L17 16l1.5.5L19 18l.5-1.5L21 16l-1.5-.5L19 14Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m10.9 12.1 8.6-8.6M18 5l2 2M15 8l2 2"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };

  function icon(name, size) {
    return `<svg${size ? ` width="${size}" height="${size}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
  }

  function id(prefix = "id") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]); }
  function formatDate(value) { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  function relativeDate(value) { const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000); return days <= 0 ? "今天" : days === 1 ? "昨天" : `${days} 天前`; }
  function formatSize(bytes = 0) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }
  function averageRating(items = []) { if (!items.length) return "—"; const avg = items.reduce((sum, item) => sum + (RATING_SCORE[item.rating] || 0), 0) / items.length; return RATING_ORDER.reduce((best, r) => Math.abs(RATING_SCORE[r] - avg) < Math.abs(RATING_SCORE[best] - avg) ? r : best, "N"); }
  function ratingClass(rating) { return ["F", "L+", "L"].includes(rating) ? "success" : ["L-", "P+", "P"].includes(rating) ? "warn" : "danger"; }
  function ratingMeets(rating, threshold) { return (RATING_SCORE[rating] || 0) >= (threshold === "F" ? 85 : threshold === "L" ? 50 : threshold === "P" ? 15 : 0); }
  function processAssessments(project, processId, pa) { return (project.assessments || []).filter(item => item.process === processId && (!pa || item.pa === pa)); }
  function processPaRating(project, processId, pa) { return averageRating(processAssessments(project, processId, pa)); }
  function processCapability(project, processId) {
    if (project.importSource && project.processResults?.length) return Number(project.processResults.find(item => item.id === processId)?.achievedLevel || 0);
    const pa11 = processPaRating(project, processId, "PA 1.1");
    const pa21 = processPaRating(project, processId, "PA 2.1");
    const pa22 = processPaRating(project, processId, "PA 2.2");
    if (ratingMeets(pa11, "F") && ratingMeets(pa21, "L") && ratingMeets(pa22, "L")) return 2;
    if (ratingMeets(pa11, "L")) return 1;
    return 0;
  }
  function achievedLevel(project) {
    if (!(project.assessments || []).length) return "—";
    const levels = (project.processes || []).map(processId => processCapability(project, processId));
    return `Level ${levels.length ? Math.min(...levels) : 0}`;
  }
  function refreshProjectOutcome(project) { if (project.importSource && project.processResults?.length) { project.achievedLevel = `Level ${Math.min(...project.processResults.map(item => Number(item.achievedLevel || 0)))}`; return project.achievedLevel; } project.achievedLevel = achievedLevel(project); return project.achievedLevel; }
  function assessmentQuality(project) {
    const items = project.assessments || [];
    const insufficient = items.filter(item => item.evidenceSufficiency?.status === "insufficient" || !(item.refs || []).length).length;
    const partial = items.filter(item => item.evidenceSufficiency?.status === "partial").length;
    const unreviewed = items.filter(item => !item.reviewed).length;
    const lowConfidence = items.filter(item => Number(item.confidence || 0) < 70).length;
    const missingFinding = items.filter(item => RATING_SCORE[item.rating] < 85 && !(item.findings || []).some(f => f.type === "W" || f.type === "R")).length;
    const cited = items.reduce((sum, item) => sum + (item.evidenceAnalysis?.length || 0), 0);
    const coverage = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.evidenceSufficiency?.coverage || 0), 0) / items.length) : 0;
    const relationRows=(project.processes||[]).flatMap(processId=>crossProcessSummary(project,processId));
    const relatedGaps=relationRows.filter(item=>!item.evidenceCodes.length).length;
    return { insufficient, partial, unreviewed, lowConfidence, missingFinding, cited, coverage, relatedGaps, ready: !!items.length && !insufficient && !partial && !unreviewed && !missingFinding };
  }
  function sufficiencyLabel(status) { return status === "sufficient" ? "证据充分" : status === "partial" ? "证据部分充分" : "证据不足"; }
  function sufficiencyTone(status) { return status === "sufficient" ? "success" : status === "partial" ? "warn" : "danger"; }
  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (error) { console.warn("Workspace save failed", error); } }

  function openAttachmentDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ATTACHMENT_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(ATTACHMENT_STORE)) request.result.createObjectStore(ATTACHMENT_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("附件数据库无法打开"));
    });
  }
  async function attachmentStoreRequest(mode, operation) {
    const database = await openAttachmentDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(ATTACHMENT_STORE, mode);
        const request = operation(transaction.objectStore(ATTACHMENT_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || transaction.error || new Error("附件操作失败"));
        transaction.onabort = () => reject(transaction.error || new Error("附件操作已中止"));
      });
    } finally { database.close(); }
  }
  function putAttachment(metadata, blob) { return attachmentStoreRequest("readwrite", store => store.put({ ...metadata, blob })); }
  function getAttachment(attachmentId) { return attachmentStoreRequest("readonly", store => store.get(attachmentId)); }
  function deleteAttachment(attachmentId) { return attachmentStoreRequest("readwrite", store => store.delete(attachmentId)); }
  async function deleteRecordAttachments(record) { await Promise.all((record?.attachments || []).map(item => deleteAttachment(item.id))); }
  function attachmentMetadata(file) { return { id: id("ATT").toUpperCase(), name: file.name, type: file.type || "application/octet-stream", size: file.size, lastModified: file.lastModified || Date.now() }; }
  function attachmentMarkup(metadata, pending = false) {
    const image = String(metadata.type || "").startsWith("image/");
    return `<article class="record-attachment ${pending ? "pending" : "existing"}" data-attachment-id="${esc(metadata.id)}" data-${pending ? "pending" : "existing"}-attachment><div class="attachment-preview">${image ? `<img alt="" data-attachment-thumbnail="${esc(metadata.id)}">` : icon("file")}</div><div><strong title="${esc(metadata.name)}">${esc(metadata.name)}</strong><small>${esc(formatSize(metadata.size))} · ${pending ? "待保存" : "已保存"}</small></div><div class="attachment-actions">${pending ? "" : `<button type="button" class="icon-btn compact" data-action="view-record-attachment" data-id="${esc(metadata.id)}" title="查看">${icon("eye")}</button><button type="button" class="icon-btn compact" data-action="download-record-attachment" data-id="${esc(metadata.id)}" title="下载">${icon("download")}</button>`}<button type="button" class="icon-btn compact danger" data-action="remove-${pending ? "pending" : "existing"}-attachment" data-id="${esc(metadata.id)}" title="移除">${icon("trash")}</button></div></article>`;
  }
  async function hydrateAttachmentImages(root = drawerRoot) {
    const images = [...root.querySelectorAll("img[data-attachment-thumbnail]")];
    await Promise.all(images.map(async image => {
      try {
        const pending = pendingRecordAttachments.get(image.dataset.attachmentThumbnail);
        const stored = pending ? { blob: pending.file } : await getAttachment(image.dataset.attachmentThumbnail);
        if (!stored?.blob) return;
        const url = URL.createObjectURL(stored.blob);
        image.src = url;
        image.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      } catch (error) { console.warn("Attachment thumbnail failed", error); }
    }));
  }
  async function openRecordAttachment(attachmentId, downloadFile = false) {
    try {
      const stored = await getAttachment(attachmentId);
      if (!stored?.blob) throw new Error("附件内容不存在");
      const url = URL.createObjectURL(stored.blob);
      if (downloadFile) {
        const link = document.createElement("a"); link.href = url; link.download = stored.name || "attachment"; document.body.appendChild(link); link.click(); link.remove();
      } else window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { toast("附件无法打开", error.message || "IndexedDB 读取失败。", "warn"); }
  }

  function normalizeCell(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function parseXml(text) { return new DOMParser().parseFromString(String(text || ""), "application/xml"); }
  function xmlElementText(node) { return [...(node?.getElementsByTagName("t") || [])].map(item=>item.textContent||"").join("") || node?.textContent || ""; }
  function columnIndexFromRef(ref) {
    const letters=String(ref||"").match(/[A-Z]+/i)?.[0]?.toUpperCase()||"A";
    return [...letters].reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0)-1;
  }
  function uniqueHeaders(values, count) {
    const used=new Map();
    return Array.from({length:count},(_,index)=>{
      const raw=normalizeCell(values[index])||`Column ${index+1}`;
      const seen=(used.get(raw)||0)+1;used.set(raw,seen);
      return seen===1?raw:`${raw} (${seen})`;
    });
  }
  function helixFieldMatches(headers) {
    const normalized=headers.map(value=>normalizeCell(value).toLowerCase());
    const groups={};
    HELIX_FIELD_GROUPS.forEach(([key,label,terms])=>{
      const columns=[];
      normalized.forEach((header,index)=>{if(terms.some(term=>header===term||header.includes(term)))columns.push(index);});
      groups[key]={label,columns,headers:columns.map(index=>headers[index])};
    });
    return groups;
  }
  function classifyHelixStatus(value) {
    const text=normalizeCell(value).toLowerCase();
    return Object.entries(HELIX_STATUS_TERMS).find(([,terms])=>terms.some(term=>text===term||text.includes(term)))?.[0]||"other";
  }
  function makeEvidenceTable(name, source, rawRows) {
    const rows=(rawRows||[]).map(row=>(row||[]).slice(0,24).map(normalizeCell));
    const meaningful=rows.filter(row=>row.some(Boolean));
    if(!meaningful.length)return null;
    const headerIndex=Math.max(0,meaningful.findIndex(row=>row.filter(Boolean).length>=2));
    const usable=meaningful.slice(headerIndex);
    const columnCount=Math.min(24,Math.max(1,...usable.map(row=>row.length)));
    const headers=uniqueHeaders(usable[0]||[],columnCount);
    const allRecords=usable.slice(1).filter(row=>row.some(Boolean));
    const maxRows=Math.max(20,Math.min(200,Number(db?.settings?.helixMaxRows||60)));
    const records=allRecords.slice(0,maxRows).map(row=>Array.from({length:columnCount},(_,index)=>normalizeCell(row[index])));
    const groups=helixFieldMatches(headers);
    const detectedGroups=Object.entries(groups).filter(([,value])=>value.columns.length).map(([key])=>key);
    const stateColumns=groups.state.columns;
    const traceColumns=groups.trace.columns;
    const statusCounts={open:0,review:0,closed:0,blocked:0,other:0};
    records.forEach(row=>stateColumns.forEach(index=>statusCounts[classifyHelixStatus(row[index])]++));
    const linkedRows=records.filter(row=>traceColumns.some(index=>normalizeCell(row[index]))).length;
    const helixScore=Math.round(detectedGroups.length/HELIX_FIELD_GROUPS.length*100);
    const helixDetected=(db?.settings?.helixRequireIdentity??true)?!!groups.identity.columns.length&&(!!groups.state.columns.length||!!groups.trace.columns.length||!!groups.control.columns.length):detectedGroups.length>=3;
    return {
      name:normalizeCell(name)||"Table",
      source:normalizeCell(source)||"Document",
      headers,
      rows:records,
      rowCount:allRecords.length,
      columnCount,
      truncated:allRecords.length>records.length,
      helix:{
        detected:helixDetected,
        score:helixScore,
        groups:detectedGroups,
        fields:Object.fromEntries(Object.entries(groups).filter(([,value])=>value.columns.length).map(([key,value])=>[key,value.headers])),
        missing:HELIX_FIELD_GROUPS.filter(([key])=>!detectedGroups.includes(key)).map(([,label])=>label),
        statusCounts,
        linkedRows
      }
    };
  }
  function summarizeHelixTables(tables) {
    const detected=(tables||[]).filter(table=>table.helix?.detected);
    const groups=[...new Set(detected.flatMap(table=>table.helix.groups||[]))];
    const statusCounts={open:0,review:0,closed:0,blocked:0,other:0};
    detected.forEach(table=>Object.keys(statusCounts).forEach(key=>statusCounts[key]+=Number(table.helix.statusCounts?.[key]||0)));
    return {
      detected:!!detected.length,
      tableCount:detected.length,
      rowCount:detected.reduce((sum,table)=>sum+Number(table.rowCount||0),0),
      score:detected.length?Math.round(detected.reduce((sum,table)=>sum+table.helix.score,0)/detected.length):0,
      groups,
      fields:[...new Set(detected.flatMap(table=>Object.values(table.helix.fields||{}).flat()))],
      missing:HELIX_FIELD_GROUPS.filter(([key])=>!groups.includes(key)).map(([,label])=>label),
      linkedRows:detected.reduce((sum,table)=>sum+Number(table.helix.linkedRows||0),0),
      statusCounts
    };
  }
  function tablesToEvidenceText(tables) {
    const lines=[];
    (tables||[]).slice(0,18).forEach(table=>{
      lines.push(`[${table.source} · ${table.name}] ${table.headers.join(" | ")}`);
      table.rows.slice(0,30).forEach((row,index)=>{
        const values=row.map((value,column)=>value?`${table.headers[column]}=${value}`:"").filter(Boolean);
        if(values.length)lines.push(`[${table.source} · ${table.name} · Row ${index+2}] ${values.join(" | ")}`);
      });
    });
    return lines.join("\n");
  }
  function tableLocators(tables) {
    return (tables||[]).flatMap(table=>table.rows.slice(0,3).map((row,index)=>({
      locator:`${table.source} · ${table.name} · Row ${index+2}`,
      excerpt:row.map((value,column)=>value?`${table.headers[column]}=${value}`:"").filter(Boolean).join(" | ").slice(0,260)
    }))).filter(item=>item.excerpt).slice(0,12);
  }
  function parseDelimited(text, delimiter) {
    const rows=[];let row=[],cell="",quoted=false;
    for(let index=0;index<String(text).length;index++){
      const char=text[index],next=text[index+1];
      if(char==='"'&&quoted&&next==='"'){cell+='"';index++;continue;}
      if(char==='"'){quoted=!quoted;continue;}
      if(char===delimiter&&!quoted){row.push(cell);cell="";continue;}
      if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')index++;row.push(cell);rows.push(row);row=[];cell="";continue;}
      cell+=char;
    }
    if(cell||row.length){row.push(cell);rows.push(row);}
    return rows;
  }
  function parseHtmlTables(text) {
    const doc=new DOMParser().parseFromString(text,"text/html");
    return [...doc.querySelectorAll("table")].map((table,index)=>makeEvidenceTable(`HTML Table ${index+1}`,"HTML",[...table.rows].map(row=>[...row.cells].map(cell=>cell.textContent||"")))).filter(Boolean);
  }
  function parseJsonTables(text) {
    try {
      const value=JSON.parse(text);const candidates=[];
      if(Array.isArray(value))candidates.push(["JSON Array",value]);
      else if(value&&typeof value==="object")Object.entries(value).forEach(([key,item])=>{if(Array.isArray(item))candidates.push([key,item]);});
      return candidates.map(([name,items])=>{
        const objects=items.filter(item=>item&&typeof item==="object"&&!Array.isArray(item));
        if(!objects.length)return null;const headers=[...new Set(objects.flatMap(item=>Object.keys(item)))];
        return makeEvidenceTable(name,"JSON",[headers,...objects.map(item=>headers.map(header=>typeof item[header]==="object"?JSON.stringify(item[header]):item[header]))]);
      }).filter(Boolean);
    } catch (_) { return []; }
  }
  async function zipText(zip,path) { const file=zip.file(path);return file?file.async("text"):""; }
  async function parseXlsxPackage(file) {
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const sharedDoc=parseXml(await zipText(zip,"xl/sharedStrings.xml"));
    const shared=[...sharedDoc.getElementsByTagName("si")].map(item=>xmlElementText(item));
    const workbook=parseXml(await zipText(zip,"xl/workbook.xml"));
    const rels=parseXml(await zipText(zip,"xl/_rels/workbook.xml.rels"));
    const relationTargets=Object.fromEntries([...rels.getElementsByTagName("Relationship")].map(item=>[item.getAttribute("Id"),item.getAttribute("Target")]));
    const tables=[];const text=[];
    for(const sheet of [...workbook.getElementsByTagName("sheet")]){
      const name=sheet.getAttribute("name")||"Sheet";
      const relationId=sheet.getAttribute("r:id")||sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
      let target=relationTargets[relationId]||"";if(!target)continue;
      target=target.startsWith("/")?target.slice(1):`xl/${target.replace(/^\.\.\//,"")}`;
      const doc=parseXml(await zipText(zip,target));const rows=[];
      [...doc.getElementsByTagName("row")].forEach(rowNode=>{
        const values=[];
        [...rowNode.getElementsByTagName("c")].forEach(cell=>{
          const index=columnIndexFromRef(cell.getAttribute("r"));const type=cell.getAttribute("t");
          const raw=cell.getElementsByTagName("v")[0]?.textContent??xmlElementText(cell);
          values[index]=type==="s"?shared[Number(raw)]??raw:type==="b"?(raw==="1"?"TRUE":"FALSE"):raw;
        });
        rows.push(values);
      });
      const table=makeEvidenceTable(name,`Sheet ${name}`,rows);if(table)tables.push(table);
      text.push(...rows.slice(0,120).map((row,index)=>`[Sheet ${name} · Row ${index+1}] ${row.map(normalizeCell).filter(Boolean).join(" | ")}`));
    }
    return {tables,text:text.join("\n"),structure:`${tables.length} 个 Sheet/表格`};
  }
  async function parseDocxPackage(file) {
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const doc=parseXml(await zipText(zip,"word/document.xml"));
    const paragraphs=[...doc.getElementsByTagName("w:p")].map((node,index)=>`[Paragraph ${index+1}] ${xmlElementText(node)}`).filter(line=>!line.endsWith("] "));
    const tables=[...doc.getElementsByTagName("w:tbl")].map((table,index)=>{
      const rows=[...table.getElementsByTagName("w:tr")].map(row=>[...row.getElementsByTagName("w:tc")].map(cell=>xmlElementText(cell)));
      return makeEvidenceTable(`Table ${index+1}`,"DOCX",rows);
    }).filter(Boolean);
    return {tables,text:`${paragraphs.join("\n")}\n${tablesToEvidenceText(tables)}`,structure:`${paragraphs.length} 个段落 · ${tables.length} 个表格`};
  }
  async function parsePptxPackage(file) {
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const slideNames=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));
    const tables=[];const text=[];
    for(let slideIndex=0;slideIndex<slideNames.length;slideIndex++){
      const doc=parseXml(await zipText(zip,slideNames[slideIndex]));
      const slideNo=slideIndex+1;const slideText=[...doc.getElementsByTagName("a:t")].map(node=>normalizeCell(node.textContent)).filter(Boolean);
      if(slideText.length)text.push(`[Slide ${slideNo}] ${slideText.join(" | ")}`);
      [...doc.getElementsByTagName("a:tbl")].forEach((table,index)=>{
        const rows=[...table.getElementsByTagName("a:tr")].map(row=>[...row.getElementsByTagName("a:tc")].map(cell=>xmlElementText(cell)));
        const parsed=makeEvidenceTable(`Table ${index+1}`,`Slide ${slideNo}`,rows);if(parsed)tables.push(parsed);
      });
    }
    return {tables,text:`${text.join("\n")}\n${tablesToEvidenceText(tables)}`,structure:`${slideNames.length} 个 Slide · ${tables.length} 个表格`};
  }
  async function parsePdfPackage(file) {
    const pdfjs=await import("/node_modules/pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="/node_modules/pdfjs-dist/build/pdf.worker.mjs";
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const tables=[];const text=[];
    for(let pageNo=1;pageNo<=Math.min(pdf.numPages,160);pageNo++){
      const page=await pdf.getPage(pageNo);const content=await page.getTextContent();
      const bands=new Map();
      content.items.forEach(item=>{const y=Math.round((item.transform?.[5]||0)/3)*3;const row=bands.get(y)||[];row.push({x:item.transform?.[4]||0,text:normalizeCell(item.str)});bands.set(y,row);});
      const rows=[...bands.entries()].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.x-b.x).map(item=>item.text).filter(Boolean)).filter(row=>row.length);
      text.push(...rows.map((row,index)=>`[Page ${pageNo} · Line ${index+1}] ${row.join(" | ")}`));
      const tableRows=rows.filter(row=>row.length>=2);if(tableRows.length>=2){const table=makeEvidenceTable(`Detected grid`, `Page ${pageNo}`,tableRows);if(table)tables.push(table);}
    }
    return {tables,text:`${text.join("\n")}\n${tablesToEvidenceText(tables)}`,structure:`${pdf.numPages} 页 · ${tables.length} 个候选表格`};
  }
  async function parseEvidenceFile(file) {
    const extension=(file.name.split(".").pop()||"").toLowerCase();
    let result={tables:[],text:"",structure:"仅文件元数据"};
    if(["xlsx","xlsm"].includes(extension))result=await parseXlsxPackage(file);
    else if(extension==="docx")result=await parseDocxPackage(file);
    else if(extension==="pptx")result=await parsePptxPackage(file);
    else if(extension==="pdf")result=await parsePdfPackage(file);
    else {
      const text=await file.text();let tables=[];
      if(extension==="csv")tables=[makeEvidenceTable(file.name,"CSV",parseDelimited(text,","))].filter(Boolean);
      else if(extension==="html")tables=parseHtmlTables(text);
      else if(extension==="json")tables=parseJsonTables(text);
      result={tables,text:`${text}\n${tablesToEvidenceText(tables)}`,structure:tables.length?`${tables.length} 个结构化表格`:"文本正文"};
    }
    const tables=(result.tables||[]).slice(0,30);const locators=tableLocators(tables);const helix=summarizeHelixTables(tables);
    return {content:String(result.text||"").slice(0,500000),tables,locators,helix,structure:result.structure,parseStatus:"parsed"};
  }

  function clampScore(value) { return Math.max(0, Math.min(100, Math.round(value))); }
  function canonicalCode(code) { return String(code || "").replace(/\s+/g, ""); }
  function processName(processId) { const item=PROCESS_CATALOG.find(process=>process.id===processId);return item?`${item.id} ${item.zh}`:processId; }
  function processIdsFromText(text) {
    const value=String(text||"").toLowerCase();
    return PROCESS_CATALOG.filter(process=>{
      const id=process.id.toLowerCase();
      const compact=id.replace(".","");
      return value.includes(id)||value.includes(compact)||value.includes(process.zh.toLowerCase())||value.includes(process.en.toLowerCase());
    }).map(process=>process.id);
  }
  function inferEvidencePrimaryProcesses(evidence, formalProcesses=[]) {
    const stored=Array.isArray(evidence.primaryProcesses)?evidence.primaryProcesses.filter(Boolean):[];
    const explicit=processIdsFromText(evidence.scope);
    const inferred=processIdsFromText(`${evidence.name||""} ${String(evidence.content||"").slice(0,12000)} ${tablesToEvidenceText(evidence.tables||[]).slice(0,12000)}`);
    const detected=[...new Set([...stored,...explicit,...inferred])];
    if(detected.length)return detected;
    const scope=String(evidence.scope||"").toLowerCase();
    return (!scope||scope.includes("全部")||scope.includes("all"))?[...formalProcesses]:[];
  }
  function suggestedEvidenceScope(name, formalProcesses=[]) {
    const inferred=processIdsFromText(name).filter(id=>formalProcesses.includes(id));
    return inferred.length?inferred.join("、"):"全部审核项";
  }
  function relatedProcessesFor(processId, formalProcesses=[]) {
    const relations=[];
    ENGINEERING_CHAINS.forEach(chain=>{
      const index=chain.indexOf(processId);if(index<0)return;
      if(index>0)relations.push({sourceProcess:chain[index-1],targetProcess:processId,relatedProcess:chain[index-1],relationType:"upstream",rationale:`检查来自 ${chain[index-1]} 的输入、批准、追溯和变更是否完整。`});
      if(index<chain.length-1)relations.push({sourceProcess:processId,targetProcess:chain[index+1],relatedProcess:chain[index+1],relationType:"downstream",rationale:`检查 ${chain[index+1]} 是否正确消费输出并反馈验证或集成问题。`});
    });
    PROCESS_BRIDGES.forEach(([sourceProcess,targetProcess,relationType,rationale])=>{
      if(processId===sourceProcess)relations.push({sourceProcess,targetProcess,relatedProcess:targetProcess,relationType,rationale});
      else if(processId===targetProcess)relations.push({sourceProcess,targetProcess,relatedProcess:sourceProcess,relationType:"upstream",rationale});
    });
    const support=SUPPORT_PROCESS_RELATIONS.find(item=>item[0]===processId);
    if(support){
      formalProcesses.filter(id=>id!==processId).forEach(targetProcess=>relations.push({sourceProcess:processId,targetProcess,relatedProcess:targetProcess,relationType:support[1],rationale:`通过 ${processId} 检查${support[2]}。`}));
    }else{
      SUPPORT_PROCESS_RELATIONS.forEach(([sourceProcess,relationType,focus])=>relations.push({sourceProcess,targetProcess:processId,relatedProcess:sourceProcess,relationType,rationale:`通过 ${sourceProcess} 检查${focus}。`}));
    }
    const seen=new Set();
    return relations.filter(relation=>{const key=`${relation.sourceProcess}|${relation.targetProcess}|${relation.relationType}`;if(seen.has(key)||relation.relatedProcess===processId)return false;seen.add(key);return true;}).map(relation=>({...relation,scopeStatus:formalProcesses.includes(relation.relatedProcess)?"in-scope":"related-only"}));
  }
  function evidenceRelationToProcess(evidence, processId, formalProcesses=[]) {
    const primary=inferEvidencePrimaryProcesses(evidence,formalProcesses);
    if(primary.includes(processId))return {sourceProcess:processId,targetProcess:processId,relatedProcess:processId,relationType:"direct",scopeStatus:"in-scope"};
    const relations=relatedProcessesFor(processId,formalProcesses);
    return relations.find(relation=>primary.includes(relation.relatedProcess))||null;
  }
  function evidenceAppliesTo(evidence, processId, formalProcesses=[]) {
    return !!evidenceRelationToProcess(evidence,processId,formalProcesses);
  }
  function buildCrossProcessAnalysis(processId,evidence=[],formalProcesses=[]) {
    return relatedProcessesFor(processId,formalProcesses).map(relation=>{
      const relatedEvidence=evidence.filter(item=>inferEvidencePrimaryProcesses(item,formalProcesses).includes(relation.relatedProcess));
      const evidenceCodes=relatedEvidence.map(item=>item.code).filter(Boolean).slice(0,5);
      const hasDirectText=relatedEvidence.some(item=>String(item.content||"").trim().length>=120);
      const helixRows=relatedEvidence.reduce((sum,item)=>sum+Number(item.helix?.rowCount||0),0);
      const helixTraceRows=relatedEvidence.reduce((sum,item)=>sum+Number(item.helix?.linkedRows||0),0);
      const passIds=(relation.relationType==="governance"?["agree-summarize","divide-control"]:relation.relationType==="configuration"?["qualified-flow","trace-consistency"]:["qualified-flow","agree-summarize","trace-consistency"]);
      if(["integration-pair","unit-verification-pair","integration-input"].includes(relation.relationType))passIds.push("divide-control");
      return {...relation,analysisPasses:[...new Set(passIds)],evidenceCodes,helixRows,helixTraceRows,supportedClaim:evidenceCodes.length?`${relation.rationale}${helixRows?` 已读取 Helix 表格 ${helixRows} 行，其中 ${helixTraceRows} 行具有关系字段；需继续核实关系类型、版本和两端状态。`:hasDirectText?" 已发现可定位的关联内容，仍需核实接口两侧一致性。":" 当前只有文件索引或元数据。"}`:"尚无关联证据支持该关系。",gapOrRisk:evidenceCodes.length?(hasDirectText?"关联证据只能用于交叉佐证，不能替代目标过程的直接实施证据。":"缺少可定位正文，无法验证版本、批准和闭环。"):`${relation.relatedProcess} 的输入/治理/反馈未被当前证据包覆盖。`,followUp:evidenceCodes.length?`抽查 ${relation.relatedProcess} 与 ${processId} 的双向链接、相同版本和关闭状态。`:`补充 ${relation.relatedProcess} 的受控记录，并访谈关系两侧责任人。`};
    });
  }
  function crossProcessSummary(project,processId) { return buildCrossProcessAnalysis(processId,project.evidence||[],project.processes||[]); }
  function relationLabel(type) { return ({direct:"直接",upstream:"上游",downstream:"下游",allocation:"分配",governance:"项目治理",assurance:"质量保证",configuration:"配置管理",problem:"问题管理",change:"变更管理","verification-pair":"需求↔资格验证","integration-pair":"架构↔集成验证","unit-verification-pair":"详细设计↔单元验证","integration-input":"集成输入","release-input":"发布输入","supplier-dependency":"供应商依赖","nonconformance-to-problem":"不符合项→问题","problem-to-change":"问题→变更","configuration-status":"配置状态→项目状态","release-baseline":"基线→发布"})[type]||type; }
  function crossProcessMarkup(project,processId,compact=false) {
    const rows=crossProcessSummary(project,processId);
    return `<div class="cross-process-analysis ${compact?"compact":""}">${rows.map(row=>`<article class="cross-process-card ${row.evidenceCodes.length?"covered":"gap"}"><header>${badge(row.scopeStatus==="in-scope"?"info":"neutral",row.scopeStatus==="in-scope"?"正式范围":"关联观察·不评级")}<span>${esc(relationLabel(row.relationType))}</span></header><strong>${esc(row.sourceProcess)} → ${esc(row.targetProcess)}</strong><p>${esc(row.supportedClaim)}</p><small>${esc(row.gapOrRisk)}</small><div class="analysis-pass-tags">${row.analysisPasses.map(pass=>`<span>${esc(CROSS_PROCESS_PASSES.find(item=>item[0]===pass)?.[1]||pass)}</span>`).join("")}</div><footer>${row.evidenceCodes.map(code=>`<span class="code-tag">${esc(code)}</span>`).join(" ")||"待补证据"}</footer></article>`).join("")}</div>`;
  }
  function assessmentRequirements(processId, kind, pa) {
    if (kind === "BP") return EVIDENCE_GUIDE[processId] || ["过程定义或计划", "项目执行样本", "评审/批准记录", "追溯或闭环记录"];
    return pa === "PA 2.1"
      ? ["过程目标与策略", "项目级过程计划", "资源与职责", "周期监控/偏差措施", "接口沟通记录"]
      : ["工作产品准则", "评审与批准", "配置/版本/基线", "变更与问题闭环"];
  }
  function makeEvidenceAnalysis(evidence, processId, criterion, requirements, formalProcesses=[]) {
    const evidenceRank=({item,relation})=>(relation.relationType==="direct"?100:0)+(item.helix?.detected?40:0)+((item.tables||[]).some(table=>table.rowCount>0)?25:0)+(String(item.content||"").trim().length>=120?15:0)+((item.locators||[]).length?5:0);
    return (evidence || []).map(item=>({item,relation:evidenceRelationToProcess(item,processId,formalProcesses)})).filter(entry=>entry.relation).sort((a,b)=>evidenceRank(b)-evidenceRank(a)).slice(0, 5).map(({item,relation}, index) => {
      const content = String(item.content || "").replace(/\s+/g, " ").trim();
      const tableLocator=(item.locators||[])[index%(item.locators?.length||1)];
      const direct = content.length >= 120 || (item.tables||[]).some(table=>table.rowCount>0);
      const strength=!direct?"index-only":relation.relationType==="direct"?"direct":"corroborating";
      return {
        evidenceId: item.id,
        evidenceCode: item.code || `EV.${String(index + 1).padStart(3, "0")}`,
        source: item.name,
        locator: direct ? (tableLocator?.locator||`正文摘录 · 字符 1–${Math.min(content.length, 220)}`) : "文件索引 · 待审核员打开原文定位",
        excerpt: direct ? (tableLocator?.excerpt||content.slice(0, 220)) : `已登记“${item.name}”的文件元数据，但当前工作区未保留可引用正文。`,
        claim: relation.relationType==="direct"?`用于直接核实：${criterion}`:`用于交叉核实 ${relation.relatedProcess} 与 ${processId} 的${relationLabel(relation.relationType)}关系；不得替代目标过程直接证据。`,
        dimension: requirements[index % requirements.length],
        strength,
        helixTable:!!item.helix?.detected,
        helixStatusCounts:item.helix?.statusCounts||null,
        originProcess: relation.sourceProcess,
        targetProcess: processId,
        relatedProcess: relation.relatedProcess,
        relationType: relation.relationType,
        scopeStatus: relation.scopeStatus
      };
    });
  }
  function buildEvidenceSufficiency(analysis, requirements) {
    const direct = analysis.filter(item => item.strength === "direct").length;
    const corroborating = analysis.filter(item => item.strength === "corroborating").length;
    const observed = analysis.length;
    const status = direct >= 2 && observed >= 2 ? "sufficient" : observed ? "partial" : "insufficient";
    const coverage = status === "sufficient" ? Math.min(100, 82 + observed * 5) : status === "partial" ? Math.min(76, 26 + observed * 18 + direct * 12) : 0;
    const coveredTypes = requirements.slice(0, Math.min(requirements.length, direct + Math.ceil(observed / 2)));
    return {
      status,
      coverage,
      citedCount: observed,
      directCount: direct,
      corroboratingCount: corroborating,
      minimumSampleCount: 3,
      observedSampleCount: observed,
      coveredTypes,
      missingTypes: requirements.filter(item => !coveredTypes.includes(item))
    };
  }
  function traceLinksForAssessment(project,assessment) {
    if(!assessment)return [];
    const key=indicatorKey(assessment);const links=new Map();
    (assessment.evidenceAnalysis||[]).forEach((item,index)=>{const relationKey=item.evidenceId||item.evidenceCode||`AUTO-${index}`;links.set(relationKey,{id:`AUTO-${assessment.id}-${index}`,indicator:key,evidenceId:item.evidenceId,evidenceCode:item.evidenceCode,strength:item.strength,relationType:item.relationType||"direct",locator:item.locator,claim:item.claim,source:"AI inferred",confirmed:false});});
    (project.traceLinks||[]).filter(link=>link.indicator===key).forEach(link=>{const relationKey=link.evidenceId||link.evidenceCode||link.id;links.set(relationKey,{...links.get(relationKey),...link,source:"Assessor confirmed",confirmed:true});});
    return [...links.values()];
  }
  function traceCoverage(project) {
    const assessments=project.assessments||[];const links=assessments.flatMap(item=>traceLinksForAssessment(project,item));
    const direct=assessments.filter(item=>traceLinksForAssessment(project,item).some(link=>link.strength==="direct")).length;
    const linked=assessments.filter(item=>traceLinksForAssessment(project,item).length).length;
    const confirmed=new Set((project.traceLinks||[]).map(link=>`${link.indicator}|${link.evidenceId}`)).size;
    const blocked=(project.evidence||[]).reduce((sum,item)=>sum+Number(item.helix?.statusCounts?.blocked||0),0);
    return {total:assessments.length,direct,linked,gaps:Math.max(0,assessments.length-linked),confirmed,linkCount:links.length,blocked,directPercent:assessments.length?Math.round(direct/assessments.length*100):0,linkedPercent:assessments.length?Math.round(linked/assessments.length*100):0};
  }
  function projectProgressStages(project) {
    const quality=assessmentQuality(project);const trace=traceCoverage(project);const finalized=(project.records||[]).filter(record=>record.status==="Final").length;
    return [
      {name:"范围与计划",value:(project.instances?.length&&project.processes?.length)?100:35,detail:`${project.processes?.length||0} 过程 · ${project.instances?.length||0} 实例`},
      {name:"证据准备",value:project.evidence?.length?Math.round((project.evidence.filter(item=>item.parseStatus==="parsed").length/project.evidence.length)*100):0,detail:`${project.evidence?.length||0} 份证据`},
      {name:"指标追溯",value:trace.linkedPercent,detail:`${trace.linked}/${trace.total} 指标已关联`},
      {name:"人工复核",value:project.assessments?.length?Math.round(project.assessments.filter(item=>item.reviewed).length/project.assessments.length*100):0,detail:`${quality.unreviewed} 项待复核`},
      {name:"记录定稿",value:project.records?.length?Math.round(finalized/project.records.length*100):0,detail:`${finalized}/${project.records?.length||0} 已定稿`},
      {name:"关闭门禁",value:project.assessmentState==="Closed"?100:quality.ready?82:Math.max(8,Math.round((quality.coverage||0)*.72)),detail:project.assessmentState==="Closed"?"已关闭":quality.ready?"可进入关闭":"仍有阻塞"}
    ];
  }
  function suggestedFindingTemplates(indicator,type="") {
    const process=String(indicator||"").split(".").slice(0,2).join(".");
    return [...(db.recordTemplates||[])].map(template=>{
      let score=Number(template.usageCount||0);
      if((template.indicators||[]).includes(indicator))score+=100;
      if((template.indicators||[]).some(item=>String(item).startsWith(process)))score+=35;
      if(type&&template.type===type)score+=20;
      return {template,score};
    }).sort((a,b)=>b.score-a.score).map(item=>item.template).slice(0,4);
  }
  function ratingCappedByEvidence(candidate, sufficiency) {
    if (sufficiency.status === "insufficient") return "N";
    const max = sufficiency.directCount ? (sufficiency.citedCount >= 2 ? "L+" : "L-") : (sufficiency.citedCount >= 2 ? "P+" : "P");
    return RATING_SCORE[candidate] <= RATING_SCORE[max] ? candidate : max;
  }
  function makeScoreBreakdown(rating, index, sufficiency) {
    const base = RATING_SCORE[rating];
    return {
      definition: clampScore(base + ((index % 3) - 1) * 7),
      implementation: clampScore(base - (sufficiency.status === "sufficient" ? 1 : 12)),
      consistency: clampScore(base - (sufficiency.citedCount < 2 ? 18 : 4)),
      governance: clampScore(base + ((index % 2) ? 4 : -5)),
      closure: clampScore(base - (sufficiency.directCount ? 6 : 20))
    };
  }
  function buildProfessionalAssessment({ processId, processName, kind, pa, practice, index, pIndex, seedOffset, evidence, formalProcesses }) {
    const [code, title, criterion] = practice;
    const requirements = assessmentRequirements(processId, kind, pa);
    const evidenceAnalysis = makeEvidenceAnalysis(evidence, processId, criterion, requirements, formalProcesses);
    const evidenceSufficiency = buildEvidenceSufficiency(evidenceAnalysis, requirements);
    const crossProcessAnalysis = buildCrossProcessAnalysis(processId,evidence,formalProcesses);
    const candidates = ["L", "L-", "P+", "L+", "P", "F", "L", "P+"];
    const evidenceCappedRating = ratingCappedByEvidence(candidates[(index + pIndex + seedOffset + (kind === "GP" ? 2 : 0)) % candidates.length], evidenceSufficiency);
    const helixBlockers=evidenceAnalysis.reduce((sum,item)=>sum+Number(item.helixStatusCounts?.blocked||0),0);
    const rating = helixBlockers && RATING_SCORE[evidenceCappedRating]>RATING_SCORE["P+"] ? "P+" : evidenceCappedRating;
    const firstEvidence = evidenceAnalysis[0];
    const missingText = evidenceSufficiency.missingTypes.slice(0, 2).join("、") || "跨周期一致性样本";
    const professionalBasis = firstEvidence
      ? `已引用 ${firstEvidence.evidenceCode}《${firstEvidence.source}》，其${firstEvidence.strength === "index-only" ? "文件索引只能间接" : firstEvidence.helixTable ? `Helix 行级表格证据（${firstEvidence.locator}）可以直接` : "正文摘录可以直接"}支持“${criterion}”的判断。`
      : `当前没有可定位到 ${processId} 的项目证据，不能把流程定义或口头说明当作实施证明。`;
    const coveredRelations=crossProcessAnalysis.filter(item=>item.evidenceCodes.length).length;
    const blockerText=helixBlockers?` Helix 状态字段中发现 ${helixBlockers} 条阻塞对象，未验证关闭前评分上限为 P+。`:"";
    const reason = `${professionalBasis} AI 同时沿上游、下游及 MAN.3/SUP.1/SUP.8～10 检查了 ${crossProcessAnalysis.length} 条过程关系，其中 ${coveredRelations} 条发现关联证据；关联证据仅用于一致性佐证。${blockerText}当前目标过程直接证据覆盖率 ${evidenceSufficiency.coverage}%，仍${evidenceSufficiency.status === "sufficient" ? "需通过访谈确认样本代表性和跨版本稳定性" : `缺少${missingText}`}，因此给出 ${rating} 候选；若补证据后结论变化，应保留重评版本。`;
    const refs = evidenceAnalysis.length
      ? evidenceAnalysis.map(item => `${item.evidenceCode} · ${item.source} · ${item.locator}`)
      : [`未提供 ${processId} / ${canonicalCode(code)} 的可定位证据`];
    const closureEvidence = evidenceSufficiency.status === "sufficient"
      ? ["由审核员抽查至少 3 个跨里程碑样本并确认结论一致", "确认引用证据处于获批基线且可由报告反向打开"]
      : evidenceSufficiency.missingTypes.slice(0, 3).map(item => `补充并定位：${item}`);
    const findings = [];
    if (firstEvidence) findings.push({ type: "O", text: `${firstEvidence.evidenceCode} 已登记并与 ${processId} 关联；${firstEvidence.locator}。` });
    if (evidenceSufficiency.status !== "sufficient") findings.push({ type: "W", text: `${processId} ${canonicalCode(code)} 的证据链不充分：${missingText}未被直接证明，当前评分上限受证据护栏限制。` });
    findings.push({ type: "R", text: closureEvidence[0] || "补充受控样本并由评估师复核。" });
    return {
      id: id("asmt"),
      group: `${processId} · ${pa}`,
      process: processId,
      processName,
      kind,
      pa,
      code: canonicalCode(code),
      title,
      criterion,
      rating,
      aiCandidateRating: rating,
      achievementPercent: RATING_SCORE[rating],
      confidence: Math.min(96, (evidenceSufficiency.status === "sufficient" ? 86 : evidenceSufficiency.status === "partial" ? 70 : 52) + ((index + pIndex) % 7)),
      scoreBreakdown: makeScoreBreakdown(rating, index, evidenceSufficiency),
      evidenceAnalysis,
      crossProcessAnalysis,
      evidenceSufficiency,
      requiredEvidence: requirements,
      reason,
      findings,
      refs,
      interviewQuestions: [
        `请演示 ${processId} ${canonicalCode(code)} 最近一次实际执行，从输入、责任人到输出和批准。`,
        `当“${title}”发生偏差或变更时，如何通过 MAN.3、SUP.8、SUP.9、SUP.10 识别影响并证明问题已经闭环？`,
        `请从 ${processId} 的一个样本向上游和下游各追踪一次，确认版本、批准状态和语义一致。`
      ],
      closureEvidence,
      reviewerNote: "",
      reviewed: false,
      aiSource: "local-professional-engine"
    };
  }
  function buildAssessments(processes, seedOffset = 0, evidence = []) {
    const result = [];
    processes.forEach((processId, pIndex) => {
      const proc = PROCESS_CATALOG.find(item => item.id === processId) || { id: processId, zh: processId, bp: 6 };
      const practices = PRACTICE_LIBRARY[processId] || Array.from({ length: proc.bp }, (_, i) => [`BP${i + 1}`, `${proc.zh} 基本实践 ${i + 1}`, "确认活动被定义、执行、受控并具有可定位的项目级客观证据。"]);
      practices.forEach((practice, index) => result.push(buildProfessionalAssessment({ processId, processName: proc.zh, kind: "BP", pa: "PA 1.1", practice, index, pIndex, seedOffset, evidence, formalProcesses: processes })));
      GP_LIBRARY.forEach((practice, index) => result.push(buildProfessionalAssessment({ processId, processName: proc.zh, kind: "GP", pa: index < 6 ? "PA 2.1" : "PA 2.2", practice, index, pIndex, seedOffset, evidence, formalProcesses: processes })));
    });
    return result;
  }

  function importedRatingScore(value, rating) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : (RATING_SCORE[rating] || 0);
  }

  function buildImportedTmmProject(source) {
    if (!source?.project || !Array.isArray(source.processes)) return null;
    const importedAt = new Date().toISOString();
    const processes = source.processes.map(item => item.id);
    const evidence = source.processes.flatMap(process => process.practices.filter(item => item.evidence).map((item, index) => ({
      id: `TMM-EV-${process.id.replace(".", "-")}-${String(index + 1).padStart(2, "0")}`,
      code: `EV.${process.id}.${String(index + 1).padStart(2, "0")}`,
      name: `${process.id} ${item.practiceId} · Professional assessor evidence`,
      type: "Imported ASPICE assessor statement", size: new Blob([item.evidence]).size, chars: item.evidence.length,
      source: source.sourceFile, date: `${source.assessmentPeriod}-30T00:00:00.000Z`, scope: process.id,
      primaryProcesses: [process.id], content: item.evidence, tables: [],
      locators: [{ locator: item.sourceCell, excerpt: item.evidence.slice(0, 420) }],
      helix: summarizeHelixTables([]), structure: `Excel rating sheet · ${item.sourceCell}`,
      parseStatus: "parsed", importSource: { importId: source.importId, sourceFile: source.sourceFile, sheet: process.id, cellRange: item.sourceCell }
    })));
    const evidenceByPractice = new Map();
    evidence.forEach(item => evidenceByPractice.set(`${item.scope}|${item.name.split(" · ")[0].split(" ").at(-1)}`, item));
    const assessments = source.processes.flatMap(process => process.practices.map((item, index) => {
      const evidenceItem = evidenceByPractice.get(`${process.id}|${item.practiceId}`);
      const score = importedRatingScore(item.score, item.rating);
      const hasEvidence = !!item.evidence;
      const findings = [];
      if (hasEvidence) findings.push({ type: "O", text: item.evidence });
      if (item.weakness) findings.push({ type: "W", text: item.weakness });
      if (item.assessorComment) findings.push({ type: "R", text: item.assessorComment });
      return {
        id: `TMM-ASMT-${process.id.replace(".", "-")}-${item.code.replaceAll(".", "-")}`,
        group: `${process.id} · ${item.pa}`, process: process.id, processName: process.title,
        kind: item.code.startsWith("GP") ? "GP" : "BP", pa: item.pa, code: item.code,
        title: item.title || item.practiceId, criterion: item.criterion || "Imported professional assessor criterion",
        rating: item.rating, aiCandidateRating: item.rating, achievementPercent: score, confidence: 100,
        scoreBreakdown: { definition: score, implementation: score, consistency: score, governance: score, closure: score },
        evidenceAnalysis: evidenceItem ? [{ evidenceId: evidenceItem.id, evidenceCode: evidenceItem.code, source: source.sourceFile, locator: item.sourceCell, excerpt: item.evidence.slice(0, 420), claim: `Professional assessor evidence for ${item.practiceId}`, dimension: "Imported objective evidence statement", strength: "direct", helixTable: false, originProcess: process.id, targetProcess: process.id, relationType: "direct", relatedProcess: process.id }] : [],
        crossProcessAnalysis: [],
        evidenceSufficiency: { status: hasEvidence ? "sufficient" : "partial", coverage: hasEvidence ? 100 : 50, citedCount: hasEvidence ? 1 : 0, directCount: hasEvidence ? 1 : 0, corroboratingCount: 0, coveredTypes: hasEvidence ? ["Professional assessor evidence statement"] : [], missingTypes: hasEvidence ? [] : ["Source evidence statement"] },
        requiredEvidence: [], reason: item.weakness || item.evidence || "The source report contains a rating without a detailed statement.",
        findings, refs: evidenceItem ? [`${evidenceItem.code} · ${source.sourceFile} · ${item.sourceCell}`] : [`${source.sourceFile} · ${item.sourceCell}`],
        interviewQuestions: [], closureEvidence: item.weakness ? [item.assessorComment || "Address the weakness and provide verified closure evidence."] : [],
        reviewerNote: item.assessorComment || "Imported from consolidated professional assessor rating sheet.", reviewed: true,
        aiSource: "imported-professional-assessor", sourceAssessment: { importId: source.importId, sourceFile: source.sourceFile, sheet: process.id, cellRange: item.sourceCell, practiceId: item.practiceId, originalScore: item.score, originalRating: item.rating, evidence: item.evidence, weakness: item.weakness, assessorComment: item.assessorComment }
      };
    }));
    const records = assessments.flatMap(item => [
      ...(item.sourceAssessment.weakness ? [{ id: `TMM-W-${item.id}`, type: "weakness", text: item.sourceAssessment.weakness, indicators: [`${item.process}.${item.code}`], evidenceIds: item.evidenceAnalysis.map(entry => entry.evidenceId), workspaceId: "WS-TMM-FINAL", instanceId: "INS-TMM", creator: "Professional Assessor Team", general: false, presentation: true, created: `${source.assessmentPeriod}-30T00:00:00.000Z`, status: "Final", closureState: "评估报告已记录", attachments: [] }] : []),
      ...(item.sourceAssessment.assessorComment ? [{ id: `TMM-C-${item.id}`, type: "recommendation", text: item.sourceAssessment.assessorComment, indicators: [`${item.process}.${item.code}`], evidenceIds: item.evidenceAnalysis.map(entry => entry.evidenceId), workspaceId: "WS-TMM-FINAL", instanceId: "INS-TMM", creator: "Professional Assessor Team", general: false, presentation: false, created: `${source.assessmentPeriod}-30T00:00:00.000Z`, status: "Final", closureState: "不适用", attachments: [] }] : [])
    ]);
    const processResults = source.processes.map(process => ({ id: process.id, title: process.title, achievedLevel: process.achievedLevel, attributeRatings: deepCopy(process.attributeRatings), pa11Score: process.pa11Score, ratedPractices: process.practices.length, weaknessCount: process.practices.filter(item => item.weakness).length, assessorCommentCount: process.practices.filter(item => item.assessorComment).length }));
    const achieved = Math.min(...processResults.map(item => Number(item.achievedLevel || 0)));
    const project = {
      ...deepCopy(source.project), date: `${source.assessmentPeriod}-30T00:00:00.000Z`, status: "complete", progress: 100,
      achievedLevel: `Level ${achieved}`, assessmentState: "Closed", reportNo: `AF-${source.importId}`,
      processes, evidence, assessments, records, runs: [{ id: source.reportVersion || "Ver01", version: 1, date: `${source.assessmentPeriod}-30T00:00:00.000Z`, summary: `Imported consolidated professional assessor report ${source.sourceFile}`, status: "当前版本", assessments: deepCopy(assessments) }],
      participants: [{ id: "P-TMM-LA", name: "Professional Assessor Team", short: "PAT", role: "Lead Assessor", email: "" }],
      workspaces: [{ id: "WS-TMM-FINAL", name: "Imported Consolidated / 已定稿", description: "Consolidated professional assessor report", final: true }],
      instances: [{ id: "INS-TMM", name: source.project.product, short: "TMM", processes: [...processes] }],
      attributes: { assessmentClass: "Internal Assessment", purpose: "Process Improvement", independence: "Not stated in source workbook", processContext: "TMM project internal ASPICE assessment", asil: "Not stated", disciplines: ["System", "Software", "Support", "Management"], distributed: "Not stated", supplyChain: "Not stated", standards: ["Automotive SPICE 3.1"] },
      sessions: [], notepads: [], guidelines: [], traceLinks: [], activeWorkspaceId: "WS-TMM-FINAL", activeInstanceId: "INS-TMM",
      logs: [{ id: id("log"), date: importedAt, action: "Import", user: "AuditFlow", comment: `Imported ${source.sourceFile}: ${source.importStats.assessedProcesses} processes, ${source.importStats.ratedPractices} rated practices, ${source.importStats.weaknessEntries} weaknesses and ${source.importStats.assessorComments} professional comments.` }],
      importSource: { schemaVersion: source.schemaVersion, importId: source.importId, sourceFile: source.sourceFile, sourcePath: source.sourcePath, sourceType: source.sourceType, reportVersion: source.reportVersion, assessmentPeriod: source.assessmentPeriod, importedAt, stats: deepCopy(source.importStats), notes: deepCopy(source.notes || []) },
      processResults, workflowModelVersion: 9, qualityModelVersion: 9,
      aiOpinion: `TMM 评估活动和报告导入已完成。15 个过程的 PA 1.1 结果中，SWE.4 为 F（87%）、SWE.6 为 F（91%）；MAN.3、SUP.10、SYS.3、SWE.3、SYS.4、SYS.5 为 Level 0。源报告未提供完整 PA 2.1/PA 2.2 评分，因此不能据此宣称能力等级 2。`
    };
    return project;
  }

  function ensureImportedTmmProject(database) {
    const source = window.AUDITFLOW_TMM_ASSESSMENT;
    if (!source || database.standardProjects.some(project => project.importSource?.importId === source.importId || project.id === source.project?.id)) return;
    const project = buildImportedTmmProject(source);
    if (!project) return;
    database.standardProjects.unshift(project);
    database.activity ||= [];
    database.activity.unshift({ icon: "upload", title: "TMM 专业评估报告已导入", detail: `${source.importStats.assessedProcesses} 个过程 · ${source.importStats.ratedPractices} 条实践评分 · 项目实施进度 100%`, date: new Date().toISOString() });
  }

  function buildImportedAssessmentProject(source) {
    if (!source?.project || !Array.isArray(source.processes)) return null;
    const importedAt=new Date().toISOString(),processes=source.processes.map(item=>item.id),prefix=source.project.id.replace(/[^A-Z0-9]/gi,"-");
    const evidence=source.processes.flatMap(process=>process.practices.filter(item=>item.evidence).map((item,index)=>({id:`${prefix}-EV-${process.id.replace(".","-")}-${index+1}`,code:`EV.${process.id}.${String(index+1).padStart(2,"0")}`,name:`${process.id} ${item.practiceId} · Imported assessor evidence`,type:"Imported ASPICE assessor statement",size:new Blob([item.evidence]).size,chars:item.evidence.length,source:source.sourceFile,date:`${source.assessmentPeriod}-28T00:00:00.000Z`,scope:process.id,primaryProcesses:[process.id],content:item.evidence,tables:[],locators:[{locator:item.sourceCell,excerpt:item.evidence.slice(0,420)}],helix:summarizeHelixTables([]),structure:`Excel assessment sheet · ${item.sourceCell}`,parseStatus:"parsed",importSource:{importId:source.importId,sourceFile:source.sourceFile,sheet:process.id,cellRange:item.sourceCell}})));
    const evidenceByPractice=new Map(evidence.map(item=>[`${item.scope}|${item.name.split(" · ")[0].split(" ").at(-1)}`,item]));
    const assessments=source.processes.flatMap(process=>process.practices.map(item=>{const evidenceItem=evidenceByPractice.get(`${process.id}|${item.practiceId}`),isRated=item.rating!=="NR",score=importedRatingScore(item.score,isRated?item.rating:"N"),findings=[...(item.evidence?[{type:"O",text:item.evidence}]:[]),...(item.weakness?[{type:"W",text:item.weakness}]:[]),...(item.assessorComment?[{type:"R",text:item.assessorComment}]:[])];return{id:`${prefix}-ASMT-${process.id.replace(".","-")}-${item.code.replaceAll(".","-")}`,group:`${process.id} · ${item.pa}`,process:process.id,processName:process.title,kind:item.code.startsWith("GP")?"GP":"BP",pa:item.pa,code:item.code,title:item.title||item.practiceId,criterion:item.criterion||"Imported assessor criterion",rating:isRated?item.rating:"N",displayRating:item.rating,aiCandidateRating:isRated?item.rating:"NR",achievementPercent:isRated?score:0,confidence:isRated?90:40,scoreBreakdown:{definition:score||0,implementation:score||0,consistency:score||0,governance:score||0,closure:score||0},evidenceAnalysis:evidenceItem?[{evidenceId:evidenceItem.id,evidenceCode:evidenceItem.code,source:source.sourceFile,locator:item.sourceCell,excerpt:item.evidence.slice(0,420),claim:`Imported assessor evidence for ${item.practiceId}`,dimension:"Imported objective evidence statement",strength:"direct",helixTable:false,originProcess:process.id,targetProcess:process.id,relationType:"direct",relatedProcess:process.id}]:[],crossProcessAnalysis:[],evidenceSufficiency:{status:evidenceItem?"partial":"insufficient",coverage:evidenceItem?65:0,citedCount:evidenceItem?1:0,directCount:evidenceItem?1:0,corroboratingCount:0,coveredTypes:evidenceItem?["Assessor evidence statement"]:[],missingTypes:isRated?[]:["Formal assessor rating confirmation"]},requiredEvidence:[],reason:item.weakness||item.evidence||"Formal rating remains pending review.",findings,refs:[`${source.sourceFile} · ${item.sourceCell}`],interviewQuestions:[],closureEvidence:item.actionItems?[item.actionItems]:item.weakness?["Verify corrective action and closure evidence."]:[],reviewerNote:item.assessorComment||item.actionItems||"Imported for assessor review.",reviewed:false,aiSource:"imported-assessor-working-data",sourceAssessment:{importId:source.importId,sourceFile:source.sourceFile,sheet:process.id,cellRange:item.sourceCell,practiceId:item.practiceId,originalScore:item.score,originalRating:item.rating,evidence:item.evidence,weakness:item.weakness,assessorComment:item.assessorComment,actionItems:item.actionItems}};}));
    const records=assessments.flatMap(item=>[...(item.sourceAssessment.weakness?[{id:`${prefix}-W-${item.id}`,type:"weakness",text:item.sourceAssessment.weakness,indicators:[`${item.process}.${item.code}`],evidenceIds:item.evidenceAnalysis.map(x=>x.evidenceId),workspaceId:`WS-${prefix}-REVIEW`,instanceId:`INS-${prefix}`,creator:"Professional Assessor Team",general:false,presentation:true,created:`${source.assessmentPeriod}-28T00:00:00.000Z`,status:"Draft",closureState:"待处理",attachments:[]}]:[]),...(item.sourceAssessment.assessorComment||item.sourceAssessment.actionItems?[{id:`${prefix}-C-${item.id}`,type:"recommendation",text:[item.sourceAssessment.assessorComment,item.sourceAssessment.actionItems].filter(Boolean).join("\n\n"),indicators:[`${item.process}.${item.code}`],evidenceIds:item.evidenceAnalysis.map(x=>x.evidenceId),workspaceId:`WS-${prefix}-REVIEW`,instanceId:`INS-${prefix}`,creator:"Professional Assessor Team",general:false,presentation:false,created:`${source.assessmentPeriod}-28T00:00:00.000Z`,status:"Draft",closureState:"待复审",attachments:[]}]:[])]);
    const processResults=source.processes.map(process=>({id:process.id,title:process.title,achievedLevel:process.achievedLevel||0,attributeRatings:deepCopy(process.attributeRatings),pa11Score:process.pa11Score,ratedPractices:process.practices.filter(x=>x.rating!=="NR").length,weaknessCount:process.practices.filter(x=>x.weakness).length,assessorCommentCount:process.practices.filter(x=>x.assessorComment||x.actionItems).length}));
    return {...deepCopy(source.project),date:`${source.assessmentPeriod}-28T00:00:00.000Z`,status:"review",statusLabel:"待复审",progress:source.progress,achievedLevel:"Level 0",assessmentState:"Consolidation",reportNo:`AF-${source.importId}`,processes,evidence,assessments,records,runs:[],participants:[{id:`P-${prefix}`,name:"Professional Assessor Team",short:"PAT",role:"Assessor Team",email:""}],workspaces:[{id:`WS-${prefix}-REVIEW`,name:"Imported / 待复审",description:"Imported assessor working data",final:false}],instances:[{id:`INS-${prefix}`,name:source.project.product,short:source.project.organization.slice(0,8),processes:[...processes]}],attributes:{assessmentClass:"Internal Assessment",purpose:"Process Improvement",independence:"Not stated in source workbook",processContext:`${source.project.organization} imported assessment`,asil:"Not stated",disciplines:["System","Software","Support","Management"],distributed:"Not stated",supplyChain:"Not stated",standards:[source.project.pam]},sessions:[],notepads:[],guidelines:[],traceLinks:[],activeWorkspaceId:`WS-${prefix}-REVIEW`,activeInstanceId:`INS-${prefix}`,logs:[{id:id("log"),date:importedAt,action:"Import",user:"AuditFlow",comment:`Imported ${source.sourceFile} for pending assessor review.`}],importSource:{schemaVersion:source.schemaVersion,importId:source.importId,sourceFile:source.sourceFile,sourcePath:source.sourcePath,sourceType:source.sourceType,reportVersion:source.reportVersion,assessmentPeriod:source.assessmentPeriod,importedAt,stats:deepCopy(source.importStats),notes:deepCopy(source.notes||[])},processResults,workflowModelVersion:10,qualityModelVersion:10,aiOpinion:`${source.project.organization} assessment data imported at ${source.progress}% readiness. Status is pending review; unconfirmed NR entries remain unrated.`};
  }

  function ensureExternalAssessmentProjects(database){
    const excluded=["配置与变更管理专项评估","项目管理流程诊断"];database.standardProjects=(database.standardProjects||[]).filter(project=>!excluded.includes(project.name));
    (window.AUDITFLOW_EXTERNAL_ASSESSMENTS||[]).slice().reverse().forEach(source=>{const existing=database.standardProjects.find(project=>project.importSource?.importId===source.importId||project.id===source.project?.id);if(existing){existing.progress=source.progress;existing.status="review";existing.statusLabel="待复审";return;}const project=buildImportedAssessmentProject(source);if(!project)return;database.standardProjects.unshift(project);database.activity||=[];database.activity.unshift({icon:"upload",title:`${source.project.organization} 评估资料已导入`,detail:`${source.importStats.assessedProcesses} 个过程 · ${source.importStats.practiceEntries} 条实践 · 待复审 · ${source.progress}%`,date:new Date().toISOString()});});
  }
  function seedDatabase() {
    const now = Date.now();
    const assessments = buildAssessments(["SYS.3"], 0);
    const participants = [
      { id: "P-LA", name: "Maple Mock", short: "MM", role: "Lead Assessor", email: "assessor@example.com" },
      { id: "P-A1", name: "李星", short: "LX", role: "Assessor", email: "lixing@example.com" },
      { id: "P-DL", name: "陈诺", short: "CN", role: "Data Logger", email: "chennuo@example.com" },
      { id: "P-I1", name: "系统架构团队", short: "SYS", role: "Interviewee Group", email: "" }
    ];
    const baseWorkspaces = [
      { id: "WS-MM", name: "主审核员工作区", description: "主审核员现场记录", final: false },
      { id: "WS-LX", name: "协同审核员工作区", description: "第二审核员独立记录", final: false },
      { id: "WS-FINAL", name: "Consolidated / 已定稿", description: "合并并达成一致的正式记录", final: true }
    ];
    const decorate = (project, index = 0) => {
      if ((project.assessments || []).length && (project.evidence || []).length && !project.assessments.some(a => a.evidenceAnalysis?.length)) {
        project.assessments = buildAssessments(project.processes, index, project.evidence);
        if (project.runs?.[0]) project.runs[0].assessments = deepCopy(project.assessments);
      }
      const instance = { id: `INS-${index + 1}`, name: project.product || "Main Project", short: index ? `I${index + 1}` : "MAIN", processes: [...project.processes] };
      project.participants = deepCopy(participants);
      project.workspaces = deepCopy(baseWorkspaces);
      project.instances = [instance];
      project.attributes = { assessmentClass: "Class 2", purpose: "Process Improvement", independence: "Category B", processContext: "Entire Product / Delivery", asil: "ASIL D", disciplines: ["System", "Software"], distributed: "Yes", supplyChain: "Tier 1", standards: ["ISO 26262:2018"] };
      project.sessions = project.processes.slice(0, 5).map((process, sIndex) => ({ id: id("session"), date: new Date(now + sIndex * 86400000).toISOString(), start: `${String(9 + Math.floor(sIndex / 2)).padStart(2, "0")}:${sIndex % 2 ? "45" : "00"}`, duration: sIndex % 2 ? 60 : 90, type: "Interview", process, instanceId: instance.id, interviewees: ["系统架构团队"] }));
      project.sessions.splice(1, 0, { id: id("session"), date: new Date(now).toISOString(), start: "10:30", duration: 15, type: "Break", process: "", instanceId: instance.id, interviewees: [] });
      project.records = (project.assessments || []).slice(0, 12).map((a, rIndex) => ({
        id: `REC-${String(rIndex + 1).padStart(3, "0")}`, type: RATING_SCORE[a.rating] < 50 ? "weakness" : rIndex % 4 === 0 ? "strength" : "observation",
        text: a.findings[0]?.text || a.reason, indicators: [`${a.process}.${a.code}`], evidenceIds: (project.evidence || []).slice(0, rIndex % 3 ? 1 : 2).map(e => e.id),
        workspaceId: rIndex < 7 ? "WS-MM" : rIndex < 10 ? "WS-LX" : "WS-FINAL", instanceId: instance.id, creator: rIndex < 7 ? "MM" : "LX",
        general: rIndex % 5 === 0, presentation: rIndex % 3 === 0, created: new Date(now - (12 - rIndex) * 3600000).toISOString(), status: rIndex > 9 ? "Final" : "Draft", closureState: project.status==="complete"?(RATING_SCORE[a.rating]<50?"已关闭":"不适用"):RATING_SCORE[a.rating]<50?(rIndex===2?"验证中":"待处理"):"不适用", attachments: []
      }));
      project.notepads = [{ id: "NOTE-1", name: "SYS.3 访谈速记", content: "架构负责人说明接口基线在 Gate 2 后冻结。[SYS.001]\n待确认：动态行为视图是否覆盖降级场景？", evidenceIds: (project.evidence || []).slice(0, 1).map(e => e.id), updated: new Date(now - 2 * 3600000).toISOString() }];
      project.guidelines = (project.assessments || []).slice(0, 10).map((a, gIndex) => ({ id: `GDL-${gIndex + 1}`, indicator: indicatorKey(a), rule: gIndex % 3 === 0 ? "评分与记录一致性：低于 F 的实践应至少具有一个弱项或解释。" : "证据应证明项目级执行，而不只是过程定义。", state: gIndex % 5 === 0 ? "broken" : gIndex % 4 === 0 ? "suspect" : "ok", handled: gIndex < 3, comment: gIndex % 5 === 0 ? "已识别不一致，等待合并阶段确认。" : "" }));
      project.logs = [
        { id: id("log"), date: project.date, action: "Open", user: project.owner, comment: "评估已创建" },
        { id: id("log"), date: new Date(now - 86400000).toISOString(), action: "Comment", user: "Maple Mock", comment: "完成文档预审，访谈重点已同步给评估组。" }
      ];
      project.assessmentState = project.status === "complete" ? "Closed" : "Open";
      project.activeWorkspaceId = "WS-MM";
      project.activeInstanceId = instance.id;
      return project;
    };
    const standardProjects = [
      decorate({ id: "ASP-2026-014", name: "CDD 系统架构过程评估", organization: "VW CARIAD Supplier Team", product: "Central Domain Controller", pam: "Automotive SPICE 4.0", targetLevel: "Level 2", processes: ["SYS.3"], date: new Date(now - 2 * 86400000).toISOString(), status: "review", owner: "Maple Mock", progress: 76, evidence: [
        { id: "EV-SYS-001", code: "SYS.001", name: "CDD_System_Architecture_v3.2.pdf", type: "Design Document", size: 2840000, chars: 86420, source: "本地上传", date: new Date(now - 2 * 86400000).toISOString(), scope: "SYS.3" },
        { id: "EV-SYS-002", code: "SYS.002", name: "SYS3_Traceability_Matrix.xlsx", type: "Traceability", size: 685000, chars: 21638, source: "Helix 导出", date: new Date(now - 86400000).toISOString(), scope: "SYS.3", parseStatus:"metadata-only", helix:{detected:true,tableCount:1,rowCount:128,score:71,groups:["identity","content","state","ownership","trace"],fields:["Requirement ID","Status","Owner","Upstream","Downstream"],missing:["版本与基线","影响与闭环"],linkedRows:91,statusCounts:{open:18,review:12,closed:94,blocked:4,other:0}} }
      ], assessments, runs: [{ id: "RUN-003", version: 3, date: new Date(now - 3600000).toISOString(), status: "当前版本", summary: "补充追溯矩阵后重新评估", assessments: deepCopy(assessments) }, { id: "RUN-002", version: 2, date: new Date(now - 86400000).toISOString(), status: "历史版本", summary: "补充系统架构文档", assessments: buildAssessments(["SYS.3"], 2) }], achievedLevel: "CL1", reportNo: "AF-ASP-2026-014-R3" }, 0),
      decorate({ id: "ASP-2026-013", name: "智能座舱软件流程评估", organization: "Apex Mobility", product: "Infotainment 6.0", pam: "Automotive SPICE 4.0", targetLevel: "Level 2", processes: ["SWE.1", "SWE.2", "SWE.4"], date: new Date(now - 7 * 86400000).toISOString(), status: "complete", owner: "李星", progress: 100, evidence: [{ id: "EV-SWE-001", code: "SWE.001", name: "IVI_evidence_package.zip", type: "Evidence Package", size: 12340000, chars: 192440, source: "本地上传", date: new Date(now - 7 * 86400000).toISOString(), scope: "全部过程" }], assessments: buildAssessments(["SWE.1", "SWE.2", "SWE.4"], 1), runs: [], achievedLevel: "CL2", reportNo: "AF-ASP-2026-013-R1" }, 1),
      decorate({ id: "ASP-2026-012", name: "配置与变更管理专项评估", organization: "Northstar Electronics", product: "BCM Gen4", pam: "Automotive SPICE 4.0", targetLevel: "Level 2", processes: ["SUP.8", "SUP.10"], date: new Date(now - 11 * 86400000).toISOString(), status: "ready", owner: "Maple Mock", progress: 35, evidence: [{ id: "EV-CM-001", code: "CM.001", name: "CM_Plan_and_Baseline_List.xlsx", type: "Configuration Plan", size: 925000, chars: 34200, source: "本地上传", date: new Date(now - 10 * 86400000).toISOString(), scope: "全部过程" }], assessments: [], runs: [], achievedLevel: "—", reportNo: "AF-ASP-2026-012" }, 2),
      decorate({ id: "ASP-2026-011", name: "项目管理流程诊断", organization: "Huaxin Drive", product: "eAxle Controller", pam: "Automotive SPICE 4.0", targetLevel: "Level 3", processes: ["MAN.3"], date: new Date(now - 20 * 86400000).toISOString(), status: "draft", owner: "王澜", progress: 12, evidence: [], assessments: [], runs: [], achievedLevel: "—", reportNo: "AF-ASP-2026-011" }, 3)
    ];
    return {
      version: DB_VERSION,
      settings: { aiEnabled: true, aiMode: "local", baseUrl: "http://127.0.0.1:8787/v1", model: "gpt-5", apiKey: "", language: "zh-CN", retainEvidenceText: true, helixAutoDetect:true, helixMaxRows:60, helixRequireIdentity:true },
      standardProjects,
      customSchemes: [
        { id: "SCHEME-CYBER", name: "网络安全开发过程内审", description: "面向 ISO/SAE 21434 项目开发过程的阶段性自检。", reportTitle: "网络安全过程内部审核报告", categories: ["治理", "风险分析", "产品开发", "持续活动"], updated: new Date(now - 4 * 86400000).toISOString(), questions: [
          { id: id("q"), category: "治理", text: "是否已明确网络安全角色、职责和升级路径？", reference: "ISO/SAE 21434 Clause 5" },
          { id: id("q"), category: "风险分析", text: "TARA 是否覆盖资产、威胁场景、攻击路径与风险处置？", reference: "ISO/SAE 21434 Clause 15" },
          { id: id("q"), category: "产品开发", text: "网络安全需求是否与目标、架构及验证证据双向追溯？", reference: "ISO/SAE 21434 Clause 9–11" },
          { id: id("q"), category: "持续活动", text: "漏洞监控、事件响应和更新机制是否已建立并演练？", reference: "ISO/SAE 21434 Clause 13" }
        ] },
        { id: "SCHEME-RELEASE", name: "软件发布就绪检查", description: "覆盖发布包、质量门禁、已知问题和批准链。", reportTitle: "软件发布就绪评审报告", categories: ["范围", "质量", "配置", "批准"], updated: new Date(now - 9 * 86400000).toISOString(), questions: [
          { id: id("q"), category: "范围", text: "发布范围、目标变体与包含的变更是否明确？", reference: "SPL.2" },
          { id: id("q"), category: "质量", text: "验证完成状态、覆盖和剩余缺陷是否满足门禁？", reference: "SWE.6 / SYS.5" },
          { id: id("q"), category: "配置", text: "发布包是否从获批基线可重复构建并校验完整性？", reference: "SUP.8" }
        ] }
      ],
      customAudits: [{ id: "CUS-2026-006", name: "CDC 网络安全 Gate 3 自检", schemeId: "SCHEME-CYBER", organization: "CDC Program", owner: "Maple Mock", date: new Date(now - 5 * 86400000).toISOString(), status: "review", progress: 75, evidence: [{ id: id("ev"), name: "TARA_Gate3.xlsx", size: 430000, chars: 24200, source: "Helix 导出", date: new Date(now - 5 * 86400000).toISOString(), scope: "风险分析" }], assessments: [], conclusion: "有条件通过" }],
      overlays: [
        { id: "OV-PERSONAL", name: "Maple 的审核提示", scope: "Personal", owner: "Maple Mock", annotations: [{ id: "IA-1", indicators: ["SYS.3.BP2"], text: "抽样需求分配时同时确认责任元素、接口影响与验证影响。" }, { id: "IA-2", indicators: ["GP 2.2.3"], text: "不要把共享盘当前文件等同于受控基线。" }] },
        { id: "OV-PROJECT", name: "组织 ASPICE Level 2 方法库", scope: "Project", owner: "Assessment Method Group", annotations: [{ id: "IA-3", indicators: ["SYS.3.BP4"], text: "询问异常、降级和模式切换的动态行为。" }] }
      ],
      recordTemplates: [
        { id: "RT-1", name: "追溯弱项标准表述", type: "weakness", overlayId: "OV-PROJECT", indicators: ["SYS.3.BP2"], evidenceType:"Traceability Matrix", usageCount:18, text: "[Traceability Matrix] 未系统证明需求到架构元素的双向追溯，可能导致变更影响遗漏。关闭需提供受控矩阵、语义抽样和评审记录。" },
        { id: "RT-2", name: "配置基线优势", type: "strength", overlayId: "OV-PERSONAL", indicators: ["GP 2.2.3"], evidenceType:"Configuration Status", usageCount:11, text: "项目使用自动化基线清单和完整性校验，抽样版本可从发布包反向重现。" },
        { id: "RT-3", name: "问题到变更闭环缺口", type: "weakness", overlayId: "OV-PROJECT", indicators: ["SUP.9.BP5","SUP.10.BP4"], evidenceType:"Problem / Change Export", usageCount:9, text:"[Problem Report] 与 [Change Request] 未形成双向关系，修复验证和受影响工作产品状态无法共同证明关闭有效。关闭需补充问题—变更—配置项—验证结果的完整链路及授权关闭记录。" }
      ],
      mapSets: [{ id: "MAP-ASPICE-SAFETY", name: "ASPICE ↔ Functional Safety", type: "Indicator Overlay", visible: true, maps: 24 }, { id: "MAP-EVIDENCE", name: "工作产品证据建议", type: "Evidence Suggestion", visible: true, maps: 61 }],
      auditModels: [
        {id:"MODEL-ASPICE-4",name:"Automotive SPICE 4.0 PAM",family:"Reference Model",version:"4.0",nodes:195,mapped:195,profile:"ASPICE N/P/L/F",status:"Published",updated:"2026-07-20"},
        {id:"MODEL-AUDIT-L2",name:"组织 Level 2 内审核查模型",family:"Evaluation Model",version:"2.3",nodes:132,mapped:126,profile:"Internal CL2",status:"Draft",updated:"2026-07-26"},
        {id:"MODEL-WP",name:"工作产品与角色参考模型",family:"Reference Model",version:"1.8",nodes:86,mapped:61,profile:"Reference only",status:"Published",updated:"2026-07-18"}
      ],
      reportTemplates: [{ id: "RPT-DETAIL", name: "详细评估报告", type: "Word", assignment: "Global", active: true }, { id: "RPT-MGMT", name: "管理层汇报", type: "PowerPoint", assignment: "Assessment Method Group", active: true }, { id: "RPT-RECORDS", name: "审核记录与改进计划", type: "Excel", assignment: "Global", active: true }],
      activity: [
        { icon: "sparkles", title: "CDD 系统架构评估完成第 3 次 AI 初评", detail: "18 个 BP/GP · 12 条评估师记录待合并", date: new Date(now - 3600000).toISOString() },
        { icon: "upload", title: "新增 2 份 SYS.3 证据", detail: "来自 Helix 导出与本地上传", date: new Date(now - 5 * 3600000).toISOString() },
        { icon: "users", title: "SYS.3 访谈日程已更新", detail: "2 名审核员 · 1 个访谈组 · 3 个评估工作区", date: new Date(now - 86400000).toISOString() }
      ]
    };
  }

  function migrateDatabase(stored) {
    if (!stored || !Array.isArray(stored.standardProjects)) return null;
    if ((stored.version || 0) < 5) {
      stored.standardProjects.forEach(project => {
        if (!(project.assessments || []).length) return;
        const previous = project.assessments;
        const fresh = buildAssessments(project.processes || [], project.runs?.length || 0, project.evidence || []);
        fresh.forEach(item => {
          const old = previous.find(candidate => canonicalCode(candidate.code) === item.code && (candidate.process === item.process || candidate.process === "GP"));
          if (!old) return;
          if (old.reviewed) {
            item.rating = old.rating;
            item.achievementPercent = RATING_SCORE[old.rating];
            item.reviewed = true;
            item.reviewerNote = old.reviewerNote && old.reviewerNote !== "从旧版本保留的人工结论" ? old.reviewerNote : `历史人工复核意见：${old.reason || "沿用旧版本人工评分"}`;
          }
        });
        project.assessments = fresh;
        project.runs ||= [];
        project.logs ||= [];
        project.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Import",user:"AuditFlow",comment:"数据模型升级：GP 按过程分别评估；旧人工评分保留，AI 理由按可定位证据重新生成。"});
      });
      stored.version = 5;
    }
    if ((stored.version || 0) < 6) {
      stored.standardProjects.forEach(project=>{
        (project.evidence||[]).forEach(item=>{item.primaryProcesses=inferEvidencePrimaryProcesses(item,project.processes||[]);});
        if((project.assessments||[]).length){
          const previous=project.assessments;
          const fresh=buildAssessments(project.processes||[],project.runs?.length||0,project.evidence||[]);
          fresh.forEach(item=>{
            const old=previous.find(candidate=>candidate.process===item.process&&canonicalCode(candidate.code)===item.code);
            if(!old)return;
            if(old.reviewed){item.rating=old.rating;item.achievementPercent=RATING_SCORE[old.rating];item.reviewed=true;item.reviewerNote=old.reviewerNote||"跨过程分析升级前的人工复核结论";item.reason=`${item.reason} 人工最终评分沿用上一版本，建议复核新增跨过程观察。`;}
          });
          project.assessments=fresh;
          if(project.runs?.[0])project.runs[0].assessments=deepCopy(fresh);
        }
        project.logs||=[];project.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Import",user:"AuditFlow",comment:"分析模型升级：按合格输入输出、约定与汇总、分解与控制、追溯一致性四遍扫描，并关联上下游及 MAN.3/SUP.1/SUP.8～10。"});
      });
      stored.version=6;
    }
    if ((stored.version || 0) < 7) {
      stored.settings ||= {};
      ["feishuEnabled","feishuAppId","feishuSecret","feishuUserKey","jiraEnabled","jiraUrl","jiraProject"].forEach(key=>delete stored.settings[key]);
      stored.settings.helixAutoDetect ??= true;
      stored.settings.helixMaxRows ??= 60;
      stored.settings.helixRequireIdentity ??= true;
      [...(stored.standardProjects||[]),...(stored.customAudits||[])].forEach(project=>{
        (project.evidence||[]).forEach(item=>{
          if(/飞书|jira/i.test(String(item.source||"")))item.source="历史导入快照";
          item.parseStatus ||= String(item.content||"").trim()?"parsed":"metadata-only";
          item.tables ||= [];
          item.locators ||= [];
          item.helix ||= summarizeHelixTables(item.tables);
        });
        (project.records||[]).forEach(record=>{record.closureState ||= record.type==="weakness"?(project.assessmentState==="Closed"||project.status==="complete"?"已关闭":"待处理"):"不适用";record.attachments=Array.isArray(record.attachments)?record.attachments:[];delete record.jiraKey;});
        project.workflowModelVersion=7;
        project.logs||=[];
        project.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Import",user:"AuditFlow",comment:"审核工作流升级：启用本地 Office/PDF 与 Helix 表格解析、跨文件依赖检查和实时状态看板；移除外部项目/整改平台联动。"});
      });
      stored.version=7;
    }
    if ((stored.version || 0) < 8) {
      stored.auditModels ||= [
        {id:"MODEL-ASPICE-4",name:"Automotive SPICE 4.0 PAM",family:"Reference Model",version:"4.0",nodes:195,mapped:195,profile:"ASPICE N/P/L/F",status:"Published",updated:new Date().toISOString().slice(0,10)},
        {id:"MODEL-AUDIT-L2",name:"组织 Level 2 内审核查模型",family:"Evaluation Model",version:"2.3",nodes:132,mapped:126,profile:"Internal CL2",status:"Draft",updated:new Date().toISOString().slice(0,10)},
        {id:"MODEL-WP",name:"工作产品与角色参考模型",family:"Reference Model",version:"1.8",nodes:86,mapped:61,profile:"Reference only",status:"Published",updated:new Date().toISOString().slice(0,10)}
      ];
      (stored.recordTemplates||[]).forEach((template,index)=>{template.evidenceType ||= "Work Product";template.usageCount ??= Math.max(1,12-index*3);});
      (stored.standardProjects||[]).forEach(project=>{project.traceLinks ||= [];project.logs||=[];project.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Import",user:"AuditFlow",comment:"工作台升级：新增指标—证据追溯工作台、模型生命周期、智能 Finding Template 推荐与按按钮触发的 AI 评估意见。"});});
      stored.version=8;
    }
    if ((stored.version || 0) < 9) {
      ensureImportedTmmProject(stored);
      stored.version = 9;
    }
    if ((stored.version || 0) < 10) { ensureExternalAssessmentProjects(stored); stored.version = 10; }
    if ((stored.version || 0) < 11) {
      [...(stored.standardProjects || []), ...(stored.customAudits || [])].forEach(project => (project.records || []).forEach(record => { record.attachments = Array.isArray(record.attachments) ? record.attachments : []; }));
      ensureExternalAssessmentProjects(stored);
      stored.version = 11;
    }
    stored.standardProjects.forEach(project => {
      (project.assessments || []).forEach(item => {
        const statedCandidate = String(item.reason || "").match(/(N|P-|P\+|P|L-|L\+|L|F)\s*候选/);
        item.aiCandidateRating ||= statedCandidate?.[1] || item.rating;
        item.achievementPercent = item.sourceAssessment ? importedRatingScore(item.sourceAssessment.originalScore, item.rating) : (RATING_SCORE[item.rating] || 0);
      });
      if(!project.importSource && project.qualityModelVersion!==6){
        if(project.assessmentState==="Closed"&&!assessmentQuality(project).ready){
          project.assessmentState="Open";project.status="review";project.progress=Math.min(99,project.progress||99);project.logs||=[];project.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Open",user:"AuditFlow",comment:"证据充分性门禁升级后发现未复核或证据缺口，评估已自动重新打开。"});
        }
        project.qualityModelVersion=6;
      }
    });
    stored.settings ||= {};
    stored.auditModels ||= [];
    (stored.recordTemplates||[]).forEach((template,index)=>{template.evidenceType ||= "Work Product";template.usageCount ??= Math.max(1,12-index*3);});
    ["feishuEnabled","feishuAppId","feishuSecret","feishuUserKey","jiraEnabled","jiraUrl","jiraProject"].forEach(key=>delete stored.settings[key]);
    [...(stored.standardProjects||[]),...(stored.customAudits||[])].forEach(project=>{
      (project.evidence||[]).forEach(item=>{if(/飞书|jira/i.test(String(item.source||"")))item.source="历史导入快照";});
      (project.records||[]).forEach(record=>{record.closureState ||= record.type==="weakness"?(project.assessmentState==="Closed"||project.status==="complete"?"已关闭":"待处理"):"不适用";record.attachments=Array.isArray(record.attachments)?record.attachments:[];delete record.jiraKey;});
      if(project.processes)project.traceLinks ||= [];
    });
    (stored.activity||[]).forEach(item=>{item.detail=String(item.detail||"").replaceAll("飞书项目视图","历史导入快照").replaceAll("Jira","本地整改");item.title=String(item.title||"").replaceAll("Jira","本地整改");});
    ensureExternalAssessmentProjects(stored);
    return stored;
  }

  function loadDatabase() {
    try {
      const stored = JSON.parse(localStorage.getItem(DB_KEY));
      const migrated = migrateDatabase(stored);
      if (migrated && migrated.version === DB_VERSION) {
        localStorage.setItem(DB_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (error) { console.warn("Workspace load failed", error); }
    const seeded = seedDatabase();
    ensureImportedTmmProject(seeded);
    ensureExternalAssessmentProjects(seeded);
    seeded.version = DB_VERSION;
    try { localStorage.setItem(DB_KEY, JSON.stringify(seeded)); } catch (error) { console.warn(error); }
    return seeded;
  }

  let db = loadDatabase();
  const ui = { projectTab: "conduct", customTab: "audits", libraryTab: "processes", settingsTab: "ai", conductView: "grid", activeProcess: "", activeIndicator: "", recordFilter: "all", evidenceTarget: null, assessmentJob: null, pendingRecordId: "" };
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const drawerRoot = document.getElementById("drawerRoot");

  function injectIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach(node => { node.innerHTML = icon(node.dataset.icon); });
  }

  function toast(title, message = "", type = "success") {
    const root = document.getElementById("toastRoot");
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<span>${icon(type === "success" ? "check" : type === "warn" ? "alert" : "info")}</span><div><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ""}</div>`;
    root.appendChild(node);
    setTimeout(() => node.remove(), 4300);
  }

  function setAIStatus(busy, label) {
    const node = document.getElementById("aiStatus");
    node.classList.toggle("busy", !!busy);
    node.innerHTML = `<i></i>${esc(label || (busy ? "AI 分析中" : "AI 就绪"))}`;
  }

  function openModal({ title, body, footer = "", wide = false }) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-stop-close><header class="modal-head"><h2>${esc(title)}</h2><button class="close-btn" data-action="close-modal" aria-label="关闭">${icon("close")}</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ""}</section></div>`;
    modalRoot.querySelector("input,select,textarea,button")?.focus();
  }
  function closeModal() { modalRoot.innerHTML = ""; }
  function openDrawer({ title, body, footer = "" }) {
    drawerRoot.innerHTML = `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-stop-close><header class="modal-head"><h2>${esc(title)}</h2><button class="close-btn" data-action="close-drawer">${icon("close")}</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ""}</aside></div>`;
  }
  function closeDrawer() { drawerRoot.innerHTML = ""; }

  function renderPageHead(overline, title, description, actions = "") {
    return `<div class="page-head"><div><span class="overline">${esc(overline)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
  }
  function badge(status, text) { return `<span class="badge ${STATUS_CLASS[status] || status || "neutral"}">${esc(text || STATUS_LABEL[status] || status)}</span>`; }
  function statCard(label, value, detail, iconName, tone = "teal") {
    const tones = { teal: ["#e5f6f3", "#0b8f86"], blue: ["#eaf1ff", "#2e6fdd"], amber: ["#fff4df", "#b76a09"], purple: ["#f0edfb", "#7357c8"] };
    const t = tones[tone] || tones.teal;
    return `<article class="stat-card" style="--tone:${t[0]};--tone-ink:${t[1]}"><div class="stat-top"><span>${esc(label)}</span><span class="stat-icon">${icon(iconName)}</span></div><strong>${esc(value)}</strong><p>${detail}</p></article>`;
  }
  function evidenceCount() { return [...db.standardProjects, ...db.customAudits].reduce((sum, p) => sum + (p.evidence || []).length, 0); }
  function evidenceTableCount() { return [...db.standardProjects, ...db.customAudits].reduce((sum,p)=>sum+(p.evidence||[]).reduce((inner,e)=>inner+(e.tables||[]).length,0),0); }
  function helixDashboardSummary() {
    const evidence=[...db.standardProjects,...db.customAudits].flatMap(project=>project.evidence||[]).filter(item=>item.helix?.detected);
    const statuses={open:0,review:0,closed:0,blocked:0,other:0};
    evidence.forEach(item=>Object.keys(statuses).forEach(key=>statuses[key]+=Number(item.helix.statusCounts?.[key]||0)));
    return {files:evidence.length,tables:evidence.reduce((sum,item)=>sum+Number(item.helix.tableCount||0),0),rows:evidence.reduce((sum,item)=>sum+Number(item.helix.rowCount||0),0),linkedRows:evidence.reduce((sum,item)=>sum+Number(item.helix.linkedRows||0),0),statuses};
  }
  function auditRealtimeState(project) {
    const evidence=project.evidence||[];const assessments=project.assessments||[];const records=project.records||[];
    const parsed=evidence.filter(item=>item.parseStatus==="parsed"||String(item.content||"").trim()).length;
    const reviewed=assessments.filter(item=>item.reviewed).length;
    const weak=assessments.filter(item=>RATING_SCORE[item.rating]<50).length;
    const openWeakness=records.filter(item=>item.type==="weakness"&&!['已关闭','Closed'].includes(item.closureState)).length;
    const quality=project.processes?assessmentQuality(project):{insufficient:0,partial:0,unreviewed:0,ready:false};
    let stage=0,label="待上传证据";
    if(evidence.length){stage=1;label="本地解析";}
    if(parsed){stage=2;label="过程映射";}
    if(assessments.length){stage=3;label="AI 复核";}
    if(assessments.length&&evidence.length>1){stage=4;label="依赖/闭环";}
    if(assessments.length&&reviewed===assessments.length){stage=5;label="评估师确认";}
    if(project.assessmentState==="Closed"||project.status==="complete"){stage=6;label="已关闭";}
    const blockers=quality.insufficient+quality.partial+quality.unreviewed+openWeakness;
    const progress=stage===6?100:Math.max(Number(project.progress||0),Math.round(stage/6*100));
    return {stage,label,evidence:evidence.length,parsed,assessments:assessments.length,reviewed,weak,openWeakness,blockers,progress,quality};
  }
  function nextProjectId(prefix, list) { const year = new Date().getFullYear(); const max = list.reduce((m, item) => Math.max(m, Number((item.id.match(/(\d+)$/) || [0, 0])[1])), 0); return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`; }
  function ratingOptions(current) { return RATING_ORDER.map(r => `<option ${r === current ? "selected" : ""}>${r}</option>`).join(""); }
  function fileType(name) { const ext = (name.split(".").pop() || "FILE").toUpperCase(); return ext.slice(0, 4); }
  function nextEvidenceCode(project) { const used=(project.evidence||[]).map(e=>Number((String(e.code||"").match(/(\d+)$/)||[])[1])||0);return `EV.${String(Math.max(0,...used)+1).padStart(3,"0")}`; }
  function nextRecordId(project) { const used=(project.records||[]).map(r=>Number((String(r.id||"").match(/(\d+)$/)||[])[1])||0);return `REC-${String(Math.max(0,...used)+1).padStart(3,"0")}`; }
  function getPractice(processId, code) { return (PRACTICE_LIBRARY[processId] || []).find(p => p[0] === code); }
  function initializeProjectModel(project) {
    project.participants ||= [{id:"P-LA",name:project.owner||"Maple Mock",short:"MM",role:"Lead Assessor",email:""}];
    project.workspaces ||= [{id:"WS-MAIN",name:"主审核员工作区",description:"独立评估记录",final:false},{id:"WS-FINAL",name:"Consolidated / 已定稿",description:"正式记录",final:true}];
    project.instances ||= [{id:"INS-1",name:project.product||"Main Project",short:"MAIN",processes:[...(project.processes||[])]}];
    project.attributes ||= {assessmentClass:"Class 2",purpose:"Process Improvement",independence:"Category B",processContext:"Entire Product / Delivery",asil:"QM",disciplines:["System","Software"],distributed:"No",supplyChain:"Tier 1",standards:[]};
    project.sessions ||= [];
    project.records ||= [];
    project.notepads ||= [];
    project.guidelines ||= [];
    project.traceLinks ||= [];
    project.logs ||= [{id:id("log"),date:project.date||new Date().toISOString(),action:"Open",user:project.owner||"Maple Mock",comment:"评估已创建"}];
    project.assessmentState ||= "Open"; project.activeWorkspaceId ||= project.workspaces[0].id; project.activeInstanceId ||= project.instances[0].id;
    return project;
  }

  function renderDashboard() {
    const projects=[...db.standardProjects];const states=projects.map(project=>({project,state:auditRealtimeState(project)}));
    const active = states.filter(({project}) => !["complete", "archived"].includes(project.status)).length;
    const pending = states.reduce((sum,item)=>sum+Math.max(0,item.state.assessments-item.state.reviewed),0);
    const blockers=states.reduce((sum,item)=>sum+item.state.blockers,0);
    const parsedFiles=[...db.standardProjects,...db.customAudits].flatMap(p=>p.evidence||[]).filter(item=>item.parseStatus==="parsed"||String(item.content||"").trim()).length;
    const parseRate=evidenceCount()?Math.round(parsedFiles/evidenceCount()*100):0;
    const helix=helixDashboardSummary();
    const workflowCounts=REVIEW_WORKFLOW.map((step,index)=>states.filter(item=>item.state.stage>=index+1).length);
    app.innerHTML = `<div class="page">
      <section class="hero-banner">
        <div class="hero-copy"><span class="overline">Live Audit Control · Automotive SPICE</span><h1>实时掌握审核状态、证据链和关闭风险</h1><p>按“上传 → 本地解析 → AI 复核 → SUP 闭环 → 依赖分析 → 评估师确认”持续刷新。Helix 表格、BP/GP 候选评分和人工门禁均保留可追溯来源。</p><div class="hero-buttons"><button class="btn primary" data-action="new-standard">${icon("plus")}新建 ASPICE 评估</button><button class="btn secondary" data-action="open-standard">${icon("chart")}进入审核项目</button></div><small class="live-updated"><i></i> 实时数据 · <span data-live-at>${new Date().toLocaleTimeString("zh-CN",{hour12:false})}</span></small></div>
        <div class="orbit"><span class="orbit-core">${icon("sparkles")}</span><i></i><i></i><i></i></div>
      </section>
      <section class="stat-grid">
        ${statCard("进行中的审核", active, `${projects.length} 个 ASPICE 项目持续监控`, "shield")}
        ${statCard("本地解析覆盖", `${parseRate}%`, `${parsedFiles}/${evidenceCount()} 份证据 · ${evidenceTableCount()} 个表格`, "file", "blue")}
        ${statCard("待人工复核", pending, "AI 候选结论等待评估师确认", "users", "amber")}
        ${statCard("当前阻塞项", blockers, "证据不足、未复核与开放弱项", "alert", "purple")}
      </section>
      <section class="panel live-workflow-panel"><header class="panel-head"><div><h2>审核 Workflow 实时漏斗</h2><p>来自介绍材料的六阶段评估工作流；数字表示已到达该阶段的项目</p></div>${badge(blockers?"warn":"success",blockers?`${blockers} 个阻塞`:"无阻塞")}</header><div class="panel-body"><div class="workflow-strip">${REVIEW_WORKFLOW.map((step,index)=>`<article class="workflow-step ${workflowCounts[index]?"active":""}"><span>${index+1}</span><div><strong>${esc(step[1])}</strong><small>${esc(step[2])}</small></div><b>${workflowCounts[index]}</b></article>`).join("")}</div></div></section>
      <section class="panel live-project-panel"><header class="panel-head"><div><h2>当前审核状态</h2><p>证据、AI 复核、人工确认和关闭门禁同步展示</p></div><button class="btn ghost sm" data-action="open-standard">查看全部 ${icon("arrow")}</button></header><div class="live-table-wrap"><table class="data-table live-audit-table"><thead><tr><th>项目</th><th>当前阶段</th><th>证据解析</th><th>AI / 人工</th><th>开放弱项</th><th>阻塞</th><th>实时进度</th><th></th></tr></thead><tbody>${states.map(({project,state})=>`<tr><td><strong>${esc(project.name)}</strong><small>${esc(project.id)} · ${esc(project.organization)}</small></td><td>${badge(state.stage===6?"success":state.stage>=3?"purple":"info",state.label)}</td><td><strong>${state.parsed}/${state.evidence}</strong><small>${(project.evidence||[]).reduce((sum,e)=>sum+(e.tables||[]).length,0)} 个表格</small></td><td><strong>${state.assessments}/${state.reviewed}</strong><small>候选 / 已确认</small></td><td>${state.openWeakness?badge("danger",`${state.openWeakness} 条`):badge("success","0 条")}</td><td>${state.blockers?badge("warn",state.blockers):badge("success","通过")}</td><td><div class="progress"><div class="progress-label"><span>${state.label}</span><b>${state.progress}%</b></div><div class="progress-bar" style="--value:${state.progress}%"><i></i></div></div></td><td><button class="action-icon" data-action="open-standard-project" data-id="${project.id}">${icon("arrow")}</button></td></tr>`).join("")}</tbody></table></div></section>
      <div class="dashboard-grid dashboard-secondary">
        <section class="panel"><header class="panel-head"><div><h2>Helix 表格证据态势</h2><p>基于标识、状态、责任、基线、追溯与闭环字段自动识别</p></div>${badge(helix.files?"success":"neutral",`${helix.files} 份导出`)}</header><div class="panel-body"><div class="helix-kpi-grid"><article><span>表格</span><strong>${helix.tables}</strong></article><article><span>对象行</span><strong>${helix.rows}</strong></article><article><span>有追溯关系</span><strong>${helix.linkedRows}</strong></article><article><span>阻塞/失败</span><strong>${helix.statuses.blocked}</strong></article></div><div class="helix-status-bars">${[["已关闭",helix.statuses.closed,"success"],["评审/批准",helix.statuses.review,"purple"],["开放",helix.statuses.open,"info"],["阻塞",helix.statuses.blocked,"danger"]].map(([label,value,tone])=>`<div><span>${label}</span><i style="--value:${helix.rows?Math.min(100,Math.round(value/helix.rows*100)):0}%" class="${tone}"><b></b></i><strong>${value}</strong></div>`).join("")}</div></div></section>
        <section class="panel"><header class="panel-head"><div><h2>最近动态</h2><p>审核、证据和人工复核事件</p></div></header><div class="panel-body activity-list">${db.activity.slice(0, 5).map(a => `<article class="activity"><span class="activity-icon">${icon(a.icon)}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div><time>${relativeDate(a.date)}</time></article>`).join("")}</div></section>
      </div>
    </div>`;
  }

  function renderStandardList() {
    app.innerHTML = `<div class="page">
      ${renderPageHead("ASPICE Assessment", "ASPICE 过程评估", "以 Automotive SPICE 4.0 PAM 和专业评估准则为基线，完成范围规划、访谈执行、证据判断、记录合并与报告输出。", `<button class="btn secondary" data-action="open-library">${icon("book")}标准库</button><button class="btn primary" data-action="new-standard">${icon("plus")}新建评估项目</button>`)}
      <section class="stat-grid">
        ${statCard("全部项目", db.standardProjects.length, "当前工作区中的标准审核", "shield")}
        ${statCard("评估进行中", db.standardProjects.filter(p => ["ready", "running", "review"].includes(p.status)).length, "含 AI 初评和人工复核阶段", "sparkles", "blue")}
        ${statCard("本月完成", db.standardProjects.filter(p => p.status === "complete").length, "已具备可导出的报告版本", "check", "purple")}
        ${statCard("证据文件", db.standardProjects.reduce((s, p) => s + p.evidence.length, 0), "PDF、Office、Helix 导出及文本", "file", "amber")}
      </section>
      <section class="panel clean"><div class="table-toolbar"><label class="searchbox">${icon("search")}<input type="search" placeholder="搜索审核项目…" data-table-search="standard"></label><select class="filter-select" data-filter="standard"><option value="all">全部状态</option><option value="review">待复核</option><option value="ready">待评估</option><option value="complete">已完成</option><option value="draft">草稿</option></select><span class="toolbar-spacer"></span><button class="btn secondary sm" data-action="export-project-list">${icon("download")}导出清单</button></div>
        <table class="data-table"><thead><tr><th>项目</th><th>受审组织 / 产品</th><th>范围</th><th>目标</th><th>进度</th><th>状态</th><th>更新时间</th><th></th></tr></thead><tbody id="standardRows">${standardRows(db.standardProjects)}</tbody></table>
      </section>
    </div>`;
  }

  function standardRows(projects) {
    return projects.map(p => `<tr data-status="${p.status}" data-search-text="${esc([p.id, p.name, p.organization, p.product, p.processes.join(" ")].join(" ").toLowerCase())}"><td><div class="table-title"><span>${icon("shield")}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.id)} · ${esc(p.owner)}</small></span></div></td><td><strong style="color:var(--ink)">${esc(p.organization)}</strong><br><small>${esc(p.product)}</small></td><td>${p.processes.map(x => `<span class="code-tag">${esc(x)}</span>`).join(" ")}</td><td>${esc(p.targetLevel)}</td><td><div class="progress"><div class="progress-label"><span>完成度</span><b>${p.progress}%</b></div><div class="progress-bar" style="--value:${p.progress}%"><i></i></div></div></td><td>${badge(p.status)}</td><td>${formatDate(p.date)}</td><td><div class="row-actions"><button class="action-icon" data-action="open-standard-project" data-id="${p.id}" title="打开">${icon("arrow")}</button><button class="action-icon" data-action="duplicate-standard" data-id="${p.id}" title="复制">${icon("copy")}</button></div></td></tr>`).join("") || `<tr><td colspan="8"><div class="empty-state"><div><span>${icon("search")}</span><h2>没有匹配项目</h2></div></div></td></tr>`;
  }

  function projectTabButtons(project) {
    const counts = { plan: project.instances.length, schedule: project.sessions.length, conduct: project.records.length, evidence: project.evidence.length, trace:traceCoverage(project).confirmed||traceCoverage(project).linkCount, consolidate: project.records.filter(r=>r.status!=="Final").length, history: project.runs.length, close: project.logs.length };
    return `<nav class="phase-nav">${ASSESSMENT_PHASES.map(([key,label],index)=>`<button data-action="project-tab" data-tab="${key}" class="${ui.projectTab===key?"active":""}"><span class="phase-index">${index+1}</span><span><strong>${label}</strong><small>${counts[key] || 0}</small></span></button>`).join("")}</nav>`;
  }

  function renderStandardProject(project) {
    if (!project) return renderNotFound();
    initializeProjectModel(project);
    if (project.assessments.length) refreshProjectOutcome(project);
    const draftRecords = project.records.filter(r => r.status !== "Final").length;
    app.innerHTML = `<div class="page">
      ${renderPageHead("ASPICE Assessment · " + project.id, project.name, `${project.organization} · ${project.product}`, `<button class="btn secondary" data-action="back-standard">返回项目</button><button class="btn secondary" data-action="open-notepad" data-id="${project.id}">${icon("edit")}现场笔记</button><button class="btn secondary" data-action="open-report" data-id="${project.id}">${icon("eye")}报告</button><button class="btn secondary" data-action="open-aspice-master" data-project="${project.id}">${icon("flask")}aspice-audit-master</button><button class="btn primary" data-action="run-standard" data-id="${project.id}">${icon("sparkles")}${project.assessments.length ? "AI 重新评估" : "AI 预评估"}</button>`)}
      <section class="project-summary"><article class="project-id-card"><span class="project-id-icon">${icon("shield")}</span><div><h2>${esc(project.id)}</h2><p>${esc(project.pam)} · ${project.assessmentState} · ${formatDate(project.date)}</p><div style="margin-top:9px">${badge(project.status)}</div></div></article><article class="mini-metric"><span>目标 / 当前等级</span><strong>${esc(project.targetLevel)} / ${esc(project.achievedLevel)}</strong><small>按 PA 硬门槛综合判断</small></article><article class="mini-metric"><span>评估师记录</span><strong>${project.records.length}</strong><small>${draftRecords} 条等待合并</small></article><article class="mini-metric"><span>团队 / 实例</span><strong>${project.participants.length} / ${project.instances.length}</strong><small>${project.workspaces.length} 个评估工作区</small></article></section>
      ${importedAssessmentSummary(project)}
      <section class="panel clean">${projectTabButtons(project)}<div class="panel-body" id="projectTabContent">${renderProjectTab(project)}</div></section>
    </div>`;
  }

  function renderProjectTab(project) {
    if (ui.projectTab === "plan") return renderAssessmentPlan(project);
    if (ui.projectTab === "schedule") return renderAssessmentSchedule(project);
    if (ui.projectTab === "conduct") return renderConduct(project);
    if (ui.projectTab === "evidence") return renderEvidenceTab(project, "standard");
    if (ui.projectTab === "trace") return renderTraceStudio(project);
    if (ui.projectTab === "consolidate") return renderConsolidation(project);
    if (ui.projectTab === "history") return renderHistoryTab(project);
    if (ui.projectTab === "close") return renderCloseAndReports(project);
    return renderAssessmentPlan(project);
  }

  function renderAssessmentPlan(project) {
    return `<div class="assessor-plan-grid"><div><section class="setting-section"><div class="section-title-row"><div><h2>评估信息与属性</h2><p>用于评估分类、历史分析、报告和质量门禁。</p></div><button class="btn secondary sm" data-action="edit-assessment-meta" data-id="${project.id}">${icon("edit")}编辑</button></div><div class="attribute-grid">${[["标准",project.pam],["评估目的",project.attributes.purpose],["评估类别",project.attributes.assessmentClass],["独立性",project.attributes.independence],["过程上下文",project.attributes.processContext],["ASIL",project.attributes.asil],["供应链位置",project.attributes.supplyChain],["适用标准",project.attributes.standards.join("、")]].map(x=>`<div><span>${x[0]}</span><strong>${esc(x[1])}</strong></div>`).join("")}</div></section><section class="setting-section"><div class="section-title-row"><div><h2>过程实例与范围</h2><p>同一过程可在不同团队、产品或开发方式下独立评估。</p></div><button class="btn secondary sm" data-action="add-instance" data-id="${project.id}">${icon("plus")}添加实例</button></div>${project.instances.map(ins=>`<article class="scope-instance"><div><span class="instance-mark">${esc(ins.short)}</span><strong>${esc(ins.name)}</strong><small>${ins.processes.length} 个过程</small></div><div>${ins.processes.map(p=>`<span class="code-tag">${p}</span>`).join(" ")}</div></article>`).join("")}</section></div><aside><section class="panel"><header class="panel-head"><div><h2>参与者与角色</h2><p>Lead Assessor、Assessor、Data Logger、Interviewee</p></div><button class="action-icon" data-action="add-participant" data-id="${project.id}">${icon("plus")}</button></header><div class="panel-body assessor-list">${project.participants.map(p=>`<article><span class="avatar">${esc(p.short)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></div>${p.role==="Lead Assessor"?badge("success","负责人"):""}</article>`).join("")}</div></section><section class="panel" style="margin-top:13px"><header class="panel-head"><div><h2>评估工作区</h2><p>独立记录 → 合并 → 正式定稿</p></div><button class="action-icon" data-action="add-workspace" data-id="${project.id}">${icon("plus")}</button></header><div class="panel-body workspace-list">${project.workspaces.map(w=>`<button data-action="set-workspace" data-project="${project.id}" data-id="${w.id}" class="${project.activeWorkspaceId===w.id?"active":""}"><span>${icon(w.final?"check":"layers")}</span><div><strong>${esc(w.name)}</strong><small>${esc(w.description)}</small></div><b>${project.records.filter(r=>r.workspaceId===w.id).length}</b></button>`).join("")}</div></section></aside></div>`;
  }

  function renderAssessmentSchedule(project) {
    return `<div class="section-title-row"><div><h2>访谈与合并日程</h2><p>按过程、实例和访谈对象规划会议，自动计算结束时间。</p></div><div class="page-actions"><button class="btn secondary sm" data-action="add-schedule-break" data-id="${project.id}">插入休息/合并</button><button class="btn primary sm" data-action="add-session" data-id="${project.id}">${icon("plus")}添加访谈</button></div></div><div class="schedule-board">${project.sessions.map((s,index)=>{const endMinutes=Number(s.start.split(":")[0])*60+Number(s.start.split(":")[1])+s.duration;const end=`${String(Math.floor(endMinutes/60)).padStart(2,"0")}:${String(endMinutes%60).padStart(2,"0")}`;return `<article class="schedule-row ${s.type!=="Interview"?"special":""}"><span class="drag-handle">⋮⋮</span><div class="schedule-time"><strong>${esc(s.start)}</strong><small>${end}</small></div><div class="schedule-line"><i></i></div><div><strong>${s.type==="Interview"?esc(s.process+" 访谈"):esc(s.type)}</strong><p>${s.type==="Interview"?`${esc(project.instances.find(x=>x.id===s.instanceId)?.name||"")} · ${esc(s.interviewees.join("、"))}`:`${s.duration} 分钟`}</p></div><span class="badge ${s.type==="Interview"?"info":"neutral"}">${s.duration} min</span><div class="row-actions"><button class="action-icon" data-action="move-session-up" data-project="${project.id}" data-id="${s.id}" ${index===0?"disabled":""}>↑</button><button class="action-icon" data-action="delete-session" data-project="${project.id}" data-id="${s.id}">${icon("trash")}</button></div></article>`}).join("")}</div>`;
  }

  function indicatorKey(a) { return a.process === "CUSTOM" ? a.code : `${a.process}.${canonicalCode(a.code)}`; }
  function recordBadge(record) { const type=RECORD_TYPES[record.type]||RECORD_TYPES.comment; return `<button class="record-chip ${record.type}" data-action="open-record" data-project="${record.projectId||""}" data-id="${record.id}" title="${esc(record.text)}"><b>${type.code}</b>${esc(record.id.replace("REC-",""))}</button>`; }

  function renderAssessmentReadiness(project) {
    const quality = assessmentQuality(project);
    return `<section class="assessment-readiness ${quality.ready ? "ready" : "attention"}"><div class="readiness-title"><span>${icon(quality.ready ? "check" : "alert")}</span><div><strong>${quality.ready ? "逐项证据链已满足报告门槛" : "逐项证据链仍需补强与复核"}</strong><p>报告结论必须能从 BP/GP 反向定位到直接证据、跨过程佐证、AI 理由和人工确认。</p></div></div><div class="readiness-metrics"><div><span>直接证据覆盖</span><strong>${quality.coverage}%</strong></div><div><span>引用片段</span><strong>${quality.cited}</strong></div><div><span>证据不足/部分</span><strong>${quality.insufficient + quality.partial}</strong></div><div><span>关联过程待补</span><strong>${quality.relatedGaps||0}</strong></div><div><span>待人工复核</span><strong>${quality.unreviewed}</strong></div></div></section>`;
  }
  function scoreBreakdownMarkup(a) {
    const labels = {definition:"定义",implementation:"项目实施",consistency:"一致性",governance:"受控性",closure:"闭环"};
    return `<div class="score-breakdown">${Object.entries(a.scoreBreakdown || {}).map(([key,value])=>`<div><span>${labels[key]||key}</span><i><b style="width:${clampScore(value)}%"></b></i><strong>${clampScore(value)}</strong></div>`).join("")}</div>`;
  }
  function evidenceChainMarkup(a) {
    const items = a.evidenceAnalysis || [];
    if (!items.length) return `<div class="evidence-gap"><strong>没有可引用的客观证据</strong><p>当前评分受证据护栏限制为 N。请补充文件、原文定位或访谈后取得的受控记录。</p></div>`;
    return `<div class="evidence-chain">${items.map(item=>`<article><header><span class="code-tag">${esc(item.evidenceCode)}</span>${badge(item.strength==="direct"?"success":item.strength==="corroborating"?"info":"warn",item.strength==="direct"?"直接证据":item.strength==="corroborating"?"跨过程佐证":"仅索引")}</header><strong>${esc(item.source)}</strong><small>${esc(item.locator)} · ${esc(item.dimension)}</small><div class="evidence-relation">${esc(item.originProcess||a.process)} → ${esc(item.targetProcess||a.process)} · ${esc(relationLabel(item.relationType||"direct"))}${item.scopeStatus==="related-only"?" · 关联观察不评级":""}</div><p>${esc(item.excerpt)}</p><footer>${esc(item.claim)}</footer></article>`).join("")}</div>`;
  }

  function renderConduct(project) {
    if (!project.assessments.length) return `<div class="empty-state"><div><span>${icon("sparkles")}</span><h2>先执行 AI 预评估</h2><p>系统会把证据映射到 BP/GP，生成评分候选和需要评估师核实的问题，然后进入 Tree/Grid 现场执行视图。</p><button class="btn primary" data-action="run-standard" data-id="${project.id}">${icon("sparkles")}开始 AI 预评估</button></div></div>`;
    project.records.forEach(r=>r.projectId=project.id);
    const availableProcesses=project.processes;const activeProcess=availableProcesses.includes(ui.activeProcess)?ui.activeProcess:(project.processes[0]||""); ui.activeProcess=activeProcess;
    const items=project.assessments.filter(a=>a.process===activeProcess);
    const activeAssessment=items.find(a=>indicatorKey(a)===ui.activeIndicator)||items[0]||project.assessments[0]; ui.activeIndicator=activeAssessment?indicatorKey(activeAssessment):"";
    const filteredRecords=project.records.filter(r=>ui.recordFilter==="all"||r.type===ui.recordFilter);
    const toolbar=`<div class="conduct-toolbar"><div class="segmented"><button data-action="conduct-view" data-view="tree" class="${ui.conductView==="tree"?"active":""}">${icon("layers")}Tree</button><button data-action="conduct-view" data-view="grid" class="${ui.conductView==="grid"?"active":""}">${icon("grid")}Grid</button></div><select class="filter-select" data-action-select="instance" data-project="${project.id}">${project.instances.map(i=>`<option value="${i.id}" ${i.id===project.activeInstanceId?"selected":""}>实例：${esc(i.name)}</option>`).join("")}</select><select class="filter-select" data-action-select="workspace" data-project="${project.id}">${project.workspaces.map(w=>`<option value="${w.id}" ${w.id===project.activeWorkspaceId?"selected":""}>工作区：${esc(w.name)}</option>`).join("")}</select><select class="filter-select" data-record-filter>${`<option value="all">全部记录类型</option>`+Object.entries(RECORD_TYPES).map(([k,v])=>`<option value="${k}" ${ui.recordFilter===k?"selected":""}>${v.code} · ${v.label}</option>`).join("")}</select><span class="toolbar-spacer"></span><button class="btn secondary sm" data-action="open-guidelines" data-id="${project.id}">${icon("alert")}Guideline ${project.guidelines.filter(g=>g.state!=="ok").length}</button><button class="btn secondary sm" data-action="open-notepad" data-id="${project.id}">${icon("edit")}Notepad</button><button class="btn primary sm" data-action="new-record" data-project="${project.id}" data-indicator="${esc(ui.activeIndicator)}">${icon("plus")}创建记录</button></div>`;
    if(ui.conductView==="tree") return `${renderAssessmentReadiness(project)}${toolbar}<div class="tree-assessment-layout"><aside class="pam-tree">${project.processes.map(p=>`<section><button data-action="select-process" data-process="${p}" class="${activeProcess===p?"active":""}"><span>${p}</span><strong>${PROCESS_CATALOG.find(x=>x.id===p)?.zh||p}</strong><b>CL${processCapability(project,p)}</b></button>${activeProcess===p?items.map(a=>`<button class="tree-indicator ${ui.activeIndicator===indicatorKey(a)?"active":""}" data-action="select-indicator" data-id="${esc(indicatorKey(a))}"><span>${esc(a.code)}</span><strong>${esc(a.title)}</strong><b>${a.rating}</b></button>`).join(""):""}</section>`).join("")}</aside><main class="indicator-workbench">${renderIndicatorWorkbench(project,activeAssessment,filteredRecords)}</main></div>`;
    return `${renderAssessmentReadiness(project)}${toolbar}<div class="grid-assessment-wrap"><div class="process-rail">${project.processes.map(p=>`<button data-action="select-process" data-process="${p}" class="${activeProcess===p?"active":""}"><strong>${p}</strong><small>${PROCESS_CATALOG.find(x=>x.id===p)?.zh||p}</small><span>CL${processCapability(project,p)}</span></button>`).join("")}</div><div class="assessment-grid-table"><div class="assessment-grid-head"><span>指标</span><span>AI 专业判断、证据链与评估师记录</span><span>人工评分</span><span>证据</span><span>操作</span></div>${items.map(a=>{const key=indicatorKey(a);const recs=filteredRecords.filter(r=>r.indicators.includes(key));return `<article class="assessment-grid-row ${ui.activeIndicator===key?"active":""}" data-action="select-indicator" data-id="${esc(key)}"><span class="code-tag">${esc(a.code)}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.reason)}</p><div class="record-strip">${badge(a.kind==="BP"?"info":"purple",a.pa)} ${badge(ratingClass(a.aiCandidateRating||a.rating),`AI ${a.aiCandidateRating||a.rating}`)} ${recs.map(recordBadge).join("")||"<small>暂无评估师记录</small>"}</div></div><select class="rating-select" data-rating-change data-type="standard" data-project="${project.id}" data-id="${a.id}">${ratingOptions(a.rating)}</select><div>${badge(sufficiencyTone(a.evidenceSufficiency?.status),`${a.evidenceSufficiency?.coverage||0}%`)}</div><div class="row-actions"><button class="action-icon" data-action="new-record" data-project="${project.id}" data-indicator="${esc(key)}">${icon("plus")}</button><button class="action-icon" data-action="review-assessment" data-type="standard" data-project="${project.id}" data-id="${a.id}">${icon("eye")}</button></div></article>`}).join("")}</div></div>`;
  }

  function renderIndicatorWorkbench(project,a,records) {
    if(!a)return "";const key=indicatorKey(a);const related=records.filter(r=>r.indicators.includes(key));const guidelines=project.guidelines.filter(g=>g.indicator===key);const annotations=db.overlays.flatMap(o=>o.annotations.map(x=>({...x,overlay:o.name}))).filter(x=>x.indicators.includes(key));
    return `<header class="workbench-head"><div><div class="indicator-kicker"><span class="overline">${esc(key)}</span>${badge(a.kind==="BP"?"info":"purple",a.pa)}${badge(sufficiencyTone(a.evidenceSufficiency?.status),sufficiencyLabel(a.evidenceSufficiency?.status))}${badge(ratingClass(a.aiCandidateRating||a.rating),`AI 候选 ${a.aiCandidateRating||a.rating}`)}</div><h2>${esc(a.title)}</h2><p>${esc(a.criterion)}</p></div><select class="rating-select" data-rating-change data-type="standard" data-project="${project.id}" data-id="${a.id}">${ratingOptions(a.rating)}</select></header><div class="professional-assessment"><section><div class="section-title-row"><div><h3>AI 专业评分意见</h3><p>五维评分、证据护栏与可复核结论；人工评分为 ${a.rating}</p></div><button class="btn secondary sm" data-action="review-assessment" data-type="standard" data-project="${project.id}" data-id="${a.id}">${icon("check")}${a.reviewed?"重新核对":"人工核对"}</button></div><p class="professional-reason">${esc(a.reason)}</p>${scoreBreakdownMarkup(a)}<div class="section-title-row evidence-title"><div><h3>Evidence chain / 证据链</h3><p>${a.evidenceSufficiency?.citedCount||0} 条引用 · 直接证据覆盖 ${a.evidenceSufficiency?.coverage||0}%</p></div></div>${evidenceChainMarkup(a)}<div class="section-title-row evidence-title"><div><h3>Cross-process analysis / 跨过程分析</h3><p>按合格输入输出、约定与汇总、分解与控制、追溯一致性四遍扫描；范围外过程只形成观察。</p></div></div>${crossProcessMarkup(project,a.process,true)}<div class="assessor-prompts"><article><strong>建议访谈问题</strong><ul>${(a.interviewQuestions||[]).map(q=>`<li>${esc(q)}</li>`).join("")}</ul></article><article><strong>最小关闭证据</strong><ul>${(a.closureEvidence||[]).map(q=>`<li>${esc(q)}</li>`).join("")}</ul></article></div></section><aside><div class="review-block"><h3>O / W / R 发现</h3>${(a.findings||[]).map(f=>`<p><strong>${f.type}</strong> ${esc(f.text)}</p>`).join("")}</div><div class="review-block"><h3>评估师记录</h3>${related.map(r=>renderRecordCard(project,r)).join("")||`<div class="empty-mini">当前指标还没有评估师记录。</div>`}<button class="btn primary sm" data-action="new-record" data-project="${project.id}" data-indicator="${esc(key)}">${icon("plus")}新建记录</button></div><div class="review-block"><h3>Rating Guidelines / TAA</h3>${guidelines.map(g=>`<p>${badge(g.state==="broken"?"danger":g.state==="suspect"?"warn":"success",g.state)} ${esc(g.rule)}${g.comment?`<br><small>${esc(g.comment)}</small>`:""}</p>`).join("")||"<p>没有关联规则。</p>"}</div><div class="review-block"><h3>Indicator Annotation</h3>${annotations.map(x=>`<p><strong>${esc(x.overlay)}</strong><br>${esc(x.text)}</p>`).join("")||"<p>当前没有启用的评估提示。</p>"}</div></aside></div>`;
  }

  function renderRecordCard(project,record) { const t=RECORD_TYPES[record.type]||RECORD_TYPES.comment;return `<article class="assessor-record ${record.type}"><header><span class="record-type-mark">${t.code}</span><div><strong>${t.label} · ${esc(record.id)}</strong><small>${esc(record.creator)} · ${formatDate(record.created)} · ${esc(project.workspaces.find(w=>w.id===record.workspaceId)?.name||"")}</small></div><div class="row-actions">${record.type==="weakness"?badge(record.closureState==="已关闭"?"success":"warn",record.closureState||"待处理"):""}${record.presentation?badge("purple","Presentation"):""}<button class="action-icon" data-action="open-record" data-project="${project.id}" data-id="${record.id}">${icon("edit")}</button></div></header><p>${esc(record.text)}</p><footer><span>${record.indicators.map(x=>`<span class="code-tag">${esc(x)}</span>`).join(" ")}</span><span>${record.evidenceIds.map(eid=>`[${esc(project.evidence.find(e=>e.id===eid)?.code||eid)}]`).join(" ")}</span></footer></article>`; }

  function renderConsolidation(project) {
    const drafts=project.records.filter(r=>r.status!=="Final");const finals=project.records.filter(r=>r.status==="Final");
    return `<div class="section-title-row"><div><h2>记录合并与一致性确认</h2><p>比较各评估师工作区的独立记录，将达成一致的内容移入 Consolidated 工作区。</p></div><button class="btn primary sm" data-action="consolidate-all" data-id="${project.id}">${icon("check")}合并全部已确认记录</button></div><div class="workspace-summary-grid">${project.workspaces.map(w=>`<article class="workspace-summary ${w.final?"final":""}"><span>${icon(w.final?"check":"layers")}</span><div><strong>${esc(w.name)}</strong><p>${project.records.filter(r=>r.workspaceId===w.id).length} 条记录</p></div></article>`).join("")}</div><div class="consolidation-layout"><section><h3>等待合并 · ${drafts.length}</h3>${drafts.map(r=>`<article class="merge-record">${renderRecordCard(project,r)}<button class="btn secondary sm" data-action="move-record-final" data-project="${project.id}" data-id="${r.id}">${icon("arrow")}移入定稿</button></article>`).join("")||`<div class="empty-mini">没有等待合并的记录。</div>`}</section><section><h3>已定稿 · ${finals.length}</h3>${finals.map(r=>renderRecordCard(project,r)).join("")||`<div class="empty-mini">尚未产生正式记录。</div>`}</section></div>`;
  }

  function renderCloseAndReports(project) {
    const broken=project.guidelines.filter(g=>g.state==="broken"&&!g.handled).length;const drafts=project.records.filter(r=>r.status!=="Final").length;const openWeakness=project.records.filter(r=>r.type==="weakness"&&r.closureState!=="已关闭").length;const quality=assessmentQuality(project);const gatePass=!broken&&!drafts&&!openWeakness&&quality.ready;
    const weaknesses=project.records.filter(r=>r.type==="weakness");const closedWeaknesses=weaknesses.filter(r=>r.closureState==="已关闭").length;
    return `<div class="close-layout"><div><section class="quality-gate ${gatePass?"pass":"block"}"><span>${icon(gatePass?"check":"alert")}</span><div><strong>${gatePass?"质量门禁通过，可关闭评估":"关闭前仍有证据、复核或整改阻塞项"}</strong><p>${drafts} 条记录未定稿 · ${openWeakness} 条弱项未关闭 · ${broken} 条 Guideline 未处理 · ${quality.unreviewed} 项未复核 · ${quality.insufficient} 项证据不足 · ${quality.partial} 项证据部分充分</p></div>${project.assessmentState==="Closed"?`<button class="btn secondary" data-action="reopen-assessment" data-id="${project.id}">重新打开</button>`:`<button class="btn primary" data-action="close-assessment" data-id="${project.id}" ${gatePass?"":"disabled"}>关闭评估</button>`}</section>${renderAssessmentReadiness(project)}<section class="setting-section"><div class="section-title-row"><div><h2>不可修改的评估日志</h2><p>Open、Close、Import 和评估师 Comment 形成追踪记录。</p></div><button class="btn secondary sm" data-action="add-log-comment" data-id="${project.id}">${icon("plus")}添加评论</button></div><table class="data-table"><thead><tr><th>时间</th><th>动作</th><th>用户</th><th>内容</th></tr></thead><tbody>${project.logs.map(l=>`<tr><td>${formatDate(l.date)}</td><td>${badge(l.action==="Close"?"success":l.action==="Open"?"info":"neutral",l.action)}</td><td>${esc(l.user)}</td><td>${esc(l.comment)}</td></tr>`).join("")}</tbody></table></section></div><aside><section class="panel"><header class="panel-head"><div><h2>报告与汇报材料</h2><p>报告预览始终可用；未过门禁时自动标记 Draft</p></div></header><div class="panel-body report-option-list">${[["详细评估报告","Word","官方结构、逐项评分与证据链"],["管理层汇报","PowerPoint","风险、图表与关键发现"],["记录清单","Excel","筛选、透视和改进跟踪"],["评估计划与邀请","Word","范围、日程、参与者、证据清单"]].map((r,i)=>`<article><span class="file-icon">${r[1].slice(0,3).toUpperCase()}</span><div><strong>${r[0]}</strong><small>${r[2]}</small></div><button class="action-icon" data-action="generate-assessor-report" data-project="${project.id}" data-report="${i}">${icon("download")}</button></article>`).join("")}</div></section><section class="panel" style="margin-top:13px"><header class="panel-head"><div><h2>本地整改闭环</h2><p>在评估记录中直接维护责任、验证与关闭状态</p></div></header><div class="panel-body info-list"><div class="info-row"><span>弱项记录</span><strong>${weaknesses.length}</strong></div><div class="info-row"><span>已验证关闭</span><strong>${closedWeaknesses}</strong></div><div class="info-row"><span>仍需关闭</span><strong>${Math.max(0,weaknesses.length-closedWeaknesses)}</strong></div><button class="btn secondary" data-action="open-consolidation" data-id="${project.id}">${icon("check")}进入记录合并与关闭</button></div></section></aside></div>`;
  }

  function helixItemKey(section,item,index){const sectionKey=section?.key||"section";const stableIdentity=item?.tag||item?.id||item?.number||item?.self;return stableIdentity?`${sectionKey}::${stableIdentity}`:`${sectionKey}::index::${index}`;}
  function helixVisibleRecords(sectionKey=""){return (helixUi.snapshot?.sections||[]).flatMap(section=>(section.items||[]).slice(0,helixUi.itemLimit).map((item,index)=>({key:helixItemKey(section,item,index),section,item,index}))).filter(record=>!sectionKey||record.section.key===sectionKey);}
  function syncHelixInputs(){const panel=document.getElementById("helixImportPanel");if(!panel)return;helixUi.bridgeUrl=panel.querySelector("[data-helix-field=bridgeUrl]")?.value.trim()||HELIX_DEFAULTS.bridgeUrl;helixUi.baseUrl=panel.querySelector("[data-helix-field=baseUrl]")?.value.trim()||"";helixUi.username=panel.querySelector("[data-helix-field=username]")?.value.trim()||"";helixUi.password=panel.querySelector("[data-helix-field=password]")?.value||"";helixUi.projectId=panel.querySelector("[data-helix-field=projectId]")?.value.trim()||"";helixUi.search=panel.querySelector("[data-helix-field=search]")?.value.trim()||"";helixUi.itemLimit=Math.max(1,Math.min(1000,Number(panel.querySelector("[data-helix-field=itemLimit]")?.value)||100));helixUi.ignoreCertificateErrors=!!panel.querySelector("[data-helix-field=ignoreCertificateErrors]")?.checked;helixUi.selectedTypes=[...panel.querySelectorAll("[data-helix-type]:checked")].map(node=>node.value);}
  function resetHelixPanel(){const target=helixUi.target;Object.assign(helixUi,{...HELIX_DEFAULTS,selectedTypes:[...HELIX_DEFAULTS.selectedTypes],projects:[],snapshot:null,selectedKeys:new Set(),status:"Helix 控件已重置。",busy:false,target});const panel=document.getElementById("helixImportPanel");if(panel){Object.entries({bridgeUrl:helixUi.bridgeUrl,baseUrl:helixUi.baseUrl,username:helixUi.username,password:"",projectId:"",search:"",itemLimit:String(helixUi.itemLimit)}).forEach(([name,value])=>{const input=panel.querySelector(`[data-helix-field=${name}]`);if(input)input.value=value;});const ignoreCert=panel.querySelector("[data-helix-field=ignoreCertificateErrors]");if(ignoreCert)ignoreCert.checked=helixUi.ignoreCertificateErrors;panel.querySelectorAll("[data-helix-type]").forEach(toggle=>{toggle.checked=helixUi.selectedTypes.includes(toggle.value);});const datalist=panel.querySelector("#helixProjectOptions");if(datalist)datalist.innerHTML="";}renderHelixOutput();refreshHelixControls();}  function helixRequestPayload(requireProject){syncHelixInputs();if(!/^https?:\/\//i.test(helixUi.bridgeUrl))throw new Error("请填写有效的本地 bridge URL。");if(!/^https?:\/\//i.test(helixUi.baseUrl))throw new Error("请填写有效的 Helix REST API URL。");if(!helixUi.username)throw new Error("请填写 Helix 用户名。");if(!helixUi.password)throw new Error("请填写 Helix 密码；密码仅保留在当前页面内存中。");if(requireProject&&!helixUi.projectId)throw new Error("请填写或选择 Helix 项目。");if(requireProject&&!helixUi.selectedTypes.length)throw new Error("请至少选择一种 Helix 数据类型。");return {baseUrl:helixUi.baseUrl,username:helixUi.username,password:helixUi.password,projectId:helixUi.projectId,search:helixUi.search,selectedTypes:[...helixUi.selectedTypes],itemLimit:helixUi.itemLimit,ignoreCertificateErrors:helixUi.ignoreCertificateErrors};}
  async function postHelixBridge(route,payload){const response=await fetch(helixUi.bridgeUrl.replace(/\/$/,"")+route,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const text=await response.text();let body;try{body=JSON.parse(text);}catch(_){body={error:text};}if(!response.ok)throw new Error(`${response.status} ${body.error||text}`.trim());return body;}
  function setHelixStatus(message,busy=false){helixUi.status=message;helixUi.busy=busy;refreshHelixControls();}
  function refreshHelixControls(){const status=document.getElementById("helixImportStatus"),selection=document.getElementById("helixSelectionStatus");if(status){status.textContent=helixUi.status;status.classList.toggle("warn",/失败|错误/.test(helixUi.status));}if(selection)selection.textContent=`已选择 ${helixUi.selectedKeys.size} 条 Helix 证据`;document.querySelectorAll("#helixImportPanel [data-helix-busy]").forEach(button=>button.disabled=helixUi.busy);document.querySelectorAll("#helixImportOutput [data-helix-key]").forEach(button=>{const selected=helixUi.selectedKeys.has(button.dataset.helixKey);button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));});}
  function renderHelixOutput(){const output=document.getElementById("helixImportOutput");if(!output)return;if(!helixUi.snapshot){output.innerHTML=helixUi.projects.length?`<div class="helix-project-grid">${helixUi.projects.slice(0,30).map(project=>{const value=project.name||project.id||"";return `<button class="helix-project-card ${value===helixUi.projectId?"active":""}" data-action="helix-project" data-value="${esc(value)}"><strong>${esc(project.name||project.id||"Project")}</strong><small>ID ${esc(project.id||"—")}${project.uuid?` · ${esc(project.uuid)}`:""}</small></button>`;}).join("")}</div>`:`<div class="empty-mini">启动本地 bridge 后查找项目，或直接填写项目名称/ID 并读取快照。</div>`;refreshHelixControls();return;}const summary=helixUi.snapshot.summary||{};output.innerHTML=`<div class="helix-live-grid">${[["项目",helixUi.snapshot.project?.idOrName||helixUi.projectId],["对象",summary.totalItems||0],["链接",summary.linkSignals||0],["附件",summary.attachmentSignals||0]].map(([label,value])=>`<article><span>${label}</span><strong>${esc(String(value))}</strong></article>`).join("")}</div>${(helixUi.snapshot.sections||[]).map(section=>{const records=helixVisibleRecords(section.key);return `<details class="helix-import-section" open><summary><span><strong>${esc(section.label||section.key)}</strong><small>${section.ok===false?"不可用":`${records.length}/${section.count||records.length} 条`}</small></span><span class="helix-section-actions"><button class="btn secondary sm" data-action="helix-select-category" data-section="${esc(section.key||"")}">选择本类</button><button class="btn ghost sm" data-action="helix-clear-category" data-section="${esc(section.key||"")}">清除本类</button></span></summary>${section.ok===false?`<p class="helix-error">${esc(section.error||"REST endpoint unavailable")}</p>`:""}<div class="helix-row-list">${records.map(record=>{const item=record.item,signals=[item.linkCount?`links=${item.linkCount}`:"",item.attachmentCount?`attachments=${item.attachmentCount}`:"",item.eventCount?`events=${item.eventCount}`:""].filter(Boolean).join(" · ");return `<article class="helix-item-row"><button class="helix-row-check ${helixUi.selectedKeys.has(record.key)?"selected":""}" data-action="helix-toggle-item" data-helix-key="${esc(record.key)}" aria-pressed="${helixUi.selectedKeys.has(record.key)}" title="选择该 Helix 条目">${icon("check")}</button><div><strong>${esc(item.tag||item.id||item.number||"—")}</strong><small>${esc(item.kind||section.key)}</small></div><p>${esc(item.summary||(item.fields||[]).slice(0,3).map(field=>`${field.label}: ${field.value}`).join("; ")||"—")}</p><span>${esc(item.state||signals||"—")}</span></article>`;}).join("")||`<div class="empty-mini">本分类没有返回条目。</div>`}</div></details>`;}).join("")}`;refreshHelixControls();}
  function renderHelixPanel(project,type){helixUi.target={projectId:project.id,type};queueMicrotask(renderHelixOutput);const toggles=[["requirements","Requirements"],["documents","Documents"],["issues","Issues"],["testCases","Test cases"],["testRuns","Test runs"],["folders","Folders"]];return `<section class="helix-import-panel" id="helixImportPanel"><header><div><span class="overline">Live Helix ALM</span><h2>从 Helix 导入证据对象</h2><p>通过本机 bridge 读取项目；密码只保留在当前标签页内存中，不写入 AuditFlow 工作区。</p></div><span class="badge neutral" id="helixSelectionStatus">已选择 ${helixUi.selectedKeys.size} 条 Helix 证据</span></header><div class="helix-fields"><label>Bridge URL<input data-helix-field="bridgeUrl" value="${esc(helixUi.bridgeUrl)}"></label><label class="wide">Helix REST API URL<input data-helix-field="baseUrl" placeholder="https://host/helix-alm/api/v0" value="${esc(helixUi.baseUrl)}"></label><label>Username<input data-helix-field="username" autocomplete="username" value="${esc(helixUi.username)}"></label><label>Password<input data-helix-field="password" type="password" autocomplete="current-password" value="${esc(helixUi.password)}"></label><label>Project<input data-helix-field="projectId" list="helixProjectOptions" value="${esc(helixUi.projectId)}"><datalist id="helixProjectOptions">${helixUi.projects.map(p=>`<option value="${esc(p.name||p.id||"")}"></option>`).join("")}</datalist></label><label>Search<input data-helix-field="search" value="${esc(helixUi.search)}"></label><label>Limit<input data-helix-field="itemLimit" type="number" min="1" max="1000" value="${helixUi.itemLimit}"></label><label class="helix-check-label"><input data-helix-field="ignoreCertificateErrors" type="checkbox" ${helixUi.ignoreCertificateErrors?"checked":""}><span>允许自签名证书</span></label></div><div class="helix-type-toggles">${toggles.map(([value,label])=>`<label><input data-helix-type type="checkbox" value="${value}" ${helixUi.selectedTypes.includes(value)?"checked":""}><span>${label}</span></label>`).join("")}</div><div class="helix-toolbar"><button class="btn secondary sm" data-action="helix-find-projects" data-helix-busy>查找项目</button><button class="btn primary sm" data-action="helix-read-snapshot" data-helix-busy>读取快照</button><button class="btn secondary sm" data-action="helix-select-visible">选择可见</button><button class="btn ghost sm" data-action="helix-clear-selection">清除选择</button><button class="btn primary sm" data-action="helix-import-selected">导入所选</button><span class="toolbar-spacer"></span><button class="btn ghost sm" data-action="helix-clear-snapshot">清除快照</button><button class="btn ghost sm" data-action="helix-reset">重置</button></div><div class="helix-status" id="helixImportStatus">${esc(helixUi.status)}</div><div id="helixImportOutput"></div></section>`;}
  async function loadHelixProjects(){try{setHelixStatus("正在读取 Helix 项目…",true);const result=await postHelixBridge("/helix/projects",helixRequestPayload(false));helixUi.projects=result.projects||[];if(!helixUi.projectId&&helixUi.projects.length)helixUi.projectId=helixUi.projects[0].name||helixUi.projects[0].id||"";setHelixStatus(`已读取 ${helixUi.projects.length} 个 Helix 项目。`);renderHelixOutput();}catch(error){setHelixStatus(`Helix 项目读取失败：${error.message}`);renderHelixOutput();}}
  async function loadHelixSnapshot(){try{setHelixStatus("正在读取 Helix 项目快照…",true);const result=await postHelixBridge("/helix/snapshot",helixRequestPayload(true));helixUi.snapshot=result;helixUi.projects=result.projects||helixUi.projects;helixUi.selectedKeys.clear();setHelixStatus(`已读取 ${result.project?.idOrName||helixUi.projectId}：${result.summary?.totalItems||0} 条项目数据。`);renderHelixOutput();}catch(error){setHelixStatus(`Helix 快照读取失败：${error.message}`);renderHelixOutput();}}
  function inferHelixPrimaryProcesses(section,item,project){const text=[section.key,section.label,item.kind,item.tag,item.summary,item.state,...(item.fields||[]).flatMap(field=>[field.label,field.value])].join(" ");const inferred=processIdsFromText(text).filter(pid=>(project.processes||[]).includes(pid));if(inferred.length)return inferred;const fallbacks=section.key==="issues"?["SUP.9","SUP.10"]:section.key==="folders"||section.key==="folderTypes"?["SUP.8"]:section.key==="testCases"||section.key==="testRuns"?["SYS.5","SWE.4","SWE.5","SWE.6","HWE.3","HWE.4","MLE.4"]:["SYS.2","SWE.1","HWE.1","MLE.1"];return fallbacks.filter(pid=>(project.processes||[]).includes(pid));}
  function helixRecordToEvidence(record,project,index){const {section,item,key}=record;const identifier=item.tag||item.id||item.number||`${section.key}-${index+1}`;const fields=(item.fields||[]).map(field=>[field.label,field.value]);const rows=[["Field","Value"],["ID",identifier],["Kind",item.kind||section.key],["Summary",item.summary||""],["State",item.state||""],...fields,["Links",item.linkCount||0],["Attachments",item.attachmentCount||0],["Events",item.eventCount||0],["Folders",item.folderCount||0]];const table=makeEvidenceTable(`${section.label||section.key} · ${identifier}`,"Helix REST",rows);const content=rows.slice(1).map(row=>`${row[0]}: ${normalizeCell(row[1])}`).join("\n");const helixSummary=summarizeHelixTables(table?[table]:[]);return {id:id("ev"),code:nextEvidenceCode(project,index),name:`${identifier} · ${item.summary||section.label||section.key}`,type:`Helix ALM / ${item.kind||section.key}`,size:new Blob([content]).size,chars:content.length,source:`Helix REST · ${helixUi.snapshot?.project?.idOrName||helixUi.projectId}`,date:new Date().toISOString(),scope:"Helix 项目快照",content,tables:table?[table]:[],locators:table?tableLocators([table]):[],helix:{...helixSummary,detected:true,source:"rest",key,sectionKey:section.key,sectionLabel:section.label,project:helixUi.snapshot?.project||{idOrName:helixUi.projectId},baseUrl:helixUi.snapshot?.baseUrl||helixUi.baseUrl,fetchedAt:helixUi.snapshot?.fetchedAt||new Date().toISOString(),item:deepCopy(item)},structure:"Helix REST 对象",parseStatus:"parsed",primaryProcesses:inferHelixPrimaryProcesses(section,item,project)};}
  function renderEvidenceTab(project, type) {
    const standard=type==="standard";const evidence=project.evidence||[];const helixFiles=evidence.filter(item=>item.helix?.detected);const helixRows=helixFiles.reduce((sum,item)=>sum+Number(item.helix.rowCount||0),0);
    return `${standard&&project.assessments.length?renderAssessmentReadiness(project):""}<div class="section-title-row"><div><h2>Evidence Inventory</h2><p>本地读取 Office/PDF 正文和表格，识别 Helix 对象字段，再沿上下游及 MAN.3/SUP.1/SUP.8～10 建立可定位证据链。</p></div><div class="page-actions"><button class="btn secondary sm" data-action="add-text-evidence" data-type="${type}" data-id="${project.id}">${icon("file")}粘贴文本</button><button class="btn primary sm" data-action="pick-evidence" data-type="${type}" data-id="${project.id}">${icon("upload")}上传 Helix / Office / PDF</button></div></div><div class="evidence-parser-summary"><article><span>已解析文件</span><strong>${evidence.filter(item=>item.parseStatus==="parsed").length}/${evidence.length}</strong></article><article><span>结构化表格</span><strong>${evidence.reduce((sum,item)=>sum+(item.tables||[]).length,0)}</strong></article><article><span>Helix 导出</span><strong>${helixFiles.length}</strong></article><article><span>Helix 对象行</span><strong>${helixRows}</strong></article></div><div class="dropzone compact" data-action="pick-evidence" data-type="${type}" data-id="${project.id}"><span>${icon("upload")}</span><div><strong>拖放证据包并在浏览器本地解析</strong><p>DOCX、PPTX、XLSX/XLSM、PDF、CSV、JSON、HTML 和文本；自动读取 Sheet、Slide、表格行、Helix ID/状态/责任/基线/追溯/闭环字段。</p></div></div>${renderHelixPanel(project,type)}<section class="panel clean" style="margin-top:14px"><div class="live-table-wrap"><table class="data-table evidence-inventory-table"><thead><tr><th>ID</th><th>证据名称</th><th>解析 / Helix</th><th>主过程 / 跨过程影响</th><th>BP/GP 引用</th><th>可引用性</th><th>来源</th><th></th></tr></thead><tbody>${evidence.map((e,index)=>{if(!e.code)e.code=`EV.${String(index+1).padStart(3,"0")}`;const recordRefs=standard?(project.records||[]).filter(r=>r.evidenceIds.includes(e.id)):[];const indicatorRefs=standard?(project.assessments||[]).filter(a=>(a.evidenceAnalysis||[]).some(x=>x.evidenceId===e.id)):[];const linked=recordRefs.length+indicatorRefs.length;const direct=String(e.content||"").trim().length>=120||(e.tables||[]).some(table=>table.rowCount);const primaries=standard?inferEvidencePrimaryProcesses(e,project.processes):[];const related=standard?[...new Set(primaries.flatMap(processId=>relatedProcessesFor(processId,project.processes).map(row=>row.relatedProcess)))].slice(0,7):[];return `<tr><td><span class="code-tag">${esc(e.code)}</span></td><td><div class="table-title"><span>${icon("file")}</span><span><strong>${esc(e.name)}</strong><small>${formatSize(e.size)} · ${esc(e.structure||e.type||fileType(e.name)+" Document")}</small></span></div></td><td><div class="parse-state">${badge(e.parseStatus==="parsed"?"success":"warn",e.parseStatus==="parsed"?"本地已解析":"仅元数据")}${e.helix?.detected?`<button class="btn ghost sm" data-action="preview-evidence-tables" data-type="${type}" data-project="${project.id}" data-id="${e.id}">Helix ${e.helix.score}% · ${e.helix.rowCount} 行</button>`:`<small>${(e.tables||[]).length} 个表格</small>`}</div></td><td><div class="evidence-scope-cell"><strong>${primaries.map(id=>`<span class="code-tag">${esc(id)}</span>`).join(" ")||esc(e.scope||"全部审核项")}</strong>${related.length?`<small>关联：${related.map(esc).join("、")}</small>`:""}</div></td><td><button class="btn ghost sm" data-action="show-evidence-refs" data-project="${project.id}" data-id="${e.id}">${indicatorRefs.length} 项 / ${recordRefs.length} 记录</button></td><td>${badge(direct?"success":"warn",direct?"可定位正文/表格":"仅元数据")}</td><td>${esc(e.source||"本地上传")}</td><td><div class="row-actions">${(e.tables||[]).length?`<button class="action-icon" data-action="preview-evidence-tables" data-type="${type}" data-project="${project.id}" data-id="${e.id}" title="查看表格">${icon("eye")}</button>`:""}<button class="action-icon" data-action="delete-evidence" data-type="${type}" data-project="${project.id}" data-id="${e.id}" title="删除" ${linked?"data-linked=true":""}>${icon("trash")}</button></div></td></tr>`}).join("")||`<tr><td colspan="8"><div class="empty-state"><div><span>${icon("file")}</span><h2>尚未添加证据</h2><p>上传 Helix 导出的 XLSX，或其他 Office/PDF 工作产品开始本地预审。</p></div></div></td></tr>`}</tbody></table></div></section>`;
  }

  function renderTraceStudio(project) {
    if(!project.assessments.length)return `<div class="empty-state"><div><span>${icon("link")}</span><h2>先执行 AI 预评估</h2><p>预评估会创建 BP/GP 指标集，再根据本地解析的正文、表格和 Helix 行生成可复核追溯候选。</p><button class="btn primary" data-action="run-standard" data-id="${project.id}">${icon("sparkles")}开始 AI 预评估</button></div></div>`;
    const activeProcess=project.processes.includes(ui.activeProcess)?ui.activeProcess:(project.processes[0]||"");ui.activeProcess=activeProcess;
    const processItems=project.assessments.filter(item=>item.process===activeProcess);const active=processItems.find(item=>indicatorKey(item)===ui.activeIndicator)||processItems[0]||project.assessments[0];ui.activeIndicator=indicatorKey(active);
    const coverage=traceCoverage(project);const stages=projectProgressStages(project);const links=traceLinksForAssessment(project,active);const manualIds=new Set((project.traceLinks||[]).filter(link=>link.indicator===indicatorKey(active)).map(link=>link.evidenceId));
    const evidenceCandidates=(project.evidence||[]).map(evidence=>{const relation=evidenceRelationToProcess(evidence,active.process,project.processes);const locatable=String(evidence.content||"").trim().length>=120||(evidence.tables||[]).some(table=>table.rowCount);const strength=!locatable?"index-only":relation?.relationType==="direct"?"direct":"corroborating";return {evidence,relation,strength,score:(relation?.relationType==="direct"?100:relation?60:0)+(evidence.helix?.detected?20:0)+(locatable?10:0)};}).sort((a,b)=>b.score-a.score);
    return `${renderAssessmentReadiness(project)}<section class="trace-progress-board"><header><div><span class="overline">Project Development Progress</span><h2>项目开发进展与审核准备度</h2><p>把计划、证据、追溯、人工复核、定稿和关闭作为连续质量流，而非分散页面。</p></div><button class="btn primary sm" data-action="trace-ai-project" data-project="${project.id}">${icon("sparkles")}AI 检查全项目</button></header><div class="trace-stage-strip">${stages.map((stage,index)=>`<article><span>${index+1}</span><div><strong>${esc(stage.name)}</strong><small>${esc(stage.detail)}</small><i><b style="width:${stage.value}%"></b></i></div><em>${stage.value}%</em></article>`).join("")}</div></section><div class="trace-kpi-grid"><article><span>指标已关联</span><strong>${coverage.linked}/${coverage.total}</strong><small>${coverage.linkedPercent}% 至少有一条证据链</small></article><article><span>直接证据覆盖</span><strong>${coverage.directPercent}%</strong><small>${coverage.direct} 项具备目标过程直接证据</small></article><article><span>人工确认关系</span><strong>${coverage.confirmed}</strong><small>评估师确认的指标—证据关联</small></article><article class="${coverage.blocked?"risk":""}"><span>Helix 阻塞对象</span><strong>${coverage.blocked}</strong><small>未关闭前不得据此宣称完整闭环</small></article></div><div class="trace-studio"><aside class="trace-model-pane"><header><strong>ASPICE 模型树</strong><small>Process → PA → BP/GP</small></header><div class="trace-model-scroll">${project.processes.map(processId=>{const items=project.assessments.filter(item=>item.process===processId);const direct=items.filter(item=>traceLinksForAssessment(project,item).some(link=>link.strength==="direct")).length;return `<section><button class="trace-process-node ${activeProcess===processId?"active":""}" data-action="select-process" data-process="${processId}"><span>${esc(processId)}</span><strong>${esc(PROCESS_CATALOG.find(item=>item.id===processId)?.zh||processId)}</strong><b>${direct}/${items.length}</b></button>${activeProcess===processId?items.map(item=>{const itemLinks=traceLinksForAssessment(project,item);return `<button class="trace-indicator-node ${indicatorKey(item)===ui.activeIndicator?"active":""}" data-action="select-indicator" data-id="${esc(indicatorKey(item))}"><span>${esc(item.code)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.pa)} · ${itemLinks.length} 条关系</small></div><b class="rating-dot ${ratingClass(item.rating)}">${esc(item.rating)}</b></button>`}).join(""):""}</section>`}).join("")}</div></aside><main class="trace-mapping-pane"><header class="trace-focus-head"><div><span class="overline">${esc(indicatorKey(active))}</span><h2>${esc(active.title)}</h2><p>${esc(active.criterion)}</p></div><button class="btn primary sm" data-action="trace-ai-indicator" data-project="${project.id}" data-assessment="${active.id}">${icon("sparkles")}询问 AI 评估师</button></header><div class="trace-method-banner"><strong>当前候选 ${esc(active.aiCandidateRating||active.rating)} · 人工 ${esc(active.rating)}</strong><span>${esc(sufficiencyLabel(active.evidenceSufficiency?.status))} ${active.evidenceSufficiency?.coverage||0}%</span><p>只对正式范围内 ${esc(active.process)} 评分；关联过程证据仅证明接口、一致性、配置、问题或变更关系。</p></div><div class="section-title-row"><div><h3>指标—证据关系</h3><p>AI 推断可由评估师确认；确认不会改变证据强度，也不会绕过评分护栏。</p></div><button class="btn secondary sm" data-action="suggest-finding-templates" data-project="${project.id}" data-indicator="${esc(indicatorKey(active))}">${icon("copy")}Finding 模板</button></div><div class="trace-link-list">${links.map(link=>{const evidence=project.evidence.find(item=>item.id===link.evidenceId);return `<article class="trace-link-card ${link.strength}"><header><span class="code-tag">${esc(link.evidenceCode||evidence?.code||"EV")}</span>${badge(link.confirmed?"success":link.strength==="direct"?"info":"neutral",link.confirmed?"评估师已确认":link.strength==="direct"?"AI 直接关系":"AI 关联关系")}</header><strong>${esc(evidence?.name||link.source||"证据")}</strong><small>${esc(link.locator||"待打开原文定位")}</small><p>${esc(link.claim||"用于支持当前指标的证据链判断。")}</p></article>`}).join("")||`<div class="evidence-gap"><strong>当前指标没有证据关系</strong><p>从右侧候选证据确认关联，或补充能够直接证明该 BP/GP 的受控项目样本。</p></div>`}</div><div class="trace-mapset-bar"><strong>启用的 Map Set</strong>${db.mapSets.filter(item=>item.visible).map(item=>`<span>${esc(item.name)} · ${item.maps}</span>`).join("")}</div></main><aside class="trace-evidence-pane"><header><strong>Evidence candidates</strong><small>按过程关系、可定位性和 Helix 字段排序</small></header><div class="trace-evidence-scroll">${evidenceCandidates.map(({evidence,relation,strength})=>{const confirmed=manualIds.has(evidence.id);return `<article class="trace-evidence-card ${confirmed?"confirmed":""}"><div class="trace-evidence-title"><span>${icon(evidence.helix?.detected?"layout":"file")}</span><div><strong>[${esc(evidence.code||"EV")}] ${esc(evidence.name)}</strong><small>${esc(relation?`${relation.relatedProcess} · ${relationLabel(relation.relationType)}`:"未匹配过程关系")} · ${strength==="direct"?"直接候选":strength==="corroborating"?"关联佐证":"仅索引"}</small></div></div><p>${esc(evidence.locators?.[0]?.excerpt||String(evidence.content||"").slice(0,130)||"当前只保留文件索引，需打开原文定位。")}</p><footer>${(evidence.tables||[]).length?`<button class="btn ghost sm" data-action="preview-evidence-tables" data-type="standard" data-project="${project.id}" data-id="${evidence.id}">查看表格</button>`:"<span></span>"}<button class="btn ${confirmed?"secondary":"primary"} sm" data-action="confirm-trace-link" data-project="${project.id}" data-assessment="${active.id}" data-evidence="${evidence.id}">${confirmed?"取消人工确认":"确认关联"}</button></footer></article>`}).join("")||`<div class="empty-mini">尚无证据，请先上传工作产品。</div>`}</div></aside></div>`;
  }

  function importedAssessmentSummary(project) {
    if (!project.importSource) return "";
    const source = project.importSource;
    const results = project.processResults || [];
    const weakest = [...results].sort((a,b)=>Number(a.pa11Score||0)-Number(b.pa11Score||0)).slice(0,6);
    return `<section class="imported-assessment-banner"><header><span>${icon("file")}</span><div><span class="overline">Imported Professional Assessment</span><h2>TMM 专业评估员报告 · ${esc(source.reportVersion || "")}</h2><p>${esc(source.sourceFile)} · ${esc(source.assessmentPeriod)} · 导入活动完成度 100%</p></div>${badge("success","已完成导入")}</header><div class="imported-kpi-grid"><article><span>正式评估过程</span><strong>${results.length}</strong></article><article><span>实践评分</span><strong>${source.stats?.ratedPractices || project.assessments.length}</strong></article><article><span>源弱项</span><strong>${source.stats?.weaknessEntries || 0}</strong></article><article><span>专业评估意见</span><strong>${source.stats?.assessorComments || 0}</strong></article></div><p class="import-warning">项目实施进度 100% 表示评估活动和报告导入已经完成，不表示所有过程达到目标能力等级。源报告未提供完整 PA 2.1/PA 2.2 评分。</p><div class="imported-process-strip">${weakest.map(item=>`<article><strong>${esc(item.id)}</strong><span>${reportRatingMarkup(String(item.attributeRatings?.["PA 1.1"]||"N").match(/N|P-|P\+|P|L-|L\+|L|F/)?.[0]||"N",false)}</span><small>Level ${Number(item.achievedLevel||0)} · ${Number(item.pa11Score||0)}%</small></article>`).join("")}</div></section>`;
  }

  function renderAssessmentTab(project, type) {
    if (!project.assessments.length) return `<div class="empty-state"><div><span>${icon("sparkles")}</span><h2>还没有评估结果</h2><p>添加证据并启动 AI 评估。系统会逐项生成评分候选、理由、O/W/R 发现、证据引用和置信度。</p><button class="btn primary" data-action="run-${type}" data-id="${project.id}">${icon("sparkles")}开始 AI 评估</button></div></div>`;
    const groups = [...new Set(project.assessments.map(a => a.group))];
    const rows = groups.map(group => {
      const items = project.assessments.filter(a => a.group === group);
      return `<section class="assessment-group"><header class="assessment-group-head"><strong>${esc(group)}</strong><span>${items.length} 项</span>${badge(ratingClass(averageRating(items)), `组评分 ${averageRating(items)}`)}</header>${items.map(a => `<div class="assessment-row"><span class="code-tag">${esc(a.code)}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.reason)}</p></div><select class="rating-select" data-rating-change data-type="${type}" data-project="${project.id}" data-id="${a.id}" aria-label="人工评分">${ratingOptions(a.rating)}</select><span class="confidence"><i></i>${a.sourceAssessment?"专业评估员":`${a.confidence}% ${a.reviewed ? "已复核" : "AI 置信度"}`}</span><div class="finding-dots">${["O", "W", "R"].map(t => `<span class="${t.toLowerCase()}">${t}${a.findings.filter(f => f.type === t).length}</span>`).join("")}</div><button class="btn secondary sm" data-action="review-assessment" data-type="${type}" data-project="${project.id}" data-id="${a.id}">核对</button></div>`).join("")}</section>`;
    }).join("");
    const weak = project.assessments.filter(a => RATING_SCORE[a.rating] < 50).slice(0, 4);
    return `<div class="audit-layout"><div>${rows}</div><aside><div class="insight-card"><div class="insight-head"><span>${icon(project.importSource?"users":"sparkles")}</span><strong>${project.importSource?"专业评估员总体意见":"AI 专业意见"}</strong></div><p>${esc(buildExecutiveOpinion(project))}</p><ul>${weak.map(a => `<li>${esc(a.code)}：${esc(a.title)}需优先补强</li>`).join("") || "<li>当前未识别高风险弱项</li>"}</ul></div><div class="panel"><header class="panel-head"><h2>复核进度</h2></header><div class="panel-body info-list"><div class="info-row"><span>AI 评估项</span><strong>${project.assessments.length}</strong></div><div class="info-row"><span>已人工复核</span><strong>${project.assessments.filter(a => a.reviewed).length}</strong></div><div class="info-row"><span>弱项（N/P）</span><strong>${project.assessments.filter(a => RATING_SCORE[a.rating] < 50).length}</strong></div><div class="info-row"><span>证据引用</span><strong>${project.assessments.reduce((s, a) => s + a.refs.length, 0)}</strong></div></div></div></aside></div>`;
  }

  function buildExecutiveOpinion(project) {
    if (project.aiOpinion) return project.aiOpinion;
    const assessments = project.assessments || [];
    if (!assessments.length) return "尚无评估结果。";
    const weak = assessments.filter(a => RATING_SCORE[a.rating] < 50).length;
    const avg = averageRating(assessments);
    const processText = project.processes ? project.processes.join("、") : "当前范围";
    return `当前 ${processText} 综合评分候选为 ${avg}，识别 ${weak} 个 P 或以下弱项。证据对过程定义的支持通常高于对项目级连续执行的支持；正式结论前应抽查关键样本的版本、批准、双向追溯和问题闭环。`;
  }

  function renderHistoryTab(project) {
    if (!project.runs.length) return `<div class="empty-state"><div><span>${icon("clock")}</span><h2>尚无评估历史</h2><p>每次重新评估都会保存独立结果，便于比较证据补充前后的变化并回滚当前版本。</p></div></div>`;
    return `<table class="data-table"><thead><tr><th>版本</th><th>评估时间</th><th>说明</th><th>总体评分</th><th>状态</th><th></th></tr></thead><tbody>${project.runs.map(run => `<tr><td><strong style="color:var(--ink)">版本 ${run.version}</strong><br><small>${esc(run.id)}</small></td><td>${formatDate(run.date)}</td><td>${esc(run.summary)}</td><td>${badge(ratingClass(averageRating(run.assessments)), averageRating(run.assessments))}</td><td>${badge(run.status === "当前版本" ? "success" : "neutral", run.status)}</td><td><div class="row-actions"><button class="btn secondary sm" data-action="preview-run" data-project="${project.id}" data-id="${run.id}">${icon("eye")}查看</button>${run.status !== "当前版本" ? `<button class="btn secondary sm" data-action="restore-run" data-project="${project.id}" data-id="${run.id}">${icon("rotate")}切换到此版</button>` : ""}</div></td></tr>`).join("")}</tbody></table>`;
  }

  function renderCustomHome() {
    const schemeCards = db.customSchemes.map(s => `<article class="process-card"><span class="process-code">${s.questions.length} 个问题</span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><footer><span>${s.categories.length} 个分类 · ${formatDate(s.updated)}</span><button class="btn ghost sm" data-action="open-scheme" data-id="${s.id}">编辑方案 ${icon("arrow")}</button></footer></article>`).join("");
    const auditRows = db.customAudits.map(a => { const scheme = db.customSchemes.find(s => s.id === a.schemeId); return `<tr><td><div class="table-title"><span>${icon("layers")}</span><span><strong>${esc(a.name)}</strong><small>${esc(a.id)} · ${formatDate(a.date)}</small></span></div></td><td>${esc(scheme?.name || "未知方案")}</td><td>${esc(a.organization)}</td><td><div class="progress"><div class="progress-label"><span>完成度</span><b>${a.progress}%</b></div><div class="progress-bar" style="--value:${a.progress}%"><i></i></div></div></td><td>${badge(a.status)}</td><td>${badge(a.conclusion === "通过" ? "success" : "warn", a.conclusion || "待定")}</td><td><button class="action-icon" data-action="open-custom-audit" data-id="${a.id}">${icon("arrow")}</button></td></tr>`; }).join("");
    app.innerHTML = `<div class="page">${renderPageHead("Flexible Review", "自定义审核", "把组织自己的检查表、供应商月度审核或合规要求配置成可复用方案，AI 逐题评估并生成可编辑报告。", `<button class="btn secondary" data-action="new-scheme">${icon("layout")}新建方案</button><button class="btn primary" data-action="new-custom-audit">${icon("plus")}发起审核</button>`)}<section class="panel clean"><nav class="tabs"><button data-action="custom-tab" data-tab="audits" class="${ui.customTab === "audits" ? "active" : ""}">审核任务 <span class="count">${db.customAudits.length}</span></button><button data-action="custom-tab" data-tab="schemes" class="${ui.customTab === "schemes" ? "active" : ""}">审核方案 <span class="count">${db.customSchemes.length}</span></button></nav>${ui.customTab === "schemes" ? `<div class="panel-body"><div class="process-grid">${schemeCards}</div></div>` : `<div class="table-toolbar"><label class="searchbox">${icon("search")}<input placeholder="搜索自定义审核…"></label><span class="toolbar-spacer"></span><button class="btn secondary sm" data-action="new-custom-audit">${icon("plus")}发起审核</button></div><table class="data-table"><thead><tr><th>审核任务</th><th>方案</th><th>对象</th><th>进度</th><th>状态</th><th>结论</th><th></th></tr></thead><tbody>${auditRows || `<tr><td colspan="7"><div class="empty-state"><div><span>${icon("layers")}</span><h2>还没有审核任务</h2></div></div></td></tr>`}</tbody></table>`}</section></div>`;
  }

  function renderScheme(scheme) {
    if (!scheme) return renderNotFound();
    app.innerHTML = `<div class="page">${renderPageHead("Custom Scheme", scheme.name, scheme.description, `<button class="btn secondary" data-action="back-custom">返回</button><button class="btn secondary" data-action="paste-questions" data-id="${scheme.id}">${icon("copy")}批量粘贴</button><button class="btn primary" data-action="add-question" data-id="${scheme.id}">${icon("plus")}添加问题</button>`)}<div class="audit-layout"><section class="panel"><header class="panel-head"><div><h2>审核问题</h2><p>问题可按分类组织，并提供判断参考</p></div>${badge("info", `${scheme.questions.length} 项`)}</header><div class="panel-body">${scheme.questions.map((q, index) => `<article class="question-card"><span class="question-index">${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(q.text)}</strong><p>${esc(q.category)}</p><small>判断参考：${esc(q.reference || "未设置")}</small></div><div class="row-actions"><button class="action-icon" data-action="edit-question" data-scheme="${scheme.id}" data-id="${q.id}">${icon("edit")}</button><button class="action-icon" data-action="delete-question" data-scheme="${scheme.id}" data-id="${q.id}">${icon("trash")}</button></div></article>`).join("")}</div></section><aside><div class="panel"><header class="panel-head"><h2>方案信息</h2></header><div class="panel-body info-list"><div class="info-row"><span>报告标题</span><strong>${esc(scheme.reportTitle)}</strong></div><div class="info-row"><span>分类</span><strong>${esc(scheme.categories.join("、"))}</strong></div><div class="info-row"><span>更新时间</span><strong>${formatDate(scheme.updated)}</strong></div></div></div><div class="insight-card" style="margin-top:13px"><div class="insight-head"><span>${icon("sparkles")}</span><strong>方案建议</strong></div><p>问题应包含可验证对象和判断条件。判断参考可以引用标准条款、组织流程或期望证据，能显著提升 AI 结论的一致性。</p></div></aside></div></div>`;
  }

  function buildCustomAssessments(audit) {
    const scheme = db.customSchemes.find(s => s.id === audit.schemeId);
    return (scheme?.questions || []).map((q, index) => ({ id: id("ca"), group: q.category || "未分类", process: "CUSTOM", code: `Q${index + 1}`, title: q.text, criterion: q.reference || "依据审核方案判断", rating: ["L", "P+", "L+", "P"][index % 4], confidence: 76 + (index % 4) * 5, reason: index % 3 === 1 ? "已发现相关文档和记录，但当前证据未完整展示周期性执行与关闭验证。" : "证据与审核问题匹配，包含责任、时间、版本和结果，可支持当前判断候选。", findings: index % 3 === 1 ? [{ type: "W", text: "执行记录的覆盖周期和批准状态需进一步核实。" }, { type: "R", text: "抽取最近三个周期的样本验证一致性。" }] : [{ type: "O", text: "当前证据与访谈说明一致。" }], refs: audit.evidence.length ? [audit.evidence[0].name] : ["尚未绑定证据"], reviewed: false }));
  }

  function renderCustomAudit(audit) {
    if (!audit) return renderNotFound();
    const scheme = db.customSchemes.find(s => s.id === audit.schemeId);
    app.innerHTML = `<div class="page">${renderPageHead("Custom Audit · " + audit.id, audit.name, `${audit.organization} · 方案：${scheme?.name || "—"}`, `<button class="btn secondary" data-action="back-custom">返回任务</button><button class="btn secondary" data-action="export-custom-word" data-id="${audit.id}">${icon("download")}导出 Word</button><button class="btn primary" data-action="run-custom" data-id="${audit.id}">${icon("sparkles")}${audit.assessments.length ? "重新评估" : "开始 AI 评估"}</button>`)}<section class="project-summary"><article class="project-id-card"><span class="project-id-icon">${icon("layers")}</span><div><h2>${esc(audit.id)}</h2><p>${esc(scheme?.name || "自定义方案")} · ${formatDate(audit.date)}</p><div style="margin-top:9px">${badge(audit.status)}</div></div></article><article class="mini-metric"><span>审核结论</span><strong>${esc(audit.conclusion || "待定")}</strong><small>由审核员最终确认</small></article><article class="mini-metric"><span>问题数量</span><strong>${scheme?.questions.length || 0}</strong><small>${scheme?.categories.length || 0} 个分类</small></article><article class="mini-metric"><span>待复核</span><strong>${audit.assessments.filter(a => !a.reviewed).length}</strong><small>AI 结论待人工确认</small></article></section><section class="panel clean"><nav class="tabs"><button data-action="project-tab" data-tab="evidence" class="${ui.projectTab === "evidence" ? "active" : ""}">证据管理 <span class="count">${audit.evidence.length}</span></button><button data-action="project-tab" data-tab="results" class="${ui.projectTab !== "evidence" ? "active" : ""}">逐题评估 <span class="count">${audit.assessments.length}</span></button></nav><div class="panel-body">${ui.projectTab === "evidence" ? renderEvidenceTab(audit, "custom") : renderAssessmentTab(audit, "custom")}</div></section></div>`;
  }

  function libraryNav() {
    const entries = [["processes", "book", "过程与 BP"], ["generic", "layers", "GP 与能力等级"], ["models", "package", "审核模型生命周期"], ["guidelines", "alert", "Guideline / TAA"], ["overlays", "layout", "Overlay 与 IA"], ["templates", "copy", "记录模板"], ["maps", "link", "Map Set / 指标关联"], ["elements", "shield", "审核要素集"], ["prompts", "sparkles", "AI 提示词"], ["scoring", "chart", "评分规则"], ["reports", "file", "报告模板"]];
    return `<aside class="library-nav"><p>ASPICE 4.0 标准库</p>${entries.map(e => `<button data-action="library-tab" data-tab="${e[0]}" class="${ui.libraryTab === e[0] ? "active" : ""}">${icon(e[1])}${e[2]}</button>`).join("")}<p>维护</p><button data-action="import-elements">${icon("upload")}导入 Excel</button><button data-action="export-elements">${icon("download")}导出 Excel</button></aside>`;
  }

  function renderLibrary() {
    app.innerHTML = `<div class="page">${renderPageHead("Knowledge Base", "ASPICE 标准知识库", "集中维护 PAM 版本、过程 BP、通用实践 GP、审核要素、评分规则、提示词和报告输出配置。", `<span class="badge success">Automotive SPICE 4.0 · 当前生产版</span>`)}<section class="library-layout">${libraryNav()}<div class="library-content">${libraryContent()}</div></section></div>`;
  }

  function libraryContent() {
    if (ui.libraryTab === "processes") {
      return `<div class="page-head" style="margin-bottom:18px"><div><span class="overline">Process Reference Model</span><h1 style="font-size:18px">过程目录与基本实践</h1><p>28 个过程模块，选择过程可查看用途、BP 清单和典型证据要求。</p></div><div class="page-actions"><label class="searchbox">${icon("search")}<input placeholder="搜索过程…" data-process-search></label></div></div><div class="process-grid" id="processGrid">${processCards(PROCESS_CATALOG)}</div>`;
    }
    if (ui.libraryTab === "generic") {
      return `<div class="page-head"><div><span class="overline">Capability Level 2–3</span><h1 style="font-size:18px">通用实践与过程属性</h1><p>能力等级判断采用 PA 硬门槛；平均分不能覆盖关键属性失效。</p></div></div><section class="panel clean"><table class="data-table"><thead><tr><th>实践</th><th>名称</th><th>审核意图</th><th>适用属性</th></tr></thead><tbody>${GP_LIBRARY.map((g, i) => `<tr><td><span class="code-tag">${g[0]}</span></td><td><strong style="color:var(--ink)">${g[1]}</strong></td><td>${g[2]}</td><td>${i < 6 ? "PA 2.1" : "PA 2.2"}</td></tr>`).join("")}</tbody></table></section><div class="setting-section" style="margin-top:14px"><h2>能力等级硬门槛</h2><p>遵循 PAM 的逐级达成原则。</p><div class="risk-matrix"><div class="risk-card"><span>CL1</span><strong>PA 1.1 ≥ L</strong></div><div class="risk-card"><span>CL2</span><strong>PA 1.1 = F<br>PA 2.1/2.2 ≥ L</strong></div><div class="risk-card"><span>CL3</span><strong>低级属性 = F<br>PA 3.1/3.2 ≥ L</strong></div></div></div>`;
    }
    if (ui.libraryTab === "models") {
      return `<div class="page-head"><div><span class="overline">Audit Model Lifecycle</span><h1 style="font-size:18px">审核模型、参考模型与发布生命周期</h1><p>按照“参考标准 / 角色与工作产品 → 主审核模型 → Indicator Linking → Profile 与评分量表 → 发布”的顺序控制模型可用性。</p></div><button class="btn primary sm" data-action="new-audit-model">${icon("plus")}创建审核模型</button></div><div class="model-lifecycle-strip">${[["1","参考模型","标准、角色、工作产品"],["2","主审核模型","问题、指标与层级"],["3","Map Set","跨模型指标关联"],["4","Profile","评分量表与适用场景"],["5","发布","冻结版本供评估使用"]].map(item=>`<article><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></article>`).join("")}</div><section class="panel clean"><table class="data-table"><thead><tr><th>模型</th><th>类型</th><th>版本</th><th>节点 / 已映射</th><th>Profile</th><th>生命周期</th><th></th></tr></thead><tbody>${(db.auditModels||[]).map(model=>{const ready=model.mapped>=model.nodes&&model.profile;return `<tr><td><strong style="color:var(--ink)">${esc(model.name)}</strong><br><small>${esc(model.id)} · ${esc(model.updated)}</small></td><td>${esc(model.family)}</td><td>${esc(model.version)}</td><td><strong>${model.nodes} / ${model.mapped}</strong><br><small>${model.nodes?Math.round(model.mapped/model.nodes*100):0}% mapped</small></td><td>${esc(model.profile||"未配置")}</td><td>${badge(model.status==="Published"?"success":ready?"info":"warn",model.status==="Published"?"Published":ready?"Ready to publish":"Draft / gaps")}</td><td><button class="btn ${model.status==="Published"?"secondary":"primary"} sm" data-action="publish-audit-model" data-id="${model.id}" ${model.status==="Published"||!ready?"disabled":""}>${model.status==="Published"?"已发布":"发布"}</button></td></tr>`}).join("")}</tbody></table></section><div class="review-block" style="margin-top:14px"><h3>ASPICE 使用边界</h3><p>组织裁剪模型必须保留与 PAM BP/GP 的可审计映射。只有正式范围内的 PAM 指标进入评分；自定义问题、Overlay 和关联标准用于补充提问或形成“关联观察—不评级”。</p></div>`;
    }
    if (ui.libraryTab === "guidelines") {
      const rules=[
        ["RATING-001","低于 F 的 BP/GP 必须有弱项或明确的评分理由","Rating consistency","自动"],
        ["EVIDENCE-004","过程文档只能证明定义，必须同时抽样项目执行记录","Evidence sufficiency","自动"],
        ["TRACE-007","追溯关系需验证语义正确性，链接数量不能代替质量判断","Traceability","自动"],
        ["REVIEW-012","评审证据应包含参与者、发现、返工和关闭状态","Review effectiveness","人工/AI"],
        ["CL2-GATE","PA 1.1=F 且 PA 2.1/2.2≥L 才能达到 CL2","Capability gate","强制"]
      ];
      return `<div class="page-head"><div><span class="overline">Trace Assessor Assistant</span><h1 style="font-size:18px">Guideline 与自动质量检查</h1><p>保存评分时自动检查规则，标记 Broken、Suspect、Handled；人工判断仍是最终结论。</p></div><button class="btn primary sm" data-action="new-guideline">${icon("plus")}添加规则</button></div><section class="panel clean"><table class="data-table"><thead><tr><th>ID</th><th>规则</th><th>类型</th><th>评估方式</th><th>状态</th></tr></thead><tbody>${rules.map((r,i)=>`<tr><td><span class="code-tag">${r[0]}</span></td><td><strong style="color:var(--ink)">${r[1]}</strong></td><td>${r[2]}</td><td>${r[3]}</td><td>${badge(i===4?"success":"info",i===4?"强制":"已发布")}</td></tr>`).join("")}</tbody></table></section>`;
    }
    if (ui.libraryTab === "overlays") {
      return `<div class="page-head"><div><span class="overline">Assessor Knowledge</span><h1 style="font-size:18px">Overlay 与 Indicator Annotation</h1><p>将访谈问题、关注点和组织经验附着到 BP/GP；支持个人范围和项目范围。</p></div><button class="btn primary sm" data-action="new-overlay">${icon("plus")}新建 Overlay</button></div><div class="process-grid">${db.overlays.map(o=>`<article class="process-card"><span class="process-code">${o.scope}</span><h3>${esc(o.name)}</h3><p>${esc(o.owner)} · ${o.annotations.length} 个 Indicator Annotation</p><footer><span>${o.annotations.map(a=>a.indicators.join("、")).join(" · ")}</span><button class="btn ghost sm" data-action="edit-overlay" data-id="${o.id}">管理 ${icon("arrow")}</button></footer></article>`).join("")}</div>`;
    }
    if (ui.libraryTab === "templates") {
      return `<div class="page-head"><div><span class="overline">Reusable Findings</span><h1 style="font-size:18px">评估师记录模板</h1><p>把高质量历史记录转化成可复用模板；在 BP/GP 页面按指标、过程域和使用频率智能推荐，证据名称使用工作产品类型占位符。</p></div><button class="btn primary sm" data-action="new-record-template">${icon("plus")}创建模板</button></div><div class="template-suggestion-grid">${db.recordTemplates.map(t=>`<article class="template-suggestion ${t.type}"><header><span class="record-type-mark">${RECORD_TYPES[t.type].code}</span><div><strong>${esc(t.name)}</strong><small>${esc(db.overlays.find(o=>o.id===t.overlayId)?.name||"")} · ${esc(t.evidenceType||"Work Product")} · 使用 ${t.usageCount||0} 次</small></div><button class="action-icon" data-action="edit-record-template" data-id="${t.id}">${icon("edit")}</button></header><p>${esc(t.text)}</p><footer><span>${t.indicators.map(item=>`<span class="code-tag">${esc(item)}</span>`).join(" ")}</span></footer></article>`).join("")}</div>`;
    }
    if (ui.libraryTab === "maps") {
      return `<div class="page-head"><div><span class="overline">Cross-model Intelligence</span><h1 style="font-size:18px">Map Set 与指标关联</h1><p>采用双模型树与中间关系区：支持 Evidence Suggestion、Indicator Overlay 和 Indicator Linking，并能从任一端跳转到映射节点。</p></div><button class="btn primary sm" data-action="new-map-set">${icon("plus")}新建 Map Set</button></div><div class="mapset-editor-preview"><section><header>Model A · ASPICE 4.0</header>${["SYS.3.BP2 分配系统需求","SYS.3.BP3 定义接口","SUP.8.BP4 建立基线","SUP.9.BP5 关闭问题"].map((item,index)=>`<button class="${index===0?"active":""}">${esc(item)}</button>`).join("")}</section><main><header>Node mappings · ${db.mapSets.reduce((sum,item)=>sum+item.maps,0)}</header>${[["SYS.3.BP2","WP.Trace Matrix","evidence"],["SYS.3.BP3","ISO26262-6.7.4","reference"],["SUP.9.BP5","SUP.10.BP4","bidirectional"]].map(item=>`<article><span>${esc(item[0])}</span><i>${icon("arrow")}</i><span>${esc(item[1])}</span><small>${esc(item[2])}</small></article>`).join("")}</main><section><header>Model B · Reference / Work Product</header>${["WP.Trace Matrix","WP.Architecture Description","ISO26262-6.7.4","SUP.10.BP4 Implement change"].map((item,index)=>`<button class="${index===0?"active":""}">${esc(item)}</button>`).join("")}</section></div><section class="panel clean" style="margin-top:14px"><table class="data-table"><thead><tr><th>Map Set</th><th>类型</th><th>映射数</th><th>用途</th><th>状态</th><th></th></tr></thead><tbody>${db.mapSets.map(m=>`<tr><td><strong style="color:var(--ink)">${esc(m.name)}</strong><br><small>${m.id}</small></td><td>${esc(m.type)}</td><td>${m.maps}</td><td>${m.type==="Evidence Suggestion"?"根据工作产品类型定位建议证据":"跨标准显示关联指标并支持联合判断"}</td><td>${badge(m.visible?"success":"neutral",m.visible?"可用于评估":"隐藏")}</td><td><button class="action-icon" data-action="edit-map-set" data-id="${m.id}">${icon("arrow")}</button></td></tr>`).join("")}</tbody></table></section>`;
    }
    if (ui.libraryTab === "elements") {
      return `<div class="page-head"><div><span class="overline">Audit Elements</span><h1 style="font-size:18px">审核要素集</h1><p>版本化维护 195 项审核准则，可发布、克隆和从标准版本派生。</p></div><div class="page-actions"><button class="btn secondary sm" data-action="clone-element-set">${icon("copy")}克隆</button><button class="btn primary sm" data-action="publish-elements">${icon("check")}发布当前版本</button></div></div><section class="panel clean"><table class="data-table"><thead><tr><th>要素集</th><th>标准</th><th>要素数</th><th>维护者</th><th>更新时间</th><th>状态</th><th></th></tr></thead><tbody><tr><td><strong style="color:var(--ink)">ASPICE 4.0 · 中文专业版</strong><br><small>ELEMENT-SET-4.0-ZH-R3</small></td><td>Automotive SPICE 4.0</td><td>195</td><td>审核方法组</td><td>2026-07-20</td><td>${badge("success", "已发布")}</td><td><button class="action-icon" data-action="show-element-detail">${icon("arrow")}</button></td></tr><tr><td><strong style="color:var(--ink)">组织裁剪版 · Level 2</strong><br><small>ELEMENT-SET-ORG-L2</small></td><td>ASPICE 4.0</td><td>132</td><td>Maple Mock</td><td>2026-07-25</td><td>${badge("draft", "草稿")}</td><td><button class="action-icon" data-action="show-element-detail">${icon("arrow")}</button></td></tr></tbody></table></section>`;
    }
    if (ui.libraryTab === "prompts") {
      return `<div class="page-head"><div><span class="overline">AI Methodology</span><h1 style="font-size:18px">提示词与专业约束</h1><p>所有提示词按版本管理，发布后才能用于正式评估。</p></div><button class="btn primary sm" data-action="new-prompt">${icon("plus")}新建提示词</button></div>${[["ASPICE 证据逐项评估", "v3.4 · 生产版", "扮演资深 ASPICE 审核员，严格区分过程定义与项目执行证据…"], ["O/W/R 发现生成", "v2.1 · 生产版", "使用 finding + BP/GP + concrete evidence + risk + closure proof 结构…"], ["管理层摘要", "v1.8 · 草稿", "面向项目负责人总结等级门槛、主要风险与优先关闭路径…"]].map((p,i) => `<div class="setting-section"><div style="display:flex;justify-content:space-between;gap:15px"><div><h2>${p[0]}</h2><p style="margin-bottom:10px">${p[1]}</p></div>${badge(i===2 ? "draft" : "success", i===2 ? "草稿" : "已发布")}</div><div class="review-block"><p>${esc(p[2])}</p></div><div class="page-actions"><button class="btn secondary sm" data-action="preview-prompt">预览组装</button><button class="btn ghost sm" data-action="edit-prompt">编辑版本</button></div></div>`).join("")}`;
    }
    if (ui.libraryTab === "scoring") {
      return `<div class="page-head"><div><span class="overline">Rating Scale</span><h1 style="font-size:18px">八档评分规则</h1><p>细分档位用于 AI 候选与趋势分析，正式能力评级仍映射至 N/P/L/F。</p></div></div><section class="panel clean"><table class="data-table"><thead><tr><th>等级</th><th>中点分数</th><th>标准区间</th><th>专业判断</th><th>结果映射</th></tr></thead><tbody>${RATING_ORDER.map(r => `<tr><td>${badge(ratingClass(r), r)}</td><td><strong style="color:var(--ink)">${RATING_SCORE[r]}</strong></td><td>${r.startsWith("N") ? "0–15%" : r.startsWith("P") ? ">15–50%" : r.startsWith("L") ? ">50–85%" : ">85–100%"}</td><td>${RATING_SCORE[r] < 15 ? "未体现或不可验证" : RATING_SCORE[r] < 50 ? "部分执行，闭环或一致性不足" : RATING_SCORE[r] < 85 ? "大部分实现，存在样本或稳定性缺口" : "系统实施且闭环证据稳定"}</td><td>${r.charAt(0)}</td></tr>`).join("")}</tbody></table></section>`;
    }
    return `<div class="page-head"><div><span class="overline">Report Manager</span><h1 style="font-size:18px">多场景报告模板</h1><p>按 Reporting Situation 管理 Word、PowerPoint 和 Excel 模板，可限定 Global、团队或个人可用范围。</p></div><button class="btn primary sm" data-action="new-report-template">${icon("plus")}上传模板</button></div><section class="panel clean"><table class="data-table"><thead><tr><th>模板</th><th>类型</th><th>分配范围</th><th>输出场景</th><th>状态</th><th></th></tr></thead><tbody>${db.reportTemplates.map((r,i)=>`<tr><td><strong style="color:var(--ink)">${esc(r.name)}</strong><br><small>${r.id}</small></td><td>${esc(r.type)}</td><td>${esc(r.assignment)}</td><td>${i===0?"详细评估与正式报告":i===1?"管理层 Outbriefing":"记录清单、透视图与改进计划"}</td><td>${badge(r.active?"success":"neutral",r.active?"Active":"Disabled")}</td><td><button class="action-icon" data-action="edit-report-template" data-id="${r.id}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></section>`;
  }

  function processCards(items) {
    return items.map(p => `<article class="process-card" data-process-search-text="${esc((p.id + " " + p.zh + " " + p.en).toLowerCase())}" data-action="show-process" data-id="${p.id}"><span class="process-code">${p.id}</span><h3>${esc(p.zh)}</h3><p>${esc(p.en)}</p><footer><span>${p.group} 过程组</span><span>${p.bp} BP ${icon("chevron")}</span></footer></article>`).join("");
  }

  function settingsNav() {
    return `<nav class="settings-nav">${[["account","user","账户与角色"],["ai","sparkles","AI / MCP"],["helix","layout","Helix 表格解析"],["privacy","shield","数据与隐私"]].map(x=>`<button class="${ui.settingsTab===x[0]?"active":""}" data-action="settings-tab" data-tab="${x[0]}">${icon(x[1])}${x[2]}</button>`).join("")}</nav>`;
  }

  function renderSettings() {
    app.innerHTML = `<div class="page">${renderPageHead("Workspace Settings", "账户、AI 与本地解析设置", "管理审核员信息、AI 模型、Helix 表格识别规则和本地数据策略。", "")}<div class="settings-layout">${settingsNav()}<div>${settingsContent()}</div></div></div>`;
  }

  function settingsContent() {
    const s = db.settings;
    if (ui.settingsTab === "account") return `<section class="setting-section"><h2>个人资料</h2><p>用于报告签署、记录创建人和评估日志。</p><div class="form-grid"><div class="form-field"><label>姓名</label><input value="Maple Mock"></div><div class="form-field"><label>角色</label><input value="Lead Assessor"></div><div class="form-field"><label>短名称</label><input value="MM"><small>显示在评估师记录和合并工作区中。</small></div><div class="form-field"><label>邮箱</label><input value="assessor@example.com"></div></div><div class="page-actions" style="margin-top:16px"><button class="btn primary" data-action="save-account">保存资料</button></div></section><section class="setting-section"><h2>评估角色与权限</h2><p>生产环境可接入 OIDC/SSO 和团队权限；本地版展示 Sharpen 风格的职责边界。</p>${[["Lead Assessor","评分 PA、关闭评估、管理参与者和定稿"],["Assessor","创建记录、评分 BP/GP、管理证据，不能关闭评估"],["Data Logger","只管理 Evidence Inventory"],["Guest","只读访问评估数据"]].map(x=>`<div class="switch-line"><div><strong>${x[0]}</strong><p>${x[1]}</p></div>${badge(x[0]==="Lead Assessor"?"success":"neutral",x[0]==="Lead Assessor"?"当前":"可分配")}</div>`).join("")}<div class="switch-line"><div><strong>评估项目</strong><p>${db.standardProjects.length + db.customAudits.length} 个项目</p></div><button class="btn secondary sm" data-action="export-workspace">导出备份</button></div></section>`;
    if (ui.settingsTab === "ai") return `<section class="setting-section"><h2>AI 模型配置</h2><p>支持 OpenAI Responses 兼容接口、企业代理或本地网关。评分内核始终使用固定评估规则，外部模型用于扩展专业意见。</p><form id="aiConfigForm"><div class="switch-line"><div><strong>启用 AI 专业意见</strong><p>关闭后仍可使用本地规则引擎完成评分和报告。</p></div><label class="switch"><input name="aiEnabled" type="checkbox" ${s.aiEnabled?"checked":""}><i></i></label></div><div class="form-grid" style="margin-top:17px"><div class="form-field"><label>运行模式</label><select name="aiMode"><option value="local" ${s.aiMode==="local"?"selected":""}>本地专业规则（推荐演示）</option><option value="provider" ${s.aiMode==="provider"?"selected":""}>OpenAI 兼容接口</option></select></div><div class="form-field"><label>模型</label><input name="model" value="${esc(s.model)}" placeholder="例如 gpt-5.4"></div><div class="form-field full"><label>Base URL</label><input name="baseUrl" value="${esc(s.baseUrl)}" placeholder="https://api.example.com/v1"><small>建议配置为受控企业代理或本机网关，避免浏览器直接持有生产密钥。</small></div><div class="form-field full"><label>API Key</label><input name="apiKey" type="password" value="${esc(s.apiKey)}" placeholder="仅保存在当前浏览器"><small>本静态工作台不会把密钥发送到除上述 Base URL 以外的地址。</small></div></div><div class="page-actions" style="margin-top:16px"><button type="button" class="btn secondary" data-action="test-ai">测试配置</button><button class="btn primary" data-action="save-ai">保存配置</button></div></form></section><section class="setting-section"><h2>Assessor MCP 接口</h2><p>为经授权的 AI 助手暴露只读评估上下文和受控写入工具，可查询范围、指标、证据引用、记录与质量门状态。</p>${[["auditflow.assessment.read","读取评估元数据、实例和当前阶段"],["auditflow.evidence.search","按工作产品类型与 Evidence ID 定位证据"],["auditflow.record.propose","提交记录候选，必须由评估师确认后保存"],["auditflow.quality_gate.check","返回阻塞项，不允许绕过关闭门禁"]].map(x=>`<div class="switch-line"><div><strong>${x[0]}</strong><p>${x[1]}</p></div>${badge("success","受控")}</div>`).join("")}<div class="page-actions" style="margin-top:14px"><button class="btn secondary" data-action="test-mcp">检查 MCP 工具目录</button></div></section><section class="setting-section"><h2>评估护栏</h2><p>以下规则不可被模型输出覆盖。</p>${[["过程范围锁定","仅对用户选择的过程给出正式评分"],["负面证据限分","缺失、非受控、口头说明或不一致证据限制评分"],["PA 硬门槛","能力等级按逐级达成规则判断"],["人工最终责任","AI 只给候选，评估师确认后才写入正式报告"]].map(x=>`<div class="switch-line"><div><strong>${x[0]}</strong><p>${x[1]}</p></div>${badge("success","强制")}</div>`).join("")}</section>`;
    if (ui.settingsTab === "helix") return `<section class="setting-section"><h2>Helix 表格解析</h2><p>AuditFlow 在浏览器本地读取 Helix 导出的 XLSX/XLSM、DOCX、PPTX 或 PDF 表格，不连接外部服务器。</p><form id="helixConfigForm"><div class="switch-line"><div><strong>自动识别 Helix 导出</strong><p>根据 ID、状态、责任、版本/基线、追溯和闭环字段识别对象表。</p></div><label class="switch"><input name="helixAutoDetect" type="checkbox" ${s.helixAutoDetect?"checked":""}><i></i></label></div><div class="switch-line"><div><strong>要求唯一标识字段</strong><p>避免把普通汇总表误判为可审计的 Helix 对象表。</p></div><label class="switch"><input name="helixRequireIdentity" type="checkbox" ${s.helixRequireIdentity?"checked":""}><i></i></label></div><div class="form-grid" style="margin-top:17px"><div class="form-field"><label>每个表格保留的最大行数</label><input name="helixMaxRows" type="number" min="20" max="200" value="${Number(s.helixMaxRows||60)}"><small>完整行数会保留统计，浏览器只保存有限预览以控制项目包大小。</small></div><div class="form-field full"><label>内置字段组</label><div class="check-grid">${HELIX_FIELD_GROUPS.map(([,label,terms])=>`<label><input type="checkbox" checked disabled> ${esc(label)} · ${esc(terms.slice(0,4).join(" / "))}</label>`).join("")}</div></div></div><div class="page-actions" style="margin-top:16px"><button type="button" class="btn secondary" data-action="test-helix-parser">检查解析器</button><button class="btn primary" data-action="save-helix-settings">保存设置</button></div></form></section><section class="setting-section"><h2>证据使用护栏</h2><p>表格被成功读取不等于 BP/GP 已满足。</p>${[["稳定定位","每条引用保留 Sheet/Slide/Page、表格和行号"],["目标过程直接性","只有目标过程字段和对象内容可以作为 direct"],["关联过程隔离","上下游、MAN.3 与 SUP 数据默认只作 corroborating"],["人工最终确认","状态、关系类型、版本和关闭语义由评估师抽样核实"]].map(item=>`<div class="switch-line"><div><strong>${item[0]}</strong><p>${item[1]}</p></div>${badge("success","强制")}</div>`).join("")}</section>`;
    return `<section class="setting-section"><h2>本地数据策略</h2><p>默认所有项目元数据、证据索引、评分和报告版本保存在浏览器 localStorage。</p><div class="switch-line"><div><strong>保留证据文本</strong><p>便于重新评估和生成报告；敏感项目可关闭并只保留文件元数据。</p></div><label class="switch"><input type="checkbox" data-setting="retainEvidenceText" ${s.retainEvidenceText?"checked":""}><i></i></label></div><div class="switch-line"><div><strong>最小化模型传输</strong><p>外部 AI 仅接收当前审核项相关的必要片段。</p></div>${badge("success","已启用")}</div><div class="switch-line"><div><strong>导出工作区备份</strong><p>将当前项目、方案、评分与设置保存为 JSON。</p></div><button class="btn secondary sm" data-action="export-workspace">${icon("download")}导出</button></div><div class="switch-line"><div><strong>恢复演示数据</strong><p>清除当前浏览器中的所有改动并恢复初始状态。</p></div><button class="btn danger sm" data-action="reset-workspace">恢复演示</button></div></section>`;
  }

  function reportRatingMarkup(rating, withScore = true) { return `<span class="report-rating ${ratingClass(rating)}">${esc(rating)}${withScore?` · ${RATING_SCORE[rating]||0}`:""}</span>`; }
  function reportSheet(project, label, body, className = "") { return `<section class="report-sheet ${className}"><div class="report-running-head"><strong>Process Evaluation · Explanations &amp; Findings</strong><span>ID.-No.: ${esc(project.reportNo)}</span></div>${body}<div class="report-running-foot">© ${new Date().getFullYear()} AuditFlow AI · ${esc(label)} <span>AI 初评 + 人工复核</span></div></section>`; }
  function processReportName(processId) { const proc=PROCESS_CATALOG.find(p=>p.id===processId);return proc?`${proc.id} ${proc.en} / ${proc.zh}`:processId; }
  function capabilityChartMarkup(project) { return `<div class="capability-bars">${project.processes.map(processId=>{const level=processCapability(project,processId);return `<div class="capability-bar"><strong>${level}</strong><i style="height:${level?level*42:4}%"></i><span>${esc(processId)}</span></div>`}).join("")}</div>`; }
  function processRiskTable(project) { return `<table class="official-table"><thead><tr><th>Process Area</th><th>Level</th><th>PA1.1</th><th>PA2.1</th><th>PA2.2</th><th>Evidence</th></tr></thead><tbody>${project.processes.map(processId=>{const items=processAssessments(project,processId);const coverage=items.length?Math.round(items.reduce((s,a)=>s+(a.evidenceSufficiency?.coverage||0),0)/items.length):0;return `<tr><td>${esc(processReportName(processId))}</td><td><strong>Level ${processCapability(project,processId)}</strong></td><td>${reportRatingMarkup(processPaRating(project,processId,"PA 1.1"))}</td><td>${reportRatingMarkup(processPaRating(project,processId,"PA 2.1"))}</td><td>${reportRatingMarkup(processPaRating(project,processId,"PA 2.2"))}</td><td>${coverage}%</td></tr>`}).join("")}</tbody></table>`; }
  function assessmentMatrixMarkup(project) {
    const bpCodes=Array.from({length:Math.max(1,...project.processes.map(p=>processAssessments(project,p,"PA 1.1").length))},(_,i)=>`BP${i+1}`);
    const gpCodes=GP_LIBRARY.map(g=>canonicalCode(g[0]));
    const columns=bpCodes.concat(["PA1.1"],gpCodes.slice(0,6),["PA2.1"],gpCodes.slice(6),["PA2.2"]).flat();
    return `<div class="matrix-scroll"><table class="rating-matrix"><thead><tr><th>Process</th>${columns.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${project.processes.map(processId=>`<tr><th>${esc(processId)}</th>${columns.map(code=>{if(code.startsWith("PA"))return `<td>${reportRatingMarkup(processPaRating(project,processId,code.replace(/^PA/,"PA ")),false)}</td>`;const item=processAssessments(project,processId).find(a=>a.code===code);return `<td>${item?reportRatingMarkup(item.rating,false):"–"}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function reportAssessmentEntry(a) {
    const breakdown=Object.entries(a.scoreBreakdown||{}).map(([key,value])=>`${({definition:"定义",implementation:"实施",consistency:"一致性",governance:"受控",closure:"闭环"})[key]||key} ${clampScore(value)}`).join(" · ");
    return `<article class="report-assessment-entry"><h4>${reportRatingMarkup(a.rating,false)} ${esc(a.process)}.${esc(a.code)}: ${esc(a.title)} ${a.reviewed?`<span class="reviewed-mark">人工已复核</span>`:`<span class="draft-mark">待人工复核</span>`}</h4><div class="ai-score-line"><strong>AI 候选 ${esc(a.aiCandidateRating||a.rating)} / 人工结论 ${esc(a.rating)}：</strong>${esc(breakdown)} · 把握度 ${a.confidence}% · ${esc(sufficiencyLabel(a.evidenceSufficiency?.status))} ${a.evidenceSufficiency?.coverage||0}%</div><p>${esc(a.reason)}</p>${(a.findings||[]).map(f=>`<div class="owr-line"><b>${f.type}</b>${esc(f.text)}</div>`).join("")}<div class="evidence-basis"><strong>Evidence basis / 证据依据</strong>${(a.evidenceAnalysis||[]).length?(a.evidenceAnalysis||[]).map(e=>`<div class="report-evidence-row"><b>[${esc(e.evidenceCode)}]</b> ${esc(e.source)} · ${esc(e.locator)} · ${esc(e.strength)}<br><small>${esc(e.originProcess||a.process)} → ${esc(e.targetProcess||a.process)} · ${esc(relationLabel(e.relationType||"direct"))}${e.scopeStatus==="related-only"?" · 关联观察不评级":""}<br>${esc(e.excerpt)}</small></div>`).join(""):`<div class="report-evidence-row">无可定位证据；评分受护栏限制。</div>`}<div><strong>缺口 / 最小关闭证据：</strong>${esc((a.closureEvidence||[]).join("；")||"由评估师补充确认")}</div>${a.reviewerNote?`<div><strong>人工复核意见：</strong>${esc(a.reviewerNote)}</div>`:""}</div></article>`;
  }
  function processDetailedReport(project,processId,index) {
    const bp=processAssessments(project,processId,"PA 1.1");const gp21=processAssessments(project,processId,"PA 2.1");const gp22=processAssessments(project,processId,"PA 2.2");
    return reportSheet(project,`Detailed Results · ${processId}`,`<h2 class="report-section-title">3.${index+1} ${esc(processReportName(processId))} <small>Capability Level ${processCapability(project,processId)}</small></h2><h3>BP Rating Table</h3><table class="bp-rating-table"><tr><th>Result</th>${bp.map(a=>`<th>${esc(a.code)}</th>`).join("")}</tr><tr><td>${reportRatingMarkup(processPaRating(project,processId,"PA 1.1"))}</td>${bp.map(a=>`<td>${reportRatingMarkup(a.rating)}</td>`).join("")}</tr></table><h3>Capability Attribute Rating Table</h3><table class="official-table"><thead><tr><th>PA</th><th>Generic Practices</th><th>Result</th></tr></thead><tbody><tr><td>PA1.1 Process Performance</td><td>BP1–BP${bp.length}</td><td>${reportRatingMarkup(processPaRating(project,processId,"PA 1.1"))}</td></tr><tr><td>PA2.1 Performance Management</td><td>${gp21.map(a=>`${a.code}: ${a.rating}`).join(" · ")}</td><td>${reportRatingMarkup(processPaRating(project,processId,"PA 2.1"))}</td></tr><tr><td>PA2.2 Work Product Management</td><td>${gp22.map(a=>`${a.code}: ${a.rating}`).join(" · ")}</td><td>${reportRatingMarkup(processPaRating(project,processId,"PA 2.2"))}</td></tr></tbody></table><h3>Level 1 Results</h3>${bp.map(reportAssessmentEntry).join("")}<h3>Level 2 Results</h3>${gp21.concat(gp22).map(reportAssessmentEntry).join("")}`,"detail-sheet");
  }
  function crossProcessReportMarkup(project) {
    const method=reportSheet(project,"Cross-Process Analysis Method",`<h2 class="report-section-title">2.4 Cross-Process Analysis / 跨过程分析</h2><p>AI 对每份证据先在本地读取正文、表格和 Helix 对象字段，识别主过程及稳定行定位，再执行四遍关系扫描。范围内过程进入 BP/GP 正式评分；范围外过程仅形成“关联观察·不评级”。关联证据可以证明接口一致性，但不能替代目标过程的直接实施证据。</p><table class="official-table"><thead><tr><th>Pass</th><th>分析问题</th></tr></thead><tbody>${CROSS_PROCESS_PASSES.map((item,index)=>`<tr><td>${index+1}. ${esc(item[1])}</td><td>${esc(item[2])}</td></tr>`).join("")}</tbody></table><div class="report-disclaimer">关系模型重点覆盖需求—设计—实现—验证价值链，以及 MAN.3 项目接口和计划、SUP.1 质量保证、SUP.8 配置完整性、SUP.9 问题闭环、SUP.10 变更影响与双向追溯。Helix 表格按 ID、状态、责任、版本/基线、上下游链接、影响与关闭字段联合判断；仅有链接或 Closed 状态不会自动证明闭环有效。</div>`);
    const details=project.processes.map((processId,index)=>{
      const rows=crossProcessSummary(project,processId);
      return reportSheet(project,`Cross-Process · ${processId}`,`<h2 class="report-section-title">2.4.${index+1} ${esc(processName(processId))} 关系分析</h2><table class="official-table cross-process-report-table"><thead><tr><th>接口</th><th>关系 / 范围</th><th>分析遍次</th><th>证据</th><th>AI 分析过程</th><th>风险与跟进</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.sourceProcess)} → ${esc(row.targetProcess)}</td><td>${esc(relationLabel(row.relationType))}<br><small>${row.scopeStatus==="in-scope"?"正式范围":"关联观察·不评级"}</small></td><td>${row.analysisPasses.map(pass=>esc(CROSS_PROCESS_PASSES.find(item=>item[0]===pass)?.[1]||pass)).join("；")}</td><td>${row.evidenceCodes.map(code=>`[${esc(code)}]`).join(" ")||"未覆盖"}</td><td>${esc(row.supportedClaim)}<br><small>${esc(row.gapOrRisk)}</small></td><td>${esc(row.followUp)}</td></tr>`).join("")}</tbody></table>`);
    }).join("");
    return method+details;
  }
  function traceabilityReportMarkup(project) {
    const coverage=traceCoverage(project);
    return reportSheet(project,"Indicator–Evidence Trace Matrix",`<h2 class="report-section-title">2.5 Indicator–Evidence Trace Matrix / 指标—证据追溯矩阵</h2><p>矩阵记录 AI 推断和评估师人工确认的 BP/GP—证据关系。Direct 只表示证据属于目标过程且存在可定位正文或表格；Corroborating 仅用于核实上下游接口、MAN.3、SUP.1、SUP.8、SUP.9 或 SUP.10 的一致性与闭环，不替代目标过程实施证据。</p><div class="report-risk-grid"><div><span>指标有关系</span><strong>${coverage.linked}/${coverage.total}</strong></div><div><span>直接覆盖</span><strong>${coverage.directPercent}%</strong></div><div><span>人工确认</span><strong>${coverage.confirmed}</strong></div><div><span>无关系缺口</span><strong>${coverage.gaps}</strong></div></div><table class="official-table trace-report-matrix"><thead><tr><th>Indicator</th><th>AI / Human rating</th><th>Direct evidence</th><th>Corroborating / related</th><th>Assessor-confirmed</th><th>Gap, risk &amp; next evidence</th></tr></thead><tbody>${project.assessments.map(assessment=>{const links=traceLinksForAssessment(project,assessment);const direct=links.filter(link=>link.strength==="direct");const related=links.filter(link=>link.strength!=="direct");const confirmed=links.filter(link=>link.confirmed);const cite=items=>items.map(link=>`<b>[${esc(link.evidenceCode||"EV")}]</b> ${esc(link.locator||"待定位")}`).join("<br>")||"—";return `<tr><td><strong>${esc(indicatorKey(assessment))}</strong><br><small>${esc(assessment.title)}</small></td><td>${reportRatingMarkup(assessment.aiCandidateRating||assessment.rating,false)} / ${reportRatingMarkup(assessment.rating,false)}<br><small>${assessment.reviewed?"人工已复核":"待人工复核"}</small></td><td>${cite(direct)}</td><td>${cite(related)}</td><td>${confirmed.length?confirmed.map(link=>`[${esc(link.evidenceCode||"EV")}] ${esc(link.creator||"Assessor")}`).join("<br>"):"—"}</td><td>${esc((assessment.evidenceSufficiency?.missingTypes||[]).join("；")||(assessment.closureEvidence||[]).slice(0,2).join("；")||"需确认代表性与跨版本稳定性")}</td></tr>`}).join("")}</tbody></table><div class="report-disclaimer">AI 分析过程：证据解析 → 主过程识别 → BP/GP 适配 → direct / corroborating / index-only 分类 → 上下游与治理支撑过程四遍扫描 → 证据充分性限分 → 评估师确认关系和最终评分。人工确认关系不会自动提高评分，也不会把范围外过程纳入正式评级。</div>`);
  }
  function formalReportMarkup(project) {
    refreshProjectOutcome(project);
    const quality=assessmentQuality(project);const final=project.importSource?project.status==="complete":project.assessmentState==="Closed"&&quality.ready;const weak=project.assessments.filter(a=>RATING_SCORE[a.rating]<50);const reviewed=Math.round(project.assessments.filter(a=>a.reviewed).length/Math.max(1,project.assessments.length)*100);
    const cover=reportSheet(project,"Cover",`<div class="report-status-stamp ${final?"final":""}">${final?"FINAL / 已定稿":"CONTROLLED DRAFT / 受控草稿"}</div><p class="report-blue-label">Automotive SPICE Process Assessment</p><h1 class="report-title">${esc(project.organization)}<br>过程评估报告</h1><p class="report-subtitle">${esc(project.name)} · ${esc(project.product)}</p><table class="official-table report-cover-table"><tbody>${[["Company",project.organization,"Project",project.name],["Product",project.product,"PAM Version",project.pam],["Target / Achieved Level",`${project.targetLevel} / ${project.achievedLevel}`,"Assessment Date",formatDate(project.date)],["Report No.",project.reportNo,"Class / Type / Category",`${project.attributes?.assessmentClass||"Class 2"} / Process Assessment / AI 辅助评估`],["Lead Assessor",project.owner,"Assessors",(project.participants||[]).map(p=>p.name).join("、")||project.owner]].map(row=>`<tr>${row.map((cell,i)=>`<${i%2===0?"th":"td"}>${esc(cell)}</${i%2===0?"th":"td"}>`).join("")}</tr>`).join("")}</tbody></table><h2>Assessment Scope and Capability Level</h2>${capabilityChartMarkup(project)}<div class="report-signatures"><div>Lead Assessor</div><div>Project Representative</div><div>Quality Representative</div></div>`,`cover-sheet`);
    const contents=reportSheet(project,"Contents / Background",`<h2 class="report-section-title">Contents</h2><table class="toc-table"><tr><td>1</td><td>Background</td></tr><tr><td>2</td><td>Summary</td></tr><tr><td>2.1</td><td>Management Summary</td></tr><tr><td>2.2</td><td>Assumptions &amp; Constraints</td></tr><tr><td>2.3</td><td>Risk Dashboard</td></tr><tr><td>2.4</td><td>Cross-Process Analysis Method &amp; Results</td></tr><tr><td>2.5</td><td>Indicator–Evidence Trace Matrix</td></tr><tr><td>3</td><td>Detailed Results</td></tr>${project.processes.map((p,i)=>`<tr><td>3.${i+1}</td><td>${esc(processReportName(p))}</td></tr>`).join("")}<tr><td>4</td><td>Assessed Work Products</td></tr><tr><td>5</td><td>Findings &amp; Improvement Roadmap</td></tr><tr><td>6</td><td>Final Remark</td></tr></table><h2 class="report-section-title">1. Background</h2><table class="official-table"><tbody>${[["Assessment Date",formatDate(project.date)],["Company",project.organization],["Project / Product",`${project.name} / ${project.product}`],["Assessment Team",(project.participants||[]).map(p=>`${p.name}（${p.role}）`).join("、")],["PAM Version",project.pam],["Assessment Class",project.attributes?.assessmentClass||"Class 2"],["Target / Achieved Level",`${project.targetLevel} / ${project.achievedLevel}`],["Formal Assessment Scope",project.processes.map(processReportName).join("、")],["Related Context","上游、下游、MAN.3、SUP.1、SUP.8、SUP.9、SUP.10（范围外不评级）"],["Objective","评估所选过程在 Automotive SPICE 下的过程能力，并沿过程接口识别风险、证据缺口与最小改进闭环。"]].map(row=>`<tr><th>${esc(row[0])}</th><td>${esc(row[1])}</td></tr>`).join("")}</tbody></table>`);
    const summary=reportSheet(project,"Summary",`<h2 class="report-section-title">2. Summary</h2>${project.importSource?`<div class="report-disclaimer"><strong>Imported professional assessment:</strong> ${esc(project.importSource.sourceFile)} · ${esc(project.importSource.reportVersion)} · ${esc(project.importSource.assessmentPeriod)}. Progress 100% means the assessment activity and import are complete; it does not mean all ASPICE processes achieved the target capability level.</div>`:""}<h3>2.1 Management Summary</h3><p>${esc(buildExecutiveOpinion(project))}</p><div class="report-risk-grid"><div><span>Achieved Level</span><strong>${esc(project.achievedLevel)}</strong></div><div><span>Weakness candidate</span><strong>${weak.length}</strong></div><div><span>Evidence coverage</span><strong>${quality.coverage}%</strong></div><div><span>Human review</span><strong>${reviewed}%</strong></div></div><h3>2.2 Assumptions &amp; Constraints</h3><ul><li>AI 仅基于当前登记且与过程范围关联的证据生成候选结论。</li><li>仅文件名或元数据命中的证据不会被当作项目实施的直接证明。</li><li>未复核、证据不足或记录未定稿的条目不会通过关闭质量门禁。</li></ul><h3>2.3 Risk Dashboard</h3>${processRiskTable(project)}`);
    const crossProcess=crossProcessReportMarkup(project);
    const traceability=traceabilityReportMarkup(project);
    const matrix=reportSheet(project,"BP / PA / GP Matrix",`<h2 class="report-section-title">BP / PA / GP 评级矩阵</h2>${assessmentMatrixMarkup(project)}<div class="rating-legend report-legend">${RATING_ORDER.map(r=>`<div>${reportRatingMarkup(r)}</div>`).join("")}</div>`);
    const details=project.processes.map((processId,index)=>processDetailedReport(project,processId,index)).join("");
    const workProducts=reportSheet(project,"Work Products / Final Remark",`<h2 class="report-section-title">4. Assessed Work Products</h2><table class="official-table"><thead><tr><th>No.</th><th>ID</th><th>Primary Process</th><th>Related Context</th><th>Name / Structure</th><th>Helix Table Readout</th><th>Reference quality</th></tr></thead><tbody>${project.evidence.map((e,index)=>{const primary=inferEvidencePrimaryProcesses(e,project.processes);const related=[...new Set(primary.flatMap(processId=>relatedProcessesFor(processId,project.processes).map(row=>row.relatedProcess)))];const locatable=String(e.content||"").trim().length>=120||(e.tables||[]).some(table=>table.rowCount);return `<tr><td>${index+1}</td><td>${esc(e.code||`EV.${String(index+1).padStart(3,"0")}`)}</td><td>${esc(primary.join("、")||e.scope||"未识别")}</td><td>${esc(related.join("、")||"—")}</td><td>${esc(e.name)}<br><small>${esc(e.structure||e.source||"本地上传")}</small></td><td>${e.helix?.detected?`${e.helix.tableCount} 表 / ${e.helix.rowCount} 行 / ${e.helix.linkedRows} 关系行<br><small>${esc((e.helix.fields||[]).join("、"))}</small>`:"—"}</td><td>${locatable?"Locatable text/table / 可定位正文或表格":"Metadata only / 待定位"}</td></tr>`;}).join("")}</tbody></table><h2 class="report-section-title">5. Findings &amp; Improvement Roadmap</h2><table class="official-table"><thead><tr><th>Priority</th><th>Indicator</th><th>Weakness / Risk</th><th>Minimum closure evidence</th><th>Owner / Due</th></tr></thead><tbody>${project.assessments.filter(a=>(a.findings||[]).some(f=>f.type==="W")).slice(0,30).map((a,index)=>`<tr><td>${index<5?"P1":"P2"}</td><td>${esc(indicatorKey(a))}</td><td>${esc(a.findings.find(f=>f.type==="W")?.text||a.reason)}</td><td>${esc((a.closureEvidence||[]).join("；"))}</td><td>待分配</td></tr>`).join("")||`<tr><td colspan="5">当前没有弱项候选。</td></tr>`}</tbody></table><h2 class="report-section-title">6. Final Remark</h2><div class="report-disclaimer">本报告由 AuditFlow AI 生成，逐项评级包含 AI 初评、本地 Office/PDF 与 Helix 表格解析、直接证据充分性护栏、跨过程四遍分析和人工复核状态，供内部过程改进与能力提升参考。范围外关联过程只形成观察，不构成正式评级；跨过程证据不能替代目标过程直接证据。若需作为正式评估或认证结论，应由具备适用资质、权限与独立性的评估师基于完整证据复核确认。${final?"当前版本已通过本工具的内部质量门禁。":"当前版本仍为受控草稿，存在未复核或证据充分性缺口。"}</div>`);
    return cover+contents+summary+crossProcess+traceability+matrix+details+workProducts;
  }
  function renderReport(project) {
    if (!project) return renderNotFound();
    refreshProjectOutcome(project);const quality=assessmentQuality(project);
    app.innerHTML = `<div class="page">${renderPageHead("Formal Audit Report", "Automotive SPICE 过程评估报告", `${project.reportNo} · ${project.importSource?"专业评估报告已导入":quality.ready?"报告门禁通过":"受控草稿，仍有证据/复核缺口"}`, `<button class="btn secondary" data-action="open-standard-project" data-id="${project.id}">返回项目</button><button class="btn secondary" data-action="export-word-standard" data-id="${project.id}">${icon("download")}导出 Word</button><button class="btn primary" data-action="print-report">${icon("download")}导出 PDF</button>`)}<article class="report-page official-report" id="formalReport">${formalReportMarkup(project)}</article></div>`;
  }

  function renderNotFound() { app.innerHTML = `<div class="page"><div class="empty-state"><div><span>${icon("alert")}</span><h2>未找到该内容</h2><p>目标可能已被删除或链接已失效。</p><a class="btn primary" href="#/dashboard">返回总览</a></div></div></div>`; }

  function parseRoute() { return (location.hash.replace(/^#\/?/, "") || "dashboard").split("/").filter(Boolean); }
  function render() {
    const route = parseRoute();
    const root = route[0] || "dashboard";
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === root));
    const crumbs = ["工作台"];
    if (root === "dashboard") crumbs.push("审核总览");
    if (root === "standard") crumbs.push("ASPICE 评估");
    if (root === "custom") crumbs.push("自定义审核");
    if (root === "library") crumbs.push("标准知识库");
    if (root === "settings") crumbs.push("设置");
    if (route.length > 1) crumbs.push(route.at(-1));
    document.getElementById("breadcrumbs").innerHTML = crumbs.map((x,i)=> i===crumbs.length-1 ? `<strong>${esc(x)}</strong>` : `<span>${esc(x)}</span><i>/</i>`).join("");
    if (root === "dashboard") renderDashboard();
    else if (root === "standard" && route[1] === "report") renderReport(db.standardProjects.find(p=>p.id===route[2]));
    else if (root === "standard" && route[1]) renderStandardProject(db.standardProjects.find(p=>p.id===route[1]));
    else if (root === "standard") renderStandardList();
    else if (root === "custom" && route[1] === "scheme") renderScheme(db.customSchemes.find(s=>s.id===route[2]));
    else if (root === "custom" && route[1] === "audit") renderCustomAudit(db.customAudits.find(a=>a.id===route[2]));
    else if (root === "custom") renderCustomHome();
    else if (root === "library") renderLibrary();
    else if (root === "settings") renderSettings();
    else renderNotFound();
    injectIcons(app);
    if(ui.pendingRecordId&&root==="standard"&&route[1]){const project=db.standardProjects.find(item=>item.id===route[1]);const record=project?.records.find(item=>item.id===ui.pendingRecordId);ui.pendingRecordId="";if(project&&record)setTimeout(()=>recordModal(project,record),0);}
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function newStandardModal() {
    const processOptions = PROCESS_CATALOG.map(p => `<label class="switch-line" style="padding:7px 0"><span><strong>${p.id} · ${p.zh}</strong><p>${p.en}</p></span><input type="checkbox" name="processes" value="${p.id}" style="width:16px;height:16px"></label>`).join("");
    openModal({ title: "新建 ASPICE 评估项目", wide: true, body: `<form id="newStandardForm"><div class="form-grid"><div class="form-field full"><label>项目名称 *</label><input name="name" required placeholder="例如：域控制器系统架构内审"></div><div class="form-field"><label>受评组织 *</label><input name="organization" required placeholder="部门、供应商或项目团队"></div><div class="form-field"><label>产品 / 项目 *</label><input name="product" required placeholder="产品或项目名称"></div><div class="form-field"><label>标准版本</label><select name="pam"><option>Automotive SPICE 4.0</option><option>Automotive SPICE 3.1</option></select></div><div class="form-field"><label>目标能力等级</label><select name="targetLevel"><option>Level 2</option><option>Level 1</option><option>Level 3</option></select></div><div class="form-field"><label>评估类别</label><select name="assessmentClass"><option>Class 2</option><option>Class 3</option><option>Internal Check</option></select></div><div class="form-field"><label>评估目的</label><select name="purpose"><option>Process Improvement</option><option>Supplier Selection</option><option>Risk Monitoring</option></select></div><div class="form-field full"><label>评估范围（至少选择一个）</label><div style="max-height:280px;overflow:auto;padding:4px 12px;border:1px solid var(--line);border-radius:9px;display:grid;grid-template-columns:1fr 1fr;column-gap:22px">${processOptions}</div></div></div></form>`, footer: `<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="create-standard">创建项目</button>` });
  }

  function newSchemeModal() {
    openModal({ title: "新建自定义审核方案", body: `<form id="newSchemeForm"><div class="form-grid"><div class="form-field full"><label>方案名称 *</label><input name="name" required placeholder="例如：供应商月度质量审核"></div><div class="form-field full"><label>方案说明</label><textarea name="description" placeholder="说明使用场景、范围和审核目标"></textarea></div><div class="form-field full"><label>报告标题</label><input name="reportTitle" placeholder="供应商月度质量审核报告"></div><div class="form-field full"><label>分类（用顿号或逗号分隔）</label><input name="categories" placeholder="管理、过程、交付、改进"></div></div></form>`, footer: `<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="create-scheme">创建方案</button>` });
  }

  function newCustomAuditModal() {
    openModal({ title: "发起自定义审核", body: `<form id="newCustomAuditForm"><div class="form-grid"><div class="form-field full"><label>审核任务名称 *</label><input name="name" required></div><div class="form-field full"><label>选择审核方案 *</label><select name="schemeId">${db.customSchemes.map(s=>`<option value="${s.id}">${esc(s.name)}（${s.questions.length} 项）</option>`).join("")}</select></div><div class="form-field"><label>受审对象 *</label><input name="organization" required placeholder="团队、供应商或项目"></div><div class="form-field"><label>审核负责人</label><input name="owner" value="Maple Mock"></div><div class="form-field full"><div class="review-block"><h3>下一步：上传本地证据包</h3><p>创建任务后可上传 Helix XLSX/XLSM、Office、PDF 或文本证据。所有表格解析在浏览器本地完成。</p></div></div></div></form>`, footer: `<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="create-custom-audit">创建任务</button>` });
  }

  function questionModal(schemeId, question) {
    const scheme = db.customSchemes.find(s=>s.id===schemeId);
    openModal({ title: question ? "编辑审核问题" : "添加审核问题", body: `<form id="questionForm" data-scheme="${schemeId}" data-id="${question?.id || ""}"><div class="form-grid"><div class="form-field"><label>分类</label><select name="category">${scheme.categories.map(c=>`<option ${c===question?.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div><div class="form-field full"><label>审核问题 *</label><textarea name="text" required>${esc(question?.text || "")}</textarea></div><div class="form-field full"><label>判断参考 / 条款</label><textarea name="reference" placeholder="标准条款、期望证据或判断准则">${esc(question?.reference || "")}</textarea></div></div></form>`, footer: `<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-question">保存问题</button>` });
  }

  function pasteQuestionsModal(schemeId) {
    openModal({ title: "批量粘贴审核问题", body: `<form id="pasteQuestionsForm" data-scheme="${schemeId}"><div class="form-field"><label>每行一个问题</label><textarea name="questions" style="min-height:240px" placeholder="是否已建立…？&#10;是否能够提供…？&#10;抽样记录是否证明…？"></textarea><small>导入后可逐项编辑分类和判断参考。</small></div></form>`, footer: `<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-pasted-questions">导入问题</button>` });
  }

  function evidenceScopeOptions(type,projectId) {
    const project=getContainer(type,projectId);const processes=project?.processes||[];
    return `<option value="全部审核项">全部正式范围</option>${processes.map(processId=>`<option value="${esc(processId)}">${esc(processName(processId))}</option>`).join("")}<option value="MAN.3">MAN.3 项目管理（关联过程）</option><option value="SUP.8">SUP.8 配置管理（关联过程）</option><option value="SUP.9">SUP.9 问题解决（关联过程）</option><option value="SUP.10">SUP.10 变更请求（关联过程）</option>`;
  }
  function textEvidenceModal(type, projectId) {
    openModal({ title: "粘贴文本证据", body: `<form id="textEvidenceForm" data-type="${type}" data-project="${projectId}"><div class="form-grid"><div class="form-field full"><label>证据名称 *</label><input name="name" required placeholder="例如：项目访谈纪要 2026-07-26"></div><div class="form-field"><label>主过程 / 作用域</label><select name="scope">${evidenceScopeOptions(type,projectId)}</select><small>AI 会自动扩展上下游和支撑过程，不会扩大正式评级范围。</small></div><div class="form-field full"><label>证据正文 *</label><textarea name="content" required style="min-height:230px" placeholder="粘贴受控记录、会议纪要、工作项导出或其他可验证文本…"></textarea><small>正式评分仍应核实原始记录的版本、授权和配置状态。</small></div></div></form>`, footer: `<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-text-evidence">加入证据</button>` });
  }

  function assessmentMetaModal(project) {
    const a=project.attributes;
    openModal({title:"编辑评估信息与属性",wide:true,body:`<form id="assessmentMetaForm" data-project="${project.id}"><div class="form-grid"><div class="form-field"><label>评估类别</label><select name="assessmentClass">${["Class 2","Class 3","Internal Check"].map(x=>`<option ${x===a.assessmentClass?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-field"><label>目的</label><select name="purpose">${["Process Improvement","Supplier Selection","Risk Monitoring"].map(x=>`<option ${x===a.purpose?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-field"><label>独立性</label><select name="independence">${["Category A","Category B","Category C"].map(x=>`<option ${x===a.independence?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-field"><label>ASIL</label><select name="asil">${["QM","ASIL A","ASIL B","ASIL C","ASIL D"].map(x=>`<option ${x===a.asil?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-field"><label>过程上下文</label><input name="processContext" value="${esc(a.processContext)}"></div><div class="form-field"><label>供应链位置</label><input name="supplyChain" value="${esc(a.supplyChain)}"></div><div class="form-field full"><label>适用标准（逗号分隔）</label><input name="standards" value="${esc((a.standards||[]).join(", "))}" placeholder="ISO 26262:2018, ISO/SAE 21434"></div></div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-assessment-meta">保存</button>`});
  }

  function participantModal(project) {
    openModal({title:"添加评估参与者",body:`<form id="participantForm" data-project="${project.id}"><div class="form-grid"><div class="form-field full"><label>姓名 / 访谈组 *</label><input name="name" required></div><div class="form-field"><label>短名称</label><input name="short" maxlength="4" placeholder="MM"></div><div class="form-field"><label>角色</label><select name="role"><option>Assessor</option><option>Lead Assessor</option><option>Data Logger</option><option>Interviewee Group</option><option>Guest</option></select></div><div class="form-field full"><label>邮箱</label><input name="email" type="email"></div></div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-participant">添加</button>`});
  }

  function workspaceModal(project) {
    openModal({title:"创建评估工作区",body:`<form id="workspaceForm" data-project="${project.id}"><div class="form-grid"><div class="form-field full"><label>工作区名称 *</label><input name="name" required placeholder="协同评估师工作区"></div><div class="form-field full"><label>说明</label><textarea name="description" placeholder="独立现场记录或专题复核"></textarea></div></div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-workspace">创建</button>`});
  }

  function instanceModal(project) {
    openModal({title:"添加过程实例",wide:true,body:`<form id="instanceForm" data-project="${project.id}"><div class="form-grid"><div class="form-field"><label>实例名称 *</label><input name="name" required placeholder="平台软件团队"></div><div class="form-field"><label>短名称</label><input name="short" maxlength="8" placeholder="PLAT"></div><div class="form-field full"><label>适用过程</label><div class="check-grid">${project.processes.map(p=>`<label><input type="checkbox" name="processes" value="${p}" checked> ${p} · ${esc(PROCESS_CATALOG.find(x=>x.id===p)?.zh||p)}</label>`).join("")}</div></div></div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-instance">添加实例</button>`});
  }

  function sessionModal(project, type="Interview") {
    openModal({title:type==="Interview"?"添加访谈":"插入日程活动",body:`<form id="sessionForm" data-project="${project.id}"><input type="hidden" name="type" value="${type}"><div class="form-grid"><div class="form-field"><label>日期</label><input name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="form-field"><label>开始时间</label><input name="start" type="time" value="09:00"></div><div class="form-field"><label>时长（分钟）</label><input name="duration" type="number" min="5" step="5" value="${type==="Interview"?60:15}"></div>${type==="Interview"?`<div class="form-field"><label>过程</label><select name="process">${project.processes.map(p=>`<option>${p}</option>`).join("")}</select></div><div class="form-field full"><label>过程实例</label><select name="instanceId">${project.instances.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></div><div class="form-field full"><label>访谈对象（顿号或逗号分隔）</label><input name="interviewees" placeholder="系统架构负责人、配置管理员"></div>`:`<div class="form-field"><label>活动类型</label><select name="activityType"><option>Break</option><option>Consolidation</option><option>Opening Meeting</option><option>Closing Meeting</option></select></div>`}</div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-session">加入日程</button>`});
  }

  function recordModal(project, record, indicator="", template=null) {
    pendingRecordAttachments.clear();
    const value=record||{type:template?.type||"comment",text:template?.text||"",indicators:template?.indicators?.length?[...template.indicators]:indicator?[indicator]:[],evidenceIds:[],workspaceId:project.activeWorkspaceId,instanceId:project.activeInstanceId,presentation:false,general:false,closureState:template?.type==="weakness"?"待处理":"不适用",attachments:[]};
    openDrawer({title:record?`编辑记录 · ${record.id}`:"创建评估师记录",body:`<form id="recordForm" data-project="${project.id}" data-id="${record?.id||""}"><div class="form-grid"><div class="form-field"><label>记录类型</label><select name="type">${Object.entries(RECORD_TYPES).map(([k,v])=>`<option value="${k}" ${value.type===k?"selected":""}>${v.code} · ${v.label}</option>`).join("")}</select></div><div class="form-field"><label>工作区</label><select name="workspaceId">${project.workspaces.map(w=>`<option value="${w.id}" ${value.workspaceId===w.id?"selected":""}>${esc(w.name)}</option>`).join("")}</select></div><div class="form-field"><label>整改关闭状态</label><select name="closureState">${["不适用","待处理","措施实施中","验证中","已关闭"].map(state=>`<option ${state===(value.closureState||"不适用")?"selected":""}>${state}</option>`).join("")}</select></div><div class="form-field full"><label>描述 *</label><textarea name="text" required style="min-height:150px">${esc(value.text)}</textarea><small>建议包含事实、风险及最小关闭证据；支持 Markdown 风格文本。</small></div><div class="form-field full"><label>关联指标（逗号分隔）</label><input name="indicators" value="${esc((value.indicators||[]).join(", "))}"></div><div class="form-field"><label>过程实例</label><select name="instanceId">${project.instances.map(i=>`<option value="${i.id}" ${value.instanceId===i.id?"selected":""}>${esc(i.name)}</option>`).join("")}</select></div><div class="form-field"><label>快捷模板</label><select data-record-template><option value="">不使用模板</option>${db.recordTemplates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div><div class="form-field full"><label>证据引用</label><div class="check-grid">${project.evidence.map(e=>`<label><input type="checkbox" name="evidenceIds" value="${e.id}" ${(value.evidenceIds||[]).includes(e.id)?"checked":""}> [${esc(e.code||e.id)}] ${esc(e.name)}</label>`).join("")||"<small>尚无证据，请先到 Evidence Inventory 登记。</small>"}</div></div><div class="form-field full record-attachment-field"><div class="attachment-field-head"><div><label>附件</label><small>支持多张图片或文件；每个文件必须小于 2 MiB。</small></div><button type="button" class="btn secondary sm" data-action="pick-record-attachments">${icon("plus")}添加附件</button></div><input type="file" id="recordAttachmentPicker" hidden multiple><div class="record-attachment-list" id="recordAttachmentList">${(value.attachments||[]).map(item=>attachmentMarkup(item)).join("")||`<div class="attachment-empty">尚无附件</div>`}</div></div><label class="switch-line"><span><strong>用于汇报</strong><p>在管理层 Outbriefing 中突出显示</p></span><input type="checkbox" name="presentation" ${value.presentation?"checked":""}></label><label class="switch-line"><span><strong>通用记录</strong><p>不限定单一指标</p></span><input type="checkbox" name="general" ${value.general?"checked":""}></label></div></form>`,footer:`${record?`<button class="btn danger" data-action="delete-record" data-project="${project.id}" data-id="${record.id}">删除</button><button class="btn secondary" data-action="create-record-template" data-project="${project.id}" data-id="${record.id}">存为模板</button>`:""}<span class="toolbar-spacer"></span><button class="btn secondary" data-action="close-drawer">取消</button><button class="btn primary" data-action="save-record">保存记录</button>`});
    hydrateAttachmentImages();
  }
  function findingTemplateModal(project,indicator) {
    const templates=suggestedFindingTemplates(indicator);const assessment=project.assessments.find(item=>indicatorKey(item)===indicator);
    openModal({title:`Finding Template · ${indicator}`,wide:true,body:`<div class="insight-card"><div class="insight-head"><span>${icon("copy")}</span><strong>按指标、过程域和历史使用频率推荐</strong></div><p>模板只提供标准化表述骨架。使用后必须补充当前项目事实、具体证据定位、风险和最小关闭证据。</p></div><div class="template-suggestion-grid">${templates.map((template,index)=>`<article class="template-suggestion ${template.type}"><header><span class="record-type-mark">${RECORD_TYPES[template.type]?.code||"C"}</span><div><strong>${esc(template.name)}</strong><small>${esc(template.evidenceType||"Work Product")} · 使用 ${template.usageCount||0} 次</small></div>${index===0?badge("success","Best match"):""}</header><p>${esc(template.text)}</p><footer><span>${(template.indicators||[]).map(item=>`<span class="code-tag">${esc(item)}</span>`).join(" ")}</span><button class="btn primary sm" data-action="apply-finding-template" data-project="${project.id}" data-indicator="${esc(indicator)}" data-template="${template.id}">使用模板</button></footer></article>`).join("")||`<div class="empty-mini">没有匹配模板，可从高质量历史 Finding 创建。</div>`}</div>${assessment?`<div class="review-block"><h3>当前指标 AI 提示</h3><p>${esc(assessment.findings?.find(item=>item.type==="W")?.text||assessment.reason)}</p></div>`:""}`,footer:`<button class="btn secondary" data-action="close-modal">关闭</button>`});
  }

  function localTraceAiMarkup(project,assessment=null) {
    const coverage=traceCoverage(project);const quality=assessmentQuality(project);
    if(assessment){const links=traceLinksForAssessment(project,assessment);const direct=links.filter(link=>link.strength==="direct");const corroborating=links.filter(link=>link.strength==="corroborating");const gaps=(assessment.evidenceSufficiency?.missingTypes||[]).slice(0,4);return `<div class="ai-opinion-hero"><span>${icon("sparkles")}</span><div><strong>${esc(indicatorKey(assessment))} · AI 候选 ${esc(assessment.aiCandidateRating||assessment.rating)}</strong><p>这是候选评估意见，需评估师结合访谈与原始证据确认。</p></div></div><div class="ai-opinion-grid"><article><span>直接证据</span><strong>${direct.length}</strong><small>目标过程且可定位</small></article><article><span>关联佐证</span><strong>${corroborating.length}</strong><small>不能替代直接实施证据</small></article><article><span>把握度</span><strong>${assessment.confidence||0}%</strong><small>${esc(sufficiencyLabel(assessment.evidenceSufficiency?.status))}</small></article><article><span>人工状态</span><strong>${assessment.reviewed?"已复核":"待复核"}</strong><small>正式结论由评估师决定</small></article></div><div class="review-block"><h3>专业意见</h3><p>${esc(assessment.reason)}</p></div><div class="review-grid"><div class="review-block"><h3>建议追问</h3><ul>${(assessment.interviewQuestions||[]).map(item=>`<li>${esc(item)}</li>`).join("")}</ul></div><div class="review-block"><h3>最小关闭证据</h3><ul>${(assessment.closureEvidence||gaps).map(item=>`<li>${esc(item)}</li>`).join("")}</ul></div></div>`;}
    const priority=project.assessments.filter(item=>!item.reviewed||item.evidenceSufficiency?.status!=="sufficient").sort((a,b)=>(a.evidenceSufficiency?.coverage||0)-(b.evidenceSufficiency?.coverage||0)).slice(0,6);
    return `<div class="ai-opinion-hero"><span>${icon("sparkles")}</span><div><strong>全项目追溯与评估准备度</strong><p>覆盖 ${coverage.linked}/${coverage.total} 个指标，直接证据覆盖 ${coverage.directPercent}%，当前 ${quality.unreviewed} 项待人工复核。</p></div></div><div class="ai-opinion-grid"><article><span>关系覆盖</span><strong>${coverage.linkedPercent}%</strong><small>${coverage.gaps} 项仍无证据链</small></article><article><span>人工确认</span><strong>${coverage.confirmed}</strong><small>指标—证据关系</small></article><article><span>证据覆盖</span><strong>${quality.coverage}%</strong><small>按 BP/GP 证据充分性</small></article><article><span>Helix 阻塞</span><strong>${coverage.blocked}</strong><small>需验证关闭有效性</small></article></div><div class="review-block"><h3>优先审核队列</h3>${priority.map(item=>`<p><strong>${esc(indicatorKey(item))}</strong> · ${esc(item.aiCandidateRating||item.rating)} · ${esc(sufficiencyLabel(item.evidenceSufficiency?.status))}<br><small>${esc(item.evidenceSufficiency?.missingTypes?.slice(0,2).join("、")||"需核实跨版本代表性")}</small></p>`).join("")||"<p>当前没有优先缺口。</p>"}</div>`;
  }

  async function showTraceAiOpinion(project,assessment=null) {
    setAIStatus(true,"AI 评估意见生成中");let providerText="";
    if(db.settings.aiEnabled&&db.settings.aiMode==="provider"){
      try{const prompt=`你是一名 Automotive SPICE 4.0 主任评估师。请针对以下${assessment?"单个 BP/GP":"项目追溯矩阵"}给出简洁、可执行、可复核的中文意见。必须区分 direct、corroborating、index-only；范围外过程不评级；说明证据、关系、未证明事项、评分影响、访谈问题和最小关闭证据。\n${JSON.stringify({project:{id:project.id,scope:project.processes,targetLevel:project.targetLevel},coverage:traceCoverage(project),assessment:assessment?{indicator:indicatorKey(assessment),criterion:assessment.criterion,rating:assessment.rating,aiCandidate:assessment.aiCandidateRating,evidence:assessment.evidenceAnalysis,crossProcess:assessment.crossProcessAnalysis,missing:assessment.evidenceSufficiency?.missingTypes}:null})}`;const response=await fetch("/api/ai/opinion",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({baseUrl:db.settings.baseUrl,model:db.settings.model,apiKey:db.settings.apiKey,prompt})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"模型调用失败");providerText=String(payload.output||"");}catch(error){providerText=`外部模型暂不可用：${error.message}。以下仍展示本地专业规则意见。`;}}
    setAIStatus(false);openModal({title:assessment?`AI 评估师意见 · ${indicatorKey(assessment)}`:"AI 全项目追溯检查",wide:true,body:`${providerText?`<div class="provider-opinion"><strong>模型补充意见</strong><p>${esc(providerText)}</p></div>`:""}${localTraceAiMarkup(project,assessment)}`,footer:`${assessment?`<button class="btn secondary" data-action="ai-create-record" data-project="${project.id}" data-assessment="${assessment.id}">${icon("plus")}转为评估师记录</button>`:""}<span class="toolbar-spacer"></span><button class="btn primary" data-action="close-modal">返回审核</button>`});
  }

  function notepadDrawer(project) {
    const note=project.notepads[0]||{id:"",name:"现场速记",content:""};
    openDrawer({title:"现场 Notepad",body:`<div class="insight-card"><div class="insight-head"><span>${icon("edit")}</span><strong>非结构化访谈笔记</strong></div><p>可直接记录证据编号，例如 [SYS.001]。保存后可把选定内容转换成正式评估师记录。</p></div><form id="notepadForm" data-project="${project.id}" data-id="${note.id}"><div class="form-field"><label>笔记名称</label><input name="name" value="${esc(note.name)}"></div><div class="form-field"><label>内容</label><textarea name="content" style="min-height:360px">${esc(note.content)}</textarea></div></form>`,footer:`<button class="btn secondary" data-action="new-note" data-project="${project.id}">${icon("plus")}新建笔记</button><span class="toolbar-spacer"></span><button class="btn secondary" data-action="convert-note-record" data-project="${project.id}">转为记录</button><button class="btn primary" data-action="save-note">保存</button>`});
  }

  function guidelinesDrawer(project) {
    openDrawer({title:"Rating Guidelines / TAA",body:`<div class="review-block"><h3>自动一致性检查</h3><p>保存评分后重新计算。Broken 必须处理，Suspect 需确认或记录理由。</p></div>${project.guidelines.map(g=>`<article class="guideline-row ${g.state}"><div>${badge(g.state==="broken"?"danger":g.state==="suspect"?"warn":"success",g.state.toUpperCase())}<strong>${esc(g.indicator)}</strong><p>${esc(g.rule)}</p>${g.comment?`<small>${esc(g.comment)}</small>`:""}</div><button class="btn secondary sm" data-action="toggle-guideline" data-project="${project.id}" data-id="${g.id}">${g.handled?"重新打开":"标记已处理"}</button></article>`).join("")||`<div class="empty-mini">当前没有 Guideline 结果。</div>`}`,footer:`<button class="btn secondary" data-action="close-drawer">关闭</button>`});
  }

  function evidenceRefsModal(project, evidenceId) {
    const evidence=project.evidence.find(e=>e.id===evidenceId);const records=(project.records||[]).filter(r=>r.evidenceIds.includes(evidenceId));
    openModal({title:`证据引用 · ${evidence?.code||evidenceId}`,body:records.length?records.map(r=>renderRecordCard(project,r)).join(""):`<div class="empty-mini">当前没有记录引用该证据。</div>`,footer:`<button class="btn secondary" data-action="close-modal">关闭</button>`});
  }
  function evidenceTablesModal(type, projectId, evidenceId) {
    const project=getContainer(type,projectId);const evidence=project?.evidence?.find(item=>item.id===evidenceId);if(!evidence)return;
    const helix=evidence.helix||summarizeHelixTables(evidence.tables||[]);
    const summary=`<div class="helix-detail-grid"><article><span>Helix 识别</span><strong>${helix.detected?`${helix.score}%`:"未识别"}</strong></article><article><span>表格 / 对象行</span><strong>${(evidence.tables||[]).length} / ${helix.rowCount||0}</strong></article><article><span>关系行</span><strong>${helix.linkedRows||0}</strong></article><article><span>阻塞状态</span><strong>${helix.statusCounts?.blocked||0}</strong></article></div><div class="review-block"><h3>检测到的 Helix 元素</h3><p>${esc((helix.fields||[]).join("、")||"未检测到稳定 Helix 字段")}</p><p><strong>仍缺少：</strong>${esc((helix.missing||[]).join("、")||"核心字段组齐全；仍需评估师核实导出边界与关系语义")}</p></div>`;
    const tables=(evidence.tables||[]).map(table=>`<section class="table-preview-section"><header><div><strong>${esc(table.source)} · ${esc(table.name)}</strong><small>${table.rowCount} 行 · ${table.columnCount} 列${table.truncated?" · 预览已截断":""}</small></div>${table.helix?.detected?badge("success",`Helix ${table.helix.score}%`):badge("neutral","普通表格")}</header><div class="table-preview-scroll"><table class="data-table"><thead><tr>${table.headers.map(header=>`<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${table.rows.slice(0,12).map((row,rowIndex)=>`<tr>${row.map((value,column)=>`<td><small>${esc(`${table.source} · ${table.name} · Row ${rowIndex+2} · ${table.headers[column]}`)}</small>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`).join("")||`<div class="empty-mini">该历史证据只保留了 Helix 汇总，重新上传原始导出即可查看逐行表格。</div>`;
    openModal({title:`表格解析 · ${evidence.code||evidence.name}`,wide:true,body:`${summary}${tables}<div class="review-block"><h3>评分边界</h3><p>Helix 表格行可作为可定位证据，但只有目标过程自身、可验证且直接证明 BP/GP 的字段与对象内容才能计为直接证据；关联过程数据仅作交叉佐证。</p></div>`,footer:`<button class="btn secondary" data-action="close-modal">关闭</button>`});
  }

  function processDetailModal(processId) {
    const proc = PROCESS_CATALOG.find(p=>p.id===processId);
    const practices = PRACTICE_LIBRARY[processId] || Array.from({ length: proc.bp }, (_, i) => [
      `BP${i + 1}`,
      `${proc.zh} 基本实践 ${i + 1}`,
      "确认活动被定义、执行、受控并具有客观证据。"
    ]);
    openModal({ title: `${proc.id} · ${proc.zh}`, wide: true, body: `<div class="review-block"><h3>过程目的</h3><p>建立并持续执行 ${proc.zh} 相关活动，确保过程成果可通过受控工作产品、记录和项目级执行样本验证。</p></div><table class="data-table"><thead><tr><th>实践</th><th>名称</th><th>审核意图</th><th>典型证据</th></tr></thead><tbody>${practices.map(p=>`<tr><td><span class="code-tag">${p[0]}</span></td><td><strong>${p[1]}</strong></td><td>${p[2] || "验证定义、项目执行和闭环效果。"}</td><td>计划 / 工作产品 / 评审记录 / 状态与关闭样本</td></tr>`).join("")}</tbody></table>`, footer: `<button class="btn secondary" data-action="close-modal">关闭</button><button class="btn primary" data-action="new-standard-with-process" data-id="${proc.id}">以此过程新建审核</button>` });
  }

  function getContainer(type, projectId) {
    if (type === "standard") return db.standardProjects.find(p=>p.id===projectId);
    return db.customAudits.find(p=>p.id===projectId);
  }

  function currentAspiceTransferProject() {
    const route = parseRoute();
    if (route[0] === "standard" && route[1] && route[1] !== "report") {
      const current = db.standardProjects.find(project => project.id === route[1]);
      if (current) return current;
    }
    if (route[0] === "standard" && route[1] === "report") {
      const current = db.standardProjects.find(project => project.id === route[2]);
      if (current) return current;
    }
    return db.standardProjects.find(project => (project.evidence || []).length || (project.records || []).length || (project.assessments || []).length) || db.standardProjects[0] || null;
  }

  function buildAspiceTransferPackage(project, transferId, nonce) {
    initializeProjectModel(project);
    const sourceUrl = `${window.location.href.split("#")[0]}#/standard/${encodeURIComponent(project.id)}`;
    const payload = {
      protocol: ASPICE_BRIDGE_PROTOCOL,
      kind: "audit-evidence-package",
      transferId,
      nonce,
      exportedAt: new Date().toISOString(),
      source: { application: "AuditFlow", url: sourceUrl, databaseVersion: DB_VERSION },
      classification: {
        objectiveEvidence: "Evidence entries retain source metadata and controlled excerpts.",
        assessorMaterial: "Records, notes, trace decisions and ratings remain assessor review material; aspice-audit-master must independently confirm conclusions."
      },
      project: {
        id: project.id, name: project.name, organization: project.organization, product: project.product,
        pam: project.pam, targetLevel: project.targetLevel, achievedLevel: project.achievedLevel,
        processes: [...(project.processes || [])], owner: project.owner, status: project.status,
        assessmentState: project.assessmentState, reportNo: project.reportNo, attributes: deepCopy(project.attributes || {})
      },
      evidence: (project.evidence || []).slice(0, 80).map(item => ({
        id: item.id, code: item.code, name: item.name, type: item.type, source: item.source,
        scope: item.scope, primaryProcesses: [...(item.primaryProcesses || [])], date: item.date,
        parseStatus: item.parseStatus, structure: String(item.structure || "").slice(0, 1000),
        contentExcerpt: String(item.content || "").slice(0, 2500), locators: deepCopy((item.locators || []).slice(0, 12)),
        helix: item.helix ? deepCopy(item.helix) : null
      })),
      records: (project.records || []).slice(0, 120).map(item => ({
        id: item.id, type: item.type, text: String(item.text || "").slice(0, 2500),
        indicators: [...(item.indicators || [])], evidenceIds: [...(item.evidenceIds || [])], creator: item.creator,
        status: item.status, closureState: item.closureState, created: item.created, workspaceId: item.workspaceId
      })),
      notes: (project.notepads || []).slice(0, 80).map(item => ({
        id: item.id, name: item.name, content: String(item.content || "").slice(0, 2500),
        evidenceIds: [...(item.evidenceIds || [])], updated: item.updated
      })),
      assessments: (project.assessments || []).slice(0, 240).map(item => ({
        id: item.id, process: item.process, code: item.code, pa: item.pa, title: item.title,
        rating: item.rating, aiCandidateRating: item.aiCandidateRating, reviewed: !!item.reviewed,
        reviewerNote: String(item.reviewerNote || "").slice(0, 1200), reason: String(item.reason || "").slice(0, 1200),
        refs: [...(item.refs || [])], findings: deepCopy((item.findings || []).slice(0, 12)),
        evidenceSufficiency: deepCopy(item.evidenceSufficiency || {})
      })),
      traceLinks: deepCopy((project.traceLinks || []).slice(0, 240))
    };
    if (JSON.stringify(payload).length > 1500000) throw new Error("当前项目资料超过 1.5 MB 受控传输上限，请减少证据正文后重试。");
    return payload;
  }

  function openAspiceAuditMaster(event) {
    event?.preventDefault();
    const requestedProjectId = event?.target?.closest?.("[data-project]")?.dataset.project || "";
    const project = db.standardProjects.find(item => item.id === requestedProjectId) || currentAspiceTransferProject();
    if (!project) { toast("没有可传递的 ASPICE 项目", "请先创建标准评估项目并填写审核资料。", "warn"); return; }
    const transferId = id("AF").toUpperCase();
    const nonce = id("NONCE");
    let payload;
    try { payload = buildAspiceTransferPackage(project, transferId, nonce); }
    catch (error) { toast("资料包生成失败", error.message || String(error), "warn"); return; }
    const url = `${ASPICE_MASTER_URL}?page=evidence&auditflowTransfer=${encodeURIComponent(transferId)}&auditflowNonce=${encodeURIComponent(nonce)}&lang=zh`;
    const receiver = window.open(url, `aspice-audit-master-${transferId}`);
    if (!receiver) { toast("浏览器阻止了新窗口", "请允许此本地页面打开 aspice-audit-master 后重试。", "warn"); return; }
    const timeout = window.setTimeout(() => {
      aspiceTransfers.delete(transferId);
      toast("aspice-audit-master 未响应", "目标页面已打开，但未在 15 秒内完成受控握手。请返回 AuditFlow 后重试。", "warn");
    }, 15000);
    aspiceTransfers.set(transferId, { receiver, nonce, payload, timeout, projectId: project.id });
    toast("正在移交审核资料", `${project.id} 的证据索引、审核员记录、笔记和候选评估正在受控传递。`);
  }

  function reviewAssessment(type, projectId, assessmentId) {
    const project = getContainer(type, projectId);
    const a = project?.assessments.find(x=>x.id===assessmentId);
    if (!a) return;
    const rubricTitle = type === "standard" ? `${a.process} ${a.code}` : a.code;
    openDrawer({ title: `核对 · ${rubricTitle} ${a.title}`, body: `<div class="review-grid"><section class="review-column"><span class="overline">标准、评分护栏与证据链</span><div class="review-block"><h3>审核意图</h3><p>${esc(a.criterion)}</p></div><div class="review-block"><h3>八档评分规则</h3><p>N：未体现；P：部分实施或关键闭环不足；L：大部分系统实施但仍有样本/稳定性缺口；F：系统实施、受控且跨样本稳定闭环。证据不足时不得仅凭文档名称或口头说明给高分。</p></div><div class="review-block"><h3>AI 候选与证据充分性</h3><p>${badge(ratingClass(a.aiCandidateRating||a.rating),`AI 候选 ${a.aiCandidateRating||a.rating}`)} ${badge(sufficiencyTone(a.evidenceSufficiency?.status),sufficiencyLabel(a.evidenceSufficiency?.status))} 直接证据覆盖 ${a.evidenceSufficiency?.coverage||0}% · 直接 ${a.evidenceSufficiency?.directCount||0} · 跨过程佐证 ${a.evidenceSufficiency?.corroboratingCount||0}</p><p>缺口：${esc((a.evidenceSufficiency?.missingTypes||[]).join("、")||"无结构化缺口；仍需确认代表性")}</p></div>${scoreBreakdownMarkup(a)}${evidenceChainMarkup(a)}<div class="review-block"><h3>四遍跨过程分析</h3><p>${CROSS_PROCESS_PASSES.map(item=>`${item[1]}：${item[2]}`).join("；")}</p>${crossProcessMarkup(project,a.process,true)}</div><div class="review-block"><h3>建议访谈与关闭证据</h3><p>${esc((a.interviewQuestions||[]).join("；"))}</p><p><strong>关闭：</strong>${esc((a.closureEvidence||[]).join("；"))}</p></div></section><section class="review-column"><span class="overline">AI 初评与人工结论</span><form id="reviewForm" data-type="${type}" data-project="${projectId}" data-id="${assessmentId}"><div class="form-grid"><div class="form-field"><label>人工最终评分</label><select name="rating">${ratingOptions(a.rating)}</select></div><div class="form-field"><label>AI 把握度</label><input value="${a.confidence}%" readonly></div><div class="form-field full"><label>AI 专业评分理由</label><textarea name="reason" style="min-height:150px">${esc(a.reason)}</textarea></div><div class="form-field full"><label>证据引用（每行一条，必须可定位）</label><textarea name="refs" style="min-height:110px">${esc((a.refs||[]).join("\n"))}</textarea></div><div class="form-field full"><label>人工复核意见</label><textarea name="reviewerNote" placeholder="说明同意/改判原因、补充抽样或剩余限制">${esc(a.reviewerNote||"")}</textarea></div><div class="form-field full"><label>O/W/R 发现</label><div class="finding-editor" id="findingEditor">${(a.findings||[]).map(f=>findingEditorRow(f)).join("")}</div><button type="button" class="btn secondary sm" data-action="add-finding">${icon("plus")}添加发现</button></div></div></form></section></div>`, footer: `<button class="btn secondary" data-action="close-drawer">取消</button><button class="btn primary" data-action="save-review">确认人工结论</button>` });
  }

  function findingEditorRow(f = {type:"O",text:""}) { return `<div class="finding-item"><select aria-label="发现类型"><option ${f.type==="O"?"selected":""}>O</option><option ${f.type==="W"?"selected":""}>W</option><option ${f.type==="R"?"selected":""}>R</option></select><textarea aria-label="发现内容">${esc(f.text)}</textarea><button type="button" class="action-icon" data-action="remove-finding">${icon("trash")}</button></div>`; }

  async function handleEvidenceFiles(files) {
    const target = ui.evidenceTarget;
    const project = target && getContainer(target.type, target.id);
    if (!project || !files.length) return;
    setAIStatus(true, `本地解析 0/${files.length}`);
    let parsedCount=0,helixCount=0,failedCount=0;
    for (const file of files) {
      let parsed={content:"",tables:[],locators:[],helix:{detected:false,tableCount:0,rowCount:0,score:0,groups:[],fields:[],missing:HELIX_FIELD_GROUPS.map(([,label])=>label),linkedRows:0,statusCounts:{open:0,review:0,closed:0,blocked:0,other:0}},structure:"仅文件元数据",parseStatus:"failed"};
      let parseError="";
      try { parsed=await parseEvidenceFile(file);parsedCount++; } catch (error) { parseError=error.message||"解析失败";failedCount++; }
      if(!db.settings.helixAutoDetect&&parsed.helix)parsed.helix={...parsed.helix,detected:false};
      if(parsed.helix?.detected)helixCount++;
      const scope=suggestedEvidenceScope(file.name,project.processes||[]);
      const evidenceItem={ id: id("ev"), code:nextEvidenceCode(project), name: file.name, type:parsed.helix?.detected?"Helix Table Export":`${fileType(file.name)} Document`, size: file.size, chars: parsed.content.length, source:parsed.helix?.detected?"Helix 本地导出":"本地上传", date: new Date().toISOString(), scope, content: db.settings.retainEvidenceText ? parsed.content : "", tables:parsed.tables, locators:parsed.locators, helix:parsed.helix, structure:parsed.structure, parseStatus:parsed.parseStatus, parseError };
      evidenceItem.primaryProcesses=inferEvidencePrimaryProcesses(evidenceItem,project.processes||[]);project.evidence.push(evidenceItem);
      setAIStatus(true, `本地解析 ${project.evidence.length?parsedCount+failedCount:0}/${files.length}`);
    }
    project.status = project.status === "draft" ? "ready" : project.status;
    project.progress = Math.max(project.progress || 0, 28);
    db.activity.unshift({ icon:"upload", title:`${project.name} 新增 ${files.length} 份证据`, detail:`本地解析 ${parsedCount} 份 · Helix ${helixCount} 份 · 失败 ${failedCount} 份`, date:new Date().toISOString() });
    save(); setAIStatus(false); render(); toast(failedCount?"证据已加入，部分文件仅保留元数据":"证据本地解析完成", `${parsedCount} 个文件已读取正文/表格，识别 ${helixCount} 份 Helix 导出${failedCount?`；${failedCount} 份需转换或重新上传`:""}。`,failedCount?"warn":"success");
  }

  function startAssessment(type, projectId) {
    const project = getContainer(type, projectId);
    if (!project) return;
    if (!project.evidence.length) { toast("请先添加证据", "AI 需要基于项目证据给出可复核的判断。", "warn"); ui.projectTab="evidence"; render(); return; }
    project.status = "running"; save(); setAIStatus(true, "AI 评估中");
    const steps = type === "custom" ? ["解析本地证据正文与表格", "匹配审核问题与可定位证据", "生成逐题候选结论", "评估师复核与导出"] : REVIEW_WORKFLOW.map(step=>step[1]);
    openModal({ title: "AI 正在执行审核", body: `<div class="insight-card"><div class="insight-head"><span>${icon("sparkles")}</span><strong>Evidence → Process → BP/GP → Findings → Actions</strong></div><p>先读取本地正文、表格和 Helix 对象，再检查 SUP.8/9/10 闭环与跨文件依赖。所有输出都是候选结论，需评估师确认。</p></div><div id="jobSteps">${steps.map((s,i)=>`<div class="switch-line" data-job-step="${i}"><div><strong>${esc(s)}</strong><p>${i===0?"正在处理…":type==="standard"?esc(REVIEW_WORKFLOW[i]?.[2]||"等待前序步骤"):"等待前序步骤"}</p></div>${i===0?badge("warn","进行中"):badge("neutral","等待")}</div>`).join("")}</div>`, footer: `<button class="btn secondary" data-action="close-modal">在后台运行</button>` });
    let current = 0;
    const timer = setInterval(() => {
      current++;
      const nodes = modalRoot.querySelectorAll("[data-job-step]");
      nodes.forEach((node,i)=>{ const done=i<current, active=i===current; node.querySelector("p").textContent=done?"已完成":active?"正在处理…":"等待前序步骤"; const old=node.querySelector(".badge"); if(old) old.outerHTML=done?badge("success","完成"):active?badge("warn","进行中"):badge("neutral","等待"); });
      if (current >= steps.length) { clearInterval(timer); completeAssessment(type, project); }
    }, 360);
  }

  function completeAssessment(type, project) {
    if (type === "standard") project.assessments = buildAssessments(project.processes, project.runs.length + 1, project.evidence);
    else project.assessments = buildCustomAssessments(project);
    project.status = "review"; project.progress = 72;
    if (type === "standard") {
      initializeProjectModel(project);
      const version=(project.runs[0]?.version||0)+1; project.runs.forEach(r=>r.status="历史版本"); project.runs.unshift({id:`RUN-${String(version).padStart(3,"0")}`,version,date:new Date().toISOString(),status:"当前版本",summary:version===1?"首次 AI 评估":"证据更新后重新评估",assessments:deepCopy(project.assessments)}); refreshProjectOutcome(project);
      if(!project.records.length) project.records=project.assessments.slice(0,10).map((a,index)=>({id:`REC-${String(index+1).padStart(3,"0")}`,type:RATING_SCORE[a.rating]<50?"weakness":index%4===0?"strength":"observation",text:a.findings[0]?.text||a.reason,indicators:[indicatorKey(a)],evidenceIds:project.evidence.slice(0,index%3?1:2).map(e=>e.id),workspaceId:project.activeWorkspaceId,instanceId:project.activeInstanceId,creator:"AI→MM",general:false,presentation:index%3===0,created:new Date().toISOString(),status:"Draft",closureState:RATING_SCORE[a.rating]<50?"待处理":"不适用"}));
      project.guidelines=project.assessments.slice(0,12).map((a,index)=>({id:`GDL-${index+1}`,indicator:indicatorKey(a),rule:index%2?"证据应证明项目级执行，而不只是过程定义。":"低于 F 的评分必须有弱项记录或明确理由。",state:RATING_SCORE[a.rating]<50&&index%3===0?"broken":index%4===0?"suspect":"ok",handled:false,comment:""}));
    }
    if (type === "custom") project.conclusion = project.assessments.some(a=>RATING_SCORE[a.rating]<50)?"有条件通过":"通过";
    db.activity.unshift({icon:"sparkles",title:`${project.name} AI 评估完成`,detail:`${project.assessments.length} 个审核项 · ${project.assessments.filter(a=>RATING_SCORE[a.rating]<50).length} 个优先弱项`,date:new Date().toISOString()});
    save(); closeModal(); setAIStatus(false); ui.projectTab=type==="standard"?"conduct":"results"; render(); toast("AI 评估已完成", `已生成 ${project.assessments.length} 项可复核结论、评分候选与证据引用。`);
    if (db.settings.aiEnabled && db.settings.aiMode === "provider" && type === "standard") {
      enrichProviderAssessments(project).then(()=>enrichProviderOpinion(project, type));
    } else if (db.settings.aiEnabled && db.settings.aiMode === "provider") enrichProviderOpinion(project, type);
  }

  async function enrichProviderAssessments(project) {
    const settings = db.settings;
    const batches = [];
    for (let index = 0; index < project.assessments.length; index += 8) batches.push(project.assessments.slice(index, index + 8));
    setAIStatus(true, "模型逐项复核中");
    let updated = 0;
    try {
      for (const batch of batches) {
        const response = await fetch("/api/ai/assess-indicators", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            baseUrl: settings.baseUrl,
            model: settings.model,
            apiKey: settings.apiKey,
            project: { name: project.name, organization: project.organization, product: project.product, pam: project.pam, targetLevel: project.targetLevel },
            evidence: (project.evidence || []).filter(e=>batch.some(a=>evidenceAppliesTo(e,a.process,project.processes))).slice(0,16).map(e=>({id:e.id,code:e.code,name:e.name,scope:e.scope,primaryProcesses:inferEvidencePrimaryProcesses(e,project.processes),source:e.source,structure:e.structure,helix:e.helix,locators:(e.locators||[]).slice(0,6),content:String(e.content||tablesToEvidenceText(e.tables||[])).slice(0,5000),tableDigest:(e.tables||[]).slice(0,6).map(table=>({source:table.source,name:table.name,headers:table.headers,rowCount:table.rowCount,rows:table.rows.slice(0,8),helix:table.helix}))})),
            relationModel:{workflow:REVIEW_WORKFLOW,analysisPasses:CROSS_PROCESS_PASSES,formalScope:project.processes,supportProcesses:SUPPORT_PROCESS_RELATIONS.map(item=>item[0]),helixFieldGroups:HELIX_FIELD_GROUPS.map(([key,label])=>({key,label}))},
            indicators: batch.map(a=>({process:a.process,kind:a.kind,pa:a.pa,code:a.code,title:a.title,criterion:a.criterion,localRating:a.rating,localReason:a.reason,requiredEvidence:a.requiredEvidence,evidenceAnalysis:a.evidenceAnalysis,evidenceSufficiency:a.evidenceSufficiency,crossProcessAnalysis:a.crossProcessAnalysis}))
          })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "模型逐项评估失败");
        (payload.assessments || []).forEach(result => {
          const target = project.assessments.find(a=>a.process===result.process && canonicalCode(a.code)===canonicalCode(result.code));
          if (!target) return;
          const allowedEvidence = new Set((target.evidenceAnalysis||[]).map(e=>e.evidenceCode));
          const cited = (result.evidenceAnalysis||[]).filter(e=>allowedEvidence.has(e.evidenceCode));
          const requestedRating = RATING_ORDER.includes(result.rating) ? result.rating : target.rating;
          target.aiCandidateRating = ratingCappedByEvidence(requestedRating,target.evidenceSufficiency);
          if(!target.reviewed)target.rating=target.aiCandidateRating;
          target.achievementPercent = RATING_SCORE[target.rating];
          target.confidence = Math.max(40,Math.min(98,Number(result.confidence)||target.confidence));
          target.reason = String(result.reason||target.reason).trim();
          target.findings = Array.isArray(result.findings)&&result.findings.length?result.findings.filter(f=>["O","W","R"].includes(f.type)&&f.text).slice(0,6):target.findings;
          target.interviewQuestions = Array.isArray(result.interviewQuestions)&&result.interviewQuestions.length?result.interviewQuestions.slice(0,4):target.interviewQuestions;
          target.closureEvidence = Array.isArray(result.closureEvidence)&&result.closureEvidence.length?result.closureEvidence.slice(0,4):target.closureEvidence;
          target.scoreBreakdown = result.scoreBreakdown&&typeof result.scoreBreakdown==="object"?Object.fromEntries(Object.entries(result.scoreBreakdown).map(([k,v])=>[k,clampScore(v)])):target.scoreBreakdown;
          if(cited.length)target.evidenceAnalysis=target.evidenceAnalysis.map(local=>({...local,...cited.find(x=>x.evidenceCode===local.evidenceCode)}));
          if(Array.isArray(result.crossProcessAnalysis)&&result.crossProcessAnalysis.length){
            const allowed=new Set((target.crossProcessAnalysis||[]).map(row=>`${row.sourceProcess}|${row.targetProcess}|${row.relationType}`));
            target.crossProcessAnalysis=result.crossProcessAnalysis.filter(row=>allowed.has(`${row.sourceProcess}|${row.targetProcess}|${row.relationType}`)).slice(0,8);
          }
          target.aiSource="provider-structured-output";
          updated++;
        });
      }
      refreshProjectOutcome(project);
      if(project.runs?.[0])project.runs[0].assessments=deepCopy(project.assessments);
      save();render();toast("模型逐项专业意见已补充",`${updated} 个 BP/GP 已通过结构化输出更新；证据护栏仍由 AuditFlow 强制执行。`);
    } catch (error) {
      toast("外部模型逐项评估暂不可用",`${error.message}；已保留本地专业评分、证据链和人工复核流程。`,"warn");
    } finally { setAIStatus(false); }
  }

  async function enrichProviderOpinion(project, type) {
    const settings = db.settings;
    const evidenceContext = (project.evidence || []).slice(0, 8).map(e => `- ${e.name}（${e.source || "本地"}，${e.scope || "全部"}，${e.structure||"元数据"}${e.helix?.detected?`，Helix ${e.helix.score}% / ${e.helix.rowCount} 行`:""}）${e.content ? `：${e.content.slice(0, 420)}` : tablesToEvidenceText(e.tables||[]).slice(0,420)}`).join("\n");
    const resultContext = (project.assessments || []).filter(a => RATING_SCORE[a.rating] < 85).slice(0, 20).map(a => `- ${a.code} ${a.title}: ${a.rating}; ${a.reason}`).join("\n");
    const prompt = `你是一名资深汽车行业过程审核员。请根据以下审核范围、证据索引和固定规则引擎结果，用中文给出一段 120–220 字的管理层专业意见。必须区分过程定义和项目执行证据；指出等级门槛、最高优先级风险和最小关闭证据；不得宣称正式认证。\n\n审核类型：${type}\n项目：${project.name}\n范围：${project.processes?.join("、") || project.level || "自定义方案"}\n证据：\n${evidenceContext || "- 尚无可提取文本"}\n评分候选：\n${resultContext || "- 当前没有 P/L 弱项"}`;
    setAIStatus(true, "模型意见生成中");
    try {
      const response = await fetch("/api/ai/opinion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseUrl: settings.baseUrl, model: settings.model, apiKey: settings.apiKey, prompt }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "模型请求失败");
      project.aiOpinion = String(payload.output).trim();
      save(); render(); toast("外部模型意见已补充", "管理层摘要已使用当前配置的模型更新。")
    } catch (error) {
      toast("外部模型暂不可用", `${error.message}；已保留本地专业规则结果。`, "warn");
    } finally { setAIStatus(false); }
  }

  function createFromForm(formId) { const form=document.getElementById(formId); if(!form?.reportValidity()) return null; return Object.fromEntries(new FormData(form)); }
  function download(name, content, type="text/plain;charset=utf-8") { const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500); }
  function wordDocument(title, body) { return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:40px;color:#19323e}h1{color:#0b6f69}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccd7db;padding:8px;text-align:left}th{background:#edf5f4}.meta{padding:12px;background:#f2f7f7;margin-bottom:20px}.tag{font-weight:bold;color:#08766f}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`; }
  function formalWordDocument(project) { return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(project.name)}</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,'Microsoft YaHei',sans-serif;color:#1b2738;margin:0;font-size:10pt}.report-sheet{page-break-after:always;padding:8mm 4mm;position:relative}.report-running-head{font-size:8pt;color:#526071;border-bottom:1px solid #9eabb8;padding-bottom:4mm;margin-bottom:7mm}.report-running-head span{float:right}.report-running-foot{font-size:8pt;color:#687586;border-top:1px solid #cbd2d9;padding-top:3mm;margin-top:8mm}.report-title{font-size:29pt;line-height:1.15;margin:10mm 0 4mm}.report-subtitle{font-size:12pt;color:#536071}.official-table,.rating-matrix,.bp-rating-table{width:100%;border-collapse:collapse;margin:4mm 0;font-size:8.5pt}.official-table th,.official-table td,.rating-matrix th,.rating-matrix td,.bp-rating-table th,.bp-rating-table td{border:1px solid #c5ced8;padding:2.3mm;vertical-align:top}.official-table th,.rating-matrix th,.bp-rating-table th{background:#eef1f4}.report-section-title{font-size:16pt;margin:7mm 0 3mm}.report-assessment-entry{border-top:1px solid #d8dee5;padding:4mm 0}.report-assessment-entry h4{margin:0 0 2mm;font-size:10pt}.report-rating{display:inline-block;border:1px solid #6aa88d;background:#e6faed;padding:1mm 2.5mm;margin-right:2mm}.report-rating.warn{border-color:#e6bd55;background:#fff5d9}.report-rating.danger{border-color:#e58b86;background:#fff0ef}.owr-line{margin:1.4mm 0}.owr-line b{display:inline-block;width:5mm;color:#225ee8}.evidence-basis{background:#f5f7f9;border-left:3px solid #2d66e8;padding:3mm;margin:2mm 0}.report-signatures{display:table;width:100%;margin-top:18mm}.report-signatures div{display:table-cell;width:33%;border-top:1px solid #929eaa;padding-top:2mm}.report-status-stamp{float:right;border:2px solid #d69b26;color:#a76d00;padding:2mm 4mm;font-weight:bold}.report-status-stamp.final{border-color:#2f8b66;color:#216b50}.capability-bars{display:table;width:100%;height:55mm;border-bottom:1px solid #8895a3}.capability-bar{display:table-cell;text-align:center;vertical-align:bottom}.capability-bar i{display:block;background:#2e66e7;width:45%;margin:auto}.capability-bar strong,.capability-bar span{display:block}.report-risk-grid{display:table;width:100%;margin:4mm 0}.report-risk-grid div{display:table-cell;border:1px solid #ccd4dc;padding:3mm}.report-evidence-row{margin:1.5mm 0}.report-disclaimer{margin-top:8mm;padding:4mm;background:#f1f4f7;border:1px solid #d1d8df}</style></head><body>${formalReportMarkup(project)}</body></html>`; }
  function exportAuditWord(project, type) { if(type==="standard"){refreshProjectOutcome(project);download(`${project.id}-ASPICE-assessment-report.doc`,formalWordDocument(project),"application/msword;charset=utf-8");toast("ASPICE 详细评估报告已生成","已包含封面、PA/BP/GP 矩阵、逐项 AI 评分、证据链、O/W/R 和工作产品清单。");return;}const meta=`受审对象：${project.organization}`; const body=`<div class="meta">${esc(meta)}<br>日期：${formatDate(project.date)}　负责人：${esc(project.owner)}</div><h2>AI 与人工复核结果</h2><table><tr><th>审核项</th><th>评分</th><th>结论与理由</th><th>发现</th><th>证据</th></tr>${(project.assessments||[]).map(a=>`<tr><td><span class="tag">${esc(a.code)}</span> ${esc(a.title)}</td><td>${a.rating}</td><td>${esc(a.reason)}</td><td>${a.findings.map(f=>`<b>${f.type}</b> ${esc(f.text)}`).join("<br>")}</td><td>${esc(a.refs.join("；"))}</td></tr>`).join("")}</table><p><small>声明：AI 提供初评候选，正式结论由评估师人工确认。</small></p>`; download(`${project.id}-${type}-report.doc`,wordDocument(project.name,body),"application/msword;charset=utf-8"); toast("Word 报告已生成"); }

  function showRun(projectId, runId) {
    const project=db.standardProjects.find(p=>p.id===projectId); const run=project?.runs.find(r=>r.id===runId); if(!run)return;
    openModal({title:`评估版本 ${run.version} · ${run.id}`,wide:true,body:`<div class="risk-matrix"><div class="risk-card"><span>总体评分</span><strong>${averageRating(run.assessments)}</strong></div><div class="risk-card"><span>评估项</span><strong>${run.assessments.length}</strong></div><div class="risk-card"><span>弱项</span><strong>${run.assessments.filter(a=>RATING_SCORE[a.rating]<50).length}</strong></div></div><table class="data-table" style="margin-top:16px"><thead><tr><th>实践</th><th>标题</th><th>评分</th><th>理由摘要</th></tr></thead><tbody>${run.assessments.map(a=>`<tr><td>${esc(a.code)}</td><td>${esc(a.title)}</td><td>${a.rating}</td><td>${esc(a.reason.slice(0,90))}</td></tr>`).join("")}</tbody></table>`,footer:`<button class="btn secondary" data-action="close-modal">关闭</button>${run.status!=="当前版本"?`<button class="btn primary" data-action="restore-run" data-project="${projectId}" data-id="${runId}">切换到此版本</button>`:""}`});
  }

  function searchSnippet(value, query, radius = 74) {
    const source=String(value||"").replace(/\s+/g," ").trim();if(!source)return "";
    const index=source.toLowerCase().indexOf(String(query||"").toLowerCase());
    if(index<0)return source.length>radius*2?`${source.slice(0,radius*2)}…`:source;
    const from=Math.max(0,index-radius),to=Math.min(source.length,index+String(query).length+radius);
    return `${from?"…":""}${source.slice(from,to)}${to<source.length?"…":""}`;
  }
  function globalSearch(query) {
    const q=query.trim().toLowerCase(); if(!q)return;
    const results=[];
    const add=(result,fields)=>{const values=fields.filter(Boolean).map(String);const match=values.find(value=>value.toLowerCase().includes(q));if(match)results.push({...result,snippet:searchSnippet(match,query)});};
    db.standardProjects.forEach(project=>{
      add({type:"ASPICE 项目",title:project.name,detail:`${project.id} · ${project.organization}`,hash:`#/standard/${project.id}`},[project.id,project.name,project.organization,project.product,...(project.processes||[])]);
      (project.evidence||[]).forEach(evidence=>add({type:"项目证据",title:evidence.name,detail:project.name,hash:`#/standard/${project.id}`},[evidence.name,evidence.code,evidence.type,evidence.source,evidence.scope,evidence.content,...(evidence.locators||[]).flatMap(item=>[item.locator,item.excerpt])]));
      (project.assessments||[]).forEach(item=>add({type:"评估项",title:`${item.process} ${item.code} · ${item.title}`,detail:project.name,hash:`#/standard/${project.id}`},[item.process,item.code,item.title,item.criterion,item.reason,...(item.findings||[]).map(finding=>finding.text)]));
      (project.records||[]).forEach(record=>add({type:"评估师记录",title:`${record.id} · ${RECORD_TYPES[record.type]?.label||record.type}`,detail:`${project.name} · ${record.creator||""}`,hash:`#/standard/${project.id}`,projectId:project.id,recordId:record.id},[record.id,record.text,record.type,RECORD_TYPES[record.type]?.label,...(record.indicators||[]),record.creator]));
      (project.assessments||[]).filter(item=>item.sourceAssessment).forEach(item=>{const source=item.sourceAssessment;add({type:"导入评估源",title:`${item.process} ${item.code} · ${item.title}`,detail:project.name,hash:`#/standard/${project.id}`},[source.weakness,source.assessorComment,source.actionItems,source.evidence,item.title,item.code,item.process]);});
    });
    db.customAudits.forEach(audit=>add({type:"自定义审核",title:audit.name,detail:audit.organization,hash:`#/custom/audit/${audit.id}`},[audit.id,audit.name,audit.organization,...(audit.evidence||[]).flatMap(item=>[item.name,item.content])]));
    PROCESS_CATALOG.forEach(process=>add({type:"标准过程",title:`${process.id} · ${process.zh}`,detail:process.en,hash:"#/library"},[process.id,process.zh,process.en]));
    openModal({title:`搜索“${query}”`,wide:true,body:results.length?`<div class="global-search-results">${results.slice(0,40).map(result=>`<a href="${result.hash}" data-action="search-result" data-project="${esc(result.projectId||"")}" data-record="${esc(result.recordId||"")}" class="global-search-result"><span class="activity-icon">${icon(result.type.includes("证据")?"file":result.type.includes("过程")?"book":result.type.includes("记录")?"edit":"search")}</span><div><strong>${esc(result.title)}</strong><small>${esc(result.detail)}</small><p>${esc(result.snippet)}</p></div><span class="badge neutral">${esc(result.type)}</span></a>`).join("")}</div>`:`<div class="empty-state"><div><span>${icon("search")}</span><h2>没有找到匹配结果</h2><p>可尝试项目编号、记录内容、审核员、过程 ID 或文件名。</p></div></div>`,footer:`<button class="btn secondary" data-action="close-modal">关闭</button>`});
  }
  document.addEventListener("click", async event => {
    const el=event.target.closest("[data-action]"); if(!el)return;
    const action=el.dataset.action;
    if(action==="close-modal"){if(el.matches(".modal-backdrop")&&event.target!==el)return;closeModal();return;}
    if(action==="open-aspice-master"){openAspiceAuditMaster(event);return;}
    if(action==="close-drawer"){if(el.matches(".drawer-backdrop")&&event.target!==el)return;closeDrawer();return;}
    if(action==="open-standard"||action==="back-standard") location.hash="#/standard";
    else if(action==="open-library") location.hash="#/library";
    else if(action==="back-custom") location.hash="#/custom";
    else if(action==="open-standard-project"){ui.projectTab="conduct";ui.activeProcess="";ui.activeIndicator="";location.hash=`#/standard/${el.dataset.id}`;}
    else if(action==="open-custom-audit"){ui.projectTab="results";location.hash=`#/custom/audit/${el.dataset.id}`;}
    else if(action==="open-scheme") location.hash=`#/custom/scheme/${el.dataset.id}`;
    else if(action==="open-report") location.hash=`#/standard/report/${el.dataset.id}`;
    else if(action==="new-standard") newStandardModal();
    else if(action==="new-scheme") newSchemeModal();
    else if(action==="new-custom-audit") newCustomAuditModal();
    else if(action==="create-standard"){
      const form=document.getElementById("newStandardForm"); if(!form.reportValidity())return; const fd=new FormData(form); const processes=fd.getAll("processes"); if(!processes.length){toast("请选择评估过程","至少选择一个 ASPICE 过程。","warn");return;} const pid=nextProjectId("ASP",db.standardProjects); const p=initializeProjectModel({id:pid,name:fd.get("name"),organization:fd.get("organization"),product:fd.get("product"),pam:fd.get("pam"),targetLevel:fd.get("targetLevel"),processes,date:new Date().toISOString(),status:"draft",owner:"Maple Mock",progress:8,evidence:[],assessments:[],runs:[],achievedLevel:"—",reportNo:`AF-${pid}`});p.attributes.assessmentClass=fd.get("assessmentClass");p.attributes.purpose=fd.get("purpose");db.standardProjects.unshift(p);save();closeModal();ui.projectTab="plan";location.hash=`#/standard/${pid}`;toast("评估项目已创建","下一步可配置实例、参与者、日程和证据。");
    }
    else if(action==="create-scheme"){
      const v=createFromForm("newSchemeForm");if(!v)return;const sid=id("SCHEME").toUpperCase();const scheme={id:sid,name:v.name,description:v.description||"自定义审核方案",reportTitle:v.reportTitle||`${v.name}报告`,categories:(v.categories||"未分类").split(/[、,，]/).map(x=>x.trim()).filter(Boolean),updated:new Date().toISOString(),questions:[]};db.customSchemes.unshift(scheme);save();closeModal();location.hash=`#/custom/scheme/${sid}`;toast("审核方案已创建","现在可以逐项添加或批量粘贴问题。");
    }
    else if(action==="create-custom-audit"){
      const v=createFromForm("newCustomAuditForm");if(!v)return;const aid=nextProjectId("CUS",db.customAudits);db.customAudits.unshift({id:aid,name:v.name,schemeId:v.schemeId,organization:v.organization,owner:v.owner,date:new Date().toISOString(),status:"draft",progress:8,evidence:[],assessments:[],conclusion:"待定"});save();closeModal();ui.projectTab="evidence";location.hash=`#/custom/audit/${aid}`;toast("自定义审核已发起","请上传 Helix、Office、PDF 或文本证据包。");
    }
    else if(action==="duplicate-standard"){
      const src=db.standardProjects.find(p=>p.id===el.dataset.id);if(!src)return;const pid=nextProjectId("ASP",db.standardProjects);const copy=initializeProjectModel({...deepCopy(src),id:pid,name:`${src.name}（副本）`,date:new Date().toISOString(),status:"draft",progress:10,evidence:[],assessments:[],records:[],sessions:[],guidelines:[],notepads:[],logs:[],runs:[],achievedLevel:"—",assessmentState:"Open",reportNo:`AF-${pid}`});copy.logs=[{id:id("log"),date:new Date().toISOString(),action:"Open",user:"Maple Mock",comment:"从既有范围配置复制评估"}];db.standardProjects.unshift(copy);save();render();toast("项目已复制","范围、属性和参与者已保留；证据与结果未复制。");
    }
    else if(action==="helix-find-projects") await loadHelixProjects();
    else if(action==="helix-read-snapshot") await loadHelixSnapshot();
    else if(action==="helix-project"){helixUi.projectId=el.dataset.value||"";const input=document.querySelector("[data-helix-field=projectId]");if(input)input.value=helixUi.projectId;renderHelixOutput();}
    else if(action==="helix-toggle-item"){const key=el.dataset.helixKey;if(helixUi.selectedKeys.has(key))helixUi.selectedKeys.delete(key);else helixUi.selectedKeys.add(key);refreshHelixControls();}
    else if(action==="helix-select-visible"){helixVisibleRecords().forEach(record=>helixUi.selectedKeys.add(record.key));refreshHelixControls();}
    else if(action==="helix-select-category"){helixVisibleRecords(el.dataset.section).forEach(record=>helixUi.selectedKeys.add(record.key));refreshHelixControls();}
    else if(action==="helix-clear-category"){helixVisibleRecords(el.dataset.section).forEach(record=>helixUi.selectedKeys.delete(record.key));refreshHelixControls();}
    else if(action==="helix-clear-selection"){helixUi.selectedKeys.clear();refreshHelixControls();}
    else if(action==="helix-clear-snapshot"){helixUi.snapshot=null;helixUi.selectedKeys.clear();setHelixStatus("Helix 快照和选择已清除。");renderHelixOutput();}
    else if(action==="helix-reset") resetHelixPanel();
    else if(action==="helix-import-selected"){
      syncHelixInputs();const target=helixUi.target;const p=target&&getContainer(target.type,target.projectId);if(!p)return;const selected=helixVisibleRecords().filter(record=>helixUi.selectedKeys.has(record.key));if(!selected.length){toast("尚未选择 Helix 证据","请选择可见条目或某个分类后再导入。","warn");return;}const known=new Set((p.evidence||[]).map(item=>item.helix?.key).filter(Boolean));const fresh=selected.filter(record=>!known.has(record.key));fresh.forEach((record,index)=>p.evidence.push(helixRecordToEvidence(record,p,index)));p.status=p.status==="draft"?"ready":p.status;p.progress=Math.max(p.progress||0,28);if(p.logs)p.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Import",user:"Maple Mock",comment:`从 Helix 导入 ${fresh.length} 条独立证据对象`});save();render();toast("Helix 证据已导入",`${fresh.length} 条新增到 Evidence Inventory${fresh.length<selected.length?`，${selected.length-fresh.length} 条重复项已跳过`:""}。`);
    }    else if(action==="project-tab"){ui.projectTab=el.dataset.tab;render();}
    else if(action==="custom-tab"){ui.customTab=el.dataset.tab;render();}
    else if(action==="library-tab"){ui.libraryTab=el.dataset.tab;render();}
    else if(action==="settings-tab"){ui.settingsTab=el.dataset.tab;render();}
    else if(action==="trace-ai-project"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p)await showTraceAiOpinion(p);
    }
    else if(action==="trace-ai-indicator"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);const a=p?.assessments.find(x=>x.id===el.dataset.assessment);if(p&&a)await showTraceAiOpinion(p,a);
    }
    else if(action==="confirm-trace-link"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);const a=p?.assessments.find(x=>x.id===el.dataset.assessment);const evidence=p?.evidence.find(x=>x.id===el.dataset.evidence);if(!p||!a||!evidence)return;
      const indicator=indicatorKey(a);const existing=(p.traceLinks||[]).find(link=>link.indicator===indicator&&link.evidenceId===evidence.id);
      if(existing){p.traceLinks=p.traceLinks.filter(link=>link!==existing);save();render();toast("人工确认已取消",`${indicator} 与 ${evidence.code||evidence.name} 保留为 AI 候选关系。`);return;}
      const relation=evidenceRelationToProcess(evidence,a.process,p.processes);const locatable=String(evidence.content||"").trim().length>=120||(evidence.tables||[]).some(table=>table.rowCount);const strength=!locatable?"index-only":relation?.relationType==="direct"?"direct":"corroborating";
      p.traceLinks.push({id:id("TRACE").toUpperCase(),indicator,evidenceId:evidence.id,evidenceCode:evidence.code,strength,relationType:relation?.relationType||"unmapped",locator:evidence.locators?.[0]?.locator||"文件索引 · 待打开原文定位",claim:strength==="direct"?`评估师确认该证据可直接支持 ${indicator} 的项目实施判断。`:`评估师确认该证据可用于 ${indicator} 的接口或一致性交叉核实，不替代直接证据。`,confirmed:true,created:new Date().toISOString(),creator:"Maple Mock"});
      p.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Trace",user:"Maple Mock",comment:`确认 ${indicator} ↔ ${evidence.code||evidence.name}（${strength}）`});save();render();toast("追溯关系已确认",`${indicator} ↔ ${evidence.code||evidence.name}；证据强度仍由可定位性和过程关系决定。`);
    }
    else if(action==="suggest-finding-templates"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p)findingTemplateModal(p,el.dataset.indicator);
    }
    else if(action==="apply-finding-template"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);const template=db.recordTemplates.find(x=>x.id===el.dataset.template);if(!p||!template)return;template.usageCount=Number(template.usageCount||0)+1;save();closeModal();recordModal(p,null,el.dataset.indicator,template);
    }
    else if(action==="ai-create-record"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);const a=p?.assessments.find(x=>x.id===el.dataset.assessment);if(!p||!a)return;const weakness=(a.findings||[]).find(item=>item.type==="W");const observation=(a.findings||[]).find(item=>item.type==="O");const template={type:weakness?"weakness":"observation",text:weakness?.text||observation?.text||a.reason,indicators:[indicatorKey(a)]};closeModal();recordModal(p,null,indicatorKey(a),template);
    }
    else if(action==="conduct-view"){ui.conductView=el.dataset.view;render();}
    else if(action==="select-process"){ui.activeProcess=el.dataset.process;ui.activeIndicator="";render();}
    else if(action==="select-indicator"){ui.activeIndicator=el.dataset.id;render();}
    else if(action==="edit-assessment-meta"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)assessmentMetaModal(p);}
    else if(action==="save-assessment-meta"){
      const form=document.getElementById("assessmentMetaForm");const p=db.standardProjects.find(x=>x.id===form?.dataset.project);if(!p)return;const fd=new FormData(form);Object.assign(p.attributes,{assessmentClass:fd.get("assessmentClass"),purpose:fd.get("purpose"),independence:fd.get("independence"),asil:fd.get("asil"),processContext:fd.get("processContext"),supplyChain:fd.get("supplyChain"),standards:String(fd.get("standards")||"").split(/[,，]/).map(x=>x.trim()).filter(Boolean)});save();closeModal();render();toast("评估属性已更新");
    }
    else if(action==="add-participant"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)participantModal(p);}
    else if(action==="save-participant"){
      const form=document.getElementById("participantForm");if(!form?.reportValidity())return;const p=db.standardProjects.find(x=>x.id===form.dataset.project);const fd=new FormData(form);const name=String(fd.get("name"));p.participants.push({id:id("person"),name,short:String(fd.get("short")||name.slice(0,2)).toUpperCase(),role:fd.get("role"),email:fd.get("email")});save();closeModal();render();toast("参与者已添加");
    }
    else if(action==="add-workspace"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)workspaceModal(p);}
    else if(action==="save-workspace"){
      const form=document.getElementById("workspaceForm");if(!form?.reportValidity())return;const p=db.standardProjects.find(x=>x.id===form.dataset.project);const fd=new FormData(form);p.workspaces.push({id:id("WS").toUpperCase(),name:fd.get("name"),description:fd.get("description")||"独立评估记录",final:false});save();closeModal();render();toast("工作区已创建");
    }
    else if(action==="set-workspace"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p){p.activeWorkspaceId=el.dataset.id;save();render();}}
    else if(action==="add-instance"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)instanceModal(p);}
    else if(action==="save-instance"){
      const form=document.getElementById("instanceForm");if(!form?.reportValidity())return;const p=db.standardProjects.find(x=>x.id===form.dataset.project);const fd=new FormData(form);const processes=fd.getAll("processes");if(!processes.length){toast("至少选择一个过程","实例需要明确适用范围。","warn");return;}const name=String(fd.get("name"));p.instances.push({id:id("INS").toUpperCase(),name,short:String(fd.get("short")||name.slice(0,4)).toUpperCase(),processes});save();closeModal();render();toast("过程实例已添加");
    }
    else if(action==="add-session"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)sessionModal(p,"Interview");}
    else if(action==="add-schedule-break"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)sessionModal(p,"Break");}
    else if(action==="save-session"){
      const form=document.getElementById("sessionForm");const p=db.standardProjects.find(x=>x.id===form?.dataset.project);if(!p)return;const fd=new FormData(form);const type=fd.get("type")==="Interview"?"Interview":fd.get("activityType");p.sessions.push({id:id("session"),date:new Date(`${fd.get("date")}T${fd.get("start")}`).toISOString(),start:fd.get("start"),duration:Number(fd.get("duration"))||15,type,process:type==="Interview"?fd.get("process"):"",instanceId:type==="Interview"?fd.get("instanceId"):p.activeInstanceId,interviewees:type==="Interview"?String(fd.get("interviewees")||"").split(/[、,，]/).map(x=>x.trim()).filter(Boolean):[]});save();closeModal();render();toast("日程已更新");
    }
    else if(action==="move-session-up"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);const index=p?.sessions.findIndex(s=>s.id===el.dataset.id)??-1;if(index>0){[p.sessions[index-1],p.sessions[index]]=[p.sessions[index],p.sessions[index-1]];save();render();}}
    else if(action==="delete-session"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p){p.sessions=p.sessions.filter(s=>s.id!==el.dataset.id);save();render();toast("日程项已删除");}}
    else if(action==="new-record"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p)recordModal(p,null,el.dataset.indicator||ui.activeIndicator);}
    else if(action==="open-record"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);const r=p?.records.find(x=>x.id===el.dataset.id);if(p&&r)recordModal(p,r);}
    else if(action==="pick-record-attachments") document.getElementById("recordAttachmentPicker")?.click();
    else if(action==="view-record-attachment") await openRecordAttachment(el.dataset.id);
    else if(action==="download-record-attachment") await openRecordAttachment(el.dataset.id,true);
    else if(action==="remove-pending-attachment"){pendingRecordAttachments.delete(el.dataset.id);el.closest("[data-pending-attachment]")?.remove();if(!document.querySelector("#recordAttachmentList .record-attachment"))document.getElementById("recordAttachmentList").innerHTML=`<div class="attachment-empty">尚无附件</div>`;}
    else if(action==="remove-existing-attachment"){el.closest("[data-existing-attachment]")?.classList.toggle("removed");}
    else if(action==="save-record"){
      const form=document.getElementById("recordForm");if(!form?.reportValidity())return;const p=db.standardProjects.find(x=>x.id===form.dataset.project);if(!p)return;const fd=new FormData(form);const old=p.records.find(r=>r.id===form.dataset.id);const keptAttachments=(old?.attachments||[]).filter(item=>!form.querySelector(`[data-existing-attachment][data-attachment-id="${CSS.escape(item.id)}"].removed`));const pending=[...pendingRecordAttachments.values()];
      try{await Promise.all(pending.map(item=>putAttachment(item.metadata,item.file)));const removed=(old?.attachments||[]).filter(item=>!keptAttachments.some(kept=>kept.id===item.id));await Promise.all(removed.map(item=>deleteAttachment(item.id)));const record={id:old?.id||nextRecordId(p),type:fd.get("type"),text:fd.get("text"),indicators:String(fd.get("indicators")||"").split(/[,，]/).map(x=>x.trim()).filter(Boolean),evidenceIds:fd.getAll("evidenceIds"),workspaceId:fd.get("workspaceId"),instanceId:fd.get("instanceId"),creator:old?.creator||"MM",general:fd.get("general")==="on",presentation:fd.get("presentation")==="on",created:old?.created||new Date().toISOString(),status:p.workspaces.find(w=>w.id===fd.get("workspaceId"))?.final?"Final":"Draft",closureState:fd.get("closureState")||old?.closureState||(fd.get("type")==="weakness"?"待处理":"不适用"),attachments:[...keptAttachments,...pending.map(item=>item.metadata)]};if(old)Object.assign(old,record);else p.records.push(record);pendingRecordAttachments.clear();save();closeDrawer();render();toast("评估师记录已保存",`${RECORD_TYPES[record.type].label}已关联 ${record.evidenceIds.length} 份证据和 ${record.attachments.length} 个附件。`);}catch(error){toast("记录附件保存失败",error.message||"请检查浏览器存储权限和剩余空间。","warn");}
    }
    else if(action==="delete-record"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);const record=p?.records.find(r=>r.id===el.dataset.id);if(p&&record){try{await deleteRecordAttachments(record);}catch(error){toast("附件清理失败",error.message||"IndexedDB 删除失败。","warn");return;}p.records=p.records.filter(r=>r.id!==record.id);save();closeDrawer();render();toast("记录已删除");}}
    else if(action==="create-record-template"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);const r=p?.records.find(x=>x.id===el.dataset.id);if(r){db.recordTemplates.push({id:id("RT").toUpperCase(),name:`${RECORD_TYPES[r.type].label} · ${r.indicators[0]||"通用"}`,type:r.type,overlayId:"OV-PERSONAL",indicators:[...r.indicators],text:r.text});save();toast("记录模板已创建","已加入个人方法库。");}}
    else if(action==="open-notepad"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)notepadDrawer(p);}
    else if(action==="save-note"){
      const form=document.getElementById("notepadForm");const p=db.standardProjects.find(x=>x.id===form?.dataset.project);if(!p)return;const fd=new FormData(form);const old=p.notepads.find(n=>n.id===form.dataset.id);const note={id:old?.id||id("NOTE").toUpperCase(),name:fd.get("name")||"现场速记",content:fd.get("content")||"",evidenceIds:p.evidence.filter(e=>String(fd.get("content")||"").includes(e.code)).map(e=>e.id)};if(old)Object.assign(old,note);else p.notepads.unshift(note);save();closeDrawer();render();toast("现场笔记已保存");
    }
    else if(action==="new-note"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p){p.notepads.unshift({id:id("NOTE").toUpperCase(),name:"新现场笔记",content:"",evidenceIds:[]});save();notepadDrawer(p);}}
    else if(action==="convert-note-record"){const form=document.getElementById("notepadForm");const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p&&form){const fd=new FormData(form);closeDrawer();recordModal(p,null,ui.activeIndicator);setTimeout(()=>{const text=document.querySelector("#recordForm [name=text]");if(text)text.value=String(fd.get("content")||"");},0);}}
    else if(action==="open-guidelines"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p)guidelinesDrawer(p);}
    else if(action==="toggle-guideline"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);const g=p?.guidelines.find(x=>x.id===el.dataset.id);if(g){g.handled=!g.handled;g.comment=g.handled?"已由评估师确认并记录处理理由":"";save();guidelinesDrawer(p);}}
    else if(action==="show-evidence-refs"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p)evidenceRefsModal(p,el.dataset.id);}
    else if(action==="preview-evidence-tables") evidenceTablesModal(el.dataset.type,el.dataset.project,el.dataset.id);
    else if(action==="open-consolidation"){ui.projectTab="consolidate";location.hash=`#/standard/${el.dataset.id}`;render();}
    else if(action==="move-record-final"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);const r=p?.records.find(x=>x.id===el.dataset.id);const final=p?.workspaces.find(w=>w.final);if(r&&final){r.workspaceId=final.id;r.status="Final";save();render();toast("记录已移入定稿工作区");}}
    else if(action==="consolidate-all"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);const final=p?.workspaces.find(w=>w.final);if(p&&final){p.records.forEach(r=>{r.workspaceId=final.id;r.status="Final";});save();render();toast("记录合并完成",`${p.records.length} 条记录已进入 Consolidated 工作区。`);}}
    else if(action==="close-assessment"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p){const q=assessmentQuality(p);const broken=p.guidelines.filter(g=>g.state==="broken"&&!g.handled).length;const drafts=p.records.filter(r=>r.status!=="Final").length;const openWeakness=p.records.filter(r=>r.type==="weakness"&&r.closureState!=="已关闭").length;if(!q.ready||broken||drafts||openWeakness){toast("仍不能关闭评估",`${q.unreviewed} 项未复核、${q.insufficient+q.partial} 项证据未充分、${drafts} 条记录未定稿、${openWeakness} 条弱项未关闭。`,"warn");return;}p.assessmentState="Closed";p.status="complete";p.progress=100;p.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Close",user:"Maple Mock",comment:"逐项证据充分性、人工复核、整改关闭和记录合并门禁通过，评估已关闭"});save();render();toast("评估已关闭");}}
    else if(action==="reopen-assessment"){const p=db.standardProjects.find(x=>x.id===el.dataset.id);if(p){p.assessmentState="Open";p.status="review";p.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Open",user:"Maple Mock",comment:"评估重新打开"});save();render();toast("评估已重新打开");}}
    else if(action==="add-log-comment"){openModal({title:"添加评估日志评论",body:`<form id="logCommentForm" data-project="${el.dataset.id}"><div class="form-field"><label>评论</label><textarea name="comment" required style="min-height:150px"></textarea></div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-log-comment">写入日志</button>`});}
    else if(action==="save-log-comment"){const form=document.getElementById("logCommentForm");if(!form?.reportValidity())return;const p=db.standardProjects.find(x=>x.id===form.dataset.project);p.logs.unshift({id:id("log"),date:new Date().toISOString(),action:"Comment",user:"Maple Mock",comment:new FormData(form).get("comment")});save();closeModal();render();toast("评论已写入不可修改日志");}
    else if(action==="generate-assessor-report"){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(!p)return;const type=Number(el.dataset.report);if(type===2){const csv="ID,类型,指标,描述,证据,关闭状态\n"+p.records.map(r=>[r.id,RECORD_TYPES[r.type].label,r.indicators.join(" "),r.text,r.evidenceIds.map(eid=>p.evidence.find(e=>e.id===eid)?.code||eid).join(" "),r.closureState||"不适用"].map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");download(`${p.id}-records.csv`,"\uFEFF"+csv,"text/csv;charset=utf-8");toast("记录清单已生成");}else exportAuditWord(p,"standard");}
    else if(action==="pick-evidence"){ui.evidenceTarget={type:el.dataset.type,id:el.dataset.id};document.getElementById("evidencePicker").click();}
    else if(action==="add-text-evidence") textEvidenceModal(el.dataset.type,el.dataset.id);
    else if(action==="save-text-evidence"){
      const form=document.getElementById("textEvidenceForm");if(!form.reportValidity())return;const fd=new FormData(form);const p=getContainer(form.dataset.type,form.dataset.project);const content=String(fd.get("content"));const evidenceItem={id:id("ev"),code:nextEvidenceCode(p),name:fd.get("name"),type:"Interview / Text Note",size:new Blob([content]).size,chars:content.length,source:"粘贴文本",date:new Date().toISOString(),scope:fd.get("scope")||"全部审核项",content:db.settings.retainEvidenceText?content.slice(0,500000):"",tables:[],locators:[],helix:summarizeHelixTables([]),structure:"文本正文",parseStatus:"parsed"};evidenceItem.primaryProcesses=inferEvidencePrimaryProcesses(evidenceItem,p.processes||[]);p.evidence.push(evidenceItem);p.status=p.status==="draft"?"ready":p.status;p.progress=Math.max(p.progress||0,28);save();closeModal();render();toast("文本证据已加入",`${content.length.toLocaleString()} 个字符已建立索引，并已生成跨过程影响范围。`);
    }
    else if(action==="delete-evidence"){
      const p=getContainer(el.dataset.type,el.dataset.project);if(!p)return;if(el.dataset.linked==="true"){toast("证据正在被记录引用","先从关联记录中移除引用后才能删除。","warn");return;}p.evidence=p.evidence.filter(e=>e.id!==el.dataset.id);save();render();toast("证据已移除","项目内的文件索引已删除。");
    }
    else if(action==="run-standard") startAssessment("standard",el.dataset.id);
    else if(action==="run-custom") startAssessment("custom",el.dataset.id);
    else if(action==="review-assessment") reviewAssessment(el.dataset.type,el.dataset.project,el.dataset.id);
    else if(action==="add-finding"){document.getElementById("findingEditor").insertAdjacentHTML("beforeend",findingEditorRow());}
    else if(action==="remove-finding") el.closest(".finding-item")?.remove();
    else if(action==="save-review"){
      const form=document.getElementById("reviewForm");const p=getContainer(form.dataset.type,form.dataset.project);const a=p?.assessments.find(x=>x.id===form.dataset.id);if(!a)return;const fd=new FormData(form);a.rating=fd.get("rating");a.achievementPercent=RATING_SCORE[a.rating];a.reason=fd.get("reason");a.refs=String(fd.get("refs")||"").split("\n").map(x=>x.trim()).filter(Boolean);a.reviewerNote=String(fd.get("reviewerNote")||"").trim();a.findings=[...form.querySelectorAll(".finding-item")].map(row=>({type:row.querySelector("select").value,text:row.querySelector("textarea").value.trim()})).filter(f=>f.text);a.reviewed=true;if(form.dataset.type==="standard")refreshProjectOutcome(p);p.progress=Math.min(99,Math.max(p.progress,72+Math.round(p.assessments.filter(x=>x.reviewed).length/p.assessments.length*24)));if(p.assessments.every(x=>x.reviewed))p.status="review";save();closeDrawer();render();toast("人工结论已保存","评分、证据引用、发现和复核意见已写入当前版本。");
    }
    else if(action==="preview-run") showRun(el.dataset.project,el.dataset.id);
    else if(action==="restore-run"){
      const p=db.standardProjects.find(x=>x.id===el.dataset.project);const run=p?.runs.find(x=>x.id===el.dataset.id);if(!run)return;p.runs.forEach(x=>x.status=x.id===run.id?"当前版本":"历史版本");p.assessments=deepCopy(run.assessments);save();closeModal();render();toast("已切换评估版本",`当前结果已恢复为版本 ${run.version}，其他版本仍然保留。`);
    }
    else if(action==="add-question") questionModal(el.dataset.id);
    else if(action==="edit-question"){const s=db.customSchemes.find(x=>x.id===el.dataset.scheme);questionModal(s.id,s.questions.find(q=>q.id===el.dataset.id));}
    else if(action==="delete-question"){
      const s=db.customSchemes.find(x=>x.id===el.dataset.scheme);s.questions=s.questions.filter(q=>q.id!==el.dataset.id);s.updated=new Date().toISOString();save();render();toast("问题已删除");
    }
    else if(action==="paste-questions") pasteQuestionsModal(el.dataset.id);
    else if(action==="save-question"){
      const form=document.getElementById("questionForm");if(!form.reportValidity())return;const fd=new FormData(form);const s=db.customSchemes.find(x=>x.id===form.dataset.scheme);const old=s.questions.find(q=>q.id===form.dataset.id);const val={id:old?.id||id("q"),category:fd.get("category"),text:fd.get("text"),reference:fd.get("reference")};if(old)Object.assign(old,val);else s.questions.push(val);s.updated=new Date().toISOString();save();closeModal();render();toast("审核问题已保存");
    }
    else if(action==="save-pasted-questions"){
      const form=document.getElementById("pasteQuestionsForm");const s=db.customSchemes.find(x=>x.id===form.dataset.scheme);const lines=form.elements.questions.value.split("\n").map(x=>x.replace(/^\s*[-*\d.、)]+\s*/,"").trim()).filter(Boolean);lines.forEach(text=>s.questions.push({id:id("q"),category:s.categories[0]||"未分类",text,reference:"待补充"}));s.updated=new Date().toISOString();save();closeModal();render();toast(`已导入 ${lines.length} 个问题`);
    }
    else if(action==="show-process") processDetailModal(el.dataset.id);
    else if(action==="new-audit-model"){
      openModal({title:"创建审核模型",body:`<form id="auditModelForm"><div class="form-grid"><div class="form-field full"><label>模型名称 *</label><input name="name" required placeholder="例如：组织级 ASPICE CL2 内审模型"></div><div class="form-field"><label>模型类型</label><select name="family"><option>Main Audit Model</option><option>Reference Model</option><option>Work Product / Role Reference</option></select></div><div class="form-field"><label>版本</label><input name="version" value="0.1"></div><div class="form-field"><label>节点数</label><input name="nodes" type="number" min="1" value="1"></div><div class="form-field"><label>评分 Profile</label><input name="profile" placeholder="例如：ASPICE N/P/L/F + 8档细分"></div><div class="form-field full"><small>创建后先在 Map Set 中完成 PAM BP/GP 映射，再配置 Profile；未满足完整性门禁的模型不能发布。</small></div></div></form>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" data-action="save-audit-model">创建草稿</button>`});
    }
    else if(action==="save-audit-model"){
      const form=document.getElementById("auditModelForm");if(!form?.reportValidity())return;const fd=new FormData(form);const modelId=id("MODEL").toUpperCase();db.auditModels.unshift({id:modelId,name:fd.get("name"),family:fd.get("family"),version:fd.get("version")||"0.1",nodes:Math.max(1,Number(fd.get("nodes"))||1),mapped:0,profile:fd.get("profile")||"",status:"Draft",updated:new Date().toISOString().slice(0,10)});save();closeModal();render();toast("审核模型草稿已创建","请完成 Indicator Linking、Profile 与发布前完整性检查。")
    }
    else if(action==="publish-audit-model"){
      const model=(db.auditModels||[]).find(x=>x.id===el.dataset.id);if(!model)return;if(model.mapped<model.nodes||!model.profile){toast("模型尚不能发布","需要完成全部节点映射并配置评分 Profile。","warn");return;}model.status="Published";model.updated=new Date().toISOString().slice(0,10);save();render();toast("审核模型已发布",`${model.name} ${model.version} 已冻结，可用于新评估。`);
    }
    else if(action==="new-standard-with-process"){closeModal();newStandardModal();setTimeout(()=>{const cb=document.querySelector(`#newStandardForm input[value="${el.dataset.id}"]`);if(cb)cb.checked=true;},0);}
    else if(action==="show-element-detail") openModal({title:"审核要素详情",wide:true,body:`<div class="form-grid"><div class="review-block"><h3>原文与位置</h3><p>SYS.3 BP2 · Assign system requirements · PAM 4.0 Process Dimension</p></div><div class="review-block"><h3>专业解释</h3><p>需求分配不只是建立链接，还应证明每项需求有明确责任元素、分配理由、接口影响和双向追溯。</p></div><div class="review-block"><h3>审核问题</h3><p>抽取三项系统需求，说明其分配、分解、责任元素和验证影响，并展示评审与变更记录。</p></div><div class="review-block"><h3>证据要求</h3><p>受控架构、追溯矩阵、分配决策、评审记录、变更影响与基线。</p></div><div class="review-block"><h3>常见不符合项</h3><p>复制需求但未分解；一项需求分配给多个元素却无责任边界；链接存在但语义不正确。</p></div><div class="review-block"><h3>评分与关闭建议</h3><p>缺少分配理由或双向追溯通常限制在 P；补充跨版本样本、评审闭环和受控基线后再评估。</p></div></div>`,footer:`<button class="btn secondary" data-action="close-modal">关闭</button>`});
    else if(action==="print-report") window.print();
    else if(action==="export-word-standard") exportAuditWord(db.standardProjects.find(p=>p.id===el.dataset.id),"standard");
    else if(action==="export-custom-word") exportAuditWord(db.customAudits.find(p=>p.id===el.dataset.id),"custom");
    else if(action==="export-project-list"){
      const csv="项目编号,项目名称,受审组织,产品,范围,状态,进度\n"+db.standardProjects.map(p=>[p.id,p.name,p.organization,p.product,p.processes.join(" "),STATUS_LABEL[p.status],p.progress+"%"].map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");download("ASPICE-审核项目清单.csv","\uFEFF"+csv,"text/csv;charset=utf-8");
    }
    else if(action==="export-elements") { const csv="过程,实践,名称,审核意图\n"+PROCESS_CATALOG.flatMap(p=>(PRACTICE_LIBRARY[p.id]||[]).map(x=>[p.id,...x])).map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");download("ASPICE-审核要素导出.csv","\uFEFF"+csv,"text/csv;charset=utf-8");toast("审核要素已导出"); }
    else if(action==="import-elements") toast("导入入口已就绪","生产部署时建议在服务端校验 Excel 模板、版本和重复要素。","warn");
    else if(action==="save-account") toast("个人资料已保存");
    else if(action==="save-ai"){
      event.preventDefault();const form=document.getElementById("aiConfigForm");const fd=new FormData(form);db.settings.aiEnabled=fd.get("aiEnabled")==="on";db.settings.aiMode=fd.get("aiMode");db.settings.model=fd.get("model");db.settings.baseUrl=fd.get("baseUrl").replace(/\/$/,"");db.settings.apiKey=fd.get("apiKey");save();toast("AI 配置已保存");
    }
    else if(action==="test-ai"){
      const form=document.getElementById("aiConfigForm");const fd=new FormData(form);setAIStatus(true,"连接测试中");el.disabled=true;await new Promise(r=>setTimeout(r,650));const ok=fd.get("aiMode")==="local"||/^https?:\/\//.test(fd.get("baseUrl"));setAIStatus(false);el.disabled=false;toast(ok?"AI 配置可用":"配置校验失败",ok?(fd.get("aiMode")==="local"?"本地专业规则引擎已就绪。":"接口地址格式有效；正式调用时将按 Responses 兼容协议连接。 "):"请填写有效的 HTTP(S) Base URL。",ok?"success":"warn");
    }
    else if(action==="test-mcp") toast("MCP 工具目录已就绪","4 个评估工具均受角色权限、项目范围和人工确认护栏约束。");
    else if(action==="save-helix-settings"){
      event.preventDefault();const form=document.getElementById("helixConfigForm");const fd=new FormData(form);db.settings.helixAutoDetect=fd.get("helixAutoDetect")==="on";db.settings.helixRequireIdentity=fd.get("helixRequireIdentity")==="on";db.settings.helixMaxRows=Math.max(20,Math.min(200,Number(fd.get("helixMaxRows"))||60));save();toast("Helix 解析设置已保存");
    }
    else if(action==="test-helix-parser") toast(typeof JSZip!=="undefined"?"Helix 解析器已就绪":"Helix 解析器未加载",typeof JSZip!=="undefined"?"支持 XLSX/XLSM、DOCX、PPTX、PDF、CSV、JSON 与 HTML 表格的本地读取。":"请通过 AuditFlow 本地服务启动页面。",typeof JSZip!=="undefined"?"success":"warn");
    else if(action==="export-workspace") download(`auditflow-workspace-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(db,null,2),"application/json");
    else if(action==="reset-workspace") openModal({title:"恢复演示数据",body:`<div class="review-block"><h3>此操作会覆盖当前工作区</h3><p>所有新建项目、上传证据索引、人工评分和设置将被演示数据替换。建议先导出工作区备份。</p></div>`,footer:`<button class="btn secondary" data-action="close-modal">取消</button><button class="btn danger" data-action="confirm-reset">确认恢复</button>`});
    else if(action==="confirm-reset"){db=seedDatabase();save();closeModal();location.hash="#/dashboard";render();toast("演示数据已恢复");}
    else if(action==="search-result"){const projectId=el.dataset.project,recordId=el.dataset.record;closeModal();if(projectId&&recordId){event.preventDefault();ui.projectTab="conduct";ui.pendingRecordId=recordId;location.hash=`#/standard/${projectId}`;if(parseRoute()[1]===projectId)render();}}
    else if(["clone-element-set","publish-elements","new-prompt","preview-prompt","edit-prompt","new-report-template","edit-report-template","new-guideline","edit-guideline","new-overlay","edit-overlay","new-record-template","edit-record-template","new-map-set","edit-map-set"].includes(action)) toast("功能已进入方法库工作流",action.includes("publish")?"当前要素集已标记为发布版本。":"本地版保留完整入口；服务化部署后可保存版本与权限范围。");
  });

  document.addEventListener("change", event => {
    const attachmentInput=event.target.closest("#recordAttachmentPicker");
    if(attachmentInput){
      const files=[...attachmentInput.files],oversized=files.filter(file=>file.size>=MAX_ATTACHMENT_SIZE),accepted=files.filter(file=>file.size<MAX_ATTACHMENT_SIZE);
      if(oversized.length)toast("部分附件未添加",`${oversized.map(file=>file.name).join("、")} 必须严格小于 2 MiB。`,"warn");
      accepted.forEach(file=>{const metadata=attachmentMetadata(file);pendingRecordAttachments.set(metadata.id,{metadata,file});});
      const list=document.getElementById("recordAttachmentList");if(list){list.querySelector(".attachment-empty")?.remove();list.insertAdjacentHTML("beforeend",accepted.map(file=>{const entry=[...pendingRecordAttachments.values()].find(item=>item.file===file);return attachmentMarkup(entry.metadata,true);}).join(""));hydrateAttachmentImages(list);}
      attachmentInput.value="";return;
    }
    const el=event.target;
    if(el.matches("#helixImportPanel input")){syncHelixInputs();return;}
    if(el.matches("[data-rating-change]")){const p=getContainer(el.dataset.type,el.dataset.project);const a=p?.assessments.find(x=>x.id===el.dataset.id);if(a){a.rating=el.value;a.achievementPercent=RATING_SCORE[a.rating];a.reviewed=true;if(el.dataset.type==="standard"){refreshProjectOutcome(p);const key=indicatorKey(a);const guideline=p.guidelines.find(g=>g.indicator===key);if(guideline){const hasWeakness=p.records.some(r=>r.type==="weakness"&&r.indicators.includes(key));guideline.state=RATING_SCORE[a.rating]<85&&!hasWeakness?"broken":"ok";guideline.handled=false;guideline.comment=guideline.state==="broken"?"评分低于 F，但未找到关联弱项记录。":"";}}save();toast("人工评分已更新",`${a.process||""} ${a.code} 已调整为 ${a.rating}。`);}}
    if(el.matches("[data-setting]")){db.settings[el.dataset.setting]=el.checked;save();}
    if(el.matches("[data-filter='standard']")){document.querySelectorAll("#standardRows tr[data-status]").forEach(row=>row.hidden=el.value!=="all"&&row.dataset.status!==el.value);}
    if(el.matches("[data-action-select='instance']")){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p){p.activeInstanceId=el.value;save();render();}}
    if(el.matches("[data-action-select='workspace']")){const p=db.standardProjects.find(x=>x.id===el.dataset.project);if(p){p.activeWorkspaceId=el.value;save();render();}}
    if(el.matches("[data-record-filter]")){ui.recordFilter=el.value;render();}
    if(el.matches("[data-record-template]")){const t=db.recordTemplates.find(x=>x.id===el.value);const form=document.getElementById("recordForm");if(t&&form){form.elements.type.value=t.type;form.elements.text.value=t.text;form.elements.indicators.value=t.indicators.join(", ");}}
  });

  document.addEventListener("input", event => {
    const el=event.target;
    if(el.matches("[data-table-search='standard']")){const q=el.value.toLowerCase();document.querySelectorAll("#standardRows tr[data-search-text]").forEach(row=>row.hidden=!row.dataset.searchText.includes(q));}
    if(el.matches("[data-process-search]")){const q=el.value.toLowerCase();document.querySelectorAll("#processGrid [data-process-search-text]").forEach(card=>card.hidden=!card.dataset.processSearchText.includes(q));}
  });

  document.addEventListener("dragover", event=>{const dz=event.target.closest(".dropzone");if(dz){event.preventDefault();dz.classList.add("drag");}});
  document.addEventListener("dragleave", event=>event.target.closest(".dropzone")?.classList.remove("drag"));
  document.addEventListener("drop", event=>{const dz=event.target.closest(".dropzone");if(!dz)return;event.preventDefault();dz.classList.remove("drag");ui.evidenceTarget={type:dz.dataset.type,id:dz.dataset.id};handleEvidenceFiles([...event.dataTransfer.files]);});
  document.getElementById("evidencePicker").addEventListener("change",event=>{handleEvidenceFiles([...event.target.files]);event.target.value="";});
  document.getElementById("globalSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();globalSearch(event.target.value);}});
  document.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();document.getElementById("globalSearch").focus();}if(event.key==="Escape"){closeModal();closeDrawer();document.getElementById("sidebar").classList.remove("open");}const shortcut={s:"strength",w:"weakness",r:"recommendation",o:"observation",c:"comment",q:"question"}[event.key.toLowerCase()];if(shortcut&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.target.matches("input,textarea,select")&&!modalRoot.children.length&&!drawerRoot.children.length){const route=parseRoute();if(route[0]==="standard"&&route[1]&&route[1]!=="report"&&ui.projectTab==="conduct"){const p=db.standardProjects.find(x=>x.id===route[1]);if(p){event.preventDefault();recordModal(p,null,ui.activeIndicator);setTimeout(()=>{const select=document.querySelector("#recordForm [name=type]");if(select)select.value=shortcut;},0);}}}});
  document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("notificationsBtn").addEventListener("click",()=>toast("没有新的阻塞通知","CDD 项目仍有 11 项建议人工复核。"));
  window.addEventListener("message", event => {
    const message = event.data;
    if (!message || message.protocol !== ASPICE_BRIDGE_PROTOCOL || !message.transferId) return;
    const transfer = aspiceTransfers.get(message.transferId);
    if (!transfer || event.source !== transfer.receiver || message.nonce !== transfer.nonce) return;
    if (message.kind === "receiver-ready") {
      transfer.receiver.postMessage(transfer.payload, "*");
      return;
    }
    if (message.kind !== "import-result") return;
    window.clearTimeout(transfer.timeout);
    aspiceTransfers.delete(message.transferId);
    if (message.ok) {
      const project = db.standardProjects.find(item => item.id === transfer.projectId);
      if (project) {
        project.logs ||= [];
        project.logs.unshift({ id: id("log"), date: new Date().toISOString(), action: "Export", user: project.owner || "AuditFlow", comment: `受控移交至 aspice-audit-master：${message.transferId}，导入 ${Number(message.importedCount || 0)} 项` });
        save();
      }
      toast("aspice-audit-master 已接收", `资料包 ${message.transferId} 已导入，目标页面已进入证据分析。`);
    } else {
      toast("aspice-audit-master 导入失败", message.error || "目标工具未能接收审核资料。", "warn");
    }
  });
  window.addEventListener("hashchange",()=>{document.getElementById("sidebar").classList.remove("open");render();});
  window.addEventListener("storage",event=>{if(event.key!==DB_KEY||!event.newValue)return;try{const incoming=migrateDatabase(JSON.parse(event.newValue));if(incoming){db=incoming;if(parseRoute()[0]==="dashboard")render();}}catch(_){}});
  setInterval(()=>{if(document.visibilityState==="visible"&&parseRoute()[0]==="dashboard"&&!modalRoot.children.length&&!drawerRoot.children.length){renderDashboard();injectIcons(app);}},5000);

  injectIcons();
  render();
})();
