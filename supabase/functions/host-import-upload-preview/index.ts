import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import JSZip from "npm:jszip@3.10.1";

const MAX_FILES=12;
const MAX_FILE_BYTES=10*1024*1024;
const MAX_ZIP_ENTRY_BYTES=4*1024*1024;
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const jsonHeaders={...corsHeaders,"Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:jsonHeaders});
const clean=(v:unknown,max=5000)=>String(v??"").trim().slice(0,max);
const safePath=(path:string,userId:string)=>path.startsWith(`${userId}/`)&&!path.includes("../")&&!path.includes("\\");
const normalize=(v:unknown)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function mimeFor(name:string,supplied=""){
  if(supplied&&supplied!=="application/octet-stream") return supplied;
  const n=name.toLowerCase();
  if(n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if(n.endsWith(".txt")) return "text/plain";
  if(n.endsWith(".html")||n.endsWith(".htm")) return "text/html";
  if(n.endsWith(".zip")) return "application/zip";
  if(n.endsWith(".pdf")) return "application/pdf";
  if(n.endsWith(".png")) return "image/png";
  if(n.endsWith(".jpg")||n.endsWith(".jpeg")) return "image/jpeg";
  if(n.endsWith(".webp")) return "image/webp";
  if(n.endsWith(".heic")||n.endsWith(".heif")) return "image/heic";
  return "application/octet-stream";
}
function supportedMime(m:string){return m==="application/pdf"||m==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"||m==="text/plain"||m==="text/html"||m==="application/zip"||m.startsWith("image/");}
function decodeXmlEntities(v:string){return v.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
async function extractDocxText(bytes:Uint8Array){const docx=await JSZip.loadAsync(bytes);const file=docx.file("word/document.xml");if(!file)return"";const xml=await file.async("string");return decodeXmlEntities(xml.replace(/<w:tab[^>]*\/>/g,"\t").replace(/<w:br[^>]*\/>/g,"\n").replace(/<\/w:p>/g,"\n").replace(/<[^>]+>/g,"")).replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim().slice(0,40000);}
function htmlToText(raw:string){return raw.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,40000);}
function monthNumber(name:string){const m:any={january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",july:"07",august:"08",september:"09",october:"10",november:"11",december:"12"};return m[name.toLowerCase()]||"";}
function to24(hour:number,minute:number,ampm:string){let h=hour%12;if(ampm.toLowerCase()==="pm")h+=12;return `${String(h).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;}
function unique<T>(a:T[]){return [...new Set(a)];}
function findLine(text:string,label:string){const m=text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`,`im`));return clean(m?.[1]||"",1000);}
function basePreview(){return{title:"Imported Event",summary:"",description:"",category:"Other",difficulty:"easy",startsAt:"",endsAt:"",venueName:"",address:"",city:"",state:"FL",capacity:null,meetingInstructions:"",heroImageUrl:"",tickets:[],schedule:[],meals:[],policies:[],photos:[],confidenceNotes:[] as string[]};}

function extractFromText(sources:{name:string,text:string}[],sourceNames:string[]){
  const p:any=basePreview();
  const currentSources=sources.filter(s=>!/(^|[\/_-])old([\/_-]|$)|archive/i.test(s.name));
  const current=currentSources.map(s=>s.text).join("\n\n");
  const notes:string[]=[];
  const titleCandidates:string[]=[];
  for(const s of currentSources){for(const line of s.text.split(/\r?\n/).map(x=>x.trim())){if(line.length<180&&/\b20\d{2}\b/.test(line)&&/(escape|camp|adventure|event)/i.test(line)){titleCandidates.push(line.replace(/\s+-\s+.*$/,"").trim());break;}}}
  if(titleCandidates.length)p.title=titleCandidates.sort((a,b)=>b.length-a.length)[0];
  const purpose=findLine(current,"Purpose");if(purpose){p.summary=purpose;p.description=purpose;}
  const venue=findLine(current,"Venue");if(venue){p.venueName=venue;const parts=venue.split(",").map(x=>x.trim());if(parts.length>=2){p.city=parts[parts.length-2];p.state=parts[parts.length-1].replace(/^Florida$/i,"FL");}}
  if(/beach/i.test(`${p.title} ${current}`))p.category="Beach";else if(/camp/i.test(current))p.category="Camping";
  const dm=current.match(/Event dates\s*:\s*([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(20\d{2})/i);
  if(dm){const mm=monthNumber(dm[1]);const arr=current.match(/Arrival window\s*:\s*Friday beginning at\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);const dep=current.match(/Departure\s*:\s*Sunday by\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);const st=arr?to24(Number(arr[1]),Number(arr[2]||0),arr[3]):"00:00";const et=dep?to24(Number(dep[1]),Number(dep[2]||0),dep[3]):"23:59";p.startsAt=`${dm[4]}-${mm}-${String(dm[2]).padStart(2,"0")}T${st}`;p.endsAt=`${dm[4]}-${mm}-${String(dm[3]).padStart(2,"0")}T${et}`;}
  const caps=unique([...current.matchAll(/(?:capacity(?: note)?|target capacity)[^\d]{0,40}(\d{1,4})/gi)].map(m=>Number(m[1])).filter(Number.isFinite));
  if(caps.length===1)p.capacity=caps[0];else if(caps.length>1){p.capacity=null;notes.push(`Conflicting capacity values found: ${caps.join(" and ")}. Review before publishing.`);}
  const mealSource=currentSources.find(s=>/meal|food/i.test(s.name));if(mealSource){p.meals=mealSource.text.split(/\r?\n/).map(x=>x.trim()).filter(x=>/^(Friday|Saturday|Sunday)\s+(Breakfast|Lunch|Dinner)$/i.test(x)).slice(0,30);}
  if(/Refund policy is not yet final/i.test(current))p.policies.push("Refund policy is not yet final.");
  const refund=current.match(/Refund requests must be submitted[^.]+\./i);if(refund)p.policies.push(clean(refund[0],1000));
  const transfer=current.match(/Transfers may be approved[^.]+\./i);if(transfer)p.policies.push(clean(transfer[0],1000));
  if(/Weather may require schedule changes or early closure/i.test(current))p.policies.push("Weather may require schedule changes or early closure.");
  if(/Children must remain under the supervision/i.test(current))p.policies.push("Children must remain under the supervision of their parent or guardian.");
  const ops=currentSources.find(s=>/operations|gear/i.test(s.name));if(ops){p.meetingInstructions=ops.text.split(/\r?\n/).map(x=>x.trim()).filter(x=>/High wind|Lightning|emergency contact/i.test(x)).join(" ").slice(0,5000);}
  for(const s of sources.filter(s=>/(^|[\/_-])old([\/_-]|$)|archive/i.test(s.name)))notes.push(`${s.name} appears to be historical or archived material and was not used for current event fields.`);
  if(/Refund policy is not yet final/i.test(current))notes.push("Refund terms are not final. Do not publish a refund deadline from this import.");
  if(!sources.length)notes.push(`No readable DOCX, TXT, or HTML text was found in the ${sourceNames.length} uploaded source file${sourceNames.length===1?"":"s"}.`);
  if(p.title==="Imported Event")notes.push("No reliable event title was found in readable source text.");
  p.confidenceNotes=unique(notes).slice(0,30);
  return p;
}

async function collectSource(name:string,mime:string,bytes:Uint8Array,sources:{name:string,text:string}[]){
  if(mime==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"){const text=await extractDocxText(bytes);if(text)sources.push({name,text});}
  else if(mime==="text/plain"){const text=new TextDecoder().decode(bytes).trim().slice(0,40000);if(text)sources.push({name,text});}
  else if(mime==="text/html"){const text=htmlToText(new TextDecoder().decode(bytes));if(text)sources.push({name,text});}
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const authHeader=req.headers.get("Authorization");if(!authHeader)return json({error:"Authentication required"},401);
  const supabaseUrl=Deno.env.get("SUPABASE_URL"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");if(!supabaseUrl||!anonKey)return json({error:"Function environment is incomplete."},503);
  const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const {data:userData,error:userError}=await userClient.auth.getUser();const userId=userData.user?.id;if(userError||!userId)return json({error:"Authentication required"},401);
    const {data:approved,error:accessError}=await userClient.rpc("is_approved_outing_host",{p_profile_id:userId});if(accessError||approved!==true)return json({error:"Approved host access is required."},403);
    const body=await req.json();const rawFiles=Array.isArray(body?.files)?body.files.slice(0,MAX_FILES):[];if(!rawFiles.length)return json({error:"Upload at least one event file."},400);if(Array.isArray(body?.files)&&body.files.length>MAX_FILES)return json({error:`Upload up to ${MAX_FILES} files at a time.`},400);
    const sourceFiles:any[]=[],sources:{name:string,text:string}[]=[];
    for(const raw of rawFiles){const path=clean(raw?.path,1000),name=clean(raw?.name,240),supplied=clean(raw?.mimeType,160),size=Number.isFinite(Number(raw?.size))?Number(raw.size):null;if(!path||!name||!safePath(path,userId))return json({error:"One uploaded file path is invalid."},400);const mime=mimeFor(name,supplied);if(!supportedMime(mime))return json({error:`${name} is not a supported event file.`},400);const {data:blob,error:downloadError}=await userClient.storage.from("event-imports").download(path);if(downloadError||!blob)throw downloadError??new Error(`Unable to read ${name}.`);const bytes=new Uint8Array(await blob.arrayBuffer());if(bytes.byteLength>MAX_FILE_BYTES)return json({error:`${name} is larger than 10 MB.`},400);sourceFiles.push({path,name,mimeType:mime,size:size??bytes.byteLength});if(mime==="application/zip"){const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files).filter((e:any)=>!e.dir&&!e.name.includes("../")&&!e.name.startsWith("/")).slice(0,MAX_FILES);for(const entry of entries as any[]){const em=mimeFor(entry.name);if(!supportedMime(em)||em==="application/zip")continue;const eb=await entry.async("uint8array");if(eb.byteLength>MAX_ZIP_ENTRY_BYTES)continue;await collectSource(`${name}/${entry.name}`,em,eb,sources);}}else await collectSource(name,mime,bytes,sources);}
    const names=sourceFiles.map((f:any)=>f.name);const sourceLabel=sourceFiles.length===1?(sourceFiles[0]?.name??"Uploaded event file"):`${sourceFiles.length} uploaded event files`;const preview=extractFromText(sources,names);const extractionSource=sources.length?"source":"fallback";

    let match:any=null;
    if(preview.title&&preview.title!=="Imported Event"){
      const {data:candidates}=await userClient.from("adventures").select("id,title,starts_at,venue_name,city,state,created_at").eq("created_by",userId).order("created_at",{ascending:true}).limit(100);
      const previewDate=preview.startsAt?String(preview.startsAt).slice(0,10):"";
      match=(candidates??[]).find((candidate:any)=>{
        if(normalize(candidate.title)!==normalize(preview.title))return false;
        const sameDate=previewDate&&String(candidate.starts_at??"").slice(0,10)===previewDate;
        const sameVenue=preview.venueName&&candidate.venue_name&&normalize(preview.venueName)===normalize(candidate.venue_name);
        const sameCity=preview.city&&candidate.city&&normalize(preview.city)===normalize(candidate.city)&&normalize(preview.state)===normalize(candidate.state);
        return Boolean(sameDate||sameVenue||sameCity);
      })??null;
    }

    const {data:importRow,error:importError}=await userClient.from("host_event_imports").insert({owner_profile_id:userId,adventure_id:match?.id??null,source_type:"uploaded_files",source_label:sourceLabel,source_url:null,extracted_payload:{preview,files:sourceFiles.map(({path,...f}:any)=>f),sourceTextFiles:sources.map(s=>s.name),diagnostics:["Draft built directly from readable source files."]},approved_payload:{},status:"preview"}).select("id").single();if(importError)throw importError;
    const {error:fileRowError}=await userClient.from("host_event_import_files").insert(sourceFiles.map((f:any)=>({import_id:importRow.id,owner_profile_id:userId,storage_path:f.path,original_name:f.name,mime_type:f.mimeType,size_bytes:f.size})));if(fileRowError)throw fileRowError;
    const duplicate=match?{importId:importRow.id,adventureId:match.id,sourceLabel:match.title,status:"existing_event"}:null;
    return json({importId:importRow.id,preview,sourceLabel,sourceUrl:null,extractionSource,duplicate,files:sourceFiles.map(({path,...f}:any)=>f)});
  }catch(error){console.error("host-import-upload-preview",error);return json({error:error instanceof Error?error.message:"Unable to analyze these event files."},500);}
});