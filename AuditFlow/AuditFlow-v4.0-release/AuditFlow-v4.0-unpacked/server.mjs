import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDir, "..");
const port = Number(process.env.AUDITFLOW_PORT || 4173);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://127.0.0.1:${port}`).pathname);
  if (pathname === "/") return path.join(repositoryRoot, "web", "index.html");
  const candidate = path.resolve(repositoryRoot, `.${pathname}`);
  return candidate.startsWith(repositoryRoot + path.sep) ? candidate : null;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

function responsesEndpoint(baseUrl) {
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Base URL must use HTTP(S)");
  return parsed.pathname.endsWith("/responses") ? parsed.toString() : `${parsed.toString().replace(/\/$/, "")}/responses`;
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonOutput(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch (_) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Provider returned invalid JSON");
  }
}

const indicatorAssessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assessments"],
  properties: {
    assessments: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["process","code","rating","confidence","reason","findings","evidenceAnalysis","crossProcessAnalysis","scoreBreakdown","interviewQuestions","closureEvidence"],
        properties: {
          process: { type: "string" },
          code: { type: "string" },
          rating: { type: "string", enum: ["N","P-","P","P+","L-","L","L+","F"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          findings: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["type","text"], properties: { type: { type: "string", enum: ["O","W","R"] }, text: { type: "string" } } } },
          evidenceAnalysis: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["evidenceCode","claim","locator","excerpt","strength"], properties: { evidenceCode: { type: "string" }, claim: { type: "string" }, locator: { type: "string" }, excerpt: { type: "string" }, strength: { type: "string", enum: ["direct","corroborating","index-only"] } } } },
          crossProcessAnalysis: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["sourceProcess","targetProcess","relationType","scopeStatus","analysisPasses","evidenceCodes","supportedClaim","gapOrRisk","followUp"], properties: {
            sourceProcess: { type: "string" }, targetProcess: { type: "string" }, relationType: { type: "string" }, scopeStatus: { type: "string", enum: ["in-scope","related-only"] },
            analysisPasses: { type: "array", maxItems: 4, items: { type: "string", enum: ["qualified-flow","agree-summarize","divide-control","trace-consistency"] } },
            evidenceCodes: { type: "array", maxItems: 5, items: { type: "string" } }, supportedClaim: { type: "string" }, gapOrRisk: { type: "string" }, followUp: { type: "string" }
          } } },
          scoreBreakdown: { type: "object", additionalProperties: false, required: ["definition","implementation","consistency","governance","closure"], properties: { definition:{type:"integer",minimum:0,maximum:100}, implementation:{type:"integer",minimum:0,maximum:100}, consistency:{type:"integer",minimum:0,maximum:100}, governance:{type:"integer",minimum:0,maximum:100}, closure:{type:"integer",minimum:0,maximum:100} } },
          interviewQuestions: { type: "array", maxItems: 4, items: { type: "string" } },
          closureEvidence: { type: "array", maxItems: 4, items: { type: "string" } }
        }
      }
    }
  }
};

