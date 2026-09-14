import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';
import {
  assertHostOrganizationInActiveTenant,
  requireActiveOrganizationId,
  tenantStoragePath,
} from '../platform/tenantScope';

const HOST_MEDIA_BUCKET = 'adventure-photos';
const PROFILE_IMPORT_BUCKET = 'event-imports';
const MAX_IMPORT_FILES = 8;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type HostType = 'individual' | 'business' | 'organization' | 'nonprofit' | 'community' | 'venue' | 'creator' | 'other';
export type HostSetupStage = 'profile' | 'about' | 'media' | 'brand' | 'features' | 'preview' | 'complete';

export type HostProfileSetupData = {
  organizationId: string;
  hostType: HostType;
  shortDescription: string | null;
  serviceAreas: string[];
  audiences: string[];
  languages: string[];
  accessibility: string | null;
  foundedYear: number | null;
  setupStage: HostSetupStage;
  setupCompletedAt: string | null;
  profileSectionOrder: string[];
  contactVisibility: {
    email: boolean;
    phone: boolean;
    website: boolean;
    socials: boolean;
  };
};

export type OrganizationGalleryPhoto = {
  id: string;
  imageUrl: string;
  caption: string | null;
  altText: string | null;
  sortOrder: number;
  isFeatured: boolean;
};

export type HostProfileImportPreview = {
  name: string;
  hostType: HostType | '';
  tagline: string;
  shortDescription: string;
  description: string;
  city: string;
  state: string;
  websiteUrl: string;
  publicEmail: string;
  phone: string;
  instagramUrl: string;
  facebookUrl: string;
  specialties: string[];
  serviceAreas: string[];
  audiences: string[];
  languages: string[];
  accessibility: string;
  foundedYear: number | null;
  confidenceNotes: string[];
};

export type HostProfileImportResult = {
  importId: string;
  sourceLabel: string;
  extractionSource: 'ai' | 'source' | 'fallback';
  preview: HostProfileImportPreview;
};

export type HostProfileImportAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type HostProfileCompletionInput = {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  city?: string | null;
  state?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  specialties?: string[];
  galleryCount?: number;
  serviceAreas?: string[];
};

export type HostProfileCompletion = {
  percent: number;
  complete: number;
  total: number;
  missing: string[];
};

const SETUP_COLUMNS = 'id,host_type,short_description,service_areas,audiences,languages,accessibility,founded_year,setup_stage,setup_completed_at,profile_section_order,contact_visibility';

async function currentProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('You must be signed in.');
  return data.user.id;
}

function normalizeContactVisibility(value: unknown): HostProfileSetupData['contactVisibility'] {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    email: raw.email !== false,
    phone: raw.phone === true,
    website: raw.website !== false,
    socials: raw.socials !== false,
  };
}

function normalizeSetup(row: any): HostProfileSetupData {
  return {
    organizationId: row.id,
    hostType: (row.host_type || 'organization') as HostType,
    shortDescription: row.short_description ?? null,
    serviceAreas: Array.isArray(row.service_areas) ? row.service_areas : [],
    audiences: Array.isArray(row.audiences) ? row.audiences : [],
    languages: Array.isArray(row.languages) ? row.languages : [],
    accessibility: row.accessibility ?? null,
    foundedYear: Number.isFinite(Number(row.founded_year)) ? Number(row.founded_year) : null,
    setupStage: (row.setup_stage || 'profile') as HostSetupStage,
    setupCompletedAt: row.setup_completed_at ?? null,
    profileSectionOrder: Array.isArray(row.profile_section_order) ? row.profile_section_order : ['about','events','photos','history','team','faq','policies','contact'],
    contactVisibility: normalizeContactVisibility(row.contact_visibility),
  };
}

export async function getHostProfileSetup(organizationId: string): Promise<HostProfileSetupData> {
  const { data, error } = await supabase.from('host_organizations').select(SETUP_COLUMNS).eq('id', organizationId).single();
  if (error) throw error;
  return normalizeSetup(data);
}

export async function updateHostProfileSetup(organizationId: string, input: Partial<Omit<HostProfileSetupData, 'organizationId'>>) {
  const { platformOrganizationId } = await assertHostOrganizationInActiveTenant(organizationId);
  const payload: Record<string, unknown> = {};
  if (input.hostType !== undefined) payload.host_type = input.hostType;
  if (input.shortDescription !== undefined) payload.short_description = input.shortDescription?.trim() || null;
  if (input.serviceAreas !== undefined) payload.service_areas = input.serviceAreas.map((value) => value.trim()).filter(Boolean);
  if (input.audiences !== undefined) payload.audiences = input.audiences.map((value) => value.trim()).filter(Boolean);
  if (input.languages !== undefined) payload.languages = input.languages.map((value) => value.trim()).filter(Boolean);
  if (input.accessibility !== undefined) payload.accessibility = input.accessibility?.trim() || null;
  if (input.foundedYear !== undefined) payload.founded_year = input.foundedYear;
  if (input.setupStage !== undefined) payload.setup_stage = input.setupStage;
  if (input.setupCompletedAt !== undefined) payload.setup_completed_at = input.setupCompletedAt;
  if (input.profileSectionOrder !== undefined) payload.profile_section_order = input.profileSectionOrder;
  if (input.contactVisibility !== undefined) payload.contact_visibility = input.contactVisibility;
  const { data, error } = await supabase.from('host_organizations').update(payload).eq('id', organizationId).eq('platform_organization_id', platformOrganizationId).select(SETUP_COLUMNS).single();
  if (error) throw error;
  return normalizeSetup(data);
}

export function calculateHostProfileCompletion(input: HostProfileCompletionInput): HostProfileCompletion {
  const checks = [
    { ok: Boolean(input.name?.trim()), label: 'Add your public host name' },
    { ok: Boolean(input.tagline?.trim()), label: 'Add a tagline' },
    { ok: Boolean(input.shortDescription?.trim()), label: 'Add a short description' },
    { ok: Boolean(input.description?.trim()), label: 'Add your About section' },
    { ok: Boolean(input.city?.trim() || input.serviceAreas?.length), label: 'Add a location or service area' },
    { ok: Boolean(input.logoUrl), label: 'Upload a logo or profile image' },
    { ok: Boolean(input.coverImageUrl), label: 'Upload a cover image' },
    { ok: (input.galleryCount ?? 0) >= 3, label: 'Add at least 3 gallery photos' },
    { ok: Boolean(input.websiteUrl?.trim()), label: 'Add your website' },
    { ok: (input.specialties?.length ?? 0) > 0, label: 'Add at least one specialty' },
  ];
  const complete = checks.filter((item) => item.ok).length;
  return {
    percent: Math.round((complete / checks.length) * 100),
    complete,
    total: checks.length,
    missing: checks.filter((item) => !item.ok).map((item) => item.label),
  };
}

async function signMediaPath(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from(HOST_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return path;
  return data.signedUrl;
}

export async function listOrganizationGallery(organizationId: string): Promise<OrganizationGalleryPhoto[]> {
  const { data, error } = await supabase
    .from('host_media')
    .select('id,image_url,caption,alt_text,sort_order,is_featured')
    .eq('organization_id', organizationId)
    .is('adventure_id', null)
    .eq('kind', 'gallery')
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Promise.all((data ?? []).map(async (row: any) => ({
    id: row.id,
    imageUrl: await signMediaPath(row.image_url),
    caption: row.caption ?? null,
    altText: row.alt_text ?? null,
    sortOrder: row.sort_order ?? 0,
    isFeatured: row.is_featured === true,
  })));
}

export async function uploadOrganizationGalleryPhoto(input: { organizationId: string; localUri: string; caption?: string; altText?: string; featured?: boolean }) {
  const [profileId, tenant] = await Promise.all([currentProfileId(), assertHostOrganizationInActiveTenant(input.organizationId)]);
  const prepared = await prepareLocalImage({ uri: input.localUri });
  const { count } = await supabase.from('host_media').select('id', { count: 'exact', head: true }).eq('organization_id', input.organizationId).is('adventure_id', null).eq('kind', 'gallery');
  const fileName = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${prepared.extension}`;
  const path = tenantStoragePath(tenant.platformOrganizationId, 'host-profiles', input.organizationId, 'gallery', profileId, fileName);
  const { error: uploadError } = await supabase.storage.from(HOST_MEDIA_BUCKET).upload(path, prepared.bytes, { contentType: prepared.contentType, cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  try {
    if (input.featured) await supabase.from('host_media').update({ is_featured: false }).eq('organization_id', input.organizationId).is('adventure_id', null).eq('kind', 'gallery');
    const { data, error } = await supabase.from('host_media').insert({
      owner_profile_id: profileId,
      organization_id: input.organizationId,
      adventure_id: null,
      kind: 'gallery',
      image_url: path,
      caption: input.caption?.trim() || null,
      alt_text: input.altText?.trim() || null,
      sort_order: count ?? 0,
      is_featured: input.featured === true,
    }).select('id').single();
    if (error) throw error;
    return data.id as string;
  } catch (error) {
    await supabase.storage.from(HOST_MEDIA_BUCKET).remove([path]);
    throw error;
  }
}

export async function updateOrganizationGalleryPhoto(photoId: string, input: { caption?: string | null; altText?: string | null; isFeatured?: boolean; sortOrder?: number }) {
  const { data: current, error: currentError } = await supabase.from('host_media').select('organization_id').eq('id', photoId).single();
  if (currentError) throw currentError;
  if (!current.organization_id) throw new Error('This gallery photo is not attached to a host profile.');
  await assertHostOrganizationInActiveTenant(current.organization_id);

  const payload: Record<string, unknown> = {};
  if (input.caption !== undefined) payload.caption = input.caption?.trim() || null;
  if (input.altText !== undefined) payload.alt_text = input.altText?.trim() || null;
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
  if (input.isFeatured !== undefined) {
    if (input.isFeatured) {
      await supabase.from('host_media').update({ is_featured: false }).eq('organization_id', current.organization_id).is('adventure_id', null).eq('kind', 'gallery');
    }
    payload.is_featured = input.isFeatured;
  }
  const { error } = await supabase.from('host_media').update(payload).eq('id', photoId).eq('organization_id', current.organization_id);
  if (error) throw error;
}

export async function deleteOrganizationGalleryPhoto(photoId: string) {
  const { data, error } = await supabase.from('host_media').select('image_url,organization_id').eq('id', photoId).single();
  if (error) throw error;
  if (!data.organization_id) throw new Error('This gallery photo is not attached to a host profile.');
  await assertHostOrganizationInActiveTenant(data.organization_id);
  const deleteResult = await supabase.from('host_media').delete().eq('id', photoId).eq('organization_id', data.organization_id);
  if (deleteResult.error) throw deleteResult.error;
  if (data.image_url && !/^https?:\/\//i.test(data.image_url)) await supabase.storage.from(HOST_MEDIA_BUCKET).remove([data.image_url]);
}

function safeImportName(name: string) {
  const clean = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return clean.slice(0, 120) || 'profile-source';
}

export function validateHostProfileImportAssets(files: HostProfileImportAsset[]) {
  if (!files.length) throw new Error('Choose at least one profile source file.');
  if (files.length > MAX_IMPORT_FILES) throw new Error(`Choose up to ${MAX_IMPORT_FILES} files at a time.`);
  for (const file of files) {
    if (file.size != null && file.size > MAX_IMPORT_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  }
}

export async function previewHostProfileImport(input: {
  organizationId: string;
  mode: 'files' | 'website' | 'pasted_text';
  files?: HostProfileImportAsset[];
  sourceUrl?: string;
  sourceText?: string;
}): Promise<HostProfileImportResult> {
  const profileId = await currentProfileId();
  const tenant = await assertHostOrganizationInActiveTenant(input.organizationId);
  const uploadedPaths: string[] = [];
  const requestBody: Record<string, unknown> = {
    organizationId: input.organizationId,
    platformOrganizationId: tenant.platformOrganizationId,
    mode: input.mode,
    sourceUrl: input.sourceUrl?.trim() || null,
    sourceText: input.sourceText?.trim() || null,
  };

  try {
    if (input.mode === 'files') {
      const files = input.files ?? [];
      validateHostProfileImportAssets(files);
      const sessionId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const uploaded: Array<{ path: string; name: string; mimeType: string; size: number }> = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        const response = await fetch(file.uri);
        if (!response.ok) throw new Error(`Unable to read ${file.name} from this device.`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
        const path = tenantStoragePath(tenant.platformOrganizationId, 'host-profiles', input.organizationId, 'imports', profileId, sessionId, `${String(index + 1).padStart(2, '0')}-${safeImportName(file.name)}`);
        const mimeType = file.mimeType || response.headers.get('content-type') || 'application/octet-stream';
        const { error } = await supabase.storage.from(PROFILE_IMPORT_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
        uploaded.push({ path, name: file.name, mimeType, size: bytes.byteLength });
      }
      requestBody.files = uploaded;
    }

    const { data, error } = await supabase.functions.invoke('host-profile-import-preview', { body: requestBody });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data as HostProfileImportResult;
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(PROFILE_IMPORT_BUCKET).remove(uploadedPaths);
    throw error;
  }
}

export async function markHostProfileImportApplied(importId: string, approvedPayload: Record<string, unknown>) {
  const platformOrganizationId = await requireActiveOrganizationId();
  const { error } = await supabase.from('host_profile_imports').update({ approved_payload: approvedPayload, status: 'applied', applied_at: new Date().toISOString() }).eq('id', importId).eq('platform_organization_id', platformOrganizationId);
  if (error) throw error;
}

export async function markHostProfileImportDiscarded(importId: string) {
  const platformOrganizationId = await requireActiveOrganizationId();
  const { error } = await supabase.from('host_profile_imports').update({ status: 'discarded' }).eq('id', importId).eq('platform_organization_id', platformOrganizationId);
  if (error) throw error;
}
