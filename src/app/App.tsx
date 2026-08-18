import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { Footer } from "../components/Footer/Footer";
import { IncidentHeader } from "../components/IncidentHeader/IncidentHeader";
import { useAppStore } from "../state/useAppStore";
import {
  applyHierarchyLayout,
  type CanvasDetail,
} from "../features/layout/hierarchy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chronology } from "../components/Presentation/Chronology";
import {
  canAddBelowSelection,
  selectEligibleControlRelationships,
} from "../state/selectors";
import { ControlBranchChooser } from "../components/Sidebar/ControlBranchChooser";
import { type PresentationLens } from "../features/presentation/selectors";
import { derivePresentationStory } from "../features/presentation/presentationStory";
import { BriefingPanel } from "../components/Presentation/BriefingPanel";
import { SupportDrawer } from "../components/Presentation/SupportDrawer";
import { ExploreControls } from "../components/Presentation/ExploreControls";
import { LearningGuide } from "../components/LearningGuide/LearningGuide";
import { selectInvestigationGuidance } from "../features/guidance/selectors";
import {
  getDismissedLearningTips,
  getLearningGuideEnabled,
  setLearningGuideEnabled as persistLearningGuideEnabled,
} from "../features/guidance/preferences";
import type { GuideActionId } from "../content/investigationGuide";
import { assertNever } from "../utils/assertNever";
import { LearnMapDialog } from "../components/LearningGuide/LearnMapDialog";
import { InvestigationCheck } from "../components/InvestigationCheck/InvestigationCheck";

export const App = (): JSX.Element => {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSection, setInspectorSection] = useState<string>();
  const [choosingControl, setChoosingControl] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const previousCanvasDetailRef = useRef<CanvasDetail | null>(null);
  const [investigationCheckOpen, setInvestigationCheckOpen] = useState(false);
  const [presentationShowDetails, setPresentationShowDetails] = useState(false);
  const [presentationExperience, setPresentationExperience] = useState<
    "Guided" | "Explore"
  >("Guided");
  const [briefingPosition, setBriefingPosition] = useState({
    chapter: 0,
    step: 0,
  });
  const [supportOpen, setSupportOpen] = useState(false);
  const [chronologyOpen, setChronologyOpen] = useState(false);
  const [chronologyMobile, setChronologyMobile] = useState(false);
  const [showTimelineEvents, setShowTimelineEvents] = useState(false);
  const [presentationLens, setPresentationLens] =
    useState<PresentationLens>("Overview");
  const [learningGuideEnabled, setLearningGuideEnabled] = useState(
    getLearningGuideEnabled,
  );
  const [, setGuideRevision] = useState(0);
  const [helpTopic, setHelpTopic] = useState<
    "map" | "basics" | "shortcuts" | "about" | null
  >(null);
  const deleteSelection = useAppStore((state) => state.actions.deleteSelection);
  const undo = useAppStore((state) => state.actions.undo);
  const redo = useAppStore((state) => state.actions.redo);
  const organizeNodes = useAppStore((state) => state.actions.organizeNodes);
  const setCanvasDetail = useAppStore((state) => state.actions.setCanvasDetail);
  const selectionId = useAppStore((state) => state.selectionId);
  const editorFocusRequest = useAppStore((state) => state.editorFocusRequest);
  const canAddBelow = useAppStore((state) =>
    canAddBelowSelection(state.selectionId, state.nodes),
  );
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const canvasDetail = useAppStore((state) => state.canvasDetail);
  const select = useAppStore((state) => state.actions.select);
  const nodes = useAppStore((state) => state.nodes);
  const barriers = useAppStore((state) => state.barriers);
  const evidence = useAppStore((state) => state.evidence);
  const edges = useAppStore((state) => state.edges);
  const attachments = useAppStore((state) => state.attachments);
  const mapSession = useAppStore((state) => state.mapSession);
  const contextEditing = useAppStore((state) => state.contextEditing);
  const eligibleControlRelationships = useMemo(
    () =>
      selectEligibleControlRelationships(selectionId, nodes, edges, barriers),
    [barriers, edges, nodes, selectionId],
  );
  const presentationStory = useMemo(
    () =>
      derivePresentationStory({
        nodes,
        edges,
        controls: barriers,
        evidence,
        attachments,
      }),
    [attachments, barriers, edges, evidence, nodes],
  );
  const briefingChapter = presentationStory.chapters[briefingPosition.chapter];
  const briefingStep = briefingChapter.steps[briefingPosition.step];
  const advanceBriefing = useCallback(
    (delta: -1 | 1) =>
      setBriefingPosition((current) => {
        const chapter = presentationStory.chapters[current.chapter];
        if (delta === 1 && current.step < chapter.steps.length - 1)
          return { ...current, step: current.step + 1 };
        if (delta === -1 && current.step > 0)
          return { ...current, step: current.step - 1 };
        const nextChapter = Math.max(
          0,
          Math.min(
            presentationStory.chapters.length - 1,
            current.chapter + delta,
          ),
        );
        return {
          chapter: nextChapter,
          step:
            delta === -1
              ? presentationStory.chapters[nextChapter].steps.length - 1
              : 0,
        };
      }),
    [presentationStory],
  );
  const guidance = useMemo(
    () =>
      selectInvestigationGuidance({
        selectedEntity: selectionId,
        nodes: nodes.map((node) => ({ id: node.id, ...node.data })),
        edges,
        controls: barriers,
        evidence,
        presentation: presenting,
        chronology: chronologyOpen,
        activeLens: presentationLens,
        mapSession,
        contextEditing,
        eligibleControlRelationshipCount: eligibleControlRelationships.length,
      }),
    [
      barriers,
      chronologyOpen,
      edges,
      evidence,
      nodes,
      mapSession,
      contextEditing,
      eligibleControlRelationships.length,
      presentationLens,
      presenting,
      selectionId,
    ],
  );
  const guideMatch =
    guidance.matches.find(
      ({ entry }) => !getDismissedLearningTips().has(entry.id),
    ) ?? null;

  const runGuideAction = (action: GuideActionId) => {
    const state = useAppStore.getState();
    const selectedId = state.selectionId;
    const openEditor = (
      section: Parameters<typeof state.actions.requestEditorSection>[1],
      intent: "Open" | "Create" = "Open",
    ) => {
      if (!selectedId) return;
      setInspectorSection(
        section === "ContextAggravating"
          ? "Aggravating Context"
          : section === "ContextMitigating"
            ? "Mitigating Context"
            : section === "Control"
              ? "Controls"
              : section === "Action"
                ? "Actions"
                : section,
      );
      setInspectorOpen(true);
      state.actions.requestEditorSection(selectedId, section, intent);
    };

    switch (action) {
      case "add-impact":
        setInspectorOpen(true);
        state.actions.addSemanticNode("Impact", selectedId ?? undefined);
        return;
      case "add-event":
        setInspectorOpen(true);
        state.actions.addSemanticNode("Event", selectedId ?? undefined);
        return;
      case "add-factor":
        setInspectorOpen(true);
        state.actions.addSemanticNode("Factor", selectedId ?? undefined);
        return;
      case "add-control":
        if (eligibleControlRelationships.length === 1) {
          const relationship = eligibleControlRelationships[0];
          state.actions.addBarrier(
            relationship.upstreamNodeId,
            relationship.downstreamNodeId,
          );
          setInspectorSection("Controls");
          setInspectorOpen(true);
        } else if (eligibleControlRelationships.length > 1) {
          setChoosingControl(true);
        }
        return;
      case "add-context":
        openEditor("Context", "Create");
        return;
      case "add-aggravating-context":
        openEditor("ContextAggravating", "Create");
        return;
      case "add-mitigating-context":
        openEditor("ContextMitigating", "Create");
        return;
      case "add-evidence":
        openEditor("Evidence", "Create");
        return;
      case "link-existing-evidence":
        openEditor("Evidence", "Open");
        return;
      case "add-action":
        openEditor("Action", "Create");
        return;
      case "open-chronology":
        setChronologyOpen(true);
        return;
      case "review-assertion":
        if (selectedId) {
          setInspectorSection("More details");
          setInspectorOpen(true);
        }
        return;
      case "open-presentation":
        setPresenting(true);
        return;
      case "review-checklist":
        setInvestigationCheckOpen(true);
        return;
      default:
        return assertNever(action);
    }
  };
  const exitPresentation = useCallback(() => {
    select(null);
    setChronologyOpen(false);
    setSupportOpen(false);
    setPresenting(false);
    if (previousCanvasDetailRef.current !== null) {
      setCanvasDetail(previousCanvasDetailRef.current);
      previousCanvasDetailRef.current = null;
    }
  }, [select, setCanvasDetail]);

  useEffect(() => {
    // Description/control-purpose focus is an explicit request for Inspector
    // detail. The fresh-map title request remains an inline canvas edit.
    if (editorFocusRequest && editorFocusRequest.section !== "Title") {
      setInspectorOpen(true);
    }
  }, [editorFocusRequest]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setChronologyMobile(window.innerWidth <= 767);
      return;
    }
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setChronologyMobile(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  const canOrganize = useAppStore(
    (state) =>
      state.nodes.length >= 2 &&
      applyHierarchyLayout(state.nodes, state.edges, {
        canvasDetail: state.canvasDetail,
        barrierEdges: state.barriers.filter((barrier) =>
          state.edges.some(
            (edge) =>
              edge.data?.kind !== "ActionEdge" &&
              edge.source === barrier.upstreamNodeId &&
              edge.target === barrier.downstreamNodeId,
          ),
        ),
      }).changed,
  );

  useEffect(() => {
    if (!presenting) return;
    const exitOnEscape = (event: KeyboardEvent) => {
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (
        presentationExperience === "Guided" &&
        !editable &&
        ["ArrowLeft", "ArrowRight", " "].includes(event.key)
      ) {
        event.preventDefault();
        advanceBriefing(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key !== "Escape") {
        // Presentation is a review surface: suppress every editing shortcut.
        if (
          (event.metaKey || event.ctrlKey) &&
          ["z", "y"].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.defaultPrevented) return;
      if (supportOpen) {
        event.preventDefault();
        setSupportOpen(false);
        return;
      }
      if (chronologyOpen) {
        event.preventDefault();
        setChronologyOpen(false);
        return;
      }
      if (editable) return;
      event.preventDefault();
      exitPresentation();
    };
    window.addEventListener("keydown", exitOnEscape, true);
    return () => window.removeEventListener("keydown", exitOnEscape, true);
  }, [
    chronologyOpen,
    exitPresentation,
    advanceBriefing,
    presentationExperience,
    presenting,
    supportOpen,
  ]);

  useEffect(() => {
    if (!presenting || presentationExperience !== "Guided") return;
    select(briefingStep.primaryEntityId ?? null);
    const occurrence = briefingChapter.id === "Occurrence";
    setChronologyOpen(occurrence);
    setShowTimelineEvents(occurrence);
    setPresentationLens(occurrence ? "Chronology" : "Overview");
  }, [
    briefingChapter.id,
    briefingStep.primaryEntityId,
    presentationExperience,
    presenting,
    select,
  ]);

  return (
    <ReactFlowProvider>
      <FileMenu>
        {(menu) => (
          <div className="flex h-screen h-dvh max-w-full flex-col overflow-hidden">
            {!presenting ? (
              <Toolbar
                {...menu}
                onAddSemanticNode={(nodeType) => {
                  const state = useAppStore.getState();
                  if (!canAddBelowSelection(state.selectionId, state.nodes))
                    return;
                  state.actions.addSemanticNode(
                    nodeType,
                    state.selectionId ?? undefined,
                  );
                }}
                selectedNodeType={
                  canAddBelow
                    ? nodes.find((node) => node.id === selectionId)?.data
                        .nodeType
                    : undefined
                }
                onDeleteSelection={() => {
                  deleteSelection();
                }}
                canDelete={Boolean(selectionId)}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                onOrganize={organizeNodes}
                canOrganize={canOrganize}
                onCanvasDetailChange={setCanvasDetail}
                canvasDetail={canvasDetail}
                onPresent={() => {
                  useAppStore.getState().actions.finishEditing();
                  useAppStore.getState().actions.select(null);
                  previousCanvasDetailRef.current = canvasDetail;
                  setCanvasDetail("Compact");
                  setPresentationShowDetails(false);
                  setPresentationExperience("Guided");
                  setBriefingPosition({ chapter: 0, step: 0 });
                  setSupportOpen(false);
                  setChronologyOpen(false);
                  setPresentationLens("Overview");
                  setPresenting(true);
                }}
                onInvestigationCheck={() => setInvestigationCheckOpen(true)}
                learningGuideEnabled={learningGuideEnabled}
                onLearningGuideChange={(enabled) => {
                  setLearningGuideEnabled(enabled);
                  persistLearningGuideEnabled(enabled);
                }}
                onHelpTopic={setHelpTopic}
              />
            ) : null}
            <IncidentHeader readOnly={presenting} />
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1 bg-slate-100">
                <Canvas
                  presenting={presenting}
                  presentationShowDetails={presentationShowDetails}
                  onPresentationInteract={() => undefined}
                  onInspect={() => setInspectorOpen(true)}
                  showTimelineEvents={showTimelineEvents}
                  presentationLens={presentationLens}
                  evidence={evidence}
                  storyFocusIds={
                    presenting && presentationExperience === "Guided"
                      ? briefingStep.focusIds
                      : undefined
                  }
                  presentationActiveId={
                    presenting && presentationExperience === "Guided"
                      ? briefingStep.primaryEntityId
                      : selectionId
                  }
                />
                {!presenting ? (
                  <LearningGuide
                    match={guideMatch}
                    enabled={learningGuideEnabled}
                    mapSession={mapSession}
                    onAction={runGuideAction}
                    onDismissed={() => setGuideRevision((value) => value + 1)}
                  />
                ) : null}
                {choosingControl ? (
                  <div
                    className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Choose Control relationship"
                  >
                    <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
                      <ControlBranchChooser
                        relationships={eligibleControlRelationships}
                        onChoose={(relationship) => {
                          useAppStore
                            .getState()
                            .actions.addBarrier(
                              relationship.upstreamNodeId,
                              relationship.downstreamNodeId,
                            );
                          setChoosingControl(false);
                          setInspectorSection("Controls");
                          setInspectorOpen(true);
                        }}
                      />
                      <button
                        type="button"
                        className="mt-3 text-sm text-slate-600"
                        onClick={() => setChoosingControl(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              {inspectorOpen && !presenting ? (
                <Inspector
                  requestedSection={inspectorSection}
                  onClose={() => setInspectorOpen(false)}
                />
              ) : null}
            </div>
            {presenting ? (
              <>
                {presentationExperience === "Guided" ? (
                  <>
                    {briefingChapter.id === "Occurrence" ? (
                      <Chronology
                        nodes={nodes}
                        selectedId={selectionId}
                        mobile={chronologyMobile}
                        onClose={() => {}}
                        onSelect={(id) => select(id)}
                      />
                    ) : null}
                    <BriefingPanel
                      chapter={briefingChapter}
                      step={briefingStep}
                      chapterIndex={briefingPosition.chapter}
                      stepIndex={briefingPosition.step}
                      chapterCount={presentationStory.chapters.length}
                      onPrevious={() => advanceBriefing(-1)}
                      onNext={() => advanceBriefing(1)}
                      onExplore={() => {
                        setPresentationExperience("Explore");
                        setChronologyOpen(false);
                      }}
                      onExit={exitPresentation}
                      onSupport={() => setSupportOpen(true)}
                    />
                    {supportOpen ? (
                      <SupportDrawer
                        evidence={evidence.filter((item) =>
                          briefingStep.evidenceIds?.includes(item.id),
                        )}
                        assertionState={
                          briefingStep.node?.data.assertionState ??
                          briefingStep.control?.assertionState
                        }
                        onClose={() => setSupportOpen(false)}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <ExploreControls
                      lens={presentationLens}
                      onLens={setPresentationLens}
                      onReturn={() => setPresentationExperience("Guided")}
                      onExit={exitPresentation}
                      showDetails={presentationShowDetails}
                      showTimeline={showTimelineEvents}
                      onDetails={() =>
                        setPresentationShowDetails((value) => !value)
                      }
                      onTimeline={() =>
                        setShowTimelineEvents((value) => !value)
                      }
                    />
                    {presentationLens === "Chronology" ? (
                      <Chronology
                        nodes={nodes}
                        selectedId={selectionId}
                        mobile={chronologyMobile}
                        onClose={() => setPresentationLens("Overview")}
                        onSelect={select}
                      />
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <Footer />
            )}
            {helpTopic === "map" ? (
              <LearnMapDialog onClose={() => setHelpTopic(null)} />
            ) : helpTopic ? (
              <div className="help-dialog-backdrop" role="presentation">
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="help-dialog-title"
                  className="help-dialog"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setHelpTopic(null);
                  }}
                >
                  <h2 id="help-dialog-title">
                    {helpTopic === "basics"
                      ? "Investigation Basics"
                      : helpTopic === "shortcuts"
                        ? "Keyboard Shortcuts"
                        : "About IncidentMapping"}
                  </h2>
                  <p>
                    {helpTopic === "basics"
                      ? "Build the story, analyze causes, test findings with evidence, then plan actions."
                      : helpTopic === "shortcuts"
                        ? "Enter adds below. Delete removes a selection. F fits the map. Escape closes overlays."
                        : "IncidentMapping helps teams build evidence-aware incident investigations."}
                  </p>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setHelpTopic(null)}
                  >
                    Close
                  </button>
                </section>
              </div>
            ) : null}
            {investigationCheckOpen ? (
              <InvestigationCheck
                stage={guidance.stage}
                items={guidance.checklist}
                onClose={() => setInvestigationCheckOpen(false)}
              />
            ) : null}
          </div>
        )}
      </FileMenu>
    </ReactFlowProvider>
  );
};
