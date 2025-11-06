# Incident Mapping Architecture

## Overview

Milestone 1 delivers a lean canvas experience for building cause/effect chains. The app is built with React, Vite, and TypeScript, styled with Tailwind CSS, and rendered on top of React Flow.

## Layering

- **State Management**: Zustand (`src/state/useAppStore.ts`) holds the authoritative graph state. All mutations flow through serializable actions such as `addChild`, `addSibling`, `nudgeNodeBy`, `renameNode`, and `deleteSelection`.
- **Data Model**: Zod schemas in `src/features/maps/schema.ts` describe the persisted `MapData` contract and perform validation before load/save operations.
- **Persistence**: `src/features/persistence/localfs.ts` uses the File System Access API when available; `src/features/persistence/download.ts` supplies Blob/download fallbacks. `components/FileMenu/FileMenu.tsx` orchestrates persistence flows for the UI.
- **Presentation**: React components under `src/components` render the canvas (`Canvas`), node visuals (`NodeTypes`), toolbar/File menu, and sidebar inspector.
- **App Shell**: `src/app/App.tsx` wires the store, keyboard shortcuts, layout chrome, and React Flow provider.

## Data Flow

1. UI components dispatch store actions via `useAppStore`. Actions synchronously update nodes, edges, metadata, and selection.
2. The React Flow surface receives nodes/edges as props from the store. Dragging and selection events bubble back into store actions.
3. Persistence operations request serialized map state through `toMap()`, validate with Zod, and then pass JSON to either the File System Access API or download fallbacks.
4. Opening a map validates JSON before calling `loadMap()`, ensuring runtime correctness.

## Directory Map

- `src/app`: application shell and providers.
- `src/components`: presentational components broken down by domain area (canvas, toolbar, sidebar).
- `src/features`: domain utilities (map schema/fixtures, persistence helpers).
- `src/hooks`: reusable hooks like keyboard shortcuts.
- `src/state`: Zustand store definition.
- `src/lib`: shared utilities (e.g., id generation).
- `tests/unit`: Vitest suites for schema and store correctness.
- `tests/e2e`: Playwright suites verifying file flows plus keyboard + sidebar workflows.

## Styling

Tailwind CSS powers styling via utility classes. Global styles live in `src/styles/index.css`. Canvas nodes leverage brand accents and a subtle depth shadow.

## History model

- Every mutating action captures a lightweight snapshot (`nodes`, `edges`, `metadata`, `selectionId`) before changes are applied.
- Snapshots are stored in a past/future stack inside the store, enabling `undo()`/`redo()` along with derived `canUndo`/`canRedo` flags for UI state.
- `nudgeNodeBy` batches repeated keyboard nudges: the first nudge pushes a snapshot immediately, while subsequent nudges within 200 ms reuse the same history entry to avoid noise.
- Undo/redo restores snapshots through pure state replacements so saves/exports always reflect the visible graph.

## Keyboard handling

- `src/hooks/useKeyboardShortcuts.ts` wires global listeners for save/open plus canvas workflows (arrow nudges, `Enter` child creation, `Shift+Enter` siblings, `Delete` removal, and undo/redo bindings).
- The hook skips actions while typing in inputs/textarea content, preserving native text editing semantics.
- History-aware actions invoked from the keyboard (nudges, add/remove) automatically update selection, inspector state, and inline node editing.

## Tooling & CI

- ESLint, Prettier, and TypeScript run locally and in CI for quality enforcement.
- Husky + lint-staged enforce formatting/linting on commits.
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs install, typecheck, lint, test, and build on Node LTS.
- Dependabot tracks npm and GitHub Actions updates.
