/* GO Workout Rep Battle V1.1.
 * Visual-only game driven by canonical set completion.
 * Never changes targets, timers, training state, health data, or workout XP.
 */
(() => {
  'use strict';

  const clean = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]
  ));
  const pendingHits = new Map();

  function progress(workout) {
    const exercises=Array.isArray(workout?.exercises)?workout.exercises:[];
    const sets=exercises.flatMap(ex=>Array.isArray(ex.sets)?ex.sets:[]);
    const total=sets.length;
    const completed=sets.filter(set=>set?.completed===true).length;
    const skipped=sets.filter(set=>set?.skipped===true&&!set?.completed).length;
    // Total health is fixed at 100. Damage is distributed over the prescribed
    // sets, including sessions adapted to readiness or modified equipment.
    const damageDealt=total?Math.round(completed*100/total):0;
    const remainingHp=Math.max(0,100-damageDealt);
    const nextHit=total && completed<total
      ? Math.min(100,Math.round((completed+1)*100/total))-damageDealt
      : 0;
    return {total,completed,skipped,remaining:Math.max(0,total-completed-skipped),
      damageDealt,remainingHp,nextHit,victory:total>0&&completed===total,
      percentage:total?Math.round(completed*100/total):0};
  }

  function noteCompletedSet(training,workout,exercise,set) {
    if(!workout||!set?.completed||!workout.id)return false;
    if(training?.arcade?.mode!=='arcade')return false;
    const snapshot=progress(workout);
    if(!snapshot.total)return false;
    // Persisted on the active workout. Only counted when a real set is logged.
    // Completion state is still derived exclusively from exercise sets.
    workout.arcadeBattlePlayed=true;
    const before=Math.round(Math.max(0,snapshot.completed-1)*100/snapshot.total);
    const damage=Math.max(0,snapshot.damageDealt-before);
    pendingHits.set(String(workout.id),{
      damage,exerciseName:String(exercise?.name||'Set'),at:Date.now()
    });
    return true;
  }

  function guardian() {
    return '<div class="rep-guardian" aria-hidden="true">'+
      '<span class="rep-guardian-shadow"></span><span class="rep-guardian-leg left"></span><span class="rep-guardian-leg right"></span>'+
      '<span class="rep-guardian-arm left"></span><span class="rep-guardian-arm right"></span>'+
      '<span class="rep-guardian-body"><i class="rep-guardian-core"></i></span>'+
      '<span class="rep-guardian-head"><i class="rep-guardian-eye left"></i><i class="rep-guardian-eye right"></i></span>'+
      '</div>';
  }
  function player(avatar) {
    return '<div class="rep-player" aria-hidden="true"><span class="rep-player-shadow"></span>'+
      '<div class="rep-player-figure">'+(avatar||'<span class="rep-player-fallback">🏋️</span>')+'</div>'+
      '<span class="rep-player-glow"></span></div>';
  }

  function arena(avatar,hit=false,rest=false,damage=0,victory=false) {
    return '<div class="rep-arena'+(hit?' is-hit':'')+(rest?' is-rest':'')+(victory?' is-victory':'')+'" role="img" aria-label="Your workout avatar faces the Training Guardian">'+
      '<span class="rep-arena-sun"></span><span class="rep-arena-mountain mountain-back"></span>'+
      '<span class="rep-arena-mountain mountain-front"></span><span class="rep-arena-floor"></span>'+
      player(avatar)+guardian()+
      '<span class="rep-impact" aria-hidden="true">✦</span>'+
      (hit?'<span class="rep-damage" aria-hidden="true">−'+damage+'</span>':'')+
      (rest?'<span class="rep-rest-shield" aria-hidden="true">✧</span>':'')+
      (victory?'<span class="rep-victory-glow" aria-hidden="true">✦</span><span class="rep-victory-banner">GUARDIAN DEFEATED</span>':'')+
      '</div>';
  }

  function livePanel(training,workout,avatar) {
    const snapshot=progress(workout);
    if(!snapshot.total)return null; // Recovery or guided-only session: show existing companion.
    const prefs=training?.arcade||{};
    const collapsed=Boolean(prefs.battleCollapsed);
    const rest=workout?.phase==='rest';
    const paused=Boolean(workout?.isPaused);
    // Animation is only triggered by this browser's real set-completion event,
    // not by restoring or rerendering past workout history.
    const pending=pendingHits.get(String(workout.id));
    if(pending)pendingHits.delete(String(workout.id));
    const hit=Boolean(pending && Date.now()-pending.at<4000);
    const last=hit?pending.exerciseName:String(workout?.lastCompletedSet?.exerciseName||'');
    const status=paused?'Workout paused. Your battle progress is saved.':
      snapshot.victory?'Guardian defeated! Finish your workout to record your victory.':
      rest?'Shield up. Recover for your next set.':
      snapshot.skipped?'Your current plan is what matters. Keep training safely.':
      snapshot.completed?'Keep going. Each logged set moves you forward.':
      'Complete your prescribed sets to challenge the Guardian.';
    const aria='Training Guardian has '+snapshot.remainingHp+' percent health. '+snapshot.completed+' of '+snapshot.total+' sets complete.';
    return '<section class="rep-battle'+(collapsed?' is-collapsed':'')+'" aria-label="Rep Battle">'+
      '<div class="rep-battle-top"><div><span class="arcade-eyebrow">GO WORKOUT ARCADE</span><strong>REP BATTLE <span class="rep-battle-version">V1.1</span></strong></div>'+
      '<button class="rep-battle-toggle" type="button" data-arcade-action="battle-collapse" aria-expanded="'+(!collapsed)+'" aria-label="'+(collapsed?'Expand':'Minimize')+' Rep Battle">'+(collapsed?'EXPAND':'MINIMIZE')+' <span aria-hidden="true">'+(collapsed?'⌄':'⌃')+'</span></button></div>'+
      '<div class="rep-battle-hp"><div class="rep-battle-hp-label"><span>TRAINING GUARDIAN</span><b>'+snapshot.remainingHp+' HP</b></div>'+
      '<div class="rep-battle-hp-track" role="progressbar" aria-label="Training Guardian health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+snapshot.remainingHp+'"><span style="width:'+snapshot.remainingHp+'%"></span></div></div>'+
      (collapsed?'<div class="rep-battle-small">'+snapshot.completed+' / '+snapshot.total+' sets logged <span>·</span> '+(snapshot.victory?'GUARDIAN DEFEATED':'NEXT HIT '+snapshot.nextHit+' HP')+'</div>':
        arena(avatar,hit,rest,pending?.damage||0,snapshot.victory)+
        '<div class="rep-battle-caption" aria-live="off"><strong>'+clean(status)+'</strong>'+
        '<span>'+snapshot.completed+' of '+snapshot.total+' prescribed sets completed'+(last?' · Last: '+clean(last):'')+'</span></div>'+
        '<div class="rep-battle-steps">'+
          '<span><b>'+snapshot.completed+'</b><small>SETS DONE</small></span>'+
          '<span><b>'+(snapshot.victory?'WIN':snapshot.nextHit+' HP')+'</b><small>'+(snapshot.victory?'COMPLETE':'NEXT HIT')+'</small></span>'+
          '<span><b>'+snapshot.remaining+' </b><small>SETS LEFT</small></span></div>')+
      '</section>';
  }

  function dashboardCard(training,activeWorkout,avatar) {
    const active=Boolean(activeWorkout);
    const mode=training?.arcade?.mode||'companion';
    const snapshot=progress(activeWorkout);
    const actionText=active?(mode==='arcade'?'RETURN TO BATTLE':'JOIN THIS WORKOUT'):'PLAY IN YOUR NEXT WORKOUT';
    return '<section class="rep-game-card" aria-label="Rep Battle game">'+
      '<div class="rep-game-art">'+arena(avatar,false,false,0)+'</div>'+
      '<div class="rep-game-copy"><span class="arcade-eyebrow">NOW PLAYABLE · V1.1</span>'+
      '<h3>Rep Battle</h3>'+
      '<p>Each completed set strikes the Guardian. Its health scales to your actual prescribed sets, including easier training days. Rest is your shield.</p>'+
      (active&&snapshot.total?'<div class="rep-game-progress">'+snapshot.completed+' of '+snapshot.total+' sets completed in your current session</div>':'')+
      '<button type="button" class="arcade-button" data-arcade-action="play-battle">'+actionText+' →</button>'+
      '<small>Game mode is optional. No extra sets, no penalty for recovery, no changes to your workout.</small>'+
      '</div></section>';
  }

  function summaryPanel(entry) {
    if(!entry?.arcadeBattlePlayed)return '';
    const snapshot=progress(entry);
    if(!snapshot.total)return '';
    const won=entry.completionStatus==='complete'&&snapshot.victory;
    return '<section class="rep-battle-summary"><span class="arcade-eyebrow">REP BATTLE · SESSION RESULT</span>'+
      '<h3>'+(won?'Training Guardian defeated!':'Your battle progress was recorded.')+'</h3>'+
      '<p>'+snapshot.completed+' of '+snapshot.total+' planned sets logged.'+
        (won?' You completed the mission within your prescribed workout.':' The sets you completed still count toward your regular progress.')+'</p>'+
      '<small>No extra workout XP required. Your original plan determines the challenge.</small></section>';
  }

  function setCollapsed(training,collapsed) {
    if(!training||typeof training!=='object')return false;
    training.arcade=training.arcade&&typeof training.arcade==='object'?training.arcade:{};
    if(Boolean(training.arcade.battleCollapsed)===Boolean(collapsed))return false;
    training.arcade.battleCollapsed=Boolean(collapsed);
    return true;
  }

  window.GoWorkoutRepBattle={progress,noteCompletedSet,livePanel,dashboardCard,summaryPanel,setCollapsed};
  if(typeof module!=='undefined'&&module.exports)module.exports=window.GoWorkoutRepBattle;
})();