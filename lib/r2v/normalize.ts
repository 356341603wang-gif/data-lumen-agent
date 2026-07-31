import type { DataRow } from "../analysis";
import {
  detectR2VSchema,
  stripPlatformPrefix,
  type DetectedR2VSchema,
} from "./detect.ts";
import {
  getProfile,
  isKnownTaskType,
  normalizeAnswer,
} from "./profiles.ts";
import type {
  CanonicalAnswer,
  DimensionObservation,
  EntityKind,
  KnownTaskType,
  NormalizedSubmission,
  ScoreObservation,
  ScoreValue,
} from "./types";

export interface NormalizeResult {
  schema: DetectedR2VSchema;
  submissions: NormalizedSubmission[];
  sourceWarnings: string[];
}

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function parseArrayish(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isBlank(value)) return [];
  if (typeof value === "string") {
    const raw = value.trim();
    if (
      (raw.startsWith("[") && raw.endsWith("]")) ||
      (raw.startsWith("{") && raw.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value];
      }
    }
  }
  return [value];
}

function parseObject(
  value: unknown,
): { value: Record<string, unknown> | null; error?: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { value: value as Record<string, unknown> };
  }
  if (typeof value !== "string" || !value.trim()) return { value: null };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { value: parsed as Record<string, unknown> };
    }
    return { value: null, error: "答案 JSON 不是对象" };
  } catch {
    return { value: null, error: "答案 JSON 解析失败" };
  }
}

function flattenedData(row: DataRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(row).forEach(([field, value]) => {
    const stripped = stripPlatformPrefix(field);
    if (stripped !== field || /^[a-z][a-z0-9_]*$/i.test(stripped)) {
      result[stripped] = value;
    }
  });
  return result;
}

function answerPayload(
  row: DataRow,
  schema: DetectedR2VSchema,
): {
  data: Record<string, unknown>;
  root: Record<string, unknown> | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const parsed = schema.answerField
    ? parseObject(row[schema.answerField])
    : { value: null };
  if (parsed.error) warnings.push(parsed.error);
  const root = parsed.value;
  const rootData =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {};
  const dataMap =
    root?.dataMap &&
    typeof root.dataMap === "object" &&
    !Array.isArray(root.dataMap)
      ? (root.dataMap as Record<string, unknown>)
      : {};
  return {
    data: { ...flattenedData(row), ...dataMap, ...rootData },
    root,
    warnings,
  };
}

function findDataValue(
  data: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (Object.hasOwn(data, key) && !isBlank(data[key])) return data[key];
  }
  const normalized = new Map(
    Object.keys(data).map((key) => [
      stripPlatformPrefix(key).replace(/[\s_-]+/g, "").toLowerCase(),
      key,
    ]),
  );
  for (const key of keys) {
    const match = normalized.get(key.replace(/[\s_-]+/g, "").toLowerCase());
    if (match && !isBlank(data[match])) return data[match];
  }
  return undefined;
}

function valueAt(value: unknown, index: number): unknown {
  const array = parseArrayish(value);
  return array[index];
}

function textAt(value: unknown, index?: number): string | undefined {
  const selected = index === undefined ? value : valueAt(value, index);
  if (isBlank(selected)) return undefined;
  return String(selected).trim();
}

function normalizeScore(value: unknown): ScoreValue | null {
  if (isBlank(value)) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw !== "") return numeric;
  const token = raw.toUpperCase().replace(/\s+/g, "_");
  if (["HIGH", "高", "高价值"].includes(token)) return "HIGH";
  if (["MEDIUM", "MID", "中", "中价值"].includes(token)) return "MEDIUM";
  if (["LOW", "低", "低价值"].includes(token)) return "LOW";
  if (["SKIP", "不打分", "跳过"].includes(token)) return "SKIP";
  return null;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function questionKey(row: DataRow, schema: DetectedR2VSchema): string {
  if (schema.questionField && !isBlank(row[schema.questionField])) {
    return String(row[schema.questionField]).trim();
  }
  const assets = [
    row.target_video,
    row.ref_1,
    row.ref_2,
    row.ref_3,
    row.ref_4,
    row.ref_5,
    row.ref_6,
  ]
    .map((value) => String(value ?? "").trim())
    .join("|");
  return `asset-${stableHash(assets)}`;
}

function actualRefSlots(
  row: DataRow,
  schema: DetectedR2VSchema,
): number[] {
  const fields =
    schema.refFields.length > 0
      ? schema.refFields
      : Array.from({ length: 6 }, (_, index) => ({
          field: `ref_${index + 1}`,
          index,
        }));
  return fields
    .filter(({ field }) => !isBlank(row[field]))
    .map(({ index }) => index)
    .sort((left, right) => left - right);
}

