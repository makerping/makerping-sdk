# Browser action with a public collector

Create a Website source with the exact origin of your site. Import `action.mjs` in your bundled frontend and call `connectActions()` with the source's public collector. Do not pass a private ingestion key.

Connect `setConsent(true)` to the actual consent decision when required, and `setConsent(false)` to withdrawal. Call `exportCompleted()` after a successful export. The example stays in sandbox; production statistics and alerts are unaffected.

Do Not Track, Global Privacy Control and explicit refusal prevent sends. The client adds no page view tracking, cookie, storage or visitor identity. Refused actions are not replayed.

For an unbundled site, use the classic script from MakerPing's Connection tab. Public collectors cannot authenticate confirmed sales or signups; use the server entry for those actions. Make sure your site's CSP permits MakerPing connections.
