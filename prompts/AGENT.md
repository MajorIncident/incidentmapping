# Incident Mapping – Agent Guardrails

- TypeScript must not use `any`. Prefer explicit types or generics.
- Every functional change requires accompanying tests (unit or e2e) that cover the new behavior.
- Keep state mutations pure and serializable. Avoid non-deterministic side effects inside store actions.
- Favor accessibility-friendly components (semantic buttons, labels, focus states).
