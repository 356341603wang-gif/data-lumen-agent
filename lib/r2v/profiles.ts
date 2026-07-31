import type {
  CanonicalAnswer,
  DimensionRule,
  KnownTaskType,
  R2VProfile,
  TaskType,
} from "./types";

const YES_NO: CanonicalAnswer[] = ["YES", "NO"];
const YES_NO_NA: CanonicalAnswer[] = ["YES", "NO", "NA"];
const AUDIO_SIMILARITY: CanonicalAnswer[] = [
  "YES",
  "HIGH_SIMILARITY",
  "LOW_SIMILARITY",
  "UNKNOWN",
];
const AUDIO_GENERAL: CanonicalAnswer[] = ["YES", "NO", "UNKNOWN"];

function dimension(
  id: string,
  label: string,
  allowed: CanonicalAnswer[],
  fieldKeys: string[],
  reasonKeys: string[] = [],
  reasonRequired = false,
): DimensionRule {
  return {
    id,
    label,
    allowed,
    fieldKeys,
    reasonKeys,
    reasonRequired,
  };
}

export const R2V_PROFILES: Record<KnownTaskType, R2VProfile> = {
  audio: {
    type: "audio",
    label: "音频",
    consistencyScores: [0, 1, 3, 5],
    dimensions: [
      dimension(
        "general",
        "通用一致性",
        AUDIO_GENERAL,
        ["refGeneralConsistency"],
      ),
      dimension(
        "tone",
        "音色一致",
        AUDIO_SIMILARITY,
        ["refToneConsistency"],
        ["refToneConsistencyReason"],
        true,
      ),
      dimension(
        "dialect",
        "方言语种吐字归音习惯一致",
        AUDIO_SIMILARITY,
        ["refDialectConsistency"],
      ),
      dimension(
        "emotion",
        "情绪一致",
        AUDIO_SIMILARITY,
        ["refEmotionConsistency"],
      ),
      dimension(
        "style",
        "风格语调一致",
        AUDIO_SIMILARITY,
        ["refStyleConsistency"],
      ),
      dimension(
        "environment",
        "环境声场一致",
        AUDIO_SIMILARITY,
        ["refEnvironmentConsistency"],
      ),
      dimension(
        "scenario",
        "应用场景一致",
        AUDIO_SIMILARITY,
        ["refScenarioConsistency"],
      ),
    ],
    valueDimensions: [
      dimension(
        "clarityIntegrity",
        "音频清晰与完整",
        YES_NO,
        ["targetClarityIntegrity", "refClarityIntegrityList"],
        [
          "targetClarityIntegrityReason",
          "refClarityIntegrityReasonList",
        ],
        true,
      ),
      dimension(
        "emotionRange",
        "音频情绪波动与起伏",
        YES_NO,
        ["targetEmotionRange", "refEmotionRangeList"],
        ["targetEmotionRangeReason", "refEmotionRangeReasonList"],
        true,
      ),
    ],
    jsonKeys: [
      "refToneConsistency",
      "refDialectConsistency",
      "refEmotionConsistency",
      "refEnvironmentConsistency",
      "targetClarityIntegrity",
    ],
    columnHints: [
      "音色一致",
      "方言语种吐字",
      "环境声场",
      "音频清晰与完整",
    ],
    consistencyScoreKeys: ["refConsistencyScores"],
    valueScoreKeys: ["targetValueScore", "refValueScores"],
  },
  scene: {
    type: "scene",
    label: "场景",
    consistencyScores: [0, 1, 2, 3, 4, 5],
    dimensions: [
      dimension(
        "spaceLayout",
        "空间与布局一致性",
        YES_NO,
        ["spaceLayoutConsistency", "空间与布局一致性"],
        ["spaceLayoutConsistencyReason", "空间与布局一致性原因"],
        true,
      ),
      dimension(
        "anchor",
        "场景锚点一致性",
        YES_NO,
        ["sceneAnchorConsistency", "场景锚点一致性"],
        ["sceneAnchorConsistencyReason", "场景锚点一致性原因"],
        true,
      ),
      dimension(
        "viewpoint",
        "视角一致性",
        YES_NO,
        ["viewpointConsistency", "视角一致性"],
        ["viewpointConsistencyReason", "视角一致性原因"],
        true,
      ),
      dimension(
        "state",
        "场景状态一致性",
        YES_NO,
        ["sceneStateConsistency", "场景状态一致性"],
        ["sceneStateConsistencyReason", "场景状态一致性原因"],
        true,
      ),
      dimension(
        "subjectComposition",
        "主体构成一致性",
        YES_NO_NA,
        ["subjectCompositionConsistency", "主体构成一致性"],
        ["subjectCompositionConsistencyReason", "主体构成一致性原因"],
        true,
      ),
      dimension(
        "coverage",
        "场景覆盖度",
        YES_NO,
        ["sceneCoverage", "场景覆盖度"],
        ["sceneCoverageReason", "场景覆盖度原因"],
        true,
      ),
    ],
    valueDimensions: [],
    jsonKeys: [
      "multiViewGroupRefIndexes",
      "sceneGroupRefIndexes",
      "sceneGroupScores",
      "spaceLayoutConsistency",
      "sceneAnchorConsistency",
    ],
    columnHints: [
      "空间与布局一致性",
      "场景锚点一致性",
      "场景覆盖度",
      "场景组",
    ],
    consistencyScoreKeys: [
      "refConsistencyScores",
      "multiViewGroupScores",
    ],
    valueScoreKeys: ["sceneGroupScores", "sceneValueScores"],
  },
  object: {
    type: "object",
    label: "物品",
    consistencyScores: [0, 1, 2, 3, 4, 5, "SKIP"],
    dimensions: [
      dimension(
        "shape",
        "形状一致性",
        YES_NO,
        ["shapeConsistency", "形状一致性"],
        ["shapeConsistencyReason", "形状一致性原因"],
        true,
      ),
      dimension(
        "textPattern",
        "文字图案一致性",
        YES_NO,
        ["textPatternConsistency", "文字图案一致性"],
        ["textPatternConsistencyReason", "文字图案一致性原因"],
        true,
      ),
      dimension(
        "material",
        "材质一致性",
        YES_NO,
        ["materialConsistency", "材质一致性"],
        ["materialConsistencyReason", "材质一致性原因"],
        true,
      ),
      dimension(
        "color",
        "颜色一致性",
        YES_NO,
        ["colorConsistency", "颜色一致性"],
        ["colorConsistencyReason", "颜色一致性原因"],
        true,
      ),
      dimension(
        "camera",
        "镜头一致性",
        YES_NO,
        ["cameraConsistency", "镜头一致性"],
        ["cameraConsistencyReason", "镜头一致性原因"],
        true,
      ),
      dimension(
        "scene",
        "场景一致性",
        YES_NO_NA,
        ["sceneConsistency", "场景一致性"],
        ["sceneConsistencyReason", "场景一致性原因"],
        true,
      ),
      dimension(
        "coverage",
        "主体覆盖度",
        YES_NO,
        ["subjectCoverage", "主体覆盖度"],
        ["subjectCoverageReason", "主体覆盖度原因"],
        true,
      ),
    ],
    valueDimensions: [
      dimension(
        "packagingText",
        "文字与包装信息",
        YES_NO,
        ["packagingText", "文字与包装信息"],
        ["packagingTextReason", "文字与包装信息原因"],
        true,
      ),
      dimension(
        "complexPattern",
        "复杂图案",
        YES_NO,
        ["complexPattern", "复杂图案"],
        ["complexPatternReason", "复杂图案原因"],
        true,
      ),
      dimension(
        "complexTexture",
        "复杂纹理",
        YES_NO,
        ["complexTexture", "复杂纹理"],
        ["complexTextureReason", "复杂纹理原因"],
        true,
      ),
      dimension(
        "fineStructure",
        "精细结构",
        YES_NO,
        ["fineStructure", "精细结构"],
        ["fineStructureReason", "精细结构原因"],
        true,
      ),
      dimension(
        "craftTexture",
        "精细工艺复杂纹理",
        YES_NO,
        ["craftTexture", "精细工艺复杂纹理"],
        ["craftTextureReason", "精细工艺复杂纹理原因"],
        true,
      ),
      dimension(
        "subjectClarity",
        "主体清晰度",
        YES_NO,
        ["subjectClarity", "主体清晰度"],
        ["subjectClarityReason", "主体清晰度原因"],
        true,
      ),
    ],
    jsonKeys: [
      "consistencyDimensions",
      "consistencyDimensionReasons",
      "multiViewGroupRefIndexes",
      "singleRefValueScores",
      "multiViewValueScores",
    ],
    columnHints: [
      "形状一致性",
      "文字图案一致性",
      "材质一致性",
      "对象价值",
    ],
    consistencyScoreKeys: [
      "refConsistencyScores",
      "multiViewGroupScores",
    ],
    valueScoreKeys: ["singleRefValueScores", "multiViewValueScores"],
  },
};

