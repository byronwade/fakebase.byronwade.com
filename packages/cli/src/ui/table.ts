/**
 * renderTable — renders an ASCII box-drawing table for terminal output.
 * No external dependencies.
 */

const TOP_LEFT = "┌";
const TOP_RIGHT = "┐";
const BOTTOM_LEFT = "└";
const BOTTOM_RIGHT = "┘";
const HORIZONTAL = "─";
const VERTICAL = "│";
const TOP_MID = "┬";
const BOTTOM_MID = "┴";
const LEFT_MID = "├";
const RIGHT_MID = "┤";
const CROSS = "┼";

function padCell(value: string, width: number): string {
  const padded = ` ${value} `;
  return padded.padEnd(width + 2);
}

export function renderTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];

  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => {
      const cell = row[i] ?? "";
      return Math.max(max, cell.length);
    }, 0);
    return Math.max(h.length, maxData);
  });

  function makeRow(cells: string[]): string {
    return (
      VERTICAL +
      cells.map((cell, i) => padCell(cell, colWidths[i] ?? 0)).join(VERTICAL) +
      VERTICAL
    );
  }

  function makeSeparator(left: string, mid: string, right: string): string {
    return left + colWidths.map((w) => HORIZONTAL.repeat(w + 2)).join(mid) + right;
  }

  if (allRows.length === 0 || headers.length === 0) {
    return "";
  }

  const lines: string[] = [];

  lines.push(makeSeparator(TOP_LEFT, TOP_MID, TOP_RIGHT));
  lines.push(makeRow(headers));
  lines.push(makeSeparator(LEFT_MID, CROSS, RIGHT_MID));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row === undefined) continue;
    const padded = headers.map((_, j) => row[j] ?? "");
    lines.push(makeRow(padded));
    if (i < rows.length - 1) {
      lines.push(makeSeparator(LEFT_MID, CROSS, RIGHT_MID));
    }
  }

  lines.push(makeSeparator(BOTTOM_LEFT, BOTTOM_MID, BOTTOM_RIGHT));

  return lines.join("\n");
}
