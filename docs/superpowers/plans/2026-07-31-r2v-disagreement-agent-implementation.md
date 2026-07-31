# R2V Disagreement Analysis Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Data Lumen into a browser-only R2V annotation analysis Agent that automatically recognizes object, scene, and audio exports and explains dimension disagreement, question disagreement, distributions, severe disagreement, entropy, reasons, score conflicts, annotator deviation, and completion coverage in plain Chinese.

**Architecture:** Keep the existing React 19/Vite/Vinext shell and XLSX browser parser. Add a focused `lib/r2v` domain layer that detects schemas, normalizes platform rows into one canonical model, computes task-specific metrics, and exposes a single `analyzeR2VRows()` result. Add focused React components under `app/r2v` that render the ten agreed analysis views, with conclusions first and formulas/details on demand.

**Tech Stack:** React 19.2.6, TypeScript 5.9.3, Vite 8.0.13, Vinext, XLSX 0.18.5, lucide-react, Node test runner, plain CSS.

## Global Constraints

- Do not show a blocking field-confirmation step.
- Automatically recognize task type, question grouping key, annotator, completion state, REF slots, score arrays, dimensions, reasons, and groups.
- Keep object, scene, and audio score scales and answer semantics separate.
- Preserve fixed `ref_1` through `ref_6` slots; missing slots never shift later REF indexes.
- Use `任务类型 × 题目 × REF/分组 × 维度 × 标注员` as the normalized analysis grain.
- Exclude unfinished submissions from disagreement denominators while including them in completion coverage.
- Describe minority answers as disagreement or deviation, not as automatic errors.
- Show plain-language conclusions before formulas and raw detail.
- Parse uploaded files in the browser; never upload original workbook contents.
- Keep GitHub Pages deployment at `/data-lumen-agent/`.
- Do not add a charting dependency; use semantic HTML, CSS, and small inline SVG where needed.

---

## File Structure

### Domain files

- `lib/r2v/types.ts`: Canonical task, observation, metric, reason, conflict, coverage, and result types.
- `lib/r2v/profiles.ts`: Object, scene, and audio rule profiles, labels, allowed answers, reason requirements, and score scales.
- `lib/r2v/detect.ts`: Task-type, question-key, annotator, answer-source, and completion detection.
- `lib/r2v/normalize.ts`: JSON/flattened-column parsing and conversion to canonical submissions with fixed REF indexes.
- `lib/r2v/metrics.ts`: Cell, dimension, question, score, entropy, severe-disagreement, and annotator metrics.
- `lib/r2v/reasons.ts`: Answer-bound reason grouping, keyword clusters, and representative examples.
- `lib/r2v/conflicts.ts`: Structural validation and task-specific score/dimension conflict checks.
- `lib/r2v/analyze.ts`: End-to-end orchestration and plain-language headline generation.
- `lib/r2v/demo.ts`: Deterministic audio demo data used by the product and tests.
- `lib/r2v/export.ts`: Markdown and CSV report generators.

### UI files

- `app/r2v/R2VDashboard.tsx`: Dashboard state, tab navigation, task override, copy, download, and drill-down coordination.
- `app/r2v/AnalysisOverview.tsx`: KPI cards and plain-language first-read summary.
- `app/r2v/DimensionRanking.tsx`: Dimension disagreement leaderboard and answer distributions.
- `app/r2v/QuestionRanking.tsx`: Question disagreement leaderboard.
- `app/r2v/DisagreementHeatmap.tsx`: Question × dimension heatmap and detail drawer.
- `app/r2v/ReasonAndConflictViews.tsx`: Reason summaries and score/dimension conflict views.
- `app/r2v/AnnotatorAndCoverageViews.tsx`: Annotator deviation and completion coverage.
- `app/r2v/MetricHelp.tsx`: Reusable “怎么理解” disclosure with formula and example.
- `app/page.tsx`: Keep upload/workbook parsing; switch the post-upload experience to `R2VDashboard`.
- `app/globals.css`: Add responsive R2V dashboard, leaderboard, distribution, heatmap, drawer, and help styles.
- `app/layout.tsx`: Update product title and description.

### Tests and utilities

- `tests/r2v-detection.test.mjs`: Automatic task/schema detection tests.
- `tests/r2v-normalization.test.mjs`: JSON, flattened array, REF-slot, and completion normalization tests.
- `tests/r2v-metrics.test.mjs`: Exact disagreement, severe-rate, entropy, question, and annotator calculations.
- `tests/r2v-rules.test.mjs`: Reason and conflict rules for all three tasks.
- `tests/r2v-export.test.mjs`: Markdown/CSV export tests.
- `tests/r2v-ui-source.test.mjs`: Static source and built-bundle contract tests.
- `scripts/analyze-r2v-file.mjs`: Local CLI verification against a real exported file.

---

### Task 1: Canonical types and three task profiles

**Files:**
- Create: `lib/r2v/types.ts`
- Create: `lib/r2v/profiles.ts`
- Test: `tests/r2v-profiles.test.mjs`

**Interfaces:**
- Produces: `TaskType`, `R2VProfile`, `NormalizedSubmission`, `DimensionObservation`, `ScoreObservation`.
- Produces: `R2V_PROFILES`, `getProfile(taskType)`, `normalizeAnswer(taskType, dimensionId, value)`.

- [ ] **Step 1: Write the failing profile test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  R2V_PROFILES,
  normalizeAnswer,
} from "../lib/r2v/profiles.ts";

