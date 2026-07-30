"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Layers3,
  LockKeyhole,
  RefreshCcw,
  ScanSearch,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AnalysisResult,
  ColumnKind,
  ColumnProfile,
  DataRow,
  analyzeRows,
  createDemoRows,
  formatNumber,
  isMissing,
} from "../lib/analysis";

type SheetData = {
  name: string;
  rows: DataRow[];
};

type WorkbookData = {
  fileName: string;
  fileSize?: number;
  sheets: SheetData[];
};

type DashboardTab = "overview" | "fields" | "quality" | "relations" | "preview";

const tabItems: Array<{
  id: DashboardTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "overview", label: "分析总览", icon: BarChart3 },
  { id: "fields", label: "字段画像", icon: Layers3 },
  { id: "quality", label: "数据质量", icon: ShieldCheck },
  { id: "relations", label: "关系洞察", icon: Activity },
  { id: "preview", label: "数据明细", icon: Table2 },
];

const kindLabels: Record<ColumnKind, string> = {
  number: "数值",
  category: "分类",
  date: "日期",
  boolean: "布尔",
  text: "文本",
  identifier: "标识符",
};

const insightIcons = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  positive: CheckCircle2,
  info: Info,
};

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function displayCell(value: DataRow[string]) {
  if (isMissing(value)) return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return formatNumber(value, 2);
  return String(value);
}

