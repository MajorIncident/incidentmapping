import { useEffect } from "react";

type ShortcutHandlers = {
  onSave: () => void;
  onOpen: () => void;
};

export const useKeyboardShortcuts = ({
  onSave,
  onOpen,
}: ShortcutHandlers): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
      }

      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        onOpen();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen, onSave]);
};
