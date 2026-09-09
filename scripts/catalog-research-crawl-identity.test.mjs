import test from "node:test";
import assert from "node:assert/strict";

import {
  assessSourceIdentity,
  canonicalResearchUrl,
  detectRenderingStatus,
  fetchPage,
  robotsSitemapLocations,
} from "./enrich-format-import-queue.mjs";
import { fetchResearchResource, validateResearchHttpUrl } from "./catalog-research-http.mjs";

const row = (overrides = {}) => ({
  event_name:"Trail des Lucioles", format_name:"La Luciole 20 km", distance_km:"20",
  prospect_city:"Saint-Martin", target_edition_year:"2027", search_fields:"race_date;location;distance_km",
  ...overrides,
});

const resourceMap = records => async url => {
  const normalized = canonicalResearchUrl(url);
  if (!(normalized in records)) throw new Error(`${normalized}: HTTP 404`);
  return {url:normalized,html:records[normalized],content_type:"text/html",bytes:records[normalized].length};
};

const identityHtml = ({links="",hostLabel="Association locale"}={}) => `<!doctype html><html><head><title>Trail des Lucioles 2027</title></head>
  <body><h1>Trail des Lucioles</h1><p>${hostLabel} organise cette édition à Saint-Martin.</p>
  <p>Programme, parcours, départ, arrivée et règlement de la course. ${"Informations pratiques. ".repeat(12)}</p>${links}</body></html>`;

test("a supplied unrelated website is never promoted to an official source", async () => {
  const url = "https://unrelated.example/";
  const html = `<html><head><title>Club de randonnée</title></head><body>${"Actualités du club et sorties hebdomadaires. ".repeat(12)}</body></html>`;
  await assert.rejects(
    fetchPage(url,row(),{fetchResource:resourceMap({[url]:html})}),
    /source identity not confirmed/,
  );
});

test("a municipal or club domain is verified from strong page content", async () => {
  const url = "https://ville-saint-martin.example/evenements/lucioles";
  const result = await fetchPage(url,row(),{fetchResource:resourceMap({[url]:identityHtml()})});
  assert.equal(result.source_identity_status,"official_verified");
  assert.ok(result.source_identity_score >= 60);
  assert.equal(result.pages[0].authority,"official");
});

test("the bounded best-first crawl reaches a relevant depth-two page", async () => {
  const rootUrl = "https://lucioles.example/";
  const courseUrl = "https://lucioles.example/course";
  const programmeUrl = "https://lucioles.example/course/programme";
  const records = {
    [rootUrl]:identityHtml({links:'<a href="/course">Parcours de la course</a>'}),
    [courseUrl]:`<html><body><h1>Parcours</h1><p>${"Présentation du parcours. ".repeat(10)}</p><a href="/course/programme">Programme et horaires</a></body></html>`,
    [programmeUrl]:`<html><body><h1>Programme</h1><p>Départ du 20 km à 08:00 à Saint-Martin.</p></body></html>`,
  };
  const result = await fetchPage(rootUrl,row(),{fetchResource:resourceMap(records)});
  assert.ok(result.urls.includes(programmeUrl));
  assert.equal(result.pages.find(page=>page.url===programmeUrl)?.depth,2);
});

test("robots.txt can advertise an alternative sitemap", async () => {
  const rootUrl = "https://lucioles.example/";
  const robotsUrl = "https://lucioles.example/robots.txt";
  const sitemapUrl = "https://lucioles.example/course-map.xml";
  const programmeUrl = "https://lucioles.example/programme-2027";
  const records = {
    [rootUrl]:identityHtml(),
    [robotsUrl]:`User-agent: *\nSitemap: ${sitemapUrl}`,
    [sitemapUrl]:`<?xml version="1.0"?><urlset><url><loc>${programmeUrl}</loc></url></urlset>`,
    [programmeUrl]:`<html><body><h1>Programme Trail des Lucioles</h1><p>Saint-Martin, départ du 20 km à 08:00.</p></body></html>`,
  };
  assert.deepEqual(robotsSitemapLocations(records[robotsUrl],rootUrl),[sitemapUrl]);
  const result = await fetchPage(rootUrl,row({search_depth:"deep"}),{fetchResource:resourceMap(records)});
  assert.ok(result.urls.includes(programmeUrl));
});

test("tracking parameters and fragments are removed during canonicalization", () => {
  assert.equal(canonicalResearchUrl("/programme/?utm_source=test&b=2&a=1#top","https://lucioles.example"),"https://lucioles.example/programme?a=1&b=2");
});

test("a thin JavaScript application shell is reported explicitly", () => {
  assert.equal(detectRenderingStatus('<html><body><div id="root"></div><script src="/app.js"></script></body></html>'),"js_only_suspected");
});

test("identity tokens require whole-word matches, not substrings", () => {
  const identity = assessSourceIdentity('<title>Trail des Luciolestown</title><h1>Luciolestown</h1><p>Programme à Saint-Martin</p>',
    'https://club.example/',row());
  assert.equal(identity.status,"unknown");
});

test("authority is evaluated per page instead of inherited from the host", async () => {
  const rootUrl = "https://lucioles.example/";
  const calendarUrl = "https://lucioles.example/calendrier";
  const records = {
    [rootUrl]:identityHtml({links:'<a href="/calendrier">Programme des courses</a>'}),
    [calendarUrl]:`<html><head><title>Calendrier communal</title></head><body><h1>Tous les événements sportifs</h1><p>${"Marathon, randonnée, cyclisme et informations pratiques. ".repeat(8)}</p></body></html>`,
  };
  const result = await fetchPage(rootUrl,row(),{fetchResource:resourceMap(records)});
  assert.equal(result.pages.find(page=>page.url===rootUrl)?.authority,"official");
  assert.equal(result.pages.find(page=>page.url===calendarUrl)?.authority,"secondary");
});

test("SSRF guard rejects credentials, local addresses and private DNS answers", async () => {
  await assert.rejects(validateResearchHttpUrl("https://user:secret@example.com/"),/credentials/);
  await assert.rejects(validateResearchHttpUrl("http://169.254.169.254/latest/meta-data"),/private, reserved or link-local/);
  await assert.rejects(validateResearchHttpUrl("https://organizer.example/",{dnsLookup:async()=>[{address:"127.0.0.1",family:4}]}),/DNS resolves/);
});

test("SSRF guard validates every manual redirect before following it", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("",{status:302,headers:{location:"http://169.254.169.254/latest/meta-data"}});
  };
  await assert.rejects(fetchResearchResource("https://organizer.example/",{fetchImpl}),/private, reserved or link-local/);
  assert.equal(calls,1);
});

test("public DNS answers remain fetchable with injected networking", async () => {
  const result = await fetchResearchResource("https://organizer.example/info",{
    dnsLookup:async()=>[{address:"93.184.216.34",family:4}],
    fetchImpl:async()=>new Response("<h1>Public organizer</h1>",{status:200,headers:{"content-type":"text/html"}}),
  });
  assert.equal(result.url,"https://organizer.example/info");
  assert.match(result.html,/Public organizer/);
});
