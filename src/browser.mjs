import {createSender, endpointOrigin, transportOptions, trackWith, rejected, request} from './core.mjs';
export {prepareEvent} from './core.mjs';

export function createMakerPing(options = {}) {
  if (typeof options.collector !== 'string' || !/^mpc_pub_(owner|ws_[a-f0-9]{32})\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(options.collector)) {
    throw new TypeError('A public source collector is required. Never use a private token in a browser.');
  }
  if ('token' in options) throw new TypeError('Browser clients accept only a public collector.');
  const config = transportOptions(options), origin = endpointOrigin(options.endpoint), base = `${origin}/api/custom/${options.collector}`;
  const sender = createSender(config, `${base}/collect`);
  let consent = null, epoch = 0, configuration = null, loading = null;
  const privacy = () => globalThis.navigator?.doNotTrack === '1' || globalThis.navigator?.globalPrivacyControl === true || consent === false;
  async function init() {
    if (privacy()) return false;
    if (configuration) return configuration.enabled;
    if (loading) return loading;
    loading = (async () => {
      try {
        const {response, data} = await request(config, `${base}/config`, {method: 'GET', cache: 'no-store'});
        if (!response.ok || typeof data?.enabled !== 'boolean' || typeof data?.consent_required !== 'boolean') return false;
        configuration = {enabled: data.enabled, consentRequired: data.consent_required};
        return configuration.enabled;
      } catch { return false; }
      finally { loading = null; }
    })();
    return loading;
  }
  async function send(event) {
    if(event?.historical)return rejected('backfill_server_required',event.id);
    if (privacy()) return rejected('privacy_preference');
    const currentEpoch = epoch;
    return sender.send(event, async () => {
      if (currentEpoch !== epoch || privacy()) return 'consent_denied';
      if (!await init()) return 'connection_unavailable';
      if (currentEpoch !== epoch || privacy()) return 'consent_denied';
      if (configuration.consentRequired && consent !== true) return 'consent_required';
      return null;
    });
  }
  function setConsent(value) {
    if (typeof value !== 'boolean') throw new TypeError('Consent must be true or false.');
    consent = value;
    if (!value) { epoch++; sender.cancel('consent_denied'); }
  }
  return Object.freeze({init, track: trackWith(send, config.environment), send, flush: sender.flush, consent: setConsent});
}
