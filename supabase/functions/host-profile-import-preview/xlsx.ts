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

function columnIndex(reference: string) {
  const letters = String(reference ?? "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function cellText(cellXml: string, type: string, sharedStrings: string[]) {
  if (type === "inlineStr") {
    return decodeXmlEntities([...cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(""));
  }
  const raw = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
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

  const sharedStrings = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXmlEntities([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(""))
  );

  const relationships = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) {
    relationships.set(match[1], match[2]);
  }

  const sheetEntries = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)];
  const outputs: string[] = [];

  for (const match of sheetEntries) {
    const sheetName = decodeXmlEntities(match[1]);
    if (shouldSkipSheet(sheetName)) continue;
    const target = relationships.get(match[2]);
    if (!target) continue;

    const normalizedTarget = target.replace(/^\//, "").replace(/^xl\//, "");
    const sheetFile = workbook.file(`xl/${normalizedTarget}`);
    if (!sheetFile) continue;

    const sheetXml = await sheetFile.async("string");
    const rows: string[][] = [];
    for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const reference = attrs.match(/\br="([^"]+)"/)?.[1] ?? "";
        const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
        const index = columnIndex(reference);
        while (row.length <= index) row.push("");
        row[index] = cellText(cellMatch[2], type, sharedStrings);
      }
      if (row.some((cell) => cell.trim())) rows.push(row);
    }

    if (rows.length) outputs.push(rowsToText(sheetName, rows));
  }

  return outputs.join("\n\n").slice(0, 80000);
}
