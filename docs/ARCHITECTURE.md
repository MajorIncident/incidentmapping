# Incident Mapping Architecture

## Overview

Milestone 1 delivers a lean canvas experience for building cause/effect chains. The app is built with React, Vite, and TypeScript, styled with Tailwind CSS, and rendered on top of React Flow.

## Layering

- **State Management**: Zustand (`src/state/useAppStore.ts`) holds the authoritative graph state. All mutations flow through serializable actions (e.g. `addChainNode`, `renameNode`, `deleteNode`).
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
- `tests/e2e`: Playwright smoke test verifying end-to-end flows.

## Styling

Tailwind CSS powers styling via utility classes. Global styles live in `src/styles/index.css`. Canvas nodes leverage brand accents and a subtle depth shadow.

## Tooling & CI

- ESLint, Prettier, and TypeScript run locally and in CI for quality enforcement.
- Husky + lint-staged enforce formatting/linting on commits.
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs install, typecheck, lint, test, and build on Node LTS.
- Dependabot tracks npm and GitHub Actions updates.
