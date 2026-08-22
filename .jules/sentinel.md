## 2024-05-24 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Found multiple \<a>\ tags with \	arget="_blank"\ without \el="noopener noreferrer"\ attributes.
**Learning:** External links that open in a new tab without \
oopener noreferrer\ can allow the newly opened tab to have a reference to the \window.opener\ object of the original tab. This could allow the newly opened page to potentially change the location of the original tab (e.g. redirect to a phishing page) - a vulnerability known as reverse tabnabbing.
**Prevention:** Always add \el="noopener noreferrer"\ to external links that use \	arget="_blank"\.

## 2024-05-24 - Client-Side DoS via Expensive Math Operations in Hot Loop
**Vulnerability:** Found \Math.sqrt\ and \Math.pow\ being called for every pixel across all animation frames inside the hot loop \pplyRulesToImageData\ (in \whole.jsx\ and \src/gifWorker.js\). This could cause excessive CPU usage, freezing the browser, and leading to a potential client-side DoS when processing large images or high-frame-count GIFs.
**Learning:** Mathematical operations like square root and exponentiation are computationally expensive when placed inside nested loops that iterate millions of times. Developers often translate math formulas (like color distance) directly without considering the loop execution frequency.
**Prevention:** Always identify hot loops (loops that run frequently, like per-pixel operations) and move computationally expensive operations outside if they can be pre-calculated. For distance calculations, compare squared distances instead of true distances to avoid \Math.sqrt\ and \Math.pow\.
