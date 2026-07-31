# R2V Dimension Ranking Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dimension ranking into an action-first view that explains which dimensions need alignment, how many question cells are severe, and which questions to inspect next.

**Architecture:** Add pure presentation helpers for action levels, diagnostic copy, and dimension-specific question selection. Keep the existing metrics unchanged, render a progressive-disclosure ranking in `DimensionRanking`, and pass a dimension filter through `R2VDashboard` into `QuestionRanking`.

**Tech Stack:** React 19, TypeScript, plain CSS, Node test runner, Vite/vinext.

## Global Constraints

- Preserve all existing metric calculations and the 60% severe threshold.
- Preserve the existing Data Atelier visual language.
- Show real counts and percentages from the uploaded workbook.
- Make primary conclusions understandable without opening metric help.
- Keep detailed metrics accessible through native `details`.
- Keep the layout usable without horizontal scrolling on narrow screens.

---

### Task 1: Dimension presentation helpers

**Files:**
- Create: `lib/r2v/dimension-presentation.ts`
- Create: `tests/r2v-dimension-presentation.test.mjs`

**Interfaces:**
- Consumes: `DimensionStats` and `CellStats` from `lib/r2v/types.ts`.
- Produces:
  - `dimensionAction(item: DimensionStats): { level: "priority" | "watch" | "stable"; label: string }`
  - `dimensionDiagnosis(item: DimensionStats): string`
  - `dimensionQuestionKeys(cells: CellStats[], dimensionId: string): string[]`

- [ ] **Step 1: Write failing helper tests**

```js
test("classifies dimensions into readable action levels", () => {
  assert.equal(dimensionAction(dimension({ severeDisagreementRate: 0.76 })).label, "优先对齐");
  assert.equal(dimensionAction(dimension({ severeDisagreementRate: 0.2 })).label, "建议关注");
  assert.equal(dimensionAction(dimension({ severeDisagreementRate: 0 })).label, "相对稳定");
});

test("selects severe questions before ordinary disputed questions", () => {
  assert.deepEqual(dimensionQuestionKeys(cells, "environment"), ["q1", "q2"]);
});
```

- [ ] **Step 2: Run tests and verify the missing module failure**

Run: `node --test tests/r2v-dimension-presentation.test.mjs`

Expected: FAIL because `lib/r2v/dimension-presentation.ts` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```ts
export function dimensionAction(item: DimensionStats) {
  if (item.severeDisagreementRate >= 0.5) {
    return { level: "priority" as const, label: "优先对齐" };
  }
  if (item.severeDisagreementRate > 0) {
    return { level: "watch" as const, label: "建议关注" };
  }
  return { level: "stable" as const, label: "相对稳定" };
}
```

`dimensionDiagnosis` must use `severeCellCount` and `validCellCount` in plain language. `dimensionQuestionKeys` must return unique severe question keys in source order; when none are severe, return unique disputed question keys.

- [ ] **Step 4: Run helper tests**

Run: `node --test tests/r2v-dimension-presentation.test.mjs`

Expected: all helper tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/r2v/dimension-presentation.ts tests/r2v-dimension-presentation.test.mjs
git commit -m "feat: add dimension ranking presentation helpers"
```

### Task 2: Action-first dimension ranking

**Files:**
- Modify: `app/r2v/DimensionRanking.tsx`
- Modify: `app/r2v/AnalysisOverview.tsx`
- Modify: `tests/r2v-data-atelier-ui.test.mjs`
- Modify: `tests/r2v-ui-source.test.mjs`

**Interfaces:**
- Consumes: presentation helpers from Task 1 and `analysis.answerDistributions`.
- Produces: `DimensionRanking({ analysis, onViewQuestions })`, where `onViewQuestions` accepts `{ dimensionId: string; dimensionLabel: string; questionKeys: string[] }`.

- [ ] **Step 1: Add failing UI source assertions**

Assert the source contains:

```js
for (const copy of [
  "建议优先讨论",
  "严重分歧题",
  "全部标注答案构成",
  "查看相关题目",
  "详细指标",
]) assert.match(dimensionRanking, new RegExp(copy));
```

Also assert `DimensionRanking.tsx` no longer contains `metric-switch`.

- [ ] **Step 2: Run UI source tests and verify failure**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs tests/r2v-ui-source.test.mjs`

Expected: FAIL because the action summary and progressive-disclosure copy are missing.

- [ ] **Step 3: Replace the metric switch with the action summary**

Render a top summary using the count of dimensions whose severe rate is at least 50%. Each row must show:

```tsx
<span className={`dimension-action dimension-action--${action.level}`}>
  {action.label}
</span>
<strong>{item.severeCellCount} / {item.validCellCount} 题</strong>
<span>严重分歧题</span>
```

