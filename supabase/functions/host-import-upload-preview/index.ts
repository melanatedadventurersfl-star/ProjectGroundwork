import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import JSZip from "npm:jszip@3.10.1";

const MODEL = "gpt-5.6";
const MAX_FILES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 4 * 1024 * 1024;
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
function schema() { return { type: "object", additionalProperties: false, required: ["title","summary","description","category","difficulty","startsAt","endsAt","venueName","address","city","state","capacity","meetingInstructions","heroImageUrl","tickets","schedule","meals","policies","photos","confidenceNotes"], properties: { title:{type:"string"}, summary:{type:"string"}, description:{type:"string"}, category:{type:"string",enum:["Hiking","Camping","Paddling","Beach","Cycling","Social","Workshop","Volunteer","Other"]}, difficulty:{type:"string",enum:["easy","moderate","challenging"]}, startsAt:{type:"string"}, endsAt:{type:"string"}, venueName:{type:"string"}, address:{type:"string"}, city:{type:"string"}, state:{type:"string"}, capacity:{type:["integer","null"]}, meetingInstructions:{type:"string"}, heroImageUrl:{type:"string"}, tickets:{type:"array",maxItems:20,items:{type:"object",additionalProperties:false,required:["label","priceText"],properties:{label:{type:"string"},priceText:{type:"string"}}}}, schedule:{type:"array",maxItems:50,items:{type:"object",additionalProperties:false,required:["time","title"],properties:{time:{type:"string"},title:{type:"string"}}}}, meals:{type:"array",maxItems:30,items:{type:"string"}}, policies:{type:"array",maxItems:30,items:{type:"string"}}, photos:{type:"array",maxItems:20,items:{type:"string"}}, confidenceNotes:{type:"array",maxItems:20,items:{type:"string"}} } }; }
function readOutputText(payload: any) { if (typeof payload?.output_text === "string") return payload.output_text; for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text; return ""; }
function basicPreview(files: string[]) { return { title:"Imported Event",summary:"",description:"",category:"Other",difficulty:"easy",startsAt:"",endsAt:"",venueName:"",address:"",city:"",state:"FL",capacity:null,meetingInstructions:"",heroImageUrl:"",tickets:[],schedule:[],meals:[],policies:[],photos:[],confidenceNotes:[`Automatic extraction was unavailable. Review the ${files.length} uploaded source file${files.length === 1 ? "" : "s"} manually.`] }; }
function decodeXmlEntities(value: string) { return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'"); }
async function extractDocxText(bytes: Uint8Array) { const docx = await JSZip.loadAsync(bytes); const file = docx.file("word/document.xml"); if (!file) return ""; const xml = await file.async("string"); return decodeXmlEntities(xml.replace(/<w:tab[^>]*\/>/g,"\t").replace(/<w:br[^>]*\/>/g,"\n").replace(/<\/w:p>/g,"\n").replace(/<[^>]+>/g,"")).replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim().slice(0,30000); }

async function appendFileContent(items: any[], name: string, mime: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${name} is larger than 10 MB.`);
  if (mime.startsWith("image/")) {
    if (mime === "image/heic" || mime === "image/heif") { items.push({type:"input_text",text:`Image source ${name} was uploaded in ${mime} format. Record it as source media, but do not infer visual details.`}); return; }
    items.push({type:"input_image",image_url:`data:${mime};base64,${bytesToBase64(bytes)}`});
    items.push({type:"input_text",text:`The preceding image came from source file: ${name}`});
    return;
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = await extractDocxText(bytes);
    items.push({type:"input_text",text:`SOURCE FILE: ${name}\n${text || "No readable Word document text was found."}`});
    return;
  }
  if (mime === "text/plain" || mime === "text/html") {
    const text = new TextDecoder().decode(bytes).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,30000);
    items.push({type:"input_text",text:`SOURCE FILE: ${name}\n${text}`});
    return;
  }
  const filename = name.replace(/[\\/]+/g,"__").slice(-240);
  items.push({type:"input_file",filename,file_data:`data:${mime};base64,${bytesToBase64(bytes)}`});
}

async function runExtraction(key: string, content: any[]) {
  const upstream = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`}, body:JSON.stringify({ model:MODEL, instructions:"Extract one event draft from the supplied event materials. Return only facts supported by the files. Leave uncertain fields empty. Never invent ticket prices, policies, dates, capacity, location, ownership, or contacts. startsAt and endsAt must be local YYYY-MM-DDTHH:MM strings only when clearly supported. Preserve schedule, meals, ticket details, policies, venue rules, guest instructions, and source conflicts. In confidenceNotes cite filenames for contradictions, outdated-year material, missing critical information, or ambiguous values. Every host reviews the draft before creating the event.", input:[{role:"user",content}], text:{format:{type:"json_schema",name:"host_event_upload_preview",strict:true,schema:schema()}} }) });
  const payload = await upstream.json();
  if (!upstream.ok) { console.error("host-import-upload-preview OpenAI", upstream.status, JSON.stringify(payload)); return null; }
  const text = readOutputText(payload);
  if (!text) { console.error("host-import-upload-preview empty OpenAI output", JSON.stringify(payload)); return null; }
  try { return JSON.parse(text); } catch (error) { console.error("host-import-upload-preview invalid JSON", error); return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({error:"Authentication required"},401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({error:"Function environment is incomplete."},503);
  const userClient = createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:userData,error:userError} = await userClient.auth.getUser(); const userId = userData.user?.id;
    if (userError || !userId) return json({error:"Authentication required"},401);
    const {data:approved,error:accessError} = await userClient.rpc("is_approved_outing_host",{p_profile_id:userId});
    if (accessError || approved !== true) return json({error:"Approved host access is required."},403);
    const body = await req.json(); const rawFiles = Array.isArray(body?.files) ? body.files.slice(0,MAX_FILES) : [];
    if (!rawFiles.length) return json({error:"Upload at least one event file."},400);
    if (Array.isArray(body?.files) && body.files.length > MAX_FILES) return json({error:`Upload up to ${MAX_FILES} files at a time.`},400);
    const sourceFiles:any[]=[];
    const content:any[]=[{type:"input_text",text:"Build one event draft from all uploaded source material. Keep facts tied to source filenames. Detect contradictions and put them in confidenceNotes. Do not choose between conflicting values silently. Leave missing fields empty."}];
    for (const raw of rawFiles) {
      const path=clean(raw?.path,1000), name=clean(raw?.name,240), supplied=clean(raw?.mimeType,160); const size=Number.isFinite(Number(raw?.size))?Number(raw.size):null;
      if (!path || !name || !safePath(path,userId)) return json({error:"One uploaded file path is invalid."},400);
      const mime=mimeFor(name,supplied); if (!supportedMime(mime)) return json({error:`${name} is not a supported event file.`},400);
      const {data:blob,error:downloadError}=await userClient.storage.from("event-imports").download(path); if(downloadError||!blob) throw downloadError??new Error(`Unable to read ${name}.`);
      const bytes=new Uint8Array(await blob.arrayBuffer()); if(bytes.byteLength>MAX_FILE_BYTES) return json({error:`${name} is larger than 10 MB.`},400);
      sourceFiles.push({path,name,mimeType:mime,size:size??bytes.byteLength});
      if(mime==="application/zip") {
        const zip=await JSZip.loadAsync(bytes); const entries=Object.values(zip.files).filter((e:any)=>!e.dir&&!e.name.includes("../")&&!e.name.startsWith("/")).slice(0,MAX_FILES);
        for(const entry of entries as any[]) { const entryMime=mimeFor(entry.name); if(!supportedMime(entryMime)||entryMime==="application/zip") continue; const entryBytes=await entry.async("uint8array"); if(entryBytes.byteLength>MAX_ZIP_ENTRY_BYTES){content.push({type:"input_text",text:`ZIP entry ${entry.name} from ${name} was skipped because it exceeds 4 MB.`});continue;} await appendFileContent(content,`${name}/${entry.name}`,entryMime,entryBytes); }
      } else await appendFileContent(content,name,mime,bytes);
    }
    const sourceLabel=sourceFiles.length===1?(sourceFiles[0]?.name??"Uploaded event file"):`${sourceFiles.length} uploaded event files`;
    let preview=basicPreview(sourceFiles.map((f:any)=>f.name)); let extractionSource:"ai"|"fallback"="fallback";
    if(openAiKey){ let extracted=await runExtraction(openAiKey,content); if(!extracted){ const reduced=content.filter((item:any)=>item.type!=="input_file"); if(reduced.length>1) extracted=await runExtraction(openAiKey,reduced); } if(extracted){preview=extracted;extractionSource="ai";} }
    const {data:importRow,error:importError}=await userClient.from("host_event_imports").insert({owner_profile_id:userId,source_type:"uploaded_files",source_label:sourceLabel,source_url:null,extracted_payload:{preview,files:sourceFiles.map(({path,...f}:any)=>f)},approved_payload:{},status:"preview"}).select("id").single(); if(importError) throw importError;
    const {error:fileRowError}=await userClient.from("host_event_import_files").insert(sourceFiles.map((f:any)=>({import_id:importRow.id,owner_profile_id:userId,storage_path:f.path,original_name:f.name,mime_type:f.mimeType,size_bytes:f.size}))); if(fileRowError) throw fileRowError;
    return json({importId:importRow.id,preview,sourceLabel,sourceUrl:null,extractionSource,duplicate:null,files:sourceFiles.map(({path,...f}:any)=>f)});
  } catch(error){ console.error("host-import-upload-preview",error); return json({error:error instanceof Error?error.message:"Unable to analyze these event files."},500); }
});