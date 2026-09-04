import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';
import type { EventDraft, ImportPreviewResult } from './creation';

export type FlyerAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

type OcrLine = { text?: string; bbox?: { y0?: number; y1?: number } };
type OcrResult = { data?: { text?: string; lines?: OcrLine[] } };
type TesseractApi = { recognize: (image: string, language: string, options?: Record<string, unknown>) => Promise<OcrResult> };

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

function clean(value: string) {
  return value.replace(/[|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function monthNumber(value: string) {
  const months: Record<string, string> = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
  return months[value.toLowerCase()] || '';
}

function parseLocation(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^([A-Za-z .'-]+),\s*([A-Z]{2})$/i);
    if (!match) continue;
    const city = titleCase(clean(match[1] || ''));
    const state = String(match[2] || '').toUpperCase();
    const previous = clean(lines[index - 1] || '');
    const venueName = previous && !/\b(?:october|november|december|january|february|march|april|may|june|july|august|september)\b/i.test(previous) ? titleCase(previous) : '';
    return { city, state, venueName };
  }
  return { city: '', state: '', venueName: '' };
}

function parseDateNote(text: string) {
  const range = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–—]\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2}),?\s*(20\d{2})\b/i);
  if (range) {
    const startMonth = monthNumber(range[1] || '');
    const endMonth = monthNumber(range[3] || range[1] || '');
    const year = range[5] || '';
    return { label: `${range[1]} ${range[2]} – ${range[3] ? `${range[3]} ` : ''}${range[4]}, ${year}`, startDate: `${year}-${startMonth}-${String(range[2]).padStart(2, '0')}`, endDate: `${year}-${endMonth}-${String(range[4]).padStart(2, '0')}` };
  }
  const single = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(20\d{2})\b/i);
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

function pickTitle(lines: OcrLine[], fallbackLines: string[]) {
  const candidates = lines.map((line, index) => ({
    text: clean(line.text || ''),
    height: Math.max(0, Number(line.bbox?.y1 || 0) - Number(line.bbox?.y0 || 0)),
    index,
  })).filter((line) => line.text.length >= 3 && /[A-Za-z]/.test(line.text) && !/\b(?:october|november|december|january|february|march|april|may|june|july|august|september|brooksville|tickets?|admission|www\.|https?)\b/i.test(line.text));

  const largest = [...candidates].sort((a, b) => b.height - a.height).slice(0, 4).sort((a, b) => a.index - b.index).map((line) => line.text);
  const joined = clean(largest.join(' ')).replace(/\bOF\b/gi, 'of');
  if (joined.length >= 5 && joined.length <= 120) return titleCase(joined);

  const fallback = fallbackLines.find((line) => line.length >= 5 && line.length <= 100 && /[A-Za-z]/.test(line) && !/\b(?:october|november|brooksville|tickets?|admission)\b/i.test(line));
  return fallback ? titleCase(fallback) : '';
}

function parseOcrDraft(result: OcrResult): EventDraft {
  const rawText = String(result.data?.text || '').trim();
  const textLines = rawText.split(/\r?\n/).map(clean).filter(Boolean);
  const lines = Array.isArray(result.data?.lines) ? result.data?.lines || [] : [];
  if (rawText.replace(/[^A-Za-z0-9]/g, '').length < 12) throw new Error('OCR could not read enough text from this flyer. Try a clearer or tighter image.');

  const title = pickTitle(lines, textLines);
  const location = parseLocation(textLines);
  const date = parseDateNote(rawText);
  const times = parseTimes(rawText);
  const price = parsePrice(rawText);
  const startsAt = date && times.start ? `${date.startDate}T${times.start}` : '';
  const endsAt = date && times.end ? `${date.endDate}T${times.end}` : '';
  const category = /\bcamp(?:ing)?\b/i.test(rawText) ? 'Camping' : /\bhik(?:e|ing)\b/i.test(rawText) ? 'Hiking' : /\bpaddl|kayak|canoe\b/i.test(rawText) ? 'Paddling' : /\bbeach\b/i.test(rawText) ? 'Beach' : 'Other';
  const summary = textLines.find((line) => /experience|weekend|festival|family|community|outdoor/i.test(line) && line.toLowerCase() !== title.toLowerCase()) || '';
  const activities = textLines.filter((line) => /haunted|games|contest|hayride|camp together|spooky|workshop|hike|paddle|music/i.test(line)).slice(0, 10);
  const marketing = [...new Set([...rawText.matchAll(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.\w+|@[A-Za-z0-9_.]+/g)].map((match) => match[0]))].slice(0, 10);
  const notes: string[] = ['This draft was built with OCR text recognition only. Review every field before creating the event.'];
  if (date && !times.start) notes.push(`Date found: ${date.label}. Add the event start and end times.`);
  else if (date && times.start && !times.end) notes.push(`Date found: ${date.label}. A start time was found, but no end time was found.`);
  if (!title) notes.push('OCR did not identify a reliable event title.');
  if (!location.city || !location.state) notes.push('OCR did not identify a complete city and state.');

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

export async function uploadAndPreviewFlyer(asset: FlyerAsset): Promise<ImportPreviewResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sign in to scan an event flyer.');

  const tesseract = await loadTesseract();
  const result = await tesseract.recognize(asset.uri, 'eng');
  const preview = parseOcrDraft(result);
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
