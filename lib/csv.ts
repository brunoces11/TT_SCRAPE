export function generateCsvString(
  columns: string[],
  rows: Record<string, string | number | string[] | undefined>[]
): string {
  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = Array.isArray(value) ? value.join(", ") : String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape inner quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escapeCell).join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeCell(row[col])).join(","))
    .join("\n");

  return header + "\n" + body;
}

export function downloadCsv(csvString: string, filename: string): void {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
