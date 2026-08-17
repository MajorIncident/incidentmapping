# Incident Mapping

Incident Mapping is a browser-based visual workspace for documenting an
incident's causal story, Controls, Actions, Context, and supporting Evidence.
The canonical local file is a self-contained `.incidentmap` ZIP package with a
strict V4 `map.json` and attachment binaries. Existing V1–V3 JSON maps remain
available through deterministic legacy JSON import; JSON export is metadata
only and is not the canonical save format.

Evidence can link reusable records to nodes and Controls, attach JPEG, PNG,
WebP, PDF, MP4, or WebM files, link HTTP(S) sources, and preview available image,
video, and PDF bytes without uploading them to a service.

Presentation provides six derived, read-only lenses: **Overview**, **Causal
Story**, **Chronology**, **Controls**, **Actions**, and **Evidence**. **Case
Summary** assembles investigation counts and key lists. **Guided Story** walks
persisted causal paths, relevant Controls, Actions, Evidence, and attachments;
it is deterministic, not AI-generated or manually authored. Display choices do
not change causality.

The interface supports keyboard operation and focus-managed dialogs, responsive
mobile inspector/chronology behavior, large touch targets, and zoomed layouts.
Package size/path/media validation, recoverable attachment warnings, preview
fallbacks, and security restrictions are documented supported behavior.

## Documentation

- [Canonical V4 map schema](docs/MAP_SCHEMA.md)
- [Canonical package/file format](docs/FILE_FORMAT.md)
- [Application architecture](docs/ARCHITECTURE.md)
- [Investigation model and causal semantics](docs/INVESTIGATION_MODEL.md)
- [Product roadmap and explicit non-goals](docs/ROADMAP.md)
