import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createMakerPing, prepareEvent} from '@makerping/javascript';
import {createMakerPing as serverEntry} from '@makerping/javascript/server';
import {createMakerPing as browserEntry} from '@makerping/javascript/browser';

const token = 'mpc_sec_owner.' + 'a'.repeat(32) + '.' + 'b'.repeat(64);
const collector = token.replace('mpc_sec_', 'mpc_pub_');
const accepted = body => new Response(JSON.stringify({accepted: true, id: JSON.parse(body).id, duplicate: false}), {status: 201});

test('public package entries work in ESM and Node require', () => {
  assert.equal(createMakerPing, serverEntry);
  assert.equal(createRequire(import.meta.url)('@makerping/javascript').createMakerPing, createMakerPing);
  assert.equal(typeof browserEntry, 'function');
  const event = prepareEvent('integration_checked', {runtime: 'node'}, {environment: 'sandbox'});
  assert.equal(event.version, 1); assert.equal(event.environment, 'sandbox'); assert.ok(Object.isFrozen(event.properties));
});

test('a real request survives a lost acknowledgement without changing its envelope', async t => {
  const events = new Map(), bodies = []; let redirected = 0;
  const server = createServer(async (request, response) => {
    if (request.url === '/redirect-target') {redirected++; response.end('{}'); return;}
    let body = ''; for await (const part of request) body += part;
    assert.equal(request.headers.authorization, 'Bearer ' + token);
    const event = JSON.parse(body); bodies.push(body);
    const duplicate = events.has(event.id); events.set(event.id, event);
    if (bodies.length === 1) {request.socket.destroy(); return;}
    response.writeHead(duplicate ? 200 : 201, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({accepted: true, id: event.id, duplicate}));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  const ping = createMakerPing({token, endpoint: `http://127.0.0.1:${server.address().port}`, retryDelayMs: 0, environment: 'sandbox'});
  const receipt = await ping.track('integration_checked', {runtime: 'node'});
  assert.equal(receipt.accepted, true); assert.equal(receipt.duplicate, true); assert.equal(receipt.attempts, 2);
  assert.equal(events.size, 1); assert.equal(new Set(bodies).size, 1); assert.equal(redirected, 0);
  assert.equal([...events.values()][0].environment, 'sandbox');
});

test('credentials and sensitive event data fail before transport', async () => {
  let calls = 0; const fetch = async () => {calls++; throw new Error('Unexpected transport');};
  assert.throws(() => browserEntry({collector: token, fetch}));
  assert.throws(() => createMakerPing({token: collector, fetch}));
  const ping = createMakerPing({token, fetch});
  assert.equal((await ping.track('integration_checked', {email: 'test@example.invalid'})).reason, 'invalid_event');
  assert.equal(calls, 0);
});

test('server journal IDs are accepted while malformed receipts and redirects are refused', async () => {
  const event = prepareEvent('integration_checked', {}, {id: 'original-event'});
  const journal = createMakerPing({token, fetch: async () => new Response(JSON.stringify({accepted: true, id: 'c'.repeat(64), duplicate: false, environment:'production'}))});
  assert.deepEqual(await journal.send(event), {accepted:true, id:'c'.repeat(64), duplicate:false, attempts:1, status:200});
  for (const extra of [{id:''}, {id:'<invalid>'}, {duplicate:'false'}, {environment:'sandbox'}]) {
    const invalid = createMakerPing({token, fetch: async () => new Response(JSON.stringify({accepted:true, id:'c'.repeat(64), duplicate:false, ...extra}))});
    assert.equal((await invalid.send(event)).reason, 'invalid_response');
  }
  let options;
  const redirect = createMakerPing({token, fetch: async (_url, init) => {options = init; return new Response(null, {status: 307, headers: {Location: 'https://example.invalid'}});}});
  assert.equal((await redirect.send(event)).accepted, false); assert.equal(options.redirect, 'manual'); assert.equal(options.credentials, 'omit');
});

test('rate limits leave the original envelope available for a later durable retry', async () => {
  let calls = 0;
  const event = prepareEvent('integration_checked', {}, {environment: 'sandbox'});
  const ping = createMakerPing({token, fetch: async () => {calls++; return new Response('{}', {status: 429, headers: {'Retry-After': '60'}});}});
  const receipt = await ping.send(event);
  assert.equal(receipt.accepted, false); assert.equal(receipt.reason, 'rate_limited'); assert.equal(receipt.retryAfterMs, 60000); assert.equal(calls, 1);
  assert.equal(event.id, receipt.id); assert.equal(event.environment, 'sandbox');
});

test('browser consent controls both queued and new events without replaying refused actions', async () => {
  const bodies = [];
  const ping = browserEntry({collector, environment: 'sandbox', fetch: async (url, init) => {
    if (url.endsWith('/config')) return new Response(JSON.stringify({enabled: true, consent_required: true}));
    bodies.push(init.body); return accepted(init.body);
  }});
  assert.equal((await ping.track('export_completed')).reason, 'consent_required');
  ping.consent(true); assert.equal((await ping.track('export_completed', {format: 'pdf'})).accepted, true);
  ping.consent(false); assert.equal((await ping.track('export_completed')).reason, 'privacy_preference');
  ping.consent(true); await ping.flush(); assert.equal(bodies.length, 1);
  assert.equal(JSON.parse(bodies[0]).environment, 'sandbox');
});

test('GPC and public historical refusal prevent even configuration requests', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let calls = 0;
  const fetch = async () => {calls++; throw new Error('Unexpected transport');};
  try {
    Object.defineProperty(globalThis, 'navigator', {value: {globalPrivacyControl: true}, configurable: true});
    const ping = browserEntry({collector, fetch}); ping.consent(true);
    assert.equal(await ping.init(), false); assert.equal((await ping.track('export_completed')).accepted, false);
  } finally {if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator;}
  const event = prepareEvent('integration_checked', {}, {historical: true});
  assert.equal((await browserEntry({collector, fetch}).send(event)).reason, 'backfill_server_required'); assert.equal(calls, 0);
});
