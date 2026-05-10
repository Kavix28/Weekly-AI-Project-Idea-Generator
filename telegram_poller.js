// Telegram long-polling bridge for n8n on localhost
// Run: node telegram_poller.js

const https = require('https');
const http = require('http');

const BOT_TOKEN = '8578602652:AAFG1Fcw3HUpRgk-eyI3btPgev3Gaq1YmFo';
const CHAT_ID = '1673048293';
const MAIN_WORKFLOW_ID = 'qcXogByfl67mjgO0';

let offset = 0;
let cookie = '';
let lastTriggerTime = 0;
const COOLDOWN_MS = 120000; // 2 min cooldown between runs

function tgReq(path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request({ hostname: 'api.telegram.org', path: `/bot${BOT_TOKEN}${path}`, method: data ? 'POST' : 'GET', headers }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    r.on('error', () => resolve({}));
    if (data) r.write(data);
    r.end();
  });
}

function n8nReq(options, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(options, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve({ s: res.statusCode, b: JSON.parse(d), c: res.headers['set-cookie'] || [] }); } catch(e) { resolve({ s: res.statusCode, b: d, c: [] }); } });
    });
    r.on('error', () => resolve({ s: 0, b: {}, c: [] }));
    if (data) r.write(data);
    r.end();
  });
}

async function login() {
  const res = await n8nReq({ hostname: 'localhost', port: 5678, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { emailOrLdapLoginId: 'admin@n8n.local', password: 'Admin1234!' });
  cookie = res.c.map(c => c.split(';')[0]).join('; ');
  console.log('[n8n] Logged in');
}

async function triggerWorkflow(chatId) {
  const now = Date.now();
  if (now - lastTriggerTime < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastTriggerTime)) / 1000);
    await tgReq('/sendMessage', { chat_id: chatId, text: `⏳ Please wait ${remaining}s before generating again.`, parse_mode: 'Markdown' });
    return null;
  }
  lastTriggerTime = now;

  if (!cookie) await login();
  const wfRes = await n8nReq({ hostname: 'localhost', port: 5678, path: `/rest/workflows/${MAIN_WORKFLOW_ID}`, method: 'GET', headers: { 'Content-Type': 'application/json', 'Cookie': cookie } }, null);
  const wf = wfRes.b.data || wfRes.b;
  const manualNode = wf.nodes && wf.nodes.find(n => n.type === 'n8n-nodes-base.manualTrigger');
  if (!manualNode) { console.log('[n8n] Manual trigger not found'); return null; }

  const runRes = await n8nReq({ hostname: 'localhost', port: 5678, path: `/rest/workflows/${MAIN_WORKFLOW_ID}/run`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie } }, {
    workflowData: wf,
    triggerToStartFrom: { name: manualNode.name },
    startNodes: [{ name: manualNode.name, sourceData: null }]
  });
  return runRes.b?.data?.executionId;
}

async function sendMessage(chatId, text) {
  return tgReq('/sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown' });
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  console.log(`[Telegram] "${text}" from ${chatId}`);

  if (text.toLowerCase() === 'give' || text === '/newideas') {
    await sendMessage(chatId,
      '🤖 *Project Idea Generator activated!*\n\n' +
      '⏳ Running full research pipeline...\n' +
      '📡 Scanning 7 sources in parallel\n' +
      '🧠 Generating 15 unique ideas via LLaMA-3.3\n' +
      '⚖️ Rating each idea via LLaMA-3.1\n\n' +
      '💬 Results will arrive in ~90 seconds.\n' +
      '☕ Perfect time for a quick coffee break!'
    );
    const execId = await triggerWorkflow(chatId);
    if (execId) console.log('[n8n] Triggered execution:', execId);
  } else if (text === '/status') {
    await sendMessage(chatId,
      '🤖 *Bot Status*\n\n' +
      '✅ Idea Generator: ACTIVE\n' +
      '🕗 Schedule: Monday + Thursday 08:00 AM\n' +
      '📡 Research sources: 7 parallel\n' +
      '🧠 Generator: LLaMA-3.3-70b\n' +
      '⚖️ Rater: LLaMA-3.1-8b\n' +
      '💰 Monthly cost: $0.00\n\n' +
      'Send *Give* to generate fresh ideas now!'
    );
  } else if (text === '/help') {
    await sendMessage(chatId,
      '🤖 *Project Idea Generator Bot*\n\n' +
      '*How to use:*\n' +
      'Send *Give* — Generate 5 new project ideas\n\n' +
      '*Other commands:*\n' +
      '/status — Check workflow status\n' +
      '/help — Show this message\n\n' +
      '*Automatic schedule:*\n' +
      '→ Every Monday at 08:00 AM\n' +
      '→ Every Thursday at 08:00 AM'
    );
  } else {
    await sendMessage(chatId, '❓ Send *Give* to generate 5 fresh project ideas.\n\n/status — Bot status\n/help — All commands');
  }
}

async function poll() {
  try {
    const res = await tgReq(`/getUpdates?offset=${offset}&timeout=25&allowed_updates=["message"]`, null);
    if (res.ok && res.result && res.result.length > 0) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        if (update.message) await handleMessage(update.message);
      }
    }
  } catch(e) {
    console.error('[poll error]', e.message);
    await new Promise(r => setTimeout(r, 5000));
  }
  setImmediate(poll);
}

async function main() {
  console.log('🤖 Telegram Poller starting...');

  // Clear webhook so polling works
  await tgReq('/deleteWebhook', { drop_pending_updates: false });

  // IMPORTANT: Skip all pending messages that arrived before we started
  // Get current update_id and set offset to skip them
  const updates = await tgReq('/getUpdates?limit=100', null);
  if (updates.ok && updates.result && updates.result.length > 0) {
    const lastId = updates.result[updates.result.length - 1].update_id;
    offset = lastId + 1;
    console.log(`[init] Skipped ${updates.result.length} old messages (offset set to ${offset})`);
  } else {
    console.log('[init] No pending messages to skip');
  }

  await login();

  console.log('✅ Polling active. Send "Give" to @kavix28bot\n');
  poll();
}

main().catch(console.error);
