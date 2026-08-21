## 2024-05-24 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Found multiple `<a>` tags with `target="_blank"` without `rel="noopener noreferrer"` attributes.
**Learning:** External links that open in a new tab without `noopener noreferrer` can allow the newly opened tab to have a reference to the `window.opener` object of the original tab. This could allow the newly opened page to potentially change the location of the original tab (e.g. redirect to a phishing page) - a vulnerability known as reverse tabnabbing.
**Prevention:** Always add `rel="noopener noreferrer"` to external links that use `target="_blank"`.
