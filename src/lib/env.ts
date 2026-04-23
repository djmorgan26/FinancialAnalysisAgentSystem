/**
 * Typed, validated environment access.
 *
 * Integrations import these helpers instead of reading `process.env` directly.
 * Required vars: `requireEnv(name)` throws a clear "<NAME> is not set" error
 * on first use if missing. Optional vars: `optionalEnv(name)` returns
 * `undefined` when unset or when the value is a known placeholder.
 */

const PLACEHOLDER_PREFIXES = ["your_", "changeme", "replace_me"];

function isPlaceholder(v: string | undefined): boolean {
  if (!v) return true;
  const lower = v.trim().toLowerCase();
  return PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return isPlaceholder(v) ? undefined : v;
}

export function requireEnv(name: string): string {
  const v = optionalEnv(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function hasEnv(name: string): boolean {
  return optionalEnv(name) !== undefined;
}
