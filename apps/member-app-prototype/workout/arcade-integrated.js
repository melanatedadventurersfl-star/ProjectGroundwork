/* GO Workout Arcade V1.2: one training journey, three presentation modes.
 * Reads only canonical workout history and the existing Arcade preferences.
 * No new XP, workouts, or persistence model. */
(() => {
  'use strict';
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const modes={arcade:'Arcade',companion:'Companion',focus:'Focus'};
  function getState(training,history){
    const api=window.GoWorkoutArcade;
    if(!api)return null;
    const prefs=api.ensure(training);
    return {mode:modes[prefs.mode]?prefs.mode:'companion',outfit:prefs.outfit,stats:api.stats(history)};
  }
  const progressMeter=(stats)=>'<div class="ai-xp-track" role="progressbar" aria-label="Next character level" aria-valuemin="0" aria-valuemax="'+stats.nextLevelXp+'" aria-valuenow="'+stats.levelXp+'"><span style="width:'+(stats.levelXp/stats.nextLevelXp*100).toFixed(1)+'%"></span></div>';
  function modeButtons(mode){
    return '<div class="ai-mode-picker" role="group" aria-label="Workout experience mode">'+
      Object.entries(modes).map(([id,name])=>'<button type="button" data-arcade-action="mode" data-arcade-value="'+id+'" aria-pressed="'+(mode===id)+'" class="'+(mode===id?'is-active':'')+'">'+name+'</button>').join('')+
    '</div>';
  }
  const avatarFrame=(avatar)=>'<div class="ai-character" aria-hidden="true"><span class="ai-character-orbit"></span>'+(avatar||'<span class="ai-fallback">🏃</span>')+'<i>✦</i></div>';
  function header(label,mode,actions=true){
    return '<div class="ai-label-row"><span class="ai-kicker">'+label+'</span>'+
      (actions?'<button type="button" data-action="open-arcade" class="ai-locker-link">CHARACTER LOCKER <span aria-hidden="true">↗</span></button>':'<span class="ai-mode-label">'+safe(modes[mode])+' MODE</span>')+'</div>';
  }
  function homePanel(training,history,avatar,context={}){
    const state=getState(training,history);if(!state)return '';
    const {mode,stats}=state;
    const active=context.activeWorkout;
    const remaining=active?(active.exercises||[]).reduce((n,ex)=>n+(ex.sets||[]).filter(set=>!set.completed&&!set.skipped).length,0):null;
    const mission=active
      ?'Keep going: '+String(remaining)+' prescribed set'+(remaining===1?'':'s')+' remaining.'
      :context.nextWorkout?'Your next workout: '+String(context.nextWorkout)+'.':'Your next training session follows your plan.';
    return '<section class="ai-home ai-mode-'+mode+'" aria-label="Your training adventure">'+
      header('YOUR TRAINING JOURNEY',mode)+
      '<div class="ai-home-main">'+
        (mode!=='focus'?avatarFrame(avatar):'<div class="ai-focus-mark" aria-hidden="true">◎</div>')+
        '<div class="ai-home-copy"><div class="ai-level"><span>LEVEL '+stats.level+'</span><b>'+stats.xp+' XP</b></div>'+
          (mode==='focus'?'<h3>Training first.</h3>':'<h3>'+(active?'Your challenge continues.':'Ready for your next challenge.')+'</h3>')+
          '<p>'+safe(mission)+'</p>'+progressMeter(stats)+
          '<small>'+stats.completedSets+' completed sets · '+stats.workoutCount+' completed workouts</small></div>'+
      '</div>'+modeButtons(mode)+
      '</section>';
  }
  function trainPanel(training,history,avatar,context={}){
    const state=getState(training,history);if(!state)return '';
    const {mode,stats}=state;
    const active=context.activeWorkout;
    const total=active?(active.exercises||[]).reduce((n,ex)=>n+(ex.sets||[]).length,0):0;
    const done=active?(active.exercises||[]).reduce((n,ex)=>n+(ex.sets||[]).filter(set=>set.completed).length,0):0;
    return '<section class="ai-train ai-mode-'+mode+'" aria-label="Training adventure progress">'+
      '<div><span class="ai-kicker">'+(mode==='focus'?'YOUR TRAINING':'TODAY\'S CHALLENGE')+'</span>'+
        '<strong>'+(active?safe(active.routineName||'Workout in progress'):'Follow your prescribed workout')+'</strong>'+
        '<small>'+(active?done+' of '+total+' sets recorded':'Your game challenge adapts to the workout you choose.')+'</small></div>'+
      (mode!=='focus'?'<div class="ai-train-score"><b>LVL '+stats.level+'</b><span>'+stats.xp+' XP</span></div>':'')+
      '<button type="button" data-action="open-arcade" class="ai-train-locker" aria-label="Open character locker">✦ <span>LOCKER</span></button></section>';
  }
  const missionDefinitions=[
    {id:'first',label:'First mission',icon:'🚩',count:1,kind:'workouts',bonus:25},
    {id:'three',label:'Find your rhythm',icon:'✦',count:3,kind:'workouts',bonus:50},
    {id:'sets',label:'Building strength',icon:'◆',count:20,kind:'sets',bonus:75}
  ];
  function progressPanel(training,history,context={}){
    const state=getState(training,history);if(!state)return '';
    const {mode,stats}=state;
    const block=Math.max(1,Number(context.block)||1);
    const week=Math.min(4,Math.max(1,Number(context.week)||1));
    const currentWeekCompleted=Math.max(0,Number(context.completed)||0);
    const currentWeekPlanned=Math.max(0,Number(context.planned)||0);
    return '<section class="ai-progress ai-mode-'+mode+'" aria-label="Training journey and character progress">'+
      header('TRAINING JOURNEY',mode)+
      '<div class="ai-progress-head"><div><span class="ai-kicker">BLOCK '+block+' · CHAPTER '+week+' OF 4</span>'+
        '<h3>'+(mode==='focus'?'Your weekly training.':'Your adventure, earned one session at a time.')+'</h3>'+
        '<p>'+currentWeekCompleted+' of '+currentWeekPlanned+' workouts completed this week. Training progress is based on your saved history.</p></div>'+
        '<div class="ai-progress-level"><b>LVL '+stats.level+'</b><span>'+stats.xp+' XP</span></div></div>'+
      progressMeter(stats)+
      '<div class="ai-chapter-track" aria-label="Current training block chapters">'+
      Array.from({length:4},(_,i)=>'<div class="ai-chapter '+(i+1===week?'is-current':i+1<week?'is-past':'is-next')+'">'+
        '<span>'+(i+1===week?'✦':i+1)+'</span><small>WEEK '+(i+1)+'</small>'+
        (i+1===week?'<b>CURRENT</b>':'')+'</div>').join('')+'</div>'+
      '<div class="ai-achievement-head"><strong>Milestones from your workouts</strong><button type="button" data-action="open-arcade">CHARACTER LOCKER ↗</button></div>'+
      '<div class="ai-achievements">'+missionDefinitions.map(quest=>{
        const current=Math.min(quest.count,stats.progress[quest.kind]||0);
        const earned=stats.earnedQuests.includes(quest.id);
        return '<div class="ai-achievement '+(earned?'earned':'')+'"><span aria-hidden="true">'+quest.icon+'</span><div><strong>'+quest.label+'</strong><small>'+(earned?'Earned · +'+quest.bonus+' XP':current+' / '+quest.count+' '+(quest.kind==='sets'?'sets':'workouts'))+'</small></div></div>';
      }).join('')+'</div></section>';
  }
  window.GoWorkoutArcadeIntegrated={homePanel,trainPanel,progressPanel,modeButtons};
  if(typeof module!=='undefined'&&module.exports)module.exports=window.GoWorkoutArcadeIntegrated;
})();