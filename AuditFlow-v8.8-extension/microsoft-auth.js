/* Microsoft Entra public-client sign-in for the MV3 extension.
 * Tokens stay in sessionStorage and are sent only as bearer tokens to the
 * configured AuditFlow API. No client secret is ever used in the extension.
 */
(function () {
  "use strict";
  const STORAGE_KEY = "auditflow-ms-session-v1";

  function base64Url(bytes) {
    let binary = "";
    new Uint8Array(bytes).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function randomText(size = 32) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    return base64Url(bytes);
  }
  async function challenge(verifier) {
    return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  }
  function redirectUrl() {
    return globalThis.chrome?.identity?.getRedirectURL ? chrome.identity.getRedirectURL("microsoft") : `${location.origin}/auth-callback`;
  }
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return null; }
  }
  function decodeIdToken(value) {
    try {
      const encoded = String(value || "").split(".")[1];
      if (!encoded) return null;
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      const claims = JSON.parse(atob(normalized));
      const email = String(claims.email || claims.preferred_username || claims.upn || "").trim().toLowerCase();
      return email ? { id: String(claims.oid || claims.sub || email), email, name: String(claims.name || email).trim() } : null;
    } catch (_) { return null; }
  }
  function storeSession(session) {
    if (!session) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("auditflow-auth-changed", { detail: session }));
  }
  function launch(url) {
    if (!globalThis.chrome?.identity?.launchWebAuthFlow) throw new Error("Microsoft 登录需要在 Edge 扩展页面中启动");
    return new Promise((resolve, reject) => chrome.identity.launchWebAuthFlow({ interactive: true, url }, result => {
      const error = chrome.runtime?.lastError;
      if (error) reject(new Error(error.message || "Microsoft 登录被取消"));
      else if (!result) reject(new Error("Microsoft 登录没有返回回调"));
      else resolve(result);
    }));
  }
  const MicrosoftAuth = {
    get session() { return loadSession(); },
    get profile() { return loadSession()?.profile || null; },
    get accessToken() {
      const session = loadSession();
      return session && Number(session.expiresAt || 0) > Date.now() + 30_000 ? session.accessToken : "";
    },
    clear() { storeSession(null); },
    async signIn({ tenantId = "common", clientId, scopes = [], authority = "https://login.microsoftonline.com" } = {}) {
      if (!clientId) throw new Error("请先配置 Microsoft SPA Client ID");
      const state = randomText();
      const verifier = randomText(48);
      const redirect = redirectUrl();
      const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirect, response_mode: "query", scope: ["openid", "profile", "email", ...scopes].filter(Boolean).join(" "), state, code_challenge: await challenge(verifier), code_challenge_method: "S256" });
      const callback = await launch(`${authority}/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params}`);
      const callbackUrl = new URL(callback);
      if (callbackUrl.searchParams.get("state") !== state) throw new Error("Microsoft 登录状态校验失败");
      if (callbackUrl.searchParams.get("error")) throw new Error(callbackUrl.searchParams.get("error_description") || callbackUrl.searchParams.get("error"));
      const code = callbackUrl.searchParams.get("code");
      if (!code) throw new Error("Microsoft 登录没有返回授权码");
      const tokenResponse = await fetch(`${authority}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier }) });
      const payload = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !payload.access_token) throw new Error(payload.error_description || "Microsoft token exchange failed");
      const profile = decodeIdToken(payload.id_token);
      if (!profile) throw new Error("Microsoft 登录未返回可验证的账户邮箱");
      storeSession({ accessToken: payload.access_token, idToken: payload.id_token || "", profile, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 });
      return loadSession();
    }
  };
  window.MicrosoftAuth = MicrosoftAuth;
})();
