import type { Node } from "reactflow";
import type { ContextItem, EvidenceItem } from "../maps/schema";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";
import { selectPinnedContext } from "../../state/selectors";

/** Lists preserve persisted array order. Caps prevent the review panel obscuring the map. */
export const CASE_SUMMARY_LIST_CAP = 5;

export type SummaryItem = { id: string; label: string; referenceId?: string };
export type CaseSummaryModel = ReturnType<typeof selectCaseSummary>;

export const selectCaseSummary = (
  nodes: Node<ChainNodeData>[],
  controls: Array<BarrierNodeData & { id: string }>,
  evidence: EvidenceItem[],
  contextItems: ContextItem[] = [],
) => {
  const items = (predicate: (node: Node<ChainNodeData>) => boolean) =>
    nodes
      .filter(predicate)
      .slice(0, CASE_SUMMARY_LIST_CAP)
      .map((node) => ({
        id: node.id,
        label: node.data.title,
        referenceId: node.data.referenceId,
      }));
  const controlItems = controls
    .filter((control) => ["Failed", "Missing"].includes(control.status))
    .slice(0, CASE_SUMMARY_LIST_CAP)
    .map((control) => ({
      id: control.id,
      label: control.description || "Untitled Control",
      referenceId: control.referenceId,
    }));
  const actions = nodes.filter((node) => node.data.nodeType === "Action");
  const countBy = (values: Array<string | undefined>) =>
    values.reduce<Record<string, number>>((result, value) => {
      if (value) result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});
  const assertions = [
    ...nodes
      .filter((node) => node.data.nodeType === "Factor")
      .map((n) => n.data.assertionState),
    ...controls.map((control) => control.assertionState),
  ];
  return {
    impacts: items((node) => node.data.nodeType === "Impact"),
    rootCauses: items((node) => node.data.factorSignificance === "RootCause"),
    keyFactors: items((node) => node.data.factorSignificance === "KeyFactor"),
    failedOrMissingControls: controlItems,
    controlCounts: countBy(controls.map((control) => control.status)),
    actionTypeCounts: countBy(actions.map((node) => node.data.actionType)),
    actionStatusCounts: countBy(actions.map((node) => node.data.actionStatus)),
    completedActionCount: actions.filter((node) => node.data.actionCompletedAt)
      .length,
    incompleteActions: actions
      .filter((node) => node.data.actionStatus !== "Completed")
      .slice(0, CASE_SUMMARY_LIST_CAP)
      .map((node) => ({
        id: node.id,
        label: node.data.title,
        referenceId: node.data.referenceId,
      })),
    evidenceTypeCounts: countBy(evidence.map((item) => item.type)),
    assertionCounts: {
      Confirmed: assertions.filter((state) => state === "Confirmed").length,
      Working: assertions.filter((state) => state === "Working").length,
    },
    context: selectPinnedContext(contextItems).filter(
      (item) => item.displayMode === "Chip" || item.displayMode === "Metric",
    ),
  };
};