test("keeps task score scales and answer semantics separate", () => {
  assert.deepEqual(R2V_PROFILES.audio.consistencyScores, [0, 1, 3, 5]);
  assert.deepEqual(R2V_PROFILES.scene.consistencyScores, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(R2V_PROFILES.object.consistencyScores, [0, 1, 2, 3, 4, 5, "SKIP"]);
  assert.equal(normalizeAnswer("audio", "tone", "HIGH_SIMILARITY"), "HIGH_SIMILARITY");
  assert.equal(normalizeAnswer("audio", "general", "无法判断"), "UNKNOWN");
  assert.equal(normalizeAnswer("scene", "subjectComposition", "N/A"), "NA");
  assert.equal(normalizeAnswer("object", "scene", "不考虑"), "NA");
});

test("marks only audio tone as requiring a consistency reason", () => {
  const audio = R2V_PROFILES.audio;
  assert.equal(audio.dimensions.find((item) => item.id === "tone")?.reasonRequired, true);
  assert.equal(audio.dimensions.find((item) => item.id === "emotion")?.reasonRequired, false);
});
```

- [ ] **Step 2: Run the test and verify the missing modules fail**

Run: `node --test tests/r2v-profiles.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/r2v/profiles.ts`.

- [ ] **Step 3: Define canonical types**

Create the exact public types below in `lib/r2v/types.ts`:

```ts
import type { DataRow } from "../analysis";

export type TaskType = "audio" | "scene" | "object" | "unknown";
export type EntityKind = "target" | "ref" | "multiview" | "scene-group";
export type CanonicalAnswer =
  | "YES" | "NO" | "HIGH_SIMILARITY" | "LOW_SIMILARITY"
  | "UNKNOWN" | "NA";
export type ScoreValue = number | "HIGH" | "MEDIUM" | "LOW" | "SKIP";

export interface DimensionRule {
  id: string;
  label: string;
  allowed: CanonicalAnswer[];
  reasonRequired: boolean;
}

export interface R2VProfile {
  type: Exclude<TaskType, "unknown">;
  label: string;
  consistencyScores: ScoreValue[];
  dimensions: DimensionRule[];
  valueDimensions: DimensionRule[];
  jsonKeys: string[];
  columnHints: string[];
}

export interface DimensionObservation {
  entityKey: string;
  entityKind: EntityKind;
  refIndex?: number;
  groupIndex?: number;
  dimensionId: string;
  answer: CanonicalAnswer;
  reason?: string;
}

export interface ScoreObservation {
  entityKey: string;
  entityKind: EntityKind;
  refIndex?: number;
  groupIndex?: number;
  scoreType: "consistency" | "value";
  value: ScoreValue;
}

export interface NormalizedSubmission {
  taskType: Exclude<TaskType, "unknown">;
  questionKey: string;
  assignmentKey?: string;
  annotator?: string;
  completed: boolean;
  abandoned: boolean;
  refSlots: number[];
  dimensions: DimensionObservation[];
  scores: ScoreObservation[];
  remark?: string;
  rawRowIndex: number;
  raw: DataRow;
  parseWarnings: string[];
}
```

- [ ] **Step 4: Implement the profiles and aliases**

In `lib/r2v/profiles.ts`, define:

```ts
export const R2V_PROFILES: Record<"audio" | "scene" | "object", R2VProfile>;
export function getProfile(taskType: Exclude<TaskType, "unknown">): R2VProfile;
export function normalizeAnswer(
  taskType: Exclude<TaskType, "unknown">,
  dimensionId: string,
  value: unknown,
): CanonicalAnswer | null;
```

Use these exact audio dimension IDs:

```ts
["general", "tone", "dialect", "emotion", "style", "environment", "scenario"]
```

Use these exact scene dimension IDs:

```ts
["spaceLayout", "anchor", "viewpoint", "state", "subjectComposition", "coverage"]
```

Use these exact object dimension IDs:

```ts
["shape", "textPattern", "material", "color", "camera", "scene", "coverage"]
```

Normalize Chinese, English, platform enums, case, spaces, and underscores into the canonical answers. Do not turn `UNKNOWN` or `NA` into `NO`.

- [ ] **Step 5: Run the profile tests**

Run: `node --test tests/r2v-profiles.test.mjs`

Expected: 2 tests pass.

- [ ] **Step 6: Commit the profiles**

```bash
git add lib/r2v/types.ts lib/r2v/profiles.ts tests/r2v-profiles.test.mjs
git commit -m "feat: define R2V task profiles"
```

---

### Task 2: Automatic detection and fixed-slot normalization

**Files:**
- Create: `lib/r2v/detect.ts`
- Create: `lib/r2v/normalize.ts`
- Test: `tests/r2v-detection.test.mjs`
- Test: `tests/r2v-normalization.test.mjs`

**Interfaces:**
- Consumes: `TaskType`, `R2VProfile`, `NormalizedSubmission`, `normalizeAnswer`.
- Produces: `detectR2VSchema(rows)`, `normalizeR2VRows(rows, forcedTaskType?)`.

- [ ] **Step 1: Write failing detection tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { detectR2VSchema } from "../lib/r2v/detect.ts";

test("detects audio and chooses repeated uid instead of unique assignment id", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    题目ID: `assignment-${index}`,
    uid: index < 5 ? "question-a" : "question-b",
    "[标注]操作人": `worker-${index % 5}`,
    "最终结果-JSON": JSON.stringify({
      data: { refToneConsistency: ["YES"], refConsistencyScores: [5] },
    }),
  }));
  const schema = detectR2VSchema(rows);
  assert.equal(schema.taskType, "audio");
  assert.equal(schema.questionField, "uid");
  assert.equal(schema.annotatorField, "[标注]操作人");
  assert.equal(schema.answerField, "最终结果-JSON");
});
```

- [ ] **Step 2: Write failing normalization tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeR2VRows } from "../lib/r2v/normalize.ts";

test("preserves a missing ref_2 slot and maps ref_3 to index 2", () => {
  const rows = [{
    uid: "q1",
    ref_1: "one.mp3",
    ref_2: "",
    ref_3: "three.mp3",
    "[标注]操作人": "A",
    "最终结果-JSON": JSON.stringify({
      data: {
        refConsistencyScores: [5, null, 3],
        refGeneralConsistency: ["YES", null, "NO"],
        refToneConsistency: ["YES", null, "HIGH_SIMILARITY"],
        refToneConsistencyReason: ["同源", null, "音色接近"],
      },
    }),
  }];
  const result = normalizeR2VRows(rows);
  assert.deepEqual(result.submissions[0].refSlots, [0, 2]);
  assert.equal(
    result.submissions[0].dimensions.find((item) => item.refIndex === 2)?.entityKey,
    "ref_3",
  );
});

test("keeps unfinished rows for coverage but not as completed submissions", () => {
  const result = normalizeR2VRows([
    { uid: "q1", ref_1: "one.mp3", "最终结果-JSON": "" },
  ], "audio");
  assert.equal(result.submissions.length, 1);
  assert.equal(result.submissions[0].completed, false);
});
```

- [ ] **Step 3: Run detection and normalization tests**

Run: `node --test tests/r2v-detection.test.mjs tests/r2v-normalization.test.mjs`

Expected: both suites fail because the modules do not exist.

- [ ] **Step 4: Implement schema detection**

Create:

```ts
export interface DetectedR2VSchema {
  taskType: TaskType;
  confidence: number;
  questionField?: string;
  annotatorField?: string;
  answerField?: string;
  assignmentField?: string;
  completionField?: string;
  refFields: Array<{ field: string; index: number }>;
  notes: string[];
}

export function detectR2VSchema(rows: DataRow[]): DetectedR2VSchema;
```

Detection requirements:

1. Inspect at most 200 non-empty rows.
2. Score task type from JSON keys and flattened column suffixes.
3. Score question-key candidates by non-empty coverage and repeated-value rate.
4. Reject a candidate as the question key when its unique rate is above 95% and another candidate repeats.
5. Prefer `uid`, then `orig_uid`, `数据标识`, `object_id`, `name`.
6. Fall back to a stable string made from `target_video` and fixed `ref_1` through `ref_6`.
7. Detect the annotator using the field aliases in the design spec.
8. Return notes rather than asking for confirmation.

- [ ] **Step 5: Implement answer parsing and normalization**

Create:

```ts
export interface NormalizeResult {
  schema: DetectedR2VSchema;
  submissions: NormalizedSubmission[];
  sourceWarnings: string[];
}

export function parseArrayish(value: unknown): unknown[];
export function normalizeR2VRows(
  rows: DataRow[],
  forcedTaskType?: Exclude<TaskType, "unknown">,
): NormalizeResult;
```

The implementation must:

- Parse `最终结果-JSON` and `答案` strings.
- Read nested `data` and `dataMap` when present.
- Read flattened columns by stripping prefixes such as `[标注]`.
- Expand array fields by original REF index.
- Keep unfinished rows.
- Mark abandoned rows and bypass business-completeness conflicts later.
- Preserve parse warnings on the submission.
- Build audio target value observations separately from REF value observations.
- Parse object and scene multi-view/group arrays without reordering members.

- [ ] **Step 6: Run detection and normalization tests**

Run: `node --test tests/r2v-detection.test.mjs tests/r2v-normalization.test.mjs`

Expected: all tests pass.

- [ ] **Step 7: Commit detection and normalization**

```bash
git add lib/r2v/detect.ts lib/r2v/normalize.ts tests/r2v-detection.test.mjs tests/r2v-normalization.test.mjs
git commit -m "feat: auto-detect and normalize R2V exports"
```

---

### Task 3: Exact disagreement, question, score, and annotator metrics

**Files:**
- Modify: `lib/r2v/types.ts`
- Create: `lib/r2v/metrics.ts`
- Test: `tests/r2v-metrics.test.mjs`

**Interfaces:**
- Consumes: completed `NormalizedSubmission[]`.
- Produces: `calculateCellStats`, `calculateDimensionStats`, `calculateQuestionStats`, `calculateScoreStats`, `calculateAnnotatorStats`.

- [ ] **Step 1: Write the exact metric tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDistributionMetrics,
  calculateDimensionStats,
} from "../lib/r2v/metrics.ts";

test("calculates 7 YES and 3 NO as 70% consistency and 30% disagreement", () => {
  const exact = calculateDistributionMetrics([
    "YES", "YES", "YES", "YES", "YES", "YES", "YES",
    "NO", "NO", "NO",
  ]);
  assert.equal(exact.sampleSize, 10);
  assert.equal(exact.consistencyRate, 0.7);
  assert.equal(exact.disagreementDegree, 0.3);
  assert.equal(exact.hasDisagreement, true);
  assert.equal(exact.severe, false);
});

test("marks a 6 to 4 split as severe at the inclusive 60% threshold", () => {
  const result = calculateDistributionMetrics([
    "YES", "YES", "YES", "YES", "YES", "YES",
    "NO", "NO", "NO", "NO",
  ]);
  assert.equal(result.consistencyRate, 0.6);
  assert.equal(result.severe, true);
});

test("gives four-way answers higher entropy than a two-way 7 to 3 split", () => {
  const twoWay = calculateDistributionMetrics([
    "YES", "YES", "YES", "YES", "YES", "YES", "YES",
    "NO", "NO", "NO",
  ]);
  const fourWay = calculateDistributionMetrics([
    "YES", "YES", "YES",
    "HIGH_SIMILARITY", "HIGH_SIMILARITY", "HIGH_SIMILARITY",
    "LOW_SIMILARITY", "LOW_SIMILARITY",
    "UNKNOWN", "UNKNOWN",
  ]);
  assert.ok(fourWay.entropy > twoWay.entropy);
});
```

- [ ] **Step 2: Run the metrics test**

Run: `node --test tests/r2v-metrics.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement distribution metrics**

Add `DistributionMetrics` to `lib/r2v/types.ts`:

```ts
export interface DistributionMetrics {
  sampleSize: number;
  distribution: Array<{ answer: string; count: number; rate: number }>;
  majorityAnswer: string;
  consistencyRate: number;
  disagreementDegree: number;
  hasDisagreement: boolean;
  severe: boolean;
  entropy: number;
}
```

Expose from `lib/r2v/metrics.ts`:

```ts
export function calculateDistributionMetrics(
  answers: string[],
  severeThreshold?: number,
): DistributionMetrics;
```

Use:

```ts
const consistencyRate = maxCount / sampleSize;
const disagreementDegree = 1 - consistencyRate;
const severe = sampleSize >= 2 && consistencyRate <= severeThreshold;
const entropy = categories.length <= 1
  ? 0
  : -sum(p * Math.log(p)) / Math.log(categories.length);
```

Sort answer distributions using the task profile order rather than alphabetical order.

- [ ] **Step 4: Implement aggregate metrics**

Add these exact result types to `lib/r2v/types.ts`:

```ts
export interface CellStats extends DistributionMetrics {
  taskType: Exclude<TaskType, "unknown">;
  cellKey: string;
  questionKey: string;
  entityKey: string;
  entityKind: EntityKind;
  refIndex?: number;
  dimensionId: string;
  dimensionLabel: string;
  answers: Array<{ annotator?: string; answer: CanonicalAnswer; reason?: string }>;
}

export interface ScoreCellStats extends DistributionMetrics {
  taskType: Exclude<TaskType, "unknown">;
  questionKey: string;
  entityKey: string;
  scoreType: "consistency" | "value";
  majorityScore: ScoreValue;
  minimumNumericScore?: number;
  maximumNumericScore?: number;
  scoreSpread?: number;
}

export interface DimensionStats {
  taskType: Exclude<TaskType, "unknown">;
  dimensionId: string;
  dimensionLabel: string;
  validCellCount: number;
  disputedCellCount: number;
  severeCellCount: number;
  disagreementOccurrenceRate: number;
  severeDisagreementRate: number;
  meanDisagreementDegree: number;
  meanConsistencyRate: number;
  meanEntropy: number;
  answerDistribution: Array<{ answer: string; count: number; rate: number }>;
}

export interface QuestionStats {
  taskType: Exclude<TaskType, "unknown">;
  questionKey: string;
  validAnnotatorCount: number;
  totalDimensionCount: number;
  disputedDimensionCount: number;
  severeDimensionCount: number;
  meanDisagreementDegree: number;
  maxEntropy: number;
  scoreSpread: number;
  conflictCount: number;
}

