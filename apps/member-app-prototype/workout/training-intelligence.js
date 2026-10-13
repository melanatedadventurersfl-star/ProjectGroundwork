/* GO Workout · explainable goal-to-program experience.
 * Keeps all durable settings and notices inside the existing account-synced
 * trainingProgram.goalLab; never overwrites a saved plan or completed workout.
 */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const G=()=>window.GoWorkoutGoalLab;
  const S=()=>window.GoWorkoutGoalStrategy;
  const supported=goal=>goal?.status==='active'&&!goal.painFlag&&num(G()?.assessmentBest?.(goal)??goal.baseline)>0&&Boolean(G()?.isRunnableGoal?.(goal));
  const all=training=>(training?.goalLab?.goals||[]).filter(goal=>['active','maintenance'].includes(goal.status));
  const live=training=>all(training).filter(goal=>goal.status==='active');
  const shortUnit=goal=>goal.unit==='seconds'?'sec':goal.unit==='miles'?'mi':'reps';
  function ensure(training){
    if(!training.goalLab||typeof training.goalLab!=='object')training.goalLab={version:1,goals:[]};
    const lab=training.goalLab;
    if(!lab.adaptiveExperience||typeof lab.adaptiveExperience!=='object')
      lab.adaptiveExperience={version:1,mode:'smart',notices:[]};
    const data=lab.adaptiveExperience;
    if(!['smart','review'].includes(data.mode))data.mode='smart';
    if(!Array.isArray(data.notices))data.notices=[];
    return data;
  }
  function mode(training){return ensure(training).mode;}
  function setMode(training,value){
    if(!['smart','review'].includes(value))return false;
    const x=ensure(training);if(x.mode===value)return false;
    x.mode=value;
    x.changedAt=new Date().toISOString();
    return true;
  }
  function facts(training){
    return live(training).map(g=>({
      id:String(g.id),kind:String(g.kind),variant:String(g.variant||''),unit:String(g.unit||''),
      target:num(g.target),status:String(g.status),pain:Boolean(g.painFlag),
      best:num(G()?.assessmentBest?.(g)??g.baseline)
    })).sort((a,b)=>a.id.localeCompare(b.id));
  }
  function snapshot(training,profile,plan){
    return {facts:facts(training),approved:Boolean(S()?.current?.(training,profile,plan)),
      signature:String(S()?.signature?.(training,profile,plan)||''),mode:mode(training)};
  }
  function sameGoalConstraints(a,b){
    return a.id===b.id && a.kind===b.kind && a.variant===b.variant &&
      a.unit===b.unit && a.target===b.target && a.status===b.status && a.pain===b.pain;
  }
  function afterGoalAction(before,training,profile,plan,catalog){
    if(!before)return false;
    const current=facts(training),prior=before.facts||[];
    if(!current.length)return false;
    const preferences=ensure(training);
    const strategy=training.goalLab?.strategy;
    const allComparable=prior.length===current.length&&prior.every((g,i)=>sameGoalConstraints(g,current[i]));
    const differences=current.filter((g,i)=>prior[i]&&g.best!==prior[i].best);
    const onlySafeBaselines=differences.length>0&&differences.every(g=>{
      const match=live(training).find(x=>x.id===g.id);
      const priorBest=prior.find(x=>x.id===g.id)?.best||0;
      const beforeTarget=prescribedNumber(match,priorBest);
      const afterTarget=prescribedNumber(match,g.best);
      const smallProgression=beforeTarget!==null&&afterTarget!==null&&
        (afterTarget<=beforeTarget||afterTarget-beforeTarget<=Math.max(2,Math.ceil(beforeTarget*.25)));
      return !g.pain&&g.best>0&&(strategy?.mode==='track'||(
        (strategy?.goalIds||[]).includes(g.id)&&supported(match)&&smallProgression));
    });
    const auto=Boolean(before.approved&&allComparable&&before.mode==='smart'&&
      strategy?.status==='active'&&onlySafeBaselines);
    let changed=false;
    for(const goal of current){
      const previous=prior.find(g=>g.id===goal.id);
      if(!previous||previous.best===goal.best||!sameGoalConstraints(previous,goal))continue;
      const full=live(training).find(g=>g.id===goal.id);
      const beforeReps=prescribedNumber(full,previous.best);
      const afterReps=prescribedNumber(full,goal.best);
      const status=auto&&strategy?.mode!=='track'?'auto':
        auto||strategy?.status!=='active'?'tracked':'review';
      const notice={
        id:'baseline-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
        goalId:goal.id,name:full?.name||'Personal goal',unit:shortUnit(full),
        from:previous.best,to:goal.best,previousPrescription:beforeReps,nextPrescription:afterReps,
        at:new Date().toISOString(),status,seen:false
      };
      preferences.notices.unshift(notice);
      changed=true;
    }
    preferences.notices=preferences.notices.slice(0,20);
    // Baseline-only changes to existing approved goals can refresh the
    // signature. New targets, variants, restrictions and priorities cannot.
    if(changed&&auto){
      strategy.approvedSignature=S().signature(training,profile,plan);
      strategy.revisions=Array.isArray(strategy.revisions)?strategy.revisions:[];
      strategy.revisions.push({at:new Date().toISOString(),type:'baseline-progress',mode:strategy.mode,
        goalIds:strategy.goalIds.slice(),signature:strategy.approvedSignature,
        description:'Comparable baseline reassessment refreshed eligible goal work; existing weekly schedule remains unchanged.'});
      strategy.revisions=strategy.revisions.slice(-30);
    }
    return changed;
  }
  function prescribedNumber(goal,best){
    if(!goal||!['reps','seconds'].includes(goal.unit)||!num(best))return null;
    return goal.unit==='seconds'?Math.max(8,Math.floor(num(best)*.65)):Math.max(1,Math.floor(num(best)*.55));
  }
  // Purposeful two-day opportunities for the lead goal with rest between
  // where possible. Slots are a *maximum*, never guaranteed prescriptions.
  function eligibleSlot(goalPosition,dayIndex,dayCount){
    if(!Number.isInteger(dayIndex)||dayIndex<0||!Number.isInteger(dayCount)||dayCount<1)return true;
    if(dayIndex>=dayCount||goalPosition<0||goalPosition>2)return false;
    if(dayCount===1)return goalPosition<2;
    if(dayCount===2)return goalPosition===0 || (goalPosition===1&&dayIndex===1) || (goalPosition===2&&dayIndex===0);
    return goalPosition===1?dayIndex===Math.floor((dayCount-1)/2):dayIndex===0||dayIndex===dayCount-1;
  }
  function goalInfo(training,profile,plan,catalog,entry,{draft=false,dayCount=0}={}){
    const strategy=S()?.ensure?.(training);
    const inDraft=Boolean(draft&&strategy?.draft);
    const chosen=inDraft?strategy.draft.goalIds:strategy?.goalIds||[];
    const option=inDraft?strategy.draft.mode:strategy?.mode;
    const isApproved=Boolean(!inDraft&&S()?.current?.(training,profile,plan));
    const day=entry?.adaptedDay||entry?.day||entry;
    const dayIndex=Number.isInteger(entry?.index)?entry.index:0;
    const count=dayCount||Math.max(1,num(profile?.days));
    const originalExercises=new Set((day?.exercises||[]).map(x=>x.id));
    const rows=all(training).map(goal=>{
      const position=chosen.indexOf(goal.id);
      const ex=catalog?.find(e=>e.id===goal.exerciseId);
      const isInDay=originalExercises.has(goal.exerciseId)&&Boolean(goal.exerciseId);
      const couldAdd=position>=0 && option==='integrate' && supported(goal)&&Boolean(ex)&&
        eligibleSlot(position,dayIndex,count) && !isInDay;
      const planned=Boolean((day?.exercises||[]).some(e=>e.goalStrategyId===goal.id));
      return {goal,position,isInDay,couldAdd,planned,approved:isApproved,proposed:inDraft,
        verified:num(G()?.assessmentBest?.(goal)??goal.baseline)};
    });
    return {rows,chosen,mode:option,approved:isApproved,draft:inDraft,day,dayIndex};
  }
  function plannedGoals(training,profile,plan,catalog,entry,opts={}){
    return goalInfo(training,profile,plan,catalog,entry,opts).rows.filter(x=>x.planned||x.couldAdd||x.isInDay);
  }
  function scheduleBadge(training,profile,plan,catalog,entry,dayCount){
    if(entry?.status==='skipped')return '';
    if(['complete','partial'].includes(entry?.status)){
      const completed=all(training).filter(g=>(entry.history?.exercises||[]).some(ex=>
        ex.id===g.exerciseId&&!ex.skipped&&(ex.sets||[]).some(set=>set.completed)));
      if(!completed.length)return '';
      return '<div class="adaptive-day-badge"><span>◎ '+esc(completed.slice(0,2).map(g=>g.name).join(' + '))+
        '</span><small>Goal-related exercise performed · not a maximum-reps reassessment</small></div>';
    }
    const data=goalInfo(training,profile,plan,catalog,entry,{dayCount});
    const active=data.rows.filter(x=>x.isInDay||x.planned||(data.approved&&x.couldAdd));
    if(!active.length)return '';
    const names=active.slice(0,2).map(x=>x.goal.name);
    const text=active.some(x=>x.planned)?'Added to prepared workout':active.some(x=>x.couldAdd&&data.approved)?'Goal work possible at setup':'Existing exercises support goals';
    return '<div class="adaptive-day-badge"><span>◎ '+esc(names.join(' + '))+'</span><small>'+esc(text)+'</small></div>';
  }
  function why(training,profile,plan,catalog,entry){
    const data=goalInfo(training,profile,plan,catalog,entry,{dayCount:Math.max(1,num(profile?.days))});
    const supportedRows=data.rows.filter(x=>x.isInDay||x.planned||(data.approved&&x.couldAdd));
    const general=String(profile?.goal||'').replace(/[-_]/g,' ').trim();
    const day=data.day||{};
    let html='<section class="adaptive-why"><p class="adaptive-kicker">WHY THIS WORKOUT?</p><h3>'+esc(day.name||'Today’s session')+'</h3>'+
      '<p>This session comes from your '+esc(num(profile?.days)||'saved')+'-day training program. The final session may adjust for readiness, equipment and available time.</p>';
    if(general)html+='<div class="adaptive-why-row"><strong>Overall training focus</strong><p>'+esc(general)+'. This workout contributes through '+esc(day.focus||'planned movement training')+'.</p></div>';
    if(supportedRows.length){
      html+=supportedRows.map(item=>{
        const g=item.goal,ex=(catalog||[]).find(e=>e.id===g.exerciseId);
        const prescription=S()?.prescription?.(g,catalog);
        const label=item.planned?'Added to this prepared session':item.isInDay?'Exercise already on this day':item.approved?'Eligible addition at readiness check':'Proposed, not approved';
        return '<div class="adaptive-why-row"><div class="adaptive-why-name"><strong>'+esc(g.icon||'🎯')+' '+esc(g.name)+'</strong><span>'+esc(label)+'</span></div>'+
          '<p>Verified '+esc(item.verified+' '+shortUnit(g))+' of '+esc(g.target+' '+shortUnit(g))+
          '. '+(prescription?esc(ex?.name||g.name)+' goal work calculates to '+esc(prescription.sets+' sets × '+prescription.reps)+'. ':'')+
          (item.isInDay?'Existing exercise overlap avoids duplicate additions.':item.planned?'This session includes an approved goal addition.':'This is an opportunity, not a guaranteed schedule change.')+'</p></div>';
      }).join('');
    }else html+='<div class="adaptive-why-row"><strong>No goal-specific addition assigned</strong><p>Your standard workout stays in place. Choose compatible goals and approve an integrated strategy to add goal-focused work on eligible days.</p></div>';
    return html+'<p class="adaptive-why-note">A goal assessment is not interchangeable with training sets. Planned additions can be reduced or omitted if recovery, equipment or time requires it.</p></section>';
  }
  function proposal(training,profile,plan,catalog,entries){
    const strategy=S()?.ensure?.(training);
    if(!strategy?.draft||!strategy.draft.preview||!Array.isArray(entries)||!entries.length)return '';
    const rows=entries.slice(0,7).map(entry=>{
      const data=goalInfo(training,profile,plan,catalog,entry,{draft:true,dayCount:entries.length});
      const additions=data.rows.filter(x=>x.couldAdd);
      const original=data.rows.filter(x=>x.isInDay&&data.chosen.includes(x.goal.id));
      const day=data.day||{};
      return '<div class="adaptive-compare-day"><div><small>'+esc(entry.dayName||entry.date?.toLocaleDateString?.(undefined,{weekday:'short'})||'Session')+'</small><strong>'+esc(day.name||'Workout')+'</strong><span>'+esc(day.focus||'Standard workout')+'</span></div>'+
        '<div><strong>'+esc(day.name||'Workout')+'</strong>'+
        (strategy.draft.mode==='integrate'&&additions.length?'<span class="adaptive-proposed-add">+ '+esc(additions.map(x=>x.goal.name).join(' · '))+' progression (if eligible)</span>':
          '<span>'+esc(original.length?'Supports '+original.map(x=>x.goal.name).join(', '):'No proposed additions')+'</span>')+'</div></div>';
    }).join('');
    return '<section class="adaptive-proposal" aria-label="Compare training strategy before approving"><p class="adaptive-kicker">BEFORE YOU APPROVE</p><h3>See how your training could adapt</h3>'+
      '<p>These are potential goal-work opportunities on your existing training days. Nothing changes until you approve. Even afterward, readiness and recovery determine actual additions.</p>'+
      '<div class="adaptive-compare-head"><strong>Current plan</strong><strong>Proposed goal integration</strong></div>'+rows+
      '<p class="adaptive-proposal-note">Workout days, existing exercises and history remain intact. Additional goal work may extend an eligible session, but is not guaranteed.</p></section>';
  }
  function notices(training){
    const saved=ensure(training).notices;
    if(!saved.length)return '';
    return '<section class="adaptive-evolution"><div class="adaptive-evolution-head"><div><span class="adaptive-kicker">TRAINING INTELLIGENCE</span><h3>'+esc(saved.some(n=>n.status==='auto')?'Your workout evolved':'Goal assessment updates')+'</h3></div><span>'+saved.length+' update'+(saved.length===1?'':'s')+'</span></div>'+
      saved.slice(0,2).map(n=>'<div class="adaptive-notice"><div><strong>'+esc(n.name)+'</strong><span class="adaptive-notice-status '+(n.status==='auto'?'auto':n.status==='tracked'?'tracked':'review')+'">'+(n.status==='auto'?'Routine prescription refreshed':n.status==='tracked'?'Assessment saved':'Strategy approval needed')+'</span></div>'+
        '<p>Verified baseline: <b>'+esc(n.from+' '+n.unit)+'</b> → <b>'+esc(n.to+' '+n.unit)+'</b></p>'+
        (n.previousPrescription!==null&&n.nextPrescription!==null?'<p>Working suggestion: 2 × '+n.previousPrescription+' → 2 × '+n.nextPrescription+(n.unit==='sec'?' sec':' reps')+'.</p>':'')+
        '<small>'+(n.status==='auto'?'Future eligible goal sessions use this recalculated suggestion; scheduled days did not change.':n.status==='tracked'?'Your assessment is recorded. No scheduled workout was changed.':'The updated strategy must be reviewed before new goal additions resume.')+'</small></div>').join('')+
      '<button type="button" data-tab="goals">REVIEW GOALS AND CHANGES →</button></section>';
  }
  function preferences(training){
    const selected=mode(training);
    return '<section id="adaptive-settings" class="adaptive-preferences"><p class="adaptive-kicker">TRAINING PREFERENCES</p><h3>How should GO Workout adapt your goals?</h3><p>Both choices protect your schedule and ask before major changes. This preference controls automatic <strong>goal-baseline</strong> updates; daily readiness safeguards still apply.</p>'+
      '<div class="adaptive-preference-grid">'+
      [['smart','✦','Smart Adaptive','Automatically refresh routine goal prescriptions after comparable baseline reassessments. Major strategy changes still require approval.','RECOMMENDED'],
       ['review','☷','Review Changes','Review goal strategy updates, including routine prescription changes, before they affect future goal work.','']].map(([id,icon,name,copy,tag])=>
       '<button type="button" class="adaptive-pref '+(selected===id?'chosen':'')+'" data-adaptive-action="mode" data-adaptive-mode="'+id+'" aria-pressed="'+(selected===id)+'">'+
       '<span class="adaptive-pref-top"><b>'+icon+' '+name+'</b><em>'+(selected===id?'● SELECTED':tag)+'</em></span><span>'+copy+'</span></button>').join('')+'</div></section>';
  }
  function goalsSummary(training,profile,plan,catalog,entries){
    const goals=all(training),selected=goals.filter(g=>g.status==='active');
    if(!goals.length)return '';
    const programGoal=String(profile?.goal||'').replace(/[-_]/g,' ');
    const active=Boolean(S()?.current?.(training,profile,plan));
    const strategy=S()?.ensure?.(training);
    return '<section class="adaptive-coordinator"><p class="adaptive-kicker">ONE PROGRAM · MULTIPLE GOALS</p><h3>How your goals fit together</h3><p>'+esc(programGoal?'Your overall focus: '+programGoal+'. ':'')+
      'GO Workout coordinates up to three prioritized measurable goals with your existing training schedule and recovery.</p>'+
      '<div class="adaptive-coordinator-goals">'+goals.map(g=>{
        const best=num(G()?.assessmentBest?.(g)??g.baseline),pct=num(g.target)>0?Math.min(100,Math.round(100*best/g.target)):0;
        return '<div><b>'+esc(g.icon||'◎')+' '+esc(g.name)+'</b><span>'+esc(best+' / '+g.target+' '+shortUnit(g))+'</span><i><em style="width:'+pct+'%"></em></i></div>';
      }).join('')+'</div>'+
      '<p class="adaptive-coordinator-status">'+(active&&strategy?.mode==='integrate'?
        'Integrated strategy approved. Goal work is distributed as conditional opportunities, not extra mandatory workout days.':
        active?'Your '+esc(strategy.mode)+' strategy keeps the existing weekly schedule.':
        'Select your priorities and approve a strategy to connect these goals with workouts.')+'</p></section>';
  }
  window.GoWorkoutAdaptiveExperience={ensure,mode,setMode,snapshot,afterGoalAction,eligibleSlot,goalInfo,plannedGoals,scheduleBadge,why,proposal,notices,preferences,goalsSummary,prescribedNumber};
  if(typeof module!=='undefined'&&module.exports)module.exports=window.GoWorkoutAdaptiveExperience;
})();