(function () {
  "use strict";

  const isWebsite = ["http:", "https:"].includes(location.protocol);
  const gate = document.getElementById("authGate");
  const shell = document.querySelector(".app-shell");
  const state = { mode: "login", busy: false };
  const AUTH_DB_KEY = "auditflow-ai-workspace-v1";
  const AUTH_SESSION_KEY = "auditflow-server-session-v1";
  const AUTH_ENDPOINT_KEY = "auditflow-auth-endpoint-v1";
  const DEFAULT_EXTENSION_ENDPOINT = "http://120.25.197.24";
  const existingProfile = !isWebsite ? window.MicrosoftAuth?.profile || null : null;
  window.AuditFlowAuth = { authenticated: !!existingProfile || isWebsite, user: existingProfile, logout: null, endpoint: "", sessionToken: sessionStorage.getItem(AUTH_SESSION_KEY) || "" };

  if (!gate || !shell) return;
  shell.inert = true;
  shell.setAttribute("aria-hidden", "true");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
  }

  function initials(user) {
    return String(user?.name || user?.email || "AF").split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "AF";
  }

  function endpoint() {
    try {
      const stored = JSON.parse(localStorage.getItem(AUTH_DB_KEY) || "null");
      const configured = stored?.settings?.collaborationSyncUrl || stored?.settings?.backendUrl || "";
      const remembered = localStorage.getItem(AUTH_ENDPOINT_KEY) || "";
      const candidate = remembered || configured;
      const localOnly = /^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\/?$/i.test(candidate);
      // A localhost value can be left behind by a local preview. Never let that
      // stale setting break the hosted workbench; use the current origin there.
      const value = isWebsite ? (!candidate || localOnly ? location.origin : candidate) : (candidate && !localOnly ? candidate : DEFAULT_EXTENSION_ENDPOINT);
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid endpoint");
      return url.origin;
    } catch (_) { return isWebsite ? location.origin : DEFAULT_EXTENSION_ENDPOINT; }
  }

  function setEndpoint(value) {
    const url = new URL(String(value || endpoint()).trim());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error(authLanguage() === "en" ? "The collaboration service URL must use HTTP or HTTPS" : "协作服务地址必须使用 HTTP 或 HTTPS");
    localStorage.setItem(AUTH_ENDPOINT_KEY, url.origin);
    return url.origin;
  }

  function authLanguage() {
    try {
      const stored = JSON.parse(localStorage.getItem(AUTH_DB_KEY) || "null");
      return stored?.settings?.language === "zh-CN" ? "zh-CN" : "en";
    } catch (_) { return "en"; }
  }

  function authCopy() {
    if (authLanguage() === "zh-CN") return {
      title: "登录 AuditFlow", registerTitle: "注册审核员账号", loginDescription: "登录后才能访问项目材料、评估结果和协作功能。", registerDescription: "创建账号后进入项目、证据链、AI 评审与协作工作区。", login: "登录", register: "注册", name: "姓名", assessorName: "审核员姓名", service: "协作服务地址", email: "工作邮箱", password: "密码", passwordPlaceholder: "至少 10 个字符", submitLogin: "登录并进入工作台", submitRegister: "注册并进入工作台", validating: "正在验证…", note: "账号会与 AuditFlow 服务器会话绑定；密码只在本次提交时使用，不写入插件、源码或本地工作区。"
    };
    return {
      title: "Sign in to AuditFlow", registerTitle: "Create assessor account", loginDescription: "Sign in to access project materials, assessment results and collaboration.", registerDescription: "Create an account to enter projects, evidence chains, AI review and collaboration.", login: "Sign in", register: "Register", name: "Name", assessorName: "Assessor name", service: "Collaboration service URL", email: "Work email", password: "Password", passwordPlaceholder: "At least 10 characters", submitLogin: "Sign in and open workspace", submitRegister: "Register and open workspace", validating: "Verifying…", note: "Your account is bound to an AuditFlow server session. The password is used only for this submission and is never written to the extension, source or local workspace."
    };
  }

  async function authRequest(path, options = {}) {
    const base = endpoint();
    window.AuditFlowAuth.endpoint = base;
    const headers = { ...(options.headers || {}) };
    if (window.AuditFlowAuth.sessionToken) headers["x-auditflow-session"] = window.AuditFlowAuth.sessionToken;
    return fetch(`${base}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  }

  function render() {
    const register = state.mode === "register";
    const copy = authCopy();
    gate.hidden = false;
    gate.innerHTML = `<main class="auth-panel" aria-labelledby="authTitle">
      <div class="auth-brand"><span class="auth-mark" aria-hidden="true"><i></i><i></i><i></i></span><div><strong>AuditFlow</strong><small>ASPICE WORKSPACE</small></div></div>
      <div class="auth-heading"><span class="overline">SECURE ASSESSMENT ACCESS</span><h1 id="authTitle">${register ? copy.registerTitle : copy.title}</h1><p>${register ? copy.registerDescription : copy.loginDescription}</p></div>
      <div class="auth-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!register}" class="${!register ? "active" : ""}" data-auth-mode="login">${copy.login}</button>${isWebsite ? `<button type="button" role="tab" aria-selected="${register}" class="${register ? "active" : ""}" data-auth-mode="register">${copy.register}</button>` : ""}</div>
      <form id="authForm" class="auth-form" novalidate>
        ${register ? `<label>${copy.name}<input name="displayName" autocomplete="name" minlength="2" maxlength="160" required placeholder="${copy.assessorName}"></label>` : ""}
        <label>${copy.service}<input name="endpoint" type="url" inputmode="url" required value="${escapeHtml(endpoint())}" placeholder="http://120.25.197.24"></label>
        <label>${copy.email}<input name="email" type="email" autocomplete="email" maxlength="320" required placeholder="name@company.com"></label>
        <label>${copy.password}<input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="10" maxlength="200" required placeholder="${copy.passwordPlaceholder}"></label>
        <p class="auth-error" id="authError" role="alert" hidden></p>
        <button class="auth-submit" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? copy.validating : register ? copy.submitRegister : copy.submitLogin}</button>
      </form>
      <p class="auth-note">${copy.note}</p>
    </main>`;
    gate.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => { state.mode = button.dataset.authMode; render(); }));
    gate.querySelector("#authForm")?.addEventListener("submit", submit);
    gate.querySelector("input")?.focus();
  }

  function reveal(user, sessionToken = "") {
    window.AuditFlowAuth.authenticated = true;
    window.AuditFlowAuth.user = user;
    if (sessionToken) { window.AuditFlowAuth.sessionToken = sessionToken; sessionStorage.setItem(AUTH_SESSION_KEY, sessionToken); }
    shell.inert = false;
    shell.removeAttribute("aria-hidden");
    gate.hidden = true;
    gate.innerHTML = "";
    document.documentElement.classList.remove("auth-pending");
    const avatar = document.querySelector(".profile-link .avatar");
    if (avatar) avatar.textContent = initials(user);
    const account = document.getElementById("authAccountButton");
    if (account) {
      account.hidden = false;
      account.textContent = `${user?.email || user?.name || "账户"}`;
      account.title = "打开账号菜单";
      account.setAttribute("aria-label", `当前账号 ${user?.email || user?.name || "账户"}`);
    }
    window.AuditFlowAuth.logout = logout;
    window.dispatchEvent(new CustomEvent("auditflow-authenticated", { detail: user }));
  }

  function accountMenu() {
    let menu = document.getElementById("authAccountMenu");
    if (menu) { menu.remove(); return; }
    const account = document.getElementById("authAccountButton");
    if (!account) return;
    menu = document.createElement("div");
    menu.id = "authAccountMenu";
    menu.className = "auth-account-menu";
    menu.innerHTML = `<strong>${escapeHtml(window.AuditFlowAuth.user?.email || (authLanguage() === "en" ? "Account" : "账户"))}</strong><button type="button" data-auth-menu-action="logout">${authLanguage() === "en" ? "Sign out" : "退出当前账号"}</button><button type="button" data-auth-menu-action="switch">${authLanguage() === "en" ? "Switch account" : "切换账号"}</button>`;
    account.parentElement?.appendChild(menu);
    menu.querySelectorAll("[data-auth-menu-action]").forEach(button => button.addEventListener("click", () => logout(button.dataset.authMenuAction === "switch")));
  }

  async function logout(showLogin = false) {
    try { await authRequest("/api/auth/logout", { method: "POST" }); } catch (_) {}
    window.MicrosoftAuth?.clear();
    window.AuditFlowAuth.sessionToken = "";
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.AuditFlowAuth.authenticated = false;
    window.AuditFlowAuth.user = null;
    document.getElementById("authAccountMenu")?.remove();
    const account = document.getElementById("authAccountButton");
    if (account) { account.hidden = false; account.textContent = "登录"; account.title = "登录 AuditFlow"; account.setAttribute("aria-label", "登录 AuditFlow"); }
    window.dispatchEvent(new CustomEvent("auditflow-logged-out"));
    if (showLogin || !isWebsite) { shell.inert = true; shell.setAttribute("aria-hidden", "true"); render(); }
    else location.reload();
  }

  async function submit(event) {
    event.preventDefault();
    if (state.busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try { setEndpoint(data.endpoint); } catch (error) {
      const errorBox = form.querySelector("#authError");
      if (errorBox) { errorBox.hidden = false; errorBox.textContent = error.message; }
      return;
    }
    delete data.endpoint;
    state.busy = true;
    render();
    try {
      const response = await authRequest(`/api/auth/${state.mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || (authLanguage() === "en" ? "Authentication failed. Please try again." : "认证失败，请稍后重试"));
      reveal(payload.user, payload.sessionToken || "");
    } catch (error) {
      state.busy = false;
      render();
      const current = document.getElementById("authError");
      if (current) { current.hidden = false; current.textContent = error instanceof TypeError ? (authLanguage() === "en" ? "Cannot reach the collaboration service. Check the URL and confirm that the AuditFlow v8.8 server is deployed." : "无法连接协作服务。请检查服务地址，并确认已部署 v8.8 协作服务器包。") : error.message || (authLanguage() === "en" ? "Authentication failed. Please try again." : "认证失败，请稍后重试"); }
    }
  }

  async function bootstrap() {
    try {
      const response = await authRequest("/api/auth/me");
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.user) reveal(payload.user, payload.sessionToken || "");
      else if (isWebsite) {
        const healthResponse = await authRequest("/api/health");
        const health = await healthResponse.json().catch(() => ({}));
        if (healthResponse.ok && health.database?.configured === false) reveal({ id: "local-preview", name: "Local Preview", email: "yumeng.li@johnsonelectric.com", isAdmin: true });
        else render();
      } else render();
    } catch (_) {
      state.mode = "login";
      render();
      const error = document.getElementById("authError");
      if (error && isWebsite) { error.hidden = false; error.textContent = authLanguage() === "en" ? "Cannot reach the authentication service. Check the server status." : "无法连接认证服务，请检查服务器状态。"; }
    }
  }

  document.addEventListener("click", event => {
    const account = event.target.closest("#authAccountButton");
    if (account) { event.preventDefault(); if (!window.AuditFlowAuth.authenticated) render(); else accountMenu(); return; }
    if (!event.target.closest("#authAccountMenu")) document.getElementById("authAccountMenu")?.remove();
  });
  if (!isWebsite && existingProfile) reveal(existingProfile);
  bootstrap();
}());
