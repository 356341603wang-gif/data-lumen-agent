import { CircleHelp } from "lucide-react";

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
      <summary>
        <CircleHelp size={14} />
        怎么理解
      </summary>
      <div className="metric-help__body">
        <strong>{title}</strong>
        <p>{plain}</p>
        <code>{formula}</code>
        <small>{example}</small>
      </div>
    </details>
  );
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export const answerNames: Record<string, string> = {
  YES: "YES",
  NO: "NO",
  HIGH_SIMILARITY: "高度相似",
  LOW_SIMILARITY: "低相似",
  UNKNOWN: "无法判断",
  NA: "N/A",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
  SKIP: "不打分",
};

export function answerName(answer: string) {
  return answerNames[answer] ?? answer;
}

export function answerTone(answer: string) {
  if (answer === "YES" || answer === "HIGH" || answer === "5") return "yes";
  if (answer === "NO" || answer === "LOW" || answer === "0") return "no";
  if (answer === "LOW_SIMILARITY" || answer === "1") return "low";
  if (answer === "HIGH_SIMILARITY" || answer === "3") return "high";
  return "neutral";
}

