// @vitest-environment node
import { strToU8, unzipSync, zipSync } from "fflate";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleMap } from "../../src/features/maps/fixtures";
import type { Attachment, MapData } from "../../src/features/maps/schema";
import { attachmentRuntimeStore } from "../../src/features/persistence/attachmentRuntimeStore";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  sha256,
} from "../../src/features/persistence/attachments";
import {
  canonicalMapJson,
  createIncidentPackage,
  openIncidentPackage,
} from "../../src/features/persistence/package";

const manifest = async (
  id: string,
  filename: string,
  mimeType: Attachment["mimeType"],
  bytes: Uint8Array,
): Promise<Attachment> => ({
  id,
  filename,
  mimeType,
  size: bytes.byteLength,
  bundlePath: `attachments/${id}-${filename}`,
  sha256: await sha256(bytes),
});

const packagedMap = async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pdf = strToU8("%PDF-1.7\nidentity-test\n%%EOF");
  const attachments = [
    await manifest("AT-001", "scene.jpg", "image/jpeg", jpeg),
    await manifest("AT-002", "report.pdf", "application/pdf", pdf),
  ];
  const map: MapData = {
    ...structuredClone(sampleMap),
    metadata: {
      ...sampleMap.metadata,
      attachmentReferenceHighWaterMark: 2,
      contextItems: sampleMap.metadata?.contextItems ?? [],
    },
    evidence: [
      {
        id: "EV-001",
        type: "Photo",
        title: "Scene and report",
        attachmentIds: attachments.map(({ id }) => id),
      },
    ],
    attachments,
  };
  attachmentRuntimeStore.setBytes("AT-001", jpeg);
  attachmentRuntimeStore.setBytes("AT-002", pdf);
  return { map, jpeg, pdf };
};

const exactBuffer = (bytes: Uint8Array): ArrayBuffer =>
  new Uint8Array(bytes).buffer as ArrayBuffer;

const zipBuffer = (entries: Record<string, Uint8Array>): ArrayBuffer =>
  exactBuffer(zipSync(entries));

describe("incident map packages", () => {
  afterEach(() => {
    attachmentRuntimeStore.clear();
    vi.unstubAllGlobals();
  });

  it("round trips JPEG and PDF bytes with semantic and manifest identity", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    const { map, jpeg, pdf } = await packagedMap();
    const blob = await createIncidentPackage(map);
    expect(blob.type).toBe("application/vnd.incidentmap+zip");
    const packageBytes = await blob.arrayBuffer();

    const archive = unzipSync(new Uint8Array(packageBytes));
    expect(archive["map.json"]).toEqual(strToU8(canonicalMapJson(map)));
    const exportedJson = new TextDecoder().decode(archive["map.json"]);
    expect(exportedJson).not.toContain("positiveConsequenceBulletPoints");
    expect(exportedJson).not.toContain("negativeConsequenceBulletPoints");
    expect(archive[map.attachments[0].bundlePath]).toEqual(jpeg);
    expect(archive[map.attachments[1].bundlePath]).toEqual(pdf);

    attachmentRuntimeStore.clear();
    const opened = await openIncidentPackage(packageBytes);
    expect(opened).toEqual({ map, warnings: [] });
    expect(opened.map.attachments).toEqual(map.attachments);
    expect(attachmentRuntimeStore.getBytes("AT-001")).toEqual(jpeg);
    expect(attachmentRuntimeStore.getBytes("AT-002")).toEqual(pdf);
  });

  it("reports missing files, size mismatches, and checksum mismatches without loading bytes", async () => {
    const { map, jpeg } = await packagedMap();
    const wrongSize = structuredClone(map);
    wrongSize.attachments[0].size += 1;
    const wrongHash = structuredClone(map);
    wrongHash.attachments[0].sha256 = "0".repeat(64);

    const cases = [
      {
        map,
        entries: { "map.json": strToU8(canonicalMapJson(map)) },
        code: "missing-attachment",
      },
      {
        map: wrongSize,
        entries: {
          "map.json": strToU8(canonicalMapJson(wrongSize)),
          [wrongSize.attachments[0].bundlePath]: jpeg,
        },
        code: "size-mismatch",
      },
      {
        map: wrongHash,
        entries: {
          "map.json": strToU8(canonicalMapJson(wrongHash)),
          [wrongHash.attachments[0].bundlePath]: jpeg,
        },
        code: "checksum-mismatch",
      },
    ] as const;

    for (const item of cases) {
      const result = await openIncidentPackage(zipBuffer(item.entries));
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: item.code, attachmentId: "AT-001" }),
      );
      expect(attachmentRuntimeStore.getBytes("AT-001")).toBeUndefined();
    }
  });

  it("rejects unsafe, duplicate, non-root, and missing map paths", async () => {
    const mapJson = strToU8(canonicalMapJson(sampleMap));
    await expect(
      openIncidentPackage(
        zipBuffer({ "map.json": mapJson, "../evil": strToU8("x") }),
      ),
    ).rejects.toThrow(/Unsafe|under attachments/);
    await expect(
      openIncidentPackage(zipBuffer({ "nested/map.json": mapJson })),
    ).rejects.toThrow(/Unsafe|under attachments|root map\.json/);
    await expect(
      openIncidentPackage(zipBuffer({ "readme.txt": strToU8("x") })),
    ).rejects.toThrow();

    // Make two equal-length central-directory names identical. The local file
    // records remain valid enough to prove duplicate detection occurs first.
    const duplicate = zipSync({
      "attachments/a": strToU8("a"),
      "attachments/b": strToU8("b"),
    });
    const needle = strToU8("attachments/b");
    for (let index = 0; index <= duplicate.length - needle.length; index += 1) {
      if (needle.every((byte, offset) => duplicate[index + offset] === byte))
        duplicate.set(strToU8("attachments/a"), index);
    }
    await expect(openIncidentPackage(exactBuffer(duplicate))).rejects.toThrow(
      "Duplicate package path",
    );
  });

  it("enforces MIME, individual-size, and total-size restrictions before writing", async () => {
    const invalidMime = structuredClone(sampleMap) as MapData;
    invalidMime.attachments = [
      {
        id: "AT-001",
        filename: "page.html",
        mimeType: "text/html" as Attachment["mimeType"],
        size: 0,
        bundlePath: "attachments/page.html",
      },
    ];
    await expect(createIncidentPackage(invalidMime)).rejects.toThrow();

    const tooLarge = structuredClone(sampleMap);
    tooLarge.attachments = [
      {
        id: "AT-001",
        filename: "large.pdf",
        mimeType: "application/pdf",
        size: MAX_ATTACHMENT_BYTES + 1,
        bundlePath: "attachments/large.pdf",
      },
    ];
    await expect(createIncidentPackage(tooLarge)).rejects.toThrow("25 MB");

    const oversizedPackage = new ArrayBuffer(
      MAX_TOTAL_ATTACHMENT_BYTES + 1024 * 1024 + 1,
    );
    await expect(openIncidentPackage(oversizedPackage)).rejects.toThrow(
      "Package exceeds the allowed size",
    );
  });
});
