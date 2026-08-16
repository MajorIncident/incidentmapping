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

export const App = (): JSX.Element => {
  const [inspectorOpen, setInspectorOpen] = useState(true);
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

  return (
    <ReactFlowProvider>
      <FileMenu>
        {(menu) => (
          <div className="flex h-screen h-dvh max-w-full flex-col overflow-hidden">
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
            />
            <IncidentHeader />
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1 bg-slate-100">
                <Canvas onInspect={() => setInspectorOpen(true)} />
              </div>
              {inspectorOpen ? (
                <Inspector onClose={() => setInspectorOpen(false)} />
              ) : null}
            </div>
            <Footer />
          </div>
        )}
      </FileMenu>
    </ReactFlowProvider>
  );
};
