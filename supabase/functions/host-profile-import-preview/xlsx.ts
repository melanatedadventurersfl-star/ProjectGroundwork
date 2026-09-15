import JSZip from "npm:jszip@3.10.1";

const KNOWN_LABELS = new Set([
  "public organization name", "public host name", "business name", "organization name", "company name", "host name", "organizer",
  "host type", "organization type", "business type", "profile type", "tagline", "slogan", "short description", "short summary", "summary",
  "company summary", "organization summary", "about", "about us", "about the organizer", "about the host", "company overview",
  "organization overview", "mission", "home city", "city", "state", "province", "region", "website", "public website", "public email",
  "contact email", "email", "public phone", "contact phone", "phone", "instagram", "facebook", "specialties", "services", "offerings",
  "what we do", "service areas", "areas served", "markets served", "typical audiences", "audience", "audiences", "who we serve",
  "languages", "accessibility", "accessibility information", "accommodations", "founded", "founded year", "established", "established year",
]);

function clean(value: unknown, max = 8000) {
  return String(value ?? "").trim().slice(0, max);
}

function decodeXmlEntities(value: string) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeLabel(value: string) {
  return String(value ?? "").toLowerCase().replace(/[:\-]+$/, "").replace(/\s+/g, " ").trim();
}

function attribute(attrs: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return attrs.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`, "i"))?.[1] ?? "";
}

function namespacedId(attrs: string) {
  return attrs.match(/(?:^|\s)(?:[A-Za-z_][\w.-]*:)?id="([^"]+)"/i)?.[1] ?? "";
}

function columnIndex(reference: string) {
  const letters = String(reference ?? "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function textRuns(xml: string) {
  return [...xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/g)]
    .map((match) => match[1])
    .join("");
}

function cellText(cellXml: string, type: string, sharedStrings: string[]) {
  if (type === "inlineStr") return decodeXmlEntities(textRuns(cellXml));
  const raw = cellXml.match(/<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/)?.[1] ?? "";
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) && sharedStrings[index] !== undefined ? sharedStrings[index] : "";
  }
  if (type === "b") return raw === "1" ? "true" : raw === "0" ? "false" : raw;
  return decodeXmlEntities(raw);
}

function normalizedSheetName(name: string) {
  return String(name ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function shouldSkipSheet(name: string) {
  const normalized = normalizedSheetName(name);
  if (/^(?:instructions?|read ?me|help|guide|how to use)$/.test(normalized)) return true;
  if (/^(?:internal(?: only)?|private(?: only)?|confidential|do not publish|admin(?: only)?|billing|legal)$/.test(normalized)) return true;
  return /(?:internal only|private and confidential|do not publish)/.test(normalized);
}

function rowsToText(sheetName: string, rows: string[][]) {
  const output = [`SHEET: ${sheetName}`];
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /^(?:field|label|attribute|property|key)$/i.test(cell.trim())) &&
    row.some((cell) => /^value$/i.test(cell.trim()))
  );
  let labelColumn = -1;
  let valueColumn = -1;
  if (headerIndex >= 0) {
    const header = rows[headerIndex];
    labelColumn = header.findIndex((cell) => /^(?:field|label|attribute|property|key)$/i.test(cell.trim()));
    valueColumn = header.findIndex((cell) => /^value$/i.test(cell.trim()));
  }

  rows.forEach((row, rowIndex) => {
    const values = row.map((cell) => clean(cell, 6000)).filter(Boolean);
    if (!values.length) return;

    if (rowIndex > headerIndex && headerIndex >= 0 && labelColumn >= 0 && valueColumn >= 0) {
      const label = clean(row[labelColumn], 160);
      const value = clean(row[valueColumn], 6000);
      if (label && value) {
        output.push(`${label}: ${value}`);
        return;
      }
    }

    if (row.length >= 3) {
      const possibleLabel = clean(row[1], 160);
      const possibleValue = clean(row[2], 6000);
      if (possibleLabel && possibleValue && KNOWN_LABELS.has(normalizeLabel(possibleLabel))) {
        output.push(`${possibleLabel}: ${possibleValue}`);
        return;
      }
    }

    if (row.length >= 2) {
      const first = clean(row[0], 160);
      const second = clean(row[1], 6000);
      if (first && second && KNOWN_LABELS.has(normalizeLabel(first))) {
        output.push(`${first}: ${second}`);
        return;
      }
    }

    output.push(values.join(" | "));
  });

  return output.join("\n");
}

export async function extractXlsxText(bytes: Uint8Array) {
  const workbook = await JSZip.loadAsync(bytes);
  const workbookFile = workbook.file("xl/workbook.xml");
  const relsFile = workbook.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relsFile) return "";

  const [workbookXml, relsXml, sharedXml] = await Promise.all([
    workbookFile.async("string"),
    relsFile.async("string"),
    workbook.file("xl/sharedStrings.xml")?.async("string") ?? Promise.resolve(""),
  ]);

  const sharedStrings = [...sharedXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/g)]
    .map((match) => decodeXmlEntities(textRuns(match[1])));

  const relationships = new Map<string, string>();
  for (const match of relsXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/g)) {
    const attrs = match[1];
    const id = attribute(attrs, "Id");
    const target = attribute(attrs, "Target");
    if (id && target) relationships.set(id, target);
  }

  const sheetEntries: Array<{ name: string; id: string }> = [];
  for (const match of workbookXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*)\/?\s*>/g)) {
    const attrs = match[1];
    const name = decodeXmlEntities(attribute(attrs, "name"));
    const id = namespacedId(attrs);
    if (name && id) sheetEntries.push({ name, id });
  }

  const outputs: string[] = [];
  for (const sheet of sheetEntries) {
    if (shouldSkipSheet(sheet.name)) continue;
    const target = relationships.get(sheet.id);
    if (!target) continue;

    const normalizedTarget = target.replace(/^\//, "").replace(/^xl\//, "");
    const sheetFile = workbook.file(`xl/${normalizedTarget}`);
    if (!sheetFile) continue;

    const sheetXml = await sheetFile.async("string");
    const rows: string[][] = [];
    for (const rowMatch of sheetXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?row\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/g)) {
      const row: string[] = [];
      for (const cellMatch of rowMatch[1].matchAll(/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/g)) {
        const attrs = cellMatch[1];
        const reference = attribute(attrs, "r");
        const type = attribute(attrs, "t");
        const index = columnIndex(reference);
        while (row.length <= index) row.push("");
        row[index] = cellText(cellMatch[2], type, sharedStrings);
      }
      if (row.some((cell) => cell.trim())) rows.push(row);
    }

    if (rows.length) outputs.push(rowsToText(sheet.name, rows));
  }

  return outputs.join("\n\n").slice(0, 80000);
}
