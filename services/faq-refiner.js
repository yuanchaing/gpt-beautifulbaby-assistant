// services/faq-refiner.js
import fetch from "node-fetch";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

/**
 * 使用 GPT 對 FAQ 原始回答進行人設潤飾（無任何字數限制）
 * @param {object} options
 * @param {string} options.question 使用者問題
 * @param {string} options.rawAnswer FAQ 原始回答內容
 * @returns {Promise<string>} 潤飾後的文字
 */
export async function refineWithPersona({ question, rawAnswer }) {
  if (!OPENAI_API_KEY) return rawAnswer;

  const systemPrompt = [
    "你是一位友善、專業的中文客服助理，負責將 FAQ 原始回答潤飾成自然、有條理、親切的文字。",
    "請保持所有內容完整，不可刪減任何資訊，也不可省略品牌或細節。",
    "若內容包含多個品牌或條列項，請使用清晰的段落與標題符號（如 emoji、項目符號）呈現。",
    "請以繁體中文回答，不使用英文標點，不添加多餘結尾詞。",
  ].join("\n");

  const userPrompt = [
    `使用者問題：${question}`,
    "",
    "以下是 FAQ 原始內容，請保持資訊完整但優化排版與語氣：",
    "",
    rawAnswer
  ].join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.4, // 自然但不跑題
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
    // ❌ 不加 max_tokens：讓 gpt-4o 自行生成完整內容（支援 128k）
  };

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      throw new Error(`OpenAI API error ${resp.status} ${msg}`);
    }

    const data = await resp.json();
    return data?.choices?.[0]?.message?.content?.trim() || rawAnswer;
  } catch (err) {
    console.error("❌ refineWithPersona error:", err.message);
    return rawAnswer;
  }
}
