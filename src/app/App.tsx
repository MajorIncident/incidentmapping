import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { Footer } from "../components/Footer/Footer";
import { IncidentHeader } from "../components/IncidentHeader/IncidentHeader";
import { useAppStore } from "../state/useAppStore";
import { applyHierarchyLayout } from "../features/layout/hierarchy";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Legend } from "../components/Presentation/Legend";
import { Chronology } from "../components/Presentation/Chronology";
import { canAddBelowSelection } from "../state/selectors";
import { CaseSummary } from "../components/Presentation/CaseSummary";
import { LensPicker } from "../components/Presentation/LensPicker";
import { type PresentationLens } from "../features/presentation/selectors";
import { selectCaseSummary } from "../features/presentation/caseSummary";
import { deriveStorySequence } from "../features/presentation/story";
import { StoryPanel } from "../components/Presentation/StoryPanel";
import { LearningGuide } from "../components/LearningGuide/LearningGuide";
import { selectInvestigationGuidance } from "../features/guidance/selectors";
import {
  getDismissedLearningTips,
  getLearningGuideEnabled,
  setLearningGuideEnabled as persistLearningGuideEnabled,
} from "../features/guidance/preferences";
import type { GuideActionId } from "../content/investigationGuide";
import { LearnMapDialog } from "../components/LearningGuide/LearnMapDialog";
import { InvestigationCheck } from "../components/InvestigationCheck/InvestigationCheck";

export const App = (): JSX.Element => {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSection, setInspectorSection] = useState<string>();
  const [presenting, setPresenting] = useState(false);
  const [investigationCheckOpen, setInvestigationCheckOpen] = useState(false);
  const [presentationShowDetails, setPresentationShowDetails] = useState(false);
  const [presentationHintOpen, setPresentationHintOpen] = useState(false);
  const [chronologyOpen, setChronologyOpen] = useState(false);
  const [chronologyMobile, setChronologyMobile] = useState(false);
  const [showTimelineEvents, setShowTimelineEvents] = useState(false);
  const [presentationLens, setPresentationLens] =
    useState<PresentationLens>("Overview");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [timelineAnnouncement, setTimelineAnnouncement] = useState("");
  const [learningGuideEnabled, setLearningGuideEnabled] = useState(
    getLearningGuideEnabled,
  );
  const [, setGuideRevision] = useState(0);
  const [helpTopic, setHelpTopic] = useState<
    "map" | "basics" | "shortcuts" | "about" | null
  >(null);
  const [story, setStory] = useState<{
    startId: string | null;
    index: number;
  } | null>(null);
  const deleteSelection = useAppStore((state) => state.actions.deleteSelection);
  const undo = useAppStore((state) => state.actions.undo);
  const redo = useAppStore((state) => state.actions.redo);
  const organizeNodes = useAppStore((state) => state.actions.organizeNodes);
  const toggleShowDetails = useAppStore(
    (state) => state.actions.toggleShowDetails,
  );
  const selectionId = useAppStore((state) => state.selectionId);
  const editorFocusRequest = useAppStore((state) => state.editorFocusRequest);
  const canAddBelow = useAppStore((state) =>
    canAddBelowSelection(state.selectionId, state.nodes),
  );
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const showDetails = useAppStore((state) => state.showDetails);
  const select = useAppStore((state) => state.actions.select);
  const nodes = useAppStore((state) => state.nodes);
  const barriers = useAppStore((state) => state.barriers);
  const evidence = useAppStore((state) => state.evidence);
  const edges = useAppStore((state) => state.edges);
  const attachments = useAppStore((state) => state.attachments);
  const mapSession = useAppStore((state) => state.mapSession);
  const contextItems = useAppStore(
    (state) => state.metadata?.contextItems ?? [],
  );
  const summary = selectCaseSummary(nodes, barriers, evidence, contextItems);
  const storySequence = useMemo(
    () =>
      deriveStorySequence(
        { nodes, edges, controls: barriers, evidence, attachments },
        story?.startId,
      ),
    [attachments, barriers, edges, evidence, nodes, story?.startId],
  );
  const storyStep = story ? storySequence.steps[story.index] : undefined;
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
      }),
    [
      barriers,
      chronologyOpen,
      edges,
      evidence,
      nodes,
      mapSession,
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
    if (action === "open-chronology") {
      setChronologyOpen(true);
      return;
    }
    if (action === "open-presentation") {
      setPresenting(true);
      return;
    }
    if (action === "review-assertion") {
      if (state.selectionId) {
        setInspectorSection("More details");
        setInspectorOpen(true);
      }
      return;
    }
    if (action === "add-action") {
      setInspectorSection("Actions");
      setInspectorOpen(true);
      state.actions.addAction(state.selectionId ?? undefined);
      return;
    }
    if (
      action === "add-aggravating-context" ||
      action === "add-mitigating-context"
    ) {
      setInspectorSection(
        action === "add-aggravating-context"
          ? "Aggravating Context"
          : "Mitigating Context",
      );
      setInspectorOpen(true);
      return;
    }
    if (action === "add-control") {
      setInspectorSection("Controls");
      setInspectorOpen(true);
      return;
    }
    if (action === "link-existing-evidence") {
      setInspectorSection("Evidence");
      setInspectorOpen(true);
      return;
    }
    const types = {
      "add-impact": "Impact",
      "add-event": "Event",
      "add-factor": "Factor",
    } as const;
    if (action in types) {
      setInspectorOpen(true);
      state.actions.addSemanticNode(
        types[action as keyof typeof types],
        state.selectionId ?? undefined,
      );
      return;
    }
    if (action === "add-evidence" && state.selectionId) {
      setInspectorSection("Evidence");
      setInspectorOpen(true);
      state.actions.addEvidence(state.selectionId, "New evidence");
    }
  };
  const exitStory = useCallback(() => setStory(null), []);
  const exitPresentation = useCallback(() => {
    select(null);
    setPresentationHintOpen(false);
    setChronologyOpen(false);
    setStory(null);
    setPresenting(false);
  }, [select]);

  useEffect(() => {
    // Description/control-purpose focus is an explicit request for Inspector
    // detail. The fresh-map title request remains an inline canvas edit.
    if (editorFocusRequest && editorFocusRequest.field !== "title") {
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
        showDetails: state.showDetails,
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
        story &&
        !editable &&
        ["ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        setStory(
          (value) =>
            value && {
              ...value,
              index:
                event.key === "ArrowLeft"
                  ? Math.max(0, value.index - 1)
                  : Math.min(storySequence.steps.length - 1, value.index + 1),
            },
        );
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
      if (story) {
        event.preventDefault();
        exitStory();
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
    exitStory,
    presenting,
    story,
    storySequence.steps.length,
  ]);

  useEffect(() => {
    if (!story) return;
    if (!storySequence.steps.length) {
      setStory(null);
      return;
    }
    if (story.index >= storySequence.steps.length) {
      setStory(
        (value) => value && { ...value, index: storySequence.steps.length - 1 },
      );
      return;
    }
    select(storySequence.steps[story.index].entityId);
  }, [select, story, storySequence.steps]);

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
                onToggleDetails={toggleShowDetails}
                showDetails={showDetails}
                onPresent={() => {
                  useAppStore.getState().actions.finishEditing();
                  if (guidance.stage === "Reviewing the Investigation") {
                    setInvestigationCheckOpen(true);
                    return;
                  }
                  useAppStore.getState().actions.select(null);
                  setPresentationShowDetails(false);
                  setPresentationHintOpen(true);
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
                  onPresentationInteract={() => setPresentationHintOpen(false)}
                  onInspect={() => setInspectorOpen(true)}
                  showTimelineEvents={showTimelineEvents}
                  presentationLens={presentationLens}
                  evidence={evidence}
                  storyFocusIds={storyStep?.focusIds}
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
                {presentationHintOpen ? (
                  <aside
                    className="presentation-hint"
                    aria-label="Presentation help"
                  >
                    <h2>Review the investigation</h2>
                    <p>
                      Select a node, control or action to highlight its
                      relationship to the incident.
                    </p>
                    <p>Click empty space to show the full map.</p>
                    <button
                      type="button"
                      aria-label="Dismiss presentation help"
                      onClick={() => setPresentationHintOpen(false)}
                    >
                      ×
                    </button>
                  </aside>
                ) : null}
                <Legend onLearnMap={() => setHelpTopic("map")} />
                {summaryOpen ? (
                  <CaseSummary
                    summary={summary}
                    mobile={chronologyMobile}
                    onClose={
                      chronologyMobile ? () => setSummaryOpen(false) : undefined
                    }
                    onSelect={(id) => {
                      select(id);
                      setPresentationHintOpen(false);
                    }}
                  />
                ) : null}
                {chronologyOpen || presentationLens === "Chronology" ? (
                  <Chronology
                    nodes={useAppStore.getState().nodes}
                    selectedId={selectionId}
                    mobile={chronologyMobile}
                    onClose={() => setChronologyOpen(false)}
                    onSelect={(id) => {
                      const timelineOnly =
                        useAppStore
                          .getState()
                          .nodes.find((node) => node.id === id)?.data
                          .eventDisplay === "ChronologyOnly";
                      if (timelineOnly && !showTimelineEvents) {
                        setShowTimelineEvents(true);
                        setTimelineAnnouncement(
                          "Timeline Event revealed and focused in the auxiliary lane.",
                        );
                      } else
                        setTimelineAnnouncement("Event focused on the map.");
                      select(id);
                      setPresentationHintOpen(false);
                      if (chronologyMobile) setChronologyOpen(false);
                    }}
                  />
                ) : null}
                <div className="presentation-actions">
                  <LensPicker
                    value={presentationLens}
                    onChange={(lens) => {
                      setPresentationLens(lens);
                      setTimelineAnnouncement(`${lens} view selected.`);
                      setPresentationHintOpen(false);
                    }}
                  />
                  {!story ? (
                    <button
                      type="button"
                      onClick={() => {
                        const selected = nodes.find(
                          (node) => node.id === selectionId,
                        );
                        const startId =
                          selected?.data.nodeType === "Factor" &&
                          ["KeyFactor", "RootCause"].includes(
                            selected.data.factorSignificance ?? "",
                          )
                            ? selected.id
                            : null;
                        const sequence = deriveStorySequence(
                          {
                            nodes,
                            edges,
                            controls: barriers,
                            evidence,
                            attachments,
                          },
                          startId,
                        );
                        if (sequence.steps.length)
                          setStory({ startId, index: 0 });
                      }}
                      disabled={storySequence.steps.length === 0}
                    >
                      Start Story From Selection
                    </button>
                  ) : null}
                  {!summaryOpen ? (
                    <button type="button" onClick={() => setSummaryOpen(true)}>
                      Case Summary
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={chronologyOpen}
                    aria-haspopup={chronologyMobile ? "dialog" : undefined}
                    onClick={() => setChronologyOpen((visible) => !visible)}
                  >
                    Chronology
                  </button>
                  <button
                    type="button"
                    aria-pressed={showTimelineEvents}
                    onClick={() => setShowTimelineEvents((visible) => !visible)}
                  >
                    {showTimelineEvents
                      ? "Hide Timeline Events"
                      : "Show Timeline Events"}
                  </button>
                  <span className="sr-only" aria-live="polite">
                    {timelineAnnouncement}
                  </span>
                  <button
                    type="button"
                    aria-pressed={presentationShowDetails}
                    onClick={() =>
                      setPresentationShowDetails((visible) => !visible)
                    }
                  >
                    {presentationShowDetails ? "Hide Details" : "Show Details"}
                  </button>
                  <button type="button" onClick={exitPresentation}>
                    Exit Presentation <span aria-hidden="true">Esc</span>
                  </button>
                </div>
                {story && storyStep ? (
                  <StoryPanel
                    step={storyStep}
                    index={story.index}
                    count={storySequence.steps.length}
                    onPrevious={() =>
                      setStory(
                        (value) =>
                          value && {
                            ...value,
                            index: Math.max(0, value.index - 1),
                          },
                      )
                    }
                    onNext={() =>
                      setStory(
                        (value) =>
                          value && {
                            ...value,
                            index: Math.min(
                              storySequence.steps.length - 1,
                              value.index + 1,
                            ),
                          },
                      )
                    }
                    onExit={exitStory}
                  />
                ) : null}
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
