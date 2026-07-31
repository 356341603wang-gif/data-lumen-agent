import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import { formatPercent, MetricHelp } from "./MetricHelp";

export function AnnotatorView({
  analysis,
}: {
  analysis: R2VAnalysisResult;
}) {
  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">人员视角</span>
          <h1>标注员偏差</h1>
          <p>用于安排抽检，不直接作为标注能力结论。</p>
        </div>
        <MetricHelp
          title="多数答案一致率"
          plain="只比较已经形成唯一多数意见的题目维度；平票和单人样本会被排除。"
          formula="多数答案一致率 = 与唯一多数答案相同的次数 ÷ 可比较次数"
          example="如果某同学只在 4 个可比较单元中有 2 次跟随多数，一致率为 50%。"
        />
      </div>

      <div className="annotator-table-wrap">
        <table className="annotator-table">
          <thead>
            <tr>
              <th>标注员</th>
              <th>有效提交</th>
              <th>可比较单元</th>
              <th>多数答案一致率</th>
              <th>无法判断使用率</th>
              <th>偏差最高的维度</th>
            </tr>
          </thead>
          <tbody>
            {analysis.annotatorStats.map((annotator) => {
              const top = annotator.deviationsByDimension[0];
              return (
                <tr key={annotator.annotator}>
                  <td>
                    <strong>{annotator.annotator}</strong>
                  </td>
                  <td>{annotator.completedCount}</td>
                  <td>{annotator.comparableCellCount}</td>
                  <td>
                    <div className="annotator-rate">
                      <i>
                        <span
                          style={{
                            width: `${annotator.majorityAlignmentRate * 100}%`,
                          }}
                        />
                      </i>
                      <b>{formatPercent(annotator.majorityAlignmentRate)}</b>
                    </div>
                  </td>
                  <td>{formatPercent(annotator.unknownAnswerRate)}</td>
                  <td>
                    {top
                      ? `${top.dimensionLabel} · ${formatPercent(
                          top.deviationRate,
                        )}`
                      : "样本不足"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!analysis.annotatorStats.length ? (
        <div className="r2v-empty">
          文件中没有识别到标注员字段，因此不展示人员偏差。
        </div>
      ) : null}
    </section>
  );
}

export function CoverageView({
  analysis,
}: {
  analysis: R2VAnalysisResult;
}) {
  const maximum = Math.max(
    1,
    ...analysis.coverage.validLabelsByQuestion.map((item) => item.count),
  );
  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">覆盖视角</span>
          <h1>完成覆盖</h1>
          <p>每道题实际有几人完成，和分歧分析分开呈现。</p>
        </div>
        <MetricHelp
          title="为什么单独看完成度"
          plain="人数少不代表意见一致。未完成记录不能进入分歧率分母，但需要单独提醒补标。"
          formula="有效标注人数 = 已完成且未废弃的提交数"
          example="某题只有 1 人完成时只能展示其答案，不能计算多人分歧。"
        />
      </div>

      <div className="coverage-kpis">
        <span>
          <b>{analysis.coverage.totalRowCount}</b>
          总分配记录
        </span>
        <span>
          <b>{analysis.coverage.completedSubmissionCount}</b>
          有效提交
        </span>
        <span>
          <b>{analysis.coverage.unfinishedSubmissionCount}</b>
          未完成
        </span>
        <span>
          <b>{analysis.coverage.abandonedCount}</b>
          已废弃
        </span>
        <span>
          <b>{analysis.coverage.insufficientQuestionCount}</b>
          人数不足题目
        </span>
        <span>
          <b>{analysis.coverage.parseFailureCount}</b>
          答案解析失败
        </span>
      </div>

      <div className="coverage-list">
        {analysis.coverage.validLabelsByQuestion.map((item) => (
          <article key={item.questionKey}>
            <strong>{item.questionKey}</strong>
            <div>
              <span style={{ width: `${(item.count / maximum) * 100}%` }} />
            </div>
            <b>{item.count} 人</b>
            <small>
              {item.count < analysis.coverage.expectedAnnotatorsPerQuestion
                ? `少 ${
                    analysis.coverage.expectedAnnotatorsPerQuestion -
                    item.count
                  } 人`
                : "已达到当前最高人数"}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

