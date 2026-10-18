export function portraitGridPosition(
  index: number,
  columns: number,
  rows: number,
): string {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = columns === 1 ? 0 : (column / (columns - 1)) * 100;
  const y = rows === 1 ? 0 : (row / (rows - 1)) * 100;

  return `${x}% ${y}%`;
}
