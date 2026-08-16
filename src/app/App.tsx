import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { Footer } from "../components/Footer/Footer";
import { IncidentHeader } from "../components/IncidentHeader/IncidentHeader";
import { useAppStore } from "../state/useAppStore";
import { applyHierarchyLayout } from "../features/layout/hierarchy";
import { useEffect, useState } from "react";
import { Legend } from "../components/Presentation/Legend";

export const App = (): JSX.Element => {
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const addChild = useAppStore((state) => state.actions.addChild);
  const deleteSelection = useAppStore((state) => state.actions.deleteSelection);
  const undo = useAppStore((state) => state.actions.undo);
  const redo = useAppStore((state) => state.actions.redo);
  const organizeNodes = useAppStore((state) => state.actions.organizeNodes);
  const toggleShowDetails = useAppStore(
    (state) => state.actions.toggleShowDetails,
  );
  const selectionId = useAppStore((state) => state.selectionId);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const showDetails = useAppStore((state) => state.showDetails);
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
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      event.preventDefault();
      setPresenting(false);
    };
    window.addEventListener("keydown", exitOnEscape, true);
    return () => window.removeEventListener("keydown", exitOnEscape, true);
  }, [presenting]);

  return (
    <ReactFlowProvider>
      <FileMenu>
        {(menu) => (
          <div className="flex h-screen h-dvh max-w-full flex-col overflow-hidden">
            {!presenting ? (
              <Toolbar
                {...menu}
                onAddChainNode={() => {
                  addChild(selectionId ?? undefined);
                }}
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
                  setPresenting(true);
                }}
              />
            ) : null}
            <IncidentHeader readOnly={presenting} />
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1 bg-slate-100">
                <Canvas
                  presenting={presenting}
                  onInspect={() => setInspectorOpen(true)}
                />
              </div>
              {inspectorOpen && !presenting ? (
                <Inspector onClose={() => setInspectorOpen(false)} />
              ) : null}
            </div>
            {presenting ? (
              <>
                <Legend />
                <button
                  className="presentation-exit"
                  type="button"
                  onClick={() => setPresenting(false)}
                >
                  Exit Presentation <span aria-hidden="true">Esc</span>
                </button>
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
