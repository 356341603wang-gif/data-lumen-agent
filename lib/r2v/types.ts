import type { DataRow } from "../analysis";

export type TaskType = "audio" | "scene" | "object" | "unknown";
export type KnownTaskType = Exclude<TaskType, "unknown">;
export type EntityKind = "target" | "ref" | "multiview" | "scene-group";

export type CanonicalAnswer =
  | "YES"
  | "NO"
  | "HIGH_SIMILARITY"
  | "LOW_SIMILARITY"
  | "UNKNOWN"
  | "NA";

export type ScoreValue =
  | number
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "SKIP";

export interface DimensionRule {
  id: string;
  label: string;
  allowed: CanonicalAnswer[];
  reasonRequired: boolean;
  fieldKeys: string[];
  reasonKeys: string[];
}

export interface R2VProfile {
  type: KnownTaskType;
  label: string;
  consistencyScores: ScoreValue[];
  dimensions: DimensionRule[];
  valueDimensions: DimensionRule[];
  jsonKeys: string[];
  columnHints: string[];
  consistencyScoreKeys: string[];
  valueScoreKeys: string[];
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
  reason?: string;
}

export interface EntityGroup {
  entityKey: string;
  entityKind: "multiview" | "scene-group";
  groupIndex: number;
  refIndexes: number[];
}

export interface NormalizedSubmission {
  taskType: KnownTaskType;
  questionKey: string;
  assignmentKey?: string;
  annotator?: string;
  completed: boolean;
  abandoned: boolean;
  refSlots: number[];
  dimensions: DimensionObservation[];
  scores: ScoreObservation[];
  groups: EntityGroup[];
  remark?: string;
  rawRowIndex: number;
  raw: DataRow;
  parseWarnings: string[];
}

export interface AnswerDistributionItem {
  answer: string;
  count: number;
  rate: number;
}

export interface DistributionMetrics {
  sampleSize: number;
  distribution: AnswerDistributionItem[];
  majorityAnswer: string;
  majorityTied: boolean;
  consistencyRate: number;
  disagreementDegree: number;
  hasDisagreement: boolean;
  severe: boolean;
  entropy: number;
}

export interface CellStats extends DistributionMetrics {
  taskType: KnownTaskType;
  cellKey: string;
  questionKey: string;
  entityKey: string;
  entityKind: EntityKind;
  refIndex?: number;
  groupIndex?: number;
  dimensionId: string;
  dimensionLabel: string;
  answers: Array<{
    annotator?: string;
    answer: CanonicalAnswer;
    reason?: string;
    rawRowIndex: number;
  }>;
}

export interface ScoreCellStats extends DistributionMetrics {
  taskType: KnownTaskType;
  questionKey: string;
  entityKey: string;
  entityKind: EntityKind;
  refIndex?: number;
  groupIndex?: number;
  scoreType: "consistency" | "value";
  majorityScore: ScoreValue;
  minimumNumericScore?: number;
  maximumNumericScore?: number;
  scoreSpread?: number;
}

export interface DimensionStats {
  taskType: KnownTaskType;
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
  answerDistribution: AnswerDistributionItem[];
}

export interface QuestionStats {
  taskType: KnownTaskType;
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
    dimensionLabel: string;
    comparableCount: number;
    deviationRate: number;
  }>;
}
