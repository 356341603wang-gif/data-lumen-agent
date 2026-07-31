import { getProfile } from "./profiles.ts";
import type {
  CanonicalAnswer,
  DimensionObservation,
  KnownTaskType,
  NormalizedSubmission,
  ScoreObservation,
  ScoreValue,
} from "./types";

export interface R2VConflict {
  severity: "error" | "review";
  code: string;
  title: string;
  explanation: string;
  taskType: KnownTaskType;
  questionKey: string;
  annotator?: string;
  entityKey?: string;
  dimensionId?: string;
  rawRowIndex: number;
}

function conflict(
  submission: NormalizedSubmission,
  input: Omit<
    R2VConflict,
    "taskType" | "questionKey" | "annotator" | "rawRowIndex"
  >,
): R2VConflict {
  return {
    ...input,
    taskType: submission.taskType,
    questionKey: submission.questionKey,
    annotator: submission.annotator,
    rawRowIndex: submission.rawRowIndex,
  };
}

function entityDimensions(
  submission: NormalizedSubmission,
  entityKey: string,
): DimensionObservation[] {
  return submission.dimensions.filter(
    (dimension) => dimension.entityKey === entityKey,
  );
}

function entityScore(
  submission: NormalizedSubmission,
  entityKey: string,
  scoreType: "consistency" | "value",
): ScoreObservation | undefined {
  return submission.scores.find(
    (score) =>
      score.entityKey === entityKey && score.scoreType === scoreType,
  );
}

function dimensionMap(dimensions: DimensionObservation[]) {
  return new Map(dimensions.map((dimension) => [dimension.dimensionId, dimension]));
}

function isAffirmative(answer?: CanonicalAnswer): boolean {
  return answer === "YES" || answer === "HIGH_SIMILARITY";
}

function numericScore(score?: ScoreValue): number | null {
  return typeof score === "number" ? score : null;
}

function addCompletenessConflicts(
  submission: NormalizedSubmission,
  entityKey: string,
  scoreType: "consistency" | "value",
  dimensionIds: string[],
  output: R2VConflict[],
) {
  const score = entityScore(submission, entityKey, scoreType);
  if (!score) {
    output.push(
      conflict(submission, {
        severity: "error",
        code: "MISSING_SCORE",
        title: "缺少必填总分",
        explanation: `${entityKey} 没有填写${
          scoreType === "consistency" ? "一致性" : "价值"
        }总分。`,
        entityKey,
      }),
    );
    return;
  }
  if (score.value === "SKIP") return;
  const profile = getProfile(submission.taskType);
  const rules = [...profile.dimensions, ...profile.valueDimensions];
  const dimensions = dimensionMap(entityDimensions(submission, entityKey));
  dimensionIds.forEach((dimensionId) => {
    const rule = rules.find((candidate) => candidate.id === dimensionId);
    const observation = dimensions.get(dimensionId);
    if (!observation) {
      output.push(
        conflict(submission, {
          severity: "error",
          code: "MISSING_DIMENSION_ANSWER",
          title: "缺少维度答案",
          explanation: `${entityKey} 未填写${rule?.label ?? dimensionId}。`,
          entityKey,
          dimensionId,
        }),
      );
      return;
    }
    if (rule?.reasonRequired && !observation.reason?.trim()) {
      output.push(
        conflict(submission, {
          severity: "error",
          code: "MISSING_REASON",
          title: "缺少必填原因",
          explanation: `${entityKey} 已选择${rule.label}，但没有填写原因。`,
          entityKey,
          dimensionId,
        }),
      );
    }
  });
}

function addParseConflicts(
  submission: NormalizedSubmission,
  output: R2VConflict[],
) {
  submission.parseWarnings.forEach((warning) => {
    output.push(
      conflict(submission, {
        severity: "error",
        code: "ANSWER_PARSE_WARNING",
        title: "答案解析异常",
        explanation: warning,
      }),
    );
  });
}

function addGroupConflicts(
  submission: NormalizedSubmission,
  output: R2VConflict[],
) {
  const groups = submission.groups ?? [];
  const multiViewGroups = groups.filter(
    (group) => group.entityKind === "multiview",
  );
  const seen = new Map<number, string>();
  multiViewGroups.forEach((group) => {
    if (group.refIndexes.length < 2) {
      output.push(
        conflict(submission, {
          severity: "error",
          code: "MULTIVIEW_TOO_SMALL",
          title: "多视图组成员不足",
          explanation: `${group.entityKey} 至少需要包含 2 个 REF。`,
          entityKey: group.entityKey,
        }),
      );
    }
    group.refIndexes.forEach((refIndex) => {
      if (!submission.refSlots.includes(refIndex)) {
        output.push(
          conflict(submission, {
            severity: "error",
            code: "GROUP_REF_NOT_PRESENT",
            title: "分组引用了不存在的 REF",
            explanation: `${group.entityKey} 引用了 ref_${refIndex + 1}，但该槽位没有素材。`,
            entityKey: group.entityKey,
          }),
        );
      }
      const previous = seen.get(refIndex);
      if (previous) {
        output.push(
          conflict(submission, {
            severity: "error",
            code: "REF_IN_MULTIPLE_GROUPS",
            title: "同一 REF 重复入组",
            explanation: `ref_${refIndex + 1} 同时出现在 ${previous} 和 ${group.entityKey}。`,
            entityKey: group.entityKey,
          }),
        );
      } else {
        seen.set(refIndex, group.entityKey);
      }
      if (
        submission.taskType === "object" &&
        entityScore(submission, `ref_${refIndex + 1}`, "consistency")?.value ===
          "SKIP"
      ) {
        output.push(
          conflict(submission, {
            severity: "error",
            code: "SKIP_REF_IN_GROUP",
            title: "不打分 REF 被加入多视图组",
            explanation: `ref_${refIndex + 1} 已选择不打分，不能加入 ${group.entityKey}。`,
            entityKey: group.entityKey,
          }),
        );
      }
    });
  });
}

function audioConflicts(
  submission: NormalizedSubmission,
  output: R2VConflict[],
) {
  const consistencyDimensionIds = getProfile("audio").dimensions.map(
    (rule) => rule.id,
  );
  const valueDimensionIds = getProfile("audio").valueDimensions.map(
    (rule) => rule.id,
  );
  submission.refSlots.forEach((refIndex) => {
    const entityKey = `ref_${refIndex + 1}`;
    addCompletenessConflicts(
      submission,
      entityKey,
      "consistency",
      consistencyDimensionIds,
      output,
    );
    addCompletenessConflicts(
      submission,
      entityKey,
      "value",
      valueDimensionIds,
      output,
    );
    const score = numericScore(
      entityScore(submission, entityKey, "consistency")?.value,
    );
    const dimensions = dimensionMap(entityDimensions(submission, entityKey));
    const general = dimensions.get("general")?.answer;
    const tone = dimensions.get("tone")?.answer;
    const core = consistencyDimensionIds
      .filter((id) => id !== "general")
      .map((id) => dimensions.get(id)?.answer)
      .filter(Boolean) as CanonicalAnswer[];

    if (score === 5 && general !== "YES") {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "AUDIO_5_GENERAL_NOT_YES",
          title: "5 分与通用一致性冲突",
          explanation: `${entityKey} 给了 5 分，但通用一致性不是 YES。`,
          entityKey,
          dimensionId: "general",
        }),
      );
    }
    if (
      score === 5 &&
      core.some((answer) => answer === "LOW_SIMILARITY" || answer === "UNKNOWN")
    ) {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "AUDIO_5_HAS_LOW_CORE",
          title: "5 分包含低相似核心维度",
          explanation: `${entityKey} 给了 5 分，但至少一个核心维度为低相似或无法判断。`,
          entityKey,
        }),
      );
    }
    if (score === 3 && !isAffirmative(tone)) {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "AUDIO_3_TONE_NOT_SIMILAR",
          title: "3 分但音色没有达到高相似",
          explanation: `${entityKey} 给了 3 分，但音色不是 YES 或高度相似。`,
          entityKey,
          dimensionId: "tone",
        }),
      );
    }
    if (score === 3 && general === "YES") {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "AUDIO_3_GENERAL_YES",
          title: "3 分但通用一致性为 YES",
          explanation: `${entityKey} 可能属于同源或重叠片段，建议复核是否更接近 5 分。`,
          entityKey,
          dimensionId: "general",
        }),
      );
    }
    const affirmativeCount = core.filter(isAffirmative).length;
    if (score === 1 && tone === "YES" && affirmativeCount >= 4) {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "AUDIO_1_MANY_HIGH_DIMENSIONS",
          title: "1 分但多数核心维度高度一致",
          explanation: `${entityKey} 的总分偏低，但多数维度选择了 YES 或高度相似。`,
          entityKey,
        }),
      );
    }
    if (score === 0 && affirmativeCount >= 4) {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "AUDIO_0_MANY_HIGH_DIMENSIONS",
          title: "0 分但多数核心维度一致",
          explanation: `${entityKey} 的总分为 0，但多数核心维度为 YES 或高度相似。`,
          entityKey,
        }),
      );
    }
    addValueSemanticConflicts(submission, entityKey, output);
  });
  addCompletenessConflicts(
    submission,
    "target",
    "value",
    valueDimensionIds,
    output,
  );
  addValueSemanticConflicts(submission, "target", output);
}