export interface AnnotatorStats {
  annotator: string;
  completedCount: number;
  comparableCellCount: number;
  majorityAlignmentRate: number;
  unknownAnswerRate: number;
  deviationsByDimension: Array<{
    dimensionId: string;
    comparableCount: number;
    deviationRate: number;
  }>;
}
```

Expose from `lib/r2v/metrics.ts`:

```ts
export function calculateCellStats(submissions: NormalizedSubmission[]): CellStats[];
export function calculateDimensionStats(cells: CellStats[]): DimensionStats[];
export function calculateQuestionStats(
  cells: CellStats[],
  scores: ScoreCellStats[],
): QuestionStats[];
export function calculateScoreStats(submissions: NormalizedSubmission[]): ScoreCellStats[];
export function calculateAnnotatorStats(
  submissions: NormalizedSubmission[],
  cells: CellStats[],
): AnnotatorStats[];
```

Rules:

- A cell is `questionKey + entityKey + dimensionId`.
- Dimension disagreement occurrence is the percentage of valid cells with multiple answers.
- Severe disagreement rate is the percentage of valid cells with majority share at or below 60%.
- Question ranking prioritizes severe dimension count, mean disagreement, maximum entropy, then score spread.
- Annotator majority alignment excludes tied cells and cells with fewer than two labels.
- `UNKNOWN`, `NA`, and `SKIP` remain visible in distributions.

- [ ] **Step 5: Add aggregate fixtures and assertions**

Extend `tests/r2v-metrics.test.mjs` with two questions, three dimensions, and four annotators. Assert:

```js
assert.equal(environment.disagreementOccurrenceRate, 1);
assert.equal(tone.disagreementOccurrenceRate, 0.5);
assert.equal(questionA.disputedDimensionCount, 2);
assert.equal(questionA.severeDimensionCount, 1);
assert.equal(workerD.majorityAlignmentRate, 0.5);
```

- [ ] **Step 6: Run the metric tests**

Run: `node --test tests/r2v-metrics.test.mjs`

Expected: all tests pass.

- [ ] **Step 7: Commit the metrics**

```bash
git add lib/r2v/metrics.ts tests/r2v-metrics.test.mjs
git commit -m "feat: calculate R2V disagreement metrics"
```

---

### Task 4: Reason grouping, structural validation, and rule conflicts

**Files:**
- Create: `lib/r2v/reasons.ts`
- Create: `lib/r2v/conflicts.ts`
- Test: `tests/r2v-rules.test.mjs`

**Interfaces:**
- Consumes: profiles and normalized submissions.
- Produces: `summarizeReasons(submissions)`, `findR2VConflicts(submissions)`.

- [ ] **Step 1: Write reason and conflict tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { summarizeReasons } from "../lib/r2v/reasons.ts";
import { findR2VConflicts } from "../lib/r2v/conflicts.ts";

function makeAudioSubmission({
  score = 3,
  general = "NO",
  tone = "HIGH_SIMILARITY",
  toneReason = "",
  emotion,
  annotator = "A",
} = {}) {
  const dimensions = [
    {
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      dimensionId: "general",
      answer: general,
    },
    {
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      dimensionId: "tone",
      answer: tone,
      reason: toneReason,
    },
  ];
  if (emotion) dimensions.push({
    entityKey: "ref_1",
    entityKind: "ref",
    refIndex: 0,
    dimensionId: "emotion",
    answer: emotion,
  });
  return [{
    taskType: "audio",
    questionKey: "q1",
    annotator,
    completed: true,
    abandoned: false,
    refSlots: [0],
    dimensions,
    scores: [{
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      scoreType: "consistency",
      value: score,
    }],
    rawRowIndex: 0,
    raw: {},
    parseWarnings: [],
  }];
}

function makeAudioSubmissions(items) {
  return items.map((item, index) => makeAudioSubmission({
    tone: item.tone,
    toneReason: item.reason,
    annotator: `worker-${index + 1}`,
  })[0]);
}

test("keeps reasons separated by dimension and selected answer", () => {
  const groups = summarizeReasons(makeAudioSubmissions([
    { tone: "YES", reason: "音色和声线相同" },
    { tone: "YES", reason: "声线一致，音高接近" },
    { tone: "LOW_SIMILARITY", reason: "鼻音和厚度差异明显" },
  ]));
  assert.equal(groups.find((item) => item.answer === "YES")?.reasonCount, 2);
  assert.equal(groups.find((item) => item.answer === "LOW_SIMILARITY")?.reasonCount, 1);
});

test("flags audio score 5 when general consistency is not YES", () => {
  const conflicts = findR2VConflicts(makeAudioSubmission({
    score: 5,
    general: "NO",
    tone: "YES",
  }));
  assert.ok(conflicts.some((item) => item.code === "AUDIO_5_GENERAL_NOT_YES"));
});

test("does not require reasons for audio emotion consistency", () => {
  const conflicts = findR2VConflicts(makeAudioSubmission({
    score: 3,
    general: "NO",
    tone: "HIGH_SIMILARITY",
    toneReason: "声线接近",
    emotion: "HIGH_SIMILARITY",
  }));
  assert.ok(!conflicts.some((item) => item.dimensionId === "emotion" && item.code === "MISSING_REASON"));
});
```

- [ ] **Step 2: Run the rule test**

Run: `node --test tests/r2v-rules.test.mjs`

Expected: FAIL because reason and conflict modules do not exist.

- [ ] **Step 3: Implement answer-bound reason summaries**

Expose:

```ts
export interface ReasonSummary {
  taskType: Exclude<TaskType, "unknown">;
  dimensionId: string;
  dimensionLabel: string;
  answer: CanonicalAnswer;
  reasonCount: number;
  questionCount: number;
  clusters: Array<{
    label: string;
    count: number;
    rate: number;
    examples: Array<{ questionKey: string; reason: string }>;
  }>;
}

export function summarizeReasons(
  submissions: NormalizedSubmission[],
): ReasonSummary[];
```

Cluster reasons using deterministic keyword dictionaries per task:

- Audio: 声线/音高、气声/沙哑/鼻音、方言/吐字、情绪、节奏/语调、噪声/混响、场景语气、同源/内容重叠.
- Scene: 空间布局、锚点、视角、状态、主体构成、覆盖范围.
- Object: 形状结构、文字 Logo、图案、材质纹理、颜色、镜头环境、遮挡覆盖、清晰度.

Put unmatched reasons into `其他具体判断`; retain up to three original examples per cluster.

- [ ] **Step 4: Implement conflict checks**

Expose:

```ts
export interface R2VConflict {
  severity: "error" | "review";
  code: string;
  title: string;
  explanation: string;
  taskType: Exclude<TaskType, "unknown">;
  questionKey: string;
  annotator?: string;
  entityKey?: string;
  dimensionId?: string;
  rawRowIndex: number;
}

export function findR2VConflicts(
  submissions: NormalizedSubmission[],
): R2VConflict[];
```

Implement all deterministic validation and “review” combinations from Sections 6.5, 7.5, and 8.5 of the approved design. Abandoned submissions bypass business completeness checks. Structural violations use `error`; semantic score/dimension tension uses `review`.

