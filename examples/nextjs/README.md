# Next.js App Router sandbox test

In an existing Next.js app using Node.js 22.12+:

1. Install `@makerping/sdk@beta` after npm publication. During preparation, use the archive linked at [makerping.com/sdk](https://makerping.com/sdk).
2. Copy `route.ts` to `app/api/makerping-test/route.ts`.
3. Put your Server source's key in `.env.local` as `MAKERPING_INGEST_TOKEN`. Never use a `NEXT_PUBLIC_` variable for this key.
4. Start the app in development and send a POST:

```sh
curl -X POST http://localhost:3000/api/makerping-test
```

The route emits a fixed `integration_checked` sandbox signal. It accepts no event data from the request and returns 404 in production. Check the source's reception journal. The SDK is imported only by server code.

For a real integration, place tracking after your existing authenticated business action. Persist an occurrence in your own transaction/outbox when reliable delivery is required; an awaited SDK request alone is not durable delivery.
