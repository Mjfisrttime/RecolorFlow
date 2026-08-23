---
name: qa-team
description: >-
  Deploys a comprehensive 12-agent QA team. Use this when the user wants a deep, exhaustive quality assurance check of the project across functional, performance, security, accessibility, UI/UX, and architectural domains.
---

# QA Team Orchestration

This skill defines a comprehensive QA team and orchestrates them to perform a full system review. The team consists of an Orchestrator and 11 specialized subagents working simultaneously.

## Agent Roster

1. **qa_orchestrator**: Orchestrator / Lead QA Agent (Reads project, creates testing plan, assigns work to other agents, merges findings, removes duplicates, produces final report)
2. **qa_functional**: Functional Testing Agent (Tests buttons, forms, authentication, CRUD, navigation, workflows, edge cases)
3. **qa_performance**: Performance Agent (Checks load time, rendering, API latency, bundle size, memory usage, bottlenecks)
4. **qa_accessibility**: Accessibility Agent (WCAG issues, keyboard navigation, semantic HTML, ARIA, contrast, screen-reader problems)
5. **qa_security**: Security Agent (Auth, authorization, exposed secrets, XSS, CSRF, injection, insecure APIs, storage, dependency risks)
6. **qa_ui_ux**: UI/UX Agent (Visual consistency, spacing, responsive behavior, interaction quality, error states, empty states, mobile experience)
7. **qa_architecture**: Architecture / Code Quality Agent (Project structure, coupling, duplication, maintainability, state management, API design, technical debt)
8. **qa_api**: API / Backend Agent (API contracts, validation, error handling, status codes, database operations, race conditions, backend failures)
9. **qa_browser**: Browser / Cross-Platform Agent (Tests Chrome/Edge/Firefox, desktop/mobile layouts, viewport differences, browser-specific bugs)
10. **qa_regression**: Regression Agent (Re-runs previous failed tests after fixes and confirms that old bugs have not returned)
11. **qa_bug_repro**: Bug Reproduction Agent (Takes reported issues and tries to reproduce them automatically, recording exact steps and evidence)
12. **qa_fix_verification**: Fix Verification Agent (Reviews the developer's fix, reruns the relevant tests, and decides whether the issue is truly resolved)

## Steps to Execute

1. **Define the Agents**: Use your `define_subagent` tool to define the 12 agents listed above with their respective roles. (Note: The agent definitions are designed to allow the Orchestrator to have `enable_subagent_tools: true` and the others to report back to it).
2. **Launch the Orchestrator**: Use `invoke_subagent` to launch the `qa_orchestrator`. You must give the orchestrator a prompt describing what specifically should be tested in the project.
3. **Orchestrator Execution**: The orchestrator will read the project, create a plan, and then use its own `invoke_subagent` tool to launch the other 11 agents simultaneously, passing them their assignments. 
4. **Merge and Report**: The orchestrator waits for all 11 agents to report back, merges the findings, removes duplicates, and produces a final QA report.
