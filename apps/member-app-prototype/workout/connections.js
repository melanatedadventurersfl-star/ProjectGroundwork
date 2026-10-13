/* GO Workout Connections V1. Published social data is opt-in, private account state stays private. */
(() => {
  'use strict';
  const B = () => window.GoWorkoutConnectionsBridge;
  const client = () => B()?.client?.();
  const myId = () => B()?.userId?.();
  const goals = () => B()?.goals?.() || [];
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = v => escapeHtml(v).slice(0,300);
  const state = {profile:null,connections:[],profiles:{},shares:[],inbox:[],results:[],loaded:false,loading:false,error:'',query:'',saving:false,synced:null};
  const active = () => Boolean(client() && myId());
  const nameFor = id => state.profiles[id]?.display_name || 'Workout member';
  const notify = message => { if(B()?.toast)B().toast(message); };
  const repaint = () => B()?.render?.();

  function connectionOf(row) {
    const otherId = row.requester_id===myId()?row.recipient_id:row.requester_id;
    return {...row,otherId,name:nameFor(otherId)};
  }
  function statusOf(goal) {
    const engine = window.GoWorkoutGoalLab;
    if(goal.painFlag || goal.status==='paused') return 'Paused';
    if(engine?.meetsTarget?.(goal)) return 'Goal reached';
    const assessed = (goal.assessments||[]).filter(a=>a.source==='discovery');
    if(assessed.length<2) return 'Awaiting reassessment';
    const due = /^\d{4}-\d{2}-\d{2}$/.test(String(goal.deadline||'')) ? Date.parse(goal.deadline+'T23:59:59') : NaN;
    const start = Date.parse(goal.createdAt||'');
    const latest = Date.parse(assessed[assessed.length-1]?.at||assessed[assessed.length-1]?.recordedAt||goal.updatedAt||'');
    const best = Number(engine?.assessmentBest?.(goal) ?? goal.baseline);
    const baseline = Number(goal.baseline), target = Number(goal.target);
    if(Number.isFinite(due) && Number.isFinite(start) && due>start && due>Date.now()
      && Number.isFinite(latest) && latest>start && Date.now()-latest<21*86400000
      && Number.isFinite(best) && target>baseline) {
      const expected = Math.min(1,(Date.now()-start)/(due-start));
      const actual = Math.max(0,(best-baseline)/(target-baseline));
      return actual + 0.1 >= expected ? 'On track' : 'Needs attention';
    }
    return 'Progress recorded';
  }
  function projection(g) {
    const visibility = g.shareLevel||'private';
    const row = {owner_id:myId(),goal_id:String(g.id||''),goal_name:String(g.name||'Fitness goal').slice(0,100),visibility,progress_status:null,progress_percent:null,measured_value:null,target_value:null,unit:null};
    if(visibility==='status' || visibility==='details') row.progress_status=statusOf(g);
    if(visibility==='details') {
      const engine = window.GoWorkoutGoalLab;
      const current = Number(engine?.assessmentBest?.(g) ?? g.baseline);
      const target = Number(g.target);
      row.measured_value = Number.isFinite(current)?current:0;
      row.target_value = Number.isFinite(target)?target:0;
      row.progress_percent = target>0?Math.min(100,Math.max(0,Math.round(100*current/target))):0;
      row.unit = String(g.unit||'units').slice(0,50);
    }
    return row;
  }
  async function publishGoalShares(force=false) {
    if(!active())return;
    const publish = goals().filter(g=>g?.id && ['goal_only','status','details'].includes(g.shareLevel)).map(projection);
    const snapshot = JSON.stringify(publish);
    if(!force && snapshot===state.synced)return;
    if(state.saving)return;
    state.saving=true;
    try {
      // Delete previously shared goals that have been made private or deleted.
      const {data:existing,error:readError}=await client().from('workout_goal_shares').select('goal_id').eq('owner_id',myId());
      if(readError)throw readError;
      const keep = new Set(publish.map(x=>x.goal_id));
      for(const old of existing||[]) {
        if(!keep.has(old.goal_id)) {
          const {error}=await client().from('workout_goal_shares').delete().eq('owner_id',myId()).eq('goal_id',old.goal_id);
          if(error)throw error;
        }
      }
      if(publish.length){
        const {error}=await client().from('workout_goal_shares').upsert(publish,{onConflict:'owner_id,goal_id'});
        if(error)throw error;
      }
      state.synced=snapshot;
      state.error='';
    } catch(e) { state.error='Goal sharing did not sync. Check your connection and retry.'; notify(state.error); }
    finally {state.saving=false;}
  }
  let shareTimer = null;
  function queueGoalSync(){
    if(!active())return;
    if(shareTimer)clearTimeout(shareTimer);
    shareTimer=setTimeout(()=>{ shareTimer=null; void publishGoalShares(); },2500);
  }
  async function refresh(){
    if(!active()||state.loading)return;
    const id=myId();
    state.loading=true;
    try {
      const api=client();
      const [profileRes,connectionsRes,inboxRes,blocksRes]=await Promise.all([
        api.from('workout_connection_profiles').select('*').eq('user_id',id).maybeSingle(),
        api.from('workout_connections').select('*').order('created_at',{ascending:false}),
        api.from('workout_encouragement').select('id,sender_id,recipient_id,goal_id,message,created_at,read_at').eq('recipient_id',id).order('created_at',{ascending:false}).limit(20),
        api.from('workout_connection_blocks').select('blocked_id').eq('blocker_id',id)
      ]);
      for(const res of [profileRes,connectionsRes,inboxRes,blocksRes])if(res.error)throw res.error;
      if(id!==myId())return;
      state.profile=profileRes.data;
      state.connections=connectionsRes.data||[];
      state.inbox=inboxRes.data||[];
      state.blocks=(blocksRes.data||[]).map(x=>x.blocked_id);
      const ids=[...new Set([...state.connections.flatMap(c=>[c.requester_id,c.recipient_id]),...state.inbox.map(x=>x.sender_id)])].filter(x=>x!==id);
      state.profiles={};
      if(ids.length){
        const found=await api.from('workout_connection_profiles').select('user_id,handle,display_name,discoverable').in('user_id',ids);
        if(found.error)throw found.error;
        for(const p of found.data||[])state.profiles[p.user_id]=p;
      }
      const accepted=state.connections.filter(x=>x.status==='accepted').map(connectionOf);
      B()?.reconcilePartners?.(accepted.map(c=>c.otherId));
      for(const c of accepted)B()?.rememberPartner?.({userId:c.otherId,name:c.name,status:'connected'});
      const owners=accepted.map(x=>x.otherId);
      state.shares=[];
      if(owners.length){
        const publicGoals=await api.from('workout_goal_shares').select('owner_id,goal_id,goal_name,visibility,progress_status,progress_percent,measured_value,target_value,unit,updated_at').in('owner_id',owners);
        if(publicGoals.error)throw publicGoals.error;
        state.shares=publicGoals.data||[];
      }
      state.error='';
      state.loaded=true;
      void publishGoalShares();
    }catch(e){
      state.error='Connections could not load. '+String(e?.message||'Please retry.');
    }finally {state.loading=false;repaint();}
  }
  async function findPeople(term){
    const query=String(term||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    state.query=query;
    if(query.length<3){state.results=[];repaint();return;}
    try {
      const {data,error}=await client().from('workout_connection_profiles')
        .select('user_id,handle,display_name').eq('discoverable',true).ilike('handle',query+'%').limit(10);
      if(error)throw error;
      state.results=(data||[]).filter(x=>x.user_id!==myId());
      state.error='';
    }catch(e){state.error='Search failed. '+String(e.message||'Please retry.');}
    repaint();
  }
  async function rpc(name,args,success){
    if(!active())return;
    try {
      const {error}=await client().rpc(name,args);
      if(error)throw error;
      if(success)notify(success);
      await refresh();
    }catch(e){state.error=String(e.message||'Unable to complete the request');notify(state.error);repaint();}
  }
  async function saveProfile(){
    const handle=String(document.querySelector('[data-conn-handle]')?.value||'').trim().toLowerCase();
    const discoverable=Boolean(document.querySelector('[data-conn-discoverable]')?.checked);
    if(!/^[a-z0-9_]{3,24}$/.test(handle)){notify('Choose a username of 3–24 letters, numbers, or underscores.');return;}
    const display_name=String(B()?.displayName?.()||'Workout member').trim().slice(0,80)||'Workout member';
    const {error}=await client().from('workout_connection_profiles')
      .upsert({user_id:myId(),handle,display_name,discoverable,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error){notify(error.code==='23505'?'That username is already taken.':error.message);return;}
    notify('Connection profile saved.');
    await refresh();
  }
  async function setGoalVisibility(goalId,level){
    const g=goals().find(x=>String(x.id)===String(goalId));
    if(!g)return;
    g.shareLevel=level;
    B()?.save?.();
    state.synced=null;
    await publishGoalShares(true);
    if(!state.error)notify(level==='private'?'Goal is private.':'Goal sharing updated.');
    repaint();
  }
  async function sendEncouragement(id){
    const input=document.querySelector('[data-conn-message="'+id+'"]');
    const message=String(input?.value||'').trim();
    if(!message){notify('Write a message first.');return;}
    await rpc('workout_send_encouragement',{p_recipient_id:id,p_message:message,p_goal_id:null},'Encouragement sent.');
  }
  async function markRead(id){
    await rpc('workout_encouragement_mark_read',{p_id:id});
  }

  function panel(){
    if(!active())return '';
    if(!state.loaded&&!state.loading)queueMicrotask(()=>{void refresh();});
    const list=state.connections.map(connectionOf);
    const accepted=list.filter(x=>x.status==='accepted');
    const received=list.filter(x=>x.status==='pending'&&x.recipient_id===myId());
    const sent=list.filter(x=>x.status==='pending'&&x.requester_id===myId());
    const actions=state.results.filter(x=>!list.some(c=>c.otherId===x.user_id));
    const goalList=goals().filter(g=>g?.id&&g.status!=='deleted');
    return '<section class="connections-v1" aria-label="Your workout connections">'+
      '<div class="connections-head"><div><span class="connections-kicker">YOUR CIRCLE</span><h3>Connections &amp; encouragement</h3><p>Connect once. Share only the goals you choose. Support each other along the way.</p></div><button type="button" data-conn-action="refresh" class="connections-subtle">↻ Refresh</button></div>'+
      (state.error?'<p class="connections-error" role="alert">'+clean(state.error)+'</p>':'')+
      (!state.loaded?'<p class="connections-muted">Loading your circle…</p>':'')+
      '<div class="connections-grid"><div class="connections-card"><h4>Your connection profile</h4><p class="connections-muted">Your username makes it possible for others to find you. Discovery stays off until you enable it.</p>'+
        '<label class="connections-field">Your unique @username<input data-conn-handle maxlength="24" autocomplete="off" placeholder="e.g. trainwithme" value="'+clean(state.profile?.handle||'')+'"></label>'+
        '<label class="connections-toggle"><input type="checkbox" data-conn-discoverable '+(state.profile?.discoverable?'checked':'')+'> Allow members to find me by username</label>'+
        '<button type="button" data-conn-action="save-profile" class="connections-button">Save connection profile</button></div>'+
      '<div class="connections-card"><h4>Find someone</h4><p class="connections-muted">Search for a member who has enabled discovery.</p>'+
        '<div class="connections-search"><input data-conn-search placeholder="Search @username" value="'+clean(state.query)+'" autocomplete="off"><button type="button" data-conn-action="search" class="connections-button">Find</button></div>'+
        actions.map(p=>'<div class="connections-person"><div class="connections-avatar">'+clean(p.display_name.slice(0,1).toUpperCase())+'</div><div><strong>'+clean(p.display_name)+'</strong><small>@'+clean(p.handle)+'</small></div><button type="button" class="connections-small" data-conn-action="request" data-conn-handle-value="'+clean(p.handle)+'">Connect</button></div>').join('')+
        (state.query.length>=3&&!state.results.length?'<p class="connections-muted">No discoverable usernames found.</p>':'')+
      '</div></div>'+
      (received.length?'<div class="connections-card"><h4>Requests to review ('+received.length+')</h4>'+received.map(c=>'<div class="connections-person"><div class="connections-avatar">+</div><div><strong>'+clean(c.name)+'</strong><small>Wants to connect</small></div><button type="button" class="connections-small" data-conn-action="accept" data-conn-id="'+clean(c.id)+'">Accept</button><button type="button" class="connections-subtle" data-conn-action="decline" data-conn-id="'+clean(c.id)+'">Decline</button></div>').join('')+'</div>':'')+
      (sent.length?'<div class="connections-card"><h4>Sent requests</h4>'+sent.map(c=>'<div class="connections-person"><div class="connections-avatar">…</div><div><strong>'+clean(c.name)+'</strong><small>Waiting for approval</small></div><button type="button" class="connections-subtle" data-conn-action="remove" data-conn-id="'+clean(c.id)+'">Cancel</button></div>').join('')+'</div>':'')+
      '<div class="connections-card"><h4>Connected people ('+accepted.length+')</h4>'+
       (accepted.length?accepted.map(c=>{
        const shared=state.shares.filter(g=>g.owner_id===c.otherId);
        return '<article class="connections-friend"><div class="connections-person"><div class="connections-avatar">'+clean(c.name.slice(0,1).toUpperCase())+'</div><div><strong>'+clean(c.name)+'</strong><small>@'+clean(state.profiles[c.otherId]?.handle||'member')+'</small></div><button type="button" class="connections-subtle" data-conn-action="remove" data-conn-id="'+clean(c.id)+'">Remove</button><button type="button" class="connections-subtle" data-conn-action="block" data-conn-user="'+clean(c.otherId)+'">Block</button></div>'+
        (shared.length?shared.map(g=>'<div class="connections-goal"><strong>'+clean(g.goal_name)+'</strong>'+
          (g.progress_status?'<span>'+clean(g.progress_status)+'</span>':'')+
          (g.visibility==='details'?'<small>'+clean(g.measured_value)+' / '+clean(g.target_value)+' '+clean(g.unit)+' · '+clean(g.progress_percent)+'%</small>':'')+'</div>').join(''):'<p class="connections-muted">No goals shared with connections.</p>')+
        '<div class="connections-search"><input maxlength="240" data-conn-message="'+clean(c.otherId)+'" aria-label="Encouragement for '+clean(c.name)+'" placeholder="You have got this! 💪"><button type="button" class="connections-button" data-conn-action="send" data-conn-user="'+clean(c.otherId)+'">Encourage</button></div></article>';
       }).join(''):'<p class="connections-muted">No connections yet. Create a username and send your first request.</p>')+'</div>'+
      '<div class="connections-card"><h4>My goal sharing</h4><p class="connections-muted">Private by default. Only accepted connections can see goals you share.</p>'+
        (goalList.length?goalList.map(g=>'<label class="connections-share-row"><span>'+clean(g.name||'Goal')+'</span><select data-conn-goal-id="'+clean(g.id)+'" aria-label="Sharing for '+clean(g.name)+'">'+
          [['private','Private'],['goal_only','Goal name only'],['status','Goal and status'],['details','Goal and progress details']].map(pair=>'<option value="'+pair[0]+'" '+((g.shareLevel||'private')===pair[0]?'selected':'')+'>'+pair[1]+'</option>').join('')+
        '</select></label>').join(''):'<p class="connections-muted">Set a Personal Goal to share progress with your circle.</p>')+
      '</div>'+
      '<div class="connections-card"><h4>Encouragement inbox</h4>'+
        (state.inbox.length?state.inbox.slice(0,10).map(m=>'<div class="connections-inbox"><strong>'+clean(nameFor(m.sender_id))+'</strong><p>'+clean(m.message)+'</p><small>'+clean(new Date(m.created_at).toLocaleDateString())+'</small>'+(m.read_at?'':'<button type="button" class="connections-subtle" data-conn-action="read" data-conn-id="'+clean(m.id)+'">Mark read</button>')+'</div>').join(''):'<p class="connections-muted">Messages from your connections will appear here.</p>')+
      '</div>'+
      (state.blocks?.length?'<div class="connections-card"><h4>Blocked members</h4>'+state.blocks.map(id=>'<div class="connections-person"><span>Blocked member</span><button class="connections-subtle" type="button" data-conn-action="unblock" data-conn-user="'+clean(id)+'">Unblock</button></div>').join('')+'</div>':'')+
    '</section>';
  }
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-conn-action]');
    if(!btn)return;
    event.preventDefault();
    const act=btn.dataset.connAction, id=btn.dataset.connId, user=btn.dataset.connUser;
    if(act==='refresh')void refresh();
    else if(act==='search')void findPeople(document.querySelector('[data-conn-search]')?.value);
    else if(act==='save-profile')void saveProfile();
    else if(act==='request')void rpc('workout_connection_request',{p_handle:btn.dataset.connHandleValue},'Connection request sent.');
    else if(act==='accept'||act==='decline')void rpc('workout_connection_respond',{p_connection_id:id,p_accept:act==='accept'},act==='accept'?'Connection accepted.':'Request declined.');
    else if(act==='remove'&&confirm('Remove this connection or request?'))void rpc('workout_connection_remove',{p_connection_id:id},'Connection removed.');
    else if(act==='block'&&confirm('Block this member? They will not be able to reconnect or send encouragement.'))void rpc('workout_connection_block',{p_user_id:user},'Member blocked.');
    else if(act==='unblock')void rpc('workout_connection_unblock',{p_user_id:user},'Member unblocked.');
    else if(act==='send')void sendEncouragement(user);
    else if(act==='read')void markRead(id);
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('[data-conn-goal-id]'))void setGoalVisibility(event.target.dataset.connGoalId,event.target.value);
  });
  window.GoWorkoutConnections={panel,refresh,queueGoalSync,publishGoalShares};
})();
