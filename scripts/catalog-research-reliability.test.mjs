import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildFormatQueue } from "./build-format-import-queue.mjs";
import { applyClaims, deterministicExtract, enrichQueue, sitemapLocations } from "./enrich-format-import-queue.mjs";
import { buildExports, parseGpx, run, processGpx, resolveGpxAmbiguity } from "./research-format-catalog.mjs";
import { buildDraftRequests } from "./import-format-queue-drafts.mjs";
import { verifiedValue, parseResearchDate, classifySourceUrl } from "./catalog-research-contract.mjs";
import { fetchResearchResource } from "./catalog-research-http.mjs";
import { decodeJsonRpcLine } from "./race-research-mcp-client.mjs";
import { serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";

const makeRow = (extra={}) => ({...buildFormatQueue([{race_name:"Trail Test",race_url:"https://www.betrail.run/race/test/2025",official_website:"https://trail.test/",formats_raw:"12km/150 D+",city:"Wrong city",country:"France",date:"2027-06-20",event_date_basis:"date exacte"}],{asOf:"2027-01-01"})[0],...extra});
const apply = (row,claims,text=claims.map(c=>c.evidence).join(" ")) => applyClaims(row,{text,validation_text:text,pages:[{url:row.official_website,text}],claims:[]},{claims});
const claim = (field,value,evidence) => ({field,value,evidence,source_url:"https://trail.test/",confidence:"high"});
const core = () => [claim("race_date","2027-06-20","Trail Test : le 20 juin 2027"),claim("location","Paris","Lieu de départ : Paris"),claim("distance_km","12","Trail Test 12 km")];
const html = '<h1>Trail Test 12 km</h1><p>Trail Test : 20 juin 2027</p><p>12 km D+ : 150 m</p><script type="application/ld+json">{"@type":"Event","name":"Trail Test","startDate":"2027-06-20","location":{"name":"Paris","address":{"addressCountry":"France"}}}</script>';

test("old edition URL cannot replace the requested edition",()=>{
  const row=makeRow(); apply(row,[...core().slice(1),claim("race_date","2025-11-23","Trail Test : le 23 novembre 2025")]);
  assert.equal(row.candidate_event_date,"2027-06-20");
  assert.equal(row.ready_to_import,"FALSE");
  assert.match(row.rejected_claims_json,/edition_mismatch/);
});
test("date and place not contained in a citation remain unverified",()=>{
  const row=makeRow(); apply(row,[claim("race_date","2027-06-20","Bienvenue au trail 12 km"),claim("location","Paris","Bienvenue au trail 12 km"),core()[2]]);
  assert.equal(row.ready_to_import,"FALSE"); assert.match(row.rejected_claims_json,/value_not_in_evidence/);
});
test("a distance found only in a price line is not verified",()=>{
  const row=makeRow({format_name:"22km",distance_km:"22",prospect_distance_km:"22"});
  apply(row,[claim("distance_km",21,"Duo relais 21 km : 18 € par personne")]);
  assert.equal(verifiedValue(row,"distance_km"),undefined);
  assert.match(row.rejected_claims_json,/distance_context_ambiguous/);
});
test("a decimal distance with a trailing zero is normalized and verified",()=>{
  const row=makeRow({format_name:"22km",distance_km:"22",prospect_distance_km:"22"});
  apply(row,[claim("distance_km",22.1,"22,10 km – Course chronométrée – départ à 9h30")]);
  assert.equal(verifiedValue(row,"distance_km"),22.1);
});
test("non-date claims from a page belonging only to an older edition are rejected",()=>{
  const row=makeRow();
  applyClaims(row,{pages:[{url:row.official_website,text:"Règlement du 12 octobre 2025. Trail Test 12 km, départ à Paris."}],claims:[]},
    {claims:[claim("distance_km",12,"Trail Test 12 km"),claim("location","Paris","départ à Paris")]});
  assert.equal(verifiedValue(row,"distance_km"),undefined);
  assert.match(row.rejected_claims_json,/edition_mismatch/);
});
test("a verified date outside the maximum campaign date is rejected",()=>{
  const row=makeRow({max_event_date:"2027-05-31"});
  apply(row,core());
  assert.equal(row.ready_to_import,"FALSE");
  assert.match(row.rejected_claims_json,/date_outside_campaign/);
});
test("a model alias cannot attach another format's start time",()=>{
  const row=makeRow(); apply(row,[{...claim("start_time","11:00","Trail Lafayette 27 km départ à 11h00"),format_label:"Trail Lafayette"}]);
  assert.equal(row.format_start_time,""); assert.match(row.rejected_claims_json,/format_context_missing/);
});
test("numeric string claims are normalized and retain page evidence",()=>{
  const row=makeRow(); apply(row,[...core(),claim("elevation_gain_m","150","Trail Test 12 km : 150 m D+")]);
  assert.equal(row.ready_to_import,"TRUE"); assert.equal(verifiedValue(row,"distance_km"),12);
  assert.equal(verifiedValue(row,"elevation_gain_m"),150);
  assert.equal(row.distance_source_url,"https://trail.test/");
});
test("an official elevation correction supersedes an unverified prospect value",()=>{
  const row=makeRow({elevation_gain_m:"477",prospect_elevation_gain_m:"477"});
  apply(row,[...core(),claim("elevation_gain_m",600,"Trail Test 12 km : 600 m D+")]);
  assert.equal(verifiedValue(row,"elevation_gain_m"),600); assert.equal(row.prospect_elevation_gain_m,"477");
});
test("conflicting official values block the affected field",()=>{
  const row=makeRow(); apply(row,[...core(),claim("race_date","2027-06-21","Trail Test : le 21 juin 2027")]);
  assert.equal(row.ready_to_import,"FALSE"); assert.match(row.conflict_fields,/race_date/);
});
test("deterministic JSON-LD location remains verified after repeated application",()=>{
  const row=makeRow(), extraction=deterministicExtract(html,row);
  applyClaims(row,extraction,{claims:[]}); assert.equal(row.ready_to_import,"TRUE");
  applyClaims(row,extraction,{claims:[]}); assert.equal(row.ready_to_import,"TRUE"); assert.equal(row.official_location,"Paris, France");
});
test("a specific page heading grounds a short format-scoped excerpt",()=>{
  const row=makeRow(); const extraction=deterministicExtract('<h1>Trail Test 12 km</h1><p>Départ à 09h00</p>',row);
  applyClaims(row,extraction,{claims:[claim("start_time","09:00","Départ à 09h00")]});
  assert.equal(row.format_start_time,"09:00");
});
test("unrelated external domains never become official sources",async()=>{
  const row=makeRow({source_role:"registration_or_aggregator"});
  await enrichQueue([row],{noLlm:true,delayMs:0,fetchImpl:async()=>({html,urls:[row.official_website,"https://sponsor.test/course"]})});
  assert.equal(row.source_role,"registration_or_aggregator"); assert.equal(row.ready_to_import,"FALSE");
  assert.equal(row.official_website,"https://trail.test/");
});
test("each format receives a targeted crawl; optional data is still researched",async()=>{
  const rows=[makeRow(),makeRow({format_key:"second",format_name:"27km",distance_km:"27",prospect_distance_km:"27"})]; const calls=[],semantic=[];
  await enrichQueue(rows,{delayMs:0,fetchImpl:async(url,row)=>{calls.push(row.format_name);return html;},llmImpl:async(row)=>{semantic.push(row.format_name);return {claims:[]};}});
  assert.deepEqual(calls,["12km","27km"]); assert.deepEqual(semantic,["12km","27km"]);
});
test("MCP transport restarts once and continues with the current race",async()=>{
  const row=makeRow(); let created=0;
  const factory=async()=>{created+=1;return created===1
    ? {callTool:async()=>{throw new Error("MCP client closed");},close(){}}
    : {callTool:async()=>({resolved_url:row.official_website,pages:[{url:row.official_website,html,authority:"official"}]}),close(){}};};
  await enrichQueue([row],{noLlm:true,delayMs:0,useMcp:true,mcpClientFactory:factory,fetchImpl:async()=>{throw new Error("fallback should not run");}});
  assert.equal(created,2);
  assert.equal(row.crawl_transport,"mcp_stdio_restarted");
  assert.notEqual(row.research_status,"source_error");
});
test("non JSON-RPC stdout is ignored without closing the client",()=>{
  const warnings=[];
  assert.equal(decodeJsonRpcLine("Warning: transient diagnostic",message=>warnings.push(message)),null);
  assert.deepEqual(decodeJsonRpcLine('{"jsonrpc":"2.0","id":1,"result":{}}'),{jsonrpc:"2.0",id:1,result:{}});
  assert.equal(warnings.length,1);
});
test("nested sitemap discovery keeps only organizer-host URLs",()=>{
  const xml='<sitemapindex><sitemap><loc>https://trail.test/pages.xml</loc></sitemap><sitemap><loc>https://other.test/foreign.xml</loc></sitemap></sitemapindex>';
  assert.deepEqual(sitemapLocations(xml,"https://trail.test/"),["https://trail.test/pages.xml"]);
});
test("failed source refresh cannot retain a stale ready flag",async()=>{
  const row=makeRow(); apply(row,core()); assert.equal(row.ready_to_import,"TRUE");
  await enrichQueue([row],{noLlm:true,delayMs:0,fetchImpl:async()=>{throw new Error("HTTP 403");}});
  assert.equal(row.ready_to_import,"FALSE"); assert.equal(row.research_status,"source_error");
});
test("imports verified location and omits candidate elevation; preserves logistics",()=>{
  const row=makeRow(); apply(row,[...core(),claim("start_time","09:00","12 km : départ à 09h00")]);
  const [request]=buildDraftRequests([row],{asOf:"2027-01-01"});
  assert.equal(request.locationText,"Paris"); assert.equal(request.city,undefined);
  assert.equal(request.formats[0].elevation,""); assert.equal(request.formats[0].research.fields.start_time,"09:00");
  assert.equal(request.formats[0].research.candidates.elevation_gain_m,"150");
});
test("legacy and tampered CSV rows cannot rely on a ready flag",()=>{
  const rejected=[]; const row=makeRow(); apply(row,core()); row.distance_km="99";
  assert.equal(buildDraftRequests([row,{...row,research_schema_version:""}],{asOf:"2027-01-01",onRejected:r=>rejected.push(r)}).length,0);
  assert.equal(rejected.length,2);
});
test("CSV exports preserve evidence values and kilometre positions",()=>{
  const row=makeRow(); apply(row,core()); row.aid_stations_json='[{"name":"Marnoz","km":6},{"position":"arrivée","type":"ravitaillement"}]';
  const result=buildExports([row]);
  assert.equal(result.claims.find(c=>c.field==="race_date").value,"2027-06-20");
  assert.equal(result.claims.find(c=>c.field==="location").value,"Paris");
  assert.equal(result.aidStations[0].distanceKm,6); assert.equal(result.aidStations[1].name,"arrivée");
  assert.equal(buildDraftRequests(result.formatRows,{asOf:"2027-01-01"}).length,1);
});
test("GPX missing altitude stays unknown and waypoints do not invent water",()=>{
  const stats=parseGpx('<gpx><trk><trkseg><trkpt lat="45" lon="5"/><trkpt lat="45.01" lon="5.01"/></trkseg></trk><wpt lat="45" lon="5"><name>Parking ferme - aucun ravitaillement</name></wpt></gpx>');
  assert.equal(stats.elevationGainM,null); assert.equal(stats.altitudeMinM,null); assert.deepEqual(stats.aidStations,[]); assert.equal(stats.waypoints[0].waterRefill,undefined);
});
test("GPX rejects missing or out-of-range coordinates",()=>{
  assert.throws(()=>parseGpx('<gpx><trkpt lon="5"><ele>10</ele></trkpt><trkpt lat="45" lon="5"><ele>20</ele></trkpt></gpx>'),/coordonnées/);
  assert.throws(()=>parseGpx('<gpx><trkpt lat="95" lon="5"/><trkpt lat="45" lon="5"/></gpx>'),/coordonnées/);
});
test("GPX segments do not create artificial connecting distances",()=>{
  const stats=parseGpx('<gpx><trkseg><trkpt lat="45" lon="5"/><trkpt lat="45.001" lon="5"/></trkseg><trkseg><trkpt lat="50" lon="5"/><trkpt lat="50.001" lon="5"/></trkseg></gpx>');
  assert.ok(stats.distanceKm < .3);
});
test("GPX ambiguity keeps metrics separate from mandatory text validation",async()=>{
  const first=makeRow(),second=makeRow({format_key:"second"});
  for(const row of [first,second]) {apply(row,[claim("gpx_url","https://trail.test/12km.gpx","Trace 12 km https://trail.test/12km.gpx")]); await processGpx(row,async()=>({distanceKm:12,elevationGainM:null,elevationLossM:null}));}
  resolveGpxAmbiguity([first,second]);
  assert.equal(first.gpx_status,"ambiguous"); assert.equal(second.gpx_status,"ambiguous");
  assert.equal(first.ready_to_import,"FALSE"); assert.equal(verifiedValue(first,"distance_km"),undefined);
});
test("invalid calendar dates and known aggregators are rejected",()=>{
  assert.equal(parseResearchDate("2027-02-29"),""); assert.equal(parseResearchDate("2028-02-29"),"2028-02-29");
  assert.equal(classifySourceUrl("https://www.runtrail.fr/event/42").role,"registration_or_aggregator");
});
test("resource reader rejects oversized responses before parsing",async()=>{
  await assert.rejects(fetchResearchResource("https://trail.test/",{maxBytes:10,fetchImpl:async()=>new Response("x".repeat(11))}),/exceeds/);
});
test("campaign resumes from the last completed format and refuses changed input",async()=>{
  await mkdir("tmp",{recursive:true}); const dir=await mkdtemp(resolve("tmp","catalog-reliability-test-"));
  const input=`${dir}/input.csv`; const output=`${dir}/out`;
  const source=Array.from({length:3},(_,i)=>({race_name:`Trail Test ${i}`,race_url:`https://www.betrail.run/race/test-${i}/2025`,official_website:"https://trail.test/",formats_raw:"12km/150 D+",date:"2027-06-20",event_date_basis:"date exacte"}));
  await writeFile(input,serializeCsvTable(Object.keys(source[0]),source));
  const argv=["--input",input,"--output-dir",output,"--as-of","2027-01-01","--min-days-before","0","--date-from","2027-06-01","--date-to","2027-06-30","--no-llm","--limit","2"];
  let processed=0;
  await assert.rejects(run(argv,{enrichImpl:async(rows,{onRow})=>{await onRow(rows[0]);processed++;throw new Error("interrupted");}}),/interrupted/);
  const state=JSON.parse(await readFile(`${output}/catalog-progress.json`,"utf8")); assert.equal(state.next_offset,1);
  assert.equal(state.date_from,"2027-06-01"); assert.equal(state.date_to,"2027-06-30");
  await run([...argv,"--resume"],{enrichImpl:async(rows,{onRow})=>{for(const row of rows){await onRow(row);processed++;}}});
  const final=JSON.parse(await readFile(`${output}/catalog-progress.json`,"utf8")); assert.equal(final.rows.length,3); assert.equal(final.complete,true); assert.equal(processed,3);
  await writeFile(input,"changed"); await assert.rejects(run([...argv,"--resume"]),/Entrée ou version/);
});
