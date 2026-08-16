import { useRef } from "react";
import {
  PRESENTATION_LENSES,
  type PresentationLens,
} from "../../features/presentation/selectors";

export const LensPicker = ({
  value,
  onChange,
}: {
  value: PresentationLens;
  onChange: (lens: PresentationLens) => void;
}) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div className="lens-picker" role="tablist" aria-label="View">
      <strong>View</strong>
      {PRESENTATION_LENSES.map((lens, index) => (
        <button
          key={lens}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          aria-selected={value === lens}
          tabIndex={value === lens ? 0 : -1}
          onClick={() => onChange(lens)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? PRESENTATION_LENSES.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      PRESENTATION_LENSES.length) %
                    PRESENTATION_LENSES.length;
            onChange(PRESENTATION_LENSES[next]);
            refs.current[next]?.focus();
          }}
        >
          {lens}
        </button>
      ))}
    </div>
  );
};
