import type { SVGProps } from "react";

export type IconName =
  | "add"
  | "file"
  | "open"
  | "save"
  | "export"
  | "more"
  | "undo"
  | "redo"
  | "arrange"
  | "details"
  | "delete";

const paths: Record<IconName, JSX.Element> = {
  add: <path d="M12 5v14M5 12h14" />,
  file: <path d="M6 3h9l3 3v15H6V3Zm8 0v5h4M9 13h6M9 17h6" />,
  open: <path d="M4 18V7h6l2 2h8v9H4Zm0 0 3-6h14l-3 6H4Z" />,
  save: <path d="M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6" />,
  export: <path d="M12 3v12m0-12 4 4m-4-4L8 7M5 13v7h14v-7" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  undo: <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />,
  redo: <path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6" />,
  arrange: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM9 17h6M7 10v3h10v-3m-5 3v4" />,
  details: <path d="M4 5h16v14H4V5Zm5 0v14M12 9h5M12 13h5" />,
  delete: <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />,
};

export const Icon = ({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 shrink-0"
    {...props}
  >
    {paths[name]}
  </svg>
);
