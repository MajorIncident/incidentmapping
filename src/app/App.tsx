import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { Footer } from "../components/Footer/Footer";
import { useAppStore } from "../state/useAppStore";
import { applyHierarchyLayout } from "../features/layout/hierarchy";

export const App = (): JSX.Element => {
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
        barrierEdges: state.barriers,
      }).changed,
  );

  return (
    <ReactFlowProvider>
      <FileMenu>
        {(menu) => (
          <div className="flex h-screen flex-col">
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
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 bg-slate-100">
                <Canvas />
              </div>
              <Inspector />
            </div>
            <Footer />
          </div>
        )}
      </FileMenu>
    </ReactFlowProvider>
  );
};
