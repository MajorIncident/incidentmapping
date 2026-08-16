import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentRuntimeStore } from "../../src/features/persistence/attachmentRuntimeStore";
import {
  MAX_ATTACHMENT_BYTES,
  normalizeBundlePath,
  sha256,
  validateAttachmentManifest,
} from "../../src/features/persistence/attachments";

describe("attachment persistence boundaries", () => {
  afterEach(() => attachmentRuntimeStore.clear());

  it("stores copied bytes outside serializable map state and revokes URLs", () => {
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:test"),
        revokeObjectURL: revoke,
      }),
    );
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    attachmentRuntimeStore.setBytes("att-1", bytes);
    bytes[0] = 0;
    expect(attachmentRuntimeStore.getBytes("att-1")).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );
    attachmentRuntimeStore.getBlobUrl("att-1", "image/jpeg");
    attachmentRuntimeStore.clear();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it("rejects traversal, disallowed media, and per-file limits", () => {
    expect(() => normalizeBundlePath("attachments/../map.json")).toThrow(
      /Unsafe/,
    );
    expect(() =>
      validateAttachmentManifest([
        {
          id: "att-1",
          filename: "payload.html",
          mimeType: "text/html" as "text/plain",
          size: MAX_ATTACHMENT_BYTES + 1,
          bundlePath: "attachments/payload.html",
        },
      ]),
    ).toThrow(/Disallowed/);
  });

  it("uses Web Crypto for deterministic SHA-256 checksums", async () => {
    expect(await sha256(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