- [ ] **Step 5: Run the rule tests**

Run: `node --test tests/r2v-rules.test.mjs`

Expected: all tests pass.

- [ ] **Step 6: Commit rules and reasons**

```bash
git add lib/r2v/reasons.ts lib/r2v/conflicts.ts tests/r2v-rules.test.mjs
git commit -m "feat: explain reasons and R2V rule conflicts"
```

---

### Task 5: Analysis orchestration, coverage, headlines, demo, and real-file verifier

**Files:**
- Modify: `lib/r2v/types.ts`
- Create: `lib/r2v/analyze.ts`
- Create: `lib/r2v/demo.ts`
- Create: `scripts/analyze-r2v-file.mjs`
- Test: `tests/r2v-analysis.test.mjs`

**Interfaces:**
- Consumes: detection, normalization, metrics, reasons, conflicts.
- Produces: `analyzeR2VRows(rows, fileName, forcedTaskType?)`, `createR2VDemoRows()`.

- [ ] **Step 1: Write the orchestration test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeR2VRows } from "../lib/r2v/analyze.ts";
import { createR2VDemoRows } from "../lib/r2v/demo.ts";

test("returns the ten agreed analysis modules without field confirmation", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  assert.equal(result.taskType, "audio");
  assert.ok(result.dimensionRanking.length);
  assert.ok(result.questionRanking.length);
  assert.ok(result.heatmap.cells.length);
  assert.ok(result.answerDistributions.length);
  assert.ok(result.reasonSummaries.length);
  assert.ok(result.scoreConflicts.length);
  assert.ok(result.annotatorStats.length);
  assert.ok(result.coverage.completedSubmissionCount);
  assert.ok(result.headlines.length >= 3);
  assert.equal(result.requiresFieldConfirmation, false);
});
```

- [ ] **Step 2: Run the orchestration test**

Run: `node --test tests/r2v-analysis.test.mjs`

Expected: FAIL because `analyze.ts` and `demo.ts` do not exist.

- [ ] **Step 3: Implement the end-to-end result**

Add `CoverageStats` to `lib/r2v/types.ts`:

```ts
export interface CoverageStats {
  totalRowCount: number;
  completedSubmissionCount: number;
  unfinishedSubmissionCount: number;
  abandonedCount: number;
  questionCount: number;
  validLabelsByQuestion: Array<{ questionKey: string; count: number }>;
  insufficientQuestionCount: number;
  parseFailureCount: number;
}
```

Define and export `R2VAnalysisResult` from `lib/r2v/analyze.ts`:

```ts
export interface R2VAnalysisResult {
  fileName: string;
  taskType: Exclude<TaskType, "unknown">;
  taskLabel: string;
  requiresFieldConfirmation: false;
  schema: DetectedR2VSchema;
  coverage: CoverageStats;
  dimensionRanking: DimensionStats[];
  questionRanking: QuestionStats[];
  heatmap: { questions: string[]; dimensions: string[]; cells: CellStats[] };
  answerDistributions: CellStats[];
  scoreStats: ScoreCellStats[];
  reasonSummaries: ReasonSummary[];
  scoreConflicts: R2VConflict[];
  annotatorStats: AnnotatorStats[];
  headlines: Array<{ level: "attention" | "info" | "good"; title: string; detail: string }>;
  submissions: NormalizedSubmission[];
}

export function analyzeR2VRows(
  rows: DataRow[],
  fileName: string,
  forcedTaskType?: Exclude<TaskType, "unknown">,
): R2VAnalysisResult;
```

Headline examples must be generated from actual metrics:

```text
环境声场一致性最值得关注：94.0% 的题目出现过分歧，其中 66.0% 属于严重分歧。
题目 q-018 最需要对齐：7 个维度中有 5 个发生分歧，2 个达到严重分歧。
当前 50 道题中，12 道只有 8 人完成；完成度问题未计入分歧率。
```

- [ ] **Step 4: Create deterministic demo rows**

`createR2VDemoRows()` must return 40 completed audio submissions across 4 questions and 10 annotators, plus 4 unfinished assignments. Include:

- one 7 YES / 3 NO cell
- one 6 / 4 severe cell
- one four-way answer cell
- tone reasons on both majority and minority answers
- one 5-point/general-NO conflict

- [ ] **Step 5: Add the real-file verifier**

Create `scripts/analyze-r2v-file.mjs` that:

1. Accepts one file path from `process.argv[2]`.
2. Reads CSV/TSV/XLSX with `xlsx`.
3. Calls `analyzeR2VRows`.
4. Prints JSON containing task type, total rows, completed submissions, question count, top dimension, and conflict count.
5. Exits with code 1 when no file path is provided or no R2V task is detected.

- [ ] **Step 6: Run tests and verify the supplied sample**

Run:

```bash
node --test tests/r2v-analysis.test.mjs
node scripts/analyze-r2v-file.mjs "/Users/bytedance/Downloads/7668287611890323236_20260731113204.csv"
```

Expected sample output contains:

```json
{
  "taskType": "audio",
  "totalRows": 2700,
  "completedSubmissions": 448,
  "questionCount": 50
}
```

- [ ] **Step 7: Commit orchestration**

```bash
git add lib/r2v/analyze.ts lib/r2v/demo.ts scripts/analyze-r2v-file.mjs tests/r2v-analysis.test.mjs
git commit -m "feat: orchestrate R2V analysis"
```

---

### Task 6: Conclusions-first dashboard and the ten analysis views

**Files:**
- Create: `app/r2v/MetricHelp.tsx`
- Create: `app/r2v/AnalysisOverview.tsx`
- Create: `app/r2v/DimensionRanking.tsx`
- Create: `app/r2v/QuestionRanking.tsx`
- Create: `app/r2v/DisagreementHeatmap.tsx`
- Create: `app/r2v/ReasonAndConflictViews.tsx`
- Create: `app/r2v/AnnotatorAndCoverageViews.tsx`
- Create: `app/r2v/R2VDashboard.tsx`
- Test: `tests/r2v-ui-source.test.mjs`

**Interfaces:**
- Consumes: `R2VAnalysisResult`.
- Produces: `R2VDashboard({ analysis, onTaskOverride, onReset })`.

- [ ] **Step 1: Write the UI contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships conclusions-first views and plain-language metric help", async () => {
  const files = await Promise.all([
    "R2VDashboard.tsx",
    "DimensionRanking.tsx",
    "QuestionRanking.tsx",
    "DisagreementHeatmap.tsx",
    "ReasonAndConflictViews.tsx",
    "AnnotatorAndCoverageViews.tsx",
    "MetricHelp.tsx",
  ].map((name) => readFile(new URL(`../app/r2v/${name}`, import.meta.url), "utf8")));
  const source = files.join("\n");
  for (const copy of [
    "维度分歧榜",
    "单题分歧榜",
    "题目 × 维度",
    "答案分布",
    "严重分歧",
    "混乱度",
    "原因汇总",
    "总分与维度冲突",
    "标注员偏差",
    "完成覆盖",
    "怎么理解",
  ]) assert.match(source, new RegExp(copy));
});
```

