const environments = new Set(['production', 'sandbox']);
const plain = value => value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const deniedKey = /^(?:__proto__|prototype|constructor|password|secret|token|authorization|email|phone|ip|user_email|user_name|full_name|address)$/i;
const invalid = () => { throw new TypeError('Invalid MakerPing event. Use an opaque occurrence ID and scalar business properties, without secrets or contact details.'); };
export const rejected = (reason, id, extra = {}) => ({accepted: false, reason, ...(id ? {id} : {}), ...extra});

export function normalizeEvent(value) {
  if (!plain(value) || Object.keys(value).some(key => !['version', 'id', 'name', 'occurred_at', 'environment', 'properties', 'historical'].includes(key))) invalid();
  const {id, name, occurred_at, version = 1, environment = 'production', properties = {}} = value;
  if (version !== 1 || typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(id)) invalid();
  if(value.historical!==undefined&&typeof value.historical!=='boolean')invalid();
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}$/.test(name) || !environments.has(environment)) invalid();
  if (typeof occurred_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(occurred_at)) invalid();
  const date = Date.parse(occurred_at), age = Date.now() - date;
  if (!Number.isFinite(date) || age > 90 * 86400000 || age < -300000) invalid();
  if (!plain(properties) || Object.keys(properties).length > 32) invalid();
  for (const [key, property] of Object.entries(properties)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(key) || deniedKey.test(key)) invalid();
    if (property !== null && !['string', 'number', 'boolean'].includes(typeof property)) invalid();
    if (typeof property === 'number' && (!Number.isFinite(property) || Math.abs(property) > Number.MAX_SAFE_INTEGER)) invalid();
    if (typeof property === 'string' && (property.length > 500 || /[\x00-\x1f\x7f]/.test(property) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(property))) invalid();
  }
  const event = {version: 1, id, name, occurred_at: new Date(date).toISOString(), environment, properties: Object.freeze({...properties}),...(value.historical?{historical:true}:{})};
  if (new TextEncoder().encode(JSON.stringify(event)).length > 16384) invalid();
  return Object.freeze(event);
}

export function prepareEvent(name, properties = {}, options = {}) {
  if (!plain(options) || Object.keys(options).some(key => !['id', 'occurred_at', 'environment', 'historical'].includes(key))) invalid();
  return normalizeEvent({version: 1, id: options.id ?? globalThis.crypto.randomUUID(), name,
    occurred_at: options.occurred_at ?? new Date().toISOString(), environment: options.environment ?? 'production', properties,...(options.historical!==undefined?{historical:options.historical}:{})});
}

export function endpointOrigin(endpoint = 'https://makerping.com') {
  const url = new URL(endpoint);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || url.protocol === 'http:' && local)) {
    throw new TypeError('MakerPing endpoint must be an HTTPS origin, or an HTTP loopback origin for local development.');
  }
  return url.origin;
}

export function transportOptions(options) {
  // WebKit requires Window.fetch to keep its original receiver.
  const fetcher = options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required.');
  const config = {fetch: fetcher, timeoutMs: options.timeoutMs ?? 3000, maxAttempts: options.maxAttempts ?? 3,
    retryDelayMs: options.retryDelayMs ?? 250, maxRetryDelayMs: options.maxRetryDelayMs ?? 10000,
    maxPending: options.maxPending ?? 100, environment: options.environment ?? 'production'};
  for (const [key, minimum, maximum] of [['timeoutMs', 1, 60000], ['maxAttempts', 1, 5], ['retryDelayMs', 0, 60000], ['maxRetryDelayMs', 0, 60000], ['maxPending', 1, 1000]]) {
    if (!Number.isInteger(config[key]) || config[key] < minimum || config[key] > maximum) throw new TypeError('Invalid MakerPing transport options.');
  }
  if (!environments.has(config.environment)) throw new TypeError('Invalid MakerPing environment.');
  return config;
}

export async function request(config, url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    // Never follow a redirect with ingestion credentials. Non-success responses
    // are rejected by the sender; manual mode also works in edge runtimes.
    const response = await config.fetch(url, {...init, redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal});
    let data;
    try { data = await response.json(); } catch { /* Invalid success responses must never acknowledge delivery. */ }
    return {response, data};
  } finally { clearTimeout(timer); }
}

function retryAfter(value) {
  if (!value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export function createSender(config, url, headers = {}) {
  const queue = [];
  let active = false;
  const waiters = [];
  async function deliver(event, guard) {
    const body = JSON.stringify(event);
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const blocked = await guard?.();
      if (blocked) return rejected(blocked, event.id, {attempts: attempt - 1});
      let response, data;
      try { ({response, data} = await request(config, url, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body})); } catch { /* Network failures are reported without exposing request details. */ }
      if (response?.ok) {
        // The server receipt ID identifies the workspace-scoped journal row;
        // it is distinct from the occurrence ID in the submitted envelope.
        if (data?.accepted === true && typeof data.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(data.id) && typeof data.duplicate === 'boolean' && (data.environment === undefined || data.environment === event.environment)) {
          return {accepted: true, id: data.id, duplicate: data.duplicate, attempts: attempt, status: response.status};
        }
        return rejected('invalid_response', event.id, {attempts: attempt, status: response.status});
      }
      const retryable = !response || response.status === 429 || response.status >= 500;
      const delay = Math.max(retryAfter(response?.headers.get('Retry-After')), config.retryDelayMs * 2 ** (attempt - 1));
      const code=typeof data?.error?.code==='string'&&/^[a-z_]{1,60}$/.test(data.error.code)?data.error.code:null;
      const extra = {attempts: attempt, ...(response ? {status: response.status} : {}), ...(delay ? {retryAfterMs: delay} : {}), ...(code?{code}:{})};
      if (!retryable) return rejected('event_rejected', event.id, extra);
      if (attempt === config.maxAttempts || delay > config.maxRetryDelayMs) return rejected(response?.status === 429 ? 'rate_limited' : 'delivery_failed', event.id, extra);
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  async function drain() {
    if (active) return;
    active = true;
    try {
      while (queue.length) {
        const job = queue.shift();
        try { job.resolve(await deliver(job.event, job.guard)); } catch { job.resolve(rejected('delivery_failed', job.event.id)); }
      }
    } finally {
      active = false;
      for (const resolve of waiters.splice(0)) resolve();
    }
  }
  function send(value, guard) {
    let event;
    try { event = normalizeEvent(value); } catch { return Promise.resolve(rejected('invalid_event')); }
    if (queue.length + Number(active) >= config.maxPending) return Promise.resolve(rejected('queue_full', event.id));
    return new Promise(resolve => { queue.push({event, guard, resolve}); void drain(); });
  }
  function cancel(reason) { for (const job of queue.splice(0)) job.resolve(rejected(reason, job.event.id)); }
  return {send, cancel, flush: () => active || queue.length ? new Promise(resolve => waiters.push(resolve)) : Promise.resolve()};
}

export function trackWith(send, environment) {
  return (name, properties = {}, options = {}) => {
    try { return send(prepareEvent(name, properties, {environment, ...options})); }
    catch { return Promise.resolve(rejected('invalid_event')); }
  };
}
