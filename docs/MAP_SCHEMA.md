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
  incidentStatus?: 'Draft' | 'Open' | 'InProgress' | 'Closed';
  factorCategory?: 'Human' | 'Equipment' | 'Environment' | 'Procedure' | 'Organization';
  factorSignificance?: 'Normal' | 'KeyFactor' | 'RootCause';
  actionStatus?: 'Proposed' | 'Planned' | 'InProgress' | 'Completed' | 'Cancelled';
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
  evidenceItems: { id: string; text: non-empty string }[];
  evidenceHighWaterMark?: non-negative integer;
  position: { x: number; y: number };
}

CauseEffectEdge {
  id: string; kind: 'CauseEffectEdge'; fromId: string; toId: string;
}

ActionEdge {
  id: string; kind: 'ActionEdge'; fromId: string; toId: string;
  status?: 'Proposed' | 'Planned' | 'InProgress' | 'Completed' | 'Cancelled';
  dueDate?: string;
}

Barrier {
  id: string; kind: 'Barrier';
  upstreamNodeId: string; downstreamNodeId: string;
  description?: string;
  status: 'Effective' | 'Degraded' | 'Failed' | 'Missing';
  failureReason?: 'Absent' | 'Inadequate' | 'NotUsed' | 'Failed' | 'Unknown';
  failureDetails?: string;
}
```

The relationship `kind` is the discriminator. `CauseEffectEdge` expresses the
causal hierarchy. `ActionEdge` associates an Action with the node it addresses;
it is not a causal relationship. Barriers refer to an upstream/downstream causal
pair rather than to an edge ID.

## Reference allocation

Node references are stable display identifiers (`N-001`, `N-002`, …), separate
from internal `id`. New references increment `metadata.nodeReferenceHighWaterMark`;
deleted references are not reused. Evidence follows the same principle within a
node: IDs increment from `evidenceHighWaterMark` and render as `EV-01`, `EV-02`,
and so on. High-water marks preserve monotonic allocation across save/reopen.

## Version 1 migration

`parseAndMigrateMapData` is the only boundary for untrusted persisted JSON.
Version 2 is validated directly; Version 1 is validated against its legacy
shape, transformed, then validated as Version 2. Unsupported versions fail.

| Version 1 input             | Version 2 output                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion: 1`          | `schemaVersion: 2`                                                                                                             |
| node in array position _n_  | preserves all legacy content; adds `referenceId: N-{n+1}`, `nodeType: Event`, empty evidence, and evidence high-water mark `0` |
| optional consequence arrays | materialized as arrays by legacy validation                                                                                    |
| `metadata.title`            | preserved; node reference high-water mark becomes the node count                                                               |
| `CauseEffectEdge`           | preserved unchanged                                                                                                            |
| barrier `breached: false`   | `status: Effective`                                                                                                            |
| barrier `breached: true`    | `status: Failed`                                                                                                               |
| non-empty `breachedItems`   | newline-joined into `failureDetails`                                                                                           |

Descriptions, owners, timestamps, consequences, IDs, coordinates, edge
endpoints, barrier descriptions, and title are retained. Migration is
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