function formatBytes(bytes?: number) {
  if (!bytes) return "示例数据";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function KpiCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <article className={`kpi-card ${accent ? "kpi-card--accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="empty-chart">
      <ScanSearch size={22} />
      <span>{text}</span>
    </div>
  );
}

function CategoryChart({ column }: { column?: ColumnProfile }) {
  if (!column?.topValues?.length) {
    return <EmptyChart text="没有适合展示的分类字段" />;
  }
  const top = column.topValues.slice(0, 7);
  const maximum = Math.max(...top.map((item) => item.count), 1);
  return (
    <div className="bar-list">
      {top.map((item, index) => (
        <div className="bar-row" key={item.label}>
          <div className="bar-label">
            <span>{item.label}</span>
            <small>{percent(item.rate)}</small>
          </div>
          <div className="bar-track">
            <span
              className={index === 0 ? "bar-fill bar-fill--primary" : "bar-fill"}
              style={{ width: `${Math.max(2, (item.count / maximum) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Histogram({ column }: { column?: ColumnProfile }) {
  if (!column?.numeric?.histogram.length) {
    return <EmptyChart text="没有适合展示的数值字段" />;
  }
  const bins = column.numeric.histogram;
  const maximum = Math.max(...bins.map((item) => item.count), 1);
  return (
    <div className="histogram">
      <div className="histogram-bars">
        {bins.map((bin) => (
          <div className="histogram-column" key={`${bin.start}-${bin.end}`}>
            <span
              className="histogram-bar"
              style={{
                height: `${Math.max(3, (bin.count / maximum) * 100)}%`,
              }}
              title={`${bin.label}: ${bin.count.toLocaleString()} 行`}
            />
          </div>
        ))}
      </div>
      <div className="histogram-axis">
        <span>{formatNumber(column.numeric.min, 2)}</span>
        <span>中位数 {formatNumber(column.numeric.median, 2)}</span>
        <span>{formatNumber(column.numeric.max, 2)}</span>
      </div>
    </div>
  );
}

function TrendBars({ analysis }: { analysis: AnalysisResult }) {
  if (!analysis.trend) {
    return <EmptyChart text="需要同时包含日期与数值字段" />;
  }
  const items = analysis.trend.items;
  const min = Math.min(...items.map((item) => item.value));
  const max = Math.max(...items.map((item) => item.value));
  const span = max - min || 1;
  return (
    <div className="trend-chart">
      <div className="trend-bars">
        {items.map((item, index) => (
          <div className="trend-column" key={`${item.label}-${index}`}>
            <span className="trend-value">{formatNumber(item.value, 1)}</span>
            <span
              className="trend-bar"
              style={{
                height: `${28 + ((item.value - min) / span) * 72}%`,
              }}
              title={`${item.label}：${formatNumber(item.value, 2)}，${item.count} 行`}
            />
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentChart({ analysis }: { analysis: AnalysisResult }) {
  if (!analysis.segment) {
    return <EmptyChart text="需要同时包含分类与数值字段" />;
  }
  const items = analysis.segment.items;
  const maximum = Math.max(...items.map((item) => item.average), 1);
  return (
    <div className="segment-list">
      {items.map((item, index) => (
        <div className="segment-item" key={item.label}>
          <span className="segment-rank">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{item.label}</strong>
            <small>{item.count.toLocaleString()} 行</small>
          </div>
          <div className="segment-meter">
            <span style={{ width: `${(item.average / maximum) * 100}%` }} />
          </div>
          <b>{formatNumber(item.average, 2)}</b>
        </div>
      ))}
    </div>
  );
}

function QualityRing({ score }: { score: number }) {
  return (
    <div
      className="quality-ring"
      style={{
        background: `conic-gradient(var(--signal) ${score * 3.6}deg, var(--line) 0deg)`,
      }}
    >
      <div>
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function InsightList({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="insight-list">
      {analysis.insights.map((insight, index) => {
        const Icon = insightIcons[insight.level];
        return (
          <article className={`insight insight--${insight.level}`} key={insight.title}>
            <div className="insight-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="insight-icon">
              <Icon size={17} />
            </div>
            <div className="insight-content">
              <strong>{insight.title}</strong>
              <p>{insight.detail}</p>
              <small>{insight.action}</small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function createAgentAnswer(question: string, analysis: AnalysisResult) {
  const normalized = question.trim().toLowerCase();
  if (/缺失|空值|完整/.test(normalized)) {
    const ranked = [...analysis.columns]
      .filter((column) => column.missingCount)
      .sort((a, b) => b.missingRate - a.missingRate)
      .slice(0, 5);
    if (!ranked.length) return "这份数据没有检测到空值，整体完整度为 100%。";
    return `缺失最需要关注的是：${ranked
      .map(
        (column) =>
          `${column.name} ${percent(column.missingRate)}（${column.missingCount.toLocaleString()} 行）`,
      )
      .join("；")}。建议先确认高缺失字段是否为业务必填。`;
  }
  if (/重复|去重/.test(normalized)) {
    return analysis.duplicateCount
      ? `检测到 ${analysis.duplicateCount.toLocaleString()} 行完全重复，重复率 ${percent(analysis.duplicateRate)}。建议先用业务主键核验，再决定是否删除。`
      : "未检测到完全重复行；如果存在业务主键，还可以进一步检查“主键重复但其他字段不同”的情况。";
  }
  if (/异常|极值|离群/.test(normalized)) {
    const ranked = [...analysis.numericColumns]
      .filter((column) => column.numeric?.outlierCount)
      .sort(
        (a, b) =>
          (b.numeric?.outlierCount ?? 0) - (a.numeric?.outlierCount ?? 0),
      )
      .slice(0, 5);
    if (!ranked.length) return "按 IQR 规则，没有检测到明显数值异常点。";
    return `异常值主要集中在：${ranked
      .map(
        (column) =>
          `${column.name} ${column.numeric?.outlierCount.toLocaleString()} 个`,
      )
      .join("、")}。这只是统计预警，需要结合业务阈值判断是否真的异常。`;
  }
  if (/相关|关系|关联/.test(normalized)) {
    const ranked = analysis.correlations.slice(0, 4);
    if (!ranked.length) return "当前数值字段不足，暂时无法计算稳定的相关关系。";
    return `绝对相关性最高的组合是：${ranked
      .map(
        (item) => `${item.left} × ${item.right}（r=${item.value.toFixed(2)}）`,
      )
      .join("；")}。请注意，相关性不等于因果关系。`;
  }
  if (/趋势|变化|增长|下降/.test(normalized)) {
    if (!analysis.trend) return "当前没有识别到可用于趋势分析的日期字段与数值字段组合。";
    return `${analysis.trend.metricColumn} 按 ${analysis.trend.dateColumn} 聚合后，首尾变化 ${percent(analysis.trend.direction)}。建议结合每期样本量和业务事件解释趋势。`;
  }
  if (/分组|类别|最高|最低|对比/.test(normalized)) {
    if (!analysis.segment) return "当前没有适合做分组对比的分类字段与数值字段组合。";
    const top = analysis.segment.items[0];
    const bottom = analysis.segment.items.at(-1)!;
    return `以 ${analysis.segment.categoryColumn} 分组比较 ${analysis.segment.metricColumn}：${top.label} 均值最高（${formatNumber(top.average, 2)}），${bottom.label} 最低（${formatNumber(bottom.average, 2)}）。汇报时建议同时保留各组样本量。`;
  }
  const primary = analysis.insights[0];
  return `这份数据最值得先看的是“${primary.title}”。${primary.detail}${primary.action} 数据质量评分为 ${analysis.qualityScore}/100，整体完整度 ${percent(analysis.completeness)}。`;
}

function UploadPanel({
  onFile,
  onDemo,
  loading,
  error,
}: {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  error: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <section className="upload-stage">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          SPREADSHEET INTELLIGENCE
        </div>
        <h1>
          把表格
          <br />
          变成<span>判断</span>
        </h1>
        <p>
          上传 Excel 或 CSV，自动完成字段识别、数据质量检查、分布与关系分析，
          直接给出可视化图表和可以拿去汇报的结论。
        </p>
        <div className="hero-proof">
          <div>
            <strong>01</strong>
            <span>自动识别</span>
          </div>
          <div>
            <strong>02</strong>
            <span>即时分析</span>
          </div>
          <div>
            <strong>03</strong>
            <span>结论输出</span>
          </div>
        </div>
      </div>

      <div
        className={`dropzone ${dragging ? "dropzone--dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.currentTarget.value = "";
          }}
        />
        <div className="dropzone-topline">
          <span>NEW ANALYSIS</span>
          <span>LOCAL PROCESSING</span>
        </div>
        <div className="upload-orbit">
          <FileSpreadsheet size={34} strokeWidth={1.5} />
          <span />
        </div>
        <h2>{loading ? "正在读取与分析…" : "将表格拖到这里"}</h2>
        <p>支持 .xlsx / .xls / .csv / .tsv，单文件建议不超过 30 MB</p>
        <button
          className="primary-action"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Upload size={16} />
          选择文件
          <ArrowRight size={15} />
        </button>
        <button className="text-action" onClick={onDemo} type="button">
          暂时没有表格？先看示例分析
        </button>
        {error ? <div className="upload-error">{error}</div> : null}
        <div className="privacy-note">
          <LockKeyhole size={14} />
          文件只在你的浏览器中解析，不上传原始数据
        </div>
      </div>
    </section>
  );
}

function Overview({
  analysis,
  onCopy,
  copied,
}: {
  analysis: AnalysisResult;
  onCopy: () => void;
  copied: boolean;
}) {
  const primaryCategory = analysis.categoryColumns[0];
  const primaryNumeric = analysis.numericColumns[0];
  return (
    <>
      <section className="kpi-grid">
        <KpiCard
          label="数据规模"
          value={analysis.rowCount.toLocaleString()}
          note={`${analysis.columnCount} 个字段 · ${analysis.sheetName}`}
          accent
        />
        <KpiCard
          label="整体完整度"
          value={percent(analysis.completeness)}
          note={`${(analysis.totalCells - analysis.filledCells).toLocaleString()} 个空单元格`}
        />
        <KpiCard
          label="重复记录"
          value={analysis.duplicateCount.toLocaleString()}
          note={`占全部记录 ${percent(analysis.duplicateRate)}`}
        />
        <KpiCard
          label="可分析字段"
          value={`${analysis.numericColumns.length + analysis.categoryColumns.length}`}
          note={`${analysis.numericColumns.length} 数值 · ${analysis.categoryColumns.length} 分类`}
        />
      </section>

      <section className="overview-grid">
        <article className="panel panel--lead">
          <div className="panel-heading">
            <div>
              <span className="section-index">01 / AGENT READOUT</span>
              <h2>先看这些结论</h2>
            </div>
            <button className="icon-button" onClick={onCopy} type="button">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "已复制" : "复制结论"}
            </button>
          </div>
          <InsightList analysis={analysis} />
        </article>

        <article className="panel panel--quality">
          <div className="panel-heading">
            <div>
              <span className="section-index">02 / QUALITY</span>
              <h2>数据健康度</h2>
            </div>
          </div>
          <div className="quality-content">
            <QualityRing score={analysis.qualityScore} />
            <div className="quality-copy">
              <strong>
                {analysis.qualityScore >= 90
                  ? "状态良好"
                  : analysis.qualityScore >= 75
                    ? "可以使用，有待清理"
                    : "建议先治理再使用"}
              </strong>
              <p>
                评分综合考虑完整度、完全重复记录以及高缺失字段。业务准确性仍需结合口径核验。
              </p>
              <div className="quality-tags">
                <span>{analysis.columns.filter((column) => column.missingRate >= 0.2).length} 个高缺失字段</span>
                <span>{analysis.numericColumns.reduce((sum, column) => sum + (column.numeric?.outlierCount ?? 0), 0)} 个统计异常点</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="chart-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">03 / DISTRIBUTION</span>
              <h2>{primaryCategory?.name ?? "分类分布"}</h2>
            </div>
            {primaryCategory ? (
              <span className="data-badge">{primaryCategory.uniqueCount} 类</span>
            ) : null}
          </div>
          <CategoryChart column={primaryCategory} />
        </article>
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">04 / RANGE</span>
              <h2>{primaryNumeric?.name ?? "数值分布"}</h2>
            </div>
            {primaryNumeric?.numeric ? (
              <span className="data-badge">均值 {formatNumber(primaryNumeric.numeric.mean, 2)}</span>
            ) : null}
          </div>
          <Histogram column={primaryNumeric} />
        </article>
        <article className="panel chart-panel chart-panel--wide">
          <div className="panel-heading">
            <div>
              <span className="section-index">05 / TIME SIGNAL</span>
              <h2>
                {analysis.trend
                  ? `${analysis.trend.metricColumn} 趋势`
                  : "趋势分析"}
              </h2>
            </div>
            {analysis.trend ? (
              <span
                className={`change-badge ${
                  analysis.trend.direction < 0 ? "change-badge--down" : ""
                }`}
              >
                {analysis.trend.direction >= 0 ? "+" : ""}
                {percent(analysis.trend.direction)}
              </span>
            ) : null}
          </div>
          <TrendBars analysis={analysis} />
        </article>
      </section>
    </>
  );
}

function FieldsView({ analysis }: { analysis: AnalysisResult }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ColumnKind | "all">("all");
  const filtered = analysis.columns.filter(
    (column) =>
      (kind === "all" || column.kind === kind) &&
      column.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section className="panel content-panel">
      <div className="panel-heading panel-heading--stack-mobile">
        <div>
          <span className="section-index">FIELD PROFILING</span>
          <h2>字段画像</h2>
          <p>自动判断字段类型、唯一性、缺失与核心统计。</p>
        </div>
        <div className="field-tools">
          <label className="search-control">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索字段"
            />
            {query ? (
              <button onClick={() => setQuery("")} type="button" aria-label="清空搜索">
                <X size={14} />
              </button>
            ) : null}
          </label>
          <label className="select-control">
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as ColumnKind | "all")
              }
            >
              <option value="all">全部类型</option>
              {Object.entries(kindLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </div>
      <div className="field-table-wrap">
        <table className="field-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>识别类型</th>
              <th>非空数</th>
              <th>缺失率</th>
              <th>唯一值</th>
              <th>关键统计 / 示例</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((column) => (
              <tr key={column.name}>
                <td>
                  <strong>{column.name}</strong>
                </td>
                <td>
                  <span className={`kind-tag kind-tag--${column.kind}`}>
                    {kindLabels[column.kind]}
                  </span>
                </td>
                <td>{column.count.toLocaleString()}</td>
                <td>
                  <div className="rate-cell">
                    <span>{percent(column.missingRate)}</span>
                    <i>
                      <b style={{ width: percent(column.missingRate) }} />
                    </i>
                  </div>
                </td>
                <td>
                  {column.uniqueCount.toLocaleString()}
                  <small>{percent(column.uniqueRate)}</small>
                </td>
                <td className="field-detail">
                  {column.numeric ? (
                    <>
                      <span>均值 {formatNumber(column.numeric.mean, 2)}</span>
                      <span>中位数 {formatNumber(column.numeric.median, 2)}</span>
                      <span>异常 {column.numeric.outlierCount}</span>
                    </>
                  ) : column.topValues?.length ? (
                    column.topValues.slice(0, 3).map((item) => (
                      <span key={item.label}>
                        {item.label} {percent(item.rate, 0)}
                      </span>
                    ))
                  ) : (
                    column.examples.map((example) => (
                      <span key={example}>{example}</span>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length ? <EmptyChart text="没有匹配的字段" /> : null}
    </section>
  );
}

function QualityView({ analysis }: { analysis: AnalysisResult }) {
  const missingRank = [...analysis.columns]
    .sort((a, b) => b.missingRate - a.missingRate)
    .slice(0, 10);
  const outlierRank = [...analysis.numericColumns]
    .filter((column) => column.numeric?.outlierCount)
    .sort(
      (a, b) =>
        (b.numeric?.outlierCount ?? 0) - (a.numeric?.outlierCount ?? 0),
    )
    .slice(0, 8);
  const maximumMissing = Math.max(...missingRank.map((item) => item.missingRate), 0.01);
  const maximumOutlier = Math.max(
    ...outlierRank.map((item) => item.numeric?.outlierCount ?? 0),
    1,
  );

  return (
    <div className="quality-grid">
      <article className="panel quality-score-panel">
        <span className="section-index">QUALITY SCORE</span>
        <QualityRing score={analysis.qualityScore} />
        <h2>数据健康度</h2>
        <p>
          这是自动体检分，不等于业务准确率。字段口径、样本偏差与标注正确性仍需人工确认。
        </p>
        <div className="quality-checklist">
          <span>
            <CheckCircle2 size={15} />
            已完成 {analysis.columnCount} 个字段扫描
          </span>
          <span>
            <CheckCircle2 size={15} />
            已分析 {analysis.analyzedRowCount.toLocaleString()} 行
          </span>
          {analysis.rowCount > analysis.analyzedRowCount ? (
            <span className="quality-warning">
              <AlertTriangle size={15} />
              大文件统计基于前 50,000 行
            </span>
          ) : null}
        </div>
      </article>

      <article className="panel ranked-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">MISSING VALUES</span>
            <h2>字段缺失排名</h2>
          </div>
        </div>
        <div className="ranked-list">
          {missingRank.map((column) => (
            <div className="ranked-item" key={column.name}>
              <div>
                <strong>{column.name}</strong>
                <span>{column.missingCount.toLocaleString()} 个空值</span>
              </div>
              <div className="ranked-track">
                <span
                  style={{ width: `${(column.missingRate / maximumMissing) * 100}%` }}
                />
              </div>
              <b>{percent(column.missingRate)}</b>
            </div>
          ))}
        </div>
      </article>

      <article className="panel ranked-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">OUTLIER SCAN</span>
            <h2>统计异常值</h2>
          </div>
        </div>
        {outlierRank.length ? (
          <div className="ranked-list ranked-list--alert">
            {outlierRank.map((column) => (
              <div className="ranked-item" key={column.name}>
                <div>
                  <strong>{column.name}</strong>
                  <span>IQR 规则检测</span>
                </div>
                <div className="ranked-track">
                  <span
                    style={{
                      width: `${((column.numeric?.outlierCount ?? 0) / maximumOutlier) * 100}%`,
                    }}
                  />
                </div>
                <b>{column.numeric?.outlierCount.toLocaleString()}</b>
              </div>
            ))}
          </div>
        ) : (
          <EmptyChart text="没有检测到明显数值异常点" />
        )}
      </article>

      <article className="panel rule-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">CHECK LOGIC</span>
            <h2>本次检查口径</h2>
          </div>
        </div>
        <div className="rule-list">
          <div>
            <span>缺失</span>
            <p>空白、NA、N/A、null、“-”等常见占位符</p>
          </div>
          <div>
            <span>重复</span>
            <p>所有字段完全相同的记录，业务主键重复需进一步判断</p>
          </div>
          <div>
            <span>异常值</span>
            <p>使用 1.5 × IQR 规则，属于统计预警而非业务定论</p>
          </div>
          <div>
            <span>相关性</span>
            <p>使用 Pearson 系数，仅衡量线性关系，不代表因果</p>
          </div>
        </div>
      </article>
    </div>
  );
}

function RelationsView({ analysis }: { analysis: AnalysisResult }) {
  const strongest = analysis.correlations.slice(0, 12);
  return (
    <div className="relation-grid">
      <article className="panel relation-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">CORRELATION</span>
            <h2>数值关系</h2>
            <p>按绝对相关系数从高到低排列。</p>
          </div>
        </div>
        {strongest.length ? (
          <div className="correlation-list">
            {strongest.map((item) => (
              <div className="correlation-row" key={`${item.left}-${item.right}`}>
                <div>
                  <strong>{item.left}</strong>
                  <span>×</span>
                  <strong>{item.right}</strong>
                </div>
                <div className="correlation-meter">
                  <span
                    className={item.value < 0 ? "is-negative" : ""}
                    style={{ width: `${Math.abs(item.value) * 100}%` }}
                  />
                </div>
                <b>{item.value.toFixed(2)}</b>
              </div>
            ))}
          </div>
        ) : (
          <EmptyChart text="至少需要两个有变化的数值字段" />
        )}
      </article>

      <article className="panel relation-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">GROUP COMPARISON</span>
            <h2>
              {analysis.segment
                ? `${analysis.segment.categoryColumn} × ${analysis.segment.metricColumn}`
                : "分组对比"}
            </h2>
          </div>
        </div>
        <SegmentChart analysis={analysis} />
      </article>

      <article className="panel relation-panel relation-panel--wide">
        <div className="panel-heading">
          <div>
            <span className="section-index">TIME SERIES</span>
            <h2>
              {analysis.trend
                ? `${analysis.trend.metricColumn} 随时间变化`
                : "时间趋势"}
            </h2>
          </div>
        </div>
        <TrendBars analysis={analysis} />
      </article>
    </div>
  );
}

function PreviewView({ analysis }: { analysis: AnalysisResult }) {
  const columns = analysis.columns.slice(0, 12);
  const rows = analysis.rows.slice(0, 40);
  return (
    <section className="panel content-panel preview-panel">
      <div className="panel-heading">
        <div>
          <span className="section-index">DATA PREVIEW</span>
          <h2>原始数据预览</h2>
          <p>展示前 40 行、前 12 个字段；空值统一显示为“—”。</p>
        </div>
        <span className="data-badge">
          {analysis.rowCount.toLocaleString()} × {analysis.columnCount}
        </span>
      </div>
      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>#</th>
              {columns.map((column) => (
                <th key={column.name}>{column.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                {columns.map((column) => (
                  <td key={column.name} title={displayCell(row[column.name])}>
                    {displayCell(row[column.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AskAgent({ analysis }: { analysis: AnalysisResult }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(() =>
    createAgentAnswer("最值得关注什么", analysis),
  );
  const suggestions = ["缺失值主要在哪？", "有哪些异常值？", "字段之间有什么关系？"];

  function ask(value: string) {
    const next = value.trim();
    if (!next) return;
    setQuestion(next);
    setAnswer(createAgentAnswer(next, analysis));
  }

  return (
    <section className="ask-agent">
      <div className="ask-agent-mark">
        <Sparkles size={19} />
      </div>
      <div className="ask-agent-main">
        <span className="section-index">ASK THE DATA</span>
        <h2>继续问这份数据</h2>
        <p className="agent-answer">{answer}</p>
        <div className="suggestion-row">
          {suggestions.map((item) => (
            <button onClick={() => ask(item)} type="button" key={item}>
              {item}
            </button>
          ))}
        </div>
        <form
          className="agent-form"
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例如：哪一组表现最好？"
            aria-label="向数据提问"
          />
          <button type="submit" aria-label="发送问题">
            <Send size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}

export default function Home() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const analysis = useMemo(() => {
    if (!workbook?.sheets[selectedSheet]) return null;
    const sheet = workbook.sheets[selectedSheet];
    return analyzeRows(sheet.rows, workbook.fileName, sheet.name);
  }, [workbook, selectedSheet]);

  async function handleFile(file: File) {
    setError("");
    if (!/\.(xlsx|xls|csv|tsv)$/i.test(file.name)) {
      setError("暂不支持这个文件格式，请上传 Excel、CSV 或 TSV。");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("文件超过 30 MB，建议先拆分或精简后再分析。");
      return;
    }
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        dense: true,
      });
      const sheets = parsed.SheetNames.map((name) => {
        const rows = XLSX.utils
          .sheet_to_json<DataRow>(parsed.Sheets[name], {
            defval: null,
            raw: true,
          })
          .filter((row) => Object.values(row).some((value) => !isMissing(value)));
        return { name, rows };
      }).filter((sheet) => sheet.rows.length);
      if (!sheets.length) {
        throw new Error("empty");
      }
      setWorkbook({
        fileName: file.name,
        fileSize: file.size,
        sheets,
      });
      setSelectedSheet(0);
      setActiveTab("overview");
    } catch {
      setError("没有成功读取这个文件，请确认表格未损坏且第一行包含字段名。");
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setWorkbook({
      fileName: "业务经营示例.xlsx",
      sheets: [{ name: "经营数据", rows: createDemoRows() }],
    });
    setSelectedSheet(0);
    setActiveTab("overview");
    setError("");
  }

  function reset() {
    setWorkbook(null);
    setSelectedSheet(0);
    setActiveTab("overview");
    setError("");
    setCopied(false);
  }

  function summaryText() {
    if (!analysis) return "";
    return [
      `《${analysis.fileName}》自动分析结论`,
      `数据规模：${analysis.rowCount.toLocaleString()} 行 × ${analysis.columnCount} 列；完整度 ${percent(analysis.completeness)}；重复 ${analysis.duplicateCount.toLocaleString()} 行。`,
      ...analysis.insights.map(
        (insight, index) =>
          `${index + 1}. ${insight.title}：${insight.detail} 建议：${insight.action}`,
      ),
    ].join("\n");
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadReport() {
    if (!analysis) return;
    const report = [
      `# ${analysis.fileName} · 自动数据分析报告`,
      "",
      `- 工作表：${analysis.sheetName}`,
      `- 数据规模：${analysis.rowCount.toLocaleString()} 行 × ${analysis.columnCount} 列`,
      `- 整体完整度：${percent(analysis.completeness)}`,
      `- 完全重复：${analysis.duplicateCount.toLocaleString()} 行（${percent(analysis.duplicateRate)}）`,
      `- 数据健康度：${analysis.qualityScore}/100`,
      "",
      "## 核心结论",
      ...analysis.insights.flatMap((insight, index) => [
        "",
        `### ${index + 1}. ${insight.title}`,
        insight.detail,
        `建议：${insight.action}`,
      ]),
      "",
      "## 字段概览",
      "| 字段 | 类型 | 缺失率 | 唯一值 |",
      "|---|---:|---:|---:|",
      ...analysis.columns.map(
        (column) =>
          `| ${column.name.replace(/\|/g, "\\|")} | ${kindLabels[column.kind]} | ${percent(column.missingRate)} | ${column.uniqueCount.toLocaleString()} |`,
      ),
      "",
      "> 本报告由 Data Lumen 在浏览器本地自动生成。统计异常不等于业务异常，使用前请核验业务口径。",
    ].join("\n");
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${analysis.fileName.replace(/\.[^.]+$/, "")}_分析报告.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={analysis ? "app app--analysis" : "app"}>
      <header className="topbar">
        <button className="brand" onClick={reset} type="button" aria-label="回到首页">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Data Lumen</strong>
            <small>VISUAL ANALYSIS AGENT</small>
          </span>
        </button>
        <div className="topbar-status">
          <span>
            <ShieldCheck size={14} />
            浏览器本地分析
          </span>
          {analysis ? (
            <button onClick={downloadReport} type="button">
              <Download size={15} />
              下载报告
            </button>
          ) : (
            <span className="topbar-version">BETA / 01</span>
          )}
        </div>
      </header>

      {!analysis ? (
        <UploadPanel
          onFile={handleFile}
          onDemo={loadDemo}
          loading={loading}
          error={error}
        />
      ) : (
        <div className="analysis-shell">
          <aside className="sidebar">
            <div className="file-card">
              <span className="file-card-icon">
                <FileSpreadsheet size={18} />
              </span>
              <div>
                <strong title={workbook?.fileName}>{workbook?.fileName}</strong>
                <span>
                  {formatBytes(workbook?.fileSize)} · {workbook?.sheets.length} 个工作表
                </span>
              </div>
            </div>
            {workbook && workbook.sheets.length > 1 ? (
              <label className="sheet-select">
                <span>当前工作表</span>
                <select
                  value={selectedSheet}
                  onChange={(event) => setSelectedSheet(Number(event.target.value))}
                >
                  {workbook.sheets.map((sheet, index) => (
                    <option value={index} key={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            ) : null}
            <nav className="sidebar-nav" aria-label="分析模块">
              {tabItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={activeTab === item.id ? "is-active" : ""}
                    onClick={() => setActiveTab(item.id)}
                    type="button"
                    key={item.id}
                  >
                    <Icon size={16} />
                    {item.label}
                    <ArrowRight size={13} />
                  </button>
                );
              })}
            </nav>
            <div className="sidebar-meta">
              <span>分析进度</span>
              <div>
                <i />
                <i />
                <i />
                <i />
              </div>
              <small>
                <Check size={12} />
                自动分析完成
              </small>
            </div>
            <button className="new-analysis" onClick={reset} type="button">
              <RefreshCcw size={15} />
              分析另一份表格
            </button>
          </aside>

          <section className="workspace">
            <div className="workspace-heading">
              <div>
                <span className="workspace-kicker">
                  <span />
                  ANALYSIS COMPLETE
                </span>
                <h1>{analysis.sheetName}</h1>
                <p>
                  已扫描 {analysis.analyzedRowCount.toLocaleString()} 行数据，
                  自动生成 {analysis.insights.length} 条核心结论。
                </p>
              </div>
              <div className="workspace-actions">
                <button onClick={copySummary} type="button">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "已复制" : "复制结论"}
                </button>
                <button className="workspace-action--solid" onClick={downloadReport} type="button">
                  <Download size={15} />
                  导出报告
                </button>
              </div>
            </div>

            <div className="mobile-tabs">
              {tabItems.map((item) => (
                <button
                  className={activeTab === item.id ? "is-active" : ""}
                  onClick={() => setActiveTab(item.id)}
                  type="button"
                  key={item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" ? (
              <Overview
                analysis={analysis}
                onCopy={copySummary}
                copied={copied}
              />
            ) : null}
            {activeTab === "fields" ? <FieldsView analysis={analysis} /> : null}
            {activeTab === "quality" ? <QualityView analysis={analysis} /> : null}
            {activeTab === "relations" ? (
              <RelationsView analysis={analysis} />
            ) : null}
            {activeTab === "preview" ? <PreviewView analysis={analysis} /> : null}

            <AskAgent analysis={analysis} />
            <footer className="analysis-footer">
              <span>
                <CircleHelp size={14} />
                自动结果用于快速发现问题，不替代业务口径确认
              </span>
              <span>DATA LUMEN / 2026</span>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
