# `.incidentmap` File Format

`.incidentmap` is the canonical, local, self-contained save format. It is a ZIP
archive with media type `application/vnd.incidentmap+zip`; it is not a hosted
service or an opaque database.

## ZIP structure and manifest

```text
example.incidentmap
├── map.json                         # exactly one, at archive root
└── attachments/
    ├── ATT-001-photo.jpg
    └── ATT-002-interview.webm
```

There must be exactly one `map.json`, and it must be the root entry. A nested or
second `map.json` is a fatal package error. `map.json` is canonical, formatted,
newline-terminated strict V4 `MapData`; its root `attachments` array is the
manifest. Each manifest record supplies stable ID, display filename,
allowed MIME type, declared byte size, unique `bundlePath`, and optional SHA-256
digest. Evidence links to manifest IDs through `attachmentIds`.

Bundle paths must be normalized relative paths under `attachments/`. Empty
segments, `.`, `..`, backslashes, NUL, and absolute paths are rejected. A path
is unique and is read only by exact manifest match; archive filenames never
become filesystem destinations. Extra archive entries are not application
content and should not be relied upon.

## Supported media and centralized limits

The V4 manifest permits JPEG, PNG, WebP, PDF, MP4, WebM, plain text, CSV, and
JSON MIME types. The current upload UI intentionally accepts the previewable
subset: JPEG, PNG, WebP, PDF, MP4, and WebM. Each attachment is limited to
25 MiB and declared attachment bytes total at most 100 MiB. Compressed input and
uncompressed ZIP content are each bounded to 100 MiB plus a 1 MiB map/archive
allowance. These are supported product limits, enforced by centralized
persistence validation rather than suggestions to callers.

If `sha256` is present, it is 64 hexadecimal characters and opening compares a
lowercase SHA-256 of the bytes when Web Crypto can compute it. Absence of a
checksum is legal. Size is always checked. Save refuses a missing byte payload
or declared/actual size mismatch.

## Canonical save flow

1. Project the runtime store to V4 `MapData` and strictly validate it.
2. Validate the attachment manifest, safe paths, MIME types, per-file size, and
   total declared size.
3. Retrieve each active attachment's bytes by ID from the session runtime byte
   store and verify its declared size.
4. Serialize validated V4 as formatted root `map.json`; add binaries at their
   exact manifest `bundlePath`; ZIP with `fflate`.
5. Write/download a `.incidentmap` using the File System Access API where
   supported or the browser download fallback. The dirty baseline advances only
   after save succeeds.

## Canonical open flow and failure semantics

1. Bound compressed input, unzip with `fflate`, sum uncompressed entries, and
   validate attachment-looking paths.
2. Require exactly one root `map.json`; UTF-8 decode, JSON parse, migrate V1–V3
   if necessary, and strictly validate V4 plus its manifest.
3. For each manifest record, require an exact entry, size match, and checksum
   match when a checksum is present and digest computation is available.
4. Replace the active byte store only after structural processing and load all
   valid payloads. Load the map and show collected attachment warnings.

Unsafe ZIPs, oversize packages, unzip errors, missing/root ambiguity for
`map.json`, malformed JSON, unsupported versions, invalid schema/graph,
disallowed media, unsafe/duplicate paths, or limit violations are **fatal**:
the requested map is not opened. A missing attachment, a size mismatch, or a
checksum mismatch is a **recoverable warning**: the V4 investigation and its
Evidence/manifest metadata open, but that payload is excluded and its preview
reports unavailable content. Warnings are shown in an accessible modal dialog;
save failures are reported and do not claim success.

## Legacy JSON import and metadata export

Open accepts `.json` as a legacy boundary. V1, V2, and V3 are deterministically
migrated; strict V4 JSON is also accepted. JSON is **not** the canonical save
format. Export JSON exists for metadata/interchange and writes V4 `map.json`
content only. If attachments are listed, the UI warns that binary files are not
included. Importing that JSON preserves manifest metadata but clears runtime
bytes, so previews are unavailable until content is supplied through a package.

## Preview and Blob URL lifecycle

Attachment bytes are session-only and never base64-encoded into `map.json` or
history. Preview creates a `blob:` URL lazily from trusted in-memory bytes.
Images use an image element, supported video uses native controls, and PDF uses
a sandboxed iframe; all offer an open/download link. Browser codecs and PDF
viewers vary, so a valid supported payload may download even when inline preview
is unavailable. Videos do not acquire captions automatically.

The preview is a keyboard-contained modal: it receives focus, closes with
Escape, provides a labeled close control, and restores prior focus. It fills
small screens and is bounded on larger screens. URLs are revoked when preview
closes, content is replaced or permanently removed, tombstones expire, a map is
replaced, or the byte store is cleared. Blob URLs are never persisted.

## Security restrictions and explicit non-goals

Treat every package as untrusted. Strict schema parsing, version gating,
normalized paths, ZIP size bounds, media allowlists, exact manifest lookup,
optional integrity checks, sandboxed PDF display, and `noopener noreferrer` on
new browsing contexts form the supported file-security boundary. MIME labels
and optional checksums are not malware scanning or content sanitization; users
should open files only from trusted sources. No archive entry is executed and
the application does not extract to a local directory.

The format does not provide encryption, signing/authenticity, password
protection, antivirus scanning, cloud backup, synchronization, collaboration,
server retention, audit logging, or recovery after the browser session ends
without saving. External URLs are links, not bundled content, and only HTTP(S)
is accepted.
