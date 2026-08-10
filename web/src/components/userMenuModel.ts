export function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const selected = words.length === 1 ? words : [words[0], words.at(-1)!];
  return selected.map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? "").join("").slice(0, 2);
}
