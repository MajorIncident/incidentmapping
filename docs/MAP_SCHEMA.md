# Map Schema v1

The Milestone 1 data contract is defined in `src/features/maps/schema.ts` using [Zod](https://zod.dev/).

```ts
MapData {
  schemaVersion: 1;
  metadata?: {
    title?: string;
  };
  nodes: ChainNode[];
  edges: CauseEffectEdge[];
}

ChainNode {
  id: string;
  kind: 'ChainNode';
  title: string;          // required display name
  description?: string;
  owner?: string;
  timestamp?: string;
  position: {
    x: number;            // canvas coordinates, snapped to an 8px grid
    y: number;
  };
}

CauseEffectEdge {
  id: string;
  kind: 'CauseEffectEdge';
  fromId: string;         // parent ChainNode id
  toId: string;           // child ChainNode id
}
```

## Validation Flow

- Incoming JSON is parsed and validated before calling `loadMap`.
- Saving first serializes via `toMap`, validates, then writes to disk.
- Validation errors bubble to a user-visible alert with the message emitted by Zod.

## Extensibility Notes

Future milestones may expand `metadata`, add node types, or support edge annotations. Keep schema changes versioned and additive.
