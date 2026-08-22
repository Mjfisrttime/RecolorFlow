---
name: recolorflow-ui-standards
description: >-
  Use this skill whenever you modify the UI, add new configuration options, or update documentation sections (like the FAQ or Guide) for the RecolorFlow project.
---

# RecolorFlow UI Standards

The RecolorFlow project follows a specific visual and UX philosophy. New features must manually match the existing design language, and complex settings must not clutter the main interface.

## Core UI and UX Rules

1. **Visual Identity**: Enforce the project's visual identity. Use dark navy/black backgrounds, blue accent colors (\	ext-blue-400\, \	ext-blue-500\, \order-blue-500\), rounded corners (\ounded-xl\, \ounded-lg\), and minimal technical UI styling.
2. **"Simple by default, powerful when expanded"**: The default user experience must remain incredibly simple (Target Color -> New Color -> Preview -> Apply). Any new, complex workflows (e.g. multi-color mapping, output variants, advanced batch options) **must** be hidden inside collapsed "Advanced Settings" sections.
3. **Hierarchy**: Maintain the strict page hierarchy. The page must always flow in this exact order: 
   - Header/Title
   - Main Tool (The central feature)
   - Quick "How It Works"
   - FAQ
   - Detailed Guide
   - Use Cases / Trust Badges
   - Footer
