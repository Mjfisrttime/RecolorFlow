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
## 2024-05-24 - [Mitigating Client-Side DoS via File and String Limits]
**Vulnerability:** Application was vulnerable to client-side DoS or memory exhaustion due to unlimited file uploads and excessively long text string allocations from inputs.
**Learning:** In-browser processing tools that iterate over user data can quickly crash the browser if strict limits on file count, file size, and text input strings are not enforced.
**Prevention:** Always set sane `maxLength` constraints on text inputs and enforce maximum limits for both the total count of uploaded files and the maximum size of individual files before starting any client-side processing.
