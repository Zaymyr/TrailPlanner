import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildFormatQueue } from "./build-format-import-queue.mjs";
import { applyClaims, deterministicExtract, enrichQueue, evidenceIdentifiesFormat, likelyOrganizerPage, linkedOrganizerCandidates, pageMentionsExpectedEvent, searchResultCandidates, sitemapLocations, weakOrganizerPage } from "./enrich-format-import-queue.mjs";
import { acquireCampaignLock, buildExports, parseGpx, run, processGpx, resolveGpxAmbiguity } from "./research-format-catalog.mjs";
import { buildDraftRequests } from "./import-format-queue-drafts.mjs";
import { verifiedValue, parseResearchDate, classifySourceUrl, isUnsafeResearchUrl } from "./catalog-research-contract.mjs";
import { citationMatchesPage, validateClaimForRow } from "./catalog-research-validation.mjs";
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
test("infers the campaign year from an explicit French event date and location",()=>{
  const row=makeRow({candidate_event_date:"2026-11-01",prospect_date:"2026-11-01",priority_date:"2026-11-01",target_edition_year:"2026",min_event_date:"2026-11-01",max_event_date:"2027-02-28"});
  const page='<h1>Le parcours trail de 12 km</h1><p>Dimanche 1er novembre, venez courir.</p><p>À Tourouvre, le trail de 12 km vous attend.</p>';
  const extraction=deterministicExtract(page,row); applyClaims(row,extraction,{claims:[]});
  assert.equal(verifiedValue(row,"race_date"),"2026-11-01"); assert.equal(verifiedValue(row,"location"),"Tourouvre");
  assert.equal(JSON.parse(row.field_provenance_json).race_date.method,"deterministic_inferred_year");
});
test("infers a yearless event date when the edition is explicit nearby",()=>{
  const row=makeRow({candidate_event_date:"2026-11-01",prospect_date:"2026-11-01",priority_date:"2026-11-01",target_edition_year:"2026",min_event_date:"2026-11-01",max_event_date:"2027-02-28"});
  const extraction=deterministicExtract('<h1>Trail des Sorcières - 1er Novembre</h1><p>PROGRAMME 2026 : Trail Test 12 km</p>',row);
  applyClaims(row,extraction,{claims:[]}); assert.equal(verifiedValue(row,"race_date"),"2026-11-01");
});
test("extracts a current weekday date from a root title despite historical articles",()=>{
  const row=makeRow({target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28',official_website:'https://traildesroches.test/'});
  const page='<title>Dimanche 8 novembre 2026</title><article>Edition 2025 : le 9 novembre 2025</article>';
  const dateClaim=deterministicExtract(page,row).claims.find(item=>item.field==='race_date' && item.value==='2026-11-08');
  assert.ok(dateClaim);
});
test("extracts a current venue from official regulation wording",()=>{
  const row=makeRow({candidate_event_date:"2026-11-01",prospect_date:"2026-11-01",target_edition_year:"2026",min_event_date:"2026-11-01",max_event_date:"2027-02-28"});
  const extraction=deterministicExtract('<h1>Règlement 2026 Trail Test 12 km</h1><p>Les lieux de départ et d’arrivée se situent près de la salle des fêtes à Mâlain. Les départs seront donnés le dimanche 1er novembre 2026.</p>',row);
  applyClaims(row,extraction,{claims:[]}); assert.equal(verifiedValue(row,'location'),'Mâlain');
});
test("does not truncate a multi-word uppercase start venue",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract('<p>Départ à GÉOPARC SAINT DIE DES VOSGES avec une arrivée au col.</p>',row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'GÉOPARC SAINT DIE DES VOSGES');
});
test("extracts a venue placed after a dated rendez-vous banner",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract('<p>RENDEZ-VOUS LE SAMEDI 7 NOVEMBRE MEYRUEIS, LOZERE (48)</p>',row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'MEYRUEIS, LOZERE (48)');
});
test("extracts the complete venue between departure and arrival labels",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract('<p>Départ Musée de Bibracte - Saint-Léger-Sous-Beuvray (71990) Arrivée Musée de Bibracte - Saint-Léger-Sous-Beuvray (71990)</p>',row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'Musée de Bibracte - Saint-Léger-Sous-Beuvray (71990)');
});
test("extracts a venue after shared departure and arrival labels",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract('<p>Départ et Arrivée : Paléosite, Route de la montée verte, 17770 Saint-Césaire Les parcours traversent des propriétés privées.</p>',row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'Paléosite, Route de la montée verte, 17770 Saint-Césaire');
});
test("extracts the complete unique start and finish address",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract("<p>L’unique lieu de départ et d’ arrivée se situe au Château de Ménilles, rue Roederer, 27120 Ménilles.</p>",row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'Château de Ménilles, rue Roederer, 27120 Ménilles');
});
test("extracts an event venue and its adjacent postal address",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract("<p>L'Endurance Trail aura lieu le mercredi 11 novembre 2026 au Complexe Sportif de Bellefontaine. (Rue de Roncevaux 54250 CHAMPIGNEULLES)</p>",row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'Complexe Sportif de Bellefontaine, Rue de Roncevaux 54250 CHAMPIGNEULLES');
});
test("cleans control characters and extracts a venue introduced by a lieu sur",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract('<p>Le trail a lieu sur le Plateau des Petites Roches \u0000 &agrave; Saint Hilaire-du-Touvet le deuxi&egrave;me dimanche de novembre.</p>',row);
  assert.equal(extraction.text.includes('\u0000'),false);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'Plateau des Petites Roches à Saint Hilaire-du-Touvet');
});
test("keeps lowercase connectors inside a named rendez-vous venue",()=>{
  const row=makeRow({official_website:'https://trail.test/'});
  const extraction=deterministicExtract('<p>Rendez-vous au Fort de Cormeilles-en-Parisis Matériel obligatoire.</p>',row);
  assert.equal(extraction.claims.find(item=>item.field==='location')?.value,'Fort de Cormeilles-en-Parisis');
});
test("rejects a historical event caption as current field evidence",()=>{
  const row=makeRow({target_edition_year:'2026'});
  assert.equal(validateClaimForRow(claim('location','Mâlain',"Trail des Sorcières 2023 - arrivée à Mâlain"),row),'historical_evidence');
});
test("does not infer the target year from a yearless date inside an older edition",()=>{
  const row=makeRow({target_edition_year:'2026'});
  const inferred={...claim('race_date','2026-11-09','Edition 2025. Le Trail aura lieu le Dimanche 9 Novembre 2025.'),method:'deterministic_inferred_year'};
  assert.equal(validateClaimForRow(inferred,row),'historical_evidence');
});
test("rejects administrative dates and impossible weekday combinations",()=>{
  const row=makeRow({target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28'});
  assert.equal(validateClaimForRow({...claim('race_date','2026-11-13','Retrait des dossards vendredi 13 novembre'),method:'deterministic_inferred_year'},row),'date_context_ambiguous');
  assert.equal(validateClaimForRow({...claim('race_date','2026-11-13','Les missions bénévoles débuteront vendredi 13 novembre'),method:'deterministic_inferred_year'},row),'date_context_ambiguous');
  assert.equal(validateClaimForRow({...claim('race_date','2026-12-07','Dimanche 7 décembre : départ du trail'),method:'deterministic_inferred_year'},row),'weekday_mismatch');
  assert.equal(validateClaimForRow({...claim('race_date','2026-12-19','Départ samedi 19 décembre du Trail Test'),method:'deterministic_inferred_year'},row),'');
});
test("rejects a registration cutoff even when the real start appears later",()=>{
  const row=makeRow({target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28'});
  const cutoff={...claim('race_date','2026-12-11',"Marche sur Chrono-start jusqu'au vendredi 11 décembre inclus dans la limite des places disponibles. Programme : départ dimanche 13 décembre à 9h."),method:'deterministic_inferred_year'};
  assert.equal(validateClaimForRow(cutoff,row),'date_context_ambiguous');
});
test("rejects dates scoped to another format or an unscoped event range",()=>{
  const row=makeRow({format_name:'36km',distance_km:'36',prospect_distance_km:'36',target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28'});
  assert.equal(validateClaimForRow({...claim('race_date','2026-11-14','Samedi 14 novembre : canitrail 15 km'),method:'deterministic_inferred_year'},row),'neighboring_format');
  assert.equal(validateClaimForRow({...claim('race_date','2026-11-15','Rendez-vous les 14 & 15 novembre pour un événement unique'),method:'deterministic_inferred_year'},row),'date_context_ambiguous');
  assert.equal(validateClaimForRow(claim('race_date','2026-11-15','Le règlement des trails 22 km, 17 km et 36 km s’applique aux épreuves se déroulant les 14 et 15 novembre 2026.'),row),'date_context_ambiguous');
  assert.equal(validateClaimForRow(claim('race_date','2026-11-14','Samedi 14 novembre 2026 : Canitrail 15 km. Dimanche 15 novembre 2026 : Les Châtaignes 36 km.'),row),'date_context_ambiguous');
  assert.equal(validateClaimForRow(claim('race_date','2026-11-15','Samedi 14 novembre 2026 : Canitrail 15 km. Dimanche 15 novembre 2026 : Les Châtaignes 36 km.'),row),'');
  assert.equal(validateClaimForRow({...claim('race_date','2026-11-14','Samedi 14 novembre : Canitrail 15 km. Dimanche 15 novembre : Les Châtaignes 36 km.'),method:'deterministic_inferred_year'},row),'date_context_ambiguous');
  assert.equal(validateClaimForRow(claim('race_date','2026-11-14','22 km nocturne départ à 18h00 le samedi 14 novembre 2026 36 km départ à 9h00 le dimanche 15 novembre 2026 17 km départ à 10h30 le dimanche 15 novembre 2026'),row),'date_context_ambiguous');
  assert.equal(validateClaimForRow(claim('race_date','2026-11-15','22 km nocturne départ à 18h00 le samedi 14 novembre 2026 36 km départ à 9h00 le dimanche 15 novembre 2026 17 km départ à 10h30 le dimanche 15 novembre 2026'),row),'');
  assert.equal(validateClaimForRow({...claim('race_date','2026-11-14','DEPART 17H30 SAMEDI 14 NOVEMBRE'),source_url:'https://trail.test/12km-nocturne',method:'deterministic_inferred_year'},row),'neighboring_format');
});
test("does not treat bib pickup or a club contact address as the event location",()=>{
  const row=makeRow({target_edition_year:'2026'});
  assert.equal(validateClaimForRow(claim('location','Bellefontaine','La remise des dossards se fera au complexe sportif de Bellefontaine'),row),'location_context_ambiguous');
  assert.equal(validateClaimForRow(claim('location','Paris','Notre adresse : 10 rue du Club, Paris'),row),'location_context_ambiguous');
  assert.equal(validateClaimForRow(claim('location','et','Départ et Arrivée : Paléosite'),row),'invalid_location');
  assert.equal(validateClaimForRow(claim('location','et d’','L’unique lieu de départ et d’arrivée se situe au Château de Ménilles'),row),'invalid_location');
  assert.equal(validateClaimForRow(claim('location','Bellefontaine','La course aura lieu au complexe sportif de Bellefontaine'),row),'');
});
test("rejects mandatory claims sourced from a historical results URL",()=>{
  const row=makeRow({target_edition_year:'2026'});
  assert.equal(validateClaimForRow({...claim('distance_km',12,'Trail Test 12 km'),source_url:'https://trail.test/pdf/results_2024_12km.pdf'},row),'historical_evidence');
  assert.equal(validateClaimForRow({...claim('distance_km',12,'Trail Test 12 km'),source_url:'https://trail.test/editions-precedentes/'},row),'historical_evidence');
});
test("keeps yearless date evidence local to its format",()=>{
  const row=makeRow({format_name:'185km',distance_km:'185',prospect_distance_km:'185',target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28'});
  const page='<p>Ultra 185 km partira le vendredi 13 novembre à 14h.</p><p>Grand Trail 100 km partira le samedi 14 novembre à 12h.</p>';
  const claims=deterministicExtract(page,row).claims.filter(item=>item.field==='race_date');
  assert.equal(evidenceIdentifiesFormat(claims.find(item=>item.value==='2026-11-13').evidence,row),true);
  assert.equal(evidenceIdentifiesFormat(claims.find(item=>item.value==='2026-11-14').evidence,row),false);
  assert.equal(deterministicExtract('<p>km 30 : dimanche 15 novembre 14h, soit 5h30 de course.</p>',row).claims.some(item=>item.field==='race_date'),false);
});
test("extracts format-local dates when an official page lists several formats",()=>{
  const row=makeRow({format_name:'185km',distance_km:'185',prospect_distance_km:'185',target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28'});
  const page='<p>Ultra 185 km partira le vendredi 13 novembre 2026 à 14h.</p><p>Grand Trail 100 km partira le samedi 14 novembre 2026 à 12h.</p>';
  const claims=deterministicExtract(page,row).claims.filter(item=>item.field==='race_date');
  assert.equal(evidenceIdentifiesFormat(claims.find(item=>item.value==='2026-11-13').evidence,row),true);
  assert.equal(evidenceIdentifiesFormat(claims.find(item=>item.value==='2026-11-14').evidence,row),false);
  applyClaims(row,deterministicExtract(page,row),{claims:[]});
  assert.equal(verifiedValue(row,'race_date'),'2026-11-13');
  assert.match(JSON.parse(row.field_provenance_json).race_date.evidence,/185 km/);
});
test("removes scripts and styles before deterministic block extraction",()=>{
  const row=makeRow({format_name:"26km",distance_km:"26",prospect_distance_km:"26"});
  const extraction=deterministicExtract('<script>const url="/trail-26-km";\nwindow.dataLayer=[];</script><style>.trail-26-km { display:block }</style><p>Bienvenue</p>',row);
  assert.equal(extraction.claims.filter(item=>item.field==='distance_km').length,0);
});
test("accepts a near-verbatim citation but rejects loose token overlap",()=>{
  assert.equal(citationMatchesPage('Le trail a lieu sur le Plateau des Petites Roches à Saint Hilaire du Touvet','Le trail a lieu sur le Plateau des Petites Roches, à Saint-Hilaire-du-Touvet, le deuxième dimanche.'),true);
  assert.equal(citationMatchesPage('Le trail aura lieu à Paris avec un parcours de 12 kilomètres','Cette page parle du trail, de Paris et présente séparément un ancien parcours de 12 kilomètres.'),false);
});
test("a dedicated format page supersedes event-wide dates and locations",()=>{
  const row=makeRow({format_name:"185km",distance_km:"185",prospect_distance_km:"185",candidate_event_date:"2026-11-13",prospect_date:"2026-11-13",target_edition_year:"2026",min_event_date:"2026-11-01",max_event_date:"2027-02-28"});
  const faq={url:"https://trail.test/faq",title:"FAQ",text:"Samedi 14 novembre. 185 km, 100 km et 50 km. Départs en Bourgogne."};
  const dedicated={url:"https://trail.test/ultra",title:"L'Ultra des Druides",text:"L'Ultra des Druides. Distance 185 km. Date 13 novembre 2026. Départ Musée de Bibracte."};
  applyClaims(row,{pages:[faq,dedicated],claims:[{...claim('race_date','2026-11-14','Samedi 14 novembre'),method:'deterministic_inferred_year',source_url:faq.url},claim('location','Bourgogne','Départs en Bourgogne')]},
    {claims:[{...claim('race_date','2026-11-13','Date 13 novembre 2026'),source_url:dedicated.url,format_label:"L'Ultra des Druides"},{...claim('location','Musée de Bibracte','Départ Musée de Bibracte'),source_url:dedicated.url,format_label:"L'Ultra des Druides"}]});
  assert.equal(verifiedValue(row,'race_date'),'2026-11-13'); assert.equal(verifiedValue(row,'location'),'Musée de Bibracte'); assert.equal(row.conflict_fields,'');
});
test("compatible venue descriptions merge without a false location conflict",()=>{
  const row=makeRow();
  apply(row,[...core().filter(item=>item.field!=='location'),claim('location','Tourouvre','Rendez-vous à Tourouvre'),claim('location','Tourouvre, forêt du Perche','à Tourouvre, forêt du Perche')]);
  assert.equal(verifiedValue(row,'location'),'Tourouvre, forêt du Perche');
  assert.doesNotMatch(row.conflict_fields,/location/);
});
test("an official distance drift requires explicit format identity review",()=>{
  const row=makeRow({format_name:'64km',format_raw:'64km/3100 D+',distance_km:'64',prospect_distance_km:'64'});
  apply(row,[claim('race_date','2027-06-20','Trail Test : le 20 juin 2027'),claim('location','Paris','Lieu de départ : Paris'),claim('distance_km',70,'Parcours 70 km')]);
  assert.equal(verifiedValue(row,'distance_km'),70);
  assert.equal(row.ready_to_import,'FALSE');
  assert.match(row.conflict_fields,/format_identity/);
  assert.equal(buildDraftRequests([row],{asOf:'2027-01-01'}).length,0);
  const renamed=makeRow({format_name:'26km',format_raw:'26km/650 D+',distance_km:'26',prospect_distance_km:'26'});
  apply(renamed,[claim('race_date','2027-06-20','Trail Test : le 20 juin 2027'),claim('location','Paris','Lieu de départ : Paris'),claim('distance_km',25,'Parcours 25 km')]);
  assert.match(renamed.conflict_fields,/format_identity/);
});
test("a format-specific date outranks an unrelated date on the event homepage",()=>{
  const row=makeRow({format_name:'36km',distance_km:'36',prospect_distance_km:'36',target_edition_year:'2026',min_event_date:'2026-11-01',max_event_date:'2027-02-28'});
  const root={url:'https://trail.test/',title:'Trail des Châtaignes',text:'Samedi 14 novembre 2026. Trail principal 36 km.'};
  const format={url:'https://trail.test/les-courses/les-chataignes/',title:'Les Châtaignes 36 km',format_context:'Les Châtaignes 36 km',text:'Départ dimanche 15 novembre du trail 36 km.'};
  applyClaims(row,{pages:[root,format],claims:[
    {...claim('race_date','2026-11-14','Samedi 14 novembre 2026'),source_url:root.url,method:'deterministic'},
    {...claim('race_date','2026-11-15','Départ dimanche 15 novembre du trail 36 km'),source_url:format.url,method:'deterministic_inferred_year'},
  ]},{claims:[]});
  assert.equal(verifiedValue(row,'race_date'),'2026-11-15');
  assert.doesNotMatch(row.conflict_fields,/race_date/);
});
test("a current course page outranks a stale transactional registration page",()=>{
  const row=makeRow({format_name:'32km',distance_km:'32',prospect_distance_km:'32'});
  const home={url:'https://trail.test/',title:'Trail Test',text:'La Poncinoise 32 km - 1200 D+'};
  const registration={url:'https://trail.test/inscription-en-ligne/',title:'Inscription',text:'INSCRIPTIONS FERMEES - La Poncinoise 31 km - 1100 D+'};
  applyClaims(row,{pages:[home,registration],claims:[
    {...claim('distance_km',32,'La Poncinoise 32 km - 1200 D+'),source_url:home.url},
    {...claim('distance_km',31,'La Poncinoise 31 km - 1100 D+'),source_url:registration.url},
  ]},{claims:[]});
  assert.equal(verifiedValue(row,'distance_km'),32);
  assert.doesNotMatch(row.conflict_fields,/distance_km/);
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
test("audit snapshots retain validation text without duplicating raw HTML",async()=>{
  const row=makeRow(); let audit;
  await enrichQueue([row],{noLlm:true,delayMs:0,fetchImpl:async()=>({pages:[{url:row.official_website,html,authority:'official'}]}),onRow:async(_row,value)=>{audit=value;}});
  assert.equal(typeof audit.pages[0].text,'string'); assert.ok(audit.pages[0].text.includes('Trail Test'));
  assert.equal('html' in audit.pages[0],false);
});
test("MCP transport restarts once and continues with the current race",async()=>{
  const row=makeRow({target_edition_year:'2027',prospect_city:'Paris',city:'Paris',country:'France'}); let created=0,received;
  const factory=async()=>{created+=1;return created===1
    ? {callTool:async()=>{throw new Error("MCP client closed");},close(){}}
    : {callTool:async(_name,args)=>{received=args;return {resolved_url:row.official_website,pages:[{url:row.official_website,html,authority:"official"}]};},close(){}};};
  await enrichQueue([row],{noLlm:true,delayMs:0,useMcp:true,mcpClientFactory:factory,fetchImpl:async()=>{throw new Error("fallback should not run");}});
  assert.equal(created,2);
  assert.equal(row.crawl_transport,"mcp_stdio_restarted");
  assert.equal(received.target_edition_year,'2027'); assert.equal(received.prospect_city,'Paris'); assert.equal(received.country,'France');
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
test("research excludes participant, result, export and administration URLs",()=>{
  assert.equal(isUnsafeResearchUrl('https://trail.test/admin/liste-inscriptions/'),true);
  assert.equal(isUnsafeResearchUrl('https://trail.test/liste-des-inscrits'),true);
  assert.equal(isUnsafeResearchUrl('https://trail.test/resultats-2025'),true);
  assert.equal(isUnsafeResearchUrl('https://trail.test/export/participants.csv'),true);
  assert.equal(isUnsafeResearchUrl('https://trail.test/le-club/comptes-rendus/courses-sur-route.html'),true);
  assert.equal(isUnsafeResearchUrl('https://trail.test/bilan-du-trail-2025'),true);
  assert.equal(isUnsafeResearchUrl('https://trail.test/inscriptions/'),false);
  const xml='<urlset><url><loc>https://trail.test/parcours</loc></url><url><loc>https://trail.test/admin/liste-inscriptions</loc></url></urlset>';
  assert.deepEqual(sitemapLocations(xml,'https://trail.test/'),['https://trail.test/parcours']);
});
test("search result parsing keeps organizer candidates and rejects known aggregators",()=>{
  const html='<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftrail-amoureux.fr%2F">Courses des Amoureux du Fer - officiel</a><a class="result__a" href="https://www.betrail.run/race/x">Courses des Amoureux du Fer</a><a class="result__a" href="https://kerrun.com/events/amoureux">Courses des Amoureux du Fer 2026</a>';
  assert.deepEqual(searchResultCandidates(html,{event_name:'Courses des Amoureux du Fer'}).map(item=>item.href),['https://trail-amoureux.fr/']);
});
test("organizer discovery requires the prospect city to prevent homonyms",()=>{
  const organizer='<title>Trail des Roches</title><h1>Trail des Roches</h1><p>Rendez-vous à Leymiat.</p><a href="/parcours">Parcours</a><a href="/inscription">Inscription</a>';
  const row={event_name:'Trail des Roches (01)',prospect_city:'Leymiat'};
  assert.equal(likelyOrganizerPage(organizer,'https://traildesroches-ain.fr/',row),true);
  const dateTitleOnly='<title>Dimanche 8 novembre 2026</title><p>Leymiat</p><a href="/parcours">Parcours</a><a href="/inscription">Inscription</a>';
  assert.equal(likelyOrganizerPage(dateTitleOnly,'https://traildesroches-ain.fr/',row),true);
  assert.equal(likelyOrganizerPage(organizer.replace('Leymiat','Saint-Dié'),'https://traildesroches-vosges.fr/',row),false);
});
test("a thin legacy landing page exposes a location-checked organizer candidate",()=>{
  const row=makeRow({event_name:'Trail des Roches (01)',city:'Leymiat',prospect_city:'Leymiat'});
  const landing='<h1>Bienvenue sur nos nouveaux sites</h1><a href="https://raid.raidfeminain.fr"><img alt="Raid"></a><a href="https://traildesroches.raidfeminain.fr"><img alt="Trail"></a>';
  assert.deepEqual(linkedOrganizerCandidates(landing,'https://www.raidfeminain.fr/legacy',row).map(item=>item.href),['https://traildesroches.raidfeminain.fr/']);
});
test("recognizes an event homepage and rejects empty or parked pages",()=>{
  const row={event_name:'Trail des Oufs',prospect_city:'Montastruc la Conseillere'};
  assert.equal(pageMentionsExpectedEvent('<h1>Trail des Oufs</h1><p>Montastruc-la-Conseillère</p>',row),true);
  assert.equal(weakOrganizerPage('<h1>Directory Index</h1><p>Privacy Policy Terms of Service</p>'.repeat(8)),true);
  assert.equal(weakOrganizerPage('<h1>Trail des Oufs</h1><p>Informations organisateur et parcours détaillés.</p>'.repeat(8)),false);
});
test("failed source refresh cannot retain a stale ready flag",async()=>{
  const row=makeRow(); apply(row,core()); assert.equal(row.ready_to_import,"TRUE");
  await enrichQueue([row],{noLlm:true,delayMs:0,fetchImpl:async()=>{throw new Error("HTTP 403");}});
  assert.equal(row.ready_to_import,"FALSE"); assert.equal(row.research_status,"source_error");
});
test("a successful retry clears a previous source error status",async()=>{
  const row=makeRow({research_status:'source_error'});
  await enrichQueue([row],{noLlm:true,delayMs:0,useMcp:false,fetchImpl:async()=>({pages:[{url:row.official_website,html,authority:'official'}]})});
  assert.equal(row.research_status,'ready_to_import');
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
  const state=JSON.parse(await readFile(`${output}/catalog-progress.json`,"utf8")); assert.equal(state.next_offset,1); assert.equal(state.pipeline_version,"9");
  assert.equal(state.date_from,"2027-06-01"); assert.equal(state.date_to,"2027-06-30");
  await run([...argv,"--resume"],{enrichImpl:async(rows,{onRow})=>{for(const row of rows){await onRow(row);processed++;}}});
  const final=JSON.parse(await readFile(`${output}/catalog-progress.json`,"utf8")); assert.equal(final.rows.length,3); assert.equal(final.complete,true); assert.equal(processed,3);
  await writeFile(input,"changed"); await assert.rejects(run([...argv,"--resume"]),/Entrée ou version/);
});
test("campaign lock replaces an orphan but refuses a live process",async()=>{
  await mkdir("tmp",{recursive:true}); const dir=await mkdtemp(resolve("tmp","catalog-lock-test-"));
  const lockPath=`${dir}/catalog.lock`;
  await writeFile(lockPath,JSON.stringify({pid:99999999,started_at:"2026-01-01T00:00:00.000Z"}));
  const lock=await acquireCampaignLock(lockPath);
  const current=JSON.parse(await readFile(lockPath,"utf8")); assert.equal(current.pid,process.pid);
  await lock.close();
  await writeFile(lockPath,JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}));
  await assert.rejects(acquireCampaignLock(lockPath),new RegExp(`processus ${process.pid}`));
});
