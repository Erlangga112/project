function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderSuratTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    return escapeHtml(data[key.trim()] || "");
  });
}
