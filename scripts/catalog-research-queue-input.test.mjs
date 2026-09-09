import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FORMAT_QUEUE_HEADERS } from "./build-format-import-queue.mjs";
import { serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";
import { run } from "./research-format-catalog.mjs";

test("--queue-input preserves benchmark format keys", async () => {
  const root=await mkdtemp(join(tmpdir(),"catalog-queue-input-"));
  const input=join(root,"queue.csv"), output=join(root,"out");
  const candidate={format_key:"format-stable-benchmark",event_name:"Trail Test",format_name:"12km",format_raw:"12km/300 D+",race_url:"https://source.test/race",official_website:"https://organizer.test/",target_edition_year:"2027",priority_date:"2027-01-10",candidate_event_date:"2027-01-10",distance_km:"12",prospect_distance_km:"12",source_role:"official_candidate",source_quality:"unclassified",field_provenance_json:"{}",source_pages_json:"[]",research_errors_json:"[]",rejected_claims_json:"[]"};
  await writeFile(input,serializeCsvTable(FORMAT_QUEUE_HEADERS,[candidate]),"utf8");
  await run(["--queue-input",input,"--output-dir",output,"--no-llm"],{enrichImpl:async(rows,{onRow})=>{for(const row of rows) await onRow(row,{test:true});}});
  const progress=JSON.parse(await readFile(join(output,"catalog-progress.json"),"utf8"));
  assert.deepEqual(progress.queue_keys,["format-stable-benchmark"]);
  assert.equal(progress.input_mode,"queue");
});