function addDimension(
  output: DimensionObservation[],
  taskType: KnownTaskType,
  entityKey: string,
  entityKind: EntityKind,
  dimensionId: string,
  rawAnswer: unknown,
  rawReason?: unknown,
  refIndex?: number,
  groupIndex?: number,
) {
  const answer = normalizeAnswer(taskType, dimensionId, rawAnswer);
  if (!answer) return;
  const reason = isBlank(rawReason) ? undefined : String(rawReason).trim();
  output.push({
    entityKey,
    entityKind,
    refIndex,
    groupIndex,
    dimensionId,
    answer,
    reason,
  });
}

function addScore(
  output: ScoreObservation[],
  entityKey: string,
  entityKind: EntityKind,
  scoreType: "consistency" | "value",
  rawValue: unknown,
  refIndex?: number,
  groupIndex?: number,
  rawReason?: unknown,
) {
  const value = normalizeScore(rawValue);
  if (value === null) return;
  output.push({
    entityKey,
    entityKind,
    refIndex,
    groupIndex,
    scoreType,
    value,
    reason: isBlank(rawReason) ? undefined : String(rawReason).trim(),
  });
}

function matrixRow(value: unknown, index: number): unknown {
  const matrix = parseArrayish(value);
  return matrix[index];
}

function matrixCell(
  value: unknown,
  rowIndex: number,
  columnIndex: number,
  dimensionId: string,
): unknown {
  const row = matrixRow(value, rowIndex);
  if (Array.isArray(row)) return row[columnIndex];
  if (row && typeof row === "object") {
    const object = row as Record<string, unknown>;
    return (
      object[dimensionId] ??
      object[String(columnIndex)] ??
      Object.values(object)[columnIndex]
    );
  }
  return undefined;
}

function normalizeAudio(
  data: Record<string, unknown>,
  refSlots: number[],
  dimensions: DimensionObservation[],
  scores: ScoreObservation[],
) {
  const profile = getProfile("audio");
  const scoreValues = findDataValue(data, profile.consistencyScoreKeys);
  refSlots.forEach((refIndex) => {
    const entityKey = `ref_${refIndex + 1}`;
    addScore(
      scores,
      entityKey,
      "ref",
      "consistency",
      valueAt(scoreValues, refIndex),
      refIndex,
    );
    profile.dimensions.forEach((rule) => {
      const answers = findDataValue(data, rule.fieldKeys);
      const reasons = findDataValue(data, rule.reasonKeys);
      addDimension(
        dimensions,
        "audio",
        entityKey,
        "ref",
        rule.id,
        valueAt(answers, refIndex),
        valueAt(reasons, refIndex),
        refIndex,
      );
    });
  });

  addScore(
    scores,
    "target",
    "target",
    "value",
    findDataValue(data, ["targetValueScore"]),
  );
  addDimension(
    dimensions,
    "audio",
    "target",
    "target",
    "clarityIntegrity",
    findDataValue(data, ["targetClarityIntegrity"]),
    findDataValue(data, ["targetClarityIntegrityReason"]),
  );
  addDimension(
    dimensions,
    "audio",
    "target",
    "target",
    "emotionRange",
    findDataValue(data, ["targetEmotionRange"]),
    findDataValue(data, ["targetEmotionRangeReason"]),
  );

  const refValueScores = findDataValue(data, ["refValueScores"]);
  refSlots.forEach((refIndex) => {
    const entityKey = `ref_${refIndex + 1}`;
    addScore(
      scores,
      entityKey,
      "ref",
      "value",
      valueAt(refValueScores, refIndex),
      refIndex,
    );
    addDimension(
      dimensions,
      "audio",
      entityKey,
      "ref",
      "clarityIntegrity",
      valueAt(findDataValue(data, ["refClarityIntegrityList"]), refIndex),
      valueAt(
        findDataValue(data, ["refClarityIntegrityReasonList"]),
        refIndex,
      ),
      refIndex,
    );
    addDimension(
      dimensions,
      "audio",
      entityKey,
      "ref",
      "emotionRange",
      valueAt(findDataValue(data, ["refEmotionRangeList"]), refIndex),
      valueAt(findDataValue(data, ["refEmotionRangeReasonList"]), refIndex),
      refIndex,
    );
  });
}

