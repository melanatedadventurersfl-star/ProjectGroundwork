/* GO Workout Arcade V1.
 * Uses existing Workout account trainingProgram for preferences.
 * XP is derived from canonical saved Workout history and never changes prescriptions.
 * No live watch or automatic rep-counting claims in this release.
 */
(() => {
  'use strict';
  const outfits = {
    explorer: {name:'Explorer',icon:'🌿',description:'Trail-ready and curious'},
    spark: {name:'Spark',icon:'⚡',description:'Bright and energetic'},
    champion: {name:'Champion',icon:'🏅',description:'Calm and determined'}
  };
  const modes = {
    arcade: {name:'Arcade',description:'Animated companion and progress during workouts'},
    companion: {name:'Companion',description:'Small companion, minimal movement'},
    focus: {name:'Focus',description:'Quiet tracking, no character during workouts'}
  };
  const quests = [
    {id:'first',name:'First mission',required:1,kind:'workouts',bonus:25,icon:'🚩'},
    {id:'three',name:'Find your rhythm',required:3,kind:'workouts',bonus:50,icon:'✨'},
    {id:'sets',name:'Building strength',required:20,kind:'sets',bonus:75,icon:'💪'}
  ];
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : 0;
  function ensure(training) {
    if(!training || typeof training !== 'object') return {version:1,mode:'companion',outfit:'explorer'};
    if(!training.arcade || typeof training.arcade !== 'object') training.arcade = {version:1,mode:'companion',outfit:'explorer'};
    const value=training.arcade;
    if(!modes[value.mode]) value.mode='companion';
    if(!outfits[value.outfit]) value.outfit='explorer';
    value.version=1;
    return value;
  }
  function completedRecovery(entry) {
    if(entry.completionStatus!=='complete' || number(entry.durationMinutes)<5) return false;
    const exercises=Array.isArray(entry.exercises)?entry.exercises:[];
    if(exercises.some(ex=>(ex.sets||[]).length>0)) return false;
    const stages=[...(Array.isArray(entry.warmup)?entry.warmup:[]),...(Array.isArray(entry.cooldown)?entry.cooldown:[])];
    return stages.some(item=>Boolean(item.completedAt)&&!item.skippedAt);
  }
  function eligible(entry) {
    if(!entry || !entry.id || entry.externalWorkout || entry.manualWorkoutCompletion) return false;
    if(entry.completionStatus!=='complete' && entry.completionStatus!=='partial') return false;
    return number(entry.completedSets)>0 || completedRecovery(entry);
  }
  function validHistory(history) {
    const seen=new Set();
    return (Array.isArray(history)?history:[]).filter(entry=>{
      if(!eligible(entry) || seen.has(String(entry.id))) return false;
      seen.add(String(entry.id));
      return true;
    });
  }
  function baseXp(entry) {
    const sets=number(entry.completedSets);
    return entry.completionStatus==='complete' ? 100 : Math.min(60,20+sets*5);
  }
  function stats(history) {
    const sessions=validHistory(history);
    const workoutCount=sessions.filter(s=>s.completionStatus==='complete').length;
    const completedSets=sessions.reduce((sum,s)=>sum+number(s.completedSets),0);
    const progress={workouts:workoutCount,sets:completedSets};
    const earnedQuests=quests.filter(q=>progress[q.kind]>=q.required);
    const base=sessions.reduce((sum,entry)=>sum+baseXp(entry),0);
    const xp=base+earnedQuests.reduce((sum,q)=>sum+q.bonus,0);
    const level=Math.floor(xp/400)+1;
    return {xp,level,levelXp:xp%400,nextLevelXp:400,workoutCount,completedSets,
      earnedQuests:earnedQuests.map(q=>q.id),progress,
      recentXp:sessions[0]?baseXp(sessions[0]):0};
  }
  function rewardFor(history,id) {
    const sessions=validHistory(history);
    const entry=sessions.find(s=>String(s.id)===String(id));
    if(!entry) return null;
    // The bonus is visible in the quest list and counted in the total once earned.
    const before=stats((Array.isArray(history)?history:[]).filter(s=>String(s?.id)!==String(id)));
    const after=stats(history);
    return {xp:after.xp-before.xp,level:after.level};
  }
  function scene(training,avatar,compact=false,celebrate=false) {
    const setting=ensure(training);
    return '<div class="arcade-scene arcade-outfit-'+setting.outfit+(compact?' is-compact':'')+(celebrate?' is-celebrating':'')+'" role="img" aria-label="'+safe(outfits[setting.outfit].name)+' workout companion">'+
      '<div class="arcade-scene-orbit"></div><div class="arcade-scene-hill hill-back"></div><div class="arcade-scene-hill hill-front"></div>'+
      '<div class="arcade-avatar">'+(avatar||'<span class="arcade-avatar-fallback" aria-hidden="true">🏃</span>')+
        '<span class="arcade-outfit-symbol" aria-hidden="true">'+outfits[setting.outfit].icon+'</span></div>'+
      '<span class="arcade-scene-spark spark-one" aria-hidden="true">✦</span><span class="arcade-scene-spark spark-two" aria-hidden="true">✦</span>'+
    '</div>';
  }
  function questCards(result) {
    return quests.map(quest=>{
      const current=Math.min(quest.required,result.progress[quest.kind]);
      const complete=current>=quest.required;
      return '<div class="arcade-quest'+(complete?' is-complete':'')+'"><span class="arcade-quest-icon" aria-hidden="true">'+quest.icon+'</span>'+
        '<div class="arcade-quest-body"><strong>'+quest.name+'</strong><small>'+
          (quest.kind==='sets'?'Complete '+quest.required+' logged sets':'Complete '+quest.required+' full workout'+(quest.required>1?'s':''))+'</small>'+
          '<div class="arcade-meter" role="progressbar" aria-valuenow="'+current+'" aria-valuemin="0" aria-valuemax="'+quest.required+'" aria-label="'+safe(quest.name)+'"><span style="width:'+(current/quest.required*100)+'%"></span></div></div>'+
        '<div class="arcade-quest-reward"><b>'+(complete?'✓':current+'/'+quest.required)+'</b><small>+'+quest.bonus+' XP</small></div></div>';
    }).join('');
  }
  function homePanel(training,history,avatar) {
    const s=stats(history);
    return '<section class="arcade-home" aria-label="GO Workout Arcade">'+
      '<div class="arcade-home-copy"><span class="arcade-eyebrow">GO WORKOUT ARCADE</span><h3>Your companion is ready.</h3>'+
        '<p>Every logged set advances your adventure. Today’s plan sets the challenge.</p>'+
        '<div class="arcade-home-stats"><strong>LEVEL '+s.level+'</strong><span>'+s.xp+' XP earned</span></div>'+
        '<button type="button" class="arcade-button" data-action="open-arcade">OPEN ARCADE <span aria-hidden="true">→</span></button></div>'+
      scene(training,avatar,true,false)+'</section>';
  }
  function livePanel(training,workout,avatar) {
    if(!workout) return '';
    const setting=ensure(training);
    if(setting.mode==='focus') return '';
    const sets=(workout.exercises||[]).reduce((sum,ex)=>sum+(ex.sets||[]).length,0);
    const done=(workout.exercises||[]).reduce((sum,ex)=>sum+(ex.sets||[]).filter(set=>set.completed).length,0);
    const percent=sets?Math.min(100,Math.round(done/sets*100)):0;
    const message=workout.isPaused?'Your progress is saved. Resume when ready.':
      workout.phase==='rest'?'Set saved. Your companion is catching its breath.':
      workout.phase==='cooldown'?'Finishing strong includes cooling down.':
      workout.phase==='warmup'?'Warm up first. Your adventure starts here.':
      done?'You have completed '+done+' of '+sets+' planned sets.':'Your challenge matches today’s training plan.';
    return '<section class="arcade-live '+(setting.mode==='companion'?'arcade-live-compact':'')+'" aria-label="Arcade workout progress">'+
      scene(training,avatar,true,done>0&&workout.phase==='rest')+
      '<div class="arcade-live-copy"><span class="arcade-eyebrow">'+(setting.mode==='arcade'?'ADVENTURE IN PROGRESS':'YOUR COMPANION')+'</span>'+
        '<strong>'+safe(message)+'</strong><small>'+done+' / '+sets+' prescribed sets logged</small>'+
        '<div class="arcade-meter" role="progressbar" aria-label="Workout sets completed" aria-valuenow="'+done+'" aria-valuemin="0" aria-valuemax="'+Math.max(1,sets)+'"><span style="width:'+percent+'%"></span></div>'+
        (sets===0?'<small>Warm-up and recovery are part of your plan.</small>':'')+
      '</div></section>';
  }
  function dashboard(training,history,avatar) {
    const setting=ensure(training),result=stats(history);
    const pct=(result.levelXp/result.nextLevelXp*100).toFixed(1);
    return '<div class="clean-page arcade-page"><div class="arcade-page-header"><button class="text-button" type="button" data-action="home">‹ HOME</button><p class="arcade-eyebrow">GO WORKOUT ARCADE · V1</p>'+
      '<h2>Meet your training companion.</h2><p>Keep the workouts you already follow. Your game progress adapts to them.</p></div>'+
      '<section class="arcade-hero">'+scene(training,avatar,false,true)+'<div class="arcade-hero-stats"><span>LEVEL '+result.level+'</span><strong>'+result.xp+' XP</strong>'+
      '<small>'+result.levelXp+' / 400 XP to next level</small><div class="arcade-meter" role="progressbar" aria-valuenow="'+result.levelXp+'" aria-valuemin="0" aria-valuemax="400" aria-label="Next level progress"><span style="width:'+pct+'%"></span></div></div></section>'+
      '<section class="arcade-section"><div class="arcade-section-heading"><h3>Choose your companion style</h3><p>Cosmetic only. This never changes your workout or goal targets.</p></div>'+
      '<div class="arcade-outfits">'+Object.entries(outfits).map(([id,item])=>
        '<button type="button" class="arcade-choice'+(setting.outfit===id?' is-selected':'')+'" data-arcade-action="outfit" data-arcade-value="'+id+'" aria-pressed="'+(setting.outfit===id)+'">'+
        '<span aria-hidden="true">'+item.icon+'</span><strong>'+item.name+'</strong><small>'+item.description+'</small></button>').join('')+'</div></section>'+
      '<section class="arcade-section"><div class="arcade-section-heading"><h3>How it appears during workouts</h3><p>Choose the amount of game activity you want on screen.</p></div>'+
      '<div class="arcade-modes">'+Object.entries(modes).map(([id,item])=>
        '<button type="button" class="arcade-mode'+(setting.mode===id?' is-selected':'')+'" data-arcade-action="mode" data-arcade-value="'+id+'" aria-pressed="'+(setting.mode===id)+'">'+
        '<span class="arcade-radio" aria-hidden="true"></span><span><strong>'+item.name+'</strong><small>'+item.description+'</small></span></button>').join('')+'</div></section>'+
      '<section class="arcade-section"><div class="arcade-section-heading"><h3>Your quests</h3><p>Based on completed workouts and logged sets in your private workout history.</p></div>'+
      '<div class="arcade-quests">'+questCards(result)+'</div></section>'+
      '<div class="arcade-footnote">XP is calculated from saved sessions. Partial workouts earn set XP. Completing a lighter session counts the same as any other full session. No extra reps or unsafe effort required.</div></div>';
  }
  function summaryPanel(history,entry) {
    const reward=rewardFor(history,entry?.id);
    if(!reward)return '';
    return '<section class="arcade-summary"><div><span class="arcade-eyebrow">ARCADE REWARD</span><h3>+'+reward.xp+' XP earned</h3>'+
      '<p>Your session is saved. Your companion is now level '+reward.level+'.</p></div>'+
      '<button type="button" class="arcade-button" data-action="open-arcade">SEE YOUR QUESTS →</button></section>';
  }
  function action(training,kind,value) {
    if(!['outfit','mode'].includes(kind)) return {changed:false};
    const setting=ensure(training),options=kind==='outfit'?outfits:modes;
    if(!Object.prototype.hasOwnProperty.call(options,value) || setting[kind]===value) return {changed:false};
    setting[kind]=value;
    return {changed:true,message:kind==='outfit'?'Companion style saved.':'Workout display mode saved.'};
  }
  window.GoWorkoutArcade={ensure,stats,rewardFor,homePanel,livePanel,dashboard,summaryPanel,action};
  if(typeof module!=='undefined' && module.exports)module.exports=window.GoWorkoutArcade;
})();
