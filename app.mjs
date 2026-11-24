import { readFile } from "node:fs/promises";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));
const topics = new Set(["delivery", "pricing", "other"]);
const manualReview = { status: "manual_review", topic: null, draft: null };

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleTriage(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let text;
  try {
    text = JSON.parse(Buffer.concat(chunks).toString("utf8"))?.text;
  } catch {
    return json(response, 400, { status: "invalid_input" });
  }
  if (typeof text !== "string" || !text.trim()) {
    return json(response, 400, { status: "invalid_input" });
  }

  let result = manualReview;
  try {
    const output = await classify(text, { signal: AbortSignal.timeout(300) });
    const { topic, draft } = JSON.parse(output);
    if (topics.has(topic) && typeof draft === "string" && draft.trim()) {
      result = { status: "ready", topic, draft };
    }
  } catch {
    // Ошибка имитатора, таймаут и битый JSON требуют ручного разбора.
  }
  return json(response, 200, result);
}

export async function handleRequest(request, response) {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/triage") {
    return json(response, 404, { status: "not_found" });
  }
  try {
    await handleTriage(request, response);
  } catch {
    json(response, 500, { status: "server_error" });
  }
}
