(function(){
  const core=window.GoWorkoutHealthConnectCore;
  if(!core)return;

  const STATE_KEY='goworkout-health-connect-v1';
  const CHANNEL='goworkout-health-connect';
  const DEFAULT_STATE={
    connected:false,
    permissions:[],
    lastSyncAt:'',
    lastImportCount:0,
    syncDays:30,
    toggles:{workouts:true,heartRate:true,calories:true,distance:true,steps:true}
  };
  const pending=new Map();
  let sheetOpen=false;
  let busy=false;
  let messageCounter=0;

  function readState(){
    try{
      const saved=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');
      return {...DEFAULT_STATE,...saved,toggles:{...DEFAULT_STATE.toggles,...(saved.toggles||{})}};
    }catch{return {...DEFAULT_STATE,toggles:{...DEFAULT_STATE.toggles}};}
  }

  function writeState(next){
    localStorage.setItem(STATE_KEY,JSON.stringify(next));
  }

  function bridgeAvailable(){
    return Boolean(
      window.GoWorkoutNativeHealth?.request||
      window.ReactNativeWebView?.postMessage
    );
  }

  function nativeRequest(action,payload={}){
    if(window.GoWorkoutNativeHealth?.request){
      return Promise.resolve(window.GoWorkoutNativeHealth.request(action,payload));
    }
    if(window.ReactNativeWebView?.postMessage){
      const requestId='health-'+Date.now()+'-'+(++messageCounter);
      return new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>{
          pending.delete(requestId);
          reject(new Error('Health Connect request timed out.'));
        },20000);
        pending.set(requestId,{resolve,reject,timeout});
        window.ReactNativeWebView.postMessage(JSON.stringify({channel:CHANNEL,requestId,action,payload}));
      });
    }
    return Promise.reject(Object.assign(new Error('Health Connect requires the Android app.'),{code:'native_required'}));
  }

  function handleNativeMessage(raw){
    let data=raw;
    if(typeof raw==='string'){
      try{data=JSON.parse(raw);}catch{return;}
    }
    if(!data||data.channel!==CHANNEL||!data.requestId)return;
    const request=pending.get(data.requestId);
    if(!request)return;
    clearTimeout(request.timeout);
    pending.delete(data.requestId);
    if(data.ok===false)request.reject(new Error(data.error||'Health Connect request failed.'));
    else request.resolve(data.result);
  }

  window.addEventListener('message',event=>handleNativeMessage(event.data));
  document.addEventListener('message',event=>handleNativeMessage(event.data));
  window.addEventListener('goworkout-health-connect-response',event=>handleNativeMessage(event.detail));

  function statusText(state){
    if(!bridgeAvailable())return 'Android app required';
    if(state.connected)return state.lastSyncAt?'Connected · last synced '+formatDateTime(state.lastSyncAt):'Connected';
    return 'Not connected';
  }

  function formatDateTime(value){
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return 'never';
    return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);
  }

  function button(){
    const state=readState();
    return '<button data-action="open-health-connect" class="health-connect-settings-button">'+
      '<i class="settings-icon health-connect-icon" aria-hidden="true">♥</i>'+
      '<div><span>CONNECTED HEALTH</span><strong>Samsung Health · '+statusText(state)+'</strong></div><em>›</em>'+
    '</button>';
  }

  function injectProfileButton(){
    const list=document.querySelector('.profile-hub .settings-list');
    if(!list||list.querySelector('[data-action="open-health-connect"]'))return;
    const workoutSettings=list.querySelector('[data-action="open-cue-settings"]');
    if(workoutSettings)workoutSettings.insertAdjacentHTML('afterend',button());
    else list.insertAdjacentHTML('beforeend',button());
  }

  function metricRow(label,value){
    return '<div><span>'+label+'</span><strong>'+value+'</strong></div>';
  }

  function renderSheet(){
    document.querySelector('[data-health-connect-sheet]')?.remove();
    if(!sheetOpen)return;
    const state=readState();
    const available=bridgeAvailable();
    const toggles=Object.entries(state.toggles).map(([key,value])=>{
      const labels={workouts:'Workouts',heartRate:'Heart rate',calories:'Calories',distance:'Distance',steps:'Steps'};
      return '<label class="health-connect-toggle"><span>'+labels[key]+'</span><input type="checkbox" data-health-toggle="'+key+'" '+(value?'checked':'')+' '+(!available?'disabled':'')+'><i></i></label>';
    }).join('');
    const last=state.lastSyncAt?formatDateTime(state.lastSyncAt):'Never';
    const status=available?(state.connected?'CONNECTED':'READY TO CONNECT'):'ANDROID APP REQUIRED';
    const copy=available
      ? 'Samsung Health shares supported workout data through Android Health Connect. You choose what Go Workout can read.'
      : 'The browser cannot read Samsung Health directly. Open Go Workout in the Android app to connect Health Connect. Your browser workout data stays available.';
    const html='<div class="exercise-modal-backdrop sheet-backdrop health-connect-backdrop" data-health-connect-sheet>'+
      '<section class="bottom-sheet health-connect-sheet" data-health-connect-panel>'+
        '<div class="sheet-handle"></div>'+
        '<div class="sheet-head"><div><p class="eyebrow">CONNECTED HEALTH</p><h2>Samsung Health</h2><p>'+copy+'</p></div><button class="modal-close" data-action="close-health-connect">×</button></div>'+
        '<section class="health-connect-status '+(state.connected?'connected':'')+'"><span>STATUS</span><strong>'+status+'</strong><small>Connection runs through Health Connect on Android.</small></section>'+
        '<section class="health-connect-permissions"><div class="clean-section-head"><div><p class="eyebrow">SYNC</p><h3>Choose workout data</h3></div></div>'+toggles+'</section>'+
        '<section class="health-connect-sync-summary">'+
          metricRow('LAST SYNC',last)+
          metricRow('LAST IMPORT',String(state.lastImportCount||0)+' workout'+(state.lastImportCount===1?'':'s'))+
          metricRow('WINDOW',String(state.syncDays||30)+' days')+
        '</section>'+
        '<div class="health-connect-actions">'+
          (available&&!state.connected?'<button class="button primary-action" data-action="connect-health-connect" '+(busy?'disabled':'')+'>'+(busy?'CONNECTING…':'CONNECT SAMSUNG HEALTH')+'</button>':'')+
          (available&&state.connected?'<button class="button primary-action" data-action="sync-health-connect" '+(busy?'disabled':'')+'>'+(busy?'SYNCING…':'SYNC NOW')+'</button><button class="button secondary" data-action="disconnect-health-connect" '+(busy?'disabled':'')+'>DISCONNECT</button>':'')+
        '</div>'+
        '<div class="profile-privacy-note health-connect-privacy"><strong>Private by default.</strong><span>Imported health metrics stay in your Workout account. Workout partners do not receive heart-rate or calorie data.</span></div>'+
      '</section>'+
    '</div>';
    document.querySelector('#app')?.insertAdjacentHTML('beforeend',html);
  }

  async function persistConnection(state){
    if(!window.workoutSupabase||store?.account?.status!=='connected'||!store?.account?.userId)return;
    try{
      await workoutSupabase.from('workout_health_connections').upsert({
        user_id:store.account.userId,
        provider:'samsung_health',
        enabled:Boolean(state.connected),
        permissions:state.permissions||[],
        preferences:state.toggles||{},
        last_sync_at:state.lastSyncAt||null,
        updated_at:new Date().toISOString()
      },{onConflict:'user_id,provider'});
    }catch(error){console.warn('Health connection metadata sync failed',error);}
  }

  async function persistImports(entries){
    if(!entries.length||!window.workoutSupabase||store?.account?.status!=='connected'||!store?.account?.userId)return;
    const rows=entries.map(entry=>({
      user_id:store.account.userId,
      provider:entry.externalSource.provider,
      external_record_id:entry.externalSource.healthConnectRecordId,
      source_package:entry.externalSource.sourcePackage||null,
      history_id:entry.id,
      started_at:entry.startedAt,
      completed_at:entry.completedAt,
      metrics:entry.healthMetrics||{},
      imported_at:entry.externalSource.importedAt,
      updated_at:new Date().toISOString()
    }));
    try{
      await workoutSupabase.from('workout_health_imports').upsert(rows,{onConflict:'user_id,provider,external_record_id'});
    }catch(error){console.warn('Health import audit sync failed',error);}
  }

  async function refreshPermissions(){
    if(!bridgeAvailable())return;
    try{
      const result=await nativeRequest('getStatus');
      const state=readState();
      state.connected=Boolean(result?.connected);
      state.permissions=Array.isArray(result?.permissions)?result.permissions:[];
      writeState(state);
      renderSheet();
      injectProfileButton();
    }catch(error){console.warn('Health Connect status read failed',error);}
  }

  async function connect(){
    if(busy)return;
    busy=true;renderSheet();
    try{
      const state=readState();
      const result=await nativeRequest('requestPermissions',{toggles:state.toggles});
      state.permissions=Array.isArray(result?.permissions)?result.permissions:[];
      state.connected=Boolean(result?.connected??state.permissions.length);
      writeState(state);
      await persistConnection(state);
      renderSheet();
      injectProfileButton();
      if(state.connected)toast('Samsung Health connected through Health Connect.');
    }catch(error){
      toast(error?.message||'Samsung Health could not be connected.');
    }finally{busy=false;renderSheet();}
  }

  async function disconnect(){
    if(busy)return;
    busy=true;renderSheet();
    try{
      await nativeRequest('revokePermissions');
      const state=readState();
      state.connected=false;
      state.permissions=[];
      writeState(state);
      await persistConnection(state);
      toast('Health Connect access disconnected.');
    }catch(error){
      toast(error?.message||'Health Connect access could not be removed.');
    }finally{busy=false;renderSheet();injectProfileButton();}
  }

  async function syncNow(){
    if(busy)return;
    busy=true;renderSheet();
    try{
      const state=readState();
      const result=await nativeRequest('readSamsungWorkouts',{days:state.syncDays||30,toggles:state.toggles});
      const records=Array.isArray(result?.records)?result.records:Array.isArray(result)?result:[];
      const merged=core.mergeImportedWorkouts(store.history,records,{samsungOnly:true});
      store.history=merged.history;
      state.lastSyncAt=new Date().toISOString();
      state.lastImportCount=merged.imported.length;
      state.connected=true;
      writeState(state);
      saveStore();
      await Promise.all([persistConnection(state),persistImports(merged.imported)]);
      sheetOpen=false;
      render();
      toast(merged.imported.length
        ? merged.imported.length+' Samsung Health workout'+(merged.imported.length===1?'':'s')+' added to history.'
        : 'Samsung Health is synced. No new workouts found.');
    }catch(error){
      toast(error?.message||'Samsung Health sync failed.');
    }finally{busy=false;renderSheet();injectProfileButton();}
  }

  function decorateHistoryDetail(){
    const panel=document.querySelector('[data-history-menu-panel]');
    if(!panel||panel.querySelector('.health-history-detail'))return;
    if(typeof historyMenuId==='undefined'||!historyMenuId)return;
    const item=store.history.find(entry=>entry.id===historyMenuId);
    if(!item?.externalWorkout||!item.healthMetrics)return;
    const metrics=item.healthMetrics;
    const parts=[];
    if(metrics.averageHeartRateBpm)parts.push(metricRow('AVG HR',Math.round(metrics.averageHeartRateBpm)+' bpm'));
    if(metrics.maxHeartRateBpm)parts.push(metricRow('PEAK HR',Math.round(metrics.maxHeartRateBpm)+' bpm'));
    if(metrics.caloriesKcal)parts.push(metricRow('CALORIES',Math.round(metrics.caloriesKcal)+' kcal'));
    if(metrics.distanceMeters)parts.push(metricRow('DISTANCE',(metrics.distanceMeters/1000).toFixed(2)+' km'));
    if(metrics.steps)parts.push(metricRow('STEPS',Math.round(metrics.steps).toLocaleString()));
    const target=panel.querySelector('.history-detail-hero');
    if(target)target.insertAdjacentHTML('afterend',
      '<section class="health-history-detail"><div class="history-section-head"><span>SAMSUNG HEALTH</span><strong>Imported through Health Connect</strong></div><div class="health-history-metrics">'+parts.join('')+'</div><small>Strength sets and loads are not inferred from wearable data.</small></section>');
  }

  document.addEventListener('click',event=>{
    const node=event.target.closest?.('[data-action]');
    if(!node)return;
    const action=node.dataset.action;
    if(action==='open-health-connect'){
      sheetOpen=true;
      renderSheet();
      refreshPermissions();
    }else if(action==='close-health-connect'){
      sheetOpen=false;
      renderSheet();
    }else if(action==='connect-health-connect'){
      connect();
    }else if(action==='disconnect-health-connect'){
      disconnect();
    }else if(action==='sync-health-connect'){
      syncNow();
    }
  });

  document.addEventListener('change',event=>{
    const key=event.target?.dataset?.healthToggle;
    if(!key)return;
    const state=readState();
    state.toggles[key]=Boolean(event.target.checked);
    writeState(state);
  });

  const observer=new MutationObserver(()=>{
    injectProfileButton();
    decorateHistoryDetail();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  injectProfileButton();
})();
