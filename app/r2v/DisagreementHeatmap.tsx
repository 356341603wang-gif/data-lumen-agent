import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import type { CellStats } from "../../lib/r2v/types.ts";
import { DistributionBar } from "./AnalysisOverview";
import { answerName, formatPercent, MetricHelp } from "./MetricHelp";

function heatColor(cell: CellStats) {
  if (cell.sampleSize < 2) return "var(--r2v-quiet)";
  if (cell.severe) return "var(--r2v-alert)";
  if (cell.disagreementDegree >= 0.25) return "var(--r2v-warn)";
  if (cell.hasDisagreement) return "var(--r2v-soft-warn)";
  return "var(--r2v-calm)";
}

export function DisagreementHeatmap({
  analysis,
}: {
  analysis: R2VAnalysisResult;
}) {
  const [selected, setSelected] = useState<CellStats | null>(null);
  const dimensions = useMemo(() => {
    const seen = new Map<string, string>();
    analysis.heatmap.cells.forEach((cell) => {
      seen.set(cell.dimensionId, cell.dimensionLabel);
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [analysis.heatmap.cells]);
  const rows = useMemo(() => {
    const seen = new Map<
      string,
      { questionKey: string; entityKey: string; cells: CellStats[] }
    >();
    analysis.heatmap.cells.forEach((cell) => {
      const key = `${cell.questionKey}::${cell.entityKey}`;
      const row = seen.get(key) ?? {
        questionKey: cell.questionKey,
        entityKey: cell.entityKey,
        cells: [],
      };
      row.cells.push(cell);
      seen.set(key, row);
    });
    const questionOrder = new Map(
      analysis.heatmap.questions.map((question, index) => [question, index]),
    );
    return [...seen.values()].sort(
      (left, right) =>
        (questionOrder.get(left.questionKey) ?? 9999) -
          (questionOrder.get(right.questionKey) ?? 9999) ||
        left.entityKey.localeCompare(right.entityKey, "zh-CN"),
    );
  }, [analysis.heatmap.cells, analysis.heatmap.questions]);

  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">交叉视角</span>
          <h1>题目 × 维度热力图</h1>
          <p>颜色越深，越值得优先打开；点击格子查看答案、标注员和原因。</p>
        </div>
        <MetricHelp
          title="热力图颜色"
          plain="红色表示严重分歧，橙色表示一般分歧，浅灰表示意见集中。"
          formula="格子颜色 = 该题 × 该 REF × 该维度的分歧度"
          example="同一道题有多个 REF 时会分成多行，不会把不同 REF 的答案混在一起。"
        />
      </div>

      <div className="heatmap-legend">
        <span>
          <i style={{ background: "var(--r2v-calm)" }} />
          意见集中
        </span>
        <span>
          <i style={{ background: "var(--r2v-warn)" }} />
          一般分歧
        </span>
        <span>
          <i style={{ background: "var(--r2v-alert)" }} />
          严重分歧
        </span>
      </div>

      <div className="heatmap-scroll">
        <div
          className="heatmap"
          style={{
            gridTemplateColumns: `minmax(230px, 1.4fr) repeat(${dimensions.length}, minmax(92px, 1fr))`,
          }}
        >
          <div className="heatmap__corner">题目 / REF</div>
          {dimensions.map((dimension) => (
            <div className="heatmap__column-label" key={dimension.id}>
              {dimension.label}
            </div>
          ))}
          {rows.map((row) => (
            <div className="heatmap__row-contents" key={`${row.questionKey}-${row.entityKey}`}>
              <div className="heatmap__row-label">
                <strong>{row.questionKey}</strong>
                <span>{row.entityKey}</span>
              </div>
              {dimensions.map((dimension) => {
                const cell = row.cells.find(
                  (item) => item.dimensionId === dimension.id,
                );
                return cell ? (
                  <button
                    aria-label={`${row.questionKey} ${row.entityKey} ${
                      dimension.label
                    }，分歧度 ${formatPercent(cell.disagreementDegree)}`}
                    className={`heatmap__cell ${
                      cell.severe ? "is-severe" : ""
                    }`}
                    key={dimension.id}
                    onClick={() => setSelected(cell)}
                    style={{ background: heatColor(cell) }}
                    type="button"
                  >
                    <strong>
                      {cell.sampleSize < 2
                        ? "样本不足"
                        : formatPercent(cell.disagreementDegree, 0)}
                    </strong>
                    <span>{cell.sampleSize} 人</span>
                  </button>
                ) : (
                  <div className="heatmap__missing" key={dimension.id}>
                    —
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="evidence-drawer-backdrop" onClick={() => setSelected(null)}>
          <aside
            aria-label="分歧证据"
            className="evidence-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {selected.questionKey} · {selected.entityKey}
                </span>
                <h2>{selected.dimensionLabel}</h2>
              </div>
              <button
                aria-label="关闭"
                onClick={() => setSelected(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            <div className="evidence-drawer__metrics">
              <span>
                <b>{selected.sampleSize}</b>
                有效人数
              </span>
              <span>
                <b>{formatPercent(selected.consistencyRate)}</b>
                一致率
              </span>
              <span>
                <b>{formatPercent(selected.disagreementDegree)}</b>
                分歧度
              </span>
              <span>
                <b>{formatPercent(selected.entropy)}</b>
                混乱度
              </span>
            </div>
            <DistributionBar distribution={selected.distribution} />
            <div className="evidence-list">
              {selected.distribution.map((distribution) => (
                <section key={distribution.answer}>
                  <h3>
                    {answerName(distribution.answer)}
                    <span>{distribution.count} 人</span>
                  </h3>
                  {selected.answers
                    .filter(
                      (answer) => answer.answer === distribution.answer,
                    )
                    .map((answer, index) => (
                      <article
                        key={`${answer.annotator ?? "匿名"}-${index}`}
                      >
                        <strong>{answer.annotator ?? "未识别标注员"}</strong>
                        <p>{answer.reason || "该维度没有收集原因"}</p>
                      </article>
                    ))}
                </section>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

