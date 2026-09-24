(function(){
  const retryIfStillVisible=(selector,delay=350)=>setTimeout(()=>{
    try{
      const target=document.querySelector(selector);
      if(!target)return;
      // Re-run the app's real delegated click handler. The previous watchdog
      // called window-scoped helpers that are private to app.js, so the retry
      // silently did nothing. Mark the synthetic retry so this capture-phase
      // listener does not schedule itself again.
      target.dataset.watchdogRetry='1';
      target.click();
      delete target.dataset.watchdogRetry;
    }catch(error){
      console.warn('Workout transition watchdog failed',error);
    }
  },delay);

  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-action]');
    if(!target||target.dataset.watchdogRetry==='1')return;
    const action=target.dataset.action;

    // If the normal delegated click handler throws or misses during the
    // warm-up -> first-exercise handoff, the visible control remains and we
    // can safely replay the same user action once.
    if(action==='start-set-now'){
      retryIfStillVisible('[data-action="start-set-now"]');
    }

    if(action==='stage-done'){
      retryIfStillVisible('[data-action="stage-done"]');
    }
  },true);

  window.addEventListener('error',event=>{
    try{
      sessionStorage.setItem('workout-last-error',JSON.stringify({
        message:event.message,
        source:event.filename,
        line:event.lineno,
        column:event.colno,
        at:new Date().toISOString()
      }));
    }catch{}
  });

  window.addEventListener('unhandledrejection',event=>{
    try{
      sessionStorage.setItem('workout-last-rejection',JSON.stringify({
        message:String(event.reason?.message||event.reason||'Unknown rejection'),
        at:new Date().toISOString()
      }));
    }catch{}
  });
})();
