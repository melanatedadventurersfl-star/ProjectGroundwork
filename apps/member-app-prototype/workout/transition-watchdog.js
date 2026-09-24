(function(){
  const retryIfStillVisible=(selector,fn,delay=350)=>setTimeout(()=>{
    try{
      if(document.querySelector(selector))fn?.();
    }catch(error){
      console.warn('Workout transition watchdog failed',error);
    }
  },delay);

  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-action]');
    if(!target)return;
    const action=target.dataset.action;

    // If the normal delegated click handler throws or misses during the
    // warm-up -> first-exercise handoff, the visible control remains and we
    // can safely retry only when it is still present.
    if(action==='start-set-now'){
      retryIfStillVisible('[data-action="start-set-now"]',()=>window.finishPreSet?.());
    }

    if(action==='stage-done'){
      retryIfStillVisible('[data-action="stage-done"]',()=>window.advanceTimedStage?.(false));
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
