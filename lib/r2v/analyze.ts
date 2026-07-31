import type { DataRow } from "../analysis";
import { findR2VConflicts, type R2VConflict } from "./conflicts.ts";
import type { DetectedR2VSchema } from "./detect.ts";
import {
  calculateAnnotatorStats,
  calculateCellStats,
  calculateDimensionStats,
  calculateQuestionStats,
  calculateScoreStats,
} from "./metrics.ts";
import { normalizeR2VRows } from "./normalize.ts";
import { getProfile, isKnownTaskType } from "./profiles.ts";
import {
  summarizeReasons,
  type ReasonSummary,
} from "./reasons.ts";
import type {
  AnnotatorStats,
  CellStats,
  CoverageStats,
  DimensionStats,
  KnownTaskType,
  NormalizedSubmission,
  QuestionStats,
  ScoreCellStats,
} from "./types";

export interface AnalysisHeadline {
  level: "attention" | "info" | "good";
  title: string;
  detail: string;
}

export interface R2VAnalysisResult {
  fileName: string;
  taskType: KnownTaskType;
  taskLabel: string;
  requiresFieldConfirmation: false;
  schema: DetectedR2VSchema;
  coverage: CoverageStats;
  dimensionRanking: DimensionStats[];
  questionRanking: QuestionStats[];
  heatmap: {
    questions: string[];
    dimensions: string[];
    cells: CellStats[];
  };
  answerDistributions: CellStats[];
  scoreStats: ScoreCellStats[];
  reasonSummaries: ReasonSummary[];
  scoreConflicts: R2VConflict[];
  annotatorStats: AnnotatorStats[];
  headlines: AnalysisHeadline[];
  submissions: NormalizedSubmission[];
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function coverageStats(
  submissions: NormalizedSubmission[],
): CoverageStats {
  const completed = submissions.filter(
    (submission) => submission.completed && !submission.abandoned,
  );
  const abandonedCount = submissions.filter(
    (submission) => submission.abandoned,
  ).length;
  const questionKeys = new Set(
    submissions.map((submission) => submission.questionKey),
  );
  const counts = new Map<string, number>();
  completed.forEach((submission) => {
    counts.set(
      submission.questionKey,
      (counts.get(submission.questionKey) ?? 0) + 1,
    );
  });
  const validLabelsByQuestion = [...questionKeys]
    .map((questionKey) => ({
      questionKey,
      count: counts.get(questionKey) ?? 0,
    }))
    .sort(
      (left, right) =>
        left.count - right.count ||
        left.questionKey.localeCompare(right.questionKey, "zh-CN"),
    );
  const expectedAnnotatorsPerQuestion = Math.max(
    0,
    ...validLabelsByQuestion.map((item) => item.count),
  );

  return {
    totalRowCount: submissions.length,
    completedSubmissionCount: completed.length,
    unfinishedSubmissionCount:
      submissions.length - completed.length - abandonedCount,
    abandonedCount,
    questionCount: questionKeys.size,
    completedQuestionCount: validLabelsByQuestion.filter(
      (item) => item.count >= 2,
    ).length,
    expectedAnnotatorsPerQuestion,
    validLabelsByQuestion,
    insufficientQuestionCount: validLabelsByQuestion.filter(
      (item) =>
        expectedAnnotatorsPerQuestion > 0 &&
        item.count < expectedAnnotatorsPerQuestion,
    ).length,
    parseFailureCount: submissions.filter((submission) =>
      submission.parseWarnings.some((warning) => warning.includes("解析失败")),
    ).length,
  };
}

function createHeadlines(
  dimensions: DimensionStats[],
  questions: QuestionStats[],
  coverage: CoverageStats,
  conflicts: R2VConflict[],
): AnalysisHeadline[] {
  const output: AnalysisHeadline[] = [];
  const topDimension = dimensions[0];
  if (topDimension) {
    output.push({
      level:
        topDimension.severeDisagreementRate > 0.3 ? "attention" : "info",
      title: `${topDimension.dimensionLabel}最值得关注`,
      detail: `${percent(
        topDimension.disagreementOccurrenceRate,
      )} 的有效题目发生过分歧，其中 ${percent(
        topDimension.severeDisagreementRate,
      )} 属于严重分歧。`,
    });
  }
  const topQuestion = questions[0];
  if (topQuestion) {
    output.push({
      level:
        topQuestion.severeDimensionCount > 0 ? "attention" : "info",
      title: `题目 ${topQuestion.questionKey} 最需要对齐`,
      detail: `${topQuestion.totalDimensionCount} 个有效维度单元中，${topQuestion.disputedDimensionCount} 个发生分歧，${topQuestion.severeDimensionCount} 个达到严重分歧。`,
    });
  }
  if (coverage.insufficientQuestionCount > 0) {
    output.push({
      level: "info",
      title: "部分题目标注人数不足",
      detail: `${coverage.questionCount} 道题中有 ${coverage.insufficientQuestionCount} 道少于当前最高的 ${coverage.expectedAnnotatorsPerQuestion} 人完成；这些完成度问题没有计入分歧率。`,
    });
  } else {
    output.push({
      level: "good",
      title: "每道题的完成人数一致",
      detail: `当前 ${coverage.questionCount} 道题均有 ${coverage.expectedAnnotatorsPerQuestion} 条有效标注。`,
    });
  }
  const deterministic = conflicts.filter(
    (item) => item.severity === "error",
  ).length;
  const review = conflicts.length - deterministic;
  output.push({
    level: deterministic > 0 ? "attention" : "info",
    title: "规则检查已完成",
    detail: `发现 ${deterministic} 条确定性提交问题和 ${review} 条需要业务复核的总分—维度组合。`,
  });
  return output;
}

function sortQuestions(
  questions: QuestionStats[],
  conflicts: R2VConflict[],
): QuestionStats[] {
  const conflictCounts = new Map<string, number>();
  conflicts.forEach((item) => {
    conflictCounts.set(
      item.questionKey,
      (conflictCounts.get(item.questionKey) ?? 0) + 1,
    );
  });
  return questions
    .map((question) => ({
      ...question,
      conflictCount: conflictCounts.get(question.questionKey) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.severeDimensionCount - left.severeDimensionCount ||
        right.meanDisagreementDegree - left.meanDisagreementDegree ||
        right.maxEntropy - left.maxEntropy ||
        right.conflictCount - left.conflictCount ||
        right.scoreSpread - left.scoreSpread ||
        left.questionKey.localeCompare(right.questionKey, "zh-CN"),
    );
}

export function analyzeR2VRows(
  rows: DataRow[],
  fileName: string,
  forcedTaskType?: KnownTaskType,
): R2VAnalysisResult {
  const normalized = normalizeR2VRows(rows, forcedTaskType);
  if (!isKnownTaskType(normalized.schema.taskType)) {
    throw new Error("未识别到物品、场景或音频标注结构");
  }
  const taskType = normalized.schema.taskType;
  const cells = calculateCellStats(normalized.submissions);
  const scoreStats = calculateScoreStats(normalized.submissions);
  const conflicts = findR2VConflicts(normalized.submissions);
  const dimensions = calculateDimensionStats(cells);
  const questions = sortQuestions(
    calculateQuestionStats(cells, scoreStats),
    conflicts,
  );
  const coverage = coverageStats(normalized.submissions);
  const questionOrder = questions.map((question) => question.questionKey);
  const dimensionOrder = dimensions.map(
    (dimension) => dimension.dimensionId,
  );
  const answerDistributions = cells
    .filter((cell) => cell.hasDisagreement)
    .sort(
      (left, right) =>
        Number(right.severe) - Number(left.severe) ||
        right.entropy - left.entropy ||
        right.disagreementDegree - left.disagreementDegree,
    );

  return {
    fileName,
    taskType,
    taskLabel: getProfile(taskType).label,
    requiresFieldConfirmation: false,
    schema: normalized.schema,
    coverage,
    dimensionRanking: dimensions,
    questionRanking: questions,
    heatmap: {
      questions: questionOrder,
      dimensions: dimensionOrder,
      cells,
    },
    answerDistributions,
    scoreStats,
    reasonSummaries: summarizeReasons(normalized.submissions),
    scoreConflicts: conflicts,
    annotatorStats: calculateAnnotatorStats(normalized.submissions, cells),
    headlines: createHeadlines(dimensions, questions, coverage, conflicts),
    submissions: normalized.submissions,
  };
}