- [ ] **Step 2: Run the UI contract test**

Run: `node --test tests/r2v-ui-source.test.mjs`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Build the metric-help component**

Implement:

```tsx
export function MetricHelp({
  title,
  plain,
  formula,
  example,
}: {
  title: string;
  plain: string;
  formula: string;
  example: string;
}) {
  return (
    <details className="metric-help">
      <summary>怎么理解</summary>
      <strong>{title}</strong>
      <p>{plain}</p>
      <code>{formula}</code>
      <small>{example}</small>
    </details>
  );
}
```

Every advanced metric must use this component or an equivalent visible explanation.

- [ ] **Step 4: Build overview and leaderboard components**

Requirements:

- Overview starts with 3–5 generated headline sentences.
- KPI labels use business language: `有效标注`, `底层题目`, `高分歧题`, `严重分歧`, `规则冲突`.
- Dimension rows include severe rate, disagreement occurrence, mean disagreement, entropy, valid question count, and a stacked answer distribution.
- Question rows include effective annotators, disputed dimensions, severe dimensions, score spread, and a one-sentence “为什么值得对齐”.
- Tables are sortable but default to the business-priority order from the analysis engine.

- [ ] **Step 5: Build heatmap and detail drawer**

Requirements:

- Use CSS grid for the matrix and a fixed legend.
- Color by disagreement degree: calm neutral at 0, amber at moderate disagreement, red at severe disagreement.
- Include visible symbols or text so color is not the only carrier.
- Clicking a cell opens a drawer with answer counts, rates, annotators, reasons, entity/REF slot, and score context.
- Cells with fewer than two answers show `样本不足` rather than a disagreement color.

- [ ] **Step 6: Build reasons, conflicts, annotator, and coverage views**

Requirements:

- Reason cards are grouped by selected answer.
- Conflict cards separate `确定性数据问题` from `需要业务复核`.
- Annotator view includes majority alignment, per-dimension deviation, unknown-answer rate, and sample size.
- Coverage view displays per-question completion counts and never labels incompleteness as disagreement.

- [ ] **Step 7: Build dashboard navigation**

Use these tabs:

```ts
type R2VTab =
  | "overview"
  | "dimensions"
  | "questions"
  | "heatmap"
  | "reasons"
  | "conflicts"
  | "annotators"
  | "coverage";
```

The overview contains answer-distribution highlights so a separate top-level distribution tab is unnecessary. Add a non-blocking task selector with `自动识别 / 物品 / 场景 / 音频`; switching it immediately reruns analysis.

- [ ] **Step 8: Run the UI contract test**

Run: `node --test tests/r2v-ui-source.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit the dashboard**

```bash
git add app/r2v tests/r2v-ui-source.test.mjs
git commit -m "feat: add understandable R2V analysis views"
```

---

### Task 7: Integrate upload, demo, exports, and responsive visual polish

**Files:**
- Create: `lib/r2v/export.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/static-pages.test.mjs`
- Test: `tests/r2v-export.test.mjs`

**Interfaces:**
- Consumes: `analyzeR2VRows`, `createR2VDemoRows`, `R2VDashboard`.
- Produces: public upload-to-analysis experience and export downloads.

- [ ] **Step 1: Write export tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createR2VDemoRows } from "../lib/r2v/demo.ts";
import { analyzeR2VRows } from "../lib/r2v/analyze.ts";
import {
  createR2VMarkdownReport,
  createDimensionCsv,
  createQuestionCsv,
} from "../lib/r2v/export.ts";

test("exports readable reports with metric definitions and sample sizes", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  const markdown = createR2VMarkdownReport(result);
  assert.match(markdown, /维度分歧榜/);
  assert.match(markdown, /严重分歧率/);
  assert.match(markdown, /有效样本/);
  assert.match(createDimensionCsv(result), /平均分歧度/);
  assert.match(createQuestionCsv(result), /严重分歧维度数/);
});
```

