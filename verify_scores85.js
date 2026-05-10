const sqlite3Path = 'C:/Users/chris/AppData/Roaming/npm/node_modules/n8n/node_modules/sqlite3';
const sqlite3 = require(sqlite3Path);
const DB_PATH = 'C:\\Users\\chris\\.n8n\\database.sqlite';
const EXEC_ID = '85';

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

db.get(`SELECT data FROM execution_data WHERE "executionId" = ?`, [EXEC_ID], (err, row) => {
  if (err || !row) { console.log('No row'); db.close(); return; }

  const parsed = JSON.parse(row.data);

  function resolve(val, depth = 0) {
    if (depth > 200) return '[DEPTH_LIMIT]';
    if (val === null || val === undefined) return val;
    if (typeof val === 'boolean' || typeof val === 'number') return val;
    if (typeof val === 'string') {
      const n = parseInt(val);
      if (!isNaN(n) && String(n) === val && n >= 0 && n < parsed.length) {
        return resolve(parsed[n], depth + 1);
      }
      return val;
    }
    if (Array.isArray(val)) return val.map(v => resolve(v, depth + 1));
    if (typeof val === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        out[resolve(k, depth + 1)] = resolve(v, depth + 1);
      }
      return out;
    }
    return val;
  }

  const full = resolve(parsed[0]);
  const rd = full.resultData;

  console.log('lastNodeExecuted:', rd.lastNodeExecuted);

  // All 15 rated ideas
  const mergeData = rd.runData && rd.runData['Merge Ratings Into Ideas'];
  if (mergeData) {
    const items = mergeData[0]?.data?.main?.[0] || [];
    console.log(`\n=== ALL ${items.length} RATED IDEAS ===`);
    items.forEach((item, i) => {
      const j = item.json;
      console.log(`  [${i+1}] ${j.project_name}`);
      console.log(`    score=${j.final_score} | verdict=${j.verdict} | impact=${j.real_world_impact} | unique=${j.uniqueness_score} | stars=${j.star_potential}`);
    });

    const scores = items.map(i => i.json.final_score);
    const verdicts = items.map(i => i.json.verdict);
    const uniqueScores = new Set(scores.map(s => String(s)));
    const buildItCount = verdicts.filter(v => v === 'BUILD IT').length;
    const maybeCount = verdicts.filter(v => v === 'MAYBE').length;
    const skipCount = verdicts.filter(v => v === 'SKIP IT').length;

    console.log('\n=== SCORE ANALYSIS ===');
    console.log('All scores:', scores.join(', '));
    console.log('Unique scores:', uniqueScores.size, '/ 15');
    console.log('Score range:', Math.min(...scores), 'to', Math.max(...scores));
    console.log('BUILD IT:', buildItCount, '| MAYBE:', maybeCount, '| SKIP IT:', skipCount);
  }

  // Top 5
  const rankData = rd.runData && rd.runData['Add Rank Numbers'];
  if (rankData) {
    const items = rankData[0]?.data?.main?.[0] || [];
    console.log(`\n=== TOP 5 (Add Rank Numbers) ===`);
    items.forEach(item => {
      const j = item.json;
      console.log(`  Rank ${j.rank}: ${j.project_name} | score=${j.final_score} | ${j.verdict}`);
      console.log(`    ${(j.rating_reasoning || '').substring(0, 120)}`);
    });
  }

  db.close();
});
