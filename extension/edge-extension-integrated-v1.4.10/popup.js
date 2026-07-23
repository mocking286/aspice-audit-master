const LOCAL_APP_URL = "file:///C:/Users/YuMeng%20Li/OneDrive%20-%20JE/Desktop/aspice-audit-master-refactored/aspice-audit-master.html?page=initial";
const SUPPORTED_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx", "xlsm", "pdf"]);

const fileInput = document.getElementById("evidenceFiles");
const summary = document.getElementById("fileSummary");
const openButton = document.getElementById("openApp");
const bridgeStatus = document.getElementById("bridgeStatus");

function getExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function updateSelection() {
  const files = Array.from(fileInput.files || []);
  openButton.disabled = false;
  summary.classList.remove("error", "ready");

  if (!files.length) {
    summary.textContent = "尚未选择文件。可先打开初始页，在知识库和基础信息页查看参考内容。";
    return;
  }

  if (files.length > 3) {
    summary.textContent = "一次最多选择 3 份文件。请减少后重试。";
    summary.classList.add("error");
    return;
  }

  const unsupported = files.filter(file => !SUPPORTED_EXTENSIONS.has(getExtension(file.name)));
  if (unsupported.length) {
    summary.textContent = `不支持的文件类型：${unsupported.map(file => file.name).join(", ")}`;
    summary.classList.add("error");
    return;
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  summary.textContent = `${files.length} file(s) selected, total ${formatSize(total)}. 打开工作台后请在页面内上传，解析完成会自动进入证据展示页。`;
  summary.classList.add("ready");
  openButton.disabled = false;
}

async function checkBridge() {
  bridgeStatus.classList.remove("ready", "failed");
  bridgeStatus.textContent = "checking...";
  try {
    const response = await fetch("http://127.0.0.1:8787/health", { cache: "no-store" });
    if (response.ok) {
      bridgeStatus.textContent = "ready";
      bridgeStatus.classList.add("ready");
    } else {
      bridgeStatus.textContent = `HTTP ${response.status}`;
      bridgeStatus.classList.add("failed");
    }
  } catch (error) {
    bridgeStatus.textContent = "not reachable";
    bridgeStatus.classList.add("failed");
  }
}

fileInput.addEventListener("change", updateSelection);
document.getElementById("checkBridge").addEventListener("click", checkBridge);
openButton.addEventListener("click", () => {
  const files = Array.from(fileInput.files || []);
  if (files.length > 3) {
    updateSelection();
    return;
  }
  chrome.tabs.create({ url: LOCAL_APP_URL }, () => {
    if (chrome.runtime.lastError) {
      summary.textContent = `无法打开本机页面：${chrome.runtime.lastError.message}`;
      summary.classList.add("error");
    }
  });
});

updateSelection();
checkBridge();