Use a semantic progress bar for the severe rate and a button that calls `onViewQuestions` with `dimensionQuestionKeys(...)`.

- [ ] **Step 4: Show answer distribution percentages**

Extend `DistributionBar` with optional props:

```ts
showPercentages?: boolean;
label?: string;
```

When `showPercentages` is true, legends display `YES 20.1%` instead of raw counts, while segment titles continue to include both count and rate.

- [ ] **Step 5: Move secondary metrics into details**

Render a native `<details>` labelled `详细指标` containing occurrence rate, average disagreement, and entropy. Include the exact metric definitions in compact copy.

- [ ] **Step 6: Run UI source tests**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs tests/r2v-ui-source.test.mjs`

Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/r2v/DimensionRanking.tsx app/r2v/AnalysisOverview.tsx tests/r2v-data-atelier-ui.test.mjs tests/r2v-ui-source.test.mjs
git commit -m "feat: simplify dimension disagreement ranking"
```

### Task 3: Dimension-specific question drill-down

**Files:**
- Modify: `app/r2v/R2VDashboard.tsx`
- Modify: `app/r2v/QuestionRanking.tsx`
- Modify: `tests/r2v-data-atelier-ui.test.mjs`

**Interfaces:**
- Consumes: the filter payload emitted by `DimensionRanking`.
- Produces: an optional `dimensionFilter` prop for `QuestionRanking` and a clear-filter callback.

- [ ] **Step 1: Add failing drill-down assertions**

Assert the dashboard passes `onViewQuestions` and the question view contains `dimension-question-filter`, `只看`, and `清除筛选`.

- [ ] **Step 2: Run the UI test and verify failure**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: FAIL because the filter state and banner do not exist.

- [ ] **Step 3: Wire the dashboard state**

Add:

```ts
const [dimensionFilter, setDimensionFilter] =
  useState<DimensionQuestionFilter | null>(null);
```

On “查看相关题目”, set the filter and switch to the `questions` tab. Clear the filter when requested or when a new workbook remounts the dashboard.

- [ ] **Step 4: Filter and explain the question list**

`QuestionRanking` filters `analysis.questionRanking` by the provided question-key set before applying text search. Render a banner:

```tsx
<div className="dimension-question-filter">
  <span>只看「{dimensionFilter.dimensionLabel}」的相关题目</span>
  <b>{questions.length} 题</b>
  <button type="button" onClick={onClearDimensionFilter}>清除筛选</button>
</div>
```

- [ ] **Step 5: Run the drill-down UI test**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/r2v/R2VDashboard.tsx app/r2v/QuestionRanking.tsx tests/r2v-data-atelier-ui.test.mjs
git commit -m "feat: drill into questions from dimension ranking"
```

### Task 4: Responsive styling and verification

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/r2v-data-atelier-ui.test.mjs`

**Interfaces:**
- Consumes: the class names introduced in Tasks 2 and 3.
- Produces: a responsive action-first ranking with no required horizontal scrolling at 800px and below.

- [ ] **Step 1: Add failing CSS assertions**

Assert the stylesheet contains `.dimension-summary`, `.dimension-severity-track`, `.dimension-row__details`, `.dimension-question-filter`, and a mobile rule that sets `.dimension-row { min-width: 0; }`.

- [ ] **Step 2: Run the CSS source test and verify failure**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: FAIL because the new classes do not exist.

- [ ] **Step 3: Implement the responsive visual hierarchy**

Use the existing paper, ink, acid, warning, danger, hairline, display, body, and mono tokens. Desktop rows use a two-column main evidence area; mobile rows become stacked cards. Do not add new dependencies.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
git diff --check
npm run lint
npm test
```

Expected: lint exits without errors; build and all tests pass.

- [ ] **Step 5: Perform browser checks**

Load the audio demo and confirm:

- the first viewport states what to discuss;
- the first ranking row reads as an action, not a metric dump;
- the answer legend uses percentages;
- detailed metrics expand;
- “查看相关题目” switches to a filtered question list;
- narrow layout does not require horizontal scrolling.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tests/r2v-data-atelier-ui.test.mjs
git commit -m "style: clarify dimension ranking hierarchy"
```

### Task 5: Publish the verified source

**Files:**
- Generated: `pages-dist/**`

- [ ] **Step 1: Push the verified main branch**

Push the current `main` HEAD to the configured source remotes.

- [ ] **Step 2: Publish GitHub Pages**

Copy the exact `pages-dist` output to `gh-pages`, preserve `.nojekyll`, commit, and push.

- [ ] **Step 3: Publish the Sites version**

Package the same main HEAD with the Sites helper, save a version, deploy it, and poll until the deployment succeeds.

- [ ] **Step 4: Verify public access**

Confirm the GitHub Pages HTML and its generated JavaScript asset both return HTTP 200. Open the public page and verify the action-first dimension ranking.
