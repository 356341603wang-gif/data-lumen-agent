import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import { answerName, formatPercent, MetricHelp } from "./MetricHelp";

export function ReasonView({
  analysis,
}: {
  analysis: R2VAnalysisResult;
}) {
  const dimensions = Array.from(
    new Map(
      analysis.reasonSummaries.map((summary) => [
        summary.dimensionId,
        summary.dimensionLabel,
      ]),
    ),
  );
  const [dimension, setDimension] = useState(dimensions[0]?.[0] ?? "all");
  const summaries = useMemo(
    () =>
      analysis.reasonSummaries.filter(
        (summary) => dimension === "all" || summary.dimensionId === dimension,
      ),
    [analysis.reasonSummaries, dimension],
  );

  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">理由视角</span>
          <h1>原因汇总</h1>
          <p>不同答案的原因分开统计，避免把相反观点混成一段摘要。</p>
        </div>
        <MetricHelp
          title="原因汇总方式"
          plain="先按维度和所选答案分组，再把包含相似判断点的原因聚在一起。"
          formula="分组键 = 任务 × 维度 × 答案"
          example="音色选高度相似的原因，不会与选低相似的原因混在一起。"
        />
      </div>

      <label className="r2v-inline-select">
        <span>查看维度</span>
        <select
          onChange={(event) => setDimension(event.target.value)}
          value={dimension}
        >
          <option value="all">全部有原因的维度</option>
          {dimensions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="reason-grid">
        {summaries.map((summary) => (
          <article
            className="reason-card"
            key={`${summary.dimensionId}-${summary.answer}`}
          >
            <header>
              <div>
                <span>{summary.dimensionLabel}</span>
                <h2>{answerName(summary.answer)}</h2>
              </div>
              <b>{summary.reasonCount} 条原因</b>
            </header>
            <div className="reason-clusters">
              {summary.clusters.map((cluster) => (
                <details key={cluster.label}>
                  <summary>
                    <span>{cluster.label}</span>
                    <b>
                      {cluster.count} · {formatPercent(cluster.rate)}
                    </b>
                  </summary>
                  <div>
                    {cluster.examples.map((example, index) => (
                      <blockquote
                        key={`${example.questionKey}-${index}`}
                      >
                        <span>{example.questionKey}</span>
                        {example.reason}
                      </blockquote>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </article>
        ))}
      </div>
      {!summaries.length ? (
        <div className="r2v-empty">当前模板没有可汇总的原因记录。</div>
      ) : null}
    </section>
  );
}

export function ConflictView({
  analysis,
}: {
  analysis: R2VAnalysisResult;
}) {
  const errors = analysis.scoreConflicts.filter(
    (item) => item.severity === "error",
  );
  const reviews = analysis.scoreConflicts.filter(
    (item) => item.severity === "review",
  );

  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">规则视角</span>
          <h1>总分与维度冲突</h1>
          <p>确定性漏填与需要业务复核的组合分开呈现。</p>
        </div>
        <MetricHelp
          title="疑似冲突不是自动判错"
          plain="总分与维度关系可能存在特殊案例，因此语义冲突只进入复核清单。"
          formula="确定性问题 = 漏填/非法结构；业务复核 = 总分与维度语义张力"
          example="音频给 5 分但通用一致性不是 YES，会提示复核，不会直接判定标注员错误。"
        />
      </div>

      <div className="conflict-summary">
        <span>
          <AlertCircle size={17} />
          <b>{errors.length}</b>
          确定性数据问题
        </span>
        <span>
          <CheckCircle2 size={17} />
          <b>{reviews.length}</b>
          需要业务复核
        </span>
      </div>

      <div className="conflict-columns">
        <section>
          <h2>确定性数据问题</h2>
          <p>缺少必填字段、分组非法或答案结构异常。</p>
          <div className="conflict-list">
            {errors.map((item, index) => (
              <article key={`${item.rawRowIndex}-${item.code}-${index}`}>
                <span>{item.code}</span>
                <strong>{item.title}</strong>
                <p>{item.explanation}</p>
                <small>
                  {item.questionKey} · {item.entityKey ?? "整题"} ·{" "}
                  {item.annotator ?? "未识别标注员"}
                </small>
              </article>
            ))}
            {!errors.length ? (
              <div className="r2v-empty r2v-empty--compact">
                没有发现确定性数据问题。
              </div>
            ) : null}
          </div>
        </section>
        <section>
          <h2>需要业务复核</h2>
          <p>总分、维度或价值判断之间存在需要回看素材的组合。</p>
          <div className="conflict-list">
            {reviews.map((item, index) => (
              <article key={`${item.rawRowIndex}-${item.code}-${index}`}>
                <span>{item.code}</span>
                <strong>{item.title}</strong>
                <p>{item.explanation}</p>
                <small>
                  {item.questionKey} · {item.entityKey ?? "整题"} ·{" "}
                  {item.annotator ?? "未识别标注员"}
                </small>
              </article>
            ))}
            {!reviews.length ? (
              <div className="r2v-empty r2v-empty--compact">
                没有发现需要业务复核的组合。
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

