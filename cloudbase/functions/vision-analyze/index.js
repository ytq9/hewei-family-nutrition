const tcb = require("@cloudbase/node-sdk");
const { z } = require("zod");

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
const db = app.database();

const responseSchema = z.object({
  photoType: z.enum(["ingredients", "nutrition_label", "mixed", "unknown"]),
  candidates: z.array(z.object({
    name: z.string().min(1),
    confidence: z.number().min(0).max(1),
    state: z.enum(["raw", "cooked", "packaged"]),
    visibleWeightG: z.number().positive().nullable(),
  })).max(12),
  labelNutritionPer100g: z.object({
    energyKcal: z.number().nonnegative().nullable(),
    proteinG: z.number().nonnegative().nullable(),
    fatG: z.number().nonnegative().nullable(),
    carbohydrateG: z.number().nonnegative().nullable(),
    sodiumMg: z.number().nonnegative().nullable(),
  }).nullable(),
  warnings: z.array(z.string()).max(8),
});

async function currentHousehold(uid) {
  const memberships = (await db.collection("memberships").where({ uid, status: "active" }).limit(1).get()).data;
  if (!memberships.length) throw new Error("NO_HOUSEHOLD");
  return memberships[0].householdId;
}

async function enforceQuota(householdId) {
  const day = new Date().toISOString().slice(0, 10);
  const limit = Number(process.env.AI_DAILY_LIMIT_PER_HOUSEHOLD || 20);
  const records = (await db.collection("aiUsage").where({ householdId, day }).limit(1).get()).data;
  const current = records[0];
  if ((current?.count || 0) >= limit) throw new Error("DAILY_LIMIT_REACHED");
  if (current) await db.collection("aiUsage").doc(current._id).update({ count: current.count + 1, updatedAt: new Date().toISOString() });
  else await db.collection("aiUsage").add({ householdId, day, count: 1, createdAt: new Date().toISOString() });
}

exports.main = async (event) => {
  try {
    const { uid } = app.auth().getUserInfo();
    if (!uid) throw new Error("UNAUTHENTICATED");
    const payload = z.object({ fileIds: z.array(z.string().min(1)).min(1).max(3) }).parse(event);
    const householdId = await currentHousehold(uid);
    await enforceQuota(householdId);
    const apiKey = process.env.TOKENHUB_API_KEY;
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
    const tempUrls = await app.getTempFileURL({ fileList: payload.fileIds });
    const images = tempUrls.fileList.map((item) => ({ type: "image_url", image_url: { url: item.tempFileURL } }));
    const prompt = [
      "你是食材与包装营养标签识别助手。只描述图片中有视觉证据的内容。",
      "重量只有在包装净含量或秤读数清晰可见时才可填写，否则必须为 null。",
      "不要给医学建议。输出严格 JSON，不使用 Markdown。",
      "结构：{photoType,candidates:[{name,confidence,state,visibleWeightG}],labelNutritionPer100g:{energyKcal,proteinG,fatG,carbohydrateG,sodiumMg}|null,warnings:[]}",
    ].join("\n");
    const response = await fetch("https://tokenhub.tencentmaas.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.VISION_MODEL_ID || "Tencent-HY-Vision1.5-Instruct",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...images] }],
      }),
    });
    if (!response.ok) throw new Error("AI_PROVIDER_ERROR");
    const raw = await response.json();
    const content = raw.choices?.[0]?.message?.content;
    const result = responseSchema.parse(JSON.parse(content));
    await db.collection("mediaAnalysisJobs").add({ householdId, uid, fileIds: payload.fileIds, status: "completed", candidateCount: result.candidates.length, createdAt: new Date().toISOString() });
    return { ok: true, data: result };
  } catch (error) {
    console.error("vision-analyze", { message: error.message });
    return { ok: false, code: error.message, error: error.message === "DAILY_LIMIT_REACHED" ? "今日识别次数已用完，请手工录入" : "图片识别未完成，请手工录入" };
  }
};
