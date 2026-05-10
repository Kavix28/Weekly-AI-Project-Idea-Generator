const http = require('http');
const WORKFLOW_ID = 'qcXogByfl67mjgO0';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d), cookies: res.headers['set-cookie'] || [] }); }
        catch(e) { resolve({ status: res.statusCode, body: d, cookies: [] }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function monitorExecution(execId, cookie) {
  console.log('Monitoring execution', execId);
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 15000));
    const exec = await httpRequest({
      hostname: 'localhost', port: 5678,
      path: `/rest/executions/${execId}?includeData=false`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    }, null);
    
    const d = exec.body && exec.body.data;
    const status = d && d.status;
    const finished = d && d.finished;
    console.log(`[${(i+1)*15}s] Status: ${status}, Finished: ${finished}`);
    
    if (finished || ['success','error','crashed'].includes(status)) {
      console.log('\n=== DONE:', status, '===');
      return { status, execId };
    }
  }
  return { status: 'timeout', execId };
}

async function main() {
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 5678, path: '/rest/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { emailOrLdapLoginId: 'admin@n8n.local', password: 'Admin1234!' });
  const cookie = loginRes.cookies.map(c => c.split(';')[0]).join('; ');
  console.log('Logged in');

  // Get workflow
  const wfRes = await httpRequest({
    hostname: 'localhost', port: 5678, path: `/rest/workflows/${WORKFLOW_ID}`, method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, null);
  const wf = wfRes.body.data || wfRes.body;
  const manualNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.manualTrigger');
  console.log('Trigger node:', manualNode && manualNode.name);

  // Run
  const runRes = await httpRequest({
    hostname: 'localhost', port: 5678, path: `/rest/workflows/${WORKFLOW_ID}/run`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
  }, {
    workflowData: wf,
    triggerToStartFrom: { name: manualNode.name },
    startNodes: [{ name: manualNode.name, sourceData: null }]
  });
  
  console.log('Run status:', runRes.status);
  const execId = runRes.body && runRes.body.data && runRes.body.data.executionId;
  console.log('Execution ID:', execId);
  
  if (execId) {
    const result = await monitorExecution(execId, cookie);
    if (result.status === 'error') {
      // Get error details
      const exec = await httpRequest({
        hostname: 'localhost', port: 5678,
        path: `/rest/executions/${execId}?includeData=false`,
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
      }, null);
      const d = exec.body && exec.body.data;
      console.log('stoppedAt:', d && d.stoppedAt);
    }
    console.log('\nFinal execution ID:', execId);
  }
}

main().catch(console.error);
