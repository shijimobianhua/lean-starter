import { visibleCharacters } from "./share-model";

// Measure the loaded font, wrap at natural spaces where possible, then avoid a lone final glyph.
export function phraseLines(
  value: string,
  measure: (text: string) => number,
  width: number,
): string[] {
  const total = measure(value);
  const rows = Math.max(1, Math.ceil(total / width));
  const balancedWidth = rows > 1 ? Math.min(width, total / rows + 8) : width;
  const lines: string[] = [];
  let current = "";
  for (const character of visibleCharacters(value)) {
    if (current && measure(current + character) > balancedWidth) {
      const space = current.lastIndexOf(" ");
      if (
        space > 0 &&
        measure(current.slice(space + 1) + character) <= balancedWidth
      ) {
        lines.push(current.slice(0, space));
        current = current.slice(space + 1) + character;
      } else {
        lines.push(current.trimEnd());
        current = character.trimStart();
      }
    } else current += character;
  }
  if (current) lines.push(current.trim());
  if (
    lines.length > 1 &&
    visibleCharacters(lines[lines.length - 1]).length === 1
  ) {
    const before = visibleCharacters(lines[lines.length - 2]);
    if (before.length > 2) {
      const tail = before.pop()!;
      if (measure(tail + lines[lines.length - 1]) <= width) {
        lines[lines.length - 2] = before.join("");
        lines[lines.length - 1] = tail + lines[lines.length - 1];
      }
    }
  }
  return lines;
}
