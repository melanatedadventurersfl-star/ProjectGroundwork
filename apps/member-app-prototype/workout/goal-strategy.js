/* GO Workout / Goal-to-Training Engine V2.
 * This module stores all settings in the signed-in workout account's
 * trainingProgram.goalLab.strategy. It NEVER mutates store.plan.
 */
(() => {
  'use strict';
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now=()=>new Date().toISOString();
  const copy=v=>JSON.parse(JSON.stringify(v));
  const kinds={pushup:'push-up',plank:'plank',squat:'bodyweight-squat',pullup:'pull-up'};
  const muscle={pushup:'Upper-body pushing and core',plank:'Core stability',squat:'Lower-body endurance',pullup:'Upper-body pulling and grip'};
  const modes={integrate:'Integrate with my current program',focused:'Keep my plan and offer goal-focus sessions',track:'Track goals without changing workouts'};
  const goalEngine=()=>window.GoWorkoutGoalLab;

  const units=g=>g.unit==='seconds'?'sec':g.unit==='miles'?'mi':g.unit==='meters'?'m':'reps';
  const isRow=g=>g?.kind==='row'&&g.unit==='meters';
  const hasRowBaseline=g=>isRow(g)&&!g.painFlag&&num(goalEngine()?.assessmentBest?.(g)??g.baseline)>0;
  function rowingGuide(g){
    if(!hasRowBaseline(g))return null;
    const best=num(goalEngine()?.assessmentBest?.(g)??g.baseline);
    const interval=Math.max(100,Math.min(500,Math.floor(best*.3/50)*50||100));
    const rounds=best<500?2:best<1200?3:4;
    return {name:'Indoor rowing technique and steady intervals',interval,rounds,
      description:'Try '+rounds+' × '+interval+' m at comfortable effort with recovery between efforts. Log a separate continuous-distance reassessment. This is guidance, not an automatically scheduled workout.'};
  }
  function support(g,catalog){
    if(g.painFlag)return {status:'paused',message:'Training additions are paused following your discomfort report.'};
    if(!num(goalEngine()?.assessmentBest?.(g)??g.baseline))return {status:'baseline',message:'Record a measured baseline before building this goal.'};
    if(isRow(g))return {status:'guided',message:'Your measured rowing goal is recognized. Guided rowing is available, but the workout runner cannot insert distance-based intervals automatically yet.'};
    if(g.kind==='custom'&&/\b(row|rowing|rower|ergometer)\b/i.test(g.name||''))return {status:'reconfigure',message:'Set up this goal in meters for rowing. Your original result remains saved.'};
    if(prescription(g,catalog))return {status:'supported',message:'Compatible baseline and workout exercise available.'};
    return {status:'tracking',message:'This goal is saved for assessments. No exact supported workout movement is available, so no substitute will be added.'};
  }
  function evidence(g){
    const tests=(g.assessments||[]).filter(a=>a.source==='discovery'&&(!a.unit||a.unit===g.unit)&&
      String(a.variant||'').toLowerCase()===String(g.variant||'').toLowerCase());
    if(!tests.length)return {status:'Not enough data',reason:'Record a comparable baseline.'};
    const last=Date.parse(tests[tests.length-1].at||'');
    if(g.painFlag)return {status:'Needs attention',reason:'Discomfort was recorded. Do not increase training automatically.'};
    if(!Number.isFinite(last)||Date.now()-last>21*86400000)return {status:'Needs reassessment',reason:'No comparable assessment in the past three weeks.'};
    if(tests.length<2)return {status:'Baseline recorded',reason:'A second comparable assessment will show progress.'};
    const first=num(tests[0].value),latest=num(tests[tests.length-1].value);
    return {status:latest>first?'Improving':latest<first?'Review progress':'Holding steady',
      reason:'Based on '+tests.length+' comparable assessments. Training sets do not verify goal completion.'};
  }

  function goals(training){return (training?.goalLab?.goals||[]).filter(g=>g.status==='active' || g.status==='maintenance');}
  function selected(training){return goals(training).filter(g=>g.status==='active');}
  function signature(training,profile,plan){
    const facts=goals(training).map(g=>[g.id,g.status,g.kind,g.unit,g.variant,g.target,num(goalEngine()?.assessmentBest?.(g)??g.baseline),Boolean(g.painFlag)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    return JSON.stringify([plan?.id||'',num(profile?.days),num(profile?.minutes),profile?.equipment||'',facts]);
  }
  function ensure(training){
    const lab=goalEngine()?.ensure(training) || (training.goalLab=training.goalLab||{goals:[]});
    if(!lab.strategy||typeof lab.strategy!=='object')lab.strategy={version:2,status:'inactive',mode:'track',goalIds:[],approvedSignature:null,approvedAt:null,revisions:[],trainingLog:[],checkIns:[],draft:null,allowExtension:true,rowerAccess:'unknown'};
    const s=lab.strategy;
    if(!['yes','no','unknown'].includes(s.rowerAccess))s.rowerAccess='unknown';
    if(typeof s.allowExtension!=='boolean')s.allowExtension=true;
    for(const key of ['goalIds','revisions','trainingLog','checkIns'])if(!Array.isArray(s[key]))s[key]=[];
    return s;
  }
  function current(training,profile,plan){
    const s=ensure(training);
    return s.status==='active'&&s.approvedSignature===signature(training,profile,plan);
  }
  function draft(training,profile,plan){
    const s=ensure(training),active=selected(training);
    return {mode:s.status==='active'?s.mode:'integrate',
      goalIds:(s.goalIds.length?s.goalIds:active.map(g=>g.id)).filter(id=>active.some(g=>g.id===id)).slice(0,3),
      signature:signature(training,profile,plan),preview:false,allowExtension:Boolean(s.allowExtension),rowerAccess:s.rowerAccess};
  }
  function sortedGoals(training,s){
    return s.goalIds.map(id=>selected(training).find(g=>g.id===id)).filter(Boolean);
  }
  function runnable(g){
    return g && g.status==='active'&&!g.painFlag&&num(goalEngine()?.assessmentBest?.(g)??g.baseline)>0&&goalEngine()?.isRunnableGoal(g);
  }
  function prescription(g,catalog){
    if(!runnable(g))return null;
    const ex=(catalog||[]).find(x=>x.id===kinds[g.kind]);
    if(!ex)return null;
    const baseline=num(goalEngine()?.assessmentBest?.(g)??g.baseline);
    if(baseline<=0)return null;
    const timed=g.unit==='seconds';
    const reps=timed?Math.max(8,Math.floor(baseline*.65)):Math.max(1,Math.floor(baseline*.55));
    const label=timed?reps+' sec':String(reps);
    return {...copy(ex),sets:2,reps:label,startReps:String(reps),rest:timed?45:60,setup:ex.setup||15,
      startWeight:0,calibrationRequired:false,goalStrategyId:g.id,goalStrategyVariation:g.variant,
      goalStrategyNote:'Goal progression for '+g.name+' using your assessed '+g.variant+' baseline.'};
  }
  function candidates(training,goalIds,catalog){
    const active=selected(training);
    const chosen=goalIds.map(id=>active.find(g=>g.id===id)).filter(Boolean);
    return chosen.map(g=>({goal:g,ex:prescription(g,catalog)}));
  }
  function preview(training,profile,plan,catalog){
    const s=ensure(training),d=s.draft||draft(training,profile,plan);
    const chosen=candidates(training,d.goalIds,catalog);
    const additions=chosen.filter(x=>x.ex);
    const unavailable=chosen.filter(x=>!x.ex);
    const guided=chosen.filter(x=>hasRowBaseline(x.goal)).map(x=>({goal:x.goal,guide:rowingGuide(x.goal)}));
    const mode=d.mode;
    return {mode,chosen,additions,unavailable,guided,
      trainingDays:num(profile?.days)||0,
      summary:mode==='integrate'?'Keep your existing plan, with up to two short, compatible goal progressions on a training day when readiness and available time permit. An added movement may extend that session by about 5 to 10 minutes. No existing exercise is removed.'
        :mode==='focused'?'Keep scheduled workouts unchanged. Use supported on-demand goal sessions and measured rowing guidance when equipment is confirmed. Distance intervals are not inserted into the workout runner.'
        :'Keep workouts unchanged. Track assessments, performance, and goal milestones only.'};
  }
  function action(training,name,node,context={}){
    const s=ensure(training),profile=context.profile||{},plan=context.plan||null,catalog=context.catalog||[];
    const data=node?.dataset||{};
    const done=(changed,message='')=>({changed,message});
    if(name==='strategy-open'){s.draft=draft(training,profile,plan);return done(true);}
    if(name==='strategy-cancel'){s.draft=null;return done(true);}
    if(name==='strategy-pause'){s.status='paused';s.draft=null;return done(true,'Goal integration paused. Your saved workouts are unchanged.');}
    if(name==='strategy-resume'){
      if(s.approvedSignature!==signature(training,profile,plan)){s.draft=draft(training,profile,plan);return done(true,'Review the strategy before resuming. Your goals or program changed.');}
      s.status='active';return done(true,'Approved goal strategy resumed.');
    }
    if(name==='strategy-maintain'){
      const goal=goals(training).find(g=>g.id===data.goalId);
      if(!goal||goal.status!=='active')return done(false);
      if(num(goalEngine()?.assessmentBest?.(goal)??goal.baseline)<num(goal.target))return done(false,'Complete a goal reassessment before switching to maintenance.');
      goal.status='maintenance';goal.updatedAt=now();s.draft=null;
      return done(true,'Goal moved to maintenance. Review your strategy to update your training priorities.');
    }
    if(name==='strategy-reactivate'){
      const goal=goals(training).find(g=>g.id===data.goalId);
      if(!goal||goal.status!=='maintenance')return done(false);
      goal.status='active';goal.updatedAt=now();s.draft=null;return done(true,'Goal reactivated. Review your training strategy to include it.');
    }
    if(name==='strategy-checkin-choice'){
      const entryId=String(data.workoutId||'');
      const value=String(data.value||'');
      if(!['easy','manageable','hard','pain','fatigue','time','none'].includes(value))return done(false);
      s.checkInDraft=s.checkInDraft?.workoutId===entryId?s.checkInDraft:{workoutId:entryId,effort:'manageable',limitation:'none'};
      s.checkInDraft[data.field==='limitation'?'limitation':'effort']=value;return done(true);
    }
    if(name==='strategy-checkin-save'){
      const entryId=String(data.workoutId||'');
      const item=(context.history||[]).find(h=>h.id===entryId && !h.manualWorkoutCompletion);
      if(!item)return done(false,'The completed workout was not found.');
      const fields=s.checkInDraft?.workoutId===entryId?s.checkInDraft:{workoutId:entryId,effort:'manageable',limitation:'none'};
      if(!['easy','manageable','hard','pain'].includes(fields.effort)||!['none','fatigue','time','pain'].includes(fields.limitation))return done(false);
      s.checkIns=s.checkIns.filter(c=>c.workoutId!==entryId).concat({...fields,at:now()}).slice(-60);
      s.checkInDraft=null;
      return done(true,'Check-in saved. Upcoming sessions can respond to your feedback.');
    }
    if(!s.draft)return done(false);
    const d=s.draft;
    if(name==='strategy-extension'){d.allowExtension=data.value==='yes';d.preview=false;return done(true);}
    if(name==='strategy-rower-access'){if(!['yes','no','unknown'].includes(data.value))return done(false);d.rowerAccess=data.value;d.preview=false;return done(true);}
    if(name==='strategy-mode'){if(!Object.hasOwn(modes,data.mode))return done(false);d.mode=data.mode;d.preview=false;return done(true);}
    if(name==='strategy-toggle'){
      const id=String(data.goalId||'');
      if(!selected(training).some(g=>g.id===id))return done(false);
      if(d.goalIds.includes(id)){d.goalIds=d.goalIds.filter(x=>x!==id);}else if(d.goalIds.length<3){d.goalIds.push(id);}else return done(false,'Choose up to three goals for your current training cycle. Other goals remain saved.');
      d.preview=false;return done(true);
    }
    if(name==='strategy-move'){
      const id=String(data.goalId||''),i=d.goalIds.indexOf(id),step=data.direction==='up'?-1:1,j=i+step;
      if(i<0||j<0||j>=d.goalIds.length)return done(false);
      [d.goalIds[i],d.goalIds[j]]=[d.goalIds[j],d.goalIds[i]];d.preview=false;return done(true);
    }
    if(name==='strategy-preview'){
      if(!d.goalIds.length&&d.mode!=='track')return done(false,'Choose at least one training goal.');
      d.preview=true;return done(true);
    }
    if(name==='strategy-approve'){
      if(!d.preview)return done(false,'Review the proposed changes before approving.');
      if(d.signature!==signature(training,profile,plan)){s.draft=draft(training,profile,plan);return done(true,'Your goals or program changed. Review the updated strategy before approval.');}
      const p=preview(training,profile,plan,catalog);
      if(d.rowerAccess!=='yes'&&d.mode==='focused'&&p.guided.length&&!p.additions.length)return done(false,'Confirm access to a rowing machine or choose tracking mode.');
      if(d.mode==='integrate'&&p.additions.length===0)return done(false,'No selected goals currently have compatible exercise variations. Select a compatible goal or choose tracking mode.');
      if(d.mode==='focused'&&p.additions.length===0&&!(d.rowerAccess==='yes'&&p.guided.length))return done(false,'Complete a supported baseline, confirm rowing machine access for guided rowing, or select tracking mode.');
      const record={at:now(),mode:d.mode,goalIds:d.goalIds.slice(),signature:d.signature,description:p.summary,allowExtension:d.allowExtension,rowerAccess:d.rowerAccess};
      s.revisions.push(record);s.revisions=s.revisions.slice(-30);
      s.status='active';s.mode=d.mode;s.goalIds=d.goalIds.slice();s.approvedSignature=d.signature;s.approvedAt=record.at;s.allowExtension=d.allowExtension;s.rowerAccess=d.rowerAccess;s.draft=null;
      return done(true,'Strategy approved. Your original workout plan and training history are preserved.');
    }
    return done(false);
  }
  function applyDay(training,day,catalog,profile,opts={}){
    const s=ensure(training);
    if(!day||!current(training,profile,opts.plan)||s.mode!=='integrate'||day.goalFocused||opts.shared)return day;
    const available=num(opts.minutes)||num(profile?.minutes)||30;
    if(available<20||num(opts.soreness)>=4||num(opts.energy)>0&&num(opts.energy)<=2||num(opts.sleep)>0&&num(opts.sleep)<=2)return day;
    const checkin=recentCheckin(s);
    if(checkin&&(checkin.effort==='pain'||checkin.limitation==='pain'))return day;
    const conservative=Boolean(checkin&&(checkin.effort==='hard'||checkin.limitation==='fatigue'));
    const exerciseIds=new Set((day.exercises||[]).map(x=>x.id));
    const selectedCandidates=candidates(training,s.goalIds,catalog);
    const result=copy(day);
    const added=[];
    for(const {goal,ex} of selectedCandidates){
      if(added.length>=2)break;
      if(Number.isInteger(opts.dayIndex)&&window.GoWorkoutAdaptiveExperience &&
        !window.GoWorkoutAdaptiveExperience.eligibleSlot(s.goalIds.indexOf(goal.id),opts.dayIndex,Math.max(1,num(profile?.days)||1)))continue;
      if(!ex||exerciseIds.has(ex.id))continue;
      const estimated=num(result.estimatedMinutes)||available;
      if(!s.allowExtension&&estimated+5>available)continue;
      if(s.allowExtension&&estimated+5>available+10)continue;
      if(typeof opts.allowExercise==='function'&&!opts.allowExercise(ex))continue;
      const recentlyTrained=s.trainingLog.some(log=>Date.now()-Date.parse(log.at)<40*3600000&&
        Date.now()-Date.parse(log.at)>=0&&log.results.some(x=>x.goalId===goal.id));
      if(recentlyTrained)continue;
      if(profile?.avoid?.includes('floor')&&['plank','push-up'].includes(ex.id))continue;
      if(profile?.avoid?.includes('knee')&&ex.id==='bodyweight-squat')continue;
      // Never modify or replace an existing movement. Extras are opt-in
      // from the approved strategy and are limited to two movements.
      result.estimatedMinutes=(num(result.estimatedMinutes)||available)+5;
      result.exercises.push(conservative?{...ex,sets:1,goalStrategyNote:ex.goalStrategyNote+' Reduced to one set based on recent effort.'}:ex);
      exerciseIds.add(ex.id);added.push(goal.name);
    }
    if(!added.length)return day;
    result.goalStrategyExtras=added.slice();
    result.goalStrategyVersion=s.approvedAt;
    result.goalStrategyExplanation='Added approved goal progressions: '+added.join(', ')+'.'+(conservative?' Reduced sets after demanding recent training.':'');
    // Duration changes only for exercises actually appended.
    result.adaptationNotes=[...(result.adaptationNotes||[]),result.goalStrategyExplanation];
    return result;
  }
  function onWorkout(training,entry){
    const s=ensure(training);
    if(!entry?.id||s.trainingLog.some(e=>e.workoutId===entry.id))return false;
    const G=goalEngine();
    const results=[];
    for(const g of goals(training)){
      if(!G?.isRunnableGoal(g)||!g.exerciseId||g.unit==='miles')continue;
      const exercises=(entry.exercises||[]).filter(ex=>ex.id===g.exerciseId&&!ex.skipped);
      const sets=exercises.flatMap(ex=>(ex.sets||[]).filter(set=>set.completed));
      if(!sets.length)continue;
      const values=sets.map(x=>num(x.reps)).filter(x=>x>0);
      if(!values.length)continue;
      results.push({goalId:g.id,name:g.name,unit:g.unit,completedSets:sets.length,
        totalTrainingVolume:values.reduce((a,b)=>a+b,0),bestTrainingSet:Math.max(...values)});
      g.trainingBest=Math.max(num(g.trainingBest),Math.max(...values));
    }
    s.trainingLog.unshift({workoutId:entry.id,at:entry.completedAt||now(),status:entry.completionStatus,results});
    s.trainingLog=s.trainingLog.slice(0,100);
    return Boolean(results.length);
  }
  function recentCheckin(s){
    const last=s.checkIns[s.checkIns.length-1];
    return last&&Date.now()-Date.parse(last.at)<72*3600000?last:null;
  }
  function weekly(training,history,profile,plan){
    const s=ensure(training),start=new Date(),day=start.getDay();
    start.setHours(0,0,0,0);start.setDate(start.getDate()-((day+6)%7));
    const weekStart=start.getTime(),end=weekStart+7*86400000;
    const matches=(history||[]).filter(h=>{
      const t=Date.parse(h.completedAt||'');
      return t>=weekStart&&t<end&&h.completionStatus==='complete'&&!h.manualWorkoutCompletion;
    });
    const ids=new Set(matches.map(h=>h.id));
    const tracked=s.trainingLog.filter(x=>ids.has(x.workoutId));
    const supported=new Set(tracked.flatMap(x=>x.results.map(y=>y.goalId)));
    const sets=tracked.reduce((n,x)=>n+x.results.reduce((m,y)=>m+y.completedSets,0),0);
    const deferred=[];
    for(const g of goals(training)){
      if(g.status!=='active')continue;
      const tests=(g.assessments||[]).filter(a=>a.source==='discovery'&&a.unit===g.unit&&String(a.variant).toLowerCase()===String(g.variant).toLowerCase());
      if(!tests.length)continue;
      const last=tests[tests.length-1];
      if(Date.now()-Date.parse(last.at)>=14*86400000)deferred.push(g.name);
    }
    const last=recentCheckin(s);
    const tip=last?.limitation==='pain'||last?.effort==='pain'?'Your last check-in recorded discomfort. Hold progression and review exercise suitability.'
      :last?.effort==='hard'||last?.limitation==='fatigue'?'Your latest session was demanding. Keep upcoming goal work conservative.'
      :matches.length===0?'No completed workouts recorded this week. Your baselines have not changed. Resume at a manageable level.'
      :'Training was logged. Goal achievement still requires a comparable reassessment.';
    return {weekStart:new Date(weekStart).toISOString().slice(0,10),sessions:matches.length,goalSessions:supported.size,goalSets:sets,retests:deferred,tip};
  }
  function checkin(training,history){
    const s=ensure(training),latest=(history||[]).find(h=>!h.manualWorkoutCompletion&&h.completionStatus==='complete');
    if(!latest)return '';
    const saved=s.checkIns.find(c=>c.workoutId===latest.id);
    if(saved)return '<section class="goal-strategy-review"><strong>Latest workout check-in</strong><p>Effort: '+safe(saved.effort)+'. Limitation: '+safe(saved.limitation)+'.</p></section>';
    const d=s.checkInDraft?.workoutId===latest.id?s.checkInDraft:{effort:'manageable',limitation:'none'};
    const button=(field,value,label)=>'<button class="'+(d[field]===value?'chosen':'')+'" data-goal-action="strategy-checkin-choice" data-workout-id="'+safe(latest.id)+'" data-field="'+field+'" data-value="'+value+'">'+safe(label)+'</button>';
    return '<section class="goal-strategy-review"><h3>How did your last session feel?</h3><p>Feedback helps decide whether to keep upcoming goal work conservative.</p>'+
      '<strong>Overall effort</strong><div class="goal-strategy-choices">'+button('effort','easy','Comfortable')+button('effort','manageable','Manageable')+button('effort','hard','Near my limit')+button('effort','pain','Pain')+'</div>'+
      '<strong>What held you back?</strong><div class="goal-strategy-choices">'+button('limitation','none','Nothing')+button('limitation','fatigue','Fatigue')+button('limitation','time','Time')+button('limitation','pain','Discomfort')+'</div>'+
      '<button class="goal-primary" data-goal-action="strategy-checkin-save" data-workout-id="'+safe(latest.id)+'">SAVE CHECK-IN</button></section>';
  }
  function summary(training,history,profile,plan){
    const s=ensure(training),w=weekly(training,history,profile,plan);
    if(!goals(training).length)return '';
    return '<section class="goal-strategy-review"><span class="goal-kicker">WEEKLY GOAL REVIEW</span><h3>Your progress is about more than one number</h3>'+
      '<div class="goal-strategy-stats"><div><strong>'+w.sessions+'</strong><small>Completed workouts</small></div><div><strong>'+w.goalSets+'</strong><small>Goal-related sets</small></div><div><strong>'+w.goalSessions+'</strong><small>Goals trained</small></div></div>'+
      '<p>'+safe(w.tip)+'</p>'+ 
      '<div class="goal-evidence-list">'+selected(training).map(g=>{const e=evidence(g);return '<p><b>'+safe(g.name)+': '+safe(e.status)+'</b> · '+safe(e.reason)+'</p>';}).join('')+'</div>'+
      (w.retests.length?'<p>Reassessment available for: '+safe(w.retests.join(', '))+'. You decide when to retest.</p>':'')+
      '</section>';
  }
  // A single compact Goals panel lives below the primary daily workout card.
  // Goal settings and strategy review stay on the dedicated Goals screen.
  function homePanel(training,profile,plan){
    const visible=goals(training);
    if(!visible.length)return '';
    const s=ensure(training),G=goalEngine(),needsReview=s.status==='active'&&!current(training,profile,plan);
    const cards=visible.map(g=>{
      const best=num(G?.assessmentBest?.(g)??g.baseline);
      const target=Math.max(1,num(g.target));
      const progress=Math.max(0,Math.min(100,Math.round(best/target*100)));
      const unit=units(g);
      const milestone=num(G?.nextMilestone?.(g)??target);
      const label=String(g.target)+' '+String(g.name||'Personal goal');
      return '<div class="home-goal-item" role="group" aria-label="'+safe(g.name)+' goal">'+
        '<div class="home-goal-line"><div class="home-goal-icon" aria-hidden="true">'+safe(g.icon||'🎯')+'</div>'+
          '<div class="home-goal-labels"><strong>'+safe(label)+'</strong><span>'+safe(best)+' / '+safe(g.target)+' '+safe(unit)+'</span></div>'+
          '<span class="home-goal-percent">'+progress+'%</span></div>'+
        '<div class="home-goal-progress" role="progressbar" aria-label="'+safe(g.name)+' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+progress+'"><i style="width:'+progress+'%"></i></div>'+
        '<p class="home-goal-milestone">'+(g.status==='maintenance'?'Maintenance goal':progress===100?'Target verified in an assessment':'Next milestone: '+safe(milestone)+' '+safe(unit))+'</p>'+
      '</div>';
    }).join('');
    const statusText=needsReview?'Your goals changed. Review your strategy before adding new training.'
      :s.status==='active'&&s.mode==='integrate'?'Your approved goals can support your daily workouts.'
      :s.status==='active'&&s.mode==='focused'?'Your goals have separate focus sessions when you choose them.'
      :s.status==='active'&&s.mode==='track'?'Your goals are being tracked without changing workouts.'
      :s.status==='paused'?'Goal integration is paused. Your workouts are unchanged.'
      :'Connect your goals to your weekly workouts without losing your current program.';
    const title=needsReview?'Your strategy needs a review':s.status==='active'?'Your training strategy':'Turn your goals into a plan';
    const primary=needsReview?'REVIEW MY STRATEGY':s.status==='active'?'ADJUST TRAINING STRATEGY':'BUILD MY TRAINING STRATEGY';
    return '<section class="home-goals-panel" aria-label="Personal goals and training strategy">'+
      '<div class="home-goals-heading"><span>PERSONAL GOALS</span><small>'+visible.length+' SAVED</small></div>'+
      '<div class="home-goals-track" aria-label="Your saved goals">'+cards+'</div>'+
      (visible.length>1?'<small class="home-goal-swipe">Swipe to see more goals</small>':'')+
      '<div class="home-goals-strategy"><div class="home-goals-strategy-icon" aria-hidden="true">↗</div><div>'+
        '<strong>'+safe(title)+'</strong><p>'+safe(statusText)+'</p></div></div>'+
      '<div class="home-goals-actions"><button type="button" class="home-goals-primary" data-goal-action="strategy-open">'+safe(primary)+' <span aria-hidden="true">→</span></button>'+
        '<button type="button" class="home-goals-secondary" data-tab="goals">VIEW ALL GOALS</button></div>'+
      '</section>';
  }
  function teaser(training,profile,plan){
    if(!selected(training).length)return '';
    const s=ensure(training),needsReview=s.status==='active'&&!current(training,profile,plan);
    return '<section class="goal-strategy-teaser"><div><small>YOUR TRAINING STRATEGY</small><strong>'+safe(needsReview?'Strategy review needed':s.status==='active'?'Approved · '+modes[s.mode]:s.status==='paused'?'Goal integration paused':'Turn your goals into a plan')+'</strong>'+
      '<p>'+safe(needsReview?'Your saved goals or training program changed. Review before goal sessions can update.':s.status==='active'?'Your original plan remains intact.':'Choose up to three goals to prioritize this cycle.')+'</p></div>'+
      '<button data-tab="goals">REVIEW GOALS →</button></section>';
  }

  // Read-only explanation of the path from a verified goal baseline to
  // an actual workout. Never interpret a proposed progression as scheduled.
  function goalImpactPanel(training,profile,plan,catalog,history){
    const all=goals(training);
    const selectedId=training?.goalLab?.selectedId;
    const visible=selectedId?all.filter(g=>g.id===selectedId):all;
    if(!visible.length)return '';
    const s=ensure(training);
    const G=goalEngine();
    const approved=current(training,profile,plan);
    const activeIds=Array.isArray(s.goalIds)?s.goalIds:[];
    const draftIds=Array.isArray(s.draft?.goalIds)?s.draft.goalIds:[];
    const activeMode=approved?s.mode:'';
    const cards=visible.map(g=>{
      const baseline=num(g.baseline);
      const verified=num(G?.assessmentBest?.(g)??baseline);
      const target=num(g.target);
      const unit=units(g);
      const progress=target>0?Math.min(100,Math.max(0,Math.round(verified/target*100))):0;
      const linked=activeIds.includes(g.id);
      const draftLinked=draftIds.includes(g.id);
      const order=activeIds.indexOf(g.id);
      const proposed=prescription(g,catalog);
      const oldPrescribed=baseline>0 && proposed ?
        (g.unit==='seconds'?Math.max(8,Math.floor(baseline*.65)):Math.max(1,Math.floor(baseline*.55))) : null;
      const newPrescribed=proposed?.startReps?num(proposed.startReps):null;
      const actual=(history||[]).filter(entry=>{
        if(entry.completionStatus!=='complete')return false;
        return (entry.exercises||[]).some(ex=>ex.goalStrategyId===g.id && !ex.skipped) ||
          (entry.goalStrategyExtras||[]).includes(g.name);
      });
      let state='Not connected',why='This goal is being tracked, but has not been added to your workout strategy.';
      let type='neutral';
      if(g.status==='maintenance'){
        state='Maintenance';why='You reached your assessed target. No new progression is prescribed for this goal.';
      }else if(g.painFlag){
        state='Paused for discomfort';why='Goal-specific progressions are unavailable while discomfort is recorded.';
        type='review';
      }else if(!proposed){
        state=isRow(g)?'Guided rowing':'Assessment or exercise review needed';
        why=support(g,catalog).message;
        type='review';
      }else if(s.draft && draftLinked){
        state='Proposed, not applied';why='The strategy draft includes this goal. Approve it before goal work can be added to eligible sessions.';
      }else if(s.status==='active' && !approved && linked){
        state='Review needed';why='Your goal, verified baseline, or program changed after approval. The previous strategy is not applied until you approve the update.';
        type='review';
      }else if(approved && linked && activeMode==='integrate'){
        state='Approved · conditional addition';
        why='This progression can be added when you prepare an eligible workout. Readiness, available time and exercises already included decide whether it appears. Your weekly schedule is not rewritten.';
        type='linked';
      }else if(approved && linked && activeMode==='focused'){
        state='Approved · separate focus session';
        why='The goal informs an on-demand workout. Your existing scheduled workouts remain unchanged.';
        type='linked';
      }else if(approved && linked && activeMode==='track'){
        state='Tracking only';why='Your assessments are monitored. Your workouts and schedule do not change.';
      }else if(s.status==='paused' && linked){
        state='Integration paused';why='Your approved goal additions are paused. Scheduled workouts remain unchanged.';
      }else if(s.draft && !draftLinked){
        state='Not selected in draft';why='This goal is not in the strategy currently being prepared.';
      }else if(approved && !linked){
        state='Not prioritized';why='This goal is saved but has no workout additions in the approved strategy.';
      }
      const initialChange=oldPrescribed!==null && newPrescribed!==null && oldPrescribed!==newPrescribed;
      const goalEvidence=evidence(g);
      const prescribed=proposed ? proposed.sets+' sets × '+proposed.reps+
        (g.unit==='seconds'?' per hold':' reps') : isRow(g)?'Guided rowing practice, not added to workouts':'No automatic prescription';
      const baselineText=baseline>0?baseline+' '+unit:'Not assessed';
      const verifiedText=verified>0?verified+' '+unit:'Not assessed';
      return '<article class="goal-impact-card">'+
        '<div class="goal-impact-card-heading"><div><span class="goal-impact-eyebrow">GOAL → BASELINE → WORKOUT</span><h3>'+safe(g.icon||'🎯')+' '+safe(g.name)+'</h3></div><span class="goal-impact-state '+type+'">'+safe(state)+'</span></div>'+
        '<div class="goal-impact-metrics"><div><small>Initial baseline</small><strong>'+safe(baselineText)+'</strong></div><div><small>Current verified best</small><strong>'+safe(verifiedText)+'</strong></div><div><small>Target</small><strong>'+safe(target+' '+unit)+'</strong></div></div>'+
        '<div class="goal-impact-track" role="progressbar" aria-label="Verified '+safe(g.name)+' goal progress" aria-valuenow="'+progress+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+progress+'%"></i></div>'+
        '<div class="goal-impact-prescription"><div><small>Baseline-informed prescription</small><strong>'+safe(prescribed)+'</strong></div>'+
        (initialChange?'<span>At initial baseline the same rule suggests '+safe('2 sets × '+oldPrescribed+(g.unit==='seconds'?' sec':' reps'))+'. Current calculated work: '+safe(prescribed)+'. This comparison does not mean either workout was performed.</span>':
          '<span>Calculated from the latest comparable assessment, not from a predicted result.</span>')+'</div>'+
        '<p class="goal-impact-explanation"><b>Did the workout change?</b> '+safe(why)+'</p>'+ 
        '<p class="goal-impact-evidence"><b>'+safe(goalEvidence.status)+'</b> · '+safe(goalEvidence.reason)+'</p>'+
        (actual.length?'<p class="goal-impact-record">Recorded goal additions in '+actual.length+' workout'+(actual.length===1?'':'s')+'.</p>':
          '<p class="goal-impact-record">No confirmed goal-specific additions in available workout history.</p>')+
        (linked&&approved&&activeMode==='integrate'?'<p class="goal-impact-subtle">Approved priority '+(order+1)+'. Any addition happens at workout preparation, not automatically on the weekly calendar.</p>':'')+
      '</article>';
    }).join('');
    return '<section class="goal-impact-panel" aria-label="How your goals affect your workouts">'+
      '<div class="goal-impact-intro"><span class="goal-impact-eyebrow">TRAINING TRANSPARENCY</span><h2>See what your baseline changes</h2>'+
      '<p>Track the actual link between what you can do, the prescription GO Workout proposes, and whether that work is approved or added. A suggestion is not the same as a changed workout.</p></div>'+
      '<div class="goal-impact-list">'+cards+'</div>'+
      '<div class="goal-impact-footer"><button type="button" data-tab="train">VIEW TRAINING SCHEDULE →</button></div></section>';
  }

  function panel(training,profile,plan,catalog,history,schedule=[]){
    const active=selected(training),s=ensure(training);
    if(!goals(training).length||training.goalLab?.draft)return '';
    const d=s.draft,needsReview=s.status==='active'&&!current(training,profile,plan);
    let html=goalImpactPanel(training,profile,plan,catalog,history)+'<section class="goal-strategy-panel" id="training-strategy"><div class="goal-strategy-heading"><span class="goal-kicker">GO WORKOUT / YOUR TRAINING STRATEGY</span><h2>Multiple goals. One training plan.</h2><p>Your strategy coordinates priorities without resetting your existing plan or history.</p></div>';
    if(!d){
      html+='<div class="goal-strategy-status"><strong>'+safe(needsReview?'Review needed':s.status==='active'?modes[s.mode]:s.status==='paused'?'Integration paused':'No strategy approved yet')+'</strong>'+
        '<span>'+safe(needsReview?'Your goals or profile changed since approval. Existing workouts stay untouched until you approve an updated strategy.':s.status==='active'?'Approved '+new Date(s.approvedAt).toLocaleDateString()+'. Changes apply at the next workout readiness check.':'Your goals remain saved and individually assessable.')+'</span></div>'+
        '<div class="goal-strategy-actions"><button class="goal-primary" data-goal-action="strategy-open">'+safe(s.status==='active'?'REVIEW / CHANGE STRATEGY':'BUILD MY TRAINING STRATEGY')+'</button>'+
        (s.status==='active'?'<button data-goal-action="strategy-pause">PAUSE GOAL INTEGRATION</button>':s.status==='paused'?'<button data-goal-action="strategy-resume">RESUME</button>':'')+'</div>';
    }else{
      const p=preview(training,profile,plan,catalog);
      html+='<h3>1. Decide how your goals affect training</h3><div class="goal-strategy-modes">'+Object.entries(modes).map(([id,label])=>
        '<button class="'+(d.mode===id?'chosen':'')+'" data-goal-action="strategy-mode" data-mode="'+id+'">'+safe(label)+'</button>').join('')+'</div>'+
        '<h3>2. Choose up to three priorities</h3><p>Other goals stay saved. Move your highest priority to the top.</p>'+
        '<div class="goal-strategy-priorities">'+active.map(g=>{
          const index=d.goalIds.indexOf(g.id),chosen=index>=0;
          return '<div class="goal-strategy-priority"><button class="'+(chosen?'chosen':'')+'" data-goal-action="strategy-toggle" data-goal-id="'+safe(g.id)+'">'+(chosen?'✓ ':'+ ')+safe(g.name)+'</button>'+
            (chosen?'<span>#'+(index+1)+'</span><button title="Move priority up" data-goal-action="strategy-move" data-direction="up" data-goal-id="'+safe(g.id)+'">↑</button><button title="Move priority down" data-goal-action="strategy-move" data-direction="down" data-goal-id="'+safe(g.id)+'">↓</button>':'')+
            '</div>';
        }).join('')+'</div>';
      html+='<div class="goal-strategy-options"><h3>3. Check training requirements</h3>'+
        '<p>Automatic additions never replace existing exercises. You control whether short sessions can extend your workout.</p>'+
        '<div class="goal-strategy-choices"><button class="'+(d.allowExtension?'chosen':'')+'" data-goal-action="strategy-extension" data-value="yes">Allow up to 10 extra minutes</button><button class="'+(!d.allowExtension?'chosen':'')+'" data-goal-action="strategy-extension" data-value="no">Stay within my session time</button></div>'+
        (d.goalIds.some(id=>active.some(g=>g.id===id&&isRow(g)))?'<p><b>For guided rowing:</b> do you have access to an indoor rowing machine?</p><div class="goal-strategy-choices">'+[['yes','Yes'],['no','Not now'],['unknown','Not sure']].map(([v,label])=>'<button class="'+(d.rowerAccess===v?'chosen':'')+'" data-goal-action="strategy-rower-access" data-value="'+v+'">'+label+'</button>').join('')+'</div>':'')+'</div>';
      if(d.preview){
        html+='<div class="goal-strategy-preview"><h3>4. Review proposed changes</h3><p>'+safe(p.summary)+'</p>'+
          '<p><strong>Selected priorities:</strong> '+safe(p.chosen.map(x=>x.goal.name).join(', ')||'None')+'</p>'+
          (window.GoWorkoutAdaptiveExperience?window.GoWorkoutAdaptiveExperience.proposal(training,profile,plan,catalog,schedule):'')+
          (d.mode==='integrate'||d.mode==='focused'?'<div class="goal-strategy-changes">'+p.additions.map(x=>'<div><b>+ '+safe(x.ex.name)+'</b><span>'+safe(x.ex.sets+' sets × '+x.ex.reps)+' · '+safe(muscle[x.goal.kind]||'Goal progression')+'</span></div>').join('')+'</div>':'')+
          (p.guided.length?'<div class="goal-strategy-guides"><h4>Measured rowing guidance</h4>'+p.guided.map(({goal,guide})=>'<div class="goal-strategy-guide"><strong>'+safe(goal.name)+'</strong><span>'+safe(guide.description)+'</span></div>').join('')+'<p>These distance intervals are guidance only. They will not appear as executable sets in the current workout runner. '+(d.rowerAccess==='yes'?'Rowing machine access confirmed.':'Confirm machine access for a separate guided focus strategy.')+'</p></div>':'')+
          (p.unavailable.length?'<div class="goal-strategy-notice"><strong>Goals needing a different training route</strong>'+p.unavailable.map(x=>'<p><b>'+safe(x.goal.name)+':</b> '+safe(support(x.goal,catalog).message)+'</p>').join('')+'</div>':'')+
          '<p><strong>Unchanged:</strong> Your existing schedule, exercises, partner settings, workout history, and saved baseline assessments.</p>'+
          '<div class="goal-strategy-actions"><button class="goal-primary" data-goal-action="strategy-approve">APPROVE STRATEGY</button><button data-goal-action="strategy-preview">REFRESH PREVIEW</button></div></div>';
      }else{
        html+='<button class="goal-primary" data-goal-action="strategy-preview">PREVIEW TRAINING CHANGES →</button>';
      }
      html+='<button class="goal-strategy-text-button" data-goal-action="strategy-cancel">CANCEL, KEEP EXISTING SETTINGS</button>';
    }
    const reached=goals(training).filter(g=>g.status==='active'&&num(goalEngine()?.assessmentBest?.(g)??g.baseline)>=num(g.target));
    if(reached.length)html+='<div class="goal-strategy-review"><h3>Assessment milestones achieved</h3>'+reached.map(g=>'<div class="goal-strategy-maintain"><span>'+safe(g.name)+' · '+safe(g.target)+' '+safe(g.unit)+'</span><button data-goal-action="strategy-maintain" data-goal-id="'+safe(g.id)+'">MOVE TO MAINTENANCE</button></div>').join('')+'</div>';
    const maintenance=goals(training).filter(g=>g.status==='maintenance');
    if(maintenance.length)html+='<div class="goal-strategy-review"><h3>Maintenance goals</h3>'+maintenance.map(g=>'<div class="goal-strategy-maintain"><span>'+safe(g.name)+'</span><button data-goal-action="strategy-reactivate" data-goal-id="'+safe(g.id)+'">TRAIN THIS GOAL AGAIN</button></div>').join('')+'</div>';
    return html+'</section>'+summary(training,history,profile,plan)+checkin(training,history);
  }
  window.GoWorkoutGoalStrategy={ensure,signature,current,preview,action,applyDay,onWorkout,weekly,summary,teaser,homePanel,panel,checkin,prescription};
})();