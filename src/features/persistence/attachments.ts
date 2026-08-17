import type { Attachment } from "../maps/schema";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "text/plain",
  "text/csv",
  "application/json",
]);

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
]);

export const sanitizeAttachmentFilename = (filename: string): string => {
  const leaf = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const sanitized = leaf
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);
  if (!sanitized || sanitized === "." || sanitized === "..")
    throw new Error("Attachment filename is invalid");
  return sanitized;
};

export const validateAttachmentFile = (
  file: Pick<File, "name" | "type" | "size">,
  currentTotal: number,
): string => {
  if (!file.name.trim() || /[\0\r\n]/.test(file.name))
    throw new Error("Attachment filename is invalid");
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type))
    throw new Error("Choose a JPEG, PNG, WebP, PDF, MP4, or WebM file");
  if (file.size > MAX_ATTACHMENT_BYTES)
    throw new Error("Attachment exceeds the 25 MB file limit");
  if (currentTotal + file.size > MAX_TOTAL_ATTACHMENT_BYTES)
    throw new Error("Attachments exceed the 100 MB package limit");
  return sanitizeAttachmentFilename(file.name);
};

export const normalizeBundlePath = (path: string): string => {
  if (path.includes("\\") || path.startsWith("/") || path.includes("\0"))
    throw new Error(`Unsafe attachment path: ${path}`);
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".."))
    throw new Error(`Unsafe attachment path: ${path}`);
  const normalized = parts.join("/");
  if (!normalized.startsWith("attachments/") || parts.length < 2)
    throw new Error(`Attachment path must be under attachments/: ${path}`);
  return normalized;
};

export const validateAttachmentManifest = (
  attachments: readonly Attachment[],
): void => {
  const paths = new Set<string>();
  let total = 0;
  for (const attachment of attachments) {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.mimeType))
      throw new Error(
        `Disallowed attachment media type: ${attachment.mimeType}`,
      );
    if (attachment.size > MAX_ATTACHMENT_BYTES)
      throw new Error(
        `Attachment exceeds the 25 MB limit: ${attachment.filename}`,
      );
    total += attachment.size;
    const path = normalizeBundlePath(attachment.bundlePath);
    if (paths.has(path)) throw new Error(`Duplicate attachment path: ${path}`);
    paths.add(path);
  }
  if (total > MAX_TOTAL_ATTACHMENT_BYTES)
    throw new Error("Attachments exceed the 100 MB package limit");
};

export const sha256 = async (
  bytes: Uint8Array,
): Promise<string | undefined> => {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};
