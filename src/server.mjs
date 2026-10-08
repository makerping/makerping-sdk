import {createSender, endpointOrigin, transportOptions, trackWith} from './core.mjs';
export {prepareEvent} from './core.mjs';

export function createMakerPing(options = {}) {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') throw new TypeError('Use @makerping/sdk/browser in a browser.');
  const match = typeof options.token === 'string' && options.token.match(/^mpc_sec_(owner|ws_[a-f0-9]{32})\.([a-f0-9]{32})\.[a-f0-9]{64}$/);
  if (!match) throw new TypeError('A private source ingestion token is required. Agent and browser tokens are not accepted.');
  const config = transportOptions(options), origin = endpointOrigin(options.endpoint);
  const sender = createSender(config, `${origin}/api/custom/${match[1]}.${match[2]}/events`, {Authorization: `Bearer ${options.token}`});
  return Object.freeze({track: trackWith(sender.send, config.environment), send: sender.send, flush: sender.flush});
}
