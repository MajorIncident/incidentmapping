# Map Schema: Canonical Version 4

Version 4 (`schemaVersion: 4`) is the strict canonical map document stored as
the root `map.json` in a `.incidentmap` package. JSON is a legacy import and
metadata-export representation, not the canonical file format. Every object
below is strict: unknown keys are rejected. All arrays shown are required;
`metadata` is optional and `metadata.contextItems` defaults to `[]` when
metadata is present.

## Complete persisted shape

`?` means optional. `NonEmptyString` has at least one character;
`TrimmedNonEmptyString` must contain a non-whitespace character. Numbers in a
position are finite JavaScript numbers. Date/timestamp fields remain strings;
V4 neither requires ISO syntax nor validates chronological order.

```ts
type MapData = {
  schemaVersion: 4;
  metadata?: Metadata;
  nodes: ChainNode[];
  edges: (CauseEffectEdge | ActionEdge)[];
  barriers: Control[]; // historical wire key; UI terminology is Control
  evidence: Evidence[];
  attachments: Attachment[];
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
  controlReferenceHighWaterMark?: NonNegativeInteger;
  attachmentReferenceHighWaterMark?: NonNegativeInteger;
  contextItems: ContextItem[];
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
  endTimestamp?: string;
  eventDisplay?: EventDisplay;
  severity?: Severity;
  factorCategory?: FactorCategory;
  factorSignificance?: FactorSignificance;
  assertionState?: AssertionState;
  actionStatus?: ActionStatus;
  actionDueDate?: string;
  actionCompletedAt?: string;
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
  kind: "Barrier"; // retained for wire compatibility
  referenceId: NonEmptyString;
  upstreamNodeId: NonEmptyString;
  downstreamNodeId: NonEmptyString;
  description?: string;
  status: ControlStatus;
  failureReason?: ControlFailureReason;
  failureDetails?: string;
  controlRole?: ControlRole;
  assertionState?: AssertionState;
  evidenceIds: NonEmptyString[];
};

type Evidence = {
  id: NonEmptyString;
  type: EvidenceType;
  title: NonEmptyString;
  description?: string;
  source?: string;
  reference?: string;
  attachmentIds: NonEmptyString[];
  externalUrl?: HttpOrHttpsUrl;
};

type Attachment = {
  id: NonEmptyString;
  filename: TrimmedNonEmptyString;
  mimeType: AttachmentMimeType;
  size: NonNegativeInteger;
  bundlePath: TrimmedNonEmptyString;
  sha256?: HexStringOfExactly64Characters;
};

type ContextItem = {
  id: NonEmptyString;
  label: TrimmedNonEmptyString;
  value: TrimmedNonEmptyString;
  showOnCard?: boolean;
  displayMode: ContextDisplayMode;
  unit?: TrimmedNonEmptyString;
};
```

## Enums

| Name                   | Allowed values                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Severity`             | `Low`, `Medium`, `High`, `Critical`                                                                                                       |
| `IncidentStatus`       | `Draft`, `Open`, `InProgress`, `Closed`                                                                                                   |
| `FactorCategory`       | `Human`, `Process`, `Equipment`, `Technology`, `Communication`, `Environment`, `Organizational`, `Other`                                  |
| `FactorSignificance`   | `Normal`, `KeyFactor`, `RootCause`                                                                                                        |
| `AssertionState`       | `Confirmed`, `Working`, `Inferred`                                                                                                        |
| `ActionStatus`         | `Proposed`, `Planned`, `InProgress`, `Completed`, `Cancelled`                                                                             |
| `ActionType`           | `Immediate`, `Corrective`, `Preventive`                                                                                                   |
| `EventPhase`           | `Precursor`, `Incident`, `Detection`, `Response`, `Recovery`                                                                              |
| `EventDisplay`         | `Map`, `ChronologyOnly`                                                                                                                   |
| `ControlStatus`        | `Effective`, `Degraded`, `Failed`, `Missing`                                                                                              |
| `ControlRole`          | `Preventive`, `Detective`, `Mitigating`                                                                                                   |
| `ControlFailureReason` | `NotFollowed`, `Bypassed`, `IncorrectConfiguration`, `SystemFailure`, `InadequateDesign`, `Unavailable`, `NotInPlace`, `Unknown`, `Other` |
| `EvidenceType`         | `Note`, `Photo`, `Video`, `Document`, `SystemLog`, `Interview`, `Other`                                                                   |
| `ContextDisplayMode`   | `Text`, `Chip`, `Metric`                                                                                                                  |
| `AttachmentMimeType`   | `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `video/mp4`, `video/webm`, `text/plain`, `text/csv`, `application/json`       |

