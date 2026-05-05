/* Client-side helpers for calling the /api/anthropic proxy.
 *
 * The proxy adds the ANTHROPIC_API_KEY server-side, so the browser never
 * sees the key. If the key is missing on the server, the proxy returns
 * an error and these helpers surface a friendly message.
 */

const PROXY_URL = "/api/anthropic";

export class AIKeyMissingError extends Error {
  constructor(msg) {
    super(msg || "AI features require API key configuration");
    this.name = "AIKeyMissingError";
    this.userMessage = "AI features require API key configuration";
  }
}

async function callProxy({ messages, system, model, max_tokens, temperature }) {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, model, max_tokens, temperature }),
  });
  if (res.status === 500) {
    const j = await res.json().catch(() => ({}));
    if (j?.error?.includes("ANTHROPIC_API_KEY")) throw new AIKeyMissingError(j.error);
    throw new Error(j.error || "AI request failed");
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error?.message || j.error || `AI request failed (${res.status})`);
  }
  const data = await res.json();
  // Anthropic returns content as an array of blocks; pick the first text block.
  const text = data?.content?.find?.(b => b.type === "text")?.text || "";
  return { text, raw: data };
}

/** Extracts the first valid JSON object/array out of a model response. */
export function extractJson(text) {
  if (!text) return null;
  // Try direct parse
  try { return JSON.parse(text); } catch (e) { /* try fenced */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch (e) { /* fall through */ }
  }
  // Find first { ... } or [ ... ]
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch (error) { console.error('[aiClient:extractJson:obj]', error); } }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch (error) { console.error('[aiClient:extractJson:arr]', error); } }
  return null;
}

/** Generate a professional bullet-point job description. */
export async function generateJobDescription(shortInput) {
  const system = `You are an expert construction project manager writing crew-facing work orders for Icon Remodeling Group.
Output a clean, professional, bullet-point job description. Each bullet must start with "• " and be one concise instruction.
No preamble, no closing remarks — only bullets, ready to paste into a work order.`;
  const { text } = await callProxy({
    system,
    messages: [{ role: "user", content: `Job: ${shortInput}\n\nWrite the job description as bullet points.` }],
    max_tokens: 800, temperature: 0.5,
  });
  return text.trim();
}

/** Suggest a materials list for a given job description. */
export async function suggestMaterials(jobDescription) {
  const system = `You are a construction materials specialist for Icon Remodeling Group.
Given a job description, output a complete, professional materials list as bullets.
Each bullet starts with "• " and includes: product name, brand if obvious, specs (size/grade/type), and quantity with proper unit (each, box, bag, sheet, LF, SF, gallon, lb).
No preamble — only the bullet list.`;
  const { text } = await callProxy({
    system,
    messages: [{ role: "user", content: `Job description:\n${jobDescription}\n\nList materials needed.` }],
    max_tokens: 1000, temperature: 0.4,
  });
  return text.trim();
}

/** Convert a spoken transcript into work-order field JSON. */
export async function voiceToOrder(transcript) {
  const system = `You extract work order details from a manager's spoken input.
Return ONLY a JSON object (no markdown, no commentary) with these keys:
{
  "crewName": string|null,
  "members": string[],
  "customerName": string|null,
  "customerPhone": string|null,
  "jobAddress": string|null,
  "jobDescription": string|null,
  "materials": string|null,
  "specialNotes": string|null,
  "date": string|null
}
If a field isn't mentioned, use null. jobDescription and materials should be bullet text starting with "• ".`;
  const { text } = await callProxy({
    system,
    messages: [{ role: "user", content: transcript }],
    max_tokens: 1200, temperature: 0.2,
  });
  return extractJson(text) || {};
}

/** Process a field-submitted materials request into a professional list. */
export async function enhanceMaterialsRequest(originalLineItems) {
  const system = `You are a construction materials specialist.
Review these field-submitted material requests and generate a precise, professional materials list.
For each item include: exact product name, brand if determinable, specifications (dimensions, grade, type), quantity with proper unit.
If you are uncertain about any item, set "uncertain": true and add a "note" explaining why.

Return ONLY a JSON array — no markdown, no commentary. Each element must be:
{ "description": string, "quantity": number, "unit": string, "uncertain": boolean, "note": string }`;
  const userMsg = `Field-submitted items:\n${JSON.stringify(originalLineItems, null, 2)}`;
  const { text } = await callProxy({
    system,
    messages: [{ role: "user", content: userMsg }],
    max_tokens: 2000, temperature: 0.3,
  });
  const parsed = extractJson(text);
  return Array.isArray(parsed) ? parsed : [];
}
