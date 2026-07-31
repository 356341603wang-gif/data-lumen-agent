import type { DataRow } from "../analysis";
import { R2V_PROFILES } from "./profiles.ts";
import type { TaskType } from "./types";

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
  requiresConfirmation: false;
}

const QUESTION_CANDIDATES = [
  "uid",
  "orig_uid",
  "数据标识",
  "object_id",
  "name",
];

const ANNOTATOR_CANDIDATES = [
  "[标注]操作人",
  "标注员",
  "操作人",
  "annotator",
  "worker",
  "user",
];

const ANSWER_CANDIDATES = [
  "最终结果-JSON",
  "最终结果_JSON",
  "最终结果",
  "答案",
  "answer",
  "result",
];

const ASSIGNMENT_CANDIDATES = [
  "题目ID",
  "题目id",
  "assignment_id",
  "assignmentId",
  "itemID",
  "itemId",
  "task_id",
];

const COMPLETION_CANDIDATES = [
  "完成状态",
  "标注状态",
  "status",
  "completed",
  "isCompleted",
];

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function stripPlatformPrefix(field: string): string {
  return field
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^(标注|质检|检查)[._\s-]+/i, "")
    .trim();
}

function findField(fields: string[], candidates: string[]): string | undefined {
  const normalized = new Map(
    fields.map((field) => [field.trim().toLowerCase(), field]),
  );
  for (const candidate of candidates) {
    const match = normalized.get(candidate.toLowerCase());
    if (match) return match;
  }
  return fields.find((field) => {
    const stripped = stripPlatformPrefix(field).toLowerCase();
    return candidates.some(
      (candidate) => stripped === candidate.toLowerCase(),
    );
  });
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function selectAnswerField(
  fields: string[],
  rows: DataRow[],
): string | undefined {
  const candidates = ANSWER_CANDIDATES.map((candidate, priority) => {
    const field = findField(fields, [candidate]);
    if (!field) return null;
    const nonEmpty = rows.filter((row) => !isBlank(row[field]));
    const parsedCount = nonEmpty.filter((row) =>
      parseJsonObject(row[field]),
    ).length;
    return {
      field,
      priority,
      nonEmptyCount: nonEmpty.length,
      parseRate: nonEmpty.length ? parsedCount / nonEmpty.length : 0,
    };
  }).filter(Boolean) as Array<{
    field: string;
    priority: number;
    nonEmptyCount: number;
    parseRate: number;
  }>;
  return candidates
    .filter((candidate) => candidate.nonEmptyCount > 0)
    .sort(
      (left, right) =>
        right.parseRate - left.parseRate ||
        right.nonEmptyCount - left.nonEmptyCount ||
        left.priority - right.priority,
    )[0]?.field;
}

function collectObjectKeys(
  value: unknown,
  output: Set<string>,
  depth = 0,
): void {
  if (!value || typeof value !== "object" || depth > 3) return;
  if (Array.isArray(value)) {
    value.slice(0, 6).forEach((item) => collectObjectKeys(item, output, depth + 1));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    output.add(key.toLowerCase());
    collectObjectKeys(child, output, depth + 1);
  });
}

function taskScores(
  fields: string[],
  rows: DataRow[],
  answerField?: string,
): Record<Exclude<TaskType, "unknown">, number> {
  const tokens = new Set<string>();
  fields.forEach((field) => {
    tokens.add(field.toLowerCase());
    tokens.add(stripPlatformPrefix(field).toLowerCase());
  });
  if (answerField) {
    rows.slice(0, 200).forEach((row) => {
      const parsed = parseJsonObject(row[answerField]);
      collectObjectKeys(parsed, tokens);
    });
  }

  const result = { audio: 0, scene: 0, object: 0 };
  (Object.keys(R2V_PROFILES) as Array<keyof typeof result>).forEach((task) => {
    const profile = R2V_PROFILES[task];
    profile.jsonKeys.forEach((key) => {
      if (tokens.has(key.toLowerCase())) result[task] += 4;
    });
    profile.columnHints.forEach((hint) => {
      const normalizedHint = hint.toLowerCase();
      if ([...tokens].some((token) => token.includes(normalizedHint))) {
        result[task] += 2;
      }
    });
  });

  const allTokens = [...tokens].join(" ");
  if (/reftoneconsistency|refdialectconsistency|音色一致/.test(allTokens)) {
    result.audio += 8;
  }
  if (/scenegroup|spacelayout|sceneanchor|空间与布局|场景锚点/.test(allTokens)) {
    result.scene += 8;
  }
  if (
    /singlerefvaluescores|multiviewvaluescores|textpattern|文字图案|材质一致/.test(
      allTokens,
    )
  ) {
    result.object += 8;
  }
  return result;
}

