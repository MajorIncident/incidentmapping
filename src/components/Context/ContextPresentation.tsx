import type { ContextItem } from "../../features/maps/schema";

type Props = {
  items: ContextItem[];
  variant?: "compact" | "detail";
  ariaLabel?: string;
};

/** A neutral presentation of investigator-authored Context values. */
export const ContextPresentation = ({
  items,
  variant = "compact",
  ariaLabel = "Context",
}: Props): JSX.Element => (
  <dl
    className={
      variant === "detail"
        ? "flex min-w-0 flex-col gap-2 text-[13px] text-slate-700"
        : "flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600"
    }
    aria-label={ariaLabel}
  >
    {items.map((item) => {
      const complete = [item.label, item.value, item.unit]
        .filter(Boolean)
        .join(" ");
      if (item.displayMode === "Chip")
        return (
          <div key={item.id} className="min-w-0" aria-label={complete}>
            <dt className="sr-only">{item.label}</dt>
            <dd className="inline-flex max-w-full rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              <span className="truncate">{item.value}</span>
            </dd>
          </div>
        );
      if (item.displayMode === "Metric")
        return (
          <div
            key={item.id}
            className="flex min-w-0 max-w-full items-baseline gap-1"
            aria-label={complete}
          >
            <dt className="shrink-0 text-[0.85em] font-semibold">
              {item.label}
            </dt>
            <dd className="flex min-w-0 items-baseline gap-1">
              <strong className="min-w-0 break-words text-base text-slate-900">
                {item.value}
              </strong>
              {item.unit ? <span className="shrink-0">{item.unit}</span> : null}
            </dd>
          </div>
        );
      return (
        <div key={item.id} className="flex min-w-0 gap-1" aria-label={complete}>
          <dt className="shrink-0 font-semibold">{item.label}:</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      );
    })}
  </dl>
);
