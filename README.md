# aspice-audit-master

ASPICE audit assistant prototype for local evidence parsing, Helix ALM snapshot support, BP/GP scoring candidates, and Codex-assisted assessor advice.

## Current package

- `app/aspice-audit-master.html`: standalone web application.
- `bridge/aspice-codex-bridge.ps1`: local bridge for Codex and Helix ALM REST access.
- `extension/edge-extension-integrated-v1.4.10`: Edge extension source bundle.
- `dist/`: packaged CRX and delivery ZIP.
- `docs/`: project introduction and Sharpen360 Trace gap assessment report.
- `scripts/`: report generator and GitHub API upload helper.

## Notes

Original Sharpen360 Trace PDF files and extracted text are not included because the target repository is public. The generated gap report summarizes the uploaded reference materials without publishing the source documents.

Do not commit local credentials, Helix passwords, Codex/OpenAI keys, `.pem` extension private keys, or `aspice-audit-memory.json`.
