import 'server-only';
import {createMakerPing} from '@makerping/sdk';

// Copy to app/api/makerping-test/route.ts. This test route is local only.
export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') return new Response(null, {status: 404});
  const token = process.env.MAKERPING_INGEST_TOKEN;
  if (!token) return Response.json({error: 'Configure MAKERPING_INGEST_TOKEN in .env.local.'}, {status: 503});
  const ping = createMakerPing({
    token,
    ...(process.env.MAKERPING_ENDPOINT ? {endpoint: process.env.MAKERPING_ENDPOINT} : {}),
    environment: 'sandbox',
  });
  const receipt = await ping.track('integration_checked', {runtime: 'nextjs'});
  return Response.json(receipt, {status: receipt.accepted ? 200 : 502});
}
