# Node.js sandbox test

Create a Server source in MakerPing. Copy `.env.example` to a private `.env` file and replace the placeholder with that source's ingestion key. Then:

```sh
npm install --ignore-scripts
npm start
```

Requires Node.js 22.12+ and the npm beta release. Before registry publication, install the SDK archive linked at [makerping.com/sdk](https://makerping.com/sdk) instead.

`integration_checked` is a sandbox signal with only a runtime label. Open your source's reception journal to verify it. No signup or payment is simulated and no production alert is sent. If the test fails, the process exits with code 1.

In your application, create one client per source, send after a confirmed business action and set the intended environment explicitly. Use a transactional outbox for delivery that must survive a restart. The example is a one-shot connection test, not a persistent delivery service.
