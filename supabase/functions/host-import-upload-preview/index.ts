import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import JSZip from "npm:jszip@3.10.1";

const MODEL = "gpt-4.1-mini";
const MAX_FILES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 4 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set(["Hiking","Camping","Paddling","Beach","Cycling","Social","Workshop","Volunteer","Other"]);
const ALLOWED_DIFFICULTIES = new Set(["easy","moderate","challenging"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: jsonHeaders }); }
function clean(value: unknown, max = 5000) { return String(value ?? "").trim().slice(0, max); }
function safePath(path: string, userId: string) { return path.startsWith(`${userId}/`) && !path.includes("../") && !path.includes("\\"); }
function bytesToBase64(bytes: Uint8Array) { let binary = ""; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length))); return btoa(binary); }
function mimeFor(name: string, supplied = "") {
  if (supplied && supplied !== "application/octet-stream") return supplied;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
function supportedMime(mime: string) { return mime === "application/pdf" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mime === "text/plain" || mime === "text/html" || mime === "application/zip" || mime.startsWith("image/"); }
function readOutputText(payload: any) { if (typeof payload?.output_text === "string") return payload.output_text; for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text; return ""; }
function basicPreview(files: string[]) { return { title:"Imported Event",summary:"",description:"",category:"Other",difficulty:"easy",startsAt:"",endsAt:"",venueName:"",address:"",city:"",state:"FL",capacity:null,meetingInstructions:"",heroImageUrl:"",tickets:[],schedule:[],meals:[],policies:[],photos:[],confidenceNotes:[`Automatic extraction was unavailable. Review the ${files.length} uploaded source file${files.length === 1 ? "" : "s"} manually.`] }; }
function asArray(value: unknown) { return Array.isArray(value) ? value : []; }
function normalizePreview(raw: any, files: string[]) {
  const fallback = basicPreview(files);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const category = clean(raw.category, 40);
  const difficulty = clean(raw.difficulty, 40);
  const capacityNumber = Number(raw.capacity);
  return {
    title: clean(raw.title, 240) || fallback.title,
    summary: clean(raw.summary, 3000),
    description: clean(raw.description, 12000),
    category: ALLOWED_CATEGORIES.has(category) ? category : "Other",
    difficulty: ALLOWED_DIFFICULTIES.has(difficulty) ? difficulty : "easy",
    startsAt: clean(raw.startsAt, 40),
    endsAt: clean(raw.endsAt, 40),
    venueName: clean(raw.venueName, 500),
    address: clean(raw.address, 700),
    city: clean(raw.city, 200),
    state: clean(raw.state, 80),
    capacity: Number.isInteger(capacityNumber) && capacityNumber >= 0 ? capacityNumber : null,
    meetingInstructions: clean(raw.meetingInstructions, 5000),
    heroImageUrl: clean(raw.heroImageUrl, 2000),
    tickets: asArray(raw.tickets).slice(0,20).map((item:any)=>({label:clean(item?.label,300),priceText:clean(item?.priceText,120)})).filter((item:any)=>item.label || item.priceText),
    schedule: asArray(raw.schedule).slice(0,50).map((item:any)=>({time:clean(item?.time,120),title:clean(item?.title,500)})).filter((item:any)=>item.time || item.title),
    meals: asArray(raw.meals).slice(0,30).map((item:any)=>clean(item,700)).filter(Boolean),
    policies: asArray(raw.policies).slice(0,30).map((item:any)=>clean(item,1000)).filter(Boolean),
    photos: asArray(raw.photos).slice(0,20).map((item:any)=>clean(item,2000)).filter(Boolean),
    confidenceNotes: asArray(raw.confidenceNotes).slice(0,30).map((item:any)=>clean(item,1500)).filter(Boolean),
  };
}
function decodeXmlEntities(value: string) { return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'"); }
async function extractDocxText(bytes: Uint8Array) { const docx = await JSZip.loadAsync(bytes); const file = docx.file("word/document.xml"); if (!file) return ""; const xml = await file.async("string"); return decodeXmlEntities(xml.replace(/<w:tab[^>]*\/>/g,"\t").replace(/<w:br[^>]*\/>/g,"\n").replace(/<\/w:p>/g,"\n").replace(/<[^>]+>/g,"")).replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim().slice(0,30000); }

async function appendFileContent(textItems: any[], richItems: any[], name: string, mime: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${name} is larger than 10 MB.`);
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = await extractDocxText(bytes);
    const item = {type:"input_text",text:`SOURCE FILE: ${name}\n${text || "No readable Word document text was found."}`};
    textItems.push(item); richItems.push(item); return;
  }
  if (mime === "text/plain" || mime === "text/html") {
    const text = new TextDecoder().decode(bytes).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,30000);
    const item = {type:"input_text",text:`SOURCE FILE: ${name}\n${text}`};
    textItems.push(item); richItems.push(item); return;
  }
  if (mime.startsWith("image/")) {
    const note = {type:"input_text",text:`IMAGE SOURCE FILE: ${name}`};
    textItems.push(note); richItems.push(note);
    if (mime !== "image/heic" && mime !== "image/heif") richItems.push({type:"input_image",image_url:`data:${mime};base64,${bytesToBase64(bytes)}`});
    return;
  }
  const filename = name.replace(/[\\/]+/g,"__").slice(-240);
  richItems.push({type:"input_file",filename,file_data:`data:${mime};base64,${bytesToBase64(bytes)}`});
  textItems.push({type:"input_text",text:`BINARY SOURCE FILE AVAILABLE BUT NOT READ IN TEXT PASS: ${name}`});
}

async function runExtraction(key: string, content: any[], pass: string) {
  const instructions = `Return one JSON object only. Extract one event draft from the supplied event materials. Use only facts supported by the source files. Never invent ticket prices, policies, dates, capacity, location, ownership, or contacts. Use local YYYY-MM-DDTHH:MM for startsAt and endsAt only when clearly supported. Preserve conflicts and outdated material in confidenceNotes with filenames. Required JSON keys: title, summary, description, category, difficulty, startsAt, endsAt, venueName, address, city, state, capacity, meetingInstructions, heroImageUrl, tickets, schedule, meals, policies, photos, confidenceNotes. category must be one of Hiking, Camping, Paddling, Beach, Cycling, Social, Workshop, Volunteer, Other. difficulty must be easy, moderate, or challenging. tickets must contain objects with label and priceText. schedule must contain objects with time and title. Use empty strings, empty arrays, or null for missing values.`;
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},
    body:JSON.stringify({model:MODEL,instructions,input:[{role:"user",content}],text:{format:{type:"json_object"}}}),
  });
  let payload:any = null;
  try { payload = await upstream.json(); } catch { payload = null; }
  if (!upstream.ok) {
    const message = clean(payload?.error?.message || payload?.error?.type || `HTTP ${upstream.status}`, 600);
    console.error(`host-import-upload-preview ${pass} OpenAI ${upstream.status}: ${message}`);
    return {preview:null, diagnostic:`${pass}: OpenAI ${upstream.status}: ${message}`};
  }
  const text = readOutputText(payload);
  if (!text) {
    const diagnostic = `${pass}: OpenAI returned no output_text`;
    console.error(`host-import-upload-preview ${diagnostic}`);
    return {preview:null, diagnostic};
  }
  try { return {preview:JSON.parse(text), diagnostic:null}; }
  catch {
    const diagnostic = `${pass}: OpenAI returned invalid JSON`;
    console.error(`host-import-upload-preview ${diagnostic}`);
    return {preview:null, diagnostic};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({error:"Authentication required"},401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({error:"Function environment is incomplete."},503);
  const userClient = createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:userData,error:userError} = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({error:"Authentication required"},401);
    const {data:approved,error:accessError} = await userClient.rpc("is_approved_outing_host",{p_profile_id:userId});
    if (accessError || approved !== true) return json({error:"Approved host access is required."},403);
    const body = await req.json();
    const rawFiles = Array.isArray(body?.files) ? body.files.slice(0,MAX_FILES) : [];
    if (!rawFiles.length) return json({error:"Upload at least one event file."},400);
    if (Array.isArray(body?.files) && body.files.length > MAX_FILES) return json({error:`Upload up to ${MAX_FILES} files at a time.`},400);

    const sourceFiles:any[]=[];
    const opening = {type:"input_text",text:"Build one event draft from all source material. Keep facts tied to source filenames. Detect contradictions. Leave missing values empty."};
    const textItems:any[]=[opening];
    const richItems:any[]=[opening];

    for (const raw of rawFiles) {
      const path=clean(raw?.path,1000), name=clean(raw?.name,240), supplied=clean(raw?.mimeType,160);
      const size=Number.isFinite(Number(raw?.size))?Number(raw.size):null;
      if (!path || !name || !safePath(path,userId)) return json({error:"One uploaded file path is invalid."},400);
      const mime=mimeFor(name,supplied);
      if (!supportedMime(mime)) return json({error:`${name} is not a supported event file.`},400);
      const {data:blob,error:downloadError}=await userClient.storage.from("event-imports").download(path);
      if(downloadError||!blob) throw downloadError??new Error(`Unable to read ${name}.`);
      const bytes=new Uint8Array(await blob.arrayBuffer());
      if(bytes.byteLength>MAX_FILE_BYTES) return json({error:`${name} is larger than 10 MB.`},400);
      sourceFiles.push({path,name,mimeType:mime,size:size??bytes.byteLength});
      if(mime==="application/zip") {
        const zip=await JSZip.loadAsync(bytes);
        const entries=Object.values(zip.files).filter((e:any)=>!e.dir&&!e.name.includes("../")&&!e.name.startsWith("/")).slice(0,MAX_FILES);
        for(const entry of entries as any[]) {
          const entryMime=mimeFor(entry.name);
          if(!supportedMime(entryMime)||entryMime==="application/zip") continue;
          const entryBytes=await entry.async("uint8array");
          if(entryBytes.byteLength>MAX_ZIP_ENTRY_BYTES){
            const note={type:"input_text",text:`ZIP entry ${entry.name} from ${name} was skipped because it exceeds 4 MB.`};
            textItems.push(note);richItems.push(note);continue;
          }
          await appendFileContent(textItems,richItems,`${name}/${entry.name}`,entryMime,entryBytes);
        }
      } else await appendFileContent(textItems,richItems,name,mime,bytes);
    }

    const sourceLabel=sourceFiles.length===1?(sourceFiles[0]?.name??"Uploaded event file"):`${sourceFiles.length} uploaded event files`;
    let preview=basicPreview(sourceFiles.map((f:any)=>f.name));
    let extractionSource:"ai"|"fallback"="fallback";
    const diagnostics:string[]=[];

    if(!openAiKey) diagnostics.push("OPENAI_API_KEY is not configured for this Edge Function.");
    else {
      const first = await runExtraction(openAiKey,textItems,"text-pass");
      if(first.preview){preview=normalizePreview(first.preview,sourceFiles.map((f:any)=>f.name));extractionSource="ai";}
      else {
        if(first.diagnostic) diagnostics.push(first.diagnostic);
        const second = await runExtraction(openAiKey,richItems,"rich-pass");
        if(second.preview){preview=normalizePreview(second.preview,sourceFiles.map((f:any)=>f.name));extractionSource="ai";}
        else if(second.diagnostic) diagnostics.push(second.diagnostic);
      }
    }

    const {data:importRow,error:importError}=await userClient.from("host_event_imports").insert({
      owner_profile_id:userId,
      source_type:"uploaded_files",
      source_label:sourceLabel,
      source_url:null,
      extracted_payload:{preview,files:sourceFiles.map(({path,...f}:any)=>f),diagnostics},
      approved_payload:{},
      status:"preview"
    }).select("id").single();
    if(importError) throw importError;

    const {error:fileRowError}=await userClient.from("host_event_import_files").insert(sourceFiles.map((f:any)=>({
      import_id:importRow.id,
      owner_profile_id:userId,
      storage_path:f.path,
      original_name:f.name,
      mime_type:f.mimeType,
      size_bytes:f.size,
      status:extractionSource==="ai"?"analyzed":"failed"
    })));
    if(fileRowError) throw fileRowError;

    return json({importId:importRow.id,preview,sourceLabel,sourceUrl:null,extractionSource,duplicate:null,files:sourceFiles.map(({path,...f}:any)=>f)});
  } catch(error){
    console.error("host-import-upload-preview",error);
    return json({error:error instanceof Error?error.message:"Unable to analyze these event files."},500);
  }
});