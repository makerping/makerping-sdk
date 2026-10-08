import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdtemp, mkdir, symlink, copyFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const token = 'mpc_sec_owner.' + 'a'.repeat(32) + '.' + 'b'.repeat(64);
const collector = token.replace('mpc_sec_', 'mpc_pub_');

async function consumerExample(t, relative) {
  const directory=await mkdtemp(join(tmpdir(),'makerping-example-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'node_modules/@makerping'),{recursive:true});
  await symlink(fileURLToPath(new URL('../',import.meta.url)),join(directory,'node_modules/@makerping/javascript'),'dir');
  await writeFile(join(directory,'package.json'),JSON.stringify({private:true,type:'module'}));
  const file=join(directory,'example.mjs');
  await copyFile(new URL('../examples/'+relative,import.meta.url),file);
  return file;
}

async function fixture(t) {
  const events = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const event = JSON.parse(raw); events.push(event);
    assert.equal(request.headers.authorization, 'Bearer ' + token);
    response.writeHead(201, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({accepted: true, id: event.id, duplicate: false}));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  return {endpoint: `http://127.0.0.1:${server.address().port}`, events};
}

test('the one-command Node example emits a sandbox signal through the public SDK entry', async t => {
  const {endpoint, events} = await fixture(t);
  const file=await consumerExample(t,'node/track.mjs');
  const child = spawn(process.execPath, [file], {
    env: {...process.env, MAKERPING_INGEST_TOKEN: token, MAKERPING_ENDPOINT: endpoint}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', value => {output += value;}); child.stderr.on('data', value => {output += value;});
  const [code] = await once(child, 'exit');
  assert.equal(code, 0); assert.match(output, /Sandbox event accepted/); assert.doesNotMatch(output, /mpc_sec/);
  assert.equal(events.length, 1); assert.equal(events[0].name, 'integration_checked'); assert.equal(events[0].environment, 'sandbox'); assert.deepEqual(events[0].properties, {runtime: 'node'});
});

test('the Worker example sends only its scheduled sandbox test and has no public HTTP trigger', async t => {
  const {endpoint, events} = await fixture(t);
  const {default:worker}=await import(pathToFileURL(await consumerExample(t,'cloudflare-worker/worker.mjs')));
  assert.equal(worker.fetch().status, 404); assert.equal(events.length, 0);
  await worker.scheduled({}, {MAKERPING_INGEST_TOKEN: token, MAKERPING_ENDPOINT: endpoint});
  assert.equal(events.length, 1); assert.equal(events[0].environment, 'sandbox'); assert.deepEqual(events[0].properties, {runtime: 'cloudflare'});
});

test('the browser example sends after explicit consent and a completed action', async t => {
  const {connectActions}=await import(pathToFileURL(await consumerExample(t,'browser/action.mjs')));
  const original = globalThis.fetch, events = [];
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/config')) return new Response(JSON.stringify({enabled: true, consent_required: true}));
    assert.equal(init.headers.Authorization, undefined); const event = JSON.parse(init.body); events.push(event);
    return new Response(JSON.stringify({accepted: true, id: event.id, duplicate: false}), {status: 201});
  };
  try {
    const actions = connectActions(collector);
    assert.equal((await actions.exportCompleted()).reason, 'consent_required');
    actions.setConsent(true); assert.equal((await actions.exportCompleted()).accepted, true);
    actions.setConsent(false); assert.equal((await actions.exportCompleted()).accepted, false);
    assert.equal(events.length, 1); assert.equal(events[0].environment, 'sandbox'); assert.deepEqual(events[0].properties, {format: 'pdf'});
  } finally {globalThis.fetch = original;}
});
