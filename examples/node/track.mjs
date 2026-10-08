import {createMakerPing} from '@makerping/sdk';

if (!process.env.MAKERPING_INGEST_TOKEN) {
  console.error('Set MAKERPING_INGEST_TOKEN in your server environment.');
  process.exitCode = 1;
} else {
  const ping = createMakerPing({
    token: process.env.MAKERPING_INGEST_TOKEN,
    ...(process.env.MAKERPING_ENDPOINT ? {endpoint: process.env.MAKERPING_ENDPOINT} : {}),
    environment: 'sandbox',
  });
  const receipt = await ping.track('integration_checked', {runtime: 'node'});
  console.log(receipt.accepted ? 'Sandbox event accepted. Open your reception journal.' : `Sandbox event not accepted: ${receipt.reason}.`);
  if (!receipt.accepted) process.exitCode = 1;
}
