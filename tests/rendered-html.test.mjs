import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the family nutrition product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>禾味日历｜家庭营养菜单<\/title>/i);
  assert.match(html, /家庭营养管家/);
  assert.match(html, /一日三餐/);
  assert.match(html, /今日餐单/);
  assert.match(html, /本机保存/);
  assert.match(html, /手工新建菜谱/);
  assert.doesNotMatch(html, /拍照|拍食材|选择照片/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("includes installable PWA metadata", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /theme-color/i);
  assert.match(html, /lang="zh-CN"/i);
});
