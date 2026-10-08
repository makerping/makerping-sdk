import {createMakerPing} from '@makerping/sdk';

export default {
  async scheduled(_controller, env) {
    const ping = createMakerPing({
      token: env.MAKERPING_INGEST_TOKEN,
      ...(env.MAKERPING_ENDPOINT ? {endpoint: env.MAKERPING_ENDPOINT} : {}),
      environment: 'sandbox',
    });
    const receipt = await ping.track('integration_checked', {runtime: 'cloudflare'});
    if (!receipt.accepted) throw new Error(`MakerPing sandbox test not accepted: ${receipt.reason}.`);
    console.log('MakerPing sandbox event accepted. Open your reception journal.');
  },
  fetch() {
    return new Response('Use the local /__scheduled test endpoint. This example has no public event trigger.', {status: 404});
  },
};
