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

## 2024-05-25 - Zip Slip Vulnerability in Batch Download
**Vulnerability:** User-provided file names and variant names were directly incorporated into JSZip file paths without sanitization in the `downloadZip` and `downloadSingle` functions. This could allow an attacker to use paths containing directory traversal sequences (like `../`) to write files outside of the intended extraction directory when the ZIP is unpacked.
**Learning:** Client-side ZIP generation can introduce vulnerabilities when file and directory names derived from user input or unpredictable metadata are not correctly escaped or validated.
**Prevention:** Always sanitize file paths by stripping null bytes, directory traversal sequences (`../`, `..\`), and path separators (`/`, `\`) before adding files to a ZIP archive.
