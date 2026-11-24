import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { handleRequest } from "./app.mjs";

const server = createServer(handleRequest);
let endpoint;

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  endpoint = `http://127.0.0.1:${server.address().port}/api/triage`;
});
after(() => new Promise((resolve) => server.close(resolve)));

async function post(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: response.status, body: await response.json() };
}

for (const body of ["", "{", "null", "{}", '{"text":42}', '{"text":""}', '{"text":"  "}']) {
  test(`неверный ввод ${JSON.stringify(body)}`, async () => {
    assert.deepEqual(await post(body), { status: 400, body: { status: "invalid_input" } });
  });
}

for (const [text, topic] of [["Когда доставка?", "delivery"], ["Какая цена?", "pricing"], ["Здравствуйте", "other"]]) {
  test(`готовый черновик для темы ${topic}`, async () => {
    const result = await post(JSON.stringify({ text }));
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "ready");
    assert.equal(result.body.topic, topic);
    assert.match(result.body.draft, /\S/);
  });
}

for (const text of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft]", "[timeout]"]) {
  test(`ручной разбор при ${text}`, async () => {
    const start = performance.now();
    const result = await post(JSON.stringify({ text }));
    const elapsed = performance.now() - start;
    assert.deepEqual(result, { status: 200, body: { status: "manual_review", topic: null, draft: null } });
    if (text === "[timeout]") assert.ok(elapsed < 1000, `Ответ занял ${elapsed} мс`);
  });
}
