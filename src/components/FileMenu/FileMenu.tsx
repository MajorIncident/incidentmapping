import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode, ChangeEvent } from "react";
import { mapDataSchema } from "../../features/maps/schema";
import { parseAndMigrateMapData } from "../../features/maps/migration";
import { attachmentRuntimeStore } from "../../features/persistence/attachmentRuntimeStore";
import {
  canonicalMapJson,
  createIncidentPackage,
  openIncidentPackage,
} from "../../features/persistence/package";
import {
  openFileWithPicker,
  saveFileWithPicker,
  supportsFileSystemAccess,
} from "../../features/persistence/localfs";
import {
  readFile,
  triggerDownload,
  triggerJsonDownload,
} from "../../features/persistence/download";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useAppStore } from "../../state/useAppStore";

export type FileMenuRenderProps = {
  onNew: () => void;
  onOpen: () => Promise<void>;
  onSave: () => Promise<void>;
  onExportJson: () => void;
  onExportPng: () => void;
  isSaved: boolean;
};

type FileMenuProps = {
  children: (props: FileMenuRenderProps) => ReactNode;
};

export const FileMenu = ({ children }: FileMenuProps): JSX.Element => {
  const { newMap, loadMap, toMap } = useAppStore((state) => state.actions);
  const attachmentRevision = useSyncExternalStore(
    attachmentRuntimeStore.subscribe,
    () => attachmentRuntimeStore.revision,
    () => 0,
  );
  const currentSignature = useAppStore((state) => {
    // Derive dirty state from exactly the same canonical persisted projection as save.
    void state.nodes;
    return `${JSON.stringify(state.actions.toMap())}:${attachmentRevision}`;
  });
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingResolver = useRef<
    ((value: { bytes: ArrayBuffer; name: string } | null) => void) | null
  >(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const resetHandle = useCallback(() => {
    fileHandleRef.current = null;
  }, []);

  const commitLoad = useCallback(
    async (bytes: ArrayBuffer, filename: string) => {
      try {
        const isJson = filename.toLowerCase().endsWith(".json");
        const result = isJson
          ? {
              map: parseAndMigrateMapData(
                JSON.parse(new TextDecoder().decode(bytes)),
              ),
              warnings: [],
            }
          : await openIncidentPackage(bytes);
        const parsed = result.map;
        if (isJson) attachmentRuntimeStore.clear();
        loadMap(parsed);
        setWarnings(result.warnings.map((warning) => warning.message));
        setSavedSignature(
          JSON.stringify(useAppStore.getState().actions.toMap()),
        );
      } catch (error) {
        setWarnings([`Unable to open map. ${(error as Error).message}`]);
      }
    },
    [loadMap],
  );

  const handleInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      try {
        const contents = file ? await readFile(file) : null;
        pendingResolver.current?.(
          file && contents ? { bytes: contents, name: file.name } : null,
        );
      } finally {
        pendingResolver.current = null;
        // Reset the input so the same file can be selected again.
        event.target.value = "";
      }
    },
    [],
  );

  const requestFileThroughInput = useCallback((): Promise<{
    bytes: ArrayBuffer;
    name: string;
  } | null> => {
    return new Promise((resolve) => {
      pendingResolver.current = resolve;
      inputRef.current?.click();
    });
  }, []);

  const handleNew = useCallback(() => {
    attachmentRuntimeStore.clear();
    newMap();
    resetHandle();
    setSavedSignature(null);
  }, [newMap, resetHandle]);

  const handleOpen = useCallback(async () => {
    if (supportsFileSystemAccess()) {
      const result = await openFileWithPicker();
      if (!result) {
        return;
      }
      fileHandleRef.current = result.handle;
      await commitLoad(result.contents, result.handle.name);
      return;
    }

    const selected = await requestFileThroughInput();
    if (selected) {
      await commitLoad(selected.bytes, selected.name);
    }
  }, [commitLoad, requestFileThroughInput]);

  const handleSave = useCallback(async () => {
    const map = toMap();
    try {
      const validated = mapDataSchema.parse(map);
      const packaged = await createIncidentPackage(validated);
      if (supportsFileSystemAccess()) {
        const existing = fileHandleRef.current;
        const updatedHandle = await saveFileWithPicker(packaged, {
          handle: existing?.name.toLowerCase().endsWith(".incidentmap")
            ? existing
            : undefined,
          suggestedName: `${validated.metadata?.title ?? "incident-map"}.incidentmap`,
        });
        if (updatedHandle) {
          fileHandleRef.current = updatedHandle;
          setSavedSignature(currentSignature);
          return;
        }
      }

      const filename = `${validated.metadata?.title ?? "incident-map"}.incidentmap`;
      triggerDownload(filename, packaged);
      setSavedSignature(currentSignature);
    } catch (error) {
      window.alert(`Unable to save map.\n${(error as Error).message}`);
    }
  }, [currentSignature, toMap]);

  const handleExportJson = useCallback(() => {
    const map = mapDataSchema.parse(toMap());
    if (map.attachments.length)
      setWarnings([
        "JSON export includes attachment metadata only; binary files are not included.",
      ]);
    triggerJsonDownload(
      `${map.metadata?.title ?? "incident-map"}.json`,
      canonicalMapJson(map),
    );
  }, [toMap]);

  const handleExportPng = useCallback(() => {
    window.alert("PNG export will arrive in a future milestone.");
  }, []);

  const menuHandlers = useMemo<FileMenuRenderProps>(
    () => ({
      onNew: handleNew,
      onOpen: handleOpen,
      onSave: handleSave,
      onExportJson: handleExportJson,
      onExportPng: handleExportPng,
      isSaved: savedSignature !== null && savedSignature === currentSignature,
    }),
    [
      currentSignature,
      handleExportPng,
      handleNew,
      handleOpen,
      handleSave,
      handleExportJson,
      savedSignature,
    ],
  );

  useKeyboardShortcuts({
    onOpen: () => {
      void handleOpen();
    },
    onSave: () => {
      void handleSave();
    },
  });

  return (
    <>
      {children(menuHandlers)}
      <input
        ref={inputRef}
        type="file"
        accept=".incidentmap,.json,application/json,application/vnd.incidentmap+zip"
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
      />
      {warnings.length ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="package-warning-title"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4"
        >
          <section className="max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 id="package-warning-title" className="font-semibold">
              Package warnings
            </h2>
            <ul className="my-3 list-disc pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <button
              type="button"
              className="command-button rounded-lg border px-4 py-2"
              onClick={() => setWarnings([])}
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
};
