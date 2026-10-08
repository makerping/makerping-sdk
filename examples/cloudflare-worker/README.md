# Cloudflare Workers sandbox test

Create a Server source in MakerPing, then copy `.dev.vars.example` to a private `.dev.vars` file with its ingestion key. After the npm beta release is available:

```sh
npm install --ignore-scripts
npm start
curl http://localhost:8787/__scheduled
```

Before npm publication, install the archive linked at [makerping.com/sdk](https://makerping.com/sdk). The local scheduled test emits `integration_checked` in sandbox. Open the source's reception journal. Ordinary HTTP requests return 404; the example config creates no recurring cron trigger.

The `global_fetch_strictly_public` compatibility flag permits public Worker-to-Worker fetch. For a deployed integration, save the ingestion key as a Worker secret, never in Wrangler JSON or the browser. Configure a schedule only if your own use case requires one. The SDK does not create infrastructure or durable delivery.

When sending after a business action, save the exact prepared event in a transactional outbox or your existing durable Queue, then deliver that envelope. `ctx.waitUntil(ping.send(event))` extends execution but does not guarantee recovery after a failed request.
