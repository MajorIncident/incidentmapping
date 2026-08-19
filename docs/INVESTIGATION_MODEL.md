# Investigation Model

V5 separates what happened, what contributed, what constrained it, what
supports the analysis, and what should happen next. Display choices never
create, remove, reorder, or otherwise change causality; only explicit
`CauseEffectEdge` relationships express causal claims.

## Impacts, Events, and time

An **Impact** is harm, loss, disruption, or another material outcome. An
**Event** is something that occurred. Events may carry a start `timestamp`, an
optional `endTimestamp`, an Event Phase (`Precursor`, `Incident`, `Detection`,
`Response`, `Recovery`), Context, and Evidence.

An investigation may contain multiple Impacts when an incident produced more
than one material outcome. Creating an Impact is always a top-level operation:
it does not attach the new Impact to the current selection or create a causal
relationship. Creation controls communicate what may be authored in the
current context, but their availability never creates or implies causality.

### Timeline-Only Events

Every Event has an Event Display value. `Map` shows it in the causal canvas and
Chronology. `ChronologyOnly` keeps it in Chronology and normally removes it from
the primary causal canvas, with an auxiliary presentation lane available to
reveal/focus it. This is useful for detail that provides temporal continuity
without crowding the causal story. **Timeline-only is solely a display choice:
it does not weaken, strengthen, add, or remove causality.** Phase and timestamp
order likewise do not imply cause and effect. **Chronology represents sequence,
not causality:** “the alarm sounded before shutdown” is a sequence claim; only
an explicit causal edge can claim that the alarm caused the shutdown.

### Event Duration

An Event may have `endTimestamp` as well as `timestamp`. The two strings record
the displayed interval; when both parse as dates, the end cannot precede the
start. Missing or invalid start timestamps remain visible in the
final **Untimed Events** chronology group rather than being discarded.

## Factors and assertion state

A **Factor** is a condition for which the investigation makes an explicit
causal judgment: it contributed to producing an Event or Impact. For example,
“the ambiguous procedure contributed to the incorrect valve setting” is a cause
and belongs as a Factor; “the incorrect setting increased spill volume”
describes an effect and belongs as Aggravating Context on that Event or Impact
unless the setting is itself asserted as a cause in the causal graph. Its
category may be Human, Process, Equipment, Technology, Communication, Environment,
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
Every item has an `effect` classification:

- **Context (`Neutral`)** is a relevant, nondirectional fact that helps readers
  understand the investigation without asserting that it caused or changed an
  effect. “The asset was 12 years old” is neutral; if age is judged to have
  caused the failure, model age as a Factor instead.
- **Aggravating Context (`Aggravating`)** is a circumstance judged to have made
  an observed Event or Impact worse by increasing its severity, extent, or
  likelihood. “High occupancy increased the number exposed” describes an
  effect; “high occupancy caused the evacuation delay” is instead a causal
  claim and should be a Factor connected by a causal edge.
- **Mitigating Context (`Mitigating`)** is a circumstance judged to have reduced
  an observed Event or Impact's severity, extent, or likelihood. “Rapid
  isolation limited the spill volume” describes an effect; “rapid isolation
  caused pressure loss” would be a causal claim and should be modeled as a
  Factor when material to the analysis.

Directional effect classifications are valid only on Events and Impacts.
Factors may carry Neutral Context only; Actions cannot carry Context. Incident
metadata may carry any effect classification. An omitted `effect` at the input
boundary defaults to `Neutral`. A Context item can be pinned to a card and displayed as:

- `Text`: label/value prose;
- `Chip`: compact categorical emphasis;
- `Metric`: a value with an optional unit (units are forbidden in other modes).

These are **display modes only and do not change causality**. Context is not a
second causal-node system: promote a condition to a Factor only after making a
causal judgment. Evidence may support the factual Context while the Factor
expresses the distinct causal analysis.

## Learning Guide boundary

The Learning Guide, Learn the Map material, How to Read This Map explanations,
stage labels, and review checklist are educational projections over the current
map. **The Guide advises but never blocks an edit, changes persisted
investigation data, or modifies an investigation conclusion.** Its suggestions
and completeness signals are prompts for professional judgment, not validation,
proof, or an automated finding.

## Derived review experiences

The six read-only lenses—Overview, Causal Story, Chronology, Controls, Actions,
and Evidence—filter or emphasize the same investigation without mutating it.
Case Summary derives capped lists and counts for impacts, findings, failed or
missing Controls, Actions, Evidence, assertions, and pinned Chip/Metric Context.
Guided Story deterministically walks persisted causal paths to Key Factors and
Root Causes, including relevant Controls, Actions, Evidence, and attachments.
It does not generate conclusions, invoke AI, or support manually authored story
steps.
