# Incident Mapping Architecture

## Persistence boundary

Strict V5 `MapData` is the canonical document, but `.incidentmap` is the
canonical **file**. The package is a bounded ZIP containing exactly one root
`map.json` and active binaries at manifest paths below `attachments/`. Save
projects Zustand state through `toMap()`, validates it, packages it, and uses
the File System Access API or download fallback. Open treats bytes as untrusted,
validates ZIP structure and limits, migrates/validates `map.json`, then loads the
runtime store. Legacy JSON open remains an import boundary; JSON export omits
binary content. See [FILE_FORMAT.md](FILE_FORMAT.md).

The browser dependency `fflate` supplies ESM `zipSync`, `unzipSync`, and UTF-8
helpers without Node polyfills. Synchronous processing is acceptable within the
enforced 25 MiB per-file and 100 MiB attachment limits. Web Crypto computes
optional SHA-256 checksums. This architecture is local persistence, not cloud
storage, synchronization, or a reporting database.

## State categories

### Persisted investigation metadata

V5 contains incident metadata, semantic nodes and coordinates, discriminated
relationships, Controls under historical key `barriers`, Evidence, the
Attachment manifest, Context, and allocation high-water marks. Objects are
strict and relationships/references receive whole-map validation. It contains
neither React Flow rendering fields nor presentation selections.

### Runtime graph and attachment byte store

Zustand adapts domain nodes/edges to React Flow and owns editable metadata,
Controls, Evidence, and attachment metadata. A separate session-only attachment
runtime store maps attachment ID to copied `Uint8Array` bytes. It also maintains
deleted/restorable tombstones so attachment deletion participates in undo/redo.
Changing bytes increments a revision used by dirty-state and preview consumers.
New/open clears obsolete bytes; package open populates only verified payloads.

History snapshots are deliberately **metadata-only**: nodes, edges, metadata,
Controls, Evidence, Attachment manifest records, and selection. Large binary
buffers, base64, ZIP data, and Blob URLs are never copied into history. Undo or
redo reconciles manifest IDs with active/tombstoned runtime bytes; unreachable
tombstones can be released.

### Blob URL lifecycle

Evidence preview lazily asks the byte store for one object URL. The same URL is
reused while active and revoked on viewer unmount, content replacement,
permanent removal, tombstone release, or store clear. It is never serialized.
The focus-managed modal renders images, native controlled video, or PDF in a
sandboxed iframe and retains an open/download fallback. Missing/rejected bytes
produce an accessible unavailable-content alert while metadata remains intact.

### Ephemeral application state

Selection/editing aids, menus, viewport/focus requests, presentation mode,
active lens, detail toggles, chronology visibility, Timeline-Only reveal state,
Case Summary visibility, Guided Story step, investigation-stage and checklist
results, first-use acknowledgement, and per-tip dismissal are view state. Tip
dismissal and first-use acknowledgement live only in session storage; checklist
completion is recomputed rather than stored. They are neither persisted nor
causal and do not enter undo history. Dirty state compares the canonical map
projection plus attachment-store revision with the last new/open/save baseline.

The Learning Guide's enabled preference is the one durable Guide setting. It is
kept locally in browser `localStorage`, is not part of `MapData`, does not travel
with a package, and has no bearing on dirty state or undo history.

## Derived views, not parallel truth

`src/content/investigationModel.ts` is the shared, ordered, typed source for the
nine investigation concepts and semantic decision guide. In-app keys, legends,
Learning Guide content, Learn the Map, and How to Read This Map project names,
definitions, questions, examples, visual roles, and relationships from shared
concept/Guide content rather than inventing separate semantic vocabularies.
`src/content/investigationGuide.ts` supplies structured Guide blocks and actions;
`src/content/learnMap.ts` supplies shared explanatory pages and diagrams.

Stable IDs and validated relationships are also the future synchronization
boundary for generated wallcharts: a later wallchart renderer should consume
the same structured sources so printed and in-app teaching stay aligned, not
copy editable prose into a second source of truth. PDF generation, distribution,
and a PDF toolchain remain outside this milestone.

Guidance selectors are pure functions of selection, graph content, and current
view signals. They deterministically derive applicable tips, priority, stage,
and an ephemeral review checklist; they neither dispatch store actions nor
persist results. Suggested-action buttons may navigate to an existing editor or
creation affordance only after the user chooses them. **The Guide advises but
never blocks work, edits map data on its own, or modifies investigation
conclusions.** A checklist signal is not validation or proof.

Presentation selectors are pure projections over the current graph. The six
lenses—Overview, Causal Story, Chronology, Controls, Actions, and Evidence—derive
visibility, emphasis, counts, focus, and chronology opening without mutating
records. Chronology represents sequence rather than causality: it orders
parseable Event timestamps and retains missing or
invalid values in **Untimed Events**. Timeline-Only reveal and all Context
display modes are presentation decisions; **display never changes causality**.

Case Summary derives capped review lists/counts for impacts, Root Causes, Key
Factors, failed/missing Controls, Control and Action states/types, Action
completion, Evidence types, Confirmed/Working assertions, and pinned Chip/Metric
Context. It is not an AI summary or report database.

Guided Story deterministically traverses explicit persisted causal paths toward
Key Factors and Root Causes (or a selected finding), then includes relevant
failed/missing Controls, linked Actions, Evidence, and Attachment metadata. It
fits/focuses existing entities and never generates a conclusion. Manual story
building, custom authored steps, and persisted story order are not implemented.

## Relationships, Controls, and layout

`CauseEffectEdge` connects non-Actions and drives causal hierarchy, roots,
paths, and Control eligibility. `ActionEdge` associates one non-Action source
with an Action and is excluded from causal computation. A Control attaches to
the ordered endpoints of an existing causal edge rather than to an edge ID.

Layout first positions causal nodes and then places Actions in stable,
grid-snapped stacks beside their source. Derived lenses, Event phase/time,
Context mode, Assertion State, and node position do not assert causality.
`Inferred` records analytical derivation and is not necessarily uncertainty.

## Supported quality, accessibility, and responsive behavior

Schema/migration/package tests protect compatibility, references, limits,
warnings, and security boundaries. Store tests protect history and registry
ownership; selector/story tests protect non-mutating derivation; component and
browser tests protect keyboard/read-only/responsive behavior.

Dialogs expose roles and labels, trap preview focus, support Escape, restore
focus, and announce view changes. Lens tabs support arrows, Home, and End.
Mobile uses an overlay/drawer chronology and closable inspector, full-screen
preview, touch-sized controls, and bounded overlays at browser zoom. Native
browser PDF/video support and codecs vary; download remains the fallback and
captions must be supplied with source media.

Fatal package failures do not replace the investigation. Attachment integrity
problems are recoverable warnings that preserve metadata but suppress unsafe or
invalid bytes. These behaviors and package/security limits are product
contracts, not incidental implementation details. Validation is not malware
scanning, authenticity proof, regulatory compliance, cloud backup, or audit.
