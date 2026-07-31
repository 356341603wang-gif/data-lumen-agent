import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Grid3X3,
  MessagesSquare,
  Users,
} from "lucide-react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import { answerName, answerTone, formatPercent, MetricHelp } from "./MetricHelp";

function Kpi({
  label,
  value,
  note,
  icon: Icon,
  attention = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  attention?: boolean;
}) {
  return (
    <article className={`r2v-kpi ${attention ? "r2v-kpi--attention" : ""}`}>
      <div className="r2v-kpi__top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function DistributionBar({
  distribution,
}: {
  distribution: Array<{ answer: string; count: number; rate: number }>;
}) {
  return (
    <div className="distribution">
      <div className="distribution__bar" aria-label="答案分布">
        {distribution.map((item) => (
          <span
            className={`distribution__segment distribution__segment--${answerTone(
              item.answer,
            )}`}
            key={item.answer}
            style={{ width: `${item.rate * 100}%` }}
            title={`${answerName(item.answer)} ${item.count} 人，${formatPercent(
              item.rate,
            )}`}
          />
        ))}
      </div>
      <div className="distribution__legend">
        {distribution.map((item) => (
          <span key={item.answer}>
            <i
              className={`distribution__dot distribution__dot--${answerTone(
                item.answer,
              )}`}
            />
            {answerName(item.answer)} {item.count}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalysisOverview({
  analysis,
  onNavigate,
}: {
  analysis: R2VAnalysisResult;
  onNavigate: (tab: string) => void;
}) {
  const severeQuestions = analysis.questionRanking.filter(
    (item) => item.severeDimensionCount > 0,
  ).length;
  const deterministicConflicts = analysis.scoreConflicts.filter(
    (item) => item.severity === "error",
  ).length;
  const highlightedDistributions = analysis.answerDistributions.slice(0, 4);

  return (
    <div className="r2v-view">
      <section className="r2v-kpi-grid">
        <Kpi
          label="有效标注"
          value={analysis.coverage.completedSubmissionCount.toLocaleString()}
          note={`共 ${analysis.coverage.totalRowCount.toLocaleString()} 条分配记录`}
          icon={FileCheck2}
        />
        <Kpi
          label="底层题目"
          value={analysis.coverage.questionCount.toLocaleString()}
          note={`每题最多 ${analysis.coverage.expectedAnnotatorsPerQuestion} 人完成`}
          icon={Grid3X3}
        />
        <Kpi
          label="高分歧题"
          value={severeQuestions.toLocaleString()}
          note="至少一个维度达到严重分歧"
          icon={MessagesSquare}
          attention={severeQuestions > 0}
        />
        <Kpi
          label="确定性数据问题"
          value={deterministicConflicts.toLocaleString()}
          note={`${analysis.scoreConflicts.length - deterministicConflicts} 条需要业务复核`}
          icon={AlertTriangle}
          attention={deterministicConflicts > 0}
        />
      </section>

      <section className="r2v-evidence-grid">
        <article className="r2v-panel r2v-panel--lead">
          <div className="r2v-panel__heading">
            <div>
              <span className="r2v-section-number">01</span>
              <div>
                <h2>先看结论</h2>
                <p>系统根据实际答案自动生成，不把少数意见直接判成错误。</p>
              </div>
            </div>
          </div>
          <div className="headline-list">
            {analysis.headlines.map((headline, index) => (
              <article
                className={`headline headline--${headline.level}`}
                key={`${headline.title}-${index}`}
              >
                <span>
                  {headline.level === "good" ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <div>
                  <strong>{headline.title}</strong>
                  <p>{headline.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="r2v-panel r2v-panel--method">
          <span className="r2v-section-number">口径</span>
          <h2>先看严重分歧，再看原因</h2>
          <p>
            排名优先考虑“多数答案占比不超过 60%”的题目，再结合平均分歧度和混乱度。
          </p>
          <MetricHelp
            title="严重分歧率"
            plain="这个指标用来找没有形成稳定多数意见的题，而不是判断谁做错了。"
            formula="严重分歧率 = 多数答案占比 ≤ 60% 的单元数 ÷ 有效单元数"
            example="10 人中 6 人选 YES、4 人选 NO，多数占比为 60%，属于严重分歧。"
          />
        </aside>
      </section>

      <section className="r2v-panel">
        <div className="r2v-panel__heading">
          <div>
            <span className="r2v-section-number">02</span>
            <div>
              <h2>答案分布</h2>
              <p>这里先展示最混乱的几个题目维度，完整结果可在热力图中展开。</p>
            </div>
          </div>
          <button
            className="r2v-text-button"
            onClick={() => onNavigate("heatmap")}
            type="button"
          >
            查看全部
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="distribution-cards">
          {highlightedDistributions.map((cell) => (
            <article className="distribution-card" key={cell.cellKey}>
              <div>
                <span>
                  {cell.questionKey} · {cell.entityKey}
                </span>
                <strong>{cell.dimensionLabel}</strong>
              </div>
              <DistributionBar distribution={cell.distribution} />
              <footer>
                <span>{cell.sampleSize} 人有效</span>
                <b className={cell.severe ? "is-severe" : ""}>
                  分歧度 {formatPercent(cell.disagreementDegree)}
                </b>
              </footer>
            </article>
          ))}
          {!highlightedDistributions.length ? (
            <div className="r2v-empty">当前没有检测到多人答案分歧。</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

