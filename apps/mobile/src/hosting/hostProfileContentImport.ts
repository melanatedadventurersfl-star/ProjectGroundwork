import { supabase } from '../lib/supabase';
import { assertHostOrganizationInActiveTenant, tenantStoragePath } from '../platform/tenantScope';
import { getHostOrganization, updateHostOrganization } from './hostProfiles';

const PROFILE_IMPORT_BUCKET = 'event-imports';
const MAX_IMPORT_FILES = 8;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type HostContentImportTarget = 'faq' | 'policies';
export type HostContentImportMode = 'files' | 'website' | 'pasted_text';
export type HostContentMergeMode = 'append' | 'merge' | 'replace';
export type HostContentScope = 'host' | 'event' | 'mixed' | 'unknown';

export type HostContentImportAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type ImportedFAQ = {
  id: string;
  question: string;
  answer: string;
  category: string;
  displayOrder: number | null;
  publish: boolean;
  sourceLabel: string;
};

export type ImportedPolicy = {
  id: string;
  policyType: string;
  title: string;
  body: string;
  appliesTo: 'host' | 'event' | 'unknown';
  effectiveDate: string;
  publish: boolean;
  sourceLabel: string;
};

export type HostContentImportResult = {
  importId: string;
  target: HostContentImportTarget;
  sourceLabel: string;
  sourceUrl?: string | null;
  extractionSource: 'ai' | 'source' | 'fallback';
  extractionMessage: string;
  scope: HostContentScope;
  scopeConfidence: number;
  scopeReasons: string[];
  eventHandoffRecommended: boolean;
  confidenceNotes: string[];
  items: Array<ImportedFAQ | ImportedPolicy>;
};

function safeImportName(name: string) {
  const clean = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return clean.slice(0, 120) || 'content-source';
}

function normalizeMimeType(name: string, supplied?: string | null, responseType?: string | null) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.csv')) return 'text/plain';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  const candidate = supplied || responseType || 'application/octet-stream';
  return candidate === 'application/vnd.ms-excel' ? 'text/plain' : candidate;
}

async function currentProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('You must be signed in.');
  return data.user.id;
}

export function validateHostContentImportAssets(files: HostContentImportAsset[]) {
  if (!files.length) throw new Error('Choose at least one source file.');
  if (files.length > MAX_IMPORT_FILES) throw new Error(`Choose up to ${MAX_IMPORT_FILES} files at a time.`);
  for (const file of files) {
    if (file.size != null && file.size > MAX_IMPORT_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  }
}

export async function previewHostContentImport(input: {
  organizationId: string;
  target: HostContentImportTarget;
  mode: HostContentImportMode;
  files?: HostContentImportAsset[];
  sourceUrl?: string;
  sourceText?: string;
}): Promise<HostContentImportResult> {
  const profileId = await currentProfileId();
  const tenant = await assertHostOrganizationInActiveTenant(input.organizationId);
  const uploadedPaths: string[] = [];
  const requestBody: Record<string, unknown> = {
    organizationId: input.organizationId,
    platformOrganizationId: tenant.platformOrganizationId,
    target: input.target,
    mode: input.mode,
    sourceUrl: input.sourceUrl?.trim() || null,
    sourceText: input.sourceText?.trim() || null,
  };

  try {
    if (input.mode === 'files') {
      const files = input.files ?? [];
      validateHostContentImportAssets(files);
      const sessionId = `content-${input.target}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const uploaded: Array<{ path: string; name: string; mimeType: string; size: number }> = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        const response = await fetch(file.uri);
        if (!response.ok) throw new Error(`Unable to read ${file.name} from this device.`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
        const path = tenantStoragePath(
          tenant.platformOrganizationId,
          'host-profiles',
          input.organizationId,
          'imports',
          profileId,
          sessionId,
          `${String(index + 1).padStart(2, '0')}-${safeImportName(file.name)}`,
        );
        const mimeType = normalizeMimeType(file.name, file.mimeType, response.headers.get('content-type'));
        const { error } = await supabase.storage.from(PROFILE_IMPORT_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
        uploaded.push({ path, name: file.name, mimeType, size: bytes.byteLength });
      }
      requestBody.files = uploaded;
    }

    const { data, error } = await supabase.functions.invoke('host-profile-content-import-preview', { body: requestBody });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data as HostContentImportResult;
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(PROFILE_IMPORT_BUCKET).remove(uploadedPaths);
    throw error;
  }
}

function key(value: string) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function markContentDuplicates(
  target: HostContentImportTarget,
  items: Array<ImportedFAQ | ImportedPolicy>,
  existing: Array<{ question: string; answer: string }> | Array<{ title: string; body: string }>,
) {
  const existingKeys = new Set(existing.map((item: any) => key(target === 'faq' ? item.question : item.title)));
  return items.map((item: any) => ({ ...item, duplicate: existingKeys.has(key(target === 'faq' ? item.question : item.title)) }));
}

export async function applyHostContentImport(input: {
  organizationId: string;
  importId: string;
  target: HostContentImportTarget;
  items: Array<ImportedFAQ | ImportedPolicy>;
  mergeMode: HostContentMergeMode;
}) {
  const tenant = await assertHostOrganizationInActiveTenant(input.organizationId);
  const org = await getHostOrganization(input.organizationId);

  let approvedPayload: Record<string, unknown>;
  if (input.target === 'faq') {
    const incoming = (input.items as ImportedFAQ[]).filter((item) => item.publish && item.question.trim() && item.answer.trim());
    const existing = org.faq ?? [];
    let next: any[];
    if (input.mergeMode === 'replace') next = incoming;
    else if (input.mergeMode === 'append') {
      const existingKeys = new Set(existing.map((item) => key(item.question)));
      next = [...existing, ...incoming.filter((item) => !existingKeys.has(key(item.question)))];
    } else {
      const byQuestion = new Map(existing.map((item) => [key(item.question), item]));
      for (const item of incoming) byQuestion.set(key(item.question), item);
      next = [...byQuestion.values()];
    }
    await updateHostOrganization(input.organizationId, { faq: next });
    approvedPayload = { target: input.target, mergeMode: input.mergeMode, faq: incoming };
  } else {
    const incoming = (input.items as ImportedPolicy[]).filter((item) => item.publish && item.title.trim() && item.body.trim());
    const existing = org.policies ?? [];
    let next: any[];
    if (input.mergeMode === 'replace') next = incoming;
    else if (input.mergeMode === 'append') {
      const existingKeys = new Set(existing.map((item) => key(item.title)));
      next = [...existing, ...incoming.filter((item) => !existingKeys.has(key(item.title)))];
    } else {
      const byTitle = new Map(existing.map((item) => [key(item.title), item]));
      for (const item of incoming) byTitle.set(key(item.title), item);
      next = [...byTitle.values()];
    }
    await updateHostOrganization(input.organizationId, { policies: next });
    approvedPayload = { target: input.target, mergeMode: input.mergeMode, policies: incoming };
  }

  const { error } = await supabase.from('host_profile_imports').update({
    approved_payload: approvedPayload,
    status: 'applied',
    applied_at: new Date().toISOString(),
  }).eq('id', input.importId).eq('platform_organization_id', tenant.platformOrganizationId);
  if (error) throw error;
}

export async function discardHostContentImport(importId: string, organizationId: string) {
  const tenant = await assertHostOrganizationInActiveTenant(organizationId);
  const { error } = await supabase.from('host_profile_imports').update({ status: 'discarded' }).eq('id', importId).eq('platform_organization_id', tenant.platformOrganizationId);
  if (error) throw error;
}

export function faqTemplateCsv() {
  return [
    ['Category','Question','Answer','Display order','Publish'],
    ['General','What should guests know before attending?','Add the public answer here.','1','Yes'],
  ].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function policyTemplateCsv() {
  return [
    ['Policy type','Title','Policy text','Applies to','Effective date','Publish'],
    ['Refunds','Refund policy','Add the exact public policy wording here.','Host','','Yes'],
  ].map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
