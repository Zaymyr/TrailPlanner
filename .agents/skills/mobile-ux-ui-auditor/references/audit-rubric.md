# Mobile UX/UI audit rubric

Apply this rubric to the requested goal and journey. It is a decision aid, not a scorecard.

## Evaluation dimensions

| Dimension | Questions to answer | Useful evidence |
|---|---|---|
| Purpose and relevance | Is the screen's purpose immediately understandable? Does each piece of information help the current decision or action? | First viewport, labels, empty state, task context |
| Information hierarchy | Is the most important status or action visually dominant? Can users scan before reading in detail? | Heading levels, grouping, order, emphasis, CTA competition |
| Readability and proportion | Are type, spacing, line length, cards, imagery, and controls balanced for the viewport and content? | Clipping, wrapping, whitespace, density, scroll depth |
| Navigation and orientation | Does the user know where they are, what changed, how to continue, and how to return? | Tab state, header, back behavior, modal boundaries, deep links |
| Interaction and feedback | Does every action expose its availability, response, progress, success, failure, and recovery? | Pressed/disabled states, loaders, errors, confirmations |
| Flow continuity | Does information persist between steps? Are choices repeated unnecessarily? Are transitions and terminology coherent? | End-to-end recording, state before/after navigation |
| Consistency | Do equivalent objects and actions share wording, placement, component, spacing, iconography, and behavior? | Cross-screen matrix and shared-component inspection |
| Accessibility | Is the journey usable with enlarged text, screen reader, reduced motion, sufficient contrast, safe areas, and adequate targets? | Device settings, accessibility tree, focused controls |
| Trust and error prevention | Are consequences clear before commitment? Can users recover without losing work? | Destructive actions, validation, unsaved changes, retry paths |

## Mobile baselines

Use the active platform and project conventions rather than mixing units:

- Pace Yourself's mobile primary button has a 48-point minimum height; icon-only actions and iOS modal controls require a 44-point target or equivalent hit slop.
- Normal text should reach a 4.5:1 contrast ratio and large text or meaningful graphics at least 3:1. Treat contrast as necessary but insufficient: hierarchy cannot rely on color alone.
- Content must survive enlarged text without clipping, overlap, hidden actions, or forced horizontal reading.
- Respect safe areas, keyboard insets, native back behavior, and one predictable vertical scroll owner.
- Prefer one dominant primary action per task state. Multiple primary-looking controls need a clear priority explanation.
- Loading progress must not imply measured completion when the operation exposes only milestones.

When a threshold is platform- or version-sensitive, verify it against the current official Apple, Android, or W3C guidance before making it the basis of a finding.

## Cross-screen comparison

Create a compact matrix for the audited screens. Compare at least:

- screen title and purpose;
- primary action wording, position, and visual weight;
- header, back, tab, and scroll behavior;
- card and section hierarchy;
- loading, empty, error, and success patterns;
- terminology and units;
- accessibility behavior.

Describe whether a difference is intentional, harmless, or a source of cognitive friction. Consistency is not sameness: preserve differences that communicate a genuine change of task or state.

## Finding contract

Every finding must contain:

- concise problem statement;
- evidence type: `Observed`, `Code-confirmed`, or `Inference`;
- exact screen, state, and artifact or component;
- affected user goal;
- severity and confidence;
- explanation of the friction or risk;
- concrete recommendation compatible with existing patterns;
- validation method after correction.

Use project severities:

- `Critical`: task completion is blocked or data may be lost.
- `High`: the main task is difficult, misleading, or inaccessible.
- `Medium`: comprehension or execution is materially slowed.
- `Low`: limited-impact polish issue.

Do not inflate severity because a finding is visually noticeable.

## Report shape

Keep the report decision-oriented:

1. **Audit context** — goal, journey, device/build, locale, states observed, gaps.
2. **Experience verdict** — what works, where the journey breaks down, and the dominant pattern.
3. **Priority findings** — ordered by user impact, not screen order.
4. **Cross-screen comparison** — inconsistencies and justified differences.
5. **Recommendations** — quick wins versus structural changes, with expected UX outcome.
6. **Validation plan** — same journey, states, device settings, and evidence to compare.

Use careful language: `likely reduces ambiguity` is appropriate; `will increase conversion` requires measured evidence.
