# Incident Mapping Architecture

## Layers and data flow

- **UI:** React components render the Incident Header, semantic canvas nodes,
  Inspector, toolbar, legend, and presentation overlay on React Flow.
- **State:** Zustand in `src/state/useAppStore.ts` owns the authoritative runtime
  graph and all mutations.
- **Domain:** Zod schemas and migration in `src/features/maps` define the
  persisted contract and compatibility boundary.
- **Layout:** `src/features/layout/hierarchy.ts` computes deterministic positions.
- **Persistence:** the File menu validates `toMap()` output and uses the File
  System Access API where available, with upload/download fallbacks.

UI actions update the store synchronously. The canvas receives derived React
Flow nodes and edges; selections and drags dispatch store actions. Open calls
`parseAndMigrateMapData` before `loadMap`; save validates the Version 2 document
before writing it.

## Persisted, derived, and ephemeral state

Persisted state consists of metadata, chain nodes and their domain fields and
positions, discriminated relationship edges, barriers, and allocation
high-water marks. `toMap()` derives this state from the runtime graph and strips
React Flow rendering data.

Ephemeral UI state is never serialized: selection and inline editing IDs,
detail visibility, computed graph roles/selected-path styling, read-only flags,
layout and viewport requests, editor focus requests, presentation mode, the
open state of menus/popovers, history stacks, and `canUndo`/`canRedo`.

Saved/unsaved status is also derived rather than persisted. The persistence
shell compares the current validated `toMap()` serialization with the last
new/open/save baseline. Selection, presentation, viewport, and other UI-only
changes therefore do not dirty a map.

## Relationships, layout, and visual derivation

All graph semantics first filter relationships by discriminator. Only
`CauseEffectEdge` participates in roots, causal depth, sibling groups, selected
upstream paths, and barrier eligibility/placement. `ActionEdge` does **not**
affect roots, depths, sibling positions, selected causal paths, or barriers.

Layout is explicitly two phase:

1. Lay out non-Action nodes from the causal hierarchy, deterministically
   centering parents above sibling groups and spacing roots/components.
2. Place Action nodes in deterministic stacks to the right of their source,
   using stable edge/node order and grid-snapped gaps.

Consequently, adding or removing an action cannot move causal nodes. Unit tests
assert causal-coordinate invariance, deterministic action stacking, and
idempotence; these guarantees intentionally do not depend on pixel-sensitive
browser screenshots.

## History

History snapshots contain nodes, relationships, metadata, barriers, and
selection. A domain mutation pushes the prior snapshot and clears the redo
stack. Undo/redo restores snapshots by value and recomputes its availability.
Repeated keyboard movement within 200 ms is one history operation, while text
and barrier edits use their own short debounce to avoid an entry per keystroke.
Organizing, metadata edits, classifications, evidence, barrier controls, and
graph edits participate in history. Focus requests, viewport requests, detail
visibility, saved status, and presentation state do not.

## UI semantics

- Canvas cards carry a node-type tag (`Event`, `Factor`, `Impact`, `Action`) and
  stable node reference. Factor cards additionally show category and significance
  tags; Action cards show action status. Root Cause receives distinct emphasis.
- The adaptive Inspector exposes general description/owner/time/consequences
  and evidence, then type-relevant classification or action fields. Evidence is
  summarized on expanded canvas cards with stable evidence labels.
- The compact Incident Header keeps title, ID, occurrence, location, severity,
  and status discoverable without consuming canvas space.
- Barrier cards and Inspector controls expose status, description, and—when
  relevant—failure reason and details.
- Presentation mode is a read-only projection of the same current store state.
  It hides editing chrome and handles, retains the header, legend, semantic tags,
  evidence summaries, and barriers, and exits without changing persisted data or
  history. It is presentation assistance, not a compliance report.

## Quality boundaries

Schema and migration unit tests protect data compatibility. Store tests protect
history and serialization. Layout unit tests protect semantic filtering and
coordinate invariance. Component tests protect adaptive/read-only rendering,
and focused Playwright journeys verify that an understandable investigation
survives actual save and reopen.
