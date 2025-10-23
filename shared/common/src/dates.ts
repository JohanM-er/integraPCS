export function nowIso(): string {
  return new Date().toISOString();
}

export function parseIso(value: string): Date | null {
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}