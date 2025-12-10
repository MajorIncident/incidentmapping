type BuildInfo = {
  version: string;
  commit: string;
  commitDate: string;
  builtAt: string;
};

const buildInfo: BuildInfo | null =
  typeof __BUILD_INFO__ !== "undefined" ? __BUILD_INFO__ : null;

const formatBuildDate = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getBuildInfo = (): BuildInfo & { builtAtFormatted: string } => {
  if (!buildInfo) {
    return {
      version: "dev",
      commit: "unknown",
      commitDate: "",
      builtAt: "",
      builtAtFormatted: "",
    };
  }

  return {
    ...buildInfo,
    builtAtFormatted: formatBuildDate(buildInfo.builtAt),
  };
};
