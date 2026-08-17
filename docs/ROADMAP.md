# Roadmap

## Delivered

- [x] **V4 investigation model:** strict validation/migration; stable node,
      Evidence, Control, and Attachment allocation; Timeline-Only Events and
      duration; Action completion; Factor/Control Assertion State; Text, Chip,
      and Metric Context display.
- [x] **Local package persistence:** canonical `.incidentmap` ZIP save/open with
      root V4 `map.json`, bundled attachments, checksums, centralized limits,
      recoverable attachment warnings, and legacy V1–V4 JSON import.
- [x] **Evidence review:** global Evidence references, HTTP(S) links, attachment
      management, and accessible image/video/PDF preview with mobile sizing and
      unavailable-content behavior.
- [x] **Derived presentation:** Overview, Causal Story, Chronology, Controls,
      Actions, and Evidence lenses; Case Summary; and deterministic Guided Story
      assembled automatically from persisted investigation data.
- [x] **Accessible responsive workflow:** keyboard commands, labeled controls,
      focus-managed dialogs, mobile inspector and chronology presentation,
      touch-sized controls, zoom/responsive browser coverage, undo/redo, and
      deterministic graph layout.

## Future work and explicit non-goals

- [ ] **Visual/report export:** presentation-quality PNG and paginated PDF or
      formal reports remain future work. Presentation mode is not an exported
      report, certification artifact, or reporting database.
- [ ] **Collaboration/services:** cloud or shared storage, synchronization,
      accounts, identity, permissions, review workflow, server retention,
      audit logs, and hosted backups are not current capabilities.
- [ ] **Automation/integration:** AI-generated summaries or conclusions,
      configurable external imports, reporting databases, and third-party
      integrations are not implemented. Derived Case Summary is not an AI
      summary.
- [ ] **Story authoring:** Guided Story is automatically derived. Manual story
      building, authored slides, narrative persistence, and custom ordering are
      explicit non-goals for the current release.
- [ ] **File assurances:** package encryption/signing, password protection,
      malware scanning, and authenticity guarantees are not provided.

Delivered schema compatibility is not regulatory compliance. Roadmap entries
describe intent and do not promise certification or dates.
