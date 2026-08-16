const MIME_JSON = "application/json";

export const triggerDownload = (
  filename: string,
  contents: BlobPart,
  mimeType = MIME_JSON,
): void => {
  const blob =
    contents instanceof Blob
      ? contents
      : new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const triggerJsonDownload = (filename: string, contents: string): void =>
  triggerDownload(filename, contents);

export const readFile = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
