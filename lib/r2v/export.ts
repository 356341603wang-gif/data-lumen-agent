import type { R2VAnalysisResult } from "./analyze.ts";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownCell(value: unknown): string {
  return String(value ?? "—")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function generatedAt(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export function createR2VMarkdownReport(
  result: R2VAnalysisResult,
): string {
  const deterministic = result.scoreConflicts.filter(
    (item) => item.severity === "error",
  ).length;
  const lines = [
    `# ${result.fileName} · R2V 标注分歧分析报告`,
    "",
    `- 任务类型：${result.taskLabel}`,
    `- 原始记录：${result.coverage.totalRowCount.toLocaleString()} 条`,
    `- 有效样本：${result.coverage.completedSubmissionCount.toLocaleString()} 条`,
    `- 底层题目：${result.coverage.questionCount.toLocaleString()} 道`,
    `- 题目聚合字段：${result.schema.questionField ?? "素材组合哈希"}`,
    `- 标注员字段：${result.schema.annotatorField ?? "未识别"}`,
    `- 生成时间：${generatedAt()}`,
    "",
    "## 先看结论",
    "",
    ...result.headlines.map(
      (headline, index) =>
        `${index + 1}. **${headline.title}**：${headline.detail}`,
    ),
    "",
    "## 指标口径",
    "",
    "- 一致率：人数最多的答案人数 ÷ 有效标注人数。",
    "- 分歧度：1 - 一致率。",
    "- 分歧发生率：出现两个及以上答案的有效单元数 ÷ 全部有效单元数。",
    "- 严重分歧率：最高选项占比不超过 60% 的有效单元数 ÷ 全部有效单元数。",
    "- 混乱度：规范化信息熵，用于区分两派争议与多档答案同时出现。",
    "",
    "## 维度分歧榜",
    "",
    "| 排名 | 维度 | 有效单元 | 分歧发生率 | 平均分歧度 | 严重分歧率 | 混乱度 |",
    "|---:|---|---:|---:|---:|---:|---:|",
    ...result.dimensionRanking.map(
      (item, index) =>
        `| ${index + 1} | ${markdownCell(item.dimensionLabel)} | ${
          item.validCellCount
        } | ${percent(item.disagreementOccurrenceRate)} | ${percent(
          item.meanDisagreementDegree,
        )} | ${percent(item.severeDisagreementRate)} | ${percent(
          item.meanEntropy,
        )} |`,
    ),
    "",
    "## 单题分歧榜",
    "",
    "| 排名 | 题目 | 有效人数 | 分歧维度 | 严重分歧维度 | 平均分歧度 | 混乱度 | 总分跨度 | 规则提示 |",
    "|---:|---|---:|---:|---:|---:|---:|---:|---:|",
    ...result.questionRanking.map(
      (item, index) =>
        `| ${index + 1} | ${markdownCell(item.questionKey)} | ${
          item.validAnnotatorCount
        } | ${item.disputedDimensionCount} | ${
          item.severeDimensionCount
        } | ${percent(item.meanDisagreementDegree)} | ${percent(
          item.maxEntropy,
        )} | ${item.scoreSpread} | ${item.conflictCount} |`,
    ),
    "",
    "## 原因汇总",
    "",
    ...result.reasonSummaries.flatMap((summary) => [
      `### ${summary.dimensionLabel} · ${summary.answer}`,
      "",
      `${summary.reasonCount} 条原因，涉及 ${summary.questionCount} 道题。`,
      "",
      ...summary.clusters.map(
        (cluster) =>
          `- ${cluster.label}：${cluster.count} 条（${percent(
            cluster.rate,
          )}）。代表原因：${markdownCell(
            cluster.examples[0]?.reason ?? "无",
          )}`,
      ),
      "",
    ]),
    "## 总分与维度冲突",
    "",
    `- 确定性数据问题：${deterministic} 条`,
    `- 需要业务复核：${result.scoreConflicts.length - deterministic} 条`,
    "",
    ...result.scoreConflicts.map(
      (item) =>
        `- [${item.severity === "error" ? "数据问题" : "业务复核"}] ${
          item.questionKey
        } · ${item.entityKey ?? "整题"} · ${item.title}：${item.explanation}`,
    ),
    "",
    "## 完成覆盖",
    "",
    `- 未完成记录：${result.coverage.unfinishedSubmissionCount} 条`,
    `- 已废弃：${result.coverage.abandonedCount} 条`,
    `- 人数不足题目：${result.coverage.insufficientQuestionCount} 道`,
    `- 答案解析失败：${result.coverage.parseFailureCount} 条`,
    "",
    "> 原始文件仅在浏览器本地解析。分歧不等于错误，规则疑似冲突需要结合素材复核。",
  ];
  return lines.join("\n");
}

export function createDimensionCsv(result: R2VAnalysisResult): string {
  return csv([
    [
      "任务类型",
      "维度",
      "有效单元数",
      "分歧单元数",
      "分歧发生率",
      "平均分歧度",
      "平均一致率",
      "严重分歧单元数",
      "严重分歧率",
      "混乱度",
      "生成时间",
    ],
    ...result.dimensionRanking.map((item) => [
      result.taskLabel,
      item.dimensionLabel,
      item.validCellCount,
      item.disputedCellCount,
      percent(item.disagreementOccurrenceRate),
      percent(item.meanDisagreementDegree),
      percent(item.meanConsistencyRate),
      item.severeCellCount,
      percent(item.severeDisagreementRate),
      percent(item.meanEntropy),
      generatedAt(),
    ]),
  ]);
}

export function createQuestionCsv(result: R2VAnalysisResult): string {
  return csv([
    [
      "任务类型",
      "题目",
      "有效人数",
      "有效维度单元数",
      "分歧维度数",
      "严重分歧维度数",
      "平均分歧度",
      "最高混乱度",
      "总分跨度",
      "规则提示数",
      "生成时间",
    ],
    ...result.questionRanking.map((item) => [
      result.taskLabel,
      item.questionKey,
      item.validAnnotatorCount,
      item.totalDimensionCount,
      item.disputedDimensionCount,
      item.severeDimensionCount,
      percent(item.meanDisagreementDegree),
      percent(item.maxEntropy),
      item.scoreSpread,
      item.conflictCount,
      generatedAt(),
    ]),
  ]);
}

export function createReasonCsv(result: R2VAnalysisResult): string {
  const rows: unknown[][] = [
    [
      "任务类型",
      "维度",
      "答案选项",
      "原因类别",
      "类别数量",
      "类别占比",
      "题目",
      "代表原因",
      "生成时间",
    ],
  ];
  result.reasonSummaries.forEach((summary) => {
    summary.clusters.forEach((cluster) => {
      if (!cluster.examples.length) {
        rows.push([
          result.taskLabel,
          summary.dimensionLabel,
          summary.answer,
          cluster.label,
          cluster.count,
          percent(cluster.rate),
          "",
          "",
          generatedAt(),
        ]);
        return;
      }
      cluster.examples.forEach((example) => {
        rows.push([
          result.taskLabel,
          summary.dimensionLabel,
          summary.answer,
          cluster.label,
          cluster.count,
          percent(cluster.rate),
          example.questionKey,
          example.reason,
          generatedAt(),
        ]);
      });
    });
  });
  return csv(rows);
}

export function createConflictCsv(result: R2VAnalysisResult): string {
  return csv([
    [
      "任务类型",
      "问题类型",
      "问题代码",
      "题目",
      "REF或分组",
      "维度",
      "标注员",
      "标题",
      "说明",
      "原始行号",
      "生成时间",
    ],
    ...result.scoreConflicts.map((item) => [
      result.taskLabel,
      item.severity === "error" ? "确定性数据问题" : "需要业务复核",
      item.code,
      item.questionKey,
      item.entityKey ?? "",
      item.dimensionId ?? "",
      item.annotator ?? "",
      item.title,
      item.explanation,
      item.rawRowIndex + 2,
      generatedAt(),
    ]),
  ]);
}

export function createAnnotatorCsv(result: R2VAnalysisResult): string {
  return csv([
    [
      "标注员",
      "有效提交数",
      "可比较单元数",
      "多数答案一致率",
      "无法判断使用率",
      "偏差最高维度",
      "该维度偏差率",
      "生成时间",
    ],
    ...result.annotatorStats.map((item) => [
      item.annotator,
      item.completedCount,
      item.comparableCellCount,
      percent(item.majorityAlignmentRate),
      percent(item.unknownAnswerRate),
      item.deviationsByDimension[0]?.dimensionLabel ?? "",
      item.deviationsByDimension[0]
        ? percent(item.deviationsByDimension[0].deviationRate)
        : "",
      generatedAt(),
    ]),
  ]);
}

