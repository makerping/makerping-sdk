# MakerPing SDK

Send the business events you choose to your MakerPing activity feed. JavaScript with TypeScript declarations, separate server and browser entries, no dependencies and no installation scripts. MIT licensed.

A MakerPing beta account and a connected source are required. Account registration is currently closed. The SDK does not create an account or collect page views automatically. See the [integration guide](https://makerping.com/sdk) for access and current release availability.

## Install

```sh
npm install @makerping/sdk@beta
```

Pin an exact version in applications and commit your lockfile. An immutable HTTPS archive is also available from the integration guide. The server entry supports Node.js 22.12+ and Cloudflare Workers; the browser entry works with modern browsers and a bundler. Both entries use native `fetch`.

## Your first server event

Create a **Server** source in MakerPing and save its private ingestion key in `MAKERPING_INGEST_TOKEN`, in your server environment. This key can only send to that source; it cannot read account data or change settings.

```js
import {createMakerPing} from '@makerping/sdk';

const ping = createMakerPing({
  token: process.env.MAKERPING_INGEST_TOKEN,
  environment: 'sandbox',
});

const receipt = await ping.track('integration_checked', {runtime: 'node'});
if (!receipt.accepted) {
  console.warn('MakerPing test not accepted:', receipt.reason);
}
```

Open the source's reception journal. A sandbox event tests the complete connection without changing production statistics or sending alerts. Give the event a label and choose whether it belongs in your feed. Then set `environment: 'production'` in the integration that emits real confirmed actions. The SDK's default environment is production, so set it explicitly when testing.

A successful receipt means MakerPing stored the occurrence, not that a push notification reached a device. Tracking delivery should remain outside the critical path of a signup, payment or other business action.

## Examples

- [Node.js](https://github.com/makerping/makerping-sdk/tree/main/examples/node): a complete one-command sandbox test.
- [Next.js](https://github.com/makerping/makerping-sdk/tree/main/examples/nextjs): a local App Router route, with its token on the server.
- [Cloudflare Workers](https://github.com/makerping/makerping-sdk/tree/main/examples/cloudflare-worker): a scheduled test with Worker secrets.
- [Browser](https://github.com/makerping/makerping-sdk/tree/main/examples/browser): an explicit action and consent, using a public collector.

Examples live in the source repository; the installed package contains only the SDK, declarations, README, changelog and license.

## Browser

Create a **Website** source with your exact HTTPS origin. Import the browser entry in your bundled frontend and use its public collector, never a private ingestion key.

```js
import {createMakerPing} from '@makerping/sdk/browser';

const ping = createMakerPing({
  collector: 'YOUR_PUBLIC_COLLECTOR',
  environment: 'sandbox',
});

// Run only after a real consent decision, when required by your source.
ping.consent(true);
const receipt = await ping.track('export_completed', {format: 'pdf'});

// On withdrawal:
ping.consent(false);
```

The client respects the source's consent setting, Do Not Track, Global Privacy Control and explicit refusal. It adds no cookies, local storage, visitor identifiers, referrer collection or automatic events. Refused events are not replayed. Withdrawing consent does not delete events already stored.

A public collector cannot prove that a signup or sale really occurred. Send confirmed business actions from a server. Without a bundler, use the classic script from the source's Connection tab. Your CSP must permit the script and MakerPing connections.

## Delivery across restarts

Retries preserve the complete event, including its ID, timestamp and properties. The SDK's queue lives in memory. For durable delivery, prepare the event and persist it in an outbox in the same database transaction as the successful business action:

```js
import {prepareEvent} from '@makerping/sdk';

const event = prepareEvent('export_completed', {format: 'pdf'}, {
  id: opaqueOccurrenceId,
});
await outbox.save(event); // Commit with the successful business action.

const receipt = await ping.send(event);
if (receipt.accepted) await outbox.acknowledge(event.id);
```

`outbox` and `opaqueOccurrenceId` are your application's storage and occurrence identity, not SDK APIs. A retry must use the original envelope. Reusing an ID with a changed body or timestamp causes a 409 conflict. Keep failed occurrences for an explicit retry or diagnosis; do not create a new ID for every attempt.

`flush()` waits for pending in-memory sends. A stopped process or closed tab can lose pending work. In a Worker, `ctx.waitUntil()` extends work beyond the response; it does not replace a durable queue or transactional outbox. This package does not provision infrastructure.

## Receipts and errors

`track()` and `send()` resolve to an accepted or rejected receipt. `prepareEvent()` and invalid client configuration throw `TypeError` before transport.

An accepted receipt's `id` identifies the stored row in MakerPing's journal. It differs from your occurrence ID. Keep `event.id` as your outbox key; rejected receipts use that submitted ID when available.

| Result | Meaning and next step |
| --- | --- |
| `accepted: true` | Occurrence stored. `duplicate: true` means an unchanged resend was already received. |
| `invalid_event` | Correct the name, timestamp, ID or properties before sending. |
| `invalid_response` | The response was not a valid acceptance receipt. Keep the original event. |
| `rate_limited` | Respect `retryAfterMs`; keep the original envelope for a later retry. |
| `delivery_failed` | Attempts exhausted or delay too long. Resume through your durable queue. |
| `queue_full` | The in-memory queue is full. Apply backpressure in your application. |
| `event_rejected` | Inspect `status` and the bounded `code`, if present. Resolve source access or event conflict. |
| `consent_required` / `privacy_preference` / `consent_denied` | Do not resend refused browser actions. |

Network failures, HTTP 429 and 5xx can be retried within the configured bounds. Other 4xx responses are not retried. The SDK checks the acceptance flag, receipt ID, duplicate flag and environment when returned. HTTP redirects are never followed. A response body, token or contact detail is not copied into error receipts.

## Options

| Option | Default |
| --- | --- |
| `endpoint` | `https://makerping.com` |
| `environment` | `production` |
| `timeoutMs` | 3,000 per request |
| `maxAttempts` | 3 |
| `retryDelayMs` | 250 initial exponential delay |
| `maxRetryDelayMs` | 10,000 |
| `maxPending` | 100 |
| `fetch` | Native `fetch`, or your explicit implementation |

`endpoint` must be an HTTPS origin. HTTP is accepted only for localhost, 127.0.0.1 or ::1. Cookies and redirects are refused. Sends are serialized and bounded; a longer `Retry-After` returns without retrying early.

Cloudflare Workers making public Worker-to-Worker requests should configure `global_fetch_strictly_public`, as in the example. See [Cloudflare's fetch documentation](https://developers.cloudflare.com/workers/runtime-apis/fetch/).

## Data and service limits

Names are explicit, such as `export_completed` or `level_completed`. Properties are scalar strings, numbers, booleans or null, with at most 32 keys and a 16 KiB event envelope. Use an opaque ID for each occurrence, without an email, player identity or other identifying data. Timestamps must be within the last 90 days and no more than five minutes ahead.

Validation rejects common sensitive keys and email-like values. It cannot identify every kind of personal data. Choose your properties deliberately; do not send contacts, secrets or personal identifiers.

The deployed closed beta has technical admission limits of 1,000 requests/minute/source and 20,000/day/workspace, including duplicate requests. Other event budgets, access conditions and retention limits are displayed by the connected MakerPing service. Prepared pricing changes are not an entitlement granted by installing this SDK.

### Historical events

`historical: true` is a server-only capability requiring a compatible MakerPing backend. It is not enabled on the currently deployed beta backend. Do not send historical events to that backend until the service confirms support.

With a compatible service, preserve the original ID and timestamp and pass the flag to `prepareEvent()` or `track()`. Keep the flag on retries. Browser clients refuse this flag before any network request. The installed package cannot enable historical collection by itself.

## Development

```sh
npm test
npm pack --ignore-scripts
```

The standalone tests need Node.js 22.12+ and no external service. They use synthetic credentials and loopback HTTP, never a real MakerPing account. See [CHANGELOG.md](CHANGELOG.md) for changes. Production integrations should upgrade deliberately and retain their original occurrence envelopes through retries.