- [ ] **Step 2: Run the export test**

Run: `node --test tests/r2v-export.test.mjs`

Expected: FAIL because `lib/r2v/export.ts` does not exist.

- [ ] **Step 3: Implement exports**

Expose:

```ts
export function createR2VMarkdownReport(result: R2VAnalysisResult): string;
export function createDimensionCsv(result: R2VAnalysisResult): string;
export function createQuestionCsv(result: R2VAnalysisResult): string;
export function createReasonCsv(result: R2VAnalysisResult): string;
export function createConflictCsv(result: R2VAnalysisResult): string;
export function createAnnotatorCsv(result: R2VAnalysisResult): string;
```

Each file must include task type, valid sample size, metric definition, and generation time. Escape CSV cells with RFC 4180 quoting.

- [ ] **Step 4: Replace the generic post-upload analysis**

In `app/page.tsx`:

- Keep browser file selection, drag/drop, workbook and sheet parsing.
- Analyze the selected sheet with `analyzeR2VRows`.
- Use `createR2VDemoRows()` for the demo.
- Render `R2VDashboard` after upload.
- Do not render a field-mapping or confirmation screen.
- Preserve a reset action to upload another file.
- For a genuinely non-R2V spreadsheet, show a clear unsupported-task message and retain the existing generic analysis as an optional fallback, not the default.

- [ ] **Step 5: Update product copy**

Use:

```text
Title: R2V 标注分歧分析 Agent
Hero: 上传标注结果，直接找到最需要对齐的问题
Body: 自动识别物品、场景和音频任务，从维度、题目、原因与标注员多个角度解释分歧。
Privacy: 文件只在你的浏览器中解析，不上传原始数据
```

- [ ] **Step 6: Add visual and responsive styles**

In `app/globals.css`:

- Preserve the current restrained editorial visual language.
- Use one strong accent for attention and neutral ink colors for normal data.
- Keep body copy at least 14px and important conclusions at least 16px.
- Make dense tables horizontally scrollable below 900px.
- Convert KPI grids to 2 columns below 760px and 1 column below 520px.
- Keep heatmap row labels sticky on desktop and readable on mobile.
- Respect `prefers-reduced-motion`.
- Avoid decorative animation that competes with data interpretation.

- [ ] **Step 7: Update HTML/build tests**

Update tests to assert the new title and copy:

```js
assert.match(html, /R2V 标注分歧分析 Agent/);
assert.match(html, /上传标注结果/);
assert.match(entry, /维度分歧榜/);
assert.match(entry, /完成覆盖/);
assert.doesNotMatch(entry, /确认字段映射/);
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test tests/r2v-export.test.mjs tests/r2v-ui-source.test.mjs
npm run build:pages
node --test tests/static-pages.test.mjs
```

Expected: all tests pass and the static bundle contains all ten analysis views.

- [ ] **Step 9: Commit integration**

```bash
git add lib/r2v/export.ts app/page.tsx app/globals.css app/layout.tsx tests
git commit -m "feat: integrate R2V disagreement agent"
```

---

### Task 8: Full verification, real-data acceptance, and public deployment

**Files:**
- Modify only files required by failures discovered in this task.

**Interfaces:**
- Consumes: complete application.
- Produces: verified GitHub Pages deployment.

- [ ] **Step 1: Run formatting and static checks**

Run:

```bash
git diff --check
npm run lint
```

Expected: no whitespace errors and no lint errors.

- [ ] **Step 2: Run the full automated suite**

Run:

```bash
npm test
```

Expected: Vinext build, GitHub Pages build, and all Node tests pass.

- [ ] **Step 3: Verify the supplied real audio export**

Run:

```bash
node scripts/analyze-r2v-file.mjs "/Users/bytedance/Downloads/7668287611890323236_20260731113204.csv"
```

Expected:

- task type: audio
- total rows: 2,700
- completed submissions: 448
- bottom-level questions: 50
- question key: `uid`
- annotator field: `[标注]操作人`
- no field confirmation required

- [ ] **Step 4: Inspect the built app locally**

Run:

```bash
npm run build:pages
npx vite preview --config vite.pages.config.ts --host 127.0.0.1
```

Open the local preview and verify:

1. Demo reaches the overview without a mapping step.
2. Each of the eight navigation tabs renders.
3. The overview visibly includes answer distributions, completing the ten agreed analysis methods.
4. Heatmap cells open the detail drawer.
5. “怎么理解” explains severe disagreement and entropy.
6. Task override reruns analysis without clearing the workbook.
7. Mobile width does not clip navigation or conclusions.

- [ ] **Step 5: Commit verification fixes**

If Step 1–4 required changes:

```bash
git add app/page.tsx app/globals.css app/layout.tsx app/r2v lib/r2v scripts tests
git commit -m "fix: complete R2V acceptance checks"
```

If no changes were needed, do not create an empty commit.

- [ ] **Step 6: Push the verified main branch**

Run:

```bash
git push origin main
```

Expected: GitHub Pages builds the pushed commit for `data-lumen-agent`.

- [ ] **Step 7: Verify the public URL**

Run:

```bash
curl -I https://356341603wang-gif.github.io/data-lumen-agent/
```

Expected: HTTP 200. Open the public URL and repeat the demo upload smoke check.
