## 2024-05-18 - Insecure Random Number Generation for IDs
**Vulnerability:** Used `Math.random().toString()` to generate unique IDs for React components/state.
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable IDs, potentially causing state collisions or predictable DOM structures if exposed.
**Prevention:** Use `crypto.randomUUID()` for generating secure UUIDs in modern browsers.
