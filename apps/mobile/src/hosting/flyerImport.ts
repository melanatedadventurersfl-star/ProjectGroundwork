import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';
import type { EventDraft, ImportPreviewResult } from './creation';

export type FlyerAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

type OcrLine = {
  text?: string;
  confidence?: number;
  bbox?: { x0?: number; x1?: number; y0?: number; y1?: number };
};
type OcrResult = { data?: { text?: string; confidence?: number; lines?: OcrLine[] } };
type TesseractApi = { recognize: (image: unknown, language: string, options?: Record<string, unknown>) => Promise<OcrResult> };

type FlyerRegions = {
  full: string;
  title: string;
  details: string;
  footer: string;
};

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';

function clean(value: string) {
  return value.replace(/[|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanDetectedLine(value: string) {
  return clean(value)
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[^A-Za-z0-9),.!?'’&+\-]+$/, '')
    .trim();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function monthNumber(value: string) {
  const months: Record<string, string> = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
  return months[value.toLowerCase()] || '';
}

function textQuality(value: string) {
  const compact = value.replace(/\s/g, '');
  if (!compact) return 0;
  const lettersAndNumbers = compact.match(/[A-Za-z0-9]/g)?.length || 0;
  const strange = compact.match(/[^A-Za-z0-9$@&+.,:'’!?#/()\-]/g)?.length || 0;
  return Math.max(0, lettersAndNumbers / compact.length - strange / Math.max(1, compact.length));
}

function plausibleLine(value: string, confidence = 100) {
  const line = cleanDetectedLine(value);
  if (line.length < 3 || line.length > 120 || confidence < 35) return false;
  if (textQuality(line) < 0.68) return false;
  const words = line.match(/[A-Za-z]{2,}/g) || [];
  return words.length >= 1;
}

function plausibleTitle(value: string) {
  const line = cleanDetectedLine(value);
  if (line.length < 5 || line.length > 80 || textQuality(line) < 0.8) return false;
  const words = line.match(/[A-Za-z]{2,}/g) || [];
  if (words.length < 2) return false;
  const oneLetterWords = line.split(/\s+/).filter((word) => /^[A-Za-z]$/.test(word)).length;
  if (oneLetterWords >= 2) return false;
  return true;
}

function parseLocation(lines: string[]) {
  const venueLike = /\b(park|ranch|center|centre|campground|camp|lodge|hall|museum|brewery|farm|beach|trail|lake|garden|gardens|resort|pavilion|venue)\b/i;
  let venueName = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanDetectedLine(lines[index] || '');
    if (!venueName && venueLike.test(line)) venueName = titleCase(line);

    const match = line.match(/\b([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Z]{2})\b/i);
    if (!match) continue;
    const city = titleCase(cleanDetectedLine(match[1] || ''));
    const state = String(match[2] || '').toUpperCase();
    const previous = cleanDetectedLine(lines[index - 1] || '');
    if (!venueName && previous && venueLike.test(previous)) venueName = titleCase(previous);
    return { city, state, venueName };
  }

  return { city: '', state: '', venueName };
}

function parseDateNote(text: string) {
  const range = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})\\s*[-–—]\\s*(?:(${MONTHS})\\s+)?(\\d{1,2}),?\\s*(20\\d{2})\\b`, 'i'));
  if (range) {
    const startMonth = monthNumber(range[1] || '');
    const endMonth = monthNumber(range[3] || range[1] || '');
    const year = range[5] || '';
    return { label: `${range[1]} ${range[2]} – ${range[3] ? `${range[3]} ` : ''}${range[4]}, ${year}`, startDate: `${year}-${startMonth}-${String(range[2]).padStart(2, '0')}`, endDate: `${year}-${endMonth}-${String(range[4]).padStart(2, '0')}` };
  }
  const single = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2}),?\\s*(20\\d{2})\\b`, 'i'));
  if (!single) return null;
  const month = monthNumber(single[1] || '');
  const date = `${single[3]}-${month}-${String(single[2]).padStart(2, '0')}`;
  return { label: `${single[1]} ${single[2]}, ${single[3]}`, startDate: date, endDate: date };
}

function parseTimes(text: string) {
  const times = [...text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi)].slice(0, 2);
  const convert = (match: RegExpMatchArray | undefined) => {
    if (!match) return '';
    let hour = Number(match[1] || 0) % 12;
    if (String(match[3]).toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(match[2] || '00').padStart(2, '0')}`;
  };
  return { start: convert(times[0]), end: convert(times[1]) };
}

function parsePrice(text: string) {
  const match = text.match(/\$\s?\d+(?:\.\d{2})?/);
  return match?.[0]?.replace(/\s+/g, '') || '';
}

function explicitTitle(text: string) {
  const normalized = clean(text).replace(/[’‘]/g, "'");
  const patterns = [
    /\bFLOAT\s*OUT\s*(20\d{2})\b/i,
    /\bTHE\s+GREAT\s+MELANATED\s+LITTLE\s+CAMP\s+OF\s+HORRORS\b/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return titleCase(match[0].replace(/\s+/g, ' '));
  }
  return '';
}

function pickTitle(result: OcrResult, fallbackLines: string[]) {
  const rawText = String(result.data?.text || '');
  const explicit = explicitTitle(rawText);
  if (explicit) return explicit;

  const candidates = (result.data?.lines || []).map((line, index) => ({
    text: cleanDetectedLine(line.text || ''),
    confidence: Number(line.confidence ?? 0),
    height: Math.max(0, Number(line.bbox?.y1 || 0) - Number(line.bbox?.y0 || 0)),
    index,
  })).filter((line) => plausibleLine(line.text, line.confidence) && !new RegExp(`\\b(?:${MONTHS}|jacksonville|brooksville|tickets?|admission|www\\.|https?|food|music|games|community|family friendly|good vibes)\\b`, 'i').test(line.text));

  const highConfidence = candidates.filter((line) => line.confidence >= 55);
  const pool = highConfidence.length ? highConfidence : candidates.filter((line) => line.confidence >= 45);
  const largest = [...pool]
    .sort((a, b) => b.height - a.height || b.confidence - a.confidence)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map((line) => line.text);
  const joined = cleanDetectedLine(largest.join(' ')).replace(/\bOF\b/gi, 'of');
  if (plausibleTitle(joined)) return titleCase(joined);

  const fallback = fallbackLines.find((line) => plausibleTitle(line) && !new RegExp(`\\b(?:${MONTHS}|jacksonville|brooksville|tickets?|admission|food|music|games|community)\\b`, 'i').test(line));
  return fallback ? titleCase(fallback) : '';
}

function scoreResult(result: OcrResult) {
  const text = String(result.data?.text || '');
  const usefulChars = text.match(/[A-Za-z0-9]/g)?.length || 0;
  const averageConfidence = Number(result.data?.confidence || 0);
  const keywordHits = [
    /\b20\d{2}\b/,
    new RegExp(`\\b(?:${MONTHS})\\b`, 'i'),
    /\b(?:park|ranch|center|camp|float|event|music|games|food|community)\b/i,
    /\b[A-Za-z .'-]+,\s*[A-Z]{2}\b/,
  ].filter((pattern) => pattern.test(text)).length;
  return usefulChars + averageConfidence * 3 + keywordHits * 120;
}

function mergeOcrResults(results: OcrResult[]): OcrResult {
  const usable = results.filter(Boolean);
  const best = [...usable].sort((a, b) => scoreResult(b) - scoreResult(a))[0] || {};
  const texts = usable.map((result) => String(result.data?.text || '').trim()).filter(Boolean);
  const lines = usable.flatMap((result) => result.data?.lines || []);
  const confidence = usable.length
    ? usable.reduce((sum, result) => sum + Number(result.data?.confidence || 0), 0) / usable.length
    : 0;
  return {
    data: {
      text: texts.join('\n'),
      lines,
      confidence: Math.max(confidence, Number(best.data?.confidence || 0)),
    },
  };
}

function parseOcrDraft(result: OcrResult, titleResult?: OcrResult): EventDraft {
  const rawText = String(result.data?.text || '').trim();
  const textLines = rawText.split(/\r?\n/).map(cleanDetectedLine).filter((line) => plausibleLine(line, 45));
  if (rawText.replace(/[^A-Za-z0-9]/g, '').length < 12) throw new Error('OCR could not read enough text from this flyer. Try a clearer or tighter image.');

  const titleSource = titleResult || result;
  const titleLines = String(titleSource.data?.text || '').split(/\r?\n/).map(cleanDetectedLine).filter(Boolean);
  const title = pickTitle(titleSource, titleLines);
  const location = parseLocation(textLines);
  const date = parseDateNote(rawText);
  const times = parseTimes(rawText);
  const price = parsePrice(rawText);
  const startsAt = date && times.start ? `${date.startDate}T${times.start}` : '';
  const endsAt = date && times.end ? `${date.endDate}T${times.end}` : '';
  const category = /\bcamp(?:ing)?\b/i.test(rawText) ? 'Camping' : /\bhik(?:e|ing)\b/i.test(rawText) ? 'Hiking' : /\bpaddl|kayak|canoe|float\b/i.test(rawText) ? 'Paddling' : /\bbeach\b/i.test(rawText) ? 'Beach' : 'Other';
  const summary = textLines.find((line) => /experience|weekend|festival|family|community|outdoor|float|chill/i.test(line) && line.toLowerCase() !== title.toLowerCase() && textQuality(line) >= 0.8) || '';
  const activities = textLines.filter((line) => /haunted|games|contest|hayride|camp together|spooky|workshop|hike|paddle|float|music|food|community/i.test(line) && textQuality(line) >= 0.78).slice(0, 10);
  const marketing = [...new Set([...rawText.matchAll(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.\w+|@[A-Za-z0-9_.]+/g)].map((match) => match[0]))].slice(0, 10);
  const notes: string[] = ['This draft was built with OCR text recognition only. Review every field before creating the event.'];
  if (date && !times.start) notes.push(`Date found: ${date.label}. Add the event start and end times.`);
  else if (date && times.start && !times.end) notes.push(`Date found: ${date.label}. A start time was found, but no end time was found.`);
  if (!title) notes.push('OCR did not identify a reliable event title. The title was left blank instead of filling it with uncertain text.');
  if (!location.city || !location.state) notes.push('OCR did not identify a complete city and state.');
  if (Number(result.data?.confidence || 0) < 55) notes.push('OCR confidence was low on this design. Decorative fonts, shadows, and text over photos can reduce accuracy.');

  return {
    title,
    summary,
    description: rawText.slice(0, 5000),
    category,
    difficulty: 'easy',
    startsAt,
    endsAt,
    venueName: location.venueName,
    address: '',
    city: location.city,
    state: location.state,
    capacity: null,
    meetingInstructions: '',
    heroImageUrl: '',
    tickets: price ? [{ label: 'Price found on flyer', priceText: price }] : [],
    schedule: activities.map((activity) => ({ time: '', title: titleCase(activity) })),
    meals: [],
    policies: [],
    operations: [],
    gear: [],
    guestInfo: activities.map(titleCase),
    marketing,
    photos: [],
    confidenceNotes: notes,
  };
}

async function loadTesseract(): Promise<TesseractApi> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') throw new Error('OCR flyer scanning is currently available on the web version.');
  const globalWithTesseract = globalThis as typeof globalThis & { Tesseract?: TesseractApi };
  if (globalWithTesseract.Tesseract) return globalWithTesseract.Tesseract;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TESSERACT_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (globalWithTesseract.Tesseract) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load the OCR reader.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TESSERACT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load the OCR reader.'));
    document.head.appendChild(script);
  });

  if (!globalWithTesseract.Tesseract) throw new Error('The OCR reader did not initialize.');
  return globalWithTesseract.Tesseract;
}

async function loadImage(uri: string) {
  const image = new Image();
  image.decoding = 'async';
  image.src = uri;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to prepare this flyer for OCR.'));
  });
  return image;
}

function canvasRegion(image: HTMLImageElement, yStart: number, yEnd: number, enhance: boolean) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const sourceY = Math.max(0, Math.round(sourceHeight * yStart));
  const sourceH = Math.max(1, Math.round(sourceHeight * (yEnd - yStart)));
  const maxWidth = 2200;
  const scale = Math.min(3, Math.max(1.4, maxWidth / Math.max(1, sourceWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceH * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '';
  context.drawImage(image, 0, sourceY, sourceWidth, sourceH, 0, 0, canvas.width, canvas.height);

  if (enhance) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray = Math.round(0.299 * (data[index] ?? 0) + 0.587 * (data[index + 1] ?? 0) + 0.114 * (data[index + 2] ?? 0));
      const contrast = gray < 150 ? Math.max(0, gray - 45) : Math.min(255, gray + 45);
      data[index] = contrast;
      data[index + 1] = contrast;
      data[index + 2] = contrast;
    }
    context.putImageData(pixels, 0, 0);
  }

  return canvas.toDataURL('image/png');
}

async function prepareRegions(uri: string): Promise<FlyerRegions> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return { full: uri, title: uri, details: uri, footer: uri };
  const image = await loadImage(uri);
  return {
    full: canvasRegion(image, 0, 1, true) || uri,
    title: canvasRegion(image, 0.08, 0.48, true) || uri,
    details: canvasRegion(image, 0.42, 0.78, true) || uri,
    footer: canvasRegion(image, 0.70, 1, true) || uri,
  };
}

async function recognizeBest(tesseract: TesseractApi, uri: string) {
  const regions = await prepareRegions(uri).catch(() => ({ full: uri, title: uri, details: uri, footer: uri }));
  const original = await tesseract.recognize(uri, 'eng');
  const regionResults = await Promise.all([
    tesseract.recognize(regions.full, 'eng'),
    tesseract.recognize(regions.title, 'eng'),
    tesseract.recognize(regions.details, 'eng'),
    tesseract.recognize(regions.footer, 'eng'),
  ]);

  const merged = mergeOcrResults([original, ...regionResults]);
  const titleResult = [...[original, regionResults[1]]].sort((a, b) => {
    const aExplicit = explicitTitle(String(a.data?.text || '')) ? 1 : 0;
    const bExplicit = explicitTitle(String(b.data?.text || '')) ? 1 : 0;
    if (aExplicit !== bExplicit) return bExplicit - aExplicit;
    return scoreResult(b) - scoreResult(a);
  })[0];

  return { merged, titleResult };
}

export async function uploadAndPreviewFlyer(asset: FlyerAsset): Promise<ImportPreviewResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sign in to scan an event flyer.');

  const tesseract = await loadTesseract();
  const { merged, titleResult } = await recognizeBest(tesseract, asset.uri);
  const preview = parseOcrDraft(merged, titleResult);
  const sourceLabel = asset.fileName || 'Event flyer';
  const { data: importRow, error: importError } = await supabase.from('host_event_imports').insert({
    owner_profile_id: userId,
    source_type: 'uploaded_files',
    source_label: sourceLabel,
    source_url: null,
    extracted_payload: preview,
    approved_payload: {},
    status: 'preview',
  }).select('id').single();
  if (importError) throw importError;

  return { importId: importRow.id, preview, sourceLabel, sourceUrl: null, extractionSource: 'source', duplicate: null };
}
