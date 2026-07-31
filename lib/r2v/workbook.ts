import type { DataRow } from "../analysis";

export type SheetData = {
  name: string;
  rows: DataRow[];
};

export type WorkbookData = {
  fileName: string;
  fileSize?: number;
  sheets: SheetData[];
};

export type UploadProgress = {
  fileName: string;
  percent: number;
  stage:
    | "已收到文件"
    | "正在读取文件"
    | "正在解析工作表"
    | "正在整理字段与答案"
    | "正在生成分析"
    | "解析完成";
};

type ProgressReporter = (
  progress: UploadProgress,
) => void | Promise<void>;

function isEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export async function parseR2VWorkbookFile(
  file: File,
  onProgress?: ProgressReporter,
): Promise<WorkbookData> {
  const report = async (
    percent: number,
    stage: UploadProgress["stage"],
  ) => {
    await onProgress?.({ fileName: file.name, percent, stage });
  };

  await report(8, "已收到文件");
  const XLSX = await import("xlsx");

  await report(24, "正在读取文件");
  const buffer = await file.arrayBuffer();

  await report(52, "正在解析工作表");
  const parsed = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dense: true,
    raw: true,
  });

  await report(78, "正在整理字段与答案");
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

  await report(96, "正在生成分析");
  if (!sheets.length) throw new Error("empty");

  await report(100, "解析完成");
  return {
    fileName: file.name,
    fileSize: file.size,
    sheets,
  };
}
