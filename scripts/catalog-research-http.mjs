import { createRequire } from "node:module";
const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const cache = new Map();
const escapeHtml = text => text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const fetchResearchResource = async (url, {fetchImpl = fetch, maxBytes = 8_000_000, timeoutMs = 12_000} = {}) => {
  if (!["http:","https:"].includes(new URL(url).protocol)) throw new Error("Source URL must use HTTP(S)");
  const response = await fetchImpl(url, {signal:AbortSignal.timeout(timeoutMs), headers:{"user-agent":"PaceYourself-CatalogResearch/2.0"}});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); throw new Error(`${url}: source exceeds ${maxBytes} bytes`); }
  const reader = response.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) {
    try {
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); throw new Error(`${url}: source exceeds ${maxBytes} bytes`); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
  }
  const buffer = Buffer.concat(chunks);
  const type = response.headers.get("content-type") || "";
  let html;
  if (type.includes("pdf") || buffer.subarray(0,5).toString() === "%PDF-") {
    const parsePdf = requireWeb("pdf-parse/lib/pdf-parse.js");
    const parsed = await parsePdf(buffer, {max:100});
    html = `<article>${escapeHtml(parsed.text).replace(/\n/g,"</p><p>")}</article>`;
  } else if (/image\/|audio\/|video\//i.test(type)) throw new Error(`${url}: unsupported content type ${type}`);
  else html = buffer.toString("utf8");
  return {url:response.url || url, html, content_type:type, bytes:size, fetched_at:new Date().toISOString()};
};
export const cachedResearchResource = async url => {
  if (!cache.has(url)) {
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(url, fetchResearchResource(url).catch(error => {cache.delete(url); throw error;}));
  }
  return cache.get(url);
};
