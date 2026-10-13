const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'circle.js'),'utf8');
function createCircle(){
 const bridge={
  client:()=>({}),userId:()=> 'owner',
  tab:()=> 'together',displayName:()=> 'Taylor',
  goals:()=> [
   {id:'secret',name:'Sensitive private goal',shareLevel:'private'},
   {id:'shared',name:'Shared strength',shareLevel:'status'}
  ],
  connectionName:id=>id==='partner'?'Morgan':'Member',
  nextWorkout:()=>({name:'Strength Session',dateKey:'2026-10-16'}),
  render:()=>{},toast:()=>{}
 };
 const document={addEventListener:()=>{},querySelector:()=>null,visibilityState:'visible'};
 const context={window:{GoWorkoutConnectionsBridge:bridge},
  document,console,Date,Set,Math,String,Number,JSON,Boolean,Promise,
  queueMicrotask:()=>{},setInterval:()=>1,clearInterval:()=>{},confirm:()=>true};
 vm.runInNewContext(source,context);
 const circle=context.window.GoWorkoutCircle;
 const state=circle.getState();
 state.loaded=true;
 state.uid='owner';
 return {circle,state};
}
test('Your Circle shows upcoming scheduled workout and activity count',()=>{
 const {circle,state}=createCircle();
 state.notifications=[{id:'n1',kind:'encouragement',actor_id:'partner',created_at:'2026-10-12T22:00:00Z',read_at:null}];
 const html=circle.panel({accepted:[{otherId:'partner',name:'Morgan'}]});
 assert.match(html,/Strength Session/);
 assert.match(html,/New activity/);
 assert.match(html,/Morgan sent encouragement/);
 assert.match(html,/Mark read/);
});
test('private goals never enter accountability proposals',()=>{
 const {circle,state}=createCircle();
 state.notifications=[];
 const html=circle.panel({accepted:[{otherId:'partner',name:'Morgan'}]});
 assert.match(html,/Shared strength/);
 assert.doesNotMatch(html,/Sensitive private goal/);
});
test('accepted agreements offer voluntary checkins and recovery',()=>{
 const {circle,state}=createCircle();
 state.agreements=[{id:'ag1',requester_id:'owner',partner_id:'partner',status:'active',frequency:'weekly',support_style:'encouragement',accepted_at:'2026-10-08T00:00:00Z'}];
 const html=circle.panel({accepted:[{otherId:'partner',name:'Morgan'}]});
 assert.match(html,/Taking recovery time/);
 assert.match(html,/Send check-in/);
 assert.match(html,/Pause/);
});