function addValueSemanticConflicts(
  submission: NormalizedSubmission,
  entityKey: string,
  output: R2VConflict[],
) {
  const score = entityScore(submission, entityKey, "value")?.value;
  const dimensions = dimensionMap(entityDimensions(submission, entityKey));
  const clarity = dimensions.get("clarityIntegrity")?.answer;
  const emotion = dimensions.get("emotionRange")?.answer;
  if (score === "HIGH" && (clarity === "NO" || emotion === "NO")) {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "AUDIO_HIGH_VALUE_HAS_NO",
        title: "高价值与价值维度冲突",
        explanation: `${entityKey} 的价值总分为高，但清晰完整或情绪起伏选择了 NO。`,
        entityKey,
      }),
    );
  }
  if (score === "LOW" && clarity === "YES" && emotion === "YES") {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "AUDIO_LOW_VALUE_ALL_YES",
        title: "低价值但两个价值维度均为 YES",
        explanation: `${entityKey} 的价值总分为低，但两个价值维度均为 YES。`,
        entityKey,
      }),
    );
  }
}

function objectConflicts(
  submission: NormalizedSubmission,
  output: R2VConflict[],
) {
  const profile = getProfile("object");
  const groupedRefs = new Set(
    (submission.groups ?? [])
      .filter((group) => group.entityKind === "multiview")
      .flatMap((group) => group.refIndexes),
  );
  submission.refSlots.forEach((refIndex) => {
    const entityKey = `ref_${refIndex + 1}`;
    addCompletenessConflicts(
      submission,
      entityKey,
      "consistency",
      profile.dimensions.map((rule) => rule.id),
      output,
    );
    if (!groupedRefs.has(refIndex)) {
      addCompletenessConflicts(
        submission,
        entityKey,
        "value",
        profile.valueDimensions.map((rule) => rule.id),
        output,
      );
    } else if (entityScore(submission, entityKey, "value")) {
      output.push(
        conflict(submission, {
          severity: "error",
          code: "GROUPED_REF_HAS_SINGLE_VALUE",
          title: "已入组 REF 仍保留单项价值",
          explanation: `${entityKey} 已加入多视图组，不应继续保留单 REF 价值答案。`,
          entityKey,
        }),
      );
    }
    const score = numericScore(
      entityScore(submission, entityKey, "consistency")?.value,
    );
    const dimensions = dimensionMap(entityDimensions(submission, entityKey));
    const keyAnswers = ["shape", "textPattern", "material", "color"].map(
      (id) => dimensions.get(id)?.answer,
    );
    if (score === 5 && keyAnswers.some((answer) => answer === "NO")) {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "OBJECT_5_HAS_KEY_NO",
          title: "5 分但关键物品维度不一致",
          explanation: `${entityKey} 给了 5 分，但形状、文字图案、材质或颜色存在 NO。`,
          entityKey,
        }),
      );
    }
    if (
      score !== null &&
      score <= 2 &&
      keyAnswers.length > 0 &&
      keyAnswers.every((answer) => answer === "YES")
    ) {
      output.push(
        conflict(submission, {
          severity: "review",
          code: "OBJECT_LOW_SCORE_ALL_KEY_YES",
          title: "低分但关键物品维度全部一致",
          explanation: `${entityKey} 的总分不高于 2，但关键维度全部为 YES。`,
          entityKey,
        }),
      );
    }
    addObjectValueSemantics(submission, entityKey, output);
  });

  (submission.groups ?? [])
    .filter((group) => group.entityKind === "multiview")
    .forEach((group) => {
      addCompletenessConflicts(
        submission,
        group.entityKey,
        "consistency",
        profile.dimensions.map((rule) => rule.id),
        output,
      );
      addCompletenessConflicts(
        submission,
        group.entityKey,
        "value",
        profile.valueDimensions.map((rule) => rule.id),
        output,
      );
      addObjectValueSemantics(submission, group.entityKey, output);
    });
}

