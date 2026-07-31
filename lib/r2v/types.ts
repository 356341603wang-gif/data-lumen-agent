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
  remark?: string;
  rawRowIndex: number;
  raw: DataRow;
  parseWarnings: string[];
}
