import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

const EVENT_MEDIA_BUCKET = 'adventure-photos';
const EVENT_COVER_TTL_SECONDS = 60 * 60 * 24 * 365;

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('You must be signed in.');
  return profileId;
}

export async function uploadEventCover(input: {
  adventureId: string;
  localUri: string;
  altText?: string;
}) {
  const profileId = await currentProfileId();
  const prepared = await prepareLocalImage({ uri: input.localUri });
  const fileName = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.extension}`;
  const path = `${profileId}/event-covers/${input.adventureId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(EVENT_MEDIA_BUCKET).upload(path, prepared.bytes, {
    contentType: prepared.contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: signed, error: signedError } = await supabase.storage
    .from(EVENT_MEDIA_BUCKET)
    .createSignedUrl(path, EVENT_COVER_TTL_SECONDS);
  if (signedError) {
    await supabase.storage.from(EVENT_MEDIA_BUCKET).remove([path]).catch(() => undefined);
    throw signedError;
  }

  const { error: updateError } = await supabase
    .from('adventures')
    .update({
      hero_image_url: signed.signedUrl,
      hero_alt_text: input.altText?.trim() || null,
    })
    .eq('id', input.adventureId)
    .eq('created_by', profileId);

  if (updateError) {
    await supabase.storage.from(EVENT_MEDIA_BUCKET).remove([path]).catch(() => undefined);
    throw updateError;
  }

  return signed.signedUrl;
}
