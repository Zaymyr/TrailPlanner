import test from "node:test";
import assert from "node:assert/strict";

import { buildExports } from "./research-format-catalog.mjs";

const row = (formatKey, overrides = {}) => ({
  format_key:formatKey,
  race_url:"https://example.test/race",
  target_edition_year:"2027",
  event_name:"Trail exemple",
  official_website:"https://example.test/",
  city:"Ville",
  country:"France",
  candidate_event_date:"2027-01-10",
  source_pages_json:JSON.stringify([`https://example.test/${formatKey}`]),
  field_evidence_json:"{}",
  field_provenance_json:"{}",
  ...overrides,
});

test("buildExports fusionne les données événement de tous les formats", () => {
  const rows = [
    row("court", {access_json:"",services_json:"Vestiaires"}),
    row("long", {access_json:"Navette gare",services_json:"Vestiaires"}),
  ];
  const event = buildExports(rows).events[0];
  assert.equal(event.format_count,2);
  assert.equal(event.access_json,"Navette gare");
  assert.equal(event.services_json,"Vestiaires");
  assert.deepEqual(JSON.parse(event.source_pages_json),["https://example.test/court","https://example.test/long"]);
});

test("buildExports signale les contradictions et reste indépendant de l'ordre", () => {
  const provenance = value => JSON.stringify({location:{value,status:"verified",specificity:3,source_url:`https://example.test/${value}`,method:"deterministic"}});
  const rows = [
    row("a", {format_location:"Lieu B",field_provenance_json:provenance("b")}),
    row("b", {format_location:"Lieu A",field_provenance_json:provenance("a")}),
  ];
  const forward = buildExports(rows).events[0];
  const reverse = buildExports([...rows].reverse()).events[0];
  assert.equal(forward.format_location,reverse.format_location);
  assert.deepEqual(JSON.parse(forward.event_conflicts_json),JSON.parse(reverse.event_conflicts_json));
  assert.equal(JSON.parse(forward.event_conflicts_json).format_location.length,2);
  assert.equal(forward.format_location,"");
});

test("buildExports dérive les bornes multi-jours et préfère la source identifiée", () => {
  const proof=(date,location)=>JSON.stringify({race_date:{value:date,status:"verified",specificity:3,source_url:"https://new.test/",method:"deterministic"},location:{value:location,status:"verified",specificity:3,source_url:"https://new.test/",method:"deterministic"}});
  const rows=[
    row("short",{candidate_event_date:"2027-01-11",format_location:"Départ B",official_website:"https://old.test/",source_identity_status:"unknown",field_provenance_json:proof("2027-01-11","Départ B")}),
    row("ultra",{candidate_event_date:"2027-01-09",event_end_date:"2027-01-10",format_location:"Départ A",official_website:"https://new.test/",source_identity_status:"official_verified",field_provenance_json:JSON.stringify({race_date:{value:"2027-01-09",status:"verified",specificity:3,source_url:"https://new.test/",method:"deterministic"},event_end_date:{value:"2027-01-10",status:"verified",specificity:3,source_url:"https://new.test/",method:"deterministic"},location:{value:"Départ A",status:"verified",specificity:3,source_url:"https://new.test/",method:"deterministic"}})}),
  ];
  const event=buildExports(rows).events[0];
  assert.equal(event.candidate_event_date,"2027-01-09");
  assert.equal(event.event_end_date,"2027-01-11");
  assert.equal(event.format_location,"");
  assert.equal(event.official_website,"https://new.test/");
});
