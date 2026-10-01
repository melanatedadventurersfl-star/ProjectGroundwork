import JSZip from "npm:jszip@3.10.1";

export type WorkbookSheet = { name: string; rows: string[][] };

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

export async function extractWorkbookSheets(bytes: Uint8Array): Promise<WorkbookSheet[]> {
  const workbook = await JSZip.loadAsync(bytes);
  const workbookFile = workbook.file("xl/workbook.xml");
  const relsFile = workbook.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relsFile) return [];

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
    if (name && id && !shouldSkipSheet(name)) sheetEntries.push({ name, id });
  }

  const sheets: WorkbookSheet[] = [];
  for (const sheet of sheetEntries) {
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
        const index = columnIndex(attribute(attrs, "r"));
        while (row.length <= index) row.push("");
        row[index] = cellText(cellMatch[2], attribute(attrs, "t"), sharedStrings).trim();
      }
      if (row.some((cell) => cell.trim())) rows.push(row);
    }
    if (rows.length) sheets.push({ name: sheet.name, rows });
  }
  return sheets;
}

export function workbookSheetsToText(sheets: WorkbookSheet[]) {
  return sheets.map((sheet) => [
    `SHEET: ${sheet.name}`,
    ...sheet.rows.map((row) => row.map((cell) => cell.trim()).join("\t")),
  ].join("\n")).join("\n\n").slice(0, 80000);
}
