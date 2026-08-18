# ELK layered-layout prototype

## Configuration and measurement

The prototype uses layered layout in the downward direction, fixed north/south
ports, orthogonal edges, a fixed random seed, and model-order-aware cycle,
crossing, and node-placement phases. Node model order is derived, in order,
from persisted X, reference ID, and entity ID; edge model order is the existing
relationship array order.

`tests/unit/elk-layout.test.ts` runs this configuration against every canonical
layout fixture. For each run it captures elapsed runtime, rank membership,
left-to-right order within each rank, edge crossings, bend count, and output
width and height. It also repeats each layout and checks the geometry
fingerprint, making ordering regressions visible rather than relying on visual
inspection.

## Decision

ELK should provide **rank assignment, ordering, and initial X/Y placement**, not
renderer-owned final edge geometry. Its full geometry is valuable in the
prototype metrics and remains available from `layoutWithElk`, but the current
canvas owns routing/handles and remeasures content-sized cards after rendering.
Applying ELK edge sections would therefore couple Arrange Map to transient DOM
measurements and duplicate the established React Flow edge path. Arrange Map
uses ELK node coordinates, then retains the canvas's existing routing and
control projection rendering.
