import { useMemo, useState } from "react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import { DistributionBar } from "./AnalysisOverview";
import { formatPercent, MetricHelp } from "./MetricHelp";

type DimensionMetric =
  | "severe"
  | "degree"
  | "occurrence"
  | "entropy";

const metrics: Array<{
  id: DimensionMetric;
  label: string;
  value: (item: R2VAnalysisResult["dimensionRanking"][number]) => number;
}> = [
  {
    id: "severe",
    label: "严重分歧率",
    value: (item) => item.severeDisagreementRate,
  },
  {
    id: "degree",
    label: "平均分歧度",
    value: (item) => item.meanDisagreementDegree,
  },
  {
    id: "occurrence",
    label: "分歧发生率",
    value: (item) => item.disagreementOccurrenceRate,
  },
  {
    id: "entropy",
    label: "混乱度",
    value: (item) => item.meanEntropy,
  },
];

export function DimensionRanking({
  analysis,
}: {
  analysis: R2VAnalysisResult;
}) {
  const [metric, setMetric] = useState<DimensionMetric>("severe");
  const metricConfig = metrics.find((item) => item.id === metric)!;
  const ranking = useMemo(
    () =>
      [...analysis.dimensionRanking].sort(
        (left, right) =>
          metricConfig.value(right) - metricConfig.value(left) ||
          right.validCellCount - left.validCellCount,
      ),
    [analysis.dimensionRanking, metricConfig],
  );

  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">维度视角</span>
          <h1>维度分歧榜</h1>
          <p>看哪些规则维度在不同题目上反复产生分歧。</p>
        </div>
        <MetricHelp
          title="混乱度"
          plain="它区分两派争议和多种答案同时出现。数值越高，答案越分散。"
          formula="混乱度 = 规范化信息熵，范围 0～100%"
          example="7 人 YES、3 人 NO 是两派分歧；YES、高度相似、低相似、无法判断都有人选时，混乱度更高。"
        />
      </div>

      <div className="metric-switch" role="group" aria-label="排序指标">
        {metrics.map((item) => (
          <button
            className={metric === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setMetric(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="dimension-ranking">
        {ranking.map((item, index) => (
          <article className="dimension-row" key={item.dimensionId}>
            <span className="dimension-row__rank">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="dimension-row__identity">
              <strong>{item.dimensionLabel}</strong>
              <span>{item.validCellCount} 个有效题目单元</span>
            </div>
            <div className="dimension-row__primary">
              <b>{formatPercent(metricConfig.value(item))}</b>
              <span>{metricConfig.label}</span>
            </div>
            <div className="dimension-row__metrics">
              <span>
                发生率 <b>{formatPercent(item.disagreementOccurrenceRate)}</b>
              </span>
              <span>
                平均分歧 <b>{formatPercent(item.meanDisagreementDegree)}</b>
              </span>
              <span>
                严重分歧 <b>{formatPercent(item.severeDisagreementRate)}</b>
              </span>
              <span>
                混乱度 <b>{formatPercent(item.meanEntropy)}</b>
              </span>
            </div>
            <DistributionBar distribution={item.answerDistribution} />
          </article>
        ))}
      </div>
    </section>
  );
}

