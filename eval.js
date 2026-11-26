// eval.js: scores keyword vs semantic search with MRR and Recall@10.
// Run: node eval.js
const fs = require('fs');

// --- 1. Load the inputs ----------------------------------------------------
// test-set.csv has a header row, then: query,correct_post_ids
// correct_post_ids may be a semicolon list, e.g. "1024;1025".
function loadTestSet(path) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n').slice(1);
  return lines.map(line => {
    const [query, ids] = line.trim().split(',');
    return { query, correctIds: ids.split(';').map(Number) };
  });
}
const testSet = loadTestSet('test-set.csv');

// search-results.json maps each query to the top-10 ranked post_id lists that
// each system returned: { "<query>": { keyword: [...], semantic: [...] } }
const results = JSON.parse(fs.readFileSync('search-results.json', 'utf8'));

// --- 2. Reciprocal Rank ----------------------------------------------------
// Helper: the 1-based rank of the first correct id, or null if it is a miss.
function rankOf(rankedIds, correctIds) {
  for (let i = 0; i < rankedIds.length; i++) {
    if (correctIds.includes(rankedIds[i])) return i + 1;
  }
  return null;
}

// 1 / (rank of the FIRST correct id), or 0 if none appear in the list.
function reciprocalRank(rankedIds, correctIds) {
  const rank = rankOf(rankedIds, correctIds);
  return rank === null ? 0 : 1 / rank;
}

// --- 3. Evaluation loop ----------------------------------------------------
const kwRRs = [], semRRs = [];
let kwHits = 0, semHits = 0;
const rows = [];

for (const { query, correctIds } of testSet) {
  const { keyword, semantic } = results[query];
  const kwRR = reciprocalRank(keyword, correctIds);
  const semRR = reciprocalRank(semantic, correctIds);
  kwRRs.push(kwRR);
  semRRs.push(semRR);
  if (kwRR > 0) kwHits++;
  if (semRR > 0) semHits++;
  rows.push({
    query,
    kwRank: rankOf(keyword, correctIds),
    semRank: rankOf(semantic, correctIds),
  });
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const keywordMRR = mean(kwRRs), semanticMRR = mean(semRRs);
const keywordRecall = kwHits / testSet.length;
const semanticRecall = semHits / testSet.length;

// --- 4. Markdown comparison table ------------------------------------------
const show = r => (r === null ? 'miss' : String(r));
console.log('| Query | Keyword rank | Semantic rank |');
console.log('|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.query} | ${show(r.kwRank)} | ${show(r.semRank)} |`);
}
console.log(
  `| **Summary** | **MRR ${keywordMRR.toFixed(2)} · Recall@10 ${keywordRecall.toFixed(2)}** | ` +
  `**MRR ${semanticMRR.toFixed(2)} · Recall@10 ${semanticRecall.toFixed(2)}** |`
);
