export type CellValue = string | number | boolean | Date | null | undefined;
export type DataRow = Record<string, CellValue>;

export type ColumnKind =
  | "number"
  | "category"
  | "date"
  | "boolean"
  | "text"
  | "identifier";

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  p95: number;
  standardDeviation: number;
  outlierCount: number;
  zeroCount: number;
  negativeCount: number;
  histogram: Array<{ label: string; count: number; start: number; end: number }>;
}

export interface CategoryItem {
  label: string;
  count: number;
  rate: number;
}

export interface ColumnProfile {
  name: string;
  kind: ColumnKind;
  count: number;
  missingCount: number;
  missingRate: number;
  uniqueCount: number;
  uniqueRate: number;
  numeric?: NumericStats;
  topValues?: CategoryItem[];
  examples: string[];
}

export interface CorrelationItem {
  left: string;
  right: string;
  value: number;
  sampleSize: number;
}

export interface SegmentItem {
  label: string;
  count: number;
  average: number;
}

export interface SegmentAnalysis {
  categoryColumn: string;
  metricColumn: string;
  items: SegmentItem[];
}

export interface TrendItem {
  label: string;
  value: number;
  count: number;
}

export interface TrendAnalysis {
  dateColumn: string;
  metricColumn: string;
  direction: number;
  items: TrendItem[];
}

export interface Insight {
  level: "critical" | "warning" | "positive" | "info";
  title: string;
  detail: string;
  action: string;
}

export interface AnalysisResult {
  fileName: string;
  sheetName: string;
  rowCount: number;
  columnCount: number;
  analyzedRowCount: number;
  totalCells: number;
  filledCells: number;
  completeness: number;
  duplicateCount: number;
  duplicateRate: number;
  qualityScore: number;
  columns: ColumnProfile[];
  numericColumns: ColumnProfile[];
  categoryColumns: ColumnProfile[];
  dateColumns: ColumnProfile[];
  textColumns: ColumnProfile[];
  correlations: CorrelationItem[];
  segment?: SegmentAnalysis;
  trend?: TrendAnalysis;
  insights: Insight[];
  rows: DataRow[];
}

const MISSING_TOKENS = new Set([
  "",
  "-",
  "--",
  "n/a",
  "na",
  "null",
  "none",
  "undefined",
  "空",
  "无",
]);

const BOOL_TRUE = new Set(["true", "yes", "y", "1", "是", "通过", "合格"]);
const BOOL_FALSE = new Set(["false", "no", "n", "0", "否", "不通过", "不合格"]);

export function isMissing(value: CellValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    return MISSING_TOKENS.has(value.trim().toLowerCase());
  }
  return false;
}

function cleanNumber(value: CellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const percentage = raw.endsWith("%");
  const cleaned = raw
    .replace(/[,\s￥¥$€£]/g, "")
    .replace(/%$/, "")
    .replace(/^\((.*)\)$/, "-$1");
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(cleaned)) {
    return null;
  }
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  return percentage ? number / 100 : number;
}

function toDate(value: CellValue): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (
    !/^\d{4}[-/.年]\d{1,2}(?:[-/.月]\d{1,2})?/.test(raw) &&
    !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(raw)
  ) {
    return null;
  }
  const normalized = raw
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/\//g, "-")
    .replace(/\./g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function quantile(sorted: number[], position: number): number {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function formatBin(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (absolute >= 100) return value.toFixed(0);
  if (absolute >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

function numericStats(values: number[]): NumericStats {
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted.at(-1) ?? 0;
  const mean = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const binCount = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const width = max === min ? 1 : (max - min) / binCount;
  const histogram = Array.from({ length: binCount }, (_, index) => {
    const start = min + width * index;
    const end = index === binCount - 1 ? max : start + width;
    return {
      label: `${formatBin(start)}–${formatBin(end)}`,
      count: 0,
      start,
      end,
    };
  });
  values.forEach((value) => {
    const index =
      max === min
        ? 0
        : Math.min(binCount - 1, Math.floor((value - min) / width));
    histogram[index].count += 1;
  });

  return {
    min,
    max,
    mean,
    median: quantile(sorted, 0.5),
    q1,
    q3,
    p95: quantile(sorted, 0.95),
    standardDeviation: standardDeviation(values, mean),
    outlierCount:
      iqr === 0 ? 0 : values.filter((value) => value < lower || value > upper).length,
    zeroCount: values.filter((value) => value === 0).length,
    negativeCount: values.filter((value) => value < 0).length,
    histogram,
  };
}

function displayValue(value: CellValue): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "");
}

function inferKind(name: string, values: CellValue[]): ColumnKind {
  const sample = values.filter((value) => !isMissing(value)).slice(0, 5_000);
  if (!sample.length) return "text";
  const normalized = sample.map((value) => displayValue(value).trim().toLowerCase());
  const uniqueCount = new Set(normalized).size;
  const uniqueRate = uniqueCount / sample.length;
  const idHint =
    /(^|[_\s-])(id|uid|uuid|code|key|编号|序号|编码|账号|单号)([_\s-]|$)/i.test(
      name,
    ) || /地址|链接|url/i.test(name);
  const booleanRate =
    normalized.filter(
      (value) => BOOL_TRUE.has(value) || BOOL_FALSE.has(value),
    ).length / sample.length;
  const numberRate =
    sample.filter((value) => cleanNumber(value) !== null).length / sample.length;
  const dateRate =
    sample.filter((value) => toDate(value) !== null).length / sample.length;

  if (idHint && uniqueRate > 0.45) return "identifier";
  if (booleanRate >= 0.9 && uniqueCount <= 4) return "boolean";
  if (dateRate >= 0.82) return "date";
  if (numberRate >= 0.85) return "number";
  if (
    uniqueCount <= Math.min(50, Math.max(12, sample.length * 0.2)) ||
    uniqueRate <= 0.12
  ) {
    return "category";
  }
  if (uniqueRate > 0.92 && sample.length > 20) return "identifier";
  return "text";
}

function categoryStats(values: CellValue[], count: number): CategoryItem[] {
  const frequency = new Map<string, number>();
  values.forEach((value) => {
    if (isMissing(value)) return;
    const key = displayValue(value).trim();
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  });
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, valueCount]) => ({
      label,
      count: valueCount,
      rate: count ? valueCount / count : 0,
    }));
}

function profileColumn(name: string, rows: DataRow[]): ColumnProfile {
  const values = rows.map((row) => row[name]);
  const present = values.filter((value) => !isMissing(value));
  const kind = inferKind(name, values);
  const uniqueCount = new Set(present.map((value) => displayValue(value))).size;
  const examples = [...new Set(present.map((value) => displayValue(value)))]
    .slice(0, 3);
  const base: ColumnProfile = {
    name,
    kind,
    count: present.length,
    missingCount: rows.length - present.length,
    missingRate: rows.length ? (rows.length - present.length) / rows.length : 0,
    uniqueCount,
    uniqueRate: present.length ? uniqueCount / present.length : 0,
    examples,
  };
  if (kind === "number") {
    const valuesAsNumbers = present
      .map((value) => cleanNumber(value))
      .filter((value): value is number => value !== null);
    base.numeric = numericStats(valuesAsNumbers);
  } else if (kind === "category" || kind === "boolean") {
    base.topValues = categoryStats(values, present.length);
  }
  return base;
}

function pearson(
  rows: DataRow[],
  left: string,
  right: string,
): { value: number; sampleSize: number } | null {
  const pairs = rows
    .map((row) => [cleanNumber(row[left]), cleanNumber(row[right])] as const)
    .filter(
      (pair): pair is readonly [number, number] =>
        pair[0] !== null && pair[1] !== null,
    );
  if (pairs.length < 3) return null;
  const meanLeft =
    pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const meanRight =
    pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let numerator = 0;
  let denominatorLeft = 0;
  let denominatorRight = 0;
  pairs.forEach(([leftValue, rightValue]) => {
    const leftDelta = leftValue - meanLeft;
    const rightDelta = rightValue - meanRight;
    numerator += leftDelta * rightDelta;
    denominatorLeft += leftDelta ** 2;
    denominatorRight += rightDelta ** 2;
  });
  const denominator = Math.sqrt(denominatorLeft * denominatorRight);
  if (!denominator) return null;
  return { value: numerator / denominator, sampleSize: pairs.length };
}

