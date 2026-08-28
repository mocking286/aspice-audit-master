# AuditFlow Codex local bridge

Run start-auditflow-codex-bridge.cmd to start the optional local AI service.

The bridge serves AuditFlow on http://127.0.0.1:4173, detects the presence of
local Codex or VS Code configuration without reading or displaying credentials,
and accepts a Virtual Key only through the in-app Account / AI settings flow.

When no explicit Virtual Key is configured, a logged-in local Codex CLI session
can serve AI opinion requests. The bridge checks only the CLI exit status and
passes the assessment prompt over stdin; it does not expose account details,
configuration contents, tokens, or CLI stderr to the browser.

If the bridge is not available, AuditFlow remains usable with local parsing,
manual assessment, evidence management, version comparison, and the local
ASPICE rule fallback.
