/* GO Workout Personal Goals & Discovery Lab.
 * Account state lives inside trainingProgram.goalLab, which is already synced
 * by the Workout-only account backend. No shared/partner account writes.
 */
(() => {
  'use strict';
  const TEMPLATES = [
    {id:'pushup',name:'Push-ups',unit:'reps',target:60,exerciseId:'push-up',icon:'💪',metric:'continuous',instruction:'Complete controlled push-ups until you cannot maintain form. Count each full repetition.',variation:'Standard, incline, or wall push-up',cue:'Hands stable, body controlled. Stop when your form changes.'},
    {id:'plank',name:'Plank hold',unit:'seconds',target:60,exerciseId:'plank',icon:'⏱',metric:'single hold',instruction:'Start the timer when you enter a stable plank. Stop as soon as you cannot maintain position.',variation:'Forearm or elevated plank',cue:'Breathe normally. Avoid holding through pain.'},
    {id:'squat',name:'Bodyweight squats',unit:'reps',target:30,exerciseId:'bodyweight-squat',icon:'🦵',metric:'continuous',instruction:'Complete comfortable controlled squats, counting full repetitions.',variation:'Bodyweight or chair-assisted squat',cue:'Use a comfortable range and stop when control fades.'},
    {id:'pullup',name:'Pull-ups',unit:'reps',target:10,exerciseId:'pull-up',icon:'🏋',metric:'continuous',instruction:'Count controlled pull-ups without assistance, or record the assistance used.',variation:'Standard, band-assisted, or machine-assisted pull-up',cue:'Record the variation accurately so future tests remain comparable.'},
    {id:'run',name:'Running distance',unit:'miles',target:1,exerciseId:'',icon:'🏃',metric:'continuous distance',instruction:'Walk or run a measured route and record the distance completed continuously.',variation:'Outdoor route or treadmill',cue:'Distance is self-recorded. The app does not automatically measure your route.'},
    {id:'custom',name:'My own goal',unit:'reps',target:10,exerciseId:'',icon:'🎯',metric:'continuous',instruction:'Perform the movement safely and record the actual result.',variation:'Your chosen variation',cue:'Choose a measurable achievement and record a baseline before planning.'}
  ];
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const rounded = (v,unit) => unit==='miles' ? Math.round(v*100)/100 : Math.round(v);
  const template = kind => TEMPLATES.find(x=>x.id===kind)||TEMPLATES[5];
  const now = () => new Date().toISOString();
  const uid = () => 'goal-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  function ensure(training){
    if(!training.goalLab || typeof training.goalLab!=='object')training.goalLab={version:1,goals:[],draft:null,selectedId:null};
    const s=training.goalLab;
    if(!Array.isArray(s.goals))s.goals=[];
    return s;
  }
  function draft(mode='target', kind='pushup',goalId=null){
    const t=template(kind);
    return {stage:'choose',mode,kind,goalId,label:t.name,unit:t.unit,metric:t.metric,exerciseId:t.exerciseId,
      target:t.target,deadline:'none',priority:'primary',variant:t.variation,result:0,
      effort:'challenging',note:'',pain:false,startedAt:null,startedElapsed:0,tested:false};
  }
  const active = s => s.goals.filter(g=>g.status==='active');
  function recent(g){return (g.assessments||[]).slice(-6);}
  function targetText(g){return String(g.target)+' '+(g.unit==='seconds'?'seconds':g.unit==='miles'?'miles':'reps');}
  function progress(g){return g.target>0 ? Math.max(0,Math.min(100,Math.round(number(g.best)/g.target*100))) : 0;}
  function suggestTarget(d){
    const value=number(d.result);
    if(d.unit==='miles')return Math.max(.25,Math.round(Math.max(value*1.5,.5)*4)/4);
    if(d.unit==='seconds')return Math.max(20,Math.ceil(Math.max(value*1.5,30)/5)*5);
    return Math.max(d.kind==='pullup'?1:5,Math.ceil(Math.max(value*1.5,value+3)));
  }
  function nextMilestone(g){
    const best=number(g.best),target=number(g.target);
    if(best>=target)return target;
    if(!best)return Math.min(target,g.unit==='seconds'?15:g.unit==='miles'?0.25:1);
    const step=g.unit==='miles'?0.25:g.unit==='seconds'?5:Math.max(1,Math.ceil(best*.25));
    return rounded(Math.min(target,Math.max(best+step,best+1*(g.unit==='miles'?.25:1))),g.unit);
  }
  function recommendations(g){
    const b=number(g.best),kind=g.kind;
    if(g.painFlag)return {summary:'Training recommendations are paused because discomfort was recorded. Choose a comfortable alternative and seek professional advice when appropriate.',sets:[],frequency:'Assessment review needed'};
    if(kind==='pushup')return {summary:b<1?'Build controlled strength with an easier variation before retesting standard push-ups.':'Train below your maximum and retest only after adequate recovery.',sets:[b<1?'Wall push-ups · 2 × 6 to 8':'Push-ups · 3 × '+Math.max(2,Math.floor(b*.55)), 'Incline push-ups · 2 × 8', 'Core stability · 2 controlled sets'],frequency:'2 to 3 nonconsecutive days per week'};
    if(kind==='plank')return {summary:'Build multiple quality holds rather than attempting a maximum every day.',sets:['Plank · 3 × '+Math.max(10,Math.min(45,Math.floor(b*.7)||10))+' sec','Bird dog · 2 × 8 per side'],frequency:'2 to 3 days per week with recovery'};
    if(kind==='pullup')return {summary:'Progress toward unassisted repetitions with controlled pulling variations.',sets:[b<1?'Assisted pull-ups · 3 × 5':'Pull-ups · 3 × '+Math.max(1,Math.floor(b*.6)),'Rows · 2 × 8 to 10'],frequency:'2 nonconsecutive days per week'};
    if(kind==='squat')return {summary:'Build comfortable repetition capacity with controlled movement.',sets:['Squats · 3 × '+Math.max(4,Math.min(15,Math.floor(b*.6)||6)),'Glute bridges · 2 × 10'],frequency:'2 to 3 nonconsecutive days per week'};
    if(kind==='run')return {summary:'Increase comfortable distance gradually, mixing walking and running as needed.',sets:['Measured easy walk/run intervals','Record actual continuous distance','Increase only when recovery feels manageable'],frequency:'2 to 3 days per week'};
    return {summary:'Log repeatable performances and adjust your target from the results. Custom goals do not receive automatic exercise prescriptions.',sets:[],frequency:'Flexible'};
  }
  function shortcuts(training,placement='home'){
    const s=ensure(training),goals=active(s);
    return '<section class="goal-shortcut goal-shortcut-'+placement+'"><div><span class="goal-kicker">PERSONAL GOALS</span><h3>'+(goals.length?'Your next milestone':'Train for something specific.')+'</h3>'+
      '<p>'+(goals.length?goals.slice(0,2).map(g=>safe(g.name)+': '+safe(g.best)+' / '+safe(targetText(g))).join(' · '):'Discover your baseline, set a target, and build a progression from what you can do today.')+'</p></div>'+
      '<button type="button" class="goal-primary" data-tab="goals">'+(goals.length?'VIEW GOALS':'START DISCOVERY')+' →</button></section>';
  }
  function overview(s){
    const gs=active(s),paused=s.goals.filter(g=>g.status==='paused');
    return '<section class="goal-hero"><span class="goal-kicker">GO WORKOUT / PERSONAL GOALS</span><h1>Give your training a target.</h1><p>Find your baseline through a guided assessment. Train toward something measurable, then come back to prove your progress.</p>'+
      '<div class="goal-actions"><button class="goal-primary" data-goal-action="new" data-mode="target">SET A GOAL</button><button class="goal-secondary" data-goal-action="new" data-mode="discover">DISCOVER MY GOALS</button></div></section>'+
      (gs.some(g=>g.exerciseId&&number(g.best)>0&&!g.painFlag)?'<button class="goal-primary goal-session-button" data-goal-action="start-session">START GOAL WORKOUT →</button>':'')+
      (gs.length?'<section class="goal-section"><div class="goal-section-head"><h2>Your active goals</h2><span>'+gs.length+' active</span></div><div class="goal-cards">'+gs.map(card).join('')+'</div></section>':
        '<div class="goal-empty"><strong>Start with what you can do.</strong><p>Your first test becomes the starting point of your training history.</p></div>')+
      (paused.length?'<section class="goal-section"><h2>Paused goals</h2><div class="goal-cards">'+paused.map(card).join('')+'</div></section>':'')+
      '<section class="goal-section goal-how"><h2>Your journey</h2><div>DISCOVER <b>→</b> SET A TARGET <b>→</b> TRAIN <b>→</b> REASSESS <b>→</b> ADAPT</div></section>';
  }
  function card(g){
    const pct=progress(g);
    return '<button class="goal-card" type="button" data-goal-action="open" data-goal-id="'+safe(g.id)+'"><div class="goal-card-top"><span>'+safe(g.icon||'🎯')+' '+safe(g.name)+'</span><small>'+safe(g.status==='paused'?'PAUSED':pct===100?'TARGET REACHED':'IN PROGRESS')+'</small></div>'+
      '<div class="goal-card-numbers"><strong>'+safe(g.best)+'</strong><span>/ '+safe(targetText(g))+'</span></div>'+
      '<div class="goal-track"><i style="width:'+pct+'%"></i></div><small>Initial baseline '+safe(g.baseline)+' '+safe(g.unit)+' · Next milestone '+safe(nextMilestone(g))+'</small></button>';
  }
  function choose(d){
    return '<div class="goal-wizard"><div class="goal-step">DISCOVERY LAB · STEP 1</div><h2>What do you want to work on?</h2><p>Choose a movement. You can add more goals later, and we will help you balance them.</p>'+
      '<div class="goal-toggle"><button class="'+(d.mode==='target'?'selected':'')+'" data-goal-action="mode" data-mode="target">I have a target</button><button class="'+(d.mode==='discover'?'selected':'')+'" data-goal-action="mode" data-mode="discover">Help me discover one</button></div>'+
      '<div class="goal-template-grid">'+TEMPLATES.map(t=>'<button class="goal-template '+(d.kind===t.id?'chosen':'')+'" data-goal-action="template" data-kind="'+t.id+'"><span>'+t.icon+'</span><strong>'+safe(t.name)+'</strong></button>').join('')+'</div>'+
      '<div class="goal-wizard-actions"><button class="goal-secondary" data-goal-action="cancel">CANCEL</button><button class="goal-primary" data-goal-action="choose-next">CONTINUE →</button></div></div>';
  }
  function targetStage(d){
    return '<div class="goal-wizard"><div class="goal-step">PERSONAL TARGET</div><h2>Make your goal measurable.</h2><p>Keep your ambition. Your first milestone will be based on your discovery results.</p>'+
      (d.kind==='custom'?'<label>Goal name<input data-goal-field="label" maxlength="64" value="'+safe(d.label)+'" placeholder="My goal"></label>'+
        '<label>How will you measure it?<select data-goal-field="unit"><option value="reps" '+(d.unit==='reps'?'selected':'')+'>Repetitions</option><option value="seconds" '+(d.unit==='seconds'?'selected':'')+'>Seconds</option><option value="miles" '+(d.unit==='miles'?'selected':'')+'>Miles</option></select></label>':'')+
      '<label>Target ('+safe(d.unit)+')<input type="number" data-goal-field="target" min="'+(d.unit==='miles'?'0.01':'1')+'" max="100000" step="'+(d.unit==='miles'?'0.01':'1')+'" value="'+safe(d.target)+'"></label>'+
      '<label>Deadline (optional)<select data-goal-field="deadline">'+[['none','No deadline'],['4','4 weeks'],['8','8 weeks'],['12','12 weeks']].map(([v,t])=>'<option value="'+v+'" '+(d.deadline===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
      '<label>Priority<select data-goal-field="priority"><option value="primary" '+(d.priority==='primary'?'selected':'')+'>Primary goal</option><option value="secondary" '+(d.priority==='secondary'?'selected':'')+'>Secondary goal</option></select></label>'+
      '<div class="goal-wizard-actions"><button class="goal-secondary" data-goal-action="back">BACK</button><button class="goal-primary" data-goal-action="target-next">'+(d.tested?'REVIEW MY PLAN':'TEST MY BASELINE')+' →</button></div></div>';
  }
  function assessment(d){
    const isTimer=d.unit==='seconds',isDistance=d.unit==='miles',t=template(d.kind);
    let measurement='';
    if(isDistance){
      measurement='<label>Distance you completed ('+safe(d.unit)+')<input data-goal-field="result" type="number" min="0" max="10000" step="0.01" value="'+safe(d.result)+'"></label>';
    }else if(isTimer){
      const elapsed=d.startedAt?Math.min(1800,Math.floor((Date.now()-Date.parse(d.startedAt))/1000)+number(d.startedElapsed)):number(d.result);
      measurement='<div class="goal-measure"><span>HOLD TIMER</span><strong data-goal-clock data-started-at="'+safe(d.startedAt||'')+'">'+elapsed+'s</strong>'+
        '<div class="goal-counter-actions"><button class="goal-primary" data-goal-action="'+(d.startedAt?'timer-stop':'timer-start')+'">'+(d.startedAt?'STOP TIMER':'START TIMER')+'</button></div></div>';
    }else{
      measurement='<div class="goal-measure"><span>COMPLETED REPS</span><strong>'+safe(d.result)+'</strong><div class="goal-counter-actions"><button aria-label="Subtract a repetition" data-goal-action="count-down">−</button><button data-goal-action="count-up">+ 1 REP</button></div></div>';
    }
    return '<div class="goal-wizard"><div class="goal-step">BASELINE DISCOVERY · ACTION FIRST</div><h2>Let’s see what you can do.</h2>'+
      '<p>'+safe(t.instruction)+'</p><div class="goal-guidance"><strong>'+safe(d.label)+'</strong><span>'+safe(t.cue)+'</span></div>'+
      '<label>Exercise variation<input data-goal-field="variant" maxlength="100" value="'+safe(d.variant)+'" placeholder="Standard, assisted, elevated..."></label>'+
      measurement+
      '<p class="goal-footnote">Your results are self-recorded. Stop for pain, dizziness, or loss of control. You can retest later.</p>'+
      '<div class="goal-wizard-actions"><button class="goal-secondary" data-goal-action="back">BACK</button><button class="goal-primary" data-goal-action="assessment-done">FINISH TEST →</button></div></div>';
  }
  function feedback(d){
    return '<div class="goal-wizard"><div class="goal-step">BASELINE FEEDBACK</div><h2>You recorded '+safe(rounded(d.result,d.unit))+' '+safe(d.unit)+'.</h2><p>How did that effort feel? This helps the plan choose a sensible starting intensity.</p>'+
      '<div class="goal-choices">'+[['easy','Comfortable'],['challenging','Challenging but controlled'],['limit','Near my limit'],['pain','Pain or discomfort']].map(([v,n])=>'<button class="'+(d.effort===v?'chosen':'')+'" data-goal-action="effort" data-effort="'+v+'">'+n+'</button>').join('')+'</div>'+
      (d.effort==='pain'?'<div class="goal-alert">Training recommendations will be paused until you can choose a comfortable movement or seek appropriate guidance.</div>':'')+
      '<div class="goal-wizard-actions"><button class="goal-secondary" data-goal-action="back">RETEST</button><button class="goal-primary" data-goal-action="feedback-next">SAVE BASELINE →</button></div></div>';
  }
  function review(d){
    const tentative={...d,kind:d.kind,name:d.label,baseline:d.result,best:d.result,painFlag:d.effort==='pain'};
    const rec=recommendations(tentative);
    return '<div class="goal-wizard"><div class="goal-step">YOUR TRAINING PATH</div><h2>Start where you are.</h2><div class="goal-result-pair"><div><small>YOUR BASELINE</small><strong>'+safe(d.result)+' '+safe(d.unit)+'</strong></div><div><small>YOUR GOAL</small><strong>'+safe(d.target)+' '+safe(d.unit)+'</strong></div></div>'+
      '<p>First milestone: <b>'+safe(nextMilestone(tentative))+' '+safe(d.unit)+'</b>. '+safe(rec.summary)+'</p>'+
      '<div class="goal-plan-steps">'+rec.sets.map(x=>'<div>'+safe(x)+'</div>').join('')+'</div>'+
      '<p class="goal-footnote">Suggested training focus only. This does not replace or silently overwrite your existing workout program. We’ll track related completed sets and guide your next reassessment.</p>'+
      '<div class="goal-wizard-actions"><button class="goal-secondary" data-goal-action="back">EDIT TARGET</button><button class="goal-primary" data-goal-action="save-goal">SAVE MY GOAL</button></div></div>';
  }
  function detail(g){
    const rec=recommendations(g),recentTests=recent(g);
    return '<section class="goal-detail"><div class="goal-step">YOUR GOAL · '+safe(g.status.toUpperCase())+'</div><h2>'+safe(g.icon)+' '+safe(g.name)+'</h2>'+
      '<div class="goal-result-pair"><div><small>PERSONAL BEST</small><strong>'+safe(g.best)+' '+safe(g.unit)+'</strong></div><div><small>TARGET</small><strong>'+safe(g.target)+' '+safe(g.unit)+'</strong></div></div>'+
      '<div class="goal-track"><i style="width:'+progress(g)+'%"></i></div>'+
      '<p>Starting point: '+safe(g.baseline)+' '+safe(g.unit)+'. Next milestone: '+safe(nextMilestone(g))+' '+safe(g.unit)+'. '+(progress(g)===100?'Target reached. You can maintain it or set another target.':'')+'</p>'+
      '<div class="goal-actions"><button class="goal-primary" data-goal-action="retest" data-goal-id="'+safe(g.id)+'">REASSESS</button><button class="goal-secondary" data-goal-action="edit" data-goal-id="'+safe(g.id)+'">EDIT TARGET</button></div>'+
      '<section class="goal-detail-section"><h3>Suggested training focus</h3><p>'+safe(rec.summary)+'</p><div class="goal-plan-steps">'+rec.sets.map(s=>'<div>'+safe(s)+'</div>').join('')+'</div><small>'+safe(rec.frequency)+'. Coordinate with your existing program and allow recovery.</small></section>'+
      '<section class="goal-detail-section"><h3>Performance history</h3>'+
      (recentTests.length?'<div class="goal-history">'+recentTests.map(a=>'<div><time>'+safe(new Date(a.at).toLocaleDateString())+'</time><b>'+safe(a.value)+' '+safe(g.unit)+'</b><small>'+safe(a.source==='workout-set'?'Logged workout set':'Discovery test')+'</small></div>').join('')+'</div>':'<p>Your first assessment establishes your baseline.</p>')+
      '</section><div class="goal-wizard-actions"><button class="goal-secondary" data-goal-action="toggle-pause" data-goal-id="'+safe(g.id)+'">'+(g.status==='paused'?'RESUME':'PAUSE')+'</button><button class="goal-secondary" data-goal-action="delete" data-goal-id="'+safe(g.id)+'">DELETE GOAL</button></div></section>';
  }
  function render(training){
    const s=ensure(training),d=s.draft,g=s.goals.find(x=>x.id===s.selectedId);
    return '<div class="clean-page goal-lab-page"><div class="goal-back"><button data-goal-action="back-home">← BACK TO HOME</button></div>'+
      (d ? d.stage==='choose'?choose(d):d.stage==='target'?targetStage(d):d.stage==='assessment'?assessment(d):d.stage==='feedback'?feedback(d):review(d)
        :g?detail(g):overview(s))+'</div>';
  }
  function field(training,name,value){
    const d=ensure(training).draft;
    if(!d||!['label','unit','target','deadline','priority','variant','result'].includes(name))return false;
    if(name==='target'||name==='result')d[name]=Math.max(0,Math.min(100000,number(value)));
    else d[name]=String(value).slice(0,100);
    if(name==='unit'&&d.unit==='miles')d.result=rounded(number(d.result),d.unit);
    return true;
  }
  function action(training,name,node){
    const s=ensure(training),d=s.draft,goal=id=>s.goals.find(g=>g.id===id);
    const result=(ok,message='')=>({changed:ok,message});
    if(name==='new'){s.selectedId=null;s.draft=draft(node.dataset.mode==='discover'?'discover':'target');return result(true);}
    if(name==='back-home'){s.draft=null;s.selectedId=null;return result(true);}
    if(name==='open'){s.draft=null;s.selectedId=node.dataset.goalId;return result(true);}
    if(name==='cancel'){s.draft=null;return result(true);}
    if(name==='retest'){const g=goal(node.dataset.goalId);if(!g)return result(false);s.draft={...draft('target',g.kind,g.id),kind:g.kind,label:g.name,unit:g.unit,target:g.target,priority:g.priority,metric:g.metric,exerciseId:g.exerciseId,variant:g.variant,stage:'assessment'};s.selectedId=g.id;return result(true);}
    if(name==='edit'){const g=goal(node.dataset.goalId);if(!g)return result(false);s.draft={...draft('target',g.kind,g.id),kind:g.kind,label:g.name,unit:g.unit,target:g.target,priority:g.priority,deadline:g.deadline||'none',metric:g.metric,exerciseId:g.exerciseId,variant:g.variant,stage:'target',tested:true,result:g.best};return result(true);}
    if(name==='toggle-pause'){const g=goal(node.dataset.goalId);if(!g)return result(false);g.status=g.status==='paused'?'active':'paused';g.updatedAt=now();return result(true);}
    if(name==='delete'){const g=goal(node.dataset.goalId);if(!g||!confirm('Delete '+g.name+' and its goal assessment history?'))return result(false);s.goals=s.goals.filter(x=>x.id!==g.id);s.selectedId=null;return result(true,'Goal deleted.');}
    if(!d)return result(false);
    if(name==='mode'){d.mode=node.dataset.mode==='discover'?'discover':'target';return result(true);}
    if(name==='template'){const t=template(node.dataset.kind);Object.assign(d,{kind:t.id,label:t.name,unit:t.unit,target:t.target,metric:t.metric,exerciseId:t.exerciseId,variant:t.variation,result:0,tested:false});return result(true);}
    if(name==='choose-next'){d.stage=d.mode==='discover'?'assessment':'target';return result(true);}
    if(name==='back'){d.startedAt=null;
      d.stage=d.stage==='assessment'?(d.mode==='discover'?'choose':'target'):d.stage==='feedback'?'assessment':d.stage==='review'?'target':'choose';return result(true);}
    if(name==='target-next'){
      if(!d.label.trim()||number(d.target)<=0)return result(false,'Enter a goal name and target above zero.');
      d.stage=d.tested?'review':'assessment';return result(true);
    }
    if(name==='timer-start'){if(d.unit!=='seconds')return result(false);d.startedAt=now();return result(true);}
    if(name==='timer-stop'){if(d.unit!=='seconds'||!d.startedAt)return result(false);
      d.result=Math.max(0,Math.min(1800,Math.round((Date.now()-Date.parse(d.startedAt))/1000)+number(d.startedElapsed)));
      d.startedAt=null;d.startedElapsed=0;return result(true);
    }
    if(name==='count-up'||name==='count-down'){if(d.unit!=='reps')return result(false);d.result=Math.max(0,Math.min(100000,number(d.result)+(name==='count-up'?1:-1)));return result(true);}
    if(name==='assessment-done'){
      if(d.startedAt)return result(false,'Stop the timer before finishing.');
      d.tested=true;d.testedAt=now();d.stage='feedback';return result(true);
    }
    if(name==='effort'){d.effort=node.dataset.effort;return result(true);}
    if(name==='feedback-next'){d.stage=d.mode==='discover'&&!d.goalId?'target':'review';
      if(d.mode==='discover'&&!d.goalId)d.target=suggestTarget(d);
      return result(true);
    }
    if(name==='save-goal'){
      if(!d.tested||number(d.target)<=0||!String(d.label).trim())return result(false,'Complete a baseline assessment and set your target.');
      const val=rounded(Math.max(0,number(d.result)),d.unit),at=now();
      if(d.goalId){
        const g=goal(d.goalId);if(!g)return result(false);
        // Editing target does not fabricate a new assessment.
        if(d.stage==='review'&&g.name!==d.label)g.name=d.label;
        const retested = d.stage==='review' && !d.editedOnly && d.testedAt;
        if(retested){
          g.assessments.push({at,value:val,source:'discovery',effort:d.effort,variant:d.variant});
          g.best=Math.max(g.best,val);g.painFlag=d.effort==='pain';g.variant=d.variant;
        }
        g.target=rounded(number(d.target),d.unit);g.deadline=d.deadline;g.priority=d.priority;g.updatedAt=at;
        if(g.best>=g.target && !g.painFlag)g.achievedAt=g.achievedAt||at;else g.achievedAt=null;
        s.selectedId=g.id;
      } else {
        const t=template(d.kind);
        const g={id:uid(),kind:d.kind,exerciseId:d.exerciseId,name:String(d.label).slice(0,64),unit:d.unit,metric:d.metric,icon:t.icon,
          target:rounded(number(d.target),d.unit),baseline:val,best:val,variant:d.variant,deadline:d.deadline,
          priority:d.priority,status:'active',createdAt:at,updatedAt:at,painFlag:d.effort==='pain',
          assessments:[{at,value:val,source:'discovery',effort:d.effort,variant:d.variant}],
          achievedAt:val>=number(d.target)&&d.effort!=='pain'?at:null};
        s.goals.push(g);s.selectedId=g.id;
      }
      s.draft=null;return result(true,'Personal goal saved.');
    }
    return result(false);
  }
  function afterWorkout(training,entry){
    if(!training.goalLab)return false;
    const s=ensure(training);let changed=false;
    for(const g of s.goals){
      if(!g.exerciseId||g.status!=='active'||g.unit!=='reps'||!entry?.exercises)continue;
      const completed=(entry.exercises||[]).filter(ex=>ex.id===g.exerciseId&&!ex.skipped);
      const numbers=completed.flatMap(ex=>(ex.sets||[]).filter(x=>x.completed).map(x=>number(x.reps)).filter(x=>x>0));
      if(!numbers.length)continue;
      const best=rounded(Math.max(...numbers),g.unit);
      if(best<=number(g.best))continue;
      g.best=best;g.updatedAt=entry.completedAt||now();
      g.assessments.push({at:g.updatedAt,value:best,source:'workout-set',workoutId:entry.id,variant:g.variant});
      g.assessments=g.assessments.slice(-75);
      if(best>=g.target)g.achievedAt=g.achievedAt||g.updatedAt;
      changed=true;
    }
    return changed;
  }
  function buildGoalDay(training,exerciseCatalog,profile={}){
    const goals=active(ensure(training)).filter(g=>!g.painFlag && ['reps','seconds'].includes(g.unit));
    const minutes=Math.max(10,Math.min(45,number(profile.minutes)||30));
    const maxGoals=minutes<=20?2:3;
    const compatible=goals.filter(g=>g.exerciseId&&number(g.best)>0).slice().sort((a,b)=>(a.priority==='primary'?0:1)-(b.priority==='primary'?0:1));
    const used=new Set(),slots=[];
    const slot=(id,sets,reps,rest=45)=>{
      const ex=exerciseCatalog.find(x=>x.id===id);
      if(!ex||used.has(id))return false;
      const available=Array.isArray(ex.equipment)?ex.equipment:[];
      if(!available.includes(profile.equipment||'bodyweight')&&!available.includes('bodyweight'))return false;
      used.add(id);
      const value=Math.max(1,Math.floor(reps));
      slots.push({id:ex.id,name:ex.name,movement:ex.movement,muscles:ex.muscles,loadMode:ex.loadMode,sets,reps:ex.loadMode==='timed'?value+' sec':String(value),
        startReps:String(value),rest,setup:ex.setup||15,increment:ex.increment||0,startWeight:0,calibrationRequired:false,
        goalFocus:true});
      return true;
    };
    for(const g of compatible){
      if(slots.length>=maxGoals)break;
      const b=number(g.best);
      if(g.kind==='pushup')slot('push-up',3,Math.max(1,Math.floor(b*.55)),60);
      else if(g.kind==='plank')slot('plank',3,Math.max(10,Math.floor(b*.7)),45);
      else if(g.kind==='squat')slot('bodyweight-squat',3,Math.max(3,Math.floor(b*.6)),60);
      else if(g.kind==='pullup'&&b>=1)slot('pull-up',3,Math.max(1,Math.floor(b*.6)),75);
    }
    if(!slots.length)return null;
    if(slots.length===1)slot(slots[0].movement==='core'?'glute-bridge':'dead-bug',2,8,45);
    return {id:'goal-focus-session',name:'Personal Goal Focus',focus:'Goal-based strength and endurance',targetMinutes:minutes,
      estimatedMinutes:minutes,goalFocused:true,exercises:slots};
  }
  function pulse(){
    const clock=document.querySelector('[data-goal-clock]');
    if(!clock)return;
    // The app rerenders after each action. The state is serialized in its page context.
    const start=clock.dataset.startedAt;
    if(start)clock.textContent=Math.max(0,Math.min(1800,Math.round((Date.now()-Date.parse(start))/1000)))+'s';
  }
  if(typeof window!=='undefined'&&typeof window.setInterval==='function')window.setInterval(pulse,500);
  window.GoWorkoutGoalLab={ensure,render,shortcuts,field,action,afterWorkout,buildGoalDay,recommendations,nextMilestone,suggestTarget,template,pulse};
  if(typeof module!=='undefined'&&module.exports)module.exports=window.GoWorkoutGoalLab;
})();