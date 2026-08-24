## 2024-05-24 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Found multiple `<a>` tags with `target="_blank"` without `rel="noopener noreferrer"` attributes.
**Learning:** External links that open in a new tab without `noopener noreferrer` can allow the newly opened tab to have a reference to the `window.opener` object of the original tab. This could allow the newly opened page to potentially change the location of the original tab (e.g. redirect to a phishing page) - a vulnerability known as reverse tabnabbing.
**Prevention:** Always add `rel="noopener noreferrer"` to external links that use `target="_blank"`.

## 2024-05-24 - Client-Side DoS via Expensive Math Operations in Hot Loop
**Vulnerability:** Found `Math.sqrt` and `Math.pow` being called for every pixel across all animation frames inside the hot loop `applyRulesToImageData` (in `whole.jsx` and `src/gifWorker.js`). This could cause excessive CPU usage, freezing the browser, and leading to a potential client-side DoS when processing large images or high-frame-count GIFs.
**Learning:** Mathematical operations like square root and exponentiation are computationally expensive when placed inside nested loops that iterate millions of times. Developers often translate math formulas (like color distance) directly without considering the loop execution frequency.
**Prevention:** Always identify hot loops (loops that run frequently, like per-pixel operations) and move computationally expensive operations outside if they can be pre-calculated. For distance calculations, compare squared distances instead of true distances to avoid `Math.sqrt` and `Math.pow`.

## 2024-05-18 - Insecure Random Number Generation for IDs
**Vulnerability:** Used `Math.random().toString()` to generate unique IDs for React components/state.
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable IDs, potentially causing state collisions or predictable DOM structures if exposed.
**Prevention:** Use `crypto.randomUUID()` for generating secure UUIDs in modern browsers.
## 2026-08-24 - Zip Slip / Path Traversal in ZIP Generation\n**Vulnerability:** User-provided variant names, files names, and suffix names were being directly injected into ZIP file structure and final single download filenames without any sanitization in `downloadZip` and `downloadSingle`.\n**Learning:** Constructing file paths client-side with untrusted inputs inside Javascript mapping or archiving logic (like JSZip) exposes users to path traversal vulnerabilities (Zip Slip). Generating ZIP files from user input demands proper sanitization for every segment of the path.\n**Prevention:** Apply a rigorous regex sanitization function (e.g., stripping `/`, `\`, `.`, and null bytes) to all components of dynamically generated filenames or archive paths before they are committed.
