import { ArrowUpRight } from "lucide-react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import {
  dimensionAction,
  dimensionDiagnosis,
  dimensionQuestionKeys,
} from "../../lib/r2v/dimension-presentation.ts";
import { DistributionBar } from "./AnalysisOverview";
import { formatPercent } from "./MetricHelp";

export interface DimensionQuestionFilter {
  dimensionId: string;
  dimensionLabel: string;
  questionKeys: string[];
}

export function DimensionRanking({
  analysis,
  onViewQuestions,
}: {
  analysis: R2VAnalysisResult;
  onViewQuestions: (filter: DimensionQuestionFilter) => void;
}) {
  const ranking = analysis.dimensionRanking;
  const priorityDimensions = ranking.filter(
    (item) => item.severeDisagreementRate >= 0.5,
  );
  const topDimension = ranking[0];

  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">维度视角</span>
          <h1>维度分歧榜</h1>
          <p>先看需要行动的维度，再展开详细指标。</p>
        </div>
      </div>

      <section className="dimension-summary evidence-track">
        <div className="dimension-summary__main">
          <span className="r2v-section-number">本批结论</span>
          <h2>
            {priorityDimensions.length
              ? `建议优先讨论 ${priorityDimensions.length} 个维度`
              : "当前没有必须优先对齐的维度"}
          </h2>
          <p>
            {topDimension
              ? `先从「${topDimension.dimensionLabel}」开始。下面直接显示严重分歧题目单元数，不需要先理解四个统计指标。`
              : "当前没有足够的多人答案用于生成维度分歧结论。"}
          </p>
        </div>
        <div className="dimension-summary__rule">
          <span>严重分歧怎么判</span>
          <strong>最高选项占比 ≤ 60%</strong>
          <p>例如 10 人中 6 人选 YES、4 人选 NO，就属于严重分歧。</p>
        </div>
      </section>

      <div className="dimension-ranking">
        {ranking.map((item, index) => {
          const action = dimensionAction(item);
          const questionKeys = dimensionQuestionKeys(
            analysis.answerDistributions,
            item.dimensionId,
          );
          const answerCount = item.answerDistribution.reduce(
            (sum, answer) => sum + answer.count,
            0,
          );

          return (
            <article
              className={`dimension-row dimension-row--${action.level}`}
              key={item.dimensionId}
            >
              <div className="dimension-row__identity">
                <span className="dimension-row__rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={`dimension-action dimension-action--${action.level}`}
                >
                  {action.label}
                </span>
                <strong>{item.dimensionLabel}</strong>
                <p>{dimensionDiagnosis(item)}</p>
              </div>

              <div className="dimension-row__severity">
                <div>
                  <span>严重分歧题目单元</span>
                  <strong>
                    {item.severeCellCount}
                    <small> / {item.validCellCount}</small>
                  </strong>
                </div>
                <div
                  aria-label={`${item.dimensionLabel}严重分歧题目单元占比 ${formatPercent(
                    item.severeDisagreementRate,
                  )}`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(
                    item.severeDisagreementRate * 100,
                  )}
                  className="dimension-severity-track"
                  role="progressbar"
                >
                  <span
                    style={{
                      width: `${item.severeDisagreementRate * 100}%`,
                    }}
                  />
                </div>
                <p>
                  占全部有效题目单元的{" "}
                  <b>{formatPercent(item.severeDisagreementRate)}</b>
                </p>
              </div>

              <div className="dimension-row__distribution">
                <div>
                  <strong>全部标注答案构成</strong>
                  <span>共 {answerCount.toLocaleString()} 人次答案</span>
                </div>
                <DistributionBar
                  distribution={item.answerDistribution}
                  label={`${item.dimensionLabel}全部标注答案构成`}
                  showPercentages
                />
              </div>

              <div className="dimension-row__footer">
                <details className="dimension-row__details">
                  <summary>详细指标</summary>
                  <dl>
                    <div>
                      <dt>出现过不同答案</dt>
                      <dd>
                        {item.disputedCellCount} / {item.validCellCount} ·{" "}
                        {formatPercent(item.disagreementOccurrenceRate)}
                      </dd>
                    </div>
                    <div>
                      <dt>平均未选多数答案</dt>
                      <dd>{formatPercent(item.meanDisagreementDegree)}</dd>
                    </div>
                    <div>
                      <dt>答案分散程度</dt>
                      <dd>{formatPercent(item.meanEntropy)}</dd>
                    </div>
                  </dl>
                  <p>
                    “答案分散程度”用于区分两派争议与多种答案同时出现，数值越高，答案越分散。
                  </p>
                </details>
                <button
                  disabled={!questionKeys.length}
                  onClick={() =>
                    onViewQuestions({
                      dimensionId: item.dimensionId,
                      dimensionLabel: item.dimensionLabel,
                      questionKeys,
                    })
                  }
                  type="button"
                >
                  {questionKeys.length
                    ? `查看相关题目（${questionKeys.length}）`
                    : "暂无分歧题目"}
                  {questionKeys.length ? <ArrowUpRight size={15} /> : null}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
