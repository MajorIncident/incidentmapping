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
