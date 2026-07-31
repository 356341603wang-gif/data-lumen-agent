"use client";

import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { DataRow } from "../lib/analysis";
import { analyzeR2VRows } from "../lib/r2v/analyze.ts";
import { createR2VDemoRows } from "../lib/r2v/demo.ts";
import {
  createAnnotatorCsv,
  createConflictCsv,
  createDimensionCsv,
  createQuestionCsv,
  createR2VMarkdownReport,
  createReasonCsv,
} from "../lib/r2v/export.ts";
import type { KnownTaskType } from "../lib/r2v/types.ts";
import { R2VDashboard } from "./r2v/R2VDashboard";

type SheetData = {
  name: string;
  rows: DataRow[];
};

type WorkbookData = {
  fileName: string;
  fileSize?: number;
  sheets: SheetData[];
};

type ExportKind =
  | "report"
  | "dimensions"
  | "questions"
  | "reasons"
  | "conflicts"
  | "annotators";

function isEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}
function formatBytes(bytes?: number) {
  if (!bytes) return "内置示例";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function downloadText(
  content: string,
  fileName: string,
  type: string,
  withBom = false,
) {
  const blob = new Blob([withBom ? "\uFEFF" : "", content], {
    type: `${type};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function UploadStage({
  loading,
  error,
  onFile,
  onDemo,
}: {
  loading: boolean;
  error: string;
  onFile: (file: File) => void;
  onDemo: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <main className="upload-page">
      <header className="upload-topbar">
        <button
          className="upload-brand"
          onClick={() => window.location.reload()}
          type="button"
        >
          <span className="upload-brand__mark">
            <i />
            <i />
            <i />
          </span>
          <span className="upload-brand__copy">
            <strong>R2V 标注分歧分析</strong>
            <small>Data Atelier</small>
          </span>
        </button>
        <div>
          <span>
            <ShieldCheck size={14} />
            浏览器本地分析
          </span>
          <span>物品 · 场景 · 音频</span>
        </div>
      </header>

      <section className="upload-hero">
        <div className="upload-copy">
          <span className="upload-index">01 / 把表格放上工作台</span>
          <h1>
            把分歧
            <br />
            变成可以<span>对齐</span>
            <br />
            的证据
          </h1>
          <p>
            自动识别物品、场景和音频标注结果。先告诉你哪里最值得讨论，再把每个结论追溯到答案、人员和原因。
          </p>
          <div className="upload-task-list">
            <span>
              <b>01</b>
              维度分歧
            </span>
            <span>
              <b>02</b>
              单题对齐
            </span>
            <span>
              <b>03</b>
              原因与规则
            </span>
            <span>
              <b>04</b>
              标注员抽检
            </span>
          </div>
        </div>

        <div
          className={`upload-dropzone upload-workbench ${
            dragging ? "upload-dropzone--dragging" : ""
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) setDragging(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) onFile(file);
          }}
        >
          <input
            accept=".xlsx,.xls,.csv,.tsv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.currentTarget.value = "";
            }}
            ref={inputRef}
            type="file"
          />
          <div className="upload-dropzone__meta">
            <span className="upload-workbench__signal">
              <i />
              Analysis ready
            </span>
            <span>Excel / CSV / TSV · 无需整理字段</span>
          </div>
          <div className="upload-orbit" aria-hidden="true">
            <span className="upload-orbit__ring" />
            <span className="upload-orbit__satellite" />
            <span className="upload-orbit__core">
              <FileSpreadsheet size={31} strokeWidth={1.35} />
            </span>
          </div>
          <h2>{loading ? "正在识别任务与答案…" : "把导出表格拖到这里"}</h2>
          <p>题目、标注员、REF、答案与原因会自动进入各自的证据轨道。</p>
          <button
            className="upload-primary"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <Upload size={16} />
            选择文件
            <ArrowRight size={15} />
          </button>
          <button className="upload-demo" onClick={onDemo} type="button">
            先看音频示例分析
          </button>
          {error ? <div className="upload-error">{error}</div> : null}
          <div className="upload-privacy">
            <LockKeyhole size={14} />
            文件只在你的浏览器中解析，不上传原始数据
          </div>
        </div>
      </section>

      <section className="upload-proof">
        <article>
          <CheckCircle2 size={17} />
          <div>
            <strong>无需字段确认</strong>
            <p>上传后直接进入分析；识别口径可查看，但不会阻断使用。</p>
          </div>
        </article>
        <article>
          <CheckCircle2 size={17} />
          <div>
            <strong>三类规则分开计算</strong>
            <p>物品、场景和音频保留各自的分数、维度与原因规则。</p>
          </div>
        </article>
        <article>
          <CheckCircle2 size={17} />
          <div>
            <strong>结论可以追溯</strong>
            <p>从榜单和热力图下钻到答案比例、标注员与原始原因。</p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default function Home() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [taskOverride, setTaskOverride] = useState<
    "auto" | KnownTaskType
  >("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analysisState = useMemo(() => {
    const sheet = workbook?.sheets[selectedSheet];
    if (!sheet || !workbook) return { analysis: null, error: "" };
    try {
      return {
        analysis: analyzeR2VRows(
          sheet.rows,
          workbook.fileName,
          taskOverride === "auto" ? undefined : taskOverride,
        ),
        error: "",
      };
    } catch (analysisError) {
      return {
        analysis: null,
        error:
          analysisError instanceof Error
            ? analysisError.message
            : "没有识别到 R2V 标注结构",
      };
    }
  }, [workbook, selectedSheet, taskOverride]);

  async function handleFile(file: File) {
    setError("");
    if (!/\.(xlsx|xls|csv|tsv)$/i.test(file.name)) {
      setError("暂不支持这个文件格式，请上传 Excel、CSV 或 TSV。");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("文件超过 30 MB，建议先拆分后再分析。");
      return;
    }
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const parsed = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        dense: true,
        raw: true,
      });
      const sheets = parsed.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils
          .sheet_to_json<DataRow>(parsed.Sheets[name], {
            defval: null,
            raw: true,
          })
          .filter((row) =>
            Object.values(row).some((value) => !isEmpty(value)),
          ),
      })).filter((sheet) => sheet.rows.length > 0);
      if (!sheets.length) throw new Error("empty");
      setWorkbook({
        fileName: file.name,
        fileSize: file.size,
        sheets,
      });
      setSelectedSheet(0);
      setTaskOverride("auto");
    } catch {
      setError("没有成功读取文件，请确认表格未损坏且第一行包含字段名。");
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setWorkbook({
      fileName: "R2V_音频标注分歧示例.csv",
      sheets: [{ name: "音频示例", rows: createR2VDemoRows() }],
    });
    setSelectedSheet(0);
    setTaskOverride("auto");
    setError("");
  }

  function reset() {
    setWorkbook(null);
    setSelectedSheet(0);
    setTaskOverride("auto");
    setError("");
  }

  function exportAnalysis(kind: ExportKind) {
    const analysis = analysisState.analysis;
    if (!analysis) return;
    const baseName = analysis.fileName.replace(/\.[^.]+$/, "");
    const exporters: Record<
      ExportKind,
      { content: string; suffix: string; mime: string; bom?: boolean }
    > = {
      report: {
        content: createR2VMarkdownReport(analysis),
        suffix: "完整分析报告.md",
        mime: "text/markdown",
      },
      dimensions: {
        content: createDimensionCsv(analysis),
        suffix: "维度分歧榜.csv",
        mime: "text/csv",
        bom: true,
      },
      questions: {
        content: createQuestionCsv(analysis),
        suffix: "单题分歧榜.csv",
        mime: "text/csv",
        bom: true,
      },
      reasons: {
        content: createReasonCsv(analysis),
        suffix: "原因汇总.csv",
        mime: "text/csv",
        bom: true,
      },
      conflicts: {
        content: createConflictCsv(analysis),
        suffix: "规则冲突.csv",
        mime: "text/csv",
        bom: true,
      },
      annotators: {
        content: createAnnotatorCsv(analysis),
        suffix: "标注员偏差.csv",
        mime: "text/csv",
        bom: true,
      },
    };
    const selected = exporters[kind];
    downloadText(
      selected.content,
      `${baseName}_${selected.suffix}`,
      selected.mime,
      selected.bom,
    );
  }

  if (!workbook) {
    return (
      <UploadStage
        error={error}
        loading={loading}
        onDemo={loadDemo}
        onFile={handleFile}
      />
    );
  }

  if (!analysisState.analysis) {
    return (
      <main className="unsupported-page">
        <header>
          <span>R2V 标注分歧分析 Agent</span>
          <button onClick={reset} type="button">
            换一个文件
          </button>
        </header>
        <section>
          <span className="upload-index">识别结果</span>
          <h1>这张工作表暂未识别为 R2V 标注任务</h1>
          <p>{analysisState.error}</p>
          <p>
            当前支持物品、场景和音频模板导出表。你也可以直接指定任务类型重新分析。
          </p>
          <div>
            {(["object", "scene", "audio"] as KnownTaskType[]).map(
              (taskType) => (
                <button
                  key={taskType}
                  onClick={() => setTaskOverride(taskType)}
                  type="button"
                >
                  按
                  {taskType === "object"
                    ? "物品"
                    : taskType === "scene"
                      ? "场景"
                      : "音频"}
                  规则分析
                </button>
              ),
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <R2VDashboard
      analysis={analysisState.analysis}
      onDownload={exportAnalysis}
      onReset={reset}
      onSheetChange={setSelectedSheet}
      onTaskOverride={setTaskOverride}
      selectedSheet={selectedSheet}
      sheetOptions={workbook.sheets.map(
        (sheet) => `${sheet.name} · ${formatBytes(workbook.fileSize)}`,
      )}
      taskOverride={taskOverride}
    />
  );
}
