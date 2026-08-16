# Incident Mapping Architecture

## Data flow and four state categories

The application intentionally separates the saved investigation from rendering
and view state.

### 1. Persisted V4 state and package decision

The canonical save document is strict Version 4 `MapData`: incident metadata,
semantic nodes and coordinates, discriminated relationships, Controls (under
the historical wire key `barriers`), the global Evidence registry, Context,
and allocation high-water marks. Action accountability lives on Action nodes.
The [map schema](MAP_SCHEMA.md) is the complete wire contract.

Open sends all untrusted JSON through `parseAndMigrateMapData` before loading the
store. Save converts the runtime model with `toMap()`, validates V4, and only
then writes through the browser's available local-file/download mechanism.
The default persistence format is a `.incidentmap` ZIP containing one canonical,
formatted root `map.json` and active binaries below `attachments/`. JSON export
contains metadata and the attachment manifest only; neither Blob URLs, base64,
nor binary buffers belong in the document or Zustand history.

We selected production dependency **fflate 0.8.x** because its browser ESM build
exposes synchronous `zipSync`/`unzipSync` and UTF-8 helpers without Node
polyfills. The upstream project reports roughly an 8 kB minified core (about
3 kB gzip), substantially smaller than general archive libraries; the app uses
the simple synchronous API because packages are bounded to 100 MB. The browser
Web Crypto API supplies SHA-256 rather than adding a crypto dependency.

Attachment bytes, deleted/restorable tombstones, and revocable Blob URLs live
in a session-only runtime store keyed by attachment ID. Central persistence
validation limits each file to 25 MB and all attachments to 100 MB, constrains
normalized bundle paths, and permits only the schema's safe media allowlist.

### 2. Runtime React Flow state

Zustand owns the editable runtime graph. Persisted domain nodes are adapted to
React Flow nodes with `data`, position, selection, and component/rendering
properties; persisted relationships become React Flow edges. Runtime Controls
and the Evidence registry remain domain collections rather than independent
causal nodes. Store mutations, history snapshots, selection, dragging, and
layout operate here. `toMap()` removes React Flow-specific rendering data and
reconstructs canonical V4.

### 3. Derived Presentation state

Presentation is a read-only projection of current runtime state. It derives
card labels, graph roles, classification tags, selected-path styling, Evidence
summaries, Control placement, legend content, and chronology groups. It does not
copy or become an alternative source of investigation truth. Saved/unsaved
status is likewise derived by comparing validated canonical serialization with
the last new/open/save baseline.

### 4. Ephemeral Chronology visibility

Whether Chronology is open, including its responsive overlay/drawer behavior,
is local ephemeral UI state. It is not persisted and does not enter undo/redo.
Chronology itself derives Events from runtime state, orders valid timestamps by
instant and phase, and puts missing or invalid timestamps in a final **Untimed
Events** group at the bottom. Closing it changes no investigation data.

Other ephemeral state includes selection/editing IDs, menus and popovers,
viewport and focus requests, presentation mode, read-only flags, detail
visibility, and undo/redo availability. History stacks are runtime-only.

## Evidence ownership and references

The V3 map globally owns each Evidence record once in its Evidence Registry.
Nodes and Controls contain `evidenceIds` references; they never persist embedded
copies. One Evidence item can support assertions associated with several nodes
or Controls. Evidence is not a graph node and does not create a causal edge.
Future attachment or link fields may extend the Evidence record through a new
schema decision, but no unused attachment objects are persisted today and the
application does not imply file storage exists.

## Relationships, Controls, and layout

Relationship discriminators determine semantics:

- `CauseEffectEdge` builds the causal hierarchy between non-Action nodes and
  participates in roots, causal depth, sibling groups, upstream paths, and
  Control eligibility.
- `ActionEdge` associates exactly one non-Action source with an Action. It does
  not affect causal roots, depth, paths, or Control placement.
- A Control refers to an ordered upstream/downstream causal pair rather than an
  edge ID. Its Role describes intended function; its Status describes observed
  performance.

Layout has two phases. First it lays out non-Action nodes from the causal
hierarchy, centering parents over siblings and spacing components. Then it puts
Actions in stable, grid-snapped stacks to the right of their source. Adding or
removing an Action therefore cannot move causal nodes.

## Investigation semantics in the UI

Canvas cards expose stable node references and semantic types. Events may show
Event Phase; Factors may show category and significance, including Key Factor
or Root Cause; Actions may show purpose (Action Type) and lifecycle (Action
Status). The Inspector exposes narrative fields, Context where valid, linked
Evidence, and type-specific classification. Incident Context is edited at the
incident level. See the [investigation model](INVESTIGATION_MODEL.md) for the
meaning and boundaries of each concept.

Presentation mode remains read-only assistance over the same runtime model. It
is not a generated report or a certification artifact.

## History and quality boundaries

Domain mutations snapshot runtime nodes, relationships, metadata, Controls,
Evidence, and relevant selection. Undo/redo restores values and recomputes
availability; text and Control edits are debounced, and repeated keyboard moves
within the coalescing window form one operation. Presentation, Chronology
visibility, viewport/focus requests, and saved status do not create history.

Schema and migration tests protect compatibility and semantic integrity. Store
tests protect history, Evidence ownership, and serialization. Layout tests
protect discriminator filtering and deterministic coordinates. Component and
browser journeys protect adaptive/read-only rendering and save/reopen behavior.
Schema validation establishes data compatibility, not regulatory compliance.