function normalizeRefDimensions(
  taskType: "object" | "scene",
  data: Record<string, unknown>,
  refSlots: number[],
  dimensions: DimensionObservation[],
  scores: ScoreObservation[],
) {
  const profile = getProfile(taskType);
  const consistencyScores = findDataValue(data, ["refConsistencyScores"]);
  const genericDimensions = findDataValue(data, ["consistencyDimensions"]);
  const genericReasons = findDataValue(data, ["consistencyDimensionReasons"]);

  refSlots.forEach((refIndex) => {
    const entityKey = `ref_${refIndex + 1}`;
    addScore(
      scores,
      entityKey,
      "ref",
      "consistency",
      valueAt(consistencyScores, refIndex),
      refIndex,
    );
    profile.dimensions.forEach((rule, dimensionIndex) => {
      const directAnswers = findDataValue(data, rule.fieldKeys);
      const directReasons = findDataValue(data, rule.reasonKeys);
      const answer =
        valueAt(directAnswers, refIndex) ??
        matrixCell(genericDimensions, refIndex, dimensionIndex, rule.id);
      const reason =
        valueAt(directReasons, refIndex) ??
        matrixCell(genericReasons, refIndex, dimensionIndex, rule.id);
      addDimension(
        dimensions,
        taskType,
        entityKey,
        "ref",
        rule.id,
        answer,
        reason,
        refIndex,
      );
    });
  });
}

function normalizeGroups(
  taskType: "object" | "scene",
  data: Record<string, unknown>,
  dimensions: DimensionObservation[],
  scores: ScoreObservation[],
) {
  const profile = getProfile(taskType);
  const groups = parseArrayish(
    findDataValue(data, ["multiViewGroupRefIndexes"]),
  );
  const groupScores = findDataValue(data, ["multiViewGroupScores"]);
  const groupDimensions = findDataValue(data, ["multiViewDimensions"]);
  const groupReasons = findDataValue(data, ["multiViewDimensionReasons"]);

  groups.forEach((rawMembers, groupIndex) => {
    if (!Array.isArray(rawMembers)) return;
    const entityKey = `multiview_${groupIndex + 1}`;
    addScore(
      scores,
      entityKey,
      "multiview",
      "consistency",
      valueAt(groupScores, groupIndex),
      undefined,
      groupIndex,
    );
    profile.dimensions.forEach((rule, dimensionIndex) => {
      addDimension(
        dimensions,
        taskType,
        entityKey,
        "multiview",
        rule.id,
        matrixCell(groupDimensions, groupIndex, dimensionIndex, rule.id),
        matrixCell(groupReasons, groupIndex, dimensionIndex, rule.id),
        undefined,
        groupIndex,
      );
    });
  });
}

function normalizeObjectValues(
  data: Record<string, unknown>,
  refSlots: number[],
  dimensions: DimensionObservation[],
  scores: ScoreObservation[],
) {
  const profile = getProfile("object");
  const groupMembership = new Set<number>();
  parseArrayish(findDataValue(data, ["multiViewGroupRefIndexes"])).forEach(
    (members) => {
      if (Array.isArray(members)) {
        members.forEach((member) => {
          const numeric = Number(member);
          if (Number.isInteger(numeric)) groupMembership.add(numeric);
        });
      }
    },
  );

  const singleScores = findDataValue(data, ["singleRefValueScores"]);
  const singleDimensions = findDataValue(data, ["singleRefValueDimensions"]);
  const singleReasons = findDataValue(data, ["singleRefValueDimensionReasons"]);
  refSlots
    .filter((refIndex) => !groupMembership.has(refIndex))
    .forEach((refIndex) => {
      const entityKey = `ref_${refIndex + 1}`;
      addScore(
        scores,
        entityKey,
        "ref",
        "value",
        valueAt(singleScores, refIndex),
        refIndex,
      );
      profile.valueDimensions.forEach((rule, dimensionIndex) => {
        addDimension(
          dimensions,
          "object",
          entityKey,
          "ref",
          rule.id,
          matrixCell(singleDimensions, refIndex, dimensionIndex, rule.id),
          matrixCell(singleReasons, refIndex, dimensionIndex, rule.id),
          refIndex,
        );
      });
    });

  const groupScores = findDataValue(data, ["multiViewValueScores"]);
  const groupDimensions = findDataValue(data, ["multiViewValueDimensions"]);
  const groupReasons = findDataValue(data, ["multiViewValueDimensionReasons"]);
  parseArrayish(findDataValue(data, ["multiViewGroupRefIndexes"])).forEach(
    (members, groupIndex) => {
      if (!Array.isArray(members)) return;
      const entityKey = `multiview_${groupIndex + 1}`;
      addScore(
        scores,
        entityKey,
        "multiview",
        "value",
        valueAt(groupScores, groupIndex),
        undefined,
        groupIndex,
      );
      profile.valueDimensions.forEach((rule, dimensionIndex) => {
        addDimension(
          dimensions,
          "object",
          entityKey,
          "multiview",
          rule.id,
          matrixCell(groupDimensions, groupIndex, dimensionIndex, rule.id),
          matrixCell(groupReasons, groupIndex, dimensionIndex, rule.id),
          undefined,
          groupIndex,
        );
      });
    },
  );
}

