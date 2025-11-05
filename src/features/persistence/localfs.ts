const MIME_JSON = "application/json";

export type OpenFileResult = {
  contents: string;
  handle: FileSystemFileHandle;
};

export const supportsFileSystemAccess = (): boolean =>
  typeof window !== "undefined" &&
  "showOpenFilePicker" in window &&
  "showSaveFilePicker" in window;

export const openFileWithPicker = async (): Promise<OpenFileResult | null> => {
  if (!supportsFileSystemAccess()) {
    return null;
  }

  try {
    const openPicker = window.showOpenFilePicker;
    if (!openPicker) {
      return null;
    }

    const [handle] = await openPicker({
      types: [
        {
          description: "Incident Map",
          accept: { [MIME_JSON]: [".json"] },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    });
    const file = await handle.getFile();
    const contents = await file.text();
    return { contents, handle };
  } catch (error) {
    if ((error as DOMException).name === "AbortError") {
      return null;
    }
    throw error;
  }
};

export const saveFileWithPicker = async (
  contents: string,
  options: { handle?: FileSystemFileHandle; suggestedName?: string } = {},
): Promise<FileSystemFileHandle | null> => {
  if (!supportsFileSystemAccess()) {
    return null;
  }

  try {
    const savePicker = window.showSaveFilePicker;
    if (!savePicker && !options.handle) {
      return null;
    }

    const fileHandle =
      options.handle ??
      (await savePicker?.({
        suggestedName: options.suggestedName ?? "incident-map.json",
        types: [
          {
            description: "Incident Map",
            accept: { [MIME_JSON]: [".json"] },
          },
        ],
      }));

    if (!fileHandle) {
      return null;
    }

    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([contents], { type: MIME_JSON }));
    await writable.close();

    return fileHandle;
  } catch (error) {
    if ((error as DOMException).name === "AbortError") {
      return null;
    }
    throw error;
  }
};
