function escapeCsvValue(value) {
  const normalizedValue = value == null ? "" : String(value);
  const escapedValue = normalizedValue.replace(/"/g, '""');
  return /[",;\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
}


export function downloadRowsAsCsv({ filename, header = [], rows = [] }) {
  if (!rows.length || !header.length) {
    return;
  }

  const csvContent = [header, ...rows]
    .map((columns) => columns.map(escapeCsvValue).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