Spelling and capitalization are part of the contract.

## Placement and semantic validation

Shape parsing is followed by whole-map validation.

- `eventDisplay` is required on every Event; `eventDisplay` and `endTimestamp`
  are forbidden elsewhere. `eventPhase` is also Event-only.
- `factorCategory`, `factorSignificance`, and `assertionState` are Factor-only
  node fields. A Control may independently carry `assertionState`.
- `actionType`, `actionStatus`, `actionDueDate`, and `actionCompletedAt` are
  Action-only. Context is allowed at incident level and on Event, Factor, and
  Impact nodes; an Action's `contextItems` must be empty.
- A Context `unit` is valid only when `displayMode` is `Metric`. Display modes,
  card pinning, Event display, lenses, and chronology placement are presentation
  choices: **they do not create, remove, or change causality**.
- `externalUrl`, when present, must be a syntactically valid HTTP or HTTPS URL.
  Attachment media type, path, and byte limits receive additional package-level
  validation described in [FILE_FORMAT.md](FILE_FORMAT.md).
- Every edge endpoint exists. A causal edge connects only non-Actions and an
  ordered causal pair occurs at most once. An Action edge starts at a non-Action
  and ends at an Action; every Action has exactly one incoming Action edge and
  each ordered Action pair is unique. Action edges are response ownership, not
  causal assertions.
- Each Control's endpoints exist and exactly match an ordered causal edge.
  Controls refer to the node pair, not an edge ID.
- The graph is not required to be acyclic. Optional classifications are not
  made mandatory, and string dates are not interpreted by schema validation.

## Identity, references, and uniqueness

Node IDs, node `referenceId`s, edge IDs, Control IDs, Control `referenceId`s,
Evidence IDs, Attachment IDs, and Attachment `bundlePath`s are each unique
within their own namespace. The contract does not require IDs from different
namespaces to differ. Context IDs have no map-wide uniqueness rule.

Every node/Control `evidenceIds` entry resolves to the global Evidence registry;
every Evidence `attachmentIds` entry resolves to the attachment manifest. An
owner cannot repeat the same reference locally, but a registry item may be
shared by several owners. Evidence and Attachments are registered once rather
than embedded. Deleting a registry record therefore requires removing all
references to it.

## High-water allocation

Human-facing references conventionally use `N-001` (nodes), `EV-001`
(Evidence), `C-001` (Controls), and `ATT-001` (Attachments). The four optional
metadata marks record allocation history, not collection sizes. Allocation is
above the greater of the stored mark and the highest well-formed extant
reference for that namespace. Deletion does not compact or reuse a number;
gaps survive save/open. Validation intentionally accepts absent or stale-low
marks, so readers must reconcile before allocating and must preserve a mark
that exceeds all surviving references.

## Deterministic migration and import

`parseAndMigrateMapData` is the only untrusted JSON boundary. It accepts frozen
V1, V2, V3, and strict V4 documents, never mutates input, rejects unsupported
versions, and validates the resulting V4 map. Saving always emits V4 inside an
`.incidentmap` package.

### V3 to V4

- Controls retain order and identity and receive sequential `C-001`, `C-002`,
  … references. The Control high-water mark covers the result.
- Every Event receives `eventDisplay: "Map"`; no duration, assertion state, or
  Action completion date is invented.
- Every incident/node Context item receives `displayMode: "Text"`; no unit is
  invented.
- Every Evidence item receives `attachmentIds: []`; root `attachments` is `[]`
  and its high-water mark is zero. No link or binary is invented.
- Existing metadata, graph, positions, ordering, IDs, evidence references, and
  node/evidence allocation history are retained.

V1 and V2 first follow the frozen migrations into V3, then the steps above.
V2 embedded Evidence becomes global `Note` Evidence in deterministic node/item
order. Legacy enum spellings and retired Action-edge fields are normalized only
at the documented compatibility boundary; collisions fail rather than being
silently renumbered. V1 nodes become sequentially referenced Events and legacy
breach state maps to Control status. See source migration tests for preserved
legacy details. A metadata-only JSON export containing attachment records can
be imported, but its binary bytes cannot be reconstructed and previews remain
unavailable.

## Explicit non-goals

V4 does not provide hosted/cloud storage, collaboration, identity, permissions,
an audit log, AI-generated summaries, a reporting database, regulatory
certification, visual/PDF report export, or manual story authoring. Case Summary,
lenses, Chronology, and Guided Story are derived review views, not persisted
parallel truth or causal inference.
