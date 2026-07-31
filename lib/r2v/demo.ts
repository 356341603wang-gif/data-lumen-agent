import type { DataRow } from "../analysis";

const WORKERS = Array.from({ length: 10 }, (_, index) =>
  `标注员${String(index + 1).padStart(2, "0")}`,
);

function audioAnswer(questionIndex: number, workerIndex: number) {
  let score = 3;
  let general = "NO";
  let tone = "HIGH_SIMILARITY";
  let environment = "HIGH_SIMILARITY";

  if (questionIndex === 0) {
    score = 5;
    general = workerIndex === 0 ? "NO" : "YES";
    tone = "YES";
    environment = workerIndex < 7 ? "YES" : "LOW_SIMILARITY";
  } else if (questionIndex === 1) {
    score = workerIndex < 6 ? 3 : 1;
    environment =
      workerIndex < 6 ? "HIGH_SIMILARITY" : "LOW_SIMILARITY";
  } else if (questionIndex === 2) {
    const toneAnswers = [
      "YES",
      "YES",
      "YES",
      "HIGH_SIMILARITY",
      "HIGH_SIMILARITY",
      "HIGH_SIMILARITY",
      "LOW_SIMILARITY",
      "LOW_SIMILARITY",
      "UNKNOWN",
      "UNKNOWN",
    ];
    tone = toneAnswers[workerIndex];
    score =
      tone === "YES" || tone === "HIGH_SIMILARITY"
        ? 3
        : tone === "LOW_SIMILARITY"
          ? 1
          : 0;
  } else {
    score = 3;
    tone = "HIGH_SIMILARITY";
    environment = "YES";
  }

  const toneReason =
    tone === "YES"
      ? "整体声线与音高一致，听感接近同一音色"
      : tone === "HIGH_SIMILARITY"
        ? "声线接近，音高范围相似，只有轻微气息差异"
        : tone === "LOW_SIMILARITY"
          ? "鼻音和声音厚度差异明显，只能判断为低相似"
          : "多人声或处理音效影响，无法稳定判断音色";

  return {
    targetClarityIntegrity: "YES",
    targetEmotionRange: "YES",
    targetValueScore: "HIGH",
    targetClarityIntegrityReason: "人声清晰，句子完整，没有过长留白",
    targetEmotionRangeReason: "情绪表达饱满，语调有自然起伏",
    refClarityIntegrityList: ["YES"],
    refClarityIntegrityReasonList: ["人声清晰，切分边界完整"],
    refEmotionRangeList: ["YES"],
    refEmotionRangeReasonList: ["情绪有自然起伏"],
    refValueScores: ["HIGH"],
    refGeneralConsistency: [general],
    refConsistencyScores: [score],
    refToneConsistency: [tone],
    refDialectConsistency: ["HIGH_SIMILARITY"],
    refEmotionConsistency: ["HIGH_SIMILARITY"],
    refStyleConsistency: ["HIGH_SIMILARITY"],
    refEnvironmentConsistency: [environment],
    refScenarioConsistency: ["HIGH_SIMILARITY"],
    refToneConsistencyReason: [toneReason],
  };
}

export function createR2VDemoRows(): DataRow[] {
  const completed: DataRow[] = [];
  for (let questionIndex = 0; questionIndex < 4; questionIndex += 1) {
    for (let workerIndex = 0; workerIndex < WORKERS.length; workerIndex += 1) {
      const uid = `audio-q${questionIndex + 1}`;
      completed.push({
        题目ID: `assignment-${questionIndex + 1}-${workerIndex + 1}`,
        uid,
        name: `音频示例 ${questionIndex + 1}`,
        target_video: `https://example.invalid/target-${questionIndex + 1}.wav`,
        ref_1: `https://example.invalid/ref-${questionIndex + 1}.wav`,
        "[标注]操作人": WORKERS[workerIndex],
        答案: JSON.stringify({
          item: { uid },
          data: audioAnswer(questionIndex, workerIndex),
          isAbandoned: false,
        }),
      });
    }
  }
  const unfinished = Array.from({ length: 4 }, (_, questionIndex) => ({
    题目ID: `pending-${questionIndex + 1}`,
    uid: `audio-q${questionIndex + 1}`,
    name: `音频示例 ${questionIndex + 1}`,
    target_video: `https://example.invalid/target-${questionIndex + 1}.wav`,
    ref_1: `https://example.invalid/ref-${questionIndex + 1}.wav`,
    "[标注]操作人": "待分配",
    答案: null,
  }));
  return [...completed, ...unfinished];
}

