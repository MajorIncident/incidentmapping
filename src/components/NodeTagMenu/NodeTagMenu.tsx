import { useEffect, useId, useRef, useState } from "react";

export type NodeTagOption<T extends string> = { value: T; label: string };

const stopCanvasInteraction = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

/** A compact, keyboard-operable picker that is safe to use inside React Flow nodes. */
export const NodeTagMenu = <T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
  readOnly = false,
  placeholder,
}: {
  label: string;
  value?: T;
  options: readonly NodeTagOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
}): JSX.Element => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = options.find((option) => option.value === value);
  const displayLabel = current?.label ?? placeholder ?? options[0].label;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  if (readOnly) {
    return (
      <span
        className={`node-tag ${className}`}
        aria-label={`${label}: ${displayLabel}`}
      >
        {displayLabel}
      </span>
    );
  }

  const openAndFocus = (
    index = Math.max(
      0,
      options.findIndex((item) => item.value === value),
    ),
  ) => {
    setOpen(true);
    window.requestAnimationFrame(() => itemRefs.current[index]?.focus());
  };

  return (
    <div
      ref={rootRef}
      className="nodrag nopan nowheel relative"
      onPointerDown={stopCanvasInteraction}
      onMouseDown={stopCanvasInteraction}
      onClick={stopCanvasInteraction}
      onDoubleClick={stopCanvasInteraction}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`node-tag ${className}`}
        aria-label={`${label}: ${displayLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAndFocus(event.key === "ArrowUp" ? options.length - 1 : 0);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {displayLabel}
        <span aria-hidden="true" className="ml-1 text-[9px]">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="node-tag-menu"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className="node-tag-menu-item"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  buttonRef.current?.focus();
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const offset = event.key === "ArrowDown" ? 1 : -1;
                  itemRefs.current[
                    (index + offset + options.length) % options.length
                  ]?.focus();
                }
                if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  itemRefs.current[
                    event.key === "Home" ? 0 : options.length - 1
                  ]?.focus();
                }
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? (
                <span aria-hidden="true">✓</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