async function callResponsesProvider({ baseUrl, model, apiKey, requestBody, timeoutMs = 90000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { "content-type": "application/json" };
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (key) headers.authorization = `Bearer ${key}`;
  try {
    const providerResponse = await fetch(responsesEndpoint(baseUrl), { method: "POST", headers, body: JSON.stringify(requestBody), signal: controller.signal });
    const payload = await providerResponse.json().catch(() => ({}));
    return { ok: providerResponse.ok, status: providerResponse.status, payload };
  } finally { clearTimeout(timeout); }
}

const server = http.createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: "ok", app: "AuditFlow AI" }));
    return;
  }
  if (request.method === "POST" && request.url === "/api/ai/opinion") {
    try {
      const body = await readJsonBody(request);
      if (!body.baseUrl || !body.model || !body.prompt) throw new Error("Missing baseUrl, model, or prompt");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const headers = { "content-type": "application/json" };
      if (body.apiKey) headers.authorization = `Bearer ${body.apiKey}`;
      const providerResponse = await fetch(responsesEndpoint(body.baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({ model: body.model, input: body.prompt, store: false }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const payload = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok) throw new Error(payload.error?.message || `Provider returned ${providerResponse.status}`);
      const output = extractOutputText(payload);
      if (!output) throw new Error("Provider returned no text output");
      sendJson(response, 200, { output });
    } catch (error) {
      sendJson(response, 502, { error: error.name === "AbortError" ? "Model request timed out" : error.message });
    }
    return;
  }
  if (request.method === "POST" && request.url === "/api/ai/assess-indicators") {
    try {
      const body = await readJsonBody(request);
      if (!body.baseUrl || !body.model || !Array.isArray(body.indicators) || !body.indicators.length) throw new Error("Missing baseUrl, model, or indicators");
      if (body.indicators.length > 8) throw new Error("A maximum of 8 indicators is allowed per batch");
      const evidenceCodes = (body.evidence || []).map(item => item.code).filter(Boolean);
      const prompt = `你是一名具备 Automotive SPICE PAM 4.0 经验的主任评估师。请逐项复核 BP/GP 的候选评分，并输出严格 JSON。\n\n不可违反的护栏：\n1. 只能引用输入中存在的 Evidence Code，不得编造文件、章节、访谈或执行事实。\n2. 区分流程定义、项目实施、跨样本一致性、受控状态和问题闭环；文件名或元数据只能算 index-only。\n3. 只有目标过程自身、可定位且直接证明指标的内容才能算 direct；上游、下游、MAN.3、SUP.1、SUP.8、SUP.9、SUP.10 的证据默认只能算 corroborating，不能替代目标过程直接证据。\n4. 无直接或间接证据必须评 N；仅元数据不得超过 P+；只有一条直接证据不得超过 L-；达到 F 必须有多来源直接证据且证明跨周期稳定闭环。\n5. 对每个指标执行四遍跨过程分析：(a) qualified-flow 合格输入到合格输出；(b) agree-summarize 约定及汇总沟通；(c) divide-control 分解、委派、集成与控制；(d) trace-consistency 双向追溯、语义一致、影响分析和覆盖完整性。\n6. 对正式范围内过程输出 BP/GP 候选评分；范围外关联过程只输出 scopeStatus=related-only 的非评级观察。\n7. SUP.9 的问题应检查是否触发 SUP.10 变更并双向追溯；SUP.10 应追踪所有受影响工作产品和相关问题；SUP.8 的配置状态应支持 MAN.3 进展与发布基线；MAN.3 应检查全部工程和支撑过程的接口、承诺、计划一致性与纠正措施。\n8. 对 Helix 表格必须使用给定的 Sheet/Slide/Page、表名、行号和字段名定位；ID、状态、责任、版本/基线、上下游关系、影响/关闭字段需联合判断。仅存在链接值不能证明关系语义正确，仅存在 Closed 状态不能证明验证与授权关闭。\n9. 每项理由需说明读了什么证据、沿哪条关系分析、支持了什么、仍未证明什么、为什么影响或不影响正式评分，以及最小关闭证据。\n10. O 是客观事实，W 是对标准判据的差距，R 是可执行且可验证的建议。AI 只给候选结论，不宣称正式认证。\n\n允许引用的 Evidence Code：${evidenceCodes.join(", ") || "无"}\n\n项目、关系模型和逐项输入：\n${JSON.stringify({project:body.project,relationModel:body.relationModel,evidence:body.evidence,indicators:body.indicators})}`;
      const structuredBody = { model: body.model, input: prompt, store: false, text: { format: { type: "json_schema", name: "aspice_indicator_assessments", strict: true, schema: indicatorAssessmentSchema } } };
      let result = await callResponsesProvider({baseUrl:body.baseUrl,model:body.model,apiKey:body.apiKey,requestBody:structuredBody});
      if (!result.ok) {
        const fallbackBody = { model: body.model, input: `${prompt}\n\n只返回符合指定结构的 JSON 对象，不要 Markdown。`, store: false };
        result = await callResponsesProvider({baseUrl:body.baseUrl,model:body.model,apiKey:body.apiKey,requestBody:fallbackBody});
      }
      if (!result.ok) throw new Error(result.payload.error?.message || `Provider returned ${result.status}`);
      const output = extractOutputText(result.payload);
      if (!output) throw new Error("Provider returned no output");
      const parsed = parseJsonOutput(output);
      if (!Array.isArray(parsed.assessments)) throw new Error("Provider JSON does not include assessments");
      sendJson(response, 200, { assessments: parsed.assessments });
    } catch (error) {
      sendJson(response, 502, { error: error.name === "AbortError" ? "Model request timed out" : error.message });
    }
    return;
  }
  let target = resolveRequestPath(request.url || "/");
  if (!target) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, "index.html");
    const body = await readFile(target);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AuditFlow AI running at http://127.0.0.1:${port}/web/`);
});
