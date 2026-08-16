# Investigation Model

This model separates what happened, why it happened, what constrained it, what
supports the analysis, and what should happen next. The distinctions are both
investigative guidance and the semantics represented by the V3 wire contract.

## Impact

An **Impact** is an outcome or consequence of the incident: harm, loss,
disruption, or another material effect. Impacts belong in the causal story and
may have severity, narrative, consequences, Context, and linked Evidence. An
Impact is not an Action and does not describe remediation.

## Event

An **Event** is something that occurred in the incident story. Its timestamp may
locate it in Chronology; an untimed or invalidly timed Event is retained in the
final **Untimed Events** group at the bottom rather than omitted. Event nodes can
carry an Event Phase, Context, and Evidence references.

## Event Phase

**Event Phase** locates an Event in the narrative: `Precursor`, `Incident`,
`Detection`, `Response`, or `Recovery`. It is valid only for Events. Event Phase
locates an Event in the story; it does not alter causal semantics. Causation is
expressed by causal relationships, not by phase order, and a later-phase Event
is not automatically an effect of an earlier one.

## Factor

A **Factor** is a condition the investigation judges to have contributed
causally. It may be categorized as Human, Process, Equipment, Technology,
Communication, Environment, Organizational, or Other. Factors participate in
the causal graph. Context is a fact; a Factor is judged causal. Similar wording
may appear first as Context and later become a Factor only after that analytical
judgment.

## Key Factor

A **Key Factor** is a Factor whose significance is elevated because it is
important to understanding or addressing the incident. It remains a Factor and
retains causal semantics; the designation prioritizes it rather than creating a
new relationship type.

## Root Cause

A **Root Cause** is a Factor given the strongest causal-significance
classification in this model. It communicates the investigation's conclusion,
not merely a graph-layout root or the earliest item in time. Root Cause is a
Factor significance value, so it should be supported by analysis and linked
Evidence rather than inferred from node position.

## Control

A **Control** is a safeguard associated with one specific ordered causal
relationship. It may have a description, Control Role, Control Status, failure
reason/details, and linked Evidence. The persisted discriminator remains
`Barrier` for wire compatibility, but the investigation concept is Control.
Controls do not replace causal edges and are not free-standing causes.

## Control Role

**Control Role** describes intended function: `Preventive`, `Detective`, or
`Mitigating`. **Control Status** describes observed performance: `Effective`,
`Degraded`, `Failed`, or `Missing`. Control Role describes intent; Control
Status describes performance. A preventive Control can therefore be degraded,
and a detective Control can be effective; neither dimension implies the other.

## Action

An **Action** is a proposed or managed response linked from exactly one
non-Action source. Its link is not causal. An Action can record owner, due date,
Action Type, and Action Status; it cannot carry Context in V3. Actions answer
what will be done, not what caused the incident.

## Action Type

**Action Type** describes purpose: `Immediate`, `Corrective`, or `Preventive`.
**Action Status** describes lifecycle: `Proposed`, `Planned`, `InProgress`,
`Completed`, or `Cancelled`. Action Type describes purpose; Action Status
describes lifecycle. For example, a Preventive Action may still be Proposed or
Completed.

## Evidence

**Evidence** is a globally owned registry record with type, title, and optional
description, source, and reference. Nodes and Controls link to it by stable ID,
allowing one item to support multiple assertions without duplication. Evidence
supports an assertion; Evidence is not itself a cause. Causal judgment belongs
in Factors and causal relationships, with Evidence supplying support.

Evidence types are Note, Photo, Video, Document, SystemLog, Interview, and
Other. These classify the record; they do not claim that a file was uploaded or
stored. Later attachment or link fields can extend Evidence, but V3 contains no
unused attachment placeholder and provides no file-storage contract.

## Context

**Context** is a labeled factual condition or circumstance recorded at the
incident level or on an Event, Factor, or Impact. Examples include weather,
operating mode, staffing level, or environmental conditions. It may be pinned
for card display. Context is a fact; a Factor is judged causal. Context neither
creates a causal relationship nor becomes Evidence: Evidence supports the
assertion that a contextual fact is true, while a Factor expresses the separate
judgment that a condition contributed.
