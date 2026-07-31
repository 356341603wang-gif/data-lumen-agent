import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { R2VAnalysisResult } from "../../lib/r2v/analyze.ts";
import type { DimensionQuestionFilter } from "./DimensionRanking";
import { formatPercent, MetricHelp } from "./MetricHelp";

function questionReason(
  question: R2VAnalysisResult["questionRanking"][number],
) {
  if (question.severeDimensionCount > 0) {
    return `${question.severeDimensionCount} 个维度没有形成超过 60% 的稳定多数意见。`;
  }
  if (question.maxEntropy >= 0.8) {
    return "至少一个维度出现多档答案分散，建议先统一边界案例。";
  }
  if (question.scoreSpread >= 2) {
    return `总分跨度达到 ${question.scoreSpread} 分，建议结合维度答案复核。`;
  }
  if (question.disputedDimensionCount > 0) {
    return "存在一般分歧，但多数意见相对稳定。";
  }
  return "当前有效标注意见较为一致。";
}

export function QuestionRanking({
  analysis,
  dimensionFilter,
  onClearDimensionFilter,
}: {
  analysis: R2VAnalysisResult;
  dimensionFilter?: DimensionQuestionFilter | null;
  onClearDimensionFilter?: () => void;
}) {
  const [query, setQuery] = useState("");
  const questions = useMemo(() => {
    const allowedQuestions = dimensionFilter
      ? new Set(dimensionFilter.questionKeys)
      : null;
    return analysis.questionRanking.filter(
      (question) =>
        (!allowedQuestions || allowedQuestions.has(question.questionKey)) &&
        question.questionKey
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
  }, [analysis.questionRanking, dimensionFilter, query]);

  return (
    <section className="r2v-view">
      <div className="r2v-view-heading">
        <div>
          <span className="r2v-section-number">题目视角</span>
          <h1>单题分歧榜</h1>
          <p>按严重分歧、平均分歧、混乱度和总分跨度综合排序。</p>
        </div>
        <MetricHelp
          title="为什么看单题"
          plain="维度榜能发现规则难点，单题榜能找到明天最值得拿出来集体对齐的具体案例。"
          formula="优先级 = 严重分歧维度数 → 平均分歧度 → 混乱度 → 总分跨度"
          example="某题 7 个维度中有 5 个发生分歧，比只有 1 个轻微分歧的题更应优先讨论。"
        />
      </div>

      {dimensionFilter ? (
        <div className="dimension-question-filter">
          <div>
            <span>只看「{dimensionFilter.dimensionLabel}」的相关题目</span>
            <strong>{dimensionFilter.questionKeys.length} 题</strong>
          </div>
          <p>
            优先展示这个维度达到严重分歧的题目；如果没有严重分歧，则展示所有发生过分歧的题目。
          </p>
          <button onClick={onClearDimensionFilter} type="button">
            清除筛选
          </button>
        </div>
      ) : null}

      <label className="r2v-search">
        <Search size={15} />
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索题目 ID"
          value={query}
        />
      </label>

      <div className="question-table-wrap">
        <table className="question-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>题目</th>
              <th>为什么值得对齐</th>
              <th>有效人数</th>
              <th>分歧维度</th>
              <th>严重分歧</th>
              <th>平均分歧</th>
              <th>混乱度</th>
              <th>总分跨度</th>
              <th>规则提示</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((question, index) => (
              <tr key={question.questionKey}>
                <td>
                  <span className="question-rank">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </td>
                <td>
                  <strong>{question.questionKey}</strong>
                </td>
                <td className="question-why">{questionReason(question)}</td>
                <td>{question.validAnnotatorCount}</td>
                <td>
                  {question.disputedDimensionCount}/
                  {question.totalDimensionCount}
                </td>
                <td>
                  <b
                    className={
                      question.severeDimensionCount ? "is-severe" : ""
                    }
                  >
                    {question.severeDimensionCount}
                  </b>
                </td>
                <td>{formatPercent(question.meanDisagreementDegree)}</td>
                <td>{formatPercent(question.maxEntropy)}</td>
                <td>{question.scoreSpread}</td>
                <td>{question.conflictCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!questions.length ? (
        <div className="r2v-empty">没有找到匹配的题目。</div>
      ) : null}
    </section>
  );
}
