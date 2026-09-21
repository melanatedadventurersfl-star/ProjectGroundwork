import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const ORIGIN="https://melanatedadventurersfl-star.github.io";
Deno.serve(async (req) => {
  const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Vary":"Origin"};
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers});
  try{
    const raw=await req.text();
    if(raw.length>4096) return new Response(JSON.stringify({error:"Request too large"}),{status:413,headers});
    const body=JSON.parse(raw||"{}");
    const email=String(body.email||"").trim().toLowerCase();
    const password=String(body.password||"");
    const displayName=String(body.displayName||"").trim().slice(0,80);
    if(!displayName) return new Response(JSON.stringify({error:"Display name is required."}),{status:400,headers});
    if(!email.includes("@")||email.length>254) return new Response(JSON.stringify({error:"Enter a valid email address."}),{status:400,headers});
    if(password.length<6||password.length>128) return new Response(JSON.stringify({error:"Password must be 6 to 128 characters."}),{status:400,headers});
    const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
    if(!secret) throw new Error("Missing admin key");
    const admin=createClient(Deno.env.get("SUPABASE_URL")||"",secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName}});
    if(error){
      const exists=/already|registered|exists/i.test(error.message||"");
      return new Response(JSON.stringify({error:exists?"An account may already exist for that email. Try signing in or use Forgot Password.":"Could not create the account."}),{status:exists?409:400,headers});
    }
    return new Response(JSON.stringify({ok:true}),{status:201,headers});
  }catch(error){
    console.error("workout-signup failed",error);
    return new Response(JSON.stringify({error:"Could not create the account."}),{status:500,headers});
  }
});