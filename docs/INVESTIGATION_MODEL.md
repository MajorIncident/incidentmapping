# Investigation Model

V4 separates what happened, what contributed, what constrained it, what
supports the analysis, and what should happen next. Display choices never
create, remove, reorder, or otherwise change causality; only explicit
`CauseEffectEdge` relationships express causal claims.

## Impacts, Events, and time

An **Impact** is harm, loss, disruption, or another material outcome. An
**Event** is something that occurred. Events may carry a start `timestamp`, an
optional `endTimestamp`, an Event Phase (`Precursor`, `Incident`, `Detection`,
`Response`, `Recovery`), Context, and Evidence.

### Timeline-Only Events

Every Event has an Event Display value. `Map` shows it in the causal canvas and
Chronology. `ChronologyOnly` keeps it in Chronology and normally removes it from
the primary causal canvas, with an auxiliary presentation lane available to
reveal/focus it. This is useful for detail that provides temporal continuity
without crowding the causal story. **Timeline-only is solely a display choice:
it does not weaken, strengthen, add, or remove causality.** Phase and timestamp
order likewise do not imply cause and effect.

### Event Duration

An Event may have `endTimestamp` as well as `timestamp`. The two strings record
the displayed interval; V4 does not validate their syntax or require the end to
follow the start. Missing or invalid start timestamps remain visible in the
final **Untimed Events** chronology group rather than being discarded.

## Factors and assertion state

A **Factor** is a condition judged to have contributed causally. Its category
may be Human, Process, Equipment, Technology, Communication, Environment,
Organizational, or Other. **Key Factor** and **Root Cause** are escalating
Factor-significance classifications, not graph position or relationship types.

Factors and Controls may record an **Assertion State**:

- `Confirmed`: treated as established by the investigation;
- `Working`: an active analytical proposition;
- `Inferred`: analytically derived from other information.

**Inferred means analytically derived; it does not necessarily mean uncertain.**
Assertion State communicates the basis/state of an assertion and does not alter
its causal edges, significance, Control status, or Evidence links.

## Controls

A **Control** is a safeguard attached to one ordered causal relationship. The
wire discriminator remains `Barrier`. Role (`Preventive`, `Detective`, or
`Mitigating`) describes intended function; Status (`Effective`, `Degraded`,
`Failed`, or `Missing`) describes observed performance. Neither dimension
implies the other. A Control does not replace its causal edge and is not a
free-standing cause.

## Actions and completion

An **Action** is a response attached by exactly one non-causal Action edge from
a non-Action. Type (`Immediate`, `Corrective`, `Preventive`) is purpose; Status
(`Proposed`, `Planned`, `InProgress`, `Completed`, `Cancelled`) is lifecycle.
`actionDueDate` records the target date and `actionCompletedAt` records actual
completion separately. A completion timestamp is not inferred from Completed
status, and the schema does not force those fields to agree. Actions cannot
carry Context and are not causes.

## Evidence and attachments

Evidence is a global registry record referenced by nodes and Controls. It may
link an HTTP(S) external source and zero or more package Attachments. One item
may support several assertions. Evidence supports a claim; it is not itself a
cause. Images, supported videos, and PDFs have in-app previews when bytes are
available; metadata survives when bytes are missing or rejected.

## Context and display modes

Context is a labeled fact at incident level or on an Event, Factor, or Impact.
A Context item can be pinned to a card and displayed as:

- `Text`: label/value prose;
- `Chip`: compact categorical emphasis;
- `Metric`: a value with an optional unit (units are forbidden in other modes).

These are **display modes only and do not change causality**. Context is not a
second causal-node system: promote a condition to a Factor only after making a
causal judgment. Evidence may support the factual Context while the Factor
expresses the distinct causal analysis.

## Derived review experiences

The six read-only lenses—Overview, Causal Story, Chronology, Controls, Actions,
and Evidence—filter or emphasize the same investigation without mutating it.
Case Summary derives capped lists and counts for impacts, findings, failed or
missing Controls, Actions, Evidence, assertions, and pinned Chip/Metric Context.
Guided Story deterministically walks persisted causal paths to Key Factors and
Root Causes, including relevant Controls, Actions, Evidence, and attachments.
It does not generate conclusions, invoke AI, or support manually authored story
steps.
