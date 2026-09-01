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

## 2024-05-24 - Path Traversal (Zip Slip) Vulnerability
**Vulnerability:** User-controlled filenames and paths (such as original file names, `outputSuffix`, and variant names) were not being sanitized before being used to generate download files and particularly when being added to a JSZip archive (e.g. `zip.file(getUniqueName(\`${safeVariantName}/${newName}\`), out.blob)`). This is a classic Zip Slip vulnerability where malicious filenames containing `../` sequences could potentially extract files outside of the intended target directory.
**Learning:** Even entirely client-side apps that generate ZIP files can be vectors for Zip Slip if the generated zip is eventually extracted by a vulnerable tool. Relying on default browser download behaviors or user-supplied suffixes/names without sanitization is risky.
**Prevention:** Always sanitize strings that will be used to construct filenames or paths. A robust `sanitizeFileName` function that strips `/`, `\`, null bytes, and path traversal sequences (`..`) is required before creating files or zip entries based on user input.

## 2026-09-01 - Client-Side DoS via Unrestricted File Uploads & Inputs
**Vulnerability:** Found `handleFileUpload` missing file count and file size limits, and user-controlled text inputs (`outputSuffix` and `variant.name`) missing `maxLength` restrictions. This allows a user to upload an extremely large number of files (or very large files) or input a massive string, causing the browser to freeze or crash due to memory exhaustion (Client-Side DoS).
**Learning:** Client-side processing applications (like in-browser image editors) are particularly vulnerable to memory exhaustion because they load assets directly into browser memory (e.g., as Blobs or Data URLs). Omitting standard input restrictions shifts the burden of resource management entirely to the user's browser, which can easily be overwhelmed by malicious or accidental oversized inputs.
**Prevention:** Always enforce reasonable limits on the number of files and maximum file sizes processed simultaneously on the client. Additionally, ensure all text inputs have a `maxLength` attribute to prevent excessively long strings from consuming unnecessary memory or causing issues during file generation.
