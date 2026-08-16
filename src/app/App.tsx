import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { Footer } from "../components/Footer/Footer";
import { IncidentHeader } from "../components/IncidentHeader/IncidentHeader";
import { useAppStore } from "../state/useAppStore";
import { applyHierarchyLayout } from "../features/layout/hierarchy";
import { useCallback, useEffect, useState } from "react";
import { Legend } from "../components/Presentation/Legend";
import { Chronology } from "../components/Presentation/Chronology";
import { canAddBelowSelection } from "../state/selectors";
import { CaseSummary } from "../components/Presentation/CaseSummary";

export const App = (): JSX.Element => {
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [presentationShowDetails, setPresentationShowDetails] = useState(false);
  const [presentationHintOpen, setPresentationHintOpen] = useState(false);
  const [chronologyOpen, setChronologyOpen] = useState(false);
  const [chronologyMobile, setChronologyMobile] = useState(false);
  const [showTimelineEvents, setShowTimelineEvents] = useState(false);
  const [timelineAnnouncement, setTimelineAnnouncement] = useState("");
  const deleteSelection = useAppStore((state) => state.actions.deleteSelection);
  const undo = useAppStore((state) => state.actions.undo);
  const redo = useAppStore((state) => state.actions.redo);
  const organizeNodes = useAppStore((state) => state.actions.organizeNodes);
  const toggleShowDetails = useAppStore(
    (state) => state.actions.toggleShowDetails,
  );
  const selectionId = useAppStore((state) => state.selectionId);
  const canAddBelow = useAppStore((state) =>
    canAddBelowSelection(state.selectionId, state.nodes),
  );
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const showDetails = useAppStore((state) => state.showDetails);
  const select = useAppStore((state) => state.actions.select);
  const exitPresentation = useCallback(() => {
    select(null);
    setPresentationHintOpen(false);
    setChronologyOpen(false);
    setPresenting(false);
  }, [select]);

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
    if (selectionId) setInspectorOpen(true);
  }, [selectionId]);

  useEffect(() => {
    if (!presenting) return;
    const exitOnEscape = (event: KeyboardEvent) => {
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
      if (chronologyOpen) {
        event.preventDefault();
        setChronologyOpen(false);
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      event.preventDefault();
      exitPresentation();
    };
    window.addEventListener("keydown", exitOnEscape, true);
    return () => window.removeEventListener("keydown", exitOnEscape, true);
  }, [chronologyOpen, exitPresentation, presenting]);

  return (
    <ReactFlowProvider>
      <FileMenu>
        {(menu) => (
          <div className="flex h-screen h-dvh max-w-full flex-col overflow-hidden">
            {!presenting ? (
              <Toolbar
                {...menu}
                onAddChainNode={() => {
                  const state = useAppStore.getState();
                  if (!canAddBelowSelection(state.selectionId, state.nodes))
                    return;
                  state.actions.addChild(state.selectionId ?? undefined);
                }}
                canAddBelow={canAddBelow}
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
                  useAppStore.getState().actions.select(null);
                  setPresentationShowDetails(false);
                  setPresentationHintOpen(true);
                  setChronologyOpen(false);
                  setPresenting(true);
                }}
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
                />
              </div>
              {inspectorOpen && !presenting ? (
                <Inspector onClose={() => setInspectorOpen(false)} />
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
                <Legend />
                <CaseSummary
                  factors={useAppStore
                    .getState()
                    .nodes.map((node) => node.data)}
                  controls={useAppStore.getState().barriers}
                />
                {chronologyOpen ? (
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
              </>
            ) : (
              <Footer />
            )}
          </div>
        )}
      </FileMenu>
    </ReactFlowProvider>
  );
};
