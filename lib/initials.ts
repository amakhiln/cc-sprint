// Shared by every place that renders a member avatar circle: the first
// letter of up to the first two words in a name.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
