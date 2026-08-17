import type { Node } from "reactflow";
import type { Attachment, EvidenceItem } from "../maps/schema";
import type { ChainNodeData } from "../../state/useAppStore";

export type StoryEntityKind = "node" | "control" | "evidence";
export type StoryStepType =
  | "Impact"
  | "Incident Event"
  | "Event"
  | "Control"
  | "Key Factor"
  | "Root Cause"
  | "Action"
  | "Evidence";

export type StoryStep = {
  id: string;
  type: StoryStepType;
  entityKind: StoryEntityKind;
  entityId: string;
  title: string;
  branch: number;
  branchCount: number;
  /** The causal path plus directly linked context that should be fitted. */
  focusIds: string[];
  node?: Node<ChainNodeData>;
  control?: StoryControl;
  evidence?: EvidenceItem;
  attachments?: Attachment[];
};

export type StorySequence = { steps: StoryStep[]; branchCount: number };
export type StoryControl = {
  id: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
  description?: string;
  referenceId?: string;
  status: string;
  failureReason?: string;
  failureDetails?: string;
  controlRole?: string;
  evidenceIds?: string[];
};

export type StoryInput = {
  nodes: Node<ChainNodeData>[];
  edges: Array<{
    id?: string;
    source: string;
    target: string;
    data?: { kind?: string };
  }>;
  controls: StoryControl[];
  evidence: EvidenceItem[];
  attachments?: Attachment[];
};

const reference = (value: { id: string; data?: { referenceId?: string } }) =>
  value.data?.referenceId ?? value.id;
const compareNodes = (a: Node<ChainNodeData>, b: Node<ChainNodeData>) =>
  reference(a).localeCompare(reference(b), undefined, { numeric: true }) ||
  a.id.localeCompare(b.id);
const compareControls = (a: StoryControl, b: StoryControl) =>
  (a.referenceId ?? a.id).localeCompare(b.referenceId ?? b.id, undefined, {
    numeric: true,
  }) || a.id.localeCompare(b.id);

/**
 * Builds a factual guided review solely from persisted entities and explicit
 * relationships. It deliberately does not infer or generate conclusions.
 */
export const deriveStorySequence = (
  input: StoryInput,
  selectedId: string | null = null,
): StorySequence => {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const causal = input.edges.filter((edge) => edge.data?.kind !== "ActionEdge");
  const outgoing = new Map<string, string[]>();
  causal.forEach((edge) =>
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      edge.target,
    ]),
  );
  outgoing.forEach((ids) =>
    ids.sort((a, b) => {
      const left = nodeById.get(a),
        right = nodeById.get(b);
      return left && right ? compareNodes(left, right) : a.localeCompare(b);
    }),
  );
  const findings = input.nodes
    .filter(
      (node) =>
        node.data.nodeType === "Factor" &&
        ["KeyFactor", "RootCause"].includes(node.data.factorSignificance ?? ""),
    )
    .sort(compareNodes);
  const selectedFinding = findings.find((node) => node.id === selectedId);
  const targets = selectedFinding ? [selectedFinding] : findings;

  const pathsTo = (targetId: string): string[][] => {
    const impacts = input.nodes
      .filter((node) => node.data.nodeType === "Impact")
      .sort(compareNodes);
    const found: string[][] = [];
    const visit = (id: string, path: string[], seen: Set<string>) => {
      if (id === targetId) {
        found.push(path);
        return;
      }
      for (const next of outgoing.get(id) ?? []) {
        if (!seen.has(next))
          visit(next, [...path, next], new Set([...seen, next]));
      }
    };
    impacts.forEach((impact) =>
      visit(impact.id, [impact.id], new Set([impact.id])),
    );
    // Retain a disconnected persisted finding rather than silently hiding it.
    return found.length ? found : [[targetId]];
  };

  const branches = targets.flatMap((target) =>
    pathsTo(target.id).map((path) => ({ target, path })),
  );
  const emitted = new Set<string>();
  const steps: StoryStep[] = [];
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const attachmentById = new Map(
    (input.attachments ?? []).map((item) => [item.id, item]),
  );

  branches.forEach(({ path }, branchIndex) => {
    const pathSet = new Set(path);
    const branchControls = input.controls
      .filter(
        (control) =>
          ["Failed", "Missing"].includes(control.status) &&
          pathSet.has(control.upstreamNodeId) &&
          pathSet.has(control.downstreamNodeId),
      )
      .sort(compareControls);
    const actions = input.edges
      .filter(
        (edge) => edge.data?.kind === "ActionEdge" && pathSet.has(edge.source),
      )
      .map((edge) => nodeById.get(edge.target))
      .filter((node): node is Node<ChainNodeData> => Boolean(node))
      .sort(compareNodes);
    const orderedEntities: Array<{
      kind: "node" | "control";
      value: Node<ChainNodeData> | StoryControl;
    }> = [];
    path.forEach((id) => {
      const node = nodeById.get(id);
      if (!node) return;
      orderedEntities.push({ kind: "node", value: node });
      branchControls
        .filter((control) => control.upstreamNodeId === id)
        .forEach((control) =>
          orderedEntities.push({ kind: "control", value: control }),
        );
    });
    actions.forEach((node) =>
      orderedEntities.push({ kind: "node", value: node }),
    );

    const linkedEvidenceIds: string[] = [];
    orderedEntities.forEach(({ kind, value }) => {
      const entityId = value.id;
      const ids =
        kind === "node"
          ? ((value as Node<ChainNodeData>).data.evidenceIds ?? [])
          : ((value as StoryControl).evidenceIds ?? []);
      ids.forEach((id) => {
        if (!linkedEvidenceIds.includes(id)) linkedEvidenceIds.push(id);
      });
      if (emitted.has(`${kind}:${entityId}`)) return;
      emitted.add(`${kind}:${entityId}`);
      if (kind === "control") {
        const control = value as StoryControl;
        steps.push({
          id: `control:${entityId}`,
          type: "Control",
          entityKind: "control",
          entityId,
          title: control.description || control.referenceId || "Control",
          control,
          branch: branchIndex + 1,
          branchCount: branches.length,
          focusIds: [...path, entityId],
        });
      } else {
        const node = value as Node<ChainNodeData>;
        const firstEventId = path.find(
          (pathId) => nodeById.get(pathId)?.data.nodeType === "Event",
        );
        const type: StoryStepType =
          node.data.nodeType === "Impact"
            ? "Impact"
            : node.data.nodeType === "Action"
              ? "Action"
              : node.data.nodeType === "Factor" &&
                  node.data.factorSignificance === "RootCause"
                ? "Root Cause"
                : node.data.nodeType === "Factor" &&
                    node.data.factorSignificance === "KeyFactor"
                  ? "Key Factor"
                  : node.data.nodeType === "Event" &&
                      (node.data.eventPhase === "Incident" ||
                        node.id === firstEventId)
                    ? "Incident Event"
                    : "Event";
        steps.push({
          id: `node:${entityId}`,
          type,
          entityKind: "node",
          entityId,
          title: node.data.title,
          node,
          branch: branchIndex + 1,
          branchCount: branches.length,
          focusIds: [
            ...path,
            ...branchControls.map((c) => c.id),
            ...actions.map((a) => a.id),
          ],
        });
      }
    });
    linkedEvidenceIds
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach((id) => {
        const evidence = evidenceById.get(id);
        if (!evidence || emitted.has(`evidence:${id}`)) return;
        emitted.add(`evidence:${id}`);
        steps.push({
          id: `evidence:${id}`,
          type: "Evidence",
          entityKind: "evidence",
          entityId: id,
          title: evidence.title,
          evidence,
          attachments: evidence.attachmentIds.flatMap(
            (attachmentId) => attachmentById.get(attachmentId) ?? [],
          ),
          branch: branchIndex + 1,
          branchCount: branches.length,
          focusIds: [...path, ...branchControls.map((c) => c.id)],
        });
      });
  });
  return { steps, branchCount: branches.length };
};

export const deriveStory = deriveStorySequence;