function fieldStats(rows: DataRow[], field: string) {
  const values = rows
    .map((row) => row[field])
    .filter((value) => !isBlank(value))
    .map((value) => String(value));
  const uniqueCount = new Set(values).size;
  return {
    coverage: rows.length ? values.length / rows.length : 0,
    uniqueRate: values.length ? uniqueCount / values.length : 1,
    valueCount: values.length,
  };
}

function selectQuestionField(
  fields: string[],
  rows: DataRow[],
): string | undefined {
  const candidates = QUESTION_CANDIDATES.map((candidate, priority) => {
    const field = findField(fields, [candidate]);
    return field ? { field, priority, ...fieldStats(rows, field) } : null;
  }).filter(Boolean) as Array<{
    field: string;
    priority: number;
    coverage: number;
    uniqueRate: number;
    valueCount: number;
  }>;

  const repeated = candidates.filter(
    (candidate) =>
      candidate.coverage > 0 &&
      (rows.length <= 1 || candidate.uniqueRate < 0.95),
  );
  const pool = repeated.length ? repeated : candidates.filter((item) => item.coverage > 0);
  return pool.sort(
    (left, right) =>
      left.priority - right.priority ||
      right.coverage - left.coverage ||
      left.uniqueRate - right.uniqueRate,
  )[0]?.field;
}

export function detectR2VSchema(rows: DataRow[]): DetectedR2VSchema {
  const sample = rows.slice(0, 200);
  const fields = Array.from(
    new Set(sample.flatMap((row) => Object.keys(row))),
  );
  const answerField = selectAnswerField(fields, sample);
  const scores = taskScores(fields, sample, answerField);
  const ordered = (Object.entries(scores) as Array<
    [Exclude<TaskType, "unknown">, number]
  >).sort((left, right) => right[1] - left[1]);
  const taskType: TaskType = ordered[0]?.[1] > 0 ? ordered[0][0] : "unknown";
  const totalScore = ordered.reduce((sum, [, score]) => sum + score, 0);
  const confidence =
    taskType === "unknown"
      ? 0
      : Math.min(
          1,
          totalScore
            ? ordered[0][1] / Math.max(ordered[0][1] + (ordered[1]?.[1] ?? 0), 1)
            : 0,
        );

  const questionField = selectQuestionField(fields, sample);
  const annotatorField = findField(fields, ANNOTATOR_CANDIDATES);
  const assignmentField = findField(fields, ASSIGNMENT_CANDIDATES);
  const completionField = findField(fields, COMPLETION_CANDIDATES);
  const refFields = fields
    .map((field) => {
      const match = stripPlatformPrefix(field).match(/^ref_([1-6])$/i);
      return match ? { field, index: Number(match[1]) - 1 } : null;
    })
    .filter((item): item is { field: string; index: number } => Boolean(item))
    .filter(({ field }) => sample.some((row) => !isBlank(row[field])))
    .sort((left, right) => left.index - right.index);

  const notes: string[] = [];
  if (!questionField) {
    notes.push("未找到稳定题目标识，将使用 Target 与固定 REF 素材组合生成题目键。");
  }
  if (!annotatorField) {
    notes.push("未找到标注员字段，标注员偏差分析将自动隐藏。");
  }
  if (taskType === "unknown") {
    notes.push("未识别到物品、场景或音频规则特征。");
  }
  if (questionField && assignmentField && questionField !== assignmentField) {
    const assignmentStats = fieldStats(sample, assignmentField);
    if (assignmentStats.uniqueRate >= 0.95) {
      notes.push(
        `${assignmentField} 更像平台分配记录 ID；同题聚合使用 ${questionField}。`,
      );
    }
  }

  return {
    taskType,
    confidence,
    questionField,
    annotatorField,
    answerField,
    assignmentField,
    completionField,
    refFields,
    notes,
    requiresConfirmation: false,
  };
}
