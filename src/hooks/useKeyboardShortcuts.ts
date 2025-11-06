import { useEffect } from "react";
import { GRID_SIZE, useAppStore } from "../state/useAppStore";

type ShortcutHandlers = {
  onSave: () => void;
  onOpen: () => void;
};

const isEditableElement = (element: EventTarget | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

export const useKeyboardShortcuts = ({
  onSave,
  onOpen,
}: ShortcutHandlers): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = isEditableElement(target);
      const hasModifier = event.metaKey || event.ctrlKey;

      if (hasModifier) {
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          void onSave();
          return;
        }
        if (key === "o") {
          event.preventDefault();
          void onOpen();
          return;
        }
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            useAppStore.getState().actions.redo();
          } else {
            useAppStore.getState().actions.undo();
          }
          return;
        }
        if (key === "y") {
          event.preventDefault();
          useAppStore.getState().actions.redo();
          return;
        }
      }

      if (editable) {
        return;
      }

      const state = useAppStore.getState();
      const { selectionId, actions } = state;

      switch (event.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (!selectionId) {
            return;
          }
          event.preventDefault();
          const multiplier = event.shiftKey ? 4 : 1;
          const step = GRID_SIZE * multiplier;
          if (event.key === "ArrowUp") {
            actions.nudgeNodeBy(selectionId, 0, -step);
          }
          if (event.key === "ArrowDown") {
            actions.nudgeNodeBy(selectionId, 0, step);
          }
          if (event.key === "ArrowLeft") {
            actions.nudgeNodeBy(selectionId, -step, 0);
          }
          if (event.key === "ArrowRight") {
            actions.nudgeNodeBy(selectionId, step, 0);
          }
          return;
        }
        case "Enter": {
          if (!selectionId) {
            return;
          }
          event.preventDefault();
          if (event.shiftKey) {
            actions.addSibling(selectionId);
          } else {
            actions.addChild(selectionId);
          }
          return;
        }
        case "Delete":
        case "Backspace": {
          if (!selectionId) {
            return;
          }
          event.preventDefault();
          actions.deleteSelection();
          return;
        }
        case "Escape": {
          if (selectionId) {
            actions.select(null);
          }
          return;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen, onSave]);
};