function buildCorrelations(
  rows: DataRow[],
  numericColumns: ColumnProfile[],
): CorrelationItem[] {
  const candidates = numericColumns
    .filter((column) => column.numeric?.standardDeviation)
    .slice(0, 10);
  const output: CorrelationItem[] = [];
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidates.length;
      rightIndex += 1
    ) {
      const correlation = pearson(
        rows,
        candidates[leftIndex].name,
        candidates[rightIndex].name,
      );
      if (!correlation) continue;
      output.push({
        left: candidates[leftIndex].name,
        right: candidates[rightIndex].name,
        ...correlation,
      });
    }
  }
  return output.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function buildSegment(
  rows: DataRow[],
  categories: ColumnProfile[],
  numerics: ColumnProfile[],
): SegmentAnalysis | undefined {
  const category = categories.find(
    (column) => column.uniqueCount >= 2 && column.uniqueCount <= 12,
  );
  const metric = numerics.find(
    (column) => (column.numeric?.standardDeviation ?? 0) > 0,
  );
  if (!category || !metric) return undefined;
  const groups = new Map<string, number[]>();
  rows.forEach((row) => {
    if (isMissing(row[category.name])) return;
    const value = cleanNumber(row[metric.name]);
    if (value === null) return;
    const label = displayValue(row[category.name]);
    groups.set(label, [...(groups.get(label) ?? []), value]);
  });
  const items = [...groups.entries()]
    .map(([label, values]) => ({
      label,
      count: values.length,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10);
  if (items.length < 2) return undefined;
  return {
    categoryColumn: category.name,
    metricColumn: metric.name,
    items,
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildTrend(
  rows: DataRow[],
  dates: ColumnProfile[],
  numerics: ColumnProfile[],
): TrendAnalysis | undefined {
  const dateColumn = dates[0];
  const metricColumn = numerics.find(
    (column) => (column.numeric?.standardDeviation ?? 0) > 0,
  );
  if (!dateColumn || !metricColumn) return undefined;
  const valid = rows
    .map((row) => ({
      date: toDate(row[dateColumn.name]),
      value: cleanNumber(row[metricColumn.name]),
    }))
    .filter(
      (item): item is { date: Date; value: number } =>
        item.date !== null && item.value !== null,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (valid.length < 3) return undefined;
  const span =
    valid.at(-1)!.date.getTime() - valid[0].date.getTime();
  const useMonth = span > 1000 * 60 * 60 * 24 * 45;
  const grouped = new Map<string, number[]>();
  valid.forEach((item) => {
    const key = useMonth ? monthKey(item.date) : dateKey(item.date);
    grouped.set(key, [...(grouped.get(key) ?? []), item.value]);
  });
  let items = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, values]) => ({
      label,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
      count: values.length,
    }));
  if (items.length > 16) {
    const chunk = Math.ceil(items.length / 16);
    items = Array.from({ length: Math.ceil(items.length / chunk) }, (_, index) => {
      const slice = items.slice(index * chunk, index * chunk + chunk);
      return {
        label: `${slice[0].label}…${slice.at(-1)!.label}`,
        value:
          slice.reduce((sum, item) => sum + item.value, 0) / slice.length,
        count: slice.reduce((sum, item) => sum + item.count, 0),
      };
    });
  }
  if (items.length < 2) return undefined;
  const first = items[0].value;
  const direction = first ? (items.at(-1)!.value - first) / Math.abs(first) : 0;
  return {
    dateColumn: dateColumn.name,
    metricColumn: metricColumn.name,
    direction,
    items,
  };
}

function buildInsights(
  result: Omit<AnalysisResult, "insights">,
): Insight[] {
  const insights: Insight[] = [];
  const missingColumns = result.columns
    .filter((column) => column.missingRate >= 0.2)
    .sort((a, b) => b.missingRate - a.missingRate);
  if (missingColumns.length) {
    insights.push({
      level: missingColumns[0].missingRate >= 0.5 ? "critical" : "warning",
      title: `${missingColumns.length} 个字段缺失率超过 20%`,
      detail: `${missingColumns
        .slice(0, 3)
        .map((column) => `${column.name} ${(column.missingRate * 100).toFixed(0)}%`)
        .join("、")}，会影响分组与建模可信度。`,
      action: "优先确认这些字段是否为业务必填，并区分“真实为空”和“采集失败”。",
    });
  }
  if (result.duplicateRate >= 0.01) {
    insights.push({
      level: result.duplicateRate >= 0.05 ? "critical" : "warning",
      title: `${result.duplicateCount.toLocaleString()} 行疑似完全重复`,
      detail: `重复率 ${(result.duplicateRate * 100).toFixed(1)}%，汇总时可能造成指标被重复计算。`,
      action: "用业务主键二次核验，确认后再去重，不建议直接删除。",
    });
  }
  const outlierColumns = result.numericColumns
    .filter(
      (column) =>
        (column.numeric?.outlierCount ?? 0) / Math.max(column.count, 1) >= 0.03,
    )
    .sort(
      (a, b) =>
        (b.numeric?.outlierCount ?? 0) / Math.max(b.count, 1) -
        (a.numeric?.outlierCount ?? 0) / Math.max(a.count, 1),
    );
  if (outlierColumns.length) {
    const top = outlierColumns[0];
    insights.push({
      level: "warning",
      title: `${outlierColumns.length} 个数值字段存在集中异常值`,
      detail: `${top.name} 检出 ${top.numeric?.outlierCount.toLocaleString()} 个 IQR 异常点，建议结合业务阈值判断。`,
      action: "抽查极值对应原始记录，区分真实长尾、单位混用和录入错误。",
    });
  }
  const dominant = result.categoryColumns
    .map((column) => ({ column, top: column.topValues?.[0] }))
    .filter(
      (item): item is { column: ColumnProfile; top: CategoryItem } =>
        Boolean(item.top && item.top.rate >= 0.7),
    )
    .sort((a, b) => b.top.rate - a.top.rate);
  if (dominant.length) {
    insights.push({
      level: "info",
      title: `${dominant[0].column.name} 分布明显集中`,
      detail: `“${dominant[0].top.label}”占 ${(dominant[0].top.rate * 100).toFixed(1)}%，整体均值可能掩盖少数类别。`,
      action: "汇报时同时展示分组结果与样本量，避免只看总体指标。",
    });
  }
  const highCorrelation = result.correlations.find(
    (item) => Math.abs(item.value) >= 0.8,
  );
  if (highCorrelation) {
    insights.push({
      level: "info",
      title: `${highCorrelation.left} 与 ${highCorrelation.right} 高度相关`,
      detail: `相关系数 ${highCorrelation.value.toFixed(2)}，两者可能表达相近信息，也可能受共同因素驱动。`,
      action: "进一步做分组核验；相关不代表因果，建模前可检查共线性。",
    });
  }
  if (result.trend && Math.abs(result.trend.direction) >= 0.1) {
    const upward = result.trend.direction > 0;
    insights.push({
      level: upward ? "positive" : "warning",
      title: `${result.trend.metricColumn} 呈${upward ? "上升" : "下降"}趋势`,
      detail: `按 ${result.trend.dateColumn} 聚合后，首尾变化约 ${(Math.abs(result.trend.direction) * 100).toFixed(1)}%。`,
      action: "结合业务事件、样本量与季节性进一步解释变化原因。",
    });
  }
  if (result.completeness >= 0.95 && result.duplicateRate < 0.01) {
    insights.push({
      level: "positive",
      title: "基础数据完整度较好",
      detail: `整体完整度 ${(result.completeness * 100).toFixed(1)}%，且完全重复行较少。`,
      action: "可以进入分组差异与指标关系分析，但仍需核验业务口径。",
    });
  }
  if (insights.length < 2) {
    insights.push({
      level: "info",
      title: "字段结构已完成自动识别",
      detail: `识别出 ${result.numericColumns.length} 个数值字段、${result.categoryColumns.length} 个分类字段、${result.dateColumns.length} 个日期字段，可直接用于分布、分组和趋势分析。`,
      action: "检查自动识别的字段类型是否符合业务含义，尤其留意编号与数值字段。",
    });
  }
  if (!insights.length) {
    insights.push({
      level: "positive",
      title: "暂未发现突出的结构性风险",
      detail: "缺失、重复、分布与异常值均未触发默认预警阈值。",
      action: "下一步建议结合业务目标选择核心指标进行分组比较。",
    });
  }
  return insights.slice(0, 6);
}

function makeDuplicateKey(row: DataRow, columns: string[]): string {
  return JSON.stringify(
    columns.map((column) => {
      const value = row[column];
      if (value instanceof Date) return value.toISOString();
      return value ?? null;
    }),
  );
}

export function analyzeRows(
  inputRows: DataRow[],
  fileName: string,
  sheetName: string,
): AnalysisResult {
  const maxAnalyzedRows = 50_000;
  const rows = inputRows.slice(0, maxAnalyzedRows);
  const columnSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => columnSet.add(key)));
  const columnNames = [...columnSet].filter((name) => name.trim());
  const columns = columnNames.map((name) => profileColumn(name, rows));
  const filledCells = columns.reduce((sum, column) => sum + column.count, 0);
  const totalCells = rows.length * columns.length;
  const seen = new Set<string>();
  let duplicateCount = 0;
  rows.forEach((row) => {
    const key = makeDuplicateKey(row, columnNames);
    if (seen.has(key)) duplicateCount += 1;
    else seen.add(key);
  });
  const numericColumns = columns.filter((column) => column.kind === "number");
  const categoryColumns = columns.filter(
    (column) => column.kind === "category" || column.kind === "boolean",
  );
  const dateColumns = columns.filter((column) => column.kind === "date");
  const textColumns = columns.filter(
    (column) => column.kind === "text" || column.kind === "identifier",
  );
  const completeness = totalCells ? filledCells / totalCells : 0;
  const duplicateRate = rows.length ? duplicateCount / rows.length : 0;
  const severeMissingRate =
    columns.length
      ? columns.filter((column) => column.missingRate >= 0.5).length /
        columns.length
      : 0;
  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completeness * 72 +
          (1 - duplicateRate) * 18 +
          (1 - severeMissingRate) * 10,
      ),
    ),
  );
  const correlations = buildCorrelations(rows, numericColumns);
  const segment = buildSegment(rows, categoryColumns, numericColumns);
  const trend = buildTrend(rows, dateColumns, numericColumns);
  const base = {
    fileName,
    sheetName,
    rowCount: inputRows.length,
    columnCount: columns.length,
    analyzedRowCount: rows.length,
    totalCells,
    filledCells,
    completeness,
    duplicateCount,
    duplicateRate,
    qualityScore,
    columns,
    numericColumns,
    categoryColumns,
    dateColumns,
    textColumns,
    correlations,
    segment,
    trend,
    rows,
  };
  return {
    ...base,
    insights: buildInsights(base),
  };
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
  });
}

export function createDemoRows(): DataRow[] {
  const regions = ["华东", "华南", "华北", "西南"];
  const channels = ["自然流量", "内容投放", "合作伙伴", "线下活动"];
  const statuses = ["已完成", "进行中", "待跟进"];
  return Array.from({ length: 720 }, (_, index) => {
    const month = index % 12;
    const region = regions[index % regions.length];
    const channel = channels[(index * 3 + Math.floor(index / 9)) % channels.length];
    const base = 460 + month * 18 + (index % 17) * 9;
    const revenue =
      base * (region === "华东" ? 1.24 : region === "华南" ? 1.08 : 0.92);
    return {
      日期: new Date(2025, month, (index % 27) + 1),
      区域: region,
      渠道: channel,
      项目状态: statuses[index % statuses.length],
      线索数: Math.round(35 + (index % 21) * 2.4),
      转化率: Number((0.11 + (index % 13) * 0.012).toFixed(3)),
      收入: index % 97 === 0 ? revenue * 4.5 : Math.round(revenue),
      成本: index % 83 === 0 ? null : Math.round(revenue * (0.42 + (index % 7) * 0.018)),
      负责人: `成员${String((index % 24) + 1).padStart(2, "0")}`,
    };
  });
}
