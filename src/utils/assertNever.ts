/** Makes discriminated-union handling fail at compile time when a case is missing. */
export const assertNever = (value: never): never => {
  throw new Error(`Unhandled value: ${String(value)}`);
};
