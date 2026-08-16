type RuntimeAttachment = {
  bytes: Uint8Array;
  blobUrl?: string;
};

const active = new Map<string, RuntimeAttachment>();
const tombstones = new Map<string, RuntimeAttachment>();
let revision = 0;
const listeners = new Set<() => void>();
const changed = () => {
  revision++;
  listeners.forEach((listener) => listener());
};

const revoke = (value?: RuntimeAttachment) => {
  if (value?.blobUrl) URL.revokeObjectURL(value.blobUrl);
};

export const attachmentRuntimeStore = {
  get revision(): number {
    return revision;
  },
  getBytes(id: string): Uint8Array | undefined {
    return active.get(id)?.bytes;
  },
  setBytes(id: string, bytes: Uint8Array): void {
    revoke(active.get(id));
    active.set(id, { bytes: bytes.slice() });
    tombstones.delete(id);
    changed();
  },
  remove(id: string, restorable = true): void {
    const value = active.get(id);
    if (!value) return;
    active.delete(id);
    if (restorable) tombstones.set(id, value);
    else revoke(value);
    changed();
  },
  restore(id: string): boolean {
    const value = tombstones.get(id);
    if (!value) return false;
    tombstones.delete(id);
    active.set(id, value);
    changed();
    return true;
  },
  releaseTombstones(reachableIds: ReadonlySet<string>): void {
    for (const [id, value] of tombstones) {
      if (!reachableIds.has(id)) {
        revoke(value);
        tombstones.delete(id);
      }
    }
  },
  getBlobUrl(id: string, mimeType: string): string | undefined {
    const value = active.get(id);
    if (!value) return undefined;
    if (!value.blobUrl)
      value.blobUrl = URL.createObjectURL(
        new Blob([value.bytes], { type: mimeType }),
      );
    return value.blobUrl;
  },
  clear(): void {
    active.forEach(revoke);
    tombstones.forEach(revoke);
    active.clear();
    tombstones.clear();
    changed();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
