# Roadmap

- [x] **Foundation:** Canvas, local JSON persistence, strict validation,
      deterministic migration, tooling, and smoke tests.
- [x] **Investigation Workflow:** Richer investigation semantics across Impact,
      Event and Event Phase, Factor/Key Factor/Root Cause, Control and Control
      Role, Action and Action Type, global Evidence Registry with linked
      references, Incident/node Context, chronology (including untimed Events),
      deterministic Action layout, history, and read-only presentation mode.
- [ ] **Visual Export:** Presentation-quality PNG and visual PDF/reporting remain
      future work. A future export should explicitly compose Incident Context,
      Event chronology, the Evidence Registry, Control roles, Action types, and
      linked evidence references, alongside incident identity and a readable
      presentation map. Pagination, repeated incident identity, map scaling,
      Evidence/Control summaries, and an Action register require dedicated
      design and implementation; current Presentation mode is not an export or
      report capability.
- [ ] **Collaboration:** Shared-storage, identity, permissions, audit, and review
      decisions remain future work; they are not current capabilities.
- [ ] **Interoperability:** Configurable imports, summaries, and integrations
      remain future work after the V3 contract is established in production use.

Roadmap items describe product intent, not implemented capability,
certification, or regulatory compliance. Future work depends on finalized
schema and interaction decisions.
