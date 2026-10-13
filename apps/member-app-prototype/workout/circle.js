/* GO Workout Your Circle: secure notifications, accountability and activity overview. */
(() => {
  'use strict';
  const bridge=()=>window.GoWorkoutConnectionsBridge;
  const api=()=>bridge()?.client?.();
  const user=()=>bridge()?.userId?.();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profileName=id=>bridge()?.connectionName?.(id)||'Workout member';
  const state={uid:null,loading:false,loaded:false,attempted:false,error:'',notifications:[],agreements:[],checkins:[],preferences:null,channel:null,poll:null,lastSound:null};
  function reset(){
    if(state.channel){try{api()?.removeChannel(state.channel);}catch{}}
    if(state.poll)clearInterval(state.poll);
    Object.assign(state,{uid:null,loading:false,loaded:false,attempted:false,error:'',notifications:[],agreements:[],checkins:[],preferences:null,channel:null,poll:null});
  }
  function isTogether(){return bridge()?.tab?.()==='together';}
  const repaint=()=>{if(isTogether())bridge()?.render?.();};
  function notify(text){bridge()?.toast?.(text);}
  async function query(){
    const id=user();
    if(!id)return;
    if(state.uid!==id){reset();state.uid=id;}
    if(state.loading)return;
    state.loading=true;
    state.attempted=true;
    try{
      const db=api();
      const responses=await Promise.all([
        db.from('workout_circle_notifications').select('id,actor_id,kind,reference_id,created_at,read_at').eq('recipient_id',id).order('created_at',{ascending:false}).limit(30),
        db.from('workout_accountability_agreements').select('id,requester_id,partner_id,goal_id,frequency,support_style,status,created_at,accepted_at,updated_at').order('updated_at',{ascending:false}),
        db.from('workout_circle_preferences').select('requests_enabled,encouragement_enabled,invites_enabled,milestones_enabled,accountability_enabled').eq('user_id',id).maybeSingle()
      ]);
      if(id!==user())return;
      for(const r of responses)if(r.error)throw r.error;
      const agreements=responses[1].data||[],ids=agreements.filter(a=>a.status==='active').map(a=>a.id);
      let checkins=[];
      if(ids.length){
        const latest=await db.from('workout_accountability_checkins')
          .select('id,agreement_id,sender_id,signal,note,created_at').in('agreement_id',ids)
          .order('created_at',{ascending:false}).limit(60);
        if(latest.error)throw latest.error;
        checkins=latest.data||[];
      }
      state.notifications=responses[0].data||[];
      state.agreements=agreements;
      state.checkins=checkins;
      state.preferences=responses[2].data;
      state.loaded=true;state.error='';
      attachRealtime(id);
      badge();
    }catch(e){state.error='Your Circle did not refresh. '+String(e?.message||'Retry.');}
    finally{state.loading=false;repaint();}
  }
  function attachRealtime(id){
    if(state.channel||!api()?.channel)return;
    try{
      const channel=api().channel('go-workout-circle-'+id);
      channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'workout_circle_notifications',filter:'recipient_id=eq.'+id},payload=>{
        if(user()!==id)return;
        const row=payload.new;
        if(row&&state.lastSound!==row.id){state.lastSound=row.id;notify('New activity in Your Circle');}
        void query();
        void window.GoWorkoutConnections?.refresh?.();
      }).subscribe();
      state.channel=channel;
    }catch(e){console.warn('Your Circle realtime unavailable, using periodic refresh',e);}
    if(!state.poll){
      state.poll=setInterval(()=>{if(user()!==id){reset();return;}
        if(document.visibilityState==='visible'&&isTogether())void query();
      },45000);
    }
  }
  function badge(){
    const count=state.notifications.filter(n=>!n.read_at).length;
    const el=document.querySelector('.nav-item[data-tab="together"]');
    if(!el)return;
    let indicator=el.querySelector('.circle-nav-count');
    if(!indicator&&count){indicator=document.createElement('span');indicator.className='circle-nav-count';el.append(indicator);}
    if(indicator){indicator.textContent=count>9?'9+':String(count);indicator.hidden=!count;}
  }
  function detail(n){
    const person=profileName(n.actor_id);
    const copy={
      connection_request:'sent you a connection request',
      connection_accepted:'accepted your connection request',
      encouragement:'sent encouragement',
      workout_invite:'invited you to work out together',
      milestone:'reached a shared milestone',
      accountability_request:'invited you to be an accountability partner',
      accountability_accepted:'accepted your accountability invitation',
      accountability_checkin:'shared an accountability check-in'
    };
    return person+' '+(copy[n.kind]||'sent an update');
  }
  function dueInfo(a){
    const last=state.checkins.find(c=>c.agreement_id===a.id&&c.sender_id===user());
    const days=a.frequency==='biweekly'?14:7;
    const since=Date.parse(last?.created_at||a.accepted_at||a.created_at);
    if(!Number.isFinite(since))return 'Check in when you are ready';
    const due=since+days*86400000;
    return due<=Date.now()?'Your check-in is due':'Next check-in '+new Date(due).toLocaleDateString();
  }
  async function call(name,args,success){
    if(!user())return;
    try{
      const {error}=await api().rpc(name,args);
      if(error)throw error;
      if(success)notify(success);
      await query();
    }catch(e){state.error=String(e?.message||'Action failed');notify(state.error);repaint();}
  }
  async function updatePreferences(){
    if(!user())return;
    const fields=['requests_enabled','encouragement_enabled','invites_enabled','milestones_enabled','accountability_enabled'];
    const values={user_id:user(),updated_at:new Date().toISOString()};
    for(const f of fields)values[f]=Boolean(document.querySelector('[data-circle-pref="'+f+'"]')?.checked);
    const {error}=await api().from('workout_circle_preferences').upsert(values,{onConflict:'user_id'});
    if(error){notify(error.message);return;}
    notify('Notification preferences saved.');await query();
  }
  async function propose(id){
    const box=document.querySelector('[data-circle-proposal="'+id+'"]');
    if(!box)return;
    const goal=box.querySelector('[data-circle-goal]')?.value||null;
    const frequency=box.querySelector('[data-circle-frequency]')?.value||'weekly';
    const style=box.querySelector('[data-circle-style]')?.value||'encouragement';
    await call('workout_accountability_propose',{p_partner_id:id,p_goal_id:goal,p_frequency:frequency,p_support_style:style},'Accountability request sent.');
  }
  async function checkin(id){
    const box=document.querySelector('[data-circle-checkin="'+id+'"]');
    if(!box)return;
    const signal=box.querySelector('[data-circle-signal]')?.value||'on_track';
    const note=box.querySelector('[data-circle-note]')?.value||'';
    await call('workout_accountability_checkin',{p_agreement_id:id,p_signal:signal,p_note:note},'Check-in shared.');
  }
  function panel({accepted=[]}={}){
    if(!user())return '';
    if(!state.loaded&&!state.loading&&!state.attempted)queueMicrotask(()=>{void query();});
    const unread=state.notifications.filter(n=>!n.read_at);
    const active=state.agreements.filter(a=>a.status==='active');
    const newRequests=state.agreements.filter(a=>a.status==='pending'&&a.partner_id===user());
    const agreementsByPerson=new Set(state.agreements.map(a=>a.requester_id===user()?a.partner_id:a.requester_id));
    const myGoals=(bridge()?.goals?.()||[]).filter(g=>['goal_only','status','details'].includes(g.shareLevel));
    return '<div class="circle-v2" aria-label="Your Circle dashboard">'+
      '<div class="circle-v2-hero"><div><small>GO WORKOUT · TOGETHER</small><h3>Your Circle</h3><p>See your people, celebrate progress, and keep each other moving.</p></div><div class="circle-v2-mark" aria-hidden="true">♥</div></div>'+
      '<div class="circle-v2-stats"><div><strong>'+accepted.length+'</strong><span>Connections</span></div><div><strong>'+unread.length+'</strong><span>New activity</span></div><div><strong>'+active.length+'</strong><span>Accountability partners</span></div></div>'+
      (state.error?'<p role="alert" class="connections-error">'+esc(state.error)+'</p>':'')+
      '<div class="circle-v2-columns"><section class="connections-card circle-v2-activity"><div class="circle-v2-title"><h4>Activity</h4><button data-circle-action="refresh" type="button" class="connections-subtle">Refresh</button></div>'+
        (state.notifications.length?state.notifications.slice(0,12).map(n=>'<div class="circle-v2-event '+(n.read_at?'':'is-unread')+'"><span class="circle-v2-dot" aria-hidden="true"></span><div><strong>'+esc(detail(n))+'</strong><small>'+esc(new Date(n.created_at).toLocaleString())+'</small></div>'+(n.read_at?'':'<button type="button" class="connections-subtle" data-circle-action="read" data-circle-id="'+esc(n.id)+'">Mark read</button>')+'</div>').join('')
          :'<p class="connections-muted">Requests, encouragement, and shared milestones will appear here.</p>')+
      '</section>'+
      '<section class="connections-card"><h4>Accountability partners</h4><p class="connections-muted">Mutual check-ins. Each person controls what goals they share.</p>'+
       (newRequests.length?newRequests.map(a=>'<div class="circle-v2-agreement"><strong>'+esc(profileName(a.requester_id))+' invited you</strong><small>'+esc(a.frequency)+' check-ins · '+esc(a.support_style)+'</small><div class="circle-v2-actions"><button type="button" class="connections-button" data-circle-action="accept" data-circle-id="'+esc(a.id)+'">Accept</button><button type="button" class="connections-subtle" data-circle-action="decline" data-circle-id="'+esc(a.id)+'">Decline</button></div></div>').join(''):'')+
       (active.length?active.map(a=>{
         const other=a.requester_id===user()?a.partner_id:a.requester_id;
         const last=state.checkins.find(c=>c.agreement_id===a.id);
         return '<div class="circle-v2-agreement"><strong>'+esc(profileName(other))+'</strong><small>'+esc(dueInfo(a))+'</small>'+
            (last?'<p class="connections-muted">Last check-in: '+esc(last.signal.replace('_',' '))+' · '+esc(new Date(last.created_at).toLocaleDateString())+'</p>':'')+
            '<div data-circle-checkin="'+esc(a.id)+'" class="circle-v2-form"><label>How is training going?<select data-circle-signal><option value="on_track">On track</option><option value="need_support">Need support</option><option value="recovery">Taking recovery time</option><option value="celebrate">Celebrating progress</option></select></label>'+
            '<label>Personal note (optional)<input data-circle-note maxlength="240" placeholder="What would help this week?"></label>'+
            '<button type="button" data-circle-action="checkin" data-circle-id="'+esc(a.id)+'" class="connections-button">Send check-in</button></div>'+
            '<div class="circle-v2-actions"><button type="button" class="connections-subtle" data-circle-action="pause" data-circle-id="'+esc(a.id)+'">Pause</button><button type="button" class="connections-subtle" data-circle-action="remove" data-circle-id="'+esc(a.id)+'">End agreement</button></div></div>';
       }).join(''):'')+
       (state.agreements.filter(a=>a.status==='paused').map(a=>'<div class="circle-v2-agreement"><strong>'+esc(profileName(a.requester_id===user()?a.partner_id:a.requester_id))+'</strong><small>Agreement paused</small><button type="button" data-circle-action="resume" data-circle-id="'+esc(a.id)+'" class="connections-small">Resume check-ins</button></div>').join(''))+
       (state.agreements.filter(a=>a.status==='pending'&&a.requester_id===user()).map(a=>'<div class="circle-v2-agreement"><strong>'+esc(profileName(a.partner_id))+'</strong><small>Invitation pending</small><button type="button" data-circle-action="remove" data-circle-id="'+esc(a.id)+'" class="connections-subtle">Cancel invite</button></div>').join(''))+
       (!state.agreements.length?'<p class="connections-muted">Invite someone below to support each other each week.</p>':'')+
       accepted.filter(p=>!agreementsByPerson.has(p.otherId)).map(p=>
         '<div class="circle-v2-agreement"><strong>Invite '+esc(p.name)+'</strong><div data-circle-proposal="'+esc(p.otherId)+'" class="circle-v2-form">'+
         '<label>Share a goal (optional)<select data-circle-goal><option value="">General accountability</option>'+
          myGoals.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join('')+'</select></label>'+
         '<label>Check-in schedule<select data-circle-frequency><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option></select></label>'+
         '<label>Support preference<select data-circle-style><option value="encouragement">Encouragement</option><option value="checkin">Check-ins</option><option value="workout">Work out together</option></select></label>'+
         '<button type="button" class="connections-button" data-circle-action="propose" data-circle-user="'+esc(p.otherId)+'">Invite as accountability partner</button></div></div>'
       ).join('')+
      '</section></div>'+
      '<details class="circle-v2-preferences"><summary>Activity notification preferences</summary><div class="connections-card"><p class="connections-muted">Choose the updates that appear in your Circle. These settings do not enable background push notifications.</p>'+
        [['requests_enabled','Connection requests'],['encouragement_enabled','Encouragement'],['invites_enabled','Workout invitations'],['milestones_enabled','Shared milestones'],['accountability_enabled','Accountability updates']].map(([id,title])=>
          '<label class="connections-toggle"><input type="checkbox" data-circle-pref="'+id+'" '+(state.preferences?.[id]===false?'':'checked')+'>'+title+'</label>').join('')+
        '<button type="button" data-circle-action="preferences" class="connections-button">Save preferences</button></div></details>'+
      '</div>';
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('[data-circle-action]');if(!b)return;
    event.preventDefault();
    const action=b.dataset.circleAction,id=b.dataset.circleId;
    if(action==='refresh')void query();
    else if(action==='read')void call('workout_circle_mark_read',{p_id:id});
    else if(action==='preferences')void updatePreferences();
    else if(action==='propose')void propose(b.dataset.circleUser);
    else if(['accept','decline','pause','resume','remove'].includes(action)){
      if(action==='remove'&&!confirm('End this accountability agreement?'))return;
      void call('workout_accountability_action',{p_id:id,p_action:action},action==='accept'?'Accountability started.':'Agreement updated.');
    }else if(action==='checkin')void checkin(id);
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&isTogether())void query();});
  window.GoWorkoutCircle={panel,refresh:query,reset,getState:()=>state};
})();