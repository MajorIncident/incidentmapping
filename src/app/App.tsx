import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { useAppStore } from "../state/useAppStore";

export const App = (): JSX.Element => {
  const addChild = useAppStore((state) => state.actions.addChild);
  const deleteSelection = useAppStore((state) => state.actions.deleteSelection);
  const undo = useAppStore((state) => state.actions.undo);
  const redo = useAppStore((state) => state.actions.redo);
  const selectionId = useAppStore((state) => state.selectionId);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);

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
            />
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 bg-slate-100">
                <Canvas />
              </div>
              <Inspector />
            </div>
          </div>
        )}
      </FileMenu>
    </ReactFlowProvider>
  );
};
