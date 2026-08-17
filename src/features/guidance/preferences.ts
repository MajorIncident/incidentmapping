const GUIDE_ENABLED_KEY = "incidentmapping.learning-guide.enabled";
const DISMISSED_TIPS_KEY = "incidentmapping.learning-guide.dismissed-tips";
const ACKNOWLEDGED_KEY =
  "incidentmapping.learning-guide.first-use-acknowledged";

const storage = (kind: "local" | "session"): Storage | null => {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const getLearningGuideEnabled = (): boolean => {
  try {
    return storage("local")?.getItem(GUIDE_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
};

export const setLearningGuideEnabled = (enabled: boolean): void => {
  try {
    storage("local")?.setItem(GUIDE_ENABLED_KEY, String(enabled));
  } catch {
    // Preferences remain usable in memory when storage is unavailable.
  }
};

const sessionGet = (key: string): string | null => {
  try {
    return storage("session")?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const getDismissedLearningTips = (): ReadonlySet<string> =>
  new Set((sessionGet(DISMISSED_TIPS_KEY) ?? "").split(",").filter(Boolean));

export const dismissLearningTip = (id: string): void => {
  try {
    const ids = new Set(getDismissedLearningTips());
    ids.add(id);
    storage("session")?.setItem(DISMISSED_TIPS_KEY, [...ids].join(","));
  } catch {
    // Session-only state is intentionally best effort.
  }
};

export const hasAcknowledgedLearningGuide = (): boolean =>
  sessionGet(ACKNOWLEDGED_KEY) === "true";

export const acknowledgeLearningGuide = (): void => {
  try {
    storage("session")?.setItem(ACKNOWLEDGED_KEY, "true");
  } catch {
    // Session-only state is intentionally best effort.
  }
};

export const learningGuideStorageKeys = {
  enabled: GUIDE_ENABLED_KEY,
  dismissed: DISMISSED_TIPS_KEY,
  acknowledged: ACKNOWLEDGED_KEY,
} as const;
