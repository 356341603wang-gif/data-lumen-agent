import { getDimensionRule } from "./profiles.ts";
import type {
  CanonicalAnswer,
  KnownTaskType,
  NormalizedSubmission,
} from "./types";

export interface ReasonCluster {
  label: string;
  count: number;
  rate: number;
  examples: Array<{ questionKey: string; reason: string }>;
}

export interface ReasonSummary {
  taskType: KnownTaskType;
  dimensionId: string;
  dimensionLabel: string;
  answer: CanonicalAnswer;
  reasonCount: number;
  questionCount: number;
  clusters: ReasonCluster[];
}

interface KeywordCluster {
  label: string;
  keywords: string[];
}

const KEYWORDS: Record<KnownTaskType, KeywordCluster[]> = {
  audio: [
    {
      label: "声线与音高",
      keywords: ["声线", "音高", "音域", "高音", "低音", "厚度", "响亮"],
    },
    {
      label: "音色细节",
      keywords: ["气声", "沙哑", "颗粒", "鼻音", "闭合", "气息"],
    },
    {
      label: "方言与吐字",
      keywords: ["方言", "口音", "语种", "吐字", "平翘舌", "鼻音", "儿化"],
    },
    {
      label: "情绪与强度",
      keywords: ["情绪", "开心", "愤怒", "悲伤", "平静", "强烈", "轻微"],
    },
    {
      label: "节奏与语调",
      keywords: ["节奏", "语调", "语速", "重音", "停顿", "句末", "抑扬顿挫"],
    },
    {
      label: "环境与声场",
      keywords: ["环境", "声场", "噪声", "底噪", "混响", "回声", "室内", "室外"],
    },
    {
      label: "使用场景",
      keywords: ["场景", "语气", "气质", "直播", "新闻", "角色"],
    },
    {
      label: "同源与内容重叠",
      keywords: ["同源", "同一句", "同段", "重叠", "前后段", "背景连续", "截取"],
    },
  ],
  scene: [
    {
      label: "空间与布局",
      keywords: ["空间", "布局", "结构", "位置关系", "连通"],
    },
    {
      label: "场景锚点",
      keywords: ["锚点", "建筑", "门", "窗", "家具", "地标"],
    },
    {
      label: "视角变化",
      keywords: ["视角", "角度", "俯视", "仰视", "正面", "侧面"],
    },
    {
      label: "场景状态",
      keywords: ["状态", "光照", "天气", "时间", "开关", "变化"],
    },
    {
      label: "主体构成",
      keywords: ["主体", "人物", "物体", "构成", "增减", "遮挡"],
    },
    {
      label: "覆盖范围",
      keywords: ["覆盖", "范围", "局部", "全景", "信息量"],
    },
  ],
  object: [
    {
      label: "形状与结构",
      keywords: ["形状", "结构", "轮廓", "款式", "部件"],
    },
    {
      label: "文字与 Logo",
      keywords: ["文字", "logo", "品牌", "包装", "标识"],
    },
    {
      label: "图案差异",
      keywords: ["图案", "花纹", "纹样", "印花"],
    },
    {
      label: "材质与纹理",
      keywords: ["材质", "纹理", "金属", "塑料", "木质", "布料"],
    },
    {
      label: "颜色差异",
      keywords: ["颜色", "色差", "色调", "明暗", "饱和"],
    },
    {
      label: "镜头与环境",
      keywords: ["镜头", "角度", "环境", "光线", "景别"],
    },
    {
      label: "遮挡与覆盖",
      keywords: ["遮挡", "覆盖", "缺失", "只看到", "局部"],
    },
    {
      label: "清晰度与细节",
      keywords: ["清晰", "模糊", "细节", "分辨率", "精细"],
    },
  ],
};

function clusterLabel(taskType: KnownTaskType, reason: string): string {
  const normalized = reason.toLowerCase();
  return (
    KEYWORDS[taskType].find((cluster) =>
      cluster.keywords.some((keyword) => normalized.includes(keyword)),
    )?.label ?? "其他具体判断"
  );
}

export function summarizeReasons(
  submissions: NormalizedSubmission[],
): ReasonSummary[] {
  const groups = new Map<
    string,
    {
      taskType: KnownTaskType;
      dimensionId: string;
      answer: CanonicalAnswer;
      entries: Array<{ questionKey: string; reason: string }>;
    }
  >();

  submissions
    .filter((submission) => submission.completed && !submission.abandoned)
    .forEach((submission) => {
      submission.dimensions.forEach((dimension) => {
        const reason = dimension.reason?.trim();
        if (!reason) return;
        const key = [
          submission.taskType,
          dimension.dimensionId,
          dimension.answer,
        ].join("::");
        const group = groups.get(key) ?? {
          taskType: submission.taskType,
          dimensionId: dimension.dimensionId,
          answer: dimension.answer,
          entries: [],
        };
        group.entries.push({ questionKey: submission.questionKey, reason });
        groups.set(key, group);
      });
    });

  return [...groups.values()]
    .map((group) => {
      const clusters = new Map<
        string,
        Array<{ questionKey: string; reason: string }>
      >();
      group.entries.forEach((entry) => {
        const label = clusterLabel(group.taskType, entry.reason);
        clusters.set(label, [...(clusters.get(label) ?? []), entry]);
      });
      return {
        taskType: group.taskType,
        dimensionId: group.dimensionId,
        dimensionLabel:
          getDimensionRule(group.taskType, group.dimensionId)?.label ??
          group.dimensionId,
        answer: group.answer,
        reasonCount: group.entries.length,
        questionCount: new Set(group.entries.map((entry) => entry.questionKey))
          .size,
        clusters: [...clusters.entries()]
          .map(([label, entries]) => ({
            label,
            count: entries.length,
            rate: entries.length / group.entries.length,
            examples: entries.slice(0, 3),
          }))
          .sort(
            (left, right) =>
              right.count - left.count ||
              left.label.localeCompare(right.label, "zh-CN"),
          ),
      };
    })
    .sort(
      (left, right) =>
        right.reasonCount - left.reasonCount ||
        left.dimensionLabel.localeCompare(right.dimensionLabel, "zh-CN") ||
        left.answer.localeCompare(right.answer),
    );
}

