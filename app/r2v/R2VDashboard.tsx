"use client";

import {
  AlertTriangle,
  BarChart3,
  Check,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  Grid3X3,
  ListChecks,
  MessageSquareText,
  RefreshCcw,
  Rows3,
  Settings2,
  TableProperties,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import type { KnownTaskType } from "../../lib/r2v/types.ts";
import { AnalysisOverview } from "./AnalysisOverview";
import {
  AnnotatorView,
  CoverageView,
} from "./AnnotatorAndCoverageViews";
import {
  DimensionRanking,
  type DimensionQuestionFilter,
} from "./DimensionRanking";
import { DisagreementHeatmap } from "./DisagreementHeatmap";
import { QuestionRanking } from "./QuestionRanking";
import {
  ConflictView,
  ReasonView,
} from "./ReasonAndConflictViews";

export type R2VTab =
  | "overview"
  | "dimensions"
  | "questions"
  | "heatmap"
  | "reasons"
  | "conflicts"
  | "annotators"
  | "coverage";

const tabs: Array<{
  id: R2VTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "overview", label: "分析总览", icon: BarChart3 },
  { id: "dimensions", label: "维度分歧榜", icon: Rows3 },
  { id: "questions", label: "单题分歧榜", icon: ListChecks },
  { id: "heatmap", label: "题目 × 维度", icon: Grid3X3 },
  { id: "reasons", label: "原因汇总", icon: MessageSquareText },
  { id: "conflicts", label: "规则冲突", icon: AlertTriangle },
  { id: "annotators", label: "标注员偏差", icon: Users },
  { id: "coverage", label: "完成覆盖", icon: TableProperties },
];

export function R2VDashboard({
  analysis,
  taskOverride,
  onTaskOverride,
  onReset,
  onDownload,
  sheetOptions = [],
  selectedSheet = 0,
  onSheetChange,
}: {
  analysis: R2VAnalysisResult;
  taskOverride: "auto" | KnownTaskType;
  onTaskOverride: (taskType: "auto" | KnownTaskType) => void;
  onReset: () => void;
  onDownload: (
    kind:
      | "report"
      | "dimensions"
      | "questions"
      | "reasons"
      | "conflicts"
      | "annotators",
  ) => void;
  sheetOptions?: string[];
  selectedSheet?: number;
  onSheetChange?: (index: number) => void;
}) {
  const [tab, setTab] = useState<R2VTab>("overview");
  const [copied, setCopied] = useState(false);
  const [dimensionFilter, setDimensionFilter] =
    useState<DimensionQuestionFilter | null>(null);
  const summary = useMemo(
    () =>
      analysis.headlines
        .map((headline) => `${headline.title}：${headline.detail}`)
        .join("\n"),
    [analysis.headlines],
  );

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="r2v-shell">
      <header className="r2v-topbar r2v-commandbar">
        <div className="r2v-brand">
          <span className="r2v-brand__mark">
            <FileSpreadsheet size={18} />
          </span>
          <div>
            <strong>R2V 数据分析系统</strong>
            <small>
              Data Atelier · {analysis.fileName}
            </small>
          </div>
        </div>
        <div className="r2v-topbar__actions">
          {sheetOptions.length > 1 ? (
            <label className="task-switcher">
              <span>工作表</span>
              <select
                onChange={(event) =>
                  onSheetChange?.(Number(event.target.value))
                }
                value={selectedSheet}
              >
                {sheetOptions.map((sheet, index) => (
                  <option key={sheet} value={index}>
                    {sheet}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="task-switcher">
            <Settings2 size={14} />
            <span>任务</span>
            <select
              onChange={(event) =>
                onTaskOverride(
                  event.target.value as "auto" | KnownTaskType,
                )
              }
              value={taskOverride}
            >
              <option value="auto">自动识别 · {analysis.taskLabel}</option>
              <option value="object">物品</option>
              <option value="scene">场景</option>
              <option value="audio">音频</option>
            </select>
          </label>
          <button onClick={copySummary} type="button">
            {copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
            {copied ? "已复制" : "复制结论"}
          </button>
          <details className="export-menu">
            <summary>
              <Download size={15} />
              导出
            </summary>
            <div>
              <button onClick={() => onDownload("report")} type="button">
                完整报告 · Markdown
              </button>
              <button onClick={() => onDownload("dimensions")} type="button">
                维度分歧榜 · CSV
              </button>
              <button onClick={() => onDownload("questions")} type="button">
                单题分歧榜 · CSV
              </button>
              <button onClick={() => onDownload("reasons")} type="button">
                原因汇总 · CSV
              </button>
              <button onClick={() => onDownload("conflicts")} type="button">
                规则冲突 · CSV
              </button>
              <button onClick={() => onDownload("annotators")} type="button">
                标注员偏差 · CSV
              </button>
            </div>
          </details>
          <button onClick={onReset} type="button">
            <RefreshCcw size={15} />
            换一个文件
          </button>
        </div>
      </header>

      <div className="r2v-layout">
        <nav className="r2v-nav r2v-rail" aria-label="分析方式">
          {tabs.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                className={tab === item.id ? "is-active" : ""}
                key={item.id}
                onClick={() => {
                  if (item.id === "questions") setDimensionFilter(null);
                  setTab(item.id);
                }}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
          <details className="data-basis">
            <summary>数据口径</summary>
            <dl>
              <div>
                <dt>任务类型</dt>
                <dd>{analysis.taskLabel}</dd>
              </div>
              <div>
                <dt>题目聚合</dt>
                <dd>{analysis.schema.questionField ?? "素材组合"}</dd>
              </div>
              <div>
                <dt>标注员</dt>
                <dd>{analysis.schema.annotatorField ?? "未识别"}</dd>
              </div>
              <div>
                <dt>答案来源</dt>
                <dd>{analysis.schema.answerField ?? "展平字段"}</dd>
              </div>
            </dl>
            {analysis.schema.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </details>
        </nav>

        <section className="r2v-content">
          {tab === "overview" ? (
            <AnalysisOverview
              analysis={analysis}
              onNavigate={(next) => setTab(next as R2VTab)}
            />
          ) : null}
          {tab === "dimensions" ? (
            <DimensionRanking
              analysis={analysis}
              onViewQuestions={(filter) => {
                setDimensionFilter(filter);
                setTab("questions");
              }}
            />
          ) : null}
          {tab === "questions" ? (
            <QuestionRanking
              analysis={analysis}
              dimensionFilter={dimensionFilter}
              onClearDimensionFilter={() => setDimensionFilter(null)}
            />
          ) : null}
          {tab === "heatmap" ? (
            <DisagreementHeatmap analysis={analysis} />
          ) : null}
          {tab === "reasons" ? <ReasonView analysis={analysis} /> : null}
          {tab === "conflicts" ? <ConflictView analysis={analysis} /> : null}
          {tab === "annotators" ? (
            <AnnotatorView analysis={analysis} />
          ) : null}
          {tab === "coverage" ? <CoverageView analysis={analysis} /> : null}
        </section>
      </div>
    </main>
  );
}
