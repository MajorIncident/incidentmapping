# Map Schema: Canonical Version 3

This document is the wire contract for saved incident maps. The canonical
persisted form is `MapData` with `schemaVersion: 3`. Opening untrusted JSON goes
through the versioned migration boundary; saving always validates and emits V3.
Objects are strict unless a legacy migration shape explicitly says otherwise,
so unknown fields are rejected rather than silently retained.

## Complete persisted shape

`?` means optional. All listed arrays are required in canonical V3 (except
`metadata.contextItems`, which defaults to `[]` when metadata is present).
Strings marked **non-empty** have a minimum length of one; **trimmed non-empty**
strings must also contain a non-whitespace character. Dates and timestamps are
stored as strings: the schema does not require an ISO format or prove that they
are valid dates.

```ts
type MapData = {
  schemaVersion: 3;
  metadata?: Metadata;
  nodes: ChainNode[];
  edges: (CauseEffectEdge | ActionEdge)[];
  barriers: Control[]; // historical wire name; the product calls these Controls
  evidence: Evidence[];
};

type Metadata = {
  title?: TrimmedNonEmptyString;
  incidentId?: TrimmedNonEmptyString;
  occurredAt?: TrimmedNonEmptyString;
  location?: TrimmedNonEmptyString;
  severity?: Severity;
  status?: IncidentStatus;
  nodeReferenceHighWaterMark?: NonNegativeInteger;
  evidenceReferenceHighWaterMark?: NonNegativeInteger;
  contextItems: ContextItem[]; // defaults to [] while parsing
};

type ChainNode = {
  id: NonEmptyString;
  kind: "ChainNode";
  referenceId: NonEmptyString;
  nodeType: "Event" | "Factor" | "Impact" | "Action";
  title: NonEmptyString;
  description?: string;
  owner?: string;
  timestamp?: string;
  severity?: Severity;
  factorCategory?: FactorCategory;
  factorSignificance?: FactorSignificance;
  actionStatus?: ActionStatus;
  actionDueDate?: string;
  eventPhase?: EventPhase;
  actionType?: ActionType;
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
  evidenceIds: NonEmptyString[];
  contextItems: ContextItem[];
  position: { x: number; y: number };
};

type CauseEffectEdge = {
  id: NonEmptyString;
  kind: "CauseEffectEdge";
  fromId: NonEmptyString;
  toId: NonEmptyString;
};

type ActionEdge = {
  id: NonEmptyString;
  kind: "ActionEdge";
  fromId: NonEmptyString;
  toId: NonEmptyString;
};

type Control = {
  id: NonEmptyString;
  kind: "Barrier"; // retained discriminator for wire compatibility
  upstreamNodeId: NonEmptyString;
  downstreamNodeId: NonEmptyString;
  description?: string;
  status: ControlStatus;
  failureReason?: ControlFailureReason;
  failureDetails?: string;
  controlRole?: ControlRole;
  evidenceIds: NonEmptyString[];
};

type Evidence = {
  id: NonEmptyString;
  type: EvidenceType;
  title: NonEmptyString;
  description?: string;
  source?: string;
  reference?: string;
};

type ContextItem = {
  id: NonEmptyString;
  label: TrimmedNonEmptyString;
  value: TrimmedNonEmptyString;
  showOnCard?: boolean;
};
```

## Allowed enums

| Name                   | Allowed wire values                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Severity`             | `Low`, `Medium`, `High`, `Critical`                                                                                                       |
| `IncidentStatus`       | `Draft`, `Open`, `InProgress`, `Closed`                                                                                                   |
| `FactorCategory`       | `Human`, `Process`, `Equipment`, `Technology`, `Communication`, `Environment`, `Organizational`, `Other`                                  |
| `FactorSignificance`   | `Normal`, `KeyFactor`, `RootCause`                                                                                                        |
| `ActionStatus`         | `Proposed`, `Planned`, `InProgress`, `Completed`, `Cancelled`                                                                             |
| `EventPhase`           | `Precursor`, `Incident`, `Detection`, `Response`, `Recovery`                                                                              |
| `ActionType`           | `Immediate`, `Corrective`, `Preventive`                                                                                                   |
| `ControlStatus`        | `Effective`, `Degraded`, `Failed`, `Missing`                                                                                              |
| `ControlRole`          | `Preventive`, `Detective`, `Mitigating`                                                                                                   |
| `ControlFailureReason` | `NotFollowed`, `Bypassed`, `IncorrectConfiguration`, `SystemFailure`, `InadequateDesign`, `Unavailable`, `NotInPlace`, `Unknown`, `Other` |
| `EvidenceType`         | `Note`, `Photo`, `Video`, `Document`, `SystemLog`, `Interview`, `Other`                                                                   |

Enum spelling and capitalization are part of the wire contract.

## Semantic validation

Shape validation is followed by whole-map validation:

- Node IDs, node `referenceId` values, edge IDs, Control IDs, and Evidence
  registry IDs must each be unique in their respective namespaces.
- Every edge endpoint must name an existing node. A `CauseEffectEdge` cannot
  touch an Action. Duplicate ordered causal pairs are invalid.
- An `ActionEdge` must start at a non-Action and end at an Action. Every Action
  must have exactly one incoming `ActionEdge`; duplicate ordered Action pairs
  are invalid. Action relationships express ownership/response, not causation.
- Every Control endpoint must exist, and its ordered upstream/downstream pair
  must exactly match a `CauseEffectEdge`. Controls reference the causal pair,
  not an edge ID.
- `eventPhase` is permitted only on Event nodes. `factorCategory` and
  `factorSignificance` are permitted only on Factor nodes. `actionType`,
  `actionStatus`, and `actionDueDate` are permitted only on Action nodes.
- Context is allowed on incident metadata and on Event, Factor, and Impact
  nodes. An Action's `contextItems` array must be empty.
- Every node and Control `evidenceIds` value must resolve to the global
  `evidence` registry. A given owner cannot repeat the same Evidence ID, though
  the same registry item may intentionally be referenced by multiple owners.

The schema does not require type-specific optional classifications, validate
string date formats, constrain graph acyclicity, or require high-water marks to
match current IDs. Those omissions are part of the current contract, not an
invitation for importers to invent fields.

## Evidence registry and references

Evidence is owned once by the map-wide `evidence` registry. Nodes and Controls
hold only `evidenceIds`; they do not embed or own copies. Deleting a reference
from a node or Control does not by itself redefine the Evidence item, while
removing an Evidence registry item requires removing all of its references.
Evidence supports an assertion recorded in the investigation; Evidence is not
itself a cause.

The current Evidence record stores descriptive metadata only. A later schema
version may extend Evidence with attachment or link fields. V3 deliberately has
no unused attachment placeholder object, and this contract does not claim that
file upload, binary persistence, or hosted file storage exists.

## Context rules

Context records factual conditions or circumstances, such as weather, operating
mode, or location detail. Incident Context belongs in `metadata.contextItems`;
node Context belongs on a non-Action node. `showOnCard` is an optional display
preference, not a causal classification. Context is a fact; a Factor is a
condition judged to have causally contributed. Promote a fact into a Factor
only when the investigation makes that causal judgment—do not use Context as a
second causal-node system.

Context IDs are non-empty but are not registry references and V3 does not impose
map-wide uniqueness on them. Labels and values are trimmed non-empty strings.

## Stable references and high-water marks

Internal `id` values connect graph objects. `referenceId` is the stable,
human-facing node label (`N-001`, `N-002`, …). Evidence IDs conventionally use
`EV-001`, `EV-002`, … and are both registry identity and display reference.

`metadata.nodeReferenceHighWaterMark` and
`metadata.evidenceReferenceHighWaterMark` are optional, non-negative integers
used by the application allocator. New identities are allocated above the
greater of the stored mark and the highest well-formed corresponding persisted
reference. Deletion does not compact numbering or permit reuse; gaps are
preserved through save and reopen. A stale low mark therefore cannot reuse a
well-formed extant reference. Importers should preserve marks even when the
highest-numbered item has been deleted. The marks are allocation history, not
counts, and semantic validation does not reject a stale mark.

## Deterministic migration to V3

`parseAndMigrateMapData` is the sole boundary for untrusted persisted JSON.
Unsupported versions fail. Migration does not mutate the input, and its output
is validated as canonical V3.

### Version 2 to Version 3

Canonical V2 is parsed using its frozen strict schema. Each node's embedded
`evidenceItems`, in node-array order and then item-array order, becomes the
global Evidence registry. Each `{ id, text }` becomes
`{ id, type: "Note", title: text }`, and that node receives the same IDs in
`evidenceIds`. Node and metadata `contextItems`, Control `evidenceIds`, and the
root `evidence` array are materialized; no Event Phase, Action Type, or Control
Role is inferred. The Evidence high-water mark becomes the greater of its old
value and the largest well-formed migrated `EV-<digits>` ID. Existing metadata,
nodes, relationships, Controls, IDs, ordering, positions, and other domain
fields are retained.

Some early V2 files use a separately recognized compatibility shape. On that
path only:

- `Procedure` becomes `Process`; `Organization` becomes `Organizational`.
- Control failure reasons map as `Absent` → `NotInPlace`, `Inadequate` →
  `InadequateDesign`, `NotUsed` → `NotFollowed`, and `Failed` → `SystemFailure`.
- Retired node `incidentStatus` and node evidence counters are discarded;
  metadata status remains authoritative.
- Retired `ActionEdge.status` and `.dueDate` move to the target Action only when
  its node-owned value is absent, so explicit Action fields win. They are then
  removed from the edge.

Migration preserves Evidence IDs; it does not silently renumber collisions.
Consequently, duplicated embedded V2 Evidence IDs produce an invalid V3 map and
fail deterministically rather than changing identity.

### Version 1 to Version 3

V1 first transforms through the frozen V2 meaning, then follows the V2-to-V3
steps above. For each V1 node at zero-based array index `i`, migration preserves
its content and adds `referenceId` `N-${i + 1}` padded to three digits,
`nodeType: "Event"`, and empty embedded Evidence. The node high-water mark is
the node count and the initial Evidence mark is zero. A legacy Control with
`breached: false` becomes `Effective`; `breached: true` becomes `Failed`.
Non-empty `breachedItems` are newline-joined into `failureDetails`. IDs,
ordering, coordinates, edges, endpoint references, descriptions, owners,
timestamps, consequences, and metadata title are retained. No Event Phase or
Context is invented.

Every subsequent save emits only canonical V3. A future incompatible contract
requires a new schema version and an explicit deterministic migration.

## Chronology and persistence boundary

Chronology is a derived view over Events, not another persisted timeline. Valid
timestamps sort by parsed instant and Event Phase organizes the story. Missing
or invalid timestamps remain visible at the bottom in **Untimed Events**.
Whether Chronology is open is ephemeral UI state and is neither serialized nor
placed in undo history.