function addObjectValueSemantics(
  submission: NormalizedSubmission,
  entityKey: string,
  output: R2VConflict[],
) {
  const valueScore = numericScore(
    entityScore(submission, entityKey, "value")?.value,
  );
  if (valueScore !== 2) return;
  const dimensions = dimensionMap(entityDimensions(submission, entityKey));
  if (dimensions.get("subjectClarity")?.answer === "NO") {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "OBJECT_VALUE_2_CLARITY_NO",
        title: "价值 2 分但主体不清晰",
        explanation: `${entityKey} 的对象价值为 2 分，但主体清晰度选择了 NO。`,
        entityKey,
        dimensionId: "subjectClarity",
      }),
    );
  }
  const detailed = [
    "packagingText",
    "complexPattern",
    "complexTexture",
    "fineStructure",
    "craftTexture",
  ];
  if (
    detailed.every((id) => dimensions.get(id)?.answer === "NO")
  ) {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "OBJECT_VALUE_2_NO_DETAIL",
        title: "价值 2 分但没有精细信息",
        explanation: `${entityKey} 的对象价值为 2 分，但精细信息维度全部为 NO。`,
        entityKey,
      }),
    );
  }
}

function sceneConflicts(
  submission: NormalizedSubmission,
  output: R2VConflict[],
) {
  const profile = getProfile("scene");
  submission.refSlots.forEach((refIndex) => {
    const entityKey = `ref_${refIndex + 1}`;
    addCompletenessConflicts(
      submission,
      entityKey,
      "consistency",
      profile.dimensions.map((rule) => rule.id),
      output,
    );
    addSceneScoreSemantics(submission, entityKey, output);
  });
  (submission.groups ?? [])
    .filter((group) => group.entityKind === "multiview")
    .forEach((group) => {
      addCompletenessConflicts(
        submission,
        group.entityKey,
        "consistency",
        profile.dimensions.map((rule) => rule.id),
        output,
      );
      addSceneScoreSemantics(submission, group.entityKey, output);
    });

  const sceneGroups = (submission.groups ?? []).filter(
    (group) => group.entityKind === "scene-group",
  );
  if (!sceneGroups.length) {
    output.push(
      conflict(submission, {
        severity: "error",
        code: "MISSING_SCENE_VALUE_GROUP",
        title: "缺少场景价值组",
        explanation: "场景任务至少需要填写 1 个场景价值组。",
      }),
    );
  }
  sceneGroups.forEach((group) => {
    const score = entityScore(submission, group.entityKey, "value");
    if (!score) {
      output.push(
        conflict(submission, {
          severity: "error",
          code: "MISSING_SCENE_GROUP_SCORE",
          title: "场景价值组缺少分数",
          explanation: `${group.entityKey} 没有填写 0～2 分。`,
          entityKey: group.entityKey,
        }),
      );
    } else if (!score.reason?.trim()) {
      output.push(
        conflict(submission, {
          severity: "error",
          code: "MISSING_SCENE_GROUP_REASON",
          title: "场景价值组缺少原因",
          explanation: `${group.entityKey} 已评分但没有填写原因。`,
          entityKey: group.entityKey,
        }),
      );
    }
  });
}

