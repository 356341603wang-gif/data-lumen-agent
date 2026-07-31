import { getDimensionRule, getProfile } from "./profiles.ts";
import type {
  AnnotatorStats,
  AnswerDistributionItem,
  CellStats,
  DimensionStats,
  DistributionMetrics,
  KnownTaskType,
  NormalizedSubmission,
  QuestionStats,
  ScoreCellStats,
  ScoreValue,
} from "./types";

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function stableMetric(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function taskAnswerOrder(
  taskType: KnownTaskType,
  dimensionId: string,
): string[] {
  return (
    getDimensionRule(taskType, dimensionId)?.allowed ?? [
      "YES",
      "HIGH_SIMILARITY",
      "LOW_SIMILARITY",
      "NO",
      "UNKNOWN",
      "NA",
    ]
  );
}

function scoreOrder(taskType: KnownTaskType): string[] {
  return getProfile(taskType).consistencyScores.map(String);
}

export function calculateDistributionMetrics(
  answers: string[],
  severeThreshold = 0.6,
  order: string[] = [],
): DistributionMetrics {
  const counts = new Map<string, number>();
  answers
    .filter((answer) => answer !== "")
    .forEach((answer) => counts.set(answer, (counts.get(answer) ?? 0) + 1));
  const sampleSize = [...counts.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const orderIndex = new Map(order.map((answer, index) => [answer, index]));
  const distribution: AnswerDistributionItem[] = [...counts.entries()]
    .map(([answer, count]) => ({
      answer,
      count,
      rate: sampleSize ? count / sampleSize : 0,
    }))
    .sort(
      (left, right) =>
        (orderIndex.get(left.answer) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(right.answer) ?? Number.MAX_SAFE_INTEGER) ||
        right.count - left.count ||
        left.answer.localeCompare(right.answer, "zh-CN"),
    );
  const maximum = Math.max(0, ...distribution.map((item) => item.count));
  const majorityItems = distribution.filter((item) => item.count === maximum);
  const majorityAnswer = majorityItems[0]?.answer ?? "";
  const consistencyRate = stableMetric(sampleSize ? maximum / sampleSize : 0);
  const disagreementDegree = stableMetric(
    sampleSize ? 1 - consistencyRate : 0,
  );
  const hasDisagreement = sampleSize >= 2 && distribution.length > 1;
  const severe =
    sampleSize >= 2 &&
    distribution.length > 1 &&
    consistencyRate <= severeThreshold;
  const entropy = stableMetric(
    distribution.length <= 1
      ? 0
      : -distribution.reduce((sum, item) => {
          const probability = item.rate;
          return sum + probability * Math.log(probability);
        }, 0) / Math.log(distribution.length),
  );

  return {
    sampleSize,
    distribution,
    majorityAnswer,
    majorityTied: majorityItems.length > 1,
    consistencyRate,
    disagreementDegree,
    hasDisagreement,
    severe,
    entropy,
  };
}

interface CellAccumulator {
  taskType: KnownTaskType;
  questionKey: string;
  entityKey: string;
  entityKind: CellStats["entityKind"];
  refIndex?: number;
  groupIndex?: number;
  dimensionId: string;
  answers: CellStats["answers"];
}

export function calculateCellStats(
  submissions: NormalizedSubmission[],
): CellStats[] {
  const cells = new Map<string, CellAccumulator>();
  submissions
    .filter((submission) => submission.completed && !submission.abandoned)
    .forEach((submission) => {
      submission.dimensions.forEach((dimension) => {
        const cellKey = [
          submission.taskType,
          submission.questionKey,
          dimension.entityKind,
          dimension.entityKey,
          dimension.dimensionId,
        ].join("::");
        const existing = cells.get(cellKey) ?? {
          taskType: submission.taskType,
          questionKey: submission.questionKey,
          entityKey: dimension.entityKey,
          entityKind: dimension.entityKind,
          refIndex: dimension.refIndex,
          groupIndex: dimension.groupIndex,
          dimensionId: dimension.dimensionId,
          answers: [],
        };
        existing.answers.push({
          annotator: submission.annotator,
          answer: dimension.answer,
          reason: dimension.reason,
          rawRowIndex: submission.rawRowIndex,
        });
        cells.set(cellKey, existing);
      });
    });

  return [...cells.entries()]
    .map(([cellKey, cell]) => {
      const metrics = calculateDistributionMetrics(
        cell.answers.map((item) => item.answer),
        0.6,
        taskAnswerOrder(cell.taskType, cell.dimensionId),
      );
      return {
        ...cell,
        ...metrics,
        cellKey,
        dimensionLabel:
          getDimensionRule(cell.taskType, cell.dimensionId)?.label ??
          cell.dimensionId,
      };
    })
    .sort(
      (left, right) =>
        left.questionKey.localeCompare(right.questionKey, "zh-CN") ||
        left.entityKey.localeCompare(right.entityKey, "zh-CN") ||
        left.dimensionLabel.localeCompare(right.dimensionLabel, "zh-CN"),
    );
}

export function calculateDimensionStats(
  cells: CellStats[],
): DimensionStats[] {
  const groups = new Map<string, CellStats[]>();
  cells.forEach((cell) => {
    const key = `${cell.taskType}::${cell.dimensionId}`;
    groups.set(key, [...(groups.get(key) ?? []), cell]);
  });

  return [...groups.values()]
    .map((allCells) => {
      const validCells = allCells.filter((cell) => cell.sampleSize >= 2);
      const first = allCells[0];
      const answers = validCells.flatMap((cell) =>
        cell.answers.map((item) => item.answer),
      );
      const answerDistribution = calculateDistributionMetrics(
        answers,
        0.6,
        taskAnswerOrder(first.taskType, first.dimensionId),
      ).distribution;
      const disputedCellCount = validCells.filter(
        (cell) => cell.hasDisagreement,
      ).length;
      const severeCellCount = validCells.filter((cell) => cell.severe).length;
      return {
        taskType: first.taskType,
        dimensionId: first.dimensionId,
        dimensionLabel: first.dimensionLabel,
        validCellCount: validCells.length,
        disputedCellCount,
        severeCellCount,
        disagreementOccurrenceRate: validCells.length
          ? disputedCellCount / validCells.length
          : 0,
        severeDisagreementRate: validCells.length
          ? severeCellCount / validCells.length
          : 0,
        meanDisagreementDegree: mean(
          validCells.map((cell) => cell.disagreementDegree),
        ),
        meanConsistencyRate: mean(
          validCells.map((cell) => cell.consistencyRate),
        ),
        meanEntropy: mean(validCells.map((cell) => cell.entropy)),
        answerDistribution,
      };
    })
    .sort(
      (left, right) =>
        right.severeDisagreementRate - left.severeDisagreementRate ||
        right.meanDisagreementDegree - left.meanDisagreementDegree ||
        right.disagreementOccurrenceRate - left.disagreementOccurrenceRate ||
        left.dimensionLabel.localeCompare(right.dimensionLabel, "zh-CN"),
    );
}

interface ScoreAccumulator {
  taskType: KnownTaskType;
  questionKey: string;
  entityKey: string;
  entityKind: ScoreCellStats["entityKind"];
  refIndex?: number;
  groupIndex?: number;
  scoreType: "consistency" | "value";
  values: ScoreValue[];
}

export function calculateScoreStats(
  submissions: NormalizedSubmission[],
): ScoreCellStats[] {
  const groups = new Map<string, ScoreAccumulator>();
  submissions
    .filter((submission) => submission.completed && !submission.abandoned)
    .forEach((submission) => {
      submission.scores.forEach((score) => {
        const key = [
          submission.taskType,
          submission.questionKey,
          score.entityKind,
          score.entityKey,
          score.scoreType,
        ].join("::");
        const existing = groups.get(key) ?? {
          taskType: submission.taskType,
          questionKey: submission.questionKey,
          entityKey: score.entityKey,
          entityKind: score.entityKind,
          refIndex: score.refIndex,
          groupIndex: score.groupIndex,
          scoreType: score.scoreType,
          values: [],
        };
        existing.values.push(score.value);
        groups.set(key, existing);
      });
    });

  return [...groups.values()].map((group) => {
    const stringValues = group.values.map(String);
    const order =
      group.scoreType === "consistency"
        ? scoreOrder(group.taskType)
        : ["LOW", "MEDIUM", "HIGH", "0", "1", "2", "SKIP"];
    const metrics = calculateDistributionMetrics(stringValues, 0.6, order);
    const majorityScore =
      group.values.find((value) => String(value) === metrics.majorityAnswer) ??
      group.values[0];
    const numeric = group.values.filter(
      (value): value is number => typeof value === "number",
    );
    const minimumNumericScore = numeric.length ? Math.min(...numeric) : undefined;
    const maximumNumericScore = numeric.length ? Math.max(...numeric) : undefined;
    return {
      taskType: group.taskType,
      questionKey: group.questionKey,
      entityKey: group.entityKey,
      entityKind: group.entityKind,
      refIndex: group.refIndex,
      groupIndex: group.groupIndex,
      scoreType: group.scoreType,
      majorityScore,
      minimumNumericScore,
      maximumNumericScore,
      scoreSpread:
        minimumNumericScore === undefined || maximumNumericScore === undefined
          ? undefined
          : maximumNumericScore - minimumNumericScore,
      ...metrics,
    };
  });
}

export function calculateQuestionStats(
  cells: CellStats[],
  scores: ScoreCellStats[],
): QuestionStats[] {
  const questionKeys = new Set([
    ...cells.map((cell) => `${cell.taskType}::${cell.questionKey}`),
    ...scores.map((score) => `${score.taskType}::${score.questionKey}`),
  ]);

  return [...questionKeys]
    .map((key) => {
      const [taskType, ...questionParts] = key.split("::");
      const questionKey = questionParts.join("::");
      const questionCells = cells.filter(
        (cell) =>
          cell.taskType === taskType && cell.questionKey === questionKey,
      );
      const validCells = questionCells.filter((cell) => cell.sampleSize >= 2);
      const questionScores = scores.filter(
        (score) =>
          score.taskType === taskType && score.questionKey === questionKey,
      );
      const annotators = new Set(
        questionCells.flatMap((cell) =>
          cell.answers
            .map((answer) => answer.annotator)
            .filter((answer): answer is string => Boolean(answer)),
        ),
      );
      return {
        taskType: taskType as KnownTaskType,
        questionKey,
        validAnnotatorCount: annotators.size,
        totalDimensionCount: validCells.length,
        disputedDimensionCount: validCells.filter(
          (cell) => cell.hasDisagreement,
        ).length,
        severeDimensionCount: validCells.filter((cell) => cell.severe).length,
        meanDisagreementDegree: mean(
          validCells.map((cell) => cell.disagreementDegree),
        ),
        maxEntropy: Math.max(0, ...validCells.map((cell) => cell.entropy)),
        scoreSpread: Math.max(
          0,
          ...questionScores.map((score) => score.scoreSpread ?? 0),
        ),
        conflictCount: 0,
      };
    })
    .sort(
      (left, right) =>
        right.severeDimensionCount - left.severeDimensionCount ||
        right.meanDisagreementDegree - left.meanDisagreementDegree ||
        right.maxEntropy - left.maxEntropy ||
        right.scoreSpread - left.scoreSpread ||
        left.questionKey.localeCompare(right.questionKey, "zh-CN"),
    );
}

interface AnnotatorAccumulator {
  completedCount: number;
  totalAnswers: number;
  unknownAnswers: number;
  comparable: number;
  aligned: number;
  dimensions: Map<
    string,
    { label: string; comparable: number; deviations: number }
  >;
}

export function calculateAnnotatorStats(
  submissions: NormalizedSubmission[],
  cells: CellStats[],
): AnnotatorStats[] {
  const accumulators = new Map<string, AnnotatorAccumulator>();
  const getAccumulator = (annotator: string) => {
    const existing = accumulators.get(annotator) ?? {
      completedCount: 0,
      totalAnswers: 0,
      unknownAnswers: 0,
      comparable: 0,
      aligned: 0,
      dimensions: new Map(),
    };
    accumulators.set(annotator, existing);
    return existing;
  };

  submissions
    .filter(
      (submission) =>
        submission.completed && !submission.abandoned && submission.annotator,
    )
    .forEach((submission) => {
      const accumulator = getAccumulator(submission.annotator!);
      accumulator.completedCount += 1;
      submission.dimensions.forEach((dimension) => {
        accumulator.totalAnswers += 1;
        if (dimension.answer === "UNKNOWN") accumulator.unknownAnswers += 1;
      });
    });

  cells
    .filter(
      (cell) =>
        cell.sampleSize >= 2 && !cell.majorityTied && cell.majorityAnswer,
    )
    .forEach((cell) => {
      cell.answers.forEach((answer) => {
        if (!answer.annotator) return;
        const accumulator = getAccumulator(answer.annotator);
        accumulator.comparable += 1;
        const aligned = answer.answer === cell.majorityAnswer;
        if (aligned) accumulator.aligned += 1;
        const dimension = accumulator.dimensions.get(cell.dimensionId) ?? {
          label: cell.dimensionLabel,
          comparable: 0,
          deviations: 0,
        };
        dimension.comparable += 1;
        if (!aligned) dimension.deviations += 1;
        accumulator.dimensions.set(cell.dimensionId, dimension);
      });
    });

  return [...accumulators.entries()]
    .map(([annotator, accumulator]) => ({
      annotator,
      completedCount: accumulator.completedCount,
      comparableCellCount: accumulator.comparable,
      majorityAlignmentRate: accumulator.comparable
        ? accumulator.aligned / accumulator.comparable
        : 0,
      unknownAnswerRate: accumulator.totalAnswers
        ? accumulator.unknownAnswers / accumulator.totalAnswers
        : 0,
      deviationsByDimension: [...accumulator.dimensions.entries()]
        .map(([dimensionId, dimension]) => ({
          dimensionId,
          dimensionLabel: dimension.label,
          comparableCount: dimension.comparable,
          deviationRate: dimension.comparable
            ? dimension.deviations / dimension.comparable
            : 0,
        }))
        .sort(
          (left, right) =>
            right.deviationRate - left.deviationRate ||
            right.comparableCount - left.comparableCount,
        ),
    }))
    .sort(
      (left, right) =>
        left.majorityAlignmentRate - right.majorityAlignmentRate ||
        right.completedCount - left.completedCount ||
        left.annotator.localeCompare(right.annotator, "zh-CN"),
    );
}
