const text = value => String(value ?? "");
export const canonicalClaimValue = value => {
  if (value === null || value === undefined) return text(value);
  if (Array.isArray(value)) return `[${value.map(canonicalClaimValue).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalClaimValue(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

export const stableClaimOrder = (left, right) => {
  const methodRank = method => method === "deterministic" ? 3 : method === "deterministic_inferred_year" ? 2 : 1;
  return Number(right.specificity || 0) - Number(left.specificity || 0)
    || methodRank(right.method) - methodRank(left.method)
    || text(left.source_url).localeCompare(text(right.source_url))
    || text(left.evidence).localeCompare(text(right.evidence))
    || canonicalClaimValue(left.value).localeCompare(canonicalClaimValue(right.value));
};

const connectedComponents = (claims, equivalent) => {
  const parents = claims.map((_, index) => index);
  const find = index => parents[index] === index ? index : (parents[index] = find(parents[index]));
  const union = (left, right) => {
    const a = find(left), b = find(right);
    if (a !== b) parents[Math.max(a, b)] = Math.min(a, b);
  };
  for (let left = 0; left < claims.length; left += 1) {
    for (let right = left + 1; right < claims.length; right += 1) {
      if (equivalent(claims[left], claims[right])) union(left, right);
    }
  }
  const groups = new Map();
  claims.forEach((claim, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(claim);
  });
  return [...groups.values()];
};

const publicSupport = claim => ({
  value: claim.value,
  evidence: claim.evidence,
  context: claim.context || "",
  source_url: claim.source_url,
  method: claim.method || "llm",
  specificity: claim.specificity,
  ...(claim.format_label ? {format_label: claim.format_label} : {}),
  ...(claim.confidence ? {reported_confidence: claim.confidence} : {}),
  ...(claim.rationale ? {rationale: claim.rationale} : {}),
});

/**
 * Resolve already validated claims as a set. The outcome is independent from the
 * order in which deterministic and semantic extractors produced their claims.
 * Reported LLM confidence is retained for audit only and never affects ranking.
 */
export const resolveClaimLedger = (claims, {
  equivalent = (_field, left, right) => canonicalClaimValue(left) === canonicalClaimValue(right),
  representativeOrder = (_field, left, right) => stableClaimOrder(left, right),
} = {}) => {
  const proofs = {};
  const rejected = [];
  const conflicts = new Set();
  const fields = [...new Set(claims.map(claim => claim.field))].sort();

  for (const field of fields) {
    const fieldClaims = claims.filter(claim => claim.field === field).sort(stableClaimOrder);
    const clusters = connectedComponents(fieldClaims, (left, right) => equivalent(field, left.value, right.value));
    const summaries = clusters.map(items => {
      const ordered = [...items].sort((left, right) => representativeOrder(field, left, right));
      const maxSpecificity = Math.max(...ordered.map(item => Number(item.specificity || 0)));
      const representatives = ordered.filter(item => Number(item.specificity || 0) === maxSpecificity);
      const representative = representatives[0];
      return {items: ordered, representative, maxSpecificity};
    }).sort((left, right) => right.maxSpecificity - left.maxSpecificity
      || representativeOrder(field, left.representative, right.representative));

    const bestSpecificity = summaries[0].maxSpecificity;
    const strongest = summaries.filter(cluster => cluster.maxSpecificity === bestSpecificity);
    const winner = strongest[0];
    if (strongest.length > 1) conflicts.add(field);

    const support = winner.items.map(publicSupport);
    const distinctSupport = new Set(support.map(item=>[item.source_url,item.evidence,canonicalClaimValue(item.value)].join("\u0000")));
    const representative = winner.representative;
    proofs[field] = {
      value: representative.value,
      evidence: representative.evidence,
      context: representative.context || "",
      source_url: representative.source_url,
      method: representative.method || "llm",
      status: "verified",
      edition_year: representative.edition_year || "",
      specificity: representative.specificity,
      support_count: distinctSupport.size,
      extraction_count: support.length,
      source_count: new Set(support.map(item => item.source_url).filter(Boolean)).size,
      supporting_claims: support,
    };

    for (const cluster of summaries) {
      if (cluster === winner) continue;
      const reason = cluster.maxSpecificity === bestSpecificity
        ? "conflicting_verified_values"
        : "lower_format_specificity";
      for (const claim of cluster.items) rejected.push({...claim, reason});
    }
  }

  return {proofs, rejected, conflicts};
};