const ANSWER_ALIASES = new Map<string, CanonicalAnswer>();

function addAliases(answer: CanonicalAnswer, aliases: string[]) {
  aliases.forEach((alias) => ANSWER_ALIASES.set(alias, answer));
}

addAliases("YES", [
  "YES",
  "Y",
  "TRUE",
  "是",
  "一致",
  "完全一致",
]);
addAliases("NO", ["NO", "N", "FALSE", "否", "不一致"]);
addAliases("HIGH_SIMILARITY", [
  "HIGH_SIMILARITY",
  "HIGH SIMILARITY",
  "高度相似",
  "高相似",
]);
addAliases("LOW_SIMILARITY", [
  "LOW_SIMILARITY",
  "LOW SIMILARITY",
  "低相似",
  "相似度低",
]);
addAliases("UNKNOWN", [
  "UNKNOWN",
  "UNSURE",
  "无法判断",
  "不能判断",
  "不确定",
]);
addAliases("NA", [
  "NA",
  "N/A",
  "NOT_APPLICABLE",
  "NOT APPLICABLE",
  "不考虑",
  "不适用",
]);

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[－—]/g, "-")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function getProfile(taskType: KnownTaskType): R2VProfile {
  return R2V_PROFILES[taskType];
}

export function getDimensionRule(
  taskType: KnownTaskType,
  dimensionId: string,
): DimensionRule | undefined {
  const profile = getProfile(taskType);
  return [...profile.dimensions, ...profile.valueDimensions].find(
    (rule) => rule.id === dimensionId,
  );
}

export function normalizeAnswer(
  taskType: KnownTaskType,
  dimensionId: string,
  value: unknown,
): CanonicalAnswer | null {
  const token = normalizeToken(value);
  if (!token) return null;
  const answer = ANSWER_ALIASES.get(token);
  if (!answer) return null;
  const rule = getDimensionRule(taskType, dimensionId);
  if (!rule) return answer;
  return rule.allowed.includes(answer) ? answer : null;
}

export function isKnownTaskType(value: TaskType): value is KnownTaskType {
  return value !== "unknown";
}

export const answerLabels: Record<CanonicalAnswer, string> = {
  YES: "YES",
  NO: "NO",
  HIGH_SIMILARITY: "高度相似",
  LOW_SIMILARITY: "低相似",
  UNKNOWN: "无法判断",
  NA: "N/A",
};

