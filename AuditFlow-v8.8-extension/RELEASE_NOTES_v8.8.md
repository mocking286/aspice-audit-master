# AuditFlow v8.8.0 Release Notes

## Trace-informed review workbench

- Tree View keeps the Process → PA → BP/GP hierarchy visible while Grid View presents one assessment row at a time with the assessor records, evidence coverage and rating controls beside it.
- List View keeps trace relations in the center and an Evidence Inventory on the right, with locators, file item type, file class, rank, filters and assessor confirmation.
- Direct, Corroborating and Index-only evidence remain separate; related-process evidence supports consistency and governance observations but cannot replace target-process direct evidence.

## Editable AI review details

- The AI Review “Review details” action opens an editable review workspace without an item-level collaboration lock or a locked evidence-chain banner.
- Assessor edits remain subject to role and process-scope permissions. AI output is still advisory and never overwrites the human rating, evidence confirmation, mapping calibration, baseline approval or closure state.
- Cloud collaboration remains available at project level. Lead Assessor/Administrator snapshots can be synchronized from the project collaboration controls; local edits are explicitly retained when the service is unavailable.

## English default and release metadata

- New workspaces start in English. Existing explicit language selections are preserved.
- Forms, Version history, Close & report, Scope & evidence, Grid view, List view, Reports and related controls now use corresponding English labels in the English display layer.
- Extension, server, API, landing page, report and baseline metadata identify AuditFlow 8.8.0. Database migration advances from 45 to 46.

## Evidence parsing boundary

- User-uploaded DOCX/DOCM/XLSX/XLSM/PPTX/PDF/CSV/JSON/HTML/text evidence continues to be parsed locally and split into atomic document items with source locators, document class, item type, process candidates and evidence roles.
- No evidence text is sent to the collaboration server by the default metadata-only snapshot policy.
