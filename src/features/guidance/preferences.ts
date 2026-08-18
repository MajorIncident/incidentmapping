const GUIDE_ENABLED_KEY = "incidentmapping.learning-guide.enabled";
const DISMISSED_TIPS_KEY = "incidentmapping.learning-guide.dismissed-tips";
const INTRODUCTION_SEEN_KEY =
  "incidentmapping.learning-guide.first-use-introduction-seen";

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

export const hasSeenLearningGuideIntroduction = (): boolean => {
  try {
    return storage("local")?.getItem(INTRODUCTION_SEEN_KEY) === "true";
  } catch {
    return false;
  }
};

export const markLearningGuideIntroductionSeen = (): void => {
  try {
    storage("local")?.setItem(INTRODUCTION_SEEN_KEY, "true");
  } catch {
    // Preferences remain usable when persistent storage is unavailable.
  }
};

export const learningGuideStorageKeys = {
  enabled: GUIDE_ENABLED_KEY,
  dismissed: DISMISSED_TIPS_KEY,
  introductionSeen: INTRODUCTION_SEEN_KEY,
} as const;
