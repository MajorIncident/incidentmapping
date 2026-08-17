# Component test synchronization

Interactions driven by `userEvent` can schedule React and React Flow updates that
finish after the event handler returns. Tests that verify a UI transition must
await the resulting UI state rather than immediately reading the old DOM.

- Use `await screen.findByRole(...)` or `await screen.findByText(...)` for
  elements that appear or change after an interaction.
- Use synchronous `getBy*` queries only when the element must already exist and
  no render-producing interaction has just occurred.
- Use `queryBy*` for assertions that an element is absent.
- Use `waitFor` for state expressed through attributes or multiple related
  assertions rather than adding arbitrary timeouts.
- Await every `userEvent` call. Wrap direct store mutations in `act(...)`.

Presentation tests are especially sensitive because their detail toggle updates
view-specific node data before React Flow rerenders the cards. Await both the
toggle's new accessible name and the detail content before continuing.

## Package and attachment fixtures

Keep plain JSON fixtures for versioned migration tests; they model legacy import,
not canonical saves. Canonical persistence tests should construct `.incidentmap`
bytes through `createIncidentPackage` or `fflate` with exactly one root
`map.json`, explicit `attachments/<safe-name>` entries, and manifest sizes that
match the byte arrays. Use intentionally hand-built ZIPs only for malformed,
unsafe-path, oversize, missing-payload, size-mismatch, or checksum-mismatch
cases. Clear `attachmentRuntimeStore` in `afterEach` so bytes, tombstones, Blob
URLs, and revision changes cannot leak between tests. Binary fixtures should be
small, synthetic, non-sensitive, and committed only when generation would hide
the behavior under test.

JSDOM does not decode images/video/PDF, implement browser PDF viewers/codecs, or
fully model object URL media loading. Component tests should assert the selected
element, accessible name/alert, focus trap/restoration, URL release, and
open/download fallback rather than successful decoding. Exercise actual inline
preview only in installed-browser tests, and allow for browser-specific codec or
PDF-viewer limitations. A package that passes schema and checksum validation is
not guaranteed to render inline in every browser.