function addSceneScoreSemantics(
  submission: NormalizedSubmission,
  entityKey: string,
  output: R2VConflict[],
) {
  const score = numericScore(
    entityScore(submission, entityKey, "consistency")?.value,
  );
  const dimensions = dimensionMap(entityDimensions(submission, entityKey));
  const coreIds = ["spaceLayout", "anchor", "viewpoint", "state"];
  const core = coreIds.map((id) => dimensions.get(id)?.answer);
  if (score === 5 && core.some((answer) => answer === "NO")) {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "SCENE_5_HAS_CORE_NO",
        title: "5 分但核心场景维度不一致",
        explanation: `${entityKey} 给了 5 分，但空间、锚点、视角或状态存在 NO。`,
        entityKey,
      }),
    );
  }
  if (score === 4 && core.slice(0, 3).some((answer) => answer === "NO")) {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "SCENE_4_HAS_NON_SUBJECT_NO",
        title: "4 分但非主体维度存在明显差异",
        explanation: `${entityKey} 给了 4 分，但空间、锚点或视角存在 NO。`,
        entityKey,
      }),
    );
  }
  if (
    score === 3 &&
    core.every((answer) => answer === "YES")
  ) {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "SCENE_3_ALL_CORE_YES",
        title: "3 分但核心场景维度全部一致",
        explanation: `${entityKey} 的核心场景维度全部为 YES，建议复核总分。`,
        entityKey,
      }),
    );
  }
  if (score === 2 && dimensions.get("spaceLayout")?.answer === "NO") {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "SCENE_2_LAYOUT_NO",
        title: "2 分但空间布局不一致",
        explanation: `${entityKey} 给了 2 分，但空间与布局选择了 NO。`,
        entityKey,
        dimensionId: "spaceLayout",
      }),
    );
  }
  if (
    score !== null &&
    score <= 1 &&
    core.every((answer) => answer === "YES")
  ) {
    output.push(
      conflict(submission, {
        severity: "review",
        code: "SCENE_LOW_SCORE_ALL_CORE_YES",
        title: "低分但核心场景维度全部一致",
        explanation: `${entityKey} 的总分不高于 1，但核心维度全部为 YES。`,
        entityKey,
      }),
    );
  }
}

export function findR2VConflicts(
  submissions: NormalizedSubmission[],
): R2VConflict[] {
  const output: R2VConflict[] = [];
  submissions
    .filter((submission) => submission.completed && !submission.abandoned)
    .forEach((submission) => {
      addParseConflicts(submission, output);
      addGroupConflicts(submission, output);
      if (submission.taskType === "audio") {
        audioConflicts(submission, output);
      } else if (submission.taskType === "object") {
        objectConflicts(submission, output);
      } else {
        sceneConflicts(submission, output);
      }
    });
  return output.sort(
    (left, right) =>
      Number(left.severity === "review") -
        Number(right.severity === "review") ||
      left.questionKey.localeCompare(right.questionKey, "zh-CN") ||
      left.code.localeCompare(right.code),
  );
}
