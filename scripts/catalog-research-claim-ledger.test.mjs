import test from "node:test";
import assert from "node:assert/strict";

import { applyClaims } from "./catalog-research-validation.mjs";
import { verifiedValue } from "./catalog-research-contract.mjs";

const source = "https://trail.test/";
const row = (extra = {}) => ({
  event_name: "Trail Test",
  format_name: "12km",
  official_website: source,
  source_role: "official_candidate",
  candidate_event_date: "2027-06-20",
  prospect_date: "2027-06-20",
  priority_date: "2027-06-20",
  target_edition_year: "2027",
  min_event_date: "2027-01-01",
  max_event_date: "2027-12-31",
  distance_km: "12",
  prospect_distance_km: "12",
  elevation_gain_m: "",
  format_location: "",
  research_schema_version: "2",
  field_provenance_json: "{}",
  rejected_claims_json: "[]",
  conflict_fields: "",
  ...extra,
});
const claim = (field, value, evidence, source_url = source, extra = {}) => ({field,value,evidence,source_url,...extra});
const permutations = values => values.length < 2 ? [values] : values.flatMap((value,index) =>
  permutations(values.filter((_,candidate)=>candidate !== index)).map(rest=>[value,...rest]));

test("claim resolution is invariant to proposal and page order", () => {
  const generic = {url:source,title:"Trail Test",text:"Trail Test aura lieu le 21 juin 2027. Depart a Paris."};
  const format = {url:`${source}12km`,title:"Trail Test 12km",format_context:"Trail Test 12 km",
    text:"Trail Test 12 km : depart le 20 juin 2027 a Paris."};
  const claims = [
    claim("race_date","2027-06-21","Trail Test aura lieu le 21 juin 2027"),
    claim("race_date","2027-06-20","Trail Test 12 km : depart le 20 juin 2027",format.url,{method:"deterministic"}),
    claim("location","Paris","Depart a Paris"),
    claim("distance_km",12,"Trail Test 12 km",format.url),
  ];
  const outcomes = permutations(claims).map((ordered,index) => {
    const candidate = row();
    applyClaims(candidate,{pages:index % 2 ? [format,generic] : [generic,format],claims:ordered},{claims:[]});
    return {
      date:verifiedValue(candidate,"race_date"),
      location:verifiedValue(candidate,"location"),
      distance:verifiedValue(candidate,"distance_km"),
      conflicts:candidate.conflict_fields,
      provenance:JSON.parse(candidate.field_provenance_json),
      rejected:JSON.parse(candidate.rejected_claims_json),
    };
  });
  outcomes.forEach(outcome=>assert.deepEqual(outcome,outcomes[0]));
  assert.equal(outcomes[0].date,"2027-06-20");
  assert.equal(outcomes[0].conflicts,"");
});

test("equal-specificity disagreements produce a stable blocking conflict", () => {
  const pages = [
    {url:source,text:"Lieu de depart : Paris."},
    {url:`${source}infos`,text:"Lieu de depart : Lyon."},
  ];
  const claims = [
    claim("location","Paris","Lieu de depart : Paris"),
    claim("location","Lyon","Lieu de depart : Lyon",`${source}infos`,{confidence:"high"}),
  ];
  const results = [claims,[...claims].reverse()].map(items=>{
    const candidate=row(); applyClaims(candidate,{pages,claims:items},{claims:[]}); return candidate;
  });
  assert.equal(results[0].conflict_fields,"location");
  assert.equal(results[1].conflict_fields,"location");
  assert.equal(results[0].field_provenance_json,results[1].field_provenance_json);
  assert.equal(verifiedValue(results[0],"location"),undefined);
});

test("equivalent locations aggregate support and retain the complete venue", () => {
  const candidate=row();
  const evidence="Rendez-vous a Tourouvre, foret du Perche.";
  applyClaims(candidate,{pages:[{url:source,text:evidence}],claims:[
    claim("location","Tourouvre","Rendez-vous a Tourouvre"),
    claim("location","Tourouvre, foret du Perche",evidence),
  ]},{claims:[]});
  const proof=JSON.parse(candidate.field_provenance_json).location;
  assert.equal(verifiedValue(candidate,"location"),"Tourouvre, foret du Perche");
  assert.equal(proof.support_count,2);
  assert.equal(proof.source_count,1);
  assert.equal(proof.supporting_claims.length,2);
  assert.equal(candidate.conflict_fields,"");
});

test("matching corroboration is aggregated across official pages", () => {
  const second=`${source}programme`;
  const candidate=row();
  applyClaims(candidate,{pages:[
    {url:source,text:"Trail Test aura lieu le 20 juin 2027."},
    {url:second,text:"Date de la course : 20 juin 2027."},
  ],claims:[
    claim("race_date","2027-06-20","Trail Test aura lieu le 20 juin 2027"),
    claim("race_date","2027-06-20","Date de la course : 20 juin 2027",second,{confidence:"low",rationale:"model hint"}),
  ]},{claims:[]});
  const proof=JSON.parse(candidate.field_provenance_json).race_date;
  assert.equal(proof.support_count,2);
  assert.equal(proof.source_count,2);
  assert.equal(proof.supporting_claims[1].reported_confidence,"low");
});

test("edition and neighboring-format safeguards run before ledger resolution", () => {
  const candidate=row();
  const pageText="Trail Test 27 km le 20 juin 2027. Ancienne edition le 19 juin 2026.";
  applyClaims(candidate,{pages:[{url:source,text:pageText}],claims:[
    claim("race_date","2026-06-19","Ancienne edition le 19 juin 2026"),
    claim("distance_km",27,"Trail Test 27 km"),
  ]},{claims:[]});
  assert.equal(Object.keys(JSON.parse(candidate.field_provenance_json)).length,0);
  assert.match(candidate.rejected_claims_json,/edition_mismatch/);
  assert.match(candidate.rejected_claims_json,/format_context_missing|distance_mismatch/);
});
