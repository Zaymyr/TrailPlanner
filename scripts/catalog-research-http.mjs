import { createRequire } from "node:module";
import { lookup as dnsLookupNative } from "node:dns/promises";
import { isIP } from "node:net";
const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const cache = new Map();
const escapeHtml = text => text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const ipv4Blocked = address => {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value=>!Number.isInteger(value)||value<0||value>255)) return true;
  const [a,b] = octets;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)
    ||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===198&&(b===18||b===19));
};
const ipAddressBlocked = address => {
  const normalized = String(address).toLowerCase().split('%')[0];
  const version = isIP(normalized);
  if (version===4) return ipv4Blocked(normalized);
  if (version!==6) return true;
  if (normalized==='::'||normalized==='::1'||/^(?:0+:){7}0+$/.test(normalized)||/^(?:0+:){7}0*1$/.test(normalized)
    ||normalized.startsWith('::ffff:')||normalized.startsWith('fc')||normalized.startsWith('fd')||/^fe[89a-f]/.test(normalized)
    ||normalized.startsWith('ff')||normalized.startsWith('2001:db8:')) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? ipv4Blocked(mapped) : false;
};
export const validateResearchHttpUrl = async (value,{dnsLookup=null}={}) => {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${value}: invalid research URL`); }
  if (!["http:","https:"].includes(url.protocol)) throw new Error("Source URL must use HTTP(S)");
  if (url.username||url.password) throw new Error(`${url.href}: URL credentials are forbidden`);
  const hostname = url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if (!hostname||hostname==='localhost'||hostname.endsWith('.localhost')||hostname.endsWith('.local')) throw new Error(`${url.href}: private or local host is forbidden`);
  if (isIP(hostname)&&ipAddressBlocked(hostname)) throw new Error(`${url.href}: private, reserved or link-local address is forbidden`);
  if (dnsLookup&&!isIP(hostname)) {
    const resolved = await dnsLookup(hostname,{all:true,verbatim:true});
    const addresses = Array.isArray(resolved)?resolved:[resolved];
    if (!addresses.length||addresses.some(item=>ipAddressBlocked(item?.address||item))) throw new Error(`${url.href}: DNS resolves to a private, reserved or link-local address`);
  }
  return url;
};
export const fetchResearchResource = async (url, {fetchImpl = fetch, dnsLookup = fetchImpl === fetch ? dnsLookupNative : null,
  maxBytes = 8_000_000, timeoutMs = 12_000, maxRedirects = 5} = {}) => {
  let current = await validateResearchHttpUrl(url,{dnsLookup});
  let response;
  for (let redirectCount=0;redirectCount<=maxRedirects;redirectCount+=1) {
    response = await fetchImpl(current.href, {redirect:"manual",signal:AbortSignal.timeout(timeoutMs), headers:{"user-agent":"PaceYourself-CatalogResearch/2.0"}});
    if (![301,302,303,307,308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel?.();
    if (!location) throw new Error(`${current.href}: redirect without Location header`);
    if (redirectCount===maxRedirects) throw new Error(`${current.href}: too many redirects`);
    current = await validateResearchHttpUrl(new URL(location,current).href,{dnsLookup});
  }
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
  const finalUrl = response.url&&response.url!==current.href ? await validateResearchHttpUrl(response.url,{dnsLookup}) : current;
  return {url:finalUrl.href, html, content_type:type, bytes:size, fetched_at:new Date().toISOString()};
};
export const cachedResearchResource = async url => {
  if (!cache.has(url)) {
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(url, fetchResearchResource(url).catch(error => {cache.delete(url); throw error;}));
  }
  return cache.get(url);
};
