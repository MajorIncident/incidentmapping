# Map Schema Version 2

The persisted contract is `MapData` in `src/features/maps/schema.ts`. JSON is
strictly validated with Zod: unknown Version 2 object fields, missing required
arrays, empty identifiers, and unsupported enum values are rejected.

## Persisted document

```ts
MapData {
  schemaVersion: 2;
  metadata?: Metadata;
  nodes: ChainNode[];
  edges: (CauseEffectEdge | ActionEdge)[];
  barriers: Barrier[];
}

Metadata {
  title?: string;
  incidentId?: string;
  occurredAt?: string;
  location?: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  status?: 'Draft' | 'Open' | 'InProgress' | 'Closed';
  nodeReferenceHighWaterMark?: non-negative integer;
  evidenceReferenceHighWaterMark?: non-negative integer;
}

ChainNode {
  id: string;
  kind: 'ChainNode';
  referenceId: string;
  nodeType: 'Event' | 'Factor' | 'Impact' | 'Action';
  title: string;
  description?: string;
  owner?: string;
  timestamp?: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  factorCategory?: 'Human' | 'Process' | 'Equipment' | 'Technology' | 'Communication' | 'Environment' | 'Organizational' | 'Other';
  factorSignificance?: 'Normal' | 'KeyFactor' | 'RootCause';
  actionStatus?: 'Proposed' | 'Planned' | 'InProgress' | 'Completed' | 'Cancelled';
  actionDueDate?: string;
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
  evidenceItems: { id: string; text: non-empty string }[];
  position: { x: number; y: number };
}

CauseEffectEdge {
  id: string; kind: 'CauseEffectEdge'; fromId: string; toId: string;
}

ActionEdge {
  id: string; kind: 'ActionEdge'; fromId: string; toId: string;
}

Barrier {
  id: string; kind: 'Barrier';
  upstreamNodeId: string; downstreamNodeId: string;
  description?: string;
  status: 'Effective' | 'Degraded' | 'Failed' | 'Missing';
  failureReason?: 'NotFollowed' | 'Bypassed' | 'IncorrectConfiguration' | 'SystemFailure' | 'InadequateDesign' | 'Unavailable' | 'NotInPlace' | 'Unknown' | 'Other';
  failureDetails?: string;
}
```

The relationship `kind` is the discriminator. `CauseEffectEdge` expresses the
causal hierarchy. `ActionEdge` associates an Action with the node it addresses;
it is not a causal relationship. Controls refer to an upstream/downstream causal
pair rather than to an edge ID.

## Reference allocation

Node references are stable display identifiers (`N-001`, `N-002`, …), separate
from internal `id`. New references increment `metadata.nodeReferenceHighWaterMark`;
deleted references are not reused. Evidence IDs are globally allocated across the map as `EV-001`, `EV-002`, and so on from `metadata.evidenceReferenceHighWaterMark`. Node array order and evidence array order define deterministic legacy renumbering. Deleted identifiers are not reused.

## Version 1 migration

`parseAndMigrateMapData` is the only boundary for untrusted persisted JSON.
Version 2 is validated directly; Version 1 is validated against its legacy
shape, transformed, then validated as Version 2. Unsupported versions fail.

| Version 1 input                  | Version 2 output                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `schemaVersion: 1`               | `schemaVersion: 2`                                                                                            |
| node in array position _n_       | preserves all legacy content; adds `referenceId: N-{n+1}`, `nodeType: Event`, and empty evidence              |
| optional consequence arrays      | materialized as arrays by legacy validation                                                                   |
| `metadata.title`                 | preserved; node reference high-water mark becomes the node count; global evidence high-water mark becomes `0` |
| `CauseEffectEdge`                | preserved unchanged                                                                                           |
| legacy Control `breached: false` | `status: Effective`                                                                                           |
| legacy Control `breached: true`  | `status: Failed`                                                                                              |
| non-empty `breachedItems`        | newline-joined into `failureDetails`                                                                          |

Descriptions, owners, timestamps, consequences, IDs, coordinates, edge
endpoints, Control descriptions, and title are retained. Migration is
deterministic and does not mutate the input. The retired `breached` and
`breachedItems` fields are accepted **only** by the Version 1 migration schema;
they are invalid in a Version 2 document and never emitted by save.

Compatibility guarantee: valid Version 1 files continue to open through this
explicit migration boundary, while every save emits canonical Version 2. Future
incompatible changes require a new schema version and an explicit migration.

## Validation and persistence

Open parses and migrates before loading store state. Save derives a document
with `toMap()`, validates it against Version 2, and only then writes it through
the File System Access API or download fallback. Schema validation establishes
data-shape compatibility; it is not a claim of regulatory compliance.

## Graph integrity

Validation rejects duplicate node IDs/references, edge IDs, control IDs, and globally duplicated evidence IDs. Every relationship and control endpoint must exist. Controls (persisted with legacy `kind: 'Barrier'`) must match a causal source/target pair. Causal relationships cannot touch Actions. Each Action has exactly one incoming ActionEdge from a non-Action source, and duplicate causal or source/action pairs are invalid.

Legacy V2 is parsed through an explicit compatibility schema only after canonical validation fails. Evidence is renumbered in persisted order only on that legacy path. Retired node-level `incidentStatus` is discarded because `metadata.status` is authoritative. Retired ActionEdge `status` and `dueDate` move to the target Action only when its node-owned field is absent, so explicit Action values win. Canonical serialization never includes node status, node evidence counters, or ActionEdge accountability fields.
