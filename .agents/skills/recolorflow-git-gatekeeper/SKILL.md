---
name: recolorflow-git-gatekeeper
description: >-
  Use this skill when you finish an implementation task, stage changes, or consider publishing/deploying to GitHub for the RecolorFlow project. It enforces the strict local manual testing and git push boundary.
---

# RecolorFlow Git Gatekeeper

This project has a strict, frequently repeated safety boundary: **do not push to GitHub automatically**. You must consistently enforce a local manual testing loop before any code is pushed to the remote repository.

## The Core Workflow

Whenever you complete an implementation task or attempt to deploy/publish, you must follow these steps precisely:

1. **Implement and Build Locally**: Make all code changes and build them locally (e.g., \
pm run build\ or \ite build\).
2. **Commit Locally**: You may commit the changes to the local Git repository using \git commit\, but **do not execute \git push\**.
3. **Halt and Request Manual Testing**: Stop execution. Explicitly instruct the user to perform manual browser testing of the feature or bug fix.
4. **Wait for Explicit Instruction**: Wait for the user to explicitly tell you to push (e.g., "push it now", "you can push to github") before ever executing \git push\.
