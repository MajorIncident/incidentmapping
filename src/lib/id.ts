let counter = 0;

export const createId = (prefix = "id"): string => {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${random}`;
};
