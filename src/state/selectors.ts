import type { Edge, Node } from "reactflow";
import type { BarrierNodeData, ChainNodeData } from "./useAppStore";
import type { ContextItem, EvidenceItem } from "../features/maps/schema";
import type { EventPhase } from "../features/maps/schema";

const causalNodeTypes = new Set<ChainNodeData["nodeType"]>([
  "Impact",
  "Event",
  "Factor",
]);

export type EligibleControlRelationship = {
  edgeId: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
  label: string;
};
export type ControlRelationship = EligibleControlRelationship & {
  eligible: boolean;
  upstreamTitle: string;
  downstreamTitle: string;
};

export type CreationCommand =
  | "Impact"
  | "Event"
  | "Factor"
  | "Control"
  | "Action";
export type CreationMode =
  | "TopLevel"
  | "CausalChild"
  | "Relationship"
  | "Sidecar";
export type CreationContext =
  | { kind: "Canvas" }
  | {
      kind: "Impact" | "Event" | "Factor" | "Action";
      id: string;
      referenceId?: string;
      title: string;
    }
  | { kind: "Control"; id: string; referenceId?: string; title: string };
export type CreationOption = {
  type: CreationCommand;
  mode: CreationMode;
  label: string;
  help: string;
  eligibleRelationshipCount?: number;
};

export const selectCreationContext = (
  selectionId: string | null,
  nodes: Node<ChainNodeData>[],
  controls: Array<{ id: string; referenceId?: string; description?: string }>,
): CreationContext => {
  if (!selectionId) return { kind: "Canvas" };
  const node = nodes.find((item) => item.id === selectionId);
  if (node?.data.nodeType)
    return {
      kind: node.data.nodeType,
      id: node.id,
      referenceId: node.data.referenceId,
      title: node.data.title,
    };
  const control = controls.find((item) => item.id === selectionId);
  return control
    ? {
        kind: "Control",
        id: control.id,
        referenceId: control.referenceId,
        title: control.description ?? "Control",
      }
    : { kind: "Canvas" };
};

/** The single product rule matrix for every structural creation surface. */
export const selectAvailableCreationOptions = (
  context: CreationContext,
  impactCount: number,
  eligibleRelationshipCount: number,
): CreationOption[] => {
  const option = (
    type: CreationCommand,
    mode: CreationMode,
    label: string,
    help: string,
  ): CreationOption => ({ type, mode, label, help });
  if (context.kind === "Canvas")
    return [
      option(
        "Impact",
        "TopLevel",
        impactCount ? "Another outcome" : "Add an outcome",
        "A material outcome of the incident",
      ),
    ];
  if (context.kind === "Control" || context.kind === "Action") return [];
  const control = eligibleRelationshipCount
    ? [
        {
          ...option(
            "Control",
            "Relationship",
            "Add safeguard",
            "A safeguard on a causal relationship",
          ),
          eligibleRelationshipCount,
        },
      ]
    : [];
  if (context.kind === "Impact")
    return [
      option(
        "Impact",
        "TopLevel",
        "Another outcome",
        "A material outcome of the incident",
      ),
      option(
        "Event",
        "CausalChild",
        "What happened?",
        "Something that happened in the causal story",
      ),
      ...control,
      option(
        "Action",
        "Sidecar",
        "Address this outcome",
        "A response attached to an outcome, event, or finding",
      ),
    ];
  if (context.kind === "Event")
    return [
      option(
        "Event",
        "CausalChild",
        "Contributing occurrence",
        "Something that happened in the causal story",
      ),
      option(
        "Factor",
        "CausalChild",
        "Why did this happen?",
        "A condition explaining why",
      ),
      ...control,
      option(
        "Action",
        "Sidecar",
        "Address this event",
        "A response attached to an outcome, event, or finding",
      ),
    ];
  return [
    option(
      "Factor",
      "CausalChild",
      "Ask why again",
      "A condition explaining why",
    ),
    ...control,
    option(
      "Action",
      "Sidecar",
      "Address this finding",
      "A response attached to an outcome, event, or finding",
    ),
  ];
};

/**
 * Selects causal relationships adjacent to the selected semantic node.
 * React Flow's persisted direction is causal parent (`source`) to causal child
 * (`target`); keeping that knowledge here prevents guide and Inspector drift.
 */
export const selectControlRelationships = (
  selectionId: string | null,
  nodes: Node<ChainNodeData>[],
  edges: Edge[],
  controls: Array<Pick<BarrierNodeData, "upstreamNodeId" | "downstreamNodeId">>,
): ControlRelationship[] => {
  const selected = nodes.find(({ id }) => id === selectionId);
  if (
    !selected ||
    !selected.data.nodeType ||
    !causalNodeTypes.has(selected.data.nodeType)
  )
    return [];
  const references = new Map(
    nodes.map((node) => [node.id, node.data.referenceId ?? "N-???"]),
  );
  return edges
    .filter(
      (edge) =>
        (edge.source === selected.id || edge.target === selected.id) &&
        (edge.data?.kind === undefined ||
          edge.data.kind === "CauseEffectEdge") &&
        nodes.some(
          (node) =>
            node.id === edge.source && causalNodeTypes.has(node.data.nodeType),
        ) &&
        nodes.some(
          (node) =>
            node.id === edge.target && causalNodeTypes.has(node.data.nodeType),
        ),
    )
    .map((edge) => ({
      edgeId: edge.id,
      upstreamNodeId: edge.source,
      downstreamNodeId: edge.target,
      label: `${references.get(edge.source)} → ${references.get(edge.target)}`,
      upstreamTitle:
        nodes.find((node) => node.id === edge.source)?.data.title ??
        edge.source,
      downstreamTitle:
        nodes.find((node) => node.id === edge.target)?.data.title ??
        edge.target,
      eligible: !controls.some(
        (control) =>
          control.upstreamNodeId === edge.source &&
          control.downstreamNodeId === edge.target,
      ),
    }));
};

export const selectEligibleControlRelationships = (
  selectionId: string | null,
  nodes: Node<ChainNodeData>[],
  edges: Edge[],
  controls: Array<Pick<BarrierNodeData, "upstreamNodeId" | "downstreamNodeId">>,
): EligibleControlRelationship[] =>
  selectControlRelationships(selectionId, nodes, edges, controls)
    .filter(({ eligible }) => eligible)
    .map(
      ({ eligible: _, upstreamTitle: _u, downstreamTitle: _d, ...item }) =>
        item,
    );

/** Whether the current selection can participate in the causal chain. */
export const canAddBelowSelection = (
  selectionId: string | null,
  nodes: Node<ChainNodeData>[],
): boolean => {
  if (!selectionId) return false;
  const selectedNode = nodes.find((node) => node.id === selectionId);
  return Boolean(
    selectedNode?.data.nodeType &&
      causalNodeTypes.has(selectedNode.data.nodeType),
  );
};

export const resolveEvidence = (ids: string[], registry: EvidenceItem[]) => {
  const byId = new Map(registry.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [{ ...item }] : [];
  });
};

export const selectEvidenceLinkCounts = (
  registry: EvidenceItem[],
  nodes: Node<ChainNodeData>[],
  controls: Array<{ evidenceIds: string[] }>,
) =>
  Object.fromEntries(
    registry.map((item) => [
      item.id,
      nodes.filter((node) => (node.data.evidenceIds ?? []).includes(item.id))
        .length +
        controls.filter((control) => control.evidenceIds.includes(item.id))
          .length,
    ]),
  );

/** Human-facing entities linked to an evidence item, never persistence UUIDs. */
export const selectEvidenceLinkedEntityLabels = (
  evidenceId: string,
  nodes: Node<ChainNodeData>[],
  controls: Array<Pick<BarrierNodeData, "referenceId" | "evidenceIds">>,
): string[] => [
  ...nodes
    .filter((node) => (node.data.evidenceIds ?? []).includes(evidenceId))
    .map((node) => node.data.referenceId ?? "Unassigned node"),
  ...controls
    .filter((control) => (control.evidenceIds ?? []).includes(evidenceId))
    .map((control) => control.referenceId ?? "Unassigned control"),
];

/** Every graph entity linked to Evidence, with stable human-facing references. */
export const selectEvidenceLinkedEntities = (
  evidenceId: string,
  nodes: Node<ChainNodeData>[],
  controls: Array<
    Pick<BarrierNodeData, "referenceId" | "evidenceIds"> & { id: string }
  >,
) => [
  ...nodes
    .filter((node) => node.data.evidenceIds?.includes(evidenceId))
    .map((node) => ({
      kind: "node" as const,
      id: node.id,
      referenceId: node.data.referenceId ?? "N-???",
    })),
  ...controls
    .filter((control) => control.evidenceIds?.includes(evidenceId))
    .map((control) => ({
      kind: "control" as const,
      id: control.id,
      referenceId: control.referenceId ?? "C-???",
    })),
];

export const selectPinnedContext = (items: ContextItem[]) =>
  items.filter((item) => item.showOnCard).map((item) => ({ ...item }));

export type ContextGroups = {
  Aggravating: ContextItem[];
  Mitigating: ContextItem[];
  Neutral: ContextItem[];
};

/** Partitions Context while preserving author order and legacy Neutral defaults. */
export const selectContextGroups = (items: ContextItem[]): ContextGroups => {
  const groups: ContextGroups = {
    Aggravating: [],
    Mitigating: [],
    Neutral: [],
  };
  items.forEach((item) => groups[item.effect ?? "Neutral"].push({ ...item }));
  return groups;
};

export const selectContextByEffect = (
  items: ContextItem[],
  effect: NonNullable<ContextItem["effect"]>,
) => selectContextGroups(items)[effect];

export type CompactContextSelection = ContextGroups & { overflow: number };

/**
 * Selects at most two pinned items: one item from each directional group first,
 * then Neutral Context. The overflow counts every other pinned item.
 */
export const selectCompactContext = (
  items: ContextItem[],
): CompactContextSelection => {
  const pinned = selectContextGroups(selectPinnedContext(items));
  const selected: ContextGroups = {
    Aggravating: pinned.Aggravating.slice(0, 1),
    Mitigating: pinned.Mitigating.slice(0, 1),
    Neutral: [],
  };
  const remaining =
    2 - selected.Aggravating.length - selected.Mitigating.length;
  selected.Neutral = pinned.Neutral.slice(0, Math.max(0, remaining));
  const shown =
    selected.Aggravating.length +
    selected.Mitigating.length +
    selected.Neutral.length;
  return {
    ...selected,
    overflow:
      pinned.Aggravating.length +
      pinned.Mitigating.length +
      pinned.Neutral.length -
      shown,
  };
};

export const chronologyPhaseOrder: EventPhase[] = [
  "Precursor",
  "Incident",
  "Detection",
  "Response",
  "Recovery",
];

export type ChronologyGroup = {
  phase: EventPhase | "Unphased" | "Untimed Events";
  events: Node<ChainNodeData>[];
};

const chronologyTieBreaker = (a: Node<ChainNodeData>, b: Node<ChainNodeData>) =>
  (a.data.referenceId ?? "").localeCompare(b.data.referenceId ?? "") ||
  a.data.title.localeCompare(b.data.title) ||
  a.id.localeCompare(b.id);

/**
 * Builds the read-only incident chronology. Valid timestamps are ordered by
 * instant, then reference/title; Events without a parseable timestamp are
 * deliberately retained in a final “Untimed Events” group.
 */
export const selectChronologyGroups = (
  nodes: Node<ChainNodeData>[],
): ChronologyGroup[] => {
  const events = nodes.filter((node) => node.data.nodeType === "Event");
  const timed = events
    .filter((node) => Number.isFinite(Date.parse(node.data.timestamp ?? "")))
    .slice()
    .sort((a, b) => {
      const time =
        Date.parse(a.data.timestamp ?? "") - Date.parse(b.data.timestamp ?? "");
      return time || chronologyTieBreaker(a, b);
    });
  const phases: Array<EventPhase | "Unphased"> = [
    ...chronologyPhaseOrder,
    "Unphased",
  ];
  const groups: ChronologyGroup[] = phases.flatMap((phase) => {
    const matching = timed.filter(
      (node) => (node.data.eventPhase ?? "Unphased") === phase,
    );
    return matching.length ? [{ phase, events: matching }] : [];
  });
  const untimed = events
    .filter((node) => !Number.isFinite(Date.parse(node.data.timestamp ?? "")))
    .slice()
    .sort(chronologyTieBreaker);
  if (untimed.length) groups.push({ phase: "Untimed Events", events: untimed });
  return groups;
};

/** @deprecated Prefer selectChronologyGroups so untimed Events are retained. */
export const selectChronologicalEvents = (nodes: Node<ChainNodeData>[]) =>
  selectChronologyGroups(nodes)
    .filter((group) => group.phase !== "Untimed Events")
    .flatMap((group) => group.events);

/** True when a stored timestamp explicitly represents non-zero seconds. */
export const timestampNeedsSeconds = (value?: string): boolean =>
  Boolean(value && /T\d{2}:\d{2}:(?!00(?:\.0+)?(?:Z|[+-]|$))\d{2}/.test(value));

/** Shared, locale-aware Event date/time formatter. */
export const formatEventDateTime = (
  value?: string,
  includeSeconds = timestampNeedsSeconds(value),
): string | null => {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: includeSeconds ? "medium" : "short",
  }).format(new Date(value));
};

/** Compact, human-readable duration between two valid ordered timestamps. */
export const formatEventDuration = (
  start?: string,
  end?: string,
): string | null => {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs)
    return null;
  let seconds = Math.floor((endMs - startMs) / 1000);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  const parts = [
    days && `${days}d`,
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    seconds && `${seconds}s`,
  ].filter(Boolean);
  return parts.join(" ") || "0m";
};
