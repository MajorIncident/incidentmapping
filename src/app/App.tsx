import { ReactFlowProvider } from "reactflow";
import { FileMenu } from "../components/FileMenu/FileMenu";
import { Toolbar } from "../components/Toolbar/Toolbar";
import { Canvas } from "../components/Canvas/Canvas";
import { Inspector } from "../components/Sidebar/Inspector";
import { useAppStore } from "../state/useAppStore";

export const App = (): JSX.Element => {
  const addChainNode = useAppStore((state) => state.actions.addChainNode);
  const deleteNode = useAppStore((state) => state.actions.deleteNode);
  const selectionId = useAppStore((state) => state.selectionId);

  return (
    <ReactFlowProvider>
      <FileMenu>
        {(menu) => (
          <div className="flex h-screen flex-col">
            <Toolbar
              {...menu}
              onAddChainNode={() => {
                if (selectionId) {
                  addChainNode({ parentId: selectionId });
                } else {
                  addChainNode();
                }
              }}
              onDeleteSelection={() => {
                if (selectionId) {
                  deleteNode(selectionId);
                }
              }}
              canDelete={Boolean(selectionId)}
            />
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 bg-slate-100">
                <Canvas />
              </div>
              <div className="w-72 bg-white">
                <Inspector />
              </div>
            </div>
          </div>
        )}
      </FileMenu>
    </ReactFlowProvider>
  );
};
