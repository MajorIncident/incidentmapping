import type { Edge, Node } from "reactflow";
import type { Attachment, EvidenceItem } from "../maps/schema";
import type { ChainNodeData } from "../../state/useAppStore";
import type { StoryControl } from "./story";

export type PresentationChapterId =
  | "Brief"
  | "Occurrence"
  | "Findings"
  | "Controls"
  | "Actions"
  | "Close";
export type PresentationType =
  | "Summary"
  | "ChronologyEvent"
  | "FindingBranch"
  | "ControlReview"
  | "ActionGroup"
  | "ClosingSummary";
export type PresentationTalkingPoint = { label?: string; text: string };
export type PresentationStep = {
  id: string;
  chapterId: PresentationChapterId;
  title: string;
  primaryEntityId?: string;
  entityIds: string[];
  focusIds: string[];
  backgroundIds?: string[];
  evidenceIds?: string[];
  presentationType: PresentationType;
  cameraMode: "Overview" | "FocusGroup" | "Preserve";
  talkingPoints?: PresentationTalkingPoint[];
  node?: Node<ChainNodeData>;
  control?: StoryControl;
  actions?: Node<ChainNodeData>[];
};
export type PresentationChapter = {
  id: PresentationChapterId;
  title: string;
  question: string;
  steps: PresentationStep[];
};
export type PresentationStory = { chapters: PresentationChapter[] };
export type PresentationStoryInput = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  controls: StoryControl[];
  evidence: EvidenceItem[];
  attachments?: Attachment[];
};

const chapterDetails: Array<[PresentationChapterId, string, string]> = [
  ["Brief", "THE BRIEF", "What happened and why does it matter?"],
  ["Occurrence", "WHAT HAPPENED?", "What was the sequence of events?"],
  ["Findings", "WHY DID IT HAPPEN?", "What findings explain the outcome?"],
  [
    "Controls",
    "WHAT SHOULD HAVE PROTECTED US?",
    "Which Controls were relevant and how did they perform?",
  ],
  ["Actions", "WHAT CHANGES NOW?", "What Actions address the findings?"],
  ["Close", "THE CLOSE", "What should the audience remember?"],
];
const ref = (node: Node<ChainNodeData>) => node.data.referenceId ?? node.id;
const byRef = (a: Node<ChainNodeData>, b: Node<ChainNodeData>) =>
  ref(a).localeCompare(ref(b), undefined, { numeric: true }) ||
  a.id.localeCompare(b.id);
const unique = (values: string[]) => [...new Set(values)];

/** Builds the deterministic, ephemeral six-chapter briefing from persisted data. */
export const derivePresentationStory = (
  input: PresentationStoryInput,
): PresentationStory => {
  const nodes = [...input.nodes].sort(byRef);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const causal = input.edges.filter((edge) => edge.data?.kind !== "ActionEdge");
  const incoming = new Map<string, string[]>();
  causal.forEach((edge) =>
    incoming.set(edge.target, [
      ...(incoming.get(edge.target) ?? []),
      edge.source,
    ]),
  );
  incoming.forEach((ids) =>
    ids.sort((a, b) => byRef(nodeById.get(a)!, nodeById.get(b)!)),
  );
  const impacts = nodes.filter((node) => node.data.nodeType === "Impact");
  const events = nodes
    .filter((node) => node.data.nodeType === "Event")
    .sort((a, b) => {
      const at = a.data.timestamp
        ? Date.parse(a.data.timestamp)
        : Number.MAX_SAFE_INTEGER;
      const bt = b.data.timestamp
        ? Date.parse(b.data.timestamp)
        : Number.MAX_SAFE_INTEGER;
      return at - bt || byRef(a, b);
    });
  const factors = nodes.filter((node) => node.data.nodeType === "Factor");
  let findings = factors.filter((node) =>
    ["RootCause", "KeyFactor"].includes(node.data.factorSignificance ?? ""),
  );
  if (!findings.length)
    findings = factors.filter(
      (node) =>
        !causal.some(
          (edge) =>
            edge.source === node.id &&
            nodeById.get(edge.target)?.data.nodeType === "Factor",
        ),
    );
  findings.sort((a, b) => {
    const rank = (node: Node<ChainNodeData>) =>
      node.data.factorSignificance === "RootCause"
        ? 0
        : node.data.factorSignificance === "KeyFactor"
          ? 1
          : 2;
    return rank(a) - rank(b) || byRef(a, b);
  });
  const pathTo = (target: string) => {
    const found = new Set<string>([target]);
    const pending = [target];
    while (pending.length)
      for (const id of incoming.get(pending.pop()!) ?? [])
        if (!found.has(id)) {
          found.add(id);
          pending.push(id);
        }
    const depth = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      const parents = (incoming.get(id) ?? []).filter((parent) =>
        found.has(parent),
      );
      return parents.length
        ? 1 +
            Math.max(
              ...parents.map((parent) => depth(parent, new Set([...seen, id]))),
            )
        : 0;
    };
    return nodes
      .filter((node) => found.has(node.id))
      .sort((a, b) => depth(a.id) - depth(b.id) || byRef(a, b))
      .map((node) => node.id);
  };
  const evidenceIds = (ids: string[]) =>
    unique(ids.flatMap((id) => nodeById.get(id)?.data.evidenceIds ?? []));
  const brief: PresentationStep = {
    id: "brief",
    chapterId: "Brief",
    title:
      impacts.map((n) => n.data.title).join(" · ") || "Investigation briefing",
    entityIds: impacts.map((n) => n.id),
    focusIds: impacts.map((n) => n.id),
    evidenceIds: [],
    presentationType: "Summary",
    cameraMode: "Overview",
    talkingPoints: impacts.map((n) => ({
      label: n.data.referenceId,
      text: n.data.title,
    })),
  };
  const occurrence = events.map(
    (node, index): PresentationStep => ({
      id: `occurrence:${node.id}`,
      chapterId: "Occurrence",
      title: node.data.title,
      primaryEntityId: node.id,
      entityIds: [node.id],
      focusIds: node.data.eventDisplay === "ChronologyOnly" ? [] : [node.id],
      evidenceIds: node.data.evidenceIds,
      presentationType: "ChronologyEvent",
      cameraMode: index ? "Preserve" : "FocusGroup",
      node,
      talkingPoints: [node.data.description, node.data.eventPhase]
        .filter(Boolean)
        .map((text) => ({ text: text! })),
    }),
  );
  const findingSteps = findings.map((node): PresentationStep => {
    const path = pathTo(node.id);
    return {
      id: `finding:${node.id}`,
      chapterId: "Findings",
      title: node.data.title,
      primaryEntityId: node.id,
      entityIds: path,
      focusIds: path,
      evidenceIds: evidenceIds(path),
      presentationType: "FindingBranch",
      cameraMode: "FocusGroup",
      node,
      talkingPoints: path.map((id) => ({
        label: nodeById.get(id)?.data.referenceId,
        text: nodeById.get(id)?.data.title ?? id,
      })),
    };
  });
  const statusRank: Record<string, number> = {
    Missing: 0,
    Failed: 1,
    Degraded: 2,
    Effective: 3,
  };
  const controls = [...input.controls].sort(
    (a, b) =>
      (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
      (a.referenceId ?? a.id).localeCompare(b.referenceId ?? b.id, undefined, {
        numeric: true,
      }),
  );
  const controlSteps = controls.map(
    (control): PresentationStep => ({
      id: `control:${control.id}`,
      chapterId: "Controls",
      title: control.description || control.referenceId || "Control",
      primaryEntityId: control.id,
      entityIds: [control.upstreamNodeId, control.id, control.downstreamNodeId],
      focusIds: [control.upstreamNodeId, control.id, control.downstreamNodeId],
      evidenceIds: control.evidenceIds,
      presentationType: "ControlReview",
      cameraMode: "FocusGroup",
      control,
      talkingPoints: [control.failureDetails]
        .filter(Boolean)
        .map((text) => ({ text: text! })),
    }),
  );
  const actionEdges = input.edges.filter(
    (edge) => edge.data?.kind === "ActionEdge",
  );
  const actionRank: Record<string, number> = {
    InProgress: 0,
    Planned: 1,
    Proposed: 2,
    Completed: 3,
    Cancelled: 4,
  };
  const groups = new Map<string, Node<ChainNodeData>[]>();
  actionEdges.forEach((edge) => {
    const action = nodeById.get(edge.target);
    if (action?.data.nodeType === "Action")
      groups.set(edge.source, [...(groups.get(edge.source) ?? []), action]);
  });
  const actionSteps = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, actions]): PresentationStep => {
      actions.sort(
        (a, b) =>
          (actionRank[a.data.actionStatus ?? ""] ?? 9) -
            (actionRank[b.data.actionStatus ?? ""] ?? 9) ||
          (a.data.actionDueDate ?? "").localeCompare(
            b.data.actionDueDate ?? "",
          ) ||
          byRef(a, b),
      );
      return {
        id: `actions:${source}`,
        chapterId: "Actions",
        title: nodeById.get(source)?.data.title ?? "Actions",
        primaryEntityId: source,
        entityIds: [source, ...actions.map((a) => a.id)],
        focusIds: [source, ...actions.map((a) => a.id)],
        evidenceIds: evidenceIds(actions.map((a) => a.id)),
        presentationType: "ActionGroup",
        cameraMode: "FocusGroup",
        actions,
        talkingPoints: actions.map((a) => ({
          label: a.data.actionStatus,
          text: a.data.title,
        })),
      };
    });
  const empty = (
    chapterId: PresentationChapterId,
    title: string,
    type: PresentationType,
  ): PresentationStep => ({
    id: `${chapterId.toLowerCase()}:empty`,
    chapterId,
    title,
    entityIds: [],
    focusIds: [],
    presentationType: type,
    cameraMode: "Overview",
  });
  const all: Record<PresentationChapterId, PresentationStep[]> = {
    Brief: [brief],
    Occurrence: occurrence.length
      ? occurrence
      : [empty("Occurrence", "No Events recorded.", "ChronologyEvent")],
    Findings: findingSteps.length
      ? findingSteps
      : [empty("Findings", "No causal Findings recorded.", "FindingBranch")],
    Controls: controlSteps.length
      ? controlSteps
      : [empty("Controls", "No Controls recorded.", "ControlReview")],
    Actions: actionSteps.length
      ? actionSteps
      : [empty("Actions", "No Actions recorded.", "ActionGroup")],
    Close: [
      {
        ...brief,
        id: "close",
        chapterId: "Close",
        title: "Investigation summary",
        presentationType: "ClosingSummary",
      },
    ],
  };
  return {
    chapters: chapterDetails.map(([id, title, question]) => ({
      id,
      title,
      question,
      steps: all[id],
    })),
  };
};

export const flattenPresentationStory = (story: PresentationStory) =>
  story.chapters.flatMap((chapter) =>
    chapter.steps.map((step) => ({ chapter, step })),
  );
