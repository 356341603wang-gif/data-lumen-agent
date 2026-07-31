import type { CellStats, DimensionStats } from "./types.ts";

export type DimensionAction = {
  level: "priority" | "watch" | "stable";
  label: "优先对齐" | "建议关注" | "相对稳定";
};

export function dimensionAction(item: DimensionStats): DimensionAction {
  if (item.severeDisagreementRate >= 0.5) {
    return { level: "priority", label: "优先对齐" };
  }
  if (item.severeDisagreementRate > 0) {
    return { level: "watch", label: "建议关注" };
  }
  return { level: "stable", label: "相对稳定" };
}

export function dimensionDiagnosis(item: DimensionStats): string {
  if (item.severeCellCount > 0) {
    const action =
      item.severeDisagreementRate >= 0.5
        ? "需要优先统一判断边界"
        : "建议抽取这些题目统一判断边界";
    return `${item.validCellCount} 个有效题目单元中，${item.severeCellCount} 个没有形成稳定多数意见，${action}。`;
  }
  if (item.disputedCellCount > 0) {
    return `${item.validCellCount} 个有效题目单元中，${item.disputedCellCount} 个出现一般分歧，但多数意见仍相对稳定。`;
  }
  return `${item.validCellCount} 个有效题目单元目前都形成了稳定意见，可暂不作为对齐重点。`;
}

export function dimensionQuestionKeys(
  cells: CellStats[],
  dimensionId: string,
): string[] {
  const dimensionCells = cells.filter(
    (cell) => cell.dimensionId === dimensionId,
  );
  const selectedCells = dimensionCells.some((cell) => cell.severe)
    ? dimensionCells.filter((cell) => cell.severe)
    : dimensionCells.filter((cell) => cell.hasDisagreement);
  return [...new Set(selectedCells.map((cell) => cell.questionKey))];
}
