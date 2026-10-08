# Changelog

## 0.1.0-beta.4

- Rename the JavaScript and TypeScript package to `@makerping/sdk-javascript` and the repository to `makerping-sdk-javascript`.
- Update all imports and examples; existing event envelopes, source access and API behavior remain compatible.
- Keep previous `@makerping/sdk` packages and immutable HTTPS archives available for existing integrations.

## 0.1.0-beta.3

- Prepare the public npm release with a `beta` distribution tag, explicit package files and standalone consumer tests.
- Validate receipt IDs and environment while preserving the server journal ID, which is distinct from the submitted occurrence ID.
- Add an explicit `historical: true` server option. Historical collection requires a compatible MakerPing backend; public browser collectors refuse it before any request.
- Add Node.js, Next.js and Cloudflare Workers sandbox examples.
- Preserve the event envelope across retries and persistent outbox delivery.

## 0.1.0-beta.2

- Public HTTPS archive, separate server and browser entries, TypeScript declarations.
- Bounded retries and request deadlines, `Retry-After`, explicit rejection receipts and refusal to follow redirects.
- Browser consent, Do Not Track and Global Privacy Control, with no automatic tracking or visitor storage.

## 0.1.0-beta.1

- Initial closed-beta HTTPS archive.
