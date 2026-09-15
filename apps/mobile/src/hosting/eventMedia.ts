import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

const EVENT_MEDIA_BUCKET = 'event-media';

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('You must be signed in.');
  return profileId;
}

export async function uploadEventCover(input: {
  adventureId: string;
  localUri: string;
  base64?: string | null;
  altText?: string;
}) {
  const profileId = await currentProfileId();
  const prepared = await prepareLocalImage({ uri: input.localUri, base64: input.base64 });
  const fileName = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.extension}`;
  const path = `${profileId}/event-covers/${input.adventureId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(EVENT_MEDIA_BUCKET).upload(path, prepared.bytes, {
    contentType: prepared.contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path);
  const imageUrl = publicUrl.publicUrl;

  const { data: updated, error: updateError } = await supabase
    .from('adventures')
    .update({
      hero_image_url: imageUrl,
      hero_alt_text: input.altText?.trim() || null,
    })
    .eq('id', input.adventureId)
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    await supabase.storage.from(EVENT_MEDIA_BUCKET).remove([path]).catch(() => undefined);
    if (updateError) throw updateError;
    throw new Error('You do not have permission to update this event cover.');
  }

  return imageUrl;
}
