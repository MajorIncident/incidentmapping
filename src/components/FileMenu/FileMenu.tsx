import { useCallback, useMemo, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { mapDataSchema } from "../../features/maps/schema";
import {
  openFileWithPicker,
  saveFileWithPicker,
  supportsFileSystemAccess,
} from "../../features/persistence/localfs";
import {
  readFile,
  triggerJsonDownload,
} from "../../features/persistence/download";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useAppStore } from "../../state/useAppStore";

export type FileMenuRenderProps = {
  onNew: () => void;
  onOpen: () => Promise<void>;
  onSave: () => Promise<void>;
  onExportPng: () => void;
};

type FileMenuProps = {
  children: (props: FileMenuRenderProps) => ReactNode;
};

export const FileMenu = ({ children }: FileMenuProps): JSX.Element => {
  const { newMap, loadMap, toMap } = useAppStore((state) => state.actions);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingResolver = useRef<((value: string | null) => void) | null>(null);

  const resetHandle = useCallback(() => {
    fileHandleRef.current = null;
  }, []);

  const commitLoad = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        const result = mapDataSchema.safeParse(parsed);
        if (!result.success) {
          const message = result.error.errors
            .map((issue) => issue.message)
            .join("\n");
          window.alert(`Unable to open map.\n${message}`);
          return;
        }
        loadMap(result.data);
      } catch (error) {
        window.alert(`Unable to open map.\n${(error as Error).message}`);
      }
    },
    [loadMap],
  );

  const handleInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      try {
        const contents = file ? await readFile(file) : null;
        pendingResolver.current?.(contents);
      } finally {
        pendingResolver.current = null;
        // Reset the input so the same file can be selected again.
        event.target.value = "";
      }
    },
    [],
  );

  const requestFileThroughInput = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      pendingResolver.current = resolve;
      inputRef.current?.click();
    });
  }, []);

  const handleNew = useCallback(() => {
    newMap();
    resetHandle();
  }, [newMap, resetHandle]);

  const handleOpen = useCallback(async () => {
    if (supportsFileSystemAccess()) {
      const result = await openFileWithPicker();
      if (!result) {
        return;
      }
      fileHandleRef.current = result.handle;
      commitLoad(result.contents);
      return;
    }

    const contents = await requestFileThroughInput();
    if (contents) {
      commitLoad(contents);
    }
  }, [commitLoad, requestFileThroughInput]);

  const handleSave = useCallback(async () => {
    const map = toMap();
    try {
      const validated = mapDataSchema.parse(map);
      const serialized = JSON.stringify(validated, null, 2);
      if (supportsFileSystemAccess()) {
        const updatedHandle = await saveFileWithPicker(serialized, {
          handle: fileHandleRef.current ?? undefined,
          suggestedName: `${validated.metadata?.title ?? "incident-map"}.json`,
        });
        if (updatedHandle) {
          fileHandleRef.current = updatedHandle;
          return;
        }
      }

      const filename = `${validated.metadata?.title ?? "incident-map"}.json`;
      triggerJsonDownload(filename, serialized);
    } catch (error) {
      window.alert(`Unable to save map.\n${(error as Error).message}`);
    }
  }, [toMap]);

  const handleExportPng = useCallback(() => {
    window.alert("PNG export will arrive in a future milestone.");
  }, []);

  const menuHandlers = useMemo<FileMenuRenderProps>(
    () => ({
      onNew: handleNew,
      onOpen: handleOpen,
      onSave: handleSave,
      onExportPng: handleExportPng,
    }),
    [handleExportPng, handleNew, handleOpen, handleSave],
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
        accept="application/json"
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </>
  );
};
