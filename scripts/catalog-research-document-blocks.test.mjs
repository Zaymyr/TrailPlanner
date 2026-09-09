import test from "node:test";
import assert from "node:assert/strict";

import { buildDocumentBlocks, groundLlmClaimsToBlocks, renderDocumentBlockContext, scoreDocumentBlock, selectDocumentBlocks } from "./catalog-research-document-blocks.mjs";

const url = "https://trail.example/programme";
const row = { event_name:"Trail des Roches", format_name:"Trail 12 km", format_raw:"12km/450 D+", distance_km:"12" };

test("block identifiers are stable across irrelevant script changes", () => {
  const first = buildDocumentBlocks("<script>one()</script><h1>Trail des Roches</h1><p>Le 12 km part à 9h.</p>",url);
  const second = buildDocumentBlocks("<script>two()</script><h1>Trail des Roches</h1><p>Le 12 km part à 9h.</p>",url);
  assert.deepEqual(first.map(block=>block.block_id),second.map(block=>block.block_id));
});

test("heading paths isolate neighboring sections", () => {
  const blocks = buildDocumentBlocks("<h1>Trail des Roches</h1><h2>12 km</h2><p>Départ 09h00.</p><h2>27 km</h2><p>Départ 07h00.</p>",url);
  assert.deepEqual(blocks.map(block=>block.heading_path.join(" > ")), ["Trail des Roches > 12 km","Trail des Roches > 27 km"]);
  assert.equal(blocks[0].text,"Départ 09h00.");
  assert.equal(blocks[1].text,"Départ 07h00.");
});

test("a neighboring format ranks below the requested format", () => {
  const blocks = buildDocumentBlocks("<h2>12 km</h2><p>Distance 12 km, dénivelé 450 m D+.</p><h2>27 km</h2><p>Distance 27 km, dénivelé 900 m D+.</p>",url);
  assert.ok(scoreDocumentBlock(blocks[0],row) > scoreDocumentBlock(blocks[1],row));
  assert.equal(selectDocumentBlocks(blocks,row)[0].block_id,blocks[0].block_id);
});

test("selected context keeps a high-priority block whole", () => {
  const keyText = `Le Trail 12 km aura lieu le 8 novembre 2026. Départ à la salle des fêtes. Distance 12 km et dénivelé 450 m D+. ${"Informations utiles. ".repeat(15)}`;
  const distractors = Array.from({length:12},(_,index)=>`<h2>Archive ${index}</h2><p>${"Ancien résultat sans rapport. ".repeat(12)}</p>`).join("");
  const blocks = buildDocumentBlocks(`<h1>Trail des Roches</h1><p>${keyText}</p>${distractors}`,url);
  const selected = selectDocumentBlocks(blocks,row,{maxChars:1_200});
  const rendered = renderDocumentBlockContext(selected);
  assert.ok(selected.some(block=>block.text === keyText.trim()));
  assert.ok(rendered.includes(keyText.trim()));
});

test("mandatory repetition cannot evict all optional logistics", () => {
  const mandatory=Array.from({length:12},(_,index)=>`<h2>Distance ${index}</h2><p>Trail 12 km, distance 12 km. ${"Profil du parcours. ".repeat(70)}</p>`).join("");
  const blocks=buildDocumentBlocks(`${mandatory}<h2>Navette</h2><p>Navette depuis la gare dimanche matin.</p>`,url);
  const selected=selectDocumentBlocks(blocks,row,{maxChars:6_000});
  assert.ok(selected.some(block=>/Navette depuis la gare/.test(block.text)));
});

test("LLM claims must cite an exact provided block", () => {
  const [block]=buildDocumentBlocks("<h2>12 km</h2><p>Distance officielle 12 km.</p>",url);
  const base={field:"distance_km",value:12,evidence:"Distance officielle 12 km.",source_url:url};
  assert.equal(groundLlmClaimsToBlocks([{...base,block_id:"blk_unknown"}],[block]).length,0);
  assert.equal(groundLlmClaimsToBlocks([{...base,block_id:block.block_id}],[block]).length,1);
});
