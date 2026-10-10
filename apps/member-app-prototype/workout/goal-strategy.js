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
  function goals(training){return (training?.goalLab?.goals||[]).filter(g=>g.status==='active' || g.status==='maintenance');}
  function selected(training){return goals(training).filter(g=>g.status==='active');}
  function signature(training,profile,plan){
    const facts=goals(training).map(g=>[g.id,g.status,g.kind,g.unit,g.variant,g.target,num(goalEngine()?.assessmentBest?.(g)??g.baseline),Boolean(g.painFlag)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    return JSON.stringify([plan?.id||'',num(profile?.days),num(profile?.minutes),profile?.equipment||'',facts]);
  }
  function ensure(training){
    const lab=goalEngine()?.ensure(training) || (training.goalLab=training.goalLab||{goals:[]});
    if(!lab.strategy||typeof lab.strategy!=='object')lab.strategy={version:2,status:'inactive',mode:'track',goalIds:[],approvedSignature:null,approvedAt:null,revisions:[],trainingLog:[],checkIns:[],draft:null};
    const s=lab.strategy;
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
      signature:signature(training,profile,plan),preview:false};
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
    const mode=d.mode;
    return {mode,chosen,additions,unavailable,
      trainingDays:num(profile?.days)||0,
      summary:mode==='integrate'?'Keep your existing plan, with up to two short, compatible goal progressions on a training day when readiness and available time permit. An added movement may extend that session by about 5 to 10 minutes. No existing exercise is removed.'
        :mode==='focused'?'Keep existing scheduled workouts unchanged. Build separate, on-demand goal-focus sessions from supported baselines.'
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
      if(d.mode==='integrate'&&p.additions.length===0)return done(false,'No selected goals currently have compatible exercise variations. Select a compatible goal or choose tracking mode.');
      if(d.mode==='focused'&&p.additions.length===0)return done(false,'Complete a compatible baseline first, or select tracking mode.');
      const record={at:now(),mode:d.mode,goalIds:d.goalIds.slice(),signature:d.signature,description:p.summary};
      s.revisions.push(record);s.revisions=s.revisions.slice(-30);
      s.status='active';s.mode=d.mode;s.goalIds=d.goalIds.slice();s.approvedSignature=d.signature;s.approvedAt=record.at;s.draft=null;
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
      if(!ex||exerciseIds.has(ex.id))continue;
      if(typeof opts.allowExercise==='function'&&!opts.allowExercise(ex))continue;
      const recentlyTrained=s.trainingLog.some(log=>Date.now()-Date.parse(log.at)<40*3600000&&
        Date.now()-Date.parse(log.at)>=0&&log.results.some(x=>x.goalId===goal.id));
      if(recentlyTrained)continue;
      if(profile?.avoid?.includes('floor')&&['plank','push-up'].includes(ex.id))continue;
      if(profile?.avoid?.includes('knee')&&ex.id==='bodyweight-squat')continue;
      // Never modify or replace an existing movement. Extras are opt-in
      // from the approved strategy and are limited to two movements.
      result.exercises.push(conservative?{...ex,sets:1,goalStrategyNote:ex.goalStrategyNote+' Reduced to one set based on recent effort.'}:ex);
      exerciseIds.add(ex.id);added.push(goal.name);
    }
    if(!added.length)return day;
    result.goalStrategyExtras=added.slice();
    result.goalStrategyVersion=s.approvedAt;
    result.goalStrategyExplanation='Added approved goal progressions: '+added.join(', ')+'.'+(conservative?' Reduced sets after demanding recent training.':'');
    result.estimatedMinutes=num(result.estimatedMinutes)+5*added.length;
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
      (w.retests.length?'<p>Reassessment available for: '+safe(w.retests.join(', '))+'. You decide when to retest.</p>':'')+
      '</section>';
  }
  function teaser(training,profile,plan){
    if(!selected(training).length)return '';
    const s=ensure(training),needsReview=s.status==='active'&&!current(training,profile,plan);
    return '<section class="goal-strategy-teaser"><div><small>YOUR TRAINING STRATEGY</small><strong>'+safe(needsReview?'Strategy review needed':s.status==='active'?'Approved · '+modes[s.mode]:s.status==='paused'?'Goal integration paused':'Turn your goals into a plan')+'</strong>'+
      '<p>'+safe(needsReview?'Your saved goals or training program changed. Review before goal sessions can update.':s.status==='active'?'Your original plan remains intact.':'Choose up to three goals to prioritize this cycle.')+'</p></div>'+
      '<button data-tab="goals">REVIEW GOALS →</button></section>';
  }
  function panel(training,profile,plan,catalog,history){
    const active=selected(training),s=ensure(training);
    if(!goals(training).length||training.goalLab?.draft)return '';
    const d=s.draft,needsReview=s.status==='active'&&!current(training,profile,plan);
    let html='<section class="goal-strategy-panel" id="training-strategy"><div class="goal-strategy-heading"><span class="goal-kicker">GO WORKOUT / YOUR TRAINING STRATEGY</span><h2>Multiple goals. One training plan.</h2><p>Your strategy coordinates priorities without resetting your existing plan or history.</p></div>';
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
      if(d.preview){
        html+='<div class="goal-strategy-preview"><h3>3. Review proposed changes</h3><p>'+safe(p.summary)+'</p>'+
          '<p><strong>Selected priorities:</strong> '+safe(p.chosen.map(x=>x.goal.name).join(', ')||'None')+'</p>'+
          (d.mode==='integrate'||d.mode==='focused'?'<div class="goal-strategy-changes">'+p.additions.map(x=>'<div><b>+ '+safe(x.ex.name)+'</b><span>'+safe(x.ex.sets+' sets × '+x.ex.reps)+' · '+safe(muscle[x.goal.kind]||'Goal progression')+'</span></div>').join('')+'</div>':'')+
          (p.unavailable.length?'<p class="goal-strategy-notice">Assessment-only for now: '+safe(p.unavailable.map(x=>x.goal.name+' ('+x.goal.variant+')').join(', '))+'. No unsupported variation will be substituted.</p>':'')+
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
  window.GoWorkoutGoalStrategy={ensure,signature,current,preview,action,applyDay,onWorkout,weekly,summary,teaser,panel,checkin,prescription};
})();