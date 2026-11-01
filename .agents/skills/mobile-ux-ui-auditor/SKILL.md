---
name: mobile-ux-ui-auditor
description: Audit the Pace Yourself mobile UX/UI on a connected debug phone. Use for reviews of screens or complete flows covering information relevance, readability, proportions, hierarchy, consistency, accessibility, navigation, and friction; do not use for functional debugging alone or automatic UI implementation.
---

# Mobile UX/UI auditor

Produce an evidence-based experience audit, not a code-style review or a screenshot inventory.

## Establish context

1. Read `docs/06-workflows/mobile-ux-audit.md` and `docs/01-architecture/mobile-app.md`.
2. Read the smallest relevant product, business-rule, and design-system docs needed to judge whether the displayed information is useful and correct for the user's goal. Do not infer product intent from visual appearance alone.
3. Inspect the active screen, its direct imports, navigation entry and exit points, and existing `testID` selectors. Expand only when the flow or a shared component requires it.
4. Define the user goal and the start and end of the audited journey. If the request names only one screen, audit that screen in its immediate navigation context.

## Collect device evidence

When a phone or emulator is involved, read [references/device-workflow.md](references/device-workflow.md) before interacting with it.

- Prefer the checked-in Maestro journey for repeatable navigation and named screenshots. Use ADB for device discovery, environment facts, targeted launching, and diagnostics.
- Inspect the real rendered experience. Code inspection alone cannot establish visual balance, clipping, keyboard behavior, animation quality, or touch ergonomics.
- Capture the meaningful states that are safely reachable: entry, initial viewport, scrolled content, primary action, transition, success, empty, loading, error, modal, and keyboard states. Do not manufacture account or production data to reach a state.
- Record device model, OS, viewport, density, font scale, app identifier, build type, locale, and evidence path. Mark any unavailable state as `not observed`.
- Treat screenshots and recordings as potentially sensitive. Keep temporary artifacts outside the repository and never expose credentials, tokens, personal data, or notification contents in the report.

## Analyze the experience

Read [references/audit-rubric.md](references/audit-rubric.md) for the evaluation dimensions, comparison method, severity rules, and report contract.

Evaluate the journey as a runner would experience it:

- whether each screen makes its purpose, current state, and next action obvious;
- whether every displayed item supports the task, arrives at the right moment, and uses understandable language;
- whether typography, spacing, grouping, control size, and content density remain readable and proportionate;
- whether equivalent information and actions look, read, and behave consistently across screens;
- whether navigation, back behavior, scrolling, keyboard use, feedback, recovery, and continuity form a coherent end-to-end flow;
- whether enlarged text, screen readers, reduced motion, contrast, safe areas, and touch targets remain usable;
- whether a recommendation fits Pace Yourself's existing tokens, primitives, business rules, and platform conventions.

Compare screens explicitly. A strong individual screen can still create a poor journey when labels, hierarchy, action placement, or interaction patterns change between steps.

## Separate evidence from judgment

For every finding, identify its basis:

- `Observed`: directly visible or experienced on the connected device.
- `Code-confirmed`: established by inspected implementation or project documentation.
- `Inference`: a plausible UX risk that still needs user testing or another state/device.

Never present an inference as a measured user outcome. Do not claim that a change will improve conversion, retention, or completion time without product analytics or a user study.

## Deliver the audit

Lead with the overall experience and the highest-impact blockers. Include:

1. scope, device/build context, user goal, and evidence coverage;
2. a concise journey assessment;
3. prioritized findings with evidence, user impact, recommendation, confidence, and validation method;
4. a cross-screen consistency comparison;
5. quick wins separated from structural improvements;
6. unobserved states and open questions.

Recommend concrete outcomes, not arbitrary pixel changes. Tie each proposal to the user's task and an existing component or token when one fits.

## Boundaries

- An audit is read-only by default. Do not edit UI code, data, account state, or tests unless the user explicitly asks for implementation.
- Do not clear application data, sign out the user's personal account, create purchases, mutate plans, or alter organizer content.
- Use the dedicated test account and checked-in smoke flow for destructive or repeatable scenarios.
- Do not reduce UX quality to generic checklists. Platform guidance and accessibility thresholds are baselines; product context decides the final recommendation.
- Do not call an automated Maestro pass a usability verdict. Automation proves reachability, while the audit interprets the experience.