function normalizeSceneValues(
  data: Record<string, unknown>,
  scores: ScoreObservation[],
) {
  const groups = parseArrayish(
    findDataValue(data, [
      "sceneGroupRefIndexes",
      "sceneValueGroupRefIndexes",
      "sceneGroups",
    ]),
  );
  const groupScores = findDataValue(data, [
    "sceneGroupScores",
    "sceneValueScores",
  ]);
  const groupReasons = findDataValue(data, [
    "sceneGroupReasons",
    "sceneValueReasons",
  ]);
  groups.forEach((members, groupIndex) => {
    if (!Array.isArray(members)) return;
    addScore(
      scores,
      `scene_group_${groupIndex + 1}`,
      "scene-group",
      "value",
      valueAt(groupScores, groupIndex),
      undefined,
      groupIndex,
      valueAt(groupReasons, groupIndex),
    );
  });
}

function hasCoreAnswer(
  data: Record<string, unknown>,
  taskType: KnownTaskType,
): boolean {
  const profile = getProfile(taskType);
  const keys = [
    ...profile.consistencyScoreKeys,
    ...profile.valueScoreKeys,
    ...profile.dimensions.flatMap((rule) => rule.fieldKeys),
  ];
  return keys.some((key) => !isBlank(findDataValue(data, [key])));
}

function isCompletedByStatus(value: unknown): boolean | null {
  if (isBlank(value)) return null;
  const token = String(value).trim().toLowerCase();
  if (/完成|已提交|done|complete|submitted|true|1/.test(token)) return true;
  if (/未完成|待标注|pending|false|0/.test(token)) return false;
  return null;
}

export function normalizeR2VRows(
  rows: DataRow[],
  forcedTaskType?: KnownTaskType,
): NormalizeResult {
  const detected = detectR2VSchema(rows);
  const taskType = forcedTaskType ?? detected.taskType;
  const schema: DetectedR2VSchema = { ...detected, taskType };
  if (!isKnownTaskType(taskType)) {
    return {
      schema,
      submissions: [],
      sourceWarnings: [
        ...schema.notes,
        "无法应用 R2V 规则；请确认文件属于物品、场景或音频任务。",
      ],
    };
  }

  const submissions = rows.map((row, rawRowIndex) => {
    const { data, root, warnings } = answerPayload(row, schema);
    const refSlots = actualRefSlots(row, schema);
    const dimensions: DimensionObservation[] = [];
    const scores: ScoreObservation[] = [];

    if (taskType === "audio") {
      normalizeAudio(data, refSlots, dimensions, scores);
    } else {
      normalizeRefDimensions(
        taskType,
        data,
        refSlots,
        dimensions,
        scores,
      );
      normalizeGroups(taskType, data, dimensions, scores);
      if (taskType === "object") {
        normalizeObjectValues(data, refSlots, dimensions, scores);
      } else {
        normalizeSceneValues(data, scores);
      }
    }

    const abandoned = Boolean(
      root?.isAbandoned ??
        findDataValue(data, ["isAbandoned", "废弃", "是否废弃"]),
    );
    const statusCompleted = schema.completionField
      ? isCompletedByStatus(row[schema.completionField])
      : null;
    const answerCellPresent = schema.answerField
      ? !isBlank(row[schema.answerField])
      : false;
    const completed =
      abandoned ||
      (statusCompleted ??
        (answerCellPresent || hasCoreAnswer(data, taskType)));

    return {
      taskType,
      questionKey: questionKey(row, schema),
      assignmentKey:
        schema.assignmentField && !isBlank(row[schema.assignmentField])
          ? String(row[schema.assignmentField]).trim()
          : undefined,
      annotator:
        schema.annotatorField && !isBlank(row[schema.annotatorField])
          ? String(row[schema.annotatorField]).trim()
          : undefined,
      completed,
      abandoned,
      refSlots,
      dimensions,
      scores,
      remark: textAt(findDataValue(data, ["remark", "备注"])),
      rawRowIndex,
      raw: row,
      parseWarnings: warnings,
    } satisfies NormalizedSubmission;
  });

  return {
    schema,
    submissions,
    sourceWarnings: schema.notes,
  };
}
