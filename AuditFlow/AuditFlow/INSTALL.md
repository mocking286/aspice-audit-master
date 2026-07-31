# Install AuditFlow v4 in Microsoft Edge

AuditFlow stores workspace data locally in the browser profile. Installing or updating the extension does not upload project, evidence, assessment, record, or attachment data.

## Install a CRX package

1. Open `edge://extensions` in Microsoft Edge.
2. Enable **Developer mode**.
3. Drag the supplied `.crx` file onto the Extensions page and confirm the installation.
4. Select the AuditFlow toolbar action to open the full workspace in a new tab.

Some managed Edge environments block externally supplied CRX files. In that case, use the unpacked-folder method or ask the organization administrator to deploy the package through Edge policy.

## Load the unpacked folder

1. Keep the complete AuditFlow folder in a stable local location.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the folder containing `manifest.json`.
6. Pin AuditFlow from the Extensions menu if desired, then select its toolbar action.

## Local data notes

- Project and assessment metadata is stored in extension local browser storage.
- Assessor-record attachment blobs are stored in IndexedDB for this extension profile.
- Clearing site/extension data, removing the extension, or changing Edge profiles can remove local workspace data. Export a workspace backup before those operations.
- The release ZIP contains the signed CRX and an unpacked extension folder. Keep the separately supplied PEM key private for future upgrades.

## Third-party components

- `vendor/jszip.min.js`: JSZip 3.10.1. License: `vendor/JSZIP-LICENSE.markdown`.

## Helix ALM local import

AuditFlow can read Helix ALM projects from the Evidence tab through the bundled local bridge.

1. Run `start-helix-bridge.cmd` from the unpacked AuditFlow folder. Keep the PowerShell window open while importing.
2. Open a project in AuditFlow, select the Evidence tab, and use the **Live Helix ALM** panel.
3. Leave the bridge URL as `http://127.0.0.1:8787`, then enter the Helix REST API URL, username, password, and project.
4. Use **Find projects** or **Read snapshot**, select individual rows or a category, and import the selected objects.

The bridge sends Helix requests locally and supports self-signed server certificates when explicitly enabled. The Helix password and access token are not saved in AuditFlow workspace storage or exported data. The password exists only in the current browser-tab memory and the active bridge request. Stop the bridge with `Ctrl+C` when finished.

The bundled `helix-bridge.ps1` is based on the ASPICE audit bridge reference and also contains its Codex routes. AuditFlow's Helix panel uses only `/helix/projects` and `/helix/snapshot`.