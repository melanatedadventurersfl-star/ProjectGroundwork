import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getHostOrganization,
  updateHostOrganization,
  uploadOrganizationCover,
  uploadOrganizationLogo,
  type HostOrganization,
} from '../../../src/hosting/hostProfiles';
import {
  calculateHostProfileCompletion,
  deleteOrganizationGalleryPhoto,
  getHostProfileSetup,
  listOrganizationGallery,
  markHostProfileImportApplied,
  markHostProfileImportDiscarded,
  previewHostProfileImport,
  updateHostProfileSetup,
  updateOrganizationGalleryPhoto,
  uploadOrganizationGalleryPhoto,
  type HostProfileImportPreview,
  type HostProfileSetupData,
  type HostSetupStage,
  type HostType,
  type OrganizationGalleryPhoto,
} from '../../../src/hosting/hostProfileSetup';

const C = { bg:'#0A0F0C', panel:'#131B16', raised:'#19231C', line:'#2D3A32', cream:'#FFF8E8', muted:'#95A29A', dim:'#6F7D75', gold:'#D7B45A', green:'#7CCB92', red:'#E8A09A' };
const STEPS: { key: Exclude<HostSetupStage,'complete'>; label: string }[] = [
  { key:'profile', label:'Profile' },
  { key:'about', label:'About' },
  { key:'media', label:'Media' },
  { key:'brand', label:'Brand' },
  { key:'features', label:'Features' },
  { key:'preview', label:'Preview' },
];
const HOST_TYPES: { key: HostType; label: string }[] = [
  { key:'individual', label:'Individual host' }, { key:'business', label:'Business' }, { key:'organization', label:'Organization' },
  { key:'nonprofit', label:'Nonprofit' }, { key:'community', label:'Community' }, { key:'venue', label:'Venue' },
  { key:'creator', label:'Creator' }, { key:'other', label:'Other' },
];
const DEFAULT_ORDER = ['about','events','photos','history','team','faq','policies','contact'];
const SECTION_LABELS: Record<string,string> = { about:'About', events:'Upcoming events', photos:'Photos', history:'Hosting history', team:'Team', faq:'FAQ', policies:'Policies', contact:'Contact' };
const IMPORT_FIELDS: { key: keyof HostProfileImportPreview; label: string }[] = [
  { key:'name', label:'Name' }, { key:'hostType', label:'Host type' }, { key:'tagline', label:'Tagline' }, { key:'shortDescription', label:'Short description' },
  { key:'description', label:'About' }, { key:'city', label:'City' }, { key:'state', label:'State' }, { key:'websiteUrl', label:'Website' },
  { key:'publicEmail', label:'Public email' }, { key:'phone', label:'Phone' }, { key:'instagramUrl', label:'Instagram' }, { key:'facebookUrl', label:'Facebook' },
  { key:'specialties', label:'Specialties' }, { key:'serviceAreas', label:'Service areas' }, { key:'audiences', label:'Audiences' }, { key:'languages', label:'Languages' },
  { key:'accessibility', label:'Accessibility' }, { key:'foundedYear', label:'Founded year' },
];

type SmartImportResult = {
  importId: string;
  sourceLabel: string;
  extractionSource: string;
  extractionMessage?: string;
  documentType?: 'host_profile' | 'event' | 'vendor' | 'venue' | 'brand_kit' | 'unknown';
  documentTypeConfidence?: number;
  documentTypeReasons?: string[];
  eventHandoffRecommended?: boolean;
  preview: HostProfileImportPreview;
};

export default function HostOrganizationProfileEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [org,setOrg] = useState<HostOrganization|null>(null);
  const [setup,setSetup] = useState<HostProfileSetupData|null>(null);
  const [gallery,setGallery] = useState<OrganizationGalleryPhoto[]>([]);
  const [step,setStep] = useState<Exclude<HostSetupStage,'complete'>>('profile');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [saved,setSaved] = useState('');

  const [name,setName] = useState('');
  const [hostType,setHostType] = useState<HostType>('organization');
  const [tagline,setTagline] = useState('');
  const [shortDescription,setShortDescription] = useState('');
  const [description,setDescription] = useState('');
  const [city,setCity] = useState('');
  const [state,setState] = useState('');
  const [serviceAreas,setServiceAreas] = useState('');
  const [website,setWebsite] = useState('');
  const [email,setEmail] = useState('');
  const [phone,setPhone] = useState('');
  const [instagram,setInstagram] = useState('');
  const [facebook,setFacebook] = useState('');
  const [specialties,setSpecialties] = useState('');
  const [audiences,setAudiences] = useState('');
  const [languages,setLanguages] = useState('');
  const [accessibility,setAccessibility] = useState('');
  const [foundedYear,setFoundedYear] = useState('');
  const [isPublic,setIsPublic] = useState(false);
  const [sectionOrder,setSectionOrder] = useState<string[]>(DEFAULT_ORDER);
  const [contactVisibility,setContactVisibility] = useState({ email:true, phone:false, website:true, socials:true });

  const [importMode,setImportMode] = useState<'files'|'website'|'pasted_text'>('files');
  const [importFiles,setImportFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [importUrl,setImportUrl] = useState('');
  const [importText,setImportText] = useState('');
  const [importBusy,setImportBusy] = useState(false);
  const [importResult,setImportResult] = useState<SmartImportResult|null>(null);
  const [selectedImportFields,setSelectedImportFields] = useState<(keyof HostProfileImportPreview)[]>([]);

  const hydrate = useCallback((nextOrg:HostOrganization,nextSetup:HostProfileSetupData) => {
    setName(nextOrg.name || '');
    setHostType(nextSetup.hostType);
    setTagline(nextOrg.tagline || '');
    setShortDescription(nextSetup.shortDescription || '');
    setDescription(nextOrg.description || '');
    setCity(nextOrg.city || '');
    setState(nextOrg.state || '');
    setServiceAreas(nextSetup.serviceAreas.join(', '));
    setWebsite(nextOrg.website_url || '');
    setEmail(nextOrg.public_email || '');
    setPhone(nextOrg.phone || '');
    setInstagram(nextOrg.instagram_url || '');
    setFacebook(nextOrg.facebook_url || '');
    setSpecialties((nextOrg.specialties || []).join(', '));
    setAudiences(nextSetup.audiences.join(', '));
    setLanguages(nextSetup.languages.join(', '));
    setAccessibility(nextSetup.accessibility || '');
    setFoundedYear(nextSetup.foundedYear ? String(nextSetup.foundedYear) : '');
    setIsPublic(nextOrg.is_public);
    setSectionOrder(nextSetup.profileSectionOrder.length ? nextSetup.profileSectionOrder : DEFAULT_ORDER);
    setContactVisibility(nextSetup.contactVisibility);
    if (nextSetup.setupStage !== 'complete') setStep(nextSetup.setupStage);
  },[]);

  const load = useCallback(async() => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [nextOrg,nextSetup,nextGallery] = await Promise.all([getHostOrganization(id),getHostProfileSetup(id),listOrganizationGallery(id)]);
      setOrg(nextOrg);
      setSetup(nextSetup);
      setGallery(nextGallery);
      hydrate(nextOrg,nextSetup);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this host profile.');
    } finally {
      setLoading(false);
    }
  },[hydrate,id]);

  useEffect(() => { void load(); },[load]);

  const list = (value:string) => value.split(',').map((item)=>item.trim()).filter(Boolean);
  const completion = useMemo(() => calculateHostProfileCompletion({
    name, tagline, shortDescription, description, city, serviceAreas:list(serviceAreas), websiteUrl:website,
    logoUrl:org?.logo_url, coverImageUrl:org?.cover_image_url, specialties:list(specialties), galleryCount:gallery.length,
  }),[city,description,gallery.length,name,org?.cover_image_url,org?.logo_url,serviceAreas,shortDescription,specialties,tagline,website]);

  async function save(stage:HostSetupStage = step) {
    if (!id || !name.trim()) { setError('Add a public host name.'); return; }
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const nextOrg = await updateHostOrganization(id, {
        name, tagline, description, city, state, website_url:website, public_email:email, phone,
        instagram_url:instagram, facebook_url:facebook, specialties:list(specialties), is_public:isPublic,
      });
      const parsedYear = foundedYear.trim() ? Number.parseInt(foundedYear,10) : null;
      const nextSetup = await updateHostProfileSetup(id, {
        hostType, shortDescription, serviceAreas:list(serviceAreas), audiences:list(audiences), languages:list(languages), accessibility,
        foundedYear:Number.isFinite(parsedYear as number) ? parsedYear : null, setupStage:stage,
        setupCompletedAt:stage === 'complete' ? new Date().toISOString() : setup?.setupCompletedAt ?? null,
        profileSectionOrder:sectionOrder, contactVisibility,
      });
      setOrg(nextOrg);
      setSetup(nextSetup);
      hydrate(nextOrg,nextSetup);
      setSaved(stage === 'complete' ? 'Profile setup complete.' : 'Profile progress saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this host profile.');
    } finally {
      setSaving(false);
    }
  }

  async function goTo(next:Exclude<HostSetupStage,'complete'>) {
    await save(next);
    setStep(next);
  }

  async function chooseBrandImage(kind:'logo'|'cover') {
    if (!id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed','Allow photo access to choose host images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], allowsMultipleSelection:false, quality:.9, exif:false });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setSaving(true);
    setError('');
    try {
      if (kind === 'logo') await uploadOrganizationLogo(id,result.assets[0].uri);
      else await uploadOrganizationCover(id,result.assets[0].uri);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload image.');
    } finally {
      setSaving(false);
    }
  }

  async function chooseGalleryPhotos() {
    if (!id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed','Allow photo access to add gallery photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], allowsMultipleSelection:true, selectionLimit:12, quality:.88, exif:false });
    if (result.canceled || !result.assets?.length) return;
    setSaving(true);
    setError('');
    try {
      for (const asset of result.assets.slice(0,12)) await uploadOrganizationGalleryPhoto({ organizationId:id, localUri:asset.uri });
      setGallery(await listOrganizationGallery(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload gallery photos.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeletePhoto(photo:OrganizationGalleryPhoto) {
    Alert.alert('Remove photo?','This removes the photo from the host gallery.',[
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress:()=>void (async()=>{
        try {
          await deleteOrganizationGalleryPhoto(photo.id);
          if(id) setGallery(await listOrganizationGallery(id));
        } catch(caught) {
          setError(caught instanceof Error?caught.message:'Unable to remove photo.');
        }
      })() },
    ]);
  }

  async function featurePhoto(photo:OrganizationGalleryPhoto) {
    if (!id) return;
    try {
      await updateOrganizationGalleryPhoto(photo.id,{ isFeatured:true });
      setGallery(await listOrganizationGallery(id));
    } catch(caught) {
      setError(caught instanceof Error?caught.message:'Unable to feature photo.');
    }
  }

  async function chooseImportFiles() {
    const result = await DocumentPicker.getDocumentAsync({ multiple:true, copyToCacheDirectory:true, type:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/html','image/jpeg','image/png','image/webp'] });
    if (!result.canceled) setImportFiles(result.assets.slice(0,8));
  }

  async function analyzeImport() {
    if (!id) return;
    setImportBusy(true);
    setError('');
    try {
      const result = await previewHostProfileImport({
        organizationId:id,
        mode:importMode,
        files:importMode === 'files' ? importFiles.map((file)=>({ uri:file.uri,name:file.name,mimeType:file.mimeType,size:file.size })) : undefined,
        sourceUrl:importMode === 'website' ? importUrl : undefined,
        sourceText:importMode === 'pasted_text' ? importText : undefined,
      }) as SmartImportResult;
      setImportResult(result);
      setSelectedImportFields(IMPORT_FIELDS.filter(({key})=>hasImportValue(result.preview[key])).map(({key})=>key));
    } catch(caught) {
      setError(caught instanceof Error?caught.message:'Unable to read those profile details.');
    } finally {
      setImportBusy(false);
    }
  }

  async function applyImport() {
    if (!id || !importResult) return;
    const p = importResult.preview;
    const has = (key:keyof HostProfileImportPreview) => selectedImportFields.includes(key);
    setImportBusy(true);
    setError('');
    try {
      const corePatch:any = {};
      if(has('name')) corePatch.name=p.name;
      if(has('tagline')) corePatch.tagline=p.tagline;
      if(has('description')) corePatch.description=p.description;
      if(has('city')) corePatch.city=p.city;
      if(has('state')) corePatch.state=p.state;
      if(has('websiteUrl')) corePatch.website_url=p.websiteUrl;
      if(has('publicEmail')) corePatch.public_email=p.publicEmail;
      if(has('phone')) corePatch.phone=p.phone;
      if(has('instagramUrl')) corePatch.instagram_url=p.instagramUrl;
      if(has('facebookUrl')) corePatch.facebook_url=p.facebookUrl;
      if(has('specialties')) corePatch.specialties=p.specialties;
      const setupPatch:any = {};
      if(has('hostType')&&p.hostType) setupPatch.hostType=p.hostType;
      if(has('shortDescription')) setupPatch.shortDescription=p.shortDescription;
      if(has('serviceAreas')) setupPatch.serviceAreas=p.serviceAreas;
      if(has('audiences')) setupPatch.audiences=p.audiences;
      if(has('languages')) setupPatch.languages=p.languages;
      if(has('accessibility')) setupPatch.accessibility=p.accessibility;
      if(has('foundedYear')) setupPatch.foundedYear=p.foundedYear;
      if(Object.keys(corePatch).length) await updateHostOrganization(id,corePatch);
      if(Object.keys(setupPatch).length) await updateHostProfileSetup(id,setupPatch);
      await markHostProfileImportApplied(importResult.importId,{ fields:selectedImportFields, corePatch, setupPatch });
      setImportResult(null);
      setSelectedImportFields([]);
      setImportFiles([]);
      setImportText('');
      setImportUrl('');
      await load();
      setSaved('Imported details applied. Review and save any edits.');
    } catch(caught) {
      setError(caught instanceof Error?caught.message:'Unable to apply imported details.');
    } finally {
      setImportBusy(false);
    }
  }

  async function discardImport() {
    if(importResult) await markHostProfileImportDiscarded(importResult.importId).catch(()=>undefined);
    setImportResult(null);
    setSelectedImportFields([]);
  }

  function moveSection(index:number,direction:-1|1) {
    setSectionOrder((current)=>{
      const next=[...current];
      const target=index+direction;
      if(target<0||target>=next.length) return current;
      const source=next[index];
      const destination=next[target];
      if(source===undefined||destination===undefined) return current;
      next[index]=destination;
      next[target]=source;
      return next;
    });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold} size="large"/><Text style={styles.muted}>Loading profile setup…</Text></SafeAreaView>;
  if (!org || !setup) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Host profile not found.'}</Text></SafeAreaView>;

  const currentIndex = STEPS.findIndex((item)=>item.key===step);
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <Pressable style={styles.previewButton} onPress={()=>router.push(`/organization-profile/${org.slug}` as never)}><Text style={styles.previewButtonText}>View as visitor</Text></Pressable>
      </View>

      <Text style={styles.eyebrow}>HOST PROFILE</Text>
      <Text style={styles.title}>Build the identity people will see.</Text>
      <Text style={styles.subtitle}>Add your information once. Use the same profile for setup, future edits, discovery, and events.</Text>

      <View style={styles.progressCard}>
        <View style={styles.progressTop}>
          <Text style={styles.progressValue}>{completion.percent}%</Text>
          <View style={styles.flex}><Text style={styles.progressTitle}>Profile quality</Text><Text style={styles.muted}>{completion.complete} of {completion.total} recommended items complete</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${completion.percent}%`}]} /></View>
        {completion.missing.slice(0,3).map((item)=><Text key={item} style={styles.missing}>• {item}</Text>)}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.steps}>
        {STEPS.map((item,index)=><Pressable key={item.key} style={[styles.step,index===currentIndex&&styles.stepActive]} onPress={()=>void goTo(item.key)}><Text style={[styles.stepNumber,index===currentIndex&&styles.stepNumberActive]}>{index+1}</Text><Text style={[styles.stepLabel,index===currentIndex&&styles.stepLabelActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>

      {error?<View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View>:null}
      {saved?<View style={styles.savedCard}><Text style={styles.saved}>{saved}</Text></View>:null}

      {step==='profile'?<>
        <Section title="Identity" copy="Start with the name and type of host people should recognize."/>
        <View style={styles.card}>
          <Field label="Public host name" value={name} onChangeText={setName} placeholder="Groundwork Test Company"/>
          <Text style={styles.label}>Host type</Text>
          <View style={styles.chips}>{HOST_TYPES.map((item)=><Pressable key={item.key} style={[styles.chip,hostType===item.key&&styles.chipActive]} onPress={()=>setHostType(item.key)}><Text style={[styles.chipText,hostType===item.key&&styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
          <Field label="Tagline" value={tagline} onChangeText={setTagline} placeholder="What should people know in one line?"/>
          <Field label="Short description" value={shortDescription} onChangeText={setShortDescription} multiline placeholder="A short summary for cards and search results."/>
          <View style={styles.row}><View style={styles.flex}><Field label="Home city" value={city} onChangeText={setCity}/></View><View style={styles.state}><Field label="State" value={state} onChangeText={(value:string)=>setState(value.toUpperCase())}/></View></View>
          <Field label="Service areas" value={serviceAreas} onChangeText={setServiceAreas} placeholder="Jacksonville, Atlanta, Remote"/>
          <Field label="Founded / started year" value={foundedYear} onChangeText={setFoundedYear} keyboardType="number-pad" placeholder="2024"/>
        </View>
        <ImportPanel mode={importMode} setMode={setImportMode} files={importFiles} url={importUrl} text={importText} setUrl={setImportUrl} setText={setImportText} onChooseFiles={chooseImportFiles} onAnalyze={analyzeImport} busy={importBusy} result={importResult} selected={selectedImportFields} setSelected={setSelectedImportFields} onApply={applyImport} onDiscard={discardImport}/>
      </>:null}

      {step==='about'?<>
        <Section title="Tell people what you do" copy="Keep public profile content separate from private legal, tax, payment, and internal business information."/>
        <View style={styles.card}>
          <Field label="About" value={description} onChangeText={setDescription} multiline placeholder="Tell visitors what you host, offer, or organize."/>
          <Field label="Specialties" value={specialties} onChangeText={setSpecialties} placeholder="Workshops, networking, family events"/>
          <Field label="Typical audiences" value={audiences} onChangeText={setAudiences} placeholder="Families, professionals, beginners"/>
          <Field label="Languages" value={languages} onChangeText={setLanguages} placeholder="English, Spanish"/>
          <Field label="Accessibility information" value={accessibility} onChangeText={setAccessibility} multiline placeholder="Share confirmed accessibility details or accommodations."/>
        </View>
        <Section title="Public contact" copy="Choose what visitors can use to reach or learn more about you."/>
        <View style={styles.card}>
          <Field label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://"/>
          <Field label="Public email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
          <Field label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none"/>
          <Field label="Facebook" value={facebook} onChangeText={setFacebook} autoCapitalize="none"/>
        </View>
      </>:null}

      {step==='media'?<>
        <Section title="Logo and cover" copy="Keep the original assets available so the app can present them correctly across cards, profiles, and mobile layouts."/>
        <View style={styles.mediaPair}><MediaTile title="Logo / profile image" image={org.logo_url} onPress={()=>void chooseBrandImage('logo')}/><MediaTile title="Cover image" image={org.cover_image_url} wide onPress={()=>void chooseBrandImage('cover')}/></View>
        <Section title="Photo gallery" copy="Add real examples of your events, work, space, or community. You can choose a featured image."/>
        <Pressable style={styles.uploadCard} onPress={()=>void chooseGalleryPhotos()}><Text style={styles.uploadTitle}>+ Add photos</Text><Text style={styles.muted}>Choose up to 12 at a time</Text></Pressable>
        {gallery.length?<View style={styles.gallery}>{gallery.map((photo)=><View key={photo.id} style={styles.galleryItem}><Image source={{uri:photo.imageUrl}} style={styles.galleryImage}/>{photo.isFeatured?<Text style={styles.featured}>FEATURED</Text>:null}<View style={styles.galleryActions}>{!photo.isFeatured?<Pressable onPress={()=>void featurePhoto(photo)}><Text style={styles.smallAction}>Feature</Text></Pressable>:null}<Pressable onPress={()=>confirmDeletePhoto(photo)}><Text style={styles.remove}>Remove</Text></Pressable></View></View>)}</View>:<View style={styles.empty}><Text style={styles.muted}>No gallery photos yet.</Text></View>}
      </>:null}

      {step==='brand'?<>
        <Section title="Brand presentation" copy="Profile media lives here. Product colors, terminology, navigation, and tenant-wide visual settings stay in Public Experience so profile editing cannot accidentally change the whole product."/>
        <View style={styles.brandPreview}>{org.cover_image_url?<Image source={{uri:org.cover_image_url}} style={styles.brandCover}/>:<View style={styles.brandCoverFallback}/>}<View style={styles.brandIdentity}>{org.logo_url?<Image source={{uri:org.logo_url}} style={styles.brandLogo}/>:<View style={styles.brandLogoFallback}/>}<View style={styles.flex}><Text style={styles.brandName}>{name||org.name}</Text><Text style={styles.muted}>{tagline||'Add a tagline to complete this preview.'}</Text></View></View></View>
        <Pressable style={styles.secondaryButton} onPress={()=>router.push('/host/experience' as never)}><Text style={styles.secondaryText}>Open Public Experience settings</Text></Pressable>
      </>:null}

      {step==='features'?<>
        <Section title="Contact visibility" copy="A field can exist in the host workspace without appearing publicly."/>
        <View style={styles.card}><ToggleRow label="Show email" value={contactVisibility.email} onPress={()=>setContactVisibility((v)=>({...v,email:!v.email}))}/><ToggleRow label="Show phone" value={contactVisibility.phone} onPress={()=>setContactVisibility((v)=>({...v,phone:!v.phone}))}/><ToggleRow label="Show website" value={contactVisibility.website} onPress={()=>setContactVisibility((v)=>({...v,website:!v.website}))}/><ToggleRow label="Show social links" value={contactVisibility.socials} onPress={()=>setContactVisibility((v)=>({...v,socials:!v.socials}))}/></View>
        <Section title="Public profile order" copy="Move the sections that matter most to this host closer to the top."/>
        <View style={styles.card}>{sectionOrder.map((section,index)=><View key={section} style={styles.orderRow}><Text style={styles.orderIndex}>{index+1}</Text><Text style={styles.orderLabel}>{SECTION_LABELS[section]||section}</Text><View style={styles.orderActions}><Pressable disabled={index===0} onPress={()=>moveSection(index,-1)}><Text style={[styles.orderButton,index===0&&styles.disabledText]}>↑</Text></Pressable><Pressable disabled={index===sectionOrder.length-1} onPress={()=>moveSection(index,1)}><Text style={[styles.orderButton,index===sectionOrder.length-1&&styles.disabledText]}>↓</Text></Pressable></View></View>)}</View>
      </>:null}

      {step==='preview'?<>
        <Section title="Preview and publish" copy="Review the public identity before visitors see it. You can keep the profile private while you finish setup."/>
        <View style={styles.publicPreview}>{org.cover_image_url?<Image source={{uri:org.cover_image_url}} style={styles.publicCover}/>:<View style={styles.publicCoverFallback}/>}<View style={styles.publicBody}><View style={styles.publicIdentity}>{org.logo_url?<Image source={{uri:org.logo_url}} style={styles.publicLogo}/>:<View style={styles.publicLogoFallback}/>}<View style={styles.flex}><Text style={styles.publicName}>{name}</Text><Text style={styles.publicMeta}>{[city,state].filter(Boolean).join(', ')||HOST_TYPES.find((item)=>item.key===hostType)?.label}</Text></View></View>{tagline?<Text style={styles.publicTagline}>{tagline}</Text>:null}{shortDescription?<Text style={styles.publicDescription}>{shortDescription}</Text>:null}<View style={styles.publicChips}>{list(specialties).slice(0,4).map((item)=><View key={item} style={styles.publicChip}><Text style={styles.publicChipText}>{item}</Text></View>)}</View></View></View>
        <View style={styles.card}><ToggleRow label="Public profile" value={isPublic} onPress={()=>setIsPublic((value)=>!value)}/><Text style={styles.help}>{isPublic?'Visitors can view the profile after you save.':'The profile stays visible only to your team while you finish it.'}</Text></View>
        <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/organization-profile/${org.slug}` as never)}><Text style={styles.secondaryText}>Open full visitor preview</Text></Pressable>
      </>:null}

      <View style={styles.footer}>
        <Pressable disabled={saving} style={styles.secondaryButton} onPress={()=>void save(step)}><Text style={styles.secondaryText}>{saving?'Saving…':'Save progress'}</Text></Pressable>
        {currentIndex<STEPS.length-1?<Pressable disabled={saving} style={styles.primaryButton} onPress={()=>void goTo(STEPS[currentIndex+1]!.key)}>{saving?<ActivityIndicator color="#152018"/>:<Text style={styles.primaryText}>Continue to {STEPS[currentIndex+1]!.label}</Text>}</Pressable>:<Pressable disabled={saving} style={styles.primaryButton} onPress={()=>void save('complete')}>{saving?<ActivityIndicator color="#152018"/>:<Text style={styles.primaryText}>Finish profile setup</Text>}</Pressable>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function hasImportValue(value:HostProfileImportPreview[keyof HostProfileImportPreview]) {
  if(Array.isArray(value)) return value.length>0;
  return value!==null&&value!=='';
}

function importValue(value:HostProfileImportPreview[keyof HostProfileImportPreview]) {
  if(Array.isArray(value)) return value.join(', ');
  if(value===null) return '';
  return String(value);
}

function documentTypeLabel(value?: SmartImportResult['documentType']) {
  if (value === 'host_profile') return 'Host profile';
  if (value === 'event') return 'Event document';
  if (value === 'vendor') return 'Vendor document';
  if (value === 'venue') return 'Venue document';
  if (value === 'brand_kit') return 'Brand kit';
  return 'Unclassified document';
}

function extractionLabel(value:string) {
  if (value === 'ai') return 'AI extraction';
  if (value === 'source') return 'Basic source extraction';
  return 'Limited extraction';
}

function ImportPanel({mode,setMode,files,url,text,setUrl,setText,onChooseFiles,onAnalyze,busy,result,selected,setSelected,onApply,onDiscard}:any) {
  const fields = result ? IMPORT_FIELDS.filter(({key})=>hasImportValue(result.preview[key])) : [];
  return <>
    <Section title="Bring your existing details" copy="Upload a media kit, profile document, flyer, website, or existing About copy. We identify what kind of document you uploaded before suggesting profile changes. Nothing is applied until you review it."/>
    <View style={styles.card}>
      <View style={styles.modeRow}>{(['files','website','pasted_text'] as const).map((key)=><Pressable key={key} style={[styles.mode,mode===key&&styles.modeActive]} onPress={()=>setMode(key)}><Text style={[styles.modeText,mode===key&&styles.modeTextActive]}>{key==='files'?'Upload':key==='website'?'Website':'Paste'}</Text></Pressable>)}</View>
      {!result&&mode==='files'?<Pressable style={styles.importDrop} onPress={()=>void onChooseFiles()}><Text style={styles.uploadTitle}>{files.length?`${files.length} file${files.length===1?'':'s'} selected`:'Choose source files'}</Text><Text style={styles.muted}>PDF, Word, text, HTML, JPG, PNG, WebP</Text></Pressable>:null}
      {!result&&mode==='website'?<Field label="Public website or profile page" value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://"/>:null}
      {!result&&mode==='pasted_text'?<Field label="Existing profile or business copy" value={text} onChangeText={setText} multiline placeholder="Paste your About text, services, contact details, service areas, or other public information."/>:null}
      {!result?<Pressable disabled={busy} style={styles.analyzeButton} onPress={()=>void onAnalyze()}>{busy?<ActivityIndicator color="#152018"/>:<Text style={styles.primaryText}>Review suggested details</Text>}</Pressable>:<>
        <Text style={styles.importSource}>{result.sourceLabel}</Text>
        <View style={styles.importMetaRow}>
          <View style={styles.importBadge}><Text style={styles.importBadgeText}>{documentTypeLabel(result.documentType)}</Text></View>
          <View style={styles.importBadge}><Text style={styles.importBadgeText}>{extractionLabel(result.extractionSource)}</Text></View>
          {typeof result.documentTypeConfidence === 'number'?<Text style={styles.importConfidence}>{Math.round(result.documentTypeConfidence*100)}% type confidence</Text>:null}
        </View>
        {result.extractionMessage?<Text style={styles.extractionMessage}>{result.extractionMessage}</Text>:null}
        {result.documentTypeReasons?.map((reason:string)=><Text key={reason} style={styles.note}>• {reason}</Text>)}
        {result.eventHandoffRecommended?<View style={styles.handoffCard}>
          <Text style={styles.handoffTitle}>This belongs in Event Builder</Text>
          <Text style={styles.handoffCopy}>We will only offer clearly identified host or organizer details on this profile. Import the full file in Event Builder for dates, tickets, venue, schedule, policies, and other event content.</Text>
          <Pressable style={styles.handoffButton} onPress={()=>router.push('/host/import-event?mode=files' as never)}><Text style={styles.handoffButtonText}>Import in Event Builder</Text></Pressable>
        </View>:null}
        {result.preview.confidenceNotes?.map((note:string)=><Text key={note} style={styles.note}>• {note}</Text>)}
        {fields.length?<View style={styles.importList}>{fields.map(({key,label})=>{const active=selected.includes(key);return <Pressable key={key} style={[styles.importField,active&&styles.importFieldActive]} onPress={()=>setSelected((current:any[])=>current.includes(key)?current.filter((item)=>item!==key):[...current,key])}><View style={[styles.check,active&&styles.checkActive]}><Text style={styles.checkText}>{active?'✓':''}</Text></View><View style={styles.flex}><Text style={styles.importLabel}>{label}</Text><Text numberOfLines={3} style={styles.importValue}>{importValue(result.preview[key])}</Text></View></Pressable>})}</View>:<View style={styles.empty}><Text style={styles.muted}>No supported host-profile fields were found in this source.</Text></View>}
        <View style={styles.row}><Pressable style={[styles.secondaryButton,styles.flex]} onPress={()=>void onDiscard()}><Text style={styles.secondaryText}>Discard</Text></Pressable><Pressable disabled={busy||!selected.length} style={[styles.primaryButton,styles.flex,!selected.length&&styles.disabled]} onPress={()=>void onApply()}>{busy?<ActivityIndicator color="#152018"/>:<Text style={styles.primaryText}>Apply selected</Text>}</Pressable></View>
      </>}
    </View>
  </>;
}

function Section({title,copy}:{title:string;copy:string}) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCopy}>{copy}</Text></View>;
}

function Field({label,multiline=false,...props}:any) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline?'top':'center'} placeholderTextColor="#657269" style={[styles.input,multiline&&styles.multiline]}/></View>;
}

function MediaTile({title,image,wide=false,onPress}:{title:string;image:string|null|undefined;wide?:boolean;onPress:()=>void}) {
  return <Pressable style={[styles.mediaTile,wide&&styles.mediaTileWide]} onPress={onPress}>{image?<Image source={{uri:image}} style={styles.mediaTileImage}/>:<View style={styles.mediaTileEmpty}><Text style={styles.mediaTilePlus}>+</Text></View>}<Text style={styles.mediaTileTitle}>{title}</Text><Text style={styles.smallAction}>{image?'Replace':'Upload'}</Text></Pressable>;
}

function ToggleRow({label,value,onPress}:{label:string;value:boolean;onPress:()=>void}) {
  return <Pressable style={styles.toggleRow} onPress={onPress}><Text style={styles.toggleLabel}>{label}</Text><View style={[styles.toggle,value&&styles.toggleOn]}><View style={[styles.toggleThumb,value&&styles.toggleThumbOn]}/></View></Pressable>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:10},content:{padding:18,paddingBottom:120},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},back:{color:C.gold,fontWeight:'900'},previewButton:{borderWidth:1,borderColor:C.line,borderRadius:11,paddingHorizontal:12,paddingVertical:9},previewButtonText:{color:C.cream,fontSize:10,fontWeight:'900'},eyebrow:{color:C.gold,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:C.cream,fontSize:29,fontWeight:'900',marginTop:3,maxWidth:720},subtitle:{color:C.muted,fontSize:12,lineHeight:18,marginTop:6,maxWidth:700},flex:{flex:1},muted:{color:C.muted,fontSize:10,lineHeight:15},error:{color:C.red,fontSize:11},saved:{color:C.green,fontSize:11,fontWeight:'800'},errorCard:{backgroundColor:'#261715',borderColor:'#6A3E38',borderWidth:1,borderRadius:13,padding:12,marginTop:10},savedCard:{backgroundColor:'#14251A',borderColor:'#335C3E',borderWidth:1,borderRadius:13,padding:12,marginTop:10},
  progressCard:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:14,marginTop:18},progressTop:{flexDirection:'row',alignItems:'center',gap:12},progressValue:{color:C.gold,fontSize:25,fontWeight:'900'},progressTitle:{color:C.cream,fontSize:12,fontWeight:'900'},progressTrack:{height:7,borderRadius:999,backgroundColor:'#263029',overflow:'hidden',marginTop:12},progressFill:{height:'100%',backgroundColor:C.gold,borderRadius:999},missing:{color:C.dim,fontSize:9,marginTop:6},steps:{gap:7,paddingVertical:16},step:{minWidth:92,borderWidth:1,borderColor:C.line,borderRadius:13,padding:10,backgroundColor:C.panel},stepActive:{backgroundColor:'#292516',borderColor:C.gold},stepNumber:{color:C.dim,fontSize:9,fontWeight:'900'},stepNumberActive:{color:C.gold},stepLabel:{color:C.muted,fontSize:10,fontWeight:'800',marginTop:3},stepLabelActive:{color:C.cream},
  section:{marginTop:22,marginBottom:8},sectionTitle:{color:C.cream,fontSize:19,fontWeight:'900'},sectionCopy:{color:C.dim,fontSize:10,lineHeight:15,marginTop:4,maxWidth:700},card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:17,padding:14,marginTop:8},field:{marginTop:11},label:{color:'#D4DAD6',fontSize:10,fontWeight:'800',marginBottom:6,marginTop:8},input:{minHeight:46,borderWidth:1,borderColor:'#344039',backgroundColor:'#101611',color:C.cream,borderRadius:12,paddingHorizontal:12,fontSize:12},multiline:{minHeight:100,paddingTop:11},row:{flexDirection:'row',gap:9,alignItems:'center'},state:{width:105},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingHorizontal:11,paddingVertical:8},chipActive:{backgroundColor:'#292516',borderColor:C.gold},chipText:{color:C.muted,fontSize:9,fontWeight:'800'},chipTextActive:{color:C.gold},
  modeRow:{flexDirection:'row',gap:6,marginBottom:10},mode:{flex:1,borderWidth:1,borderColor:C.line,borderRadius:10,paddingVertical:9,alignItems:'center'},modeActive:{backgroundColor:'#292516',borderColor:C.gold},modeText:{color:C.muted,fontSize:9,fontWeight:'900'},modeTextActive:{color:C.gold},importDrop:{borderWidth:1,borderStyle:'dashed',borderColor:'#435148',borderRadius:13,padding:18,alignItems:'center',marginTop:8},uploadTitle:{color:C.cream,fontSize:12,fontWeight:'900'},analyzeButton:{minHeight:46,borderRadius:12,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',marginTop:12},importSource:{color:C.gold,fontSize:10,fontWeight:'900',marginTop:9,marginBottom:7},importMetaRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,marginBottom:8},importBadge:{borderWidth:1,borderColor:'#554A2A',backgroundColor:'#211E13',borderRadius:999,paddingHorizontal:8,paddingVertical:5},importBadgeText:{color:C.gold,fontSize:8,fontWeight:'900'},importConfidence:{color:C.dim,fontSize:8,fontWeight:'700'},extractionMessage:{color:'#C8D0CA',fontSize:9,lineHeight:14,marginBottom:7},note:{color:C.muted,fontSize:9,lineHeight:14,marginBottom:4},handoffCard:{borderWidth:1,borderColor:'#6C5A2A',backgroundColor:'#1D1C14',borderRadius:13,padding:12,marginVertical:10},handoffTitle:{color:C.cream,fontSize:12,fontWeight:'900'},handoffCopy:{color:C.muted,fontSize:9,lineHeight:14,marginTop:5},handoffButton:{minHeight:42,borderRadius:10,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',marginTop:10},handoffButtonText:{color:'#152018',fontSize:9,fontWeight:'900'},importList:{gap:7,marginVertical:10},importField:{flexDirection:'row',gap:9,borderWidth:1,borderColor:C.line,borderRadius:12,padding:10},importFieldActive:{borderColor:'#6C5A2A',backgroundColor:'#1D1C14'},check:{width:22,height:22,borderWidth:1,borderColor:C.line,borderRadius:6,alignItems:'center',justifyContent:'center'},checkActive:{backgroundColor:C.gold,borderColor:C.gold},checkText:{color:'#142017',fontWeight:'900'},importLabel:{color:C.gold,fontSize:8,fontWeight:'900'},importValue:{color:C.cream,fontSize:10,lineHeight:15,marginTop:2},
  mediaPair:{flexDirection:'row',gap:9,flexWrap:'wrap'},mediaTile:{width:150,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:10},mediaTileWide:{width:230},mediaTileImage:{width:'100%',height:100,borderRadius:11,backgroundColor:C.raised},mediaTileEmpty:{height:100,borderRadius:11,backgroundColor:C.raised,alignItems:'center',justifyContent:'center'},mediaTilePlus:{color:C.gold,fontSize:30,fontWeight:'300'},mediaTileTitle:{color:C.cream,fontSize:10,fontWeight:'900',marginTop:8},smallAction:{color:C.gold,fontSize:9,fontWeight:'900',marginTop:4},uploadCard:{minHeight:74,borderWidth:1,borderStyle:'dashed',borderColor:'#435148',borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:8},gallery:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},galleryItem:{width:'48%',minWidth:145,backgroundColor:C.panel,borderRadius:14,padding:7,borderWidth:1,borderColor:C.line},galleryImage:{width:'100%',height:110,borderRadius:10,backgroundColor:C.raised},featured:{position:'absolute',top:13,left:13,backgroundColor:C.gold,color:'#142017',fontSize:7,fontWeight:'900',paddingHorizontal:6,paddingVertical:4,borderRadius:999},galleryActions:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:3,paddingTop:3},remove:{color:C.red,fontSize:9,fontWeight:'900',marginTop:4},empty:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:15,padding:15,marginTop:8},
  brandPreview:{backgroundColor:C.panel,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:C.line},brandCover:{width:'100%',height:150,backgroundColor:C.raised},brandCoverFallback:{height:110,backgroundColor:'#17221B'},brandIdentity:{flexDirection:'row',alignItems:'center',gap:11,padding:14},brandLogo:{width:62,height:62,borderRadius:17,backgroundColor:C.raised},brandLogoFallback:{width:62,height:62,borderRadius:17,backgroundColor:'#292516'},brandName:{color:C.cream,fontSize:18,fontWeight:'900'},secondaryButton:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',paddingHorizontal:14,marginTop:10},secondaryText:{color:C.cream,fontSize:10,fontWeight:'900'},primaryButton:{minHeight:46,borderRadius:12,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',paddingHorizontal:16,marginTop:10},primaryText:{color:'#152018',fontSize:10,fontWeight:'900'},disabled:{opacity:.45},
  toggleRow:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},toggleLabel:{color:C.cream,fontSize:11,fontWeight:'800'},toggle:{width:42,height:24,borderRadius:999,backgroundColor:'#374139',padding:3},toggleOn:{backgroundColor:'#765F23'},toggleThumb:{width:18,height:18,borderRadius:9,backgroundColor:C.muted},toggleThumbOn:{alignSelf:'flex-end',backgroundColor:C.gold},help:{color:C.dim,fontSize:9,lineHeight:14,marginTop:8},orderRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},orderIndex:{width:22,color:C.gold,fontSize:10,fontWeight:'900'},orderLabel:{flex:1,color:C.cream,fontSize:11,fontWeight:'800'},orderActions:{flexDirection:'row',gap:16},orderButton:{color:C.gold,fontSize:20,fontWeight:'900'},disabledText:{color:C.dim},
  publicPreview:{backgroundColor:C.panel,borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:C.line},publicCover:{width:'100%',height:160,backgroundColor:C.raised},publicCoverFallback:{height:100,backgroundColor:'#17221B'},publicBody:{padding:14},publicIdentity:{flexDirection:'row',gap:11,alignItems:'center'},publicLogo:{width:66,height:66,borderRadius:18,backgroundColor:C.raised},publicLogoFallback:{width:66,height:66,borderRadius:18,backgroundColor:'#292516'},publicName:{color:C.cream,fontSize:21,fontWeight:'900'},publicMeta:{color:C.gold,fontSize:9,fontWeight:'800',marginTop:3},publicTagline:{color:C.cream,fontSize:12,fontWeight:'800',marginTop:12},publicDescription:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5},publicChips:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:10},publicChip:{backgroundColor:'#292516',borderRadius:999,paddingHorizontal:8,paddingVertical:5},publicChipText:{color:C.gold,fontSize:8,fontWeight:'800'},footer:{marginTop:22},
});
