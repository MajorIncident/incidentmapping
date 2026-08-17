import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { parseAndMigrateMapData } from "../maps/migration";
import { mapDataSchema, type MapData } from "../maps/schema";
import { attachmentRuntimeStore } from "./attachmentRuntimeStore";
import {
  MAX_TOTAL_ATTACHMENT_BYTES,
  normalizeBundlePath,
  sha256,
  validateAttachmentManifest,
} from "./attachments";

export type PackageWarning = {
  code: "missing-attachment" | "size-mismatch" | "checksum-mismatch";
  attachmentId: string;
  message: string;
};
export type OpenPackageResult = { map: MapData; warnings: PackageWarning[] };

export const canonicalMapJson = (map: MapData): string =>
  `${JSON.stringify(mapDataSchema.parse(map), null, 2)}\n`;

export const createIncidentPackage = async (map: MapData): Promise<Blob> => {
  const validated = mapDataSchema.parse(map);
  validateAttachmentManifest(validated.attachments);
  const entries: Record<string, Uint8Array> = {
    "map.json": strToU8(canonicalMapJson(validated)),
  };
  for (const attachment of validated.attachments) {
    const bytes = attachmentRuntimeStore.getBytes(attachment.id);
    if (!bytes)
      throw new Error(`Missing attachment bytes: ${attachment.filename}`);
    if (bytes.byteLength !== attachment.size)
      throw new Error(`Attachment size mismatch: ${attachment.filename}`);
    entries[attachment.bundlePath] = bytes;
  }
  return new Blob([zipSync(entries, { level: 6 })], {
    type: "application/vnd.incidentmap+zip",
  });
};

export const openIncidentPackage = async (
  input: ArrayBuffer,
): Promise<OpenPackageResult> => {
  if (input.byteLength > MAX_TOTAL_ATTACHMENT_BYTES + 1024 * 1024)
    throw new Error("Package exceeds the allowed size");
  const archiveBytes = new Uint8Array(input);
  // `unzipSync` exposes files as an object, so repeated ZIP entry names would
  // otherwise be silently overwritten. Inspect central-directory records
  // before extraction to keep package identity unambiguous.
  const decoder = new TextDecoder();
  const archivePaths = new Set<string>();
  for (let offset = 0; offset + 46 <= archiveBytes.byteLength; offset += 1) {
    if (
      archiveBytes[offset] !== 0x50 ||
      archiveBytes[offset + 1] !== 0x4b ||
      archiveBytes[offset + 2] !== 0x01 ||
      archiveBytes[offset + 3] !== 0x02
    )
      continue;
    const view = new DataView(
      archiveBytes.buffer,
      archiveBytes.byteOffset + offset,
    );
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    if (
      offset + 46 + nameLength + extraLength + commentLength >
      archiveBytes.byteLength
    )
      throw new Error("Malformed ZIP central directory");
    const path = decoder.decode(
      archiveBytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (archivePaths.has(path))
      throw new Error(`Duplicate package path: ${path}`);
    archivePaths.add(path);
    offset += 45 + nameLength + extraLength + commentLength;
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archiveBytes);
  } catch {
    throw new Error("Unable to unzip incident map package");
  }
  let uncompressedSize = 0;
  for (const [path, bytes] of Object.entries(entries)) {
    uncompressedSize += bytes.byteLength;
    if (path !== "map.json") normalizeBundlePath(path);
  }
  if (uncompressedSize > MAX_TOTAL_ATTACHMENT_BYTES + 1024 * 1024)
    throw new Error("Uncompressed package exceeds the allowed size");
  const mapEntries = Object.keys(entries).filter(
    (path) => path === "map.json" || path.endsWith("/map.json"),
  );
  if (mapEntries.length !== 1 || mapEntries[0] !== "map.json")
    throw new Error("Package must contain exactly one root map.json");
  let map: MapData;
  try {
    map = parseAndMigrateMapData(JSON.parse(strFromU8(entries["map.json"])));
  } catch (error) {
    throw new Error(`Malformed map.json: ${(error as Error).message}`);
  }
  validateAttachmentManifest(map.attachments);
  const warnings: PackageWarning[] = [];
  const loaded: Array<[string, Uint8Array]> = [];
  for (const attachment of map.attachments) {
    const bytes = entries[attachment.bundlePath];
    if (!bytes) {
      warnings.push({
        code: "missing-attachment",
        attachmentId: attachment.id,
        message: `Missing ${attachment.filename}`,
      });
      continue;
    }
    if (bytes.byteLength !== attachment.size) {
      warnings.push({
        code: "size-mismatch",
        attachmentId: attachment.id,
        message: `Size mismatch for ${attachment.filename}`,
      });
      continue;
    }
    if (
      attachment.sha256 &&
      (await sha256(bytes)) !== attachment.sha256.toLowerCase()
    ) {
      warnings.push({
        code: "checksum-mismatch",
        attachmentId: attachment.id,
        message: `Checksum mismatch for ${attachment.filename}`,
      });
      continue;
    }
    loaded.push([attachment.id, bytes]);
  }
  attachmentRuntimeStore.clear();
  loaded.forEach(([id, bytes]) => attachmentRuntimeStore.setBytes(id, bytes));
  return { map, warnings };
};
