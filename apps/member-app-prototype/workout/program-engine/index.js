(function(root){
'use strict';

const TAXONOMY={
  movements:['horizontal_push','vertical_push','horizontal_pull','vertical_pull','squat','hinge','lunge','knee_extension','knee_flexion','hip_extension','calf','elbow_flexion','elbow_extension','shoulder_abduction','anti_extension','anti_rotation','rotation','carry'],
  muscles:['chest','lats','upper_back','anterior_delts','lateral_delts','rear_delts','biceps','triceps','quads','hamstrings','glutes','calves','core','hip_flexors','adductors'],
  activityTypes:['strength','warmup','mobility','stretch','conditioning','recovery','rest'],
  stretchTypes:['dynamic','active','static','mobility','breath_assisted']
};

const EXERCISES=[
{id:'db_bench',name:'Dumbbell Bench Press',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['dumbbell','bench'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'horizontal_press'},
{id:'pushup',name:'Push-Up',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['bodyweight'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_leverage',group:'horizontal_press'},
{id:'machine_press',name:'Machine Chest Press',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['machine'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'horizontal_press'},
{id:'db_shoulder_press',name:'Dumbbell Shoulder Press',pattern:'vertical_push',primary:['anterior_delts'],secondary:['triceps'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'vertical_press'},
{id:'cable_row',name:'Seated Cable Row',pattern:'horizontal_pull',primary:['upper_back'],secondary:['lats','biceps'],equipment:['cable'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'horizontal_pull'},
{id:'db_row',name:'One-Arm Dumbbell Row',pattern:'horizontal_pull',primary:['upper_back'],secondary:['lats','biceps'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'horizontal_pull'},
{id:'lat_pulldown',name:'Lat Pulldown',pattern:'vertical_pull',primary:['lats'],secondary:['biceps','upper_back'],equipment:['cable'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'vertical_pull'},
{id:'goblet_squat',name:'Goblet Squat',pattern:'squat',primary:['quads'],secondary:['glutes','core'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'double_progression',group:'squat'},
{id:'leg_press',name:'Leg Press',pattern:'squat',primary:['quads'],secondary:['glutes'],equipment:['machine'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'squat'},
{id:'db_rdl',name:'Dumbbell Romanian Deadlift',pattern:'hinge',primary:['hamstrings'],secondary:['glutes'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'hinge'},
{id:'reverse_lunge',name:'Reverse Lunge',pattern:'lunge',primary:['quads','glutes'],secondary:['hamstrings'],equipment:['bodyweight'],optionalEquipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'lunge'},
{id:'leg_curl',name:'Leg Curl',pattern:'knee_flexion',primary:['hamstrings'],secondary:[],equipment:['machine'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'knee_flexion'},
{id:'lateral_raise',name:'Dumbbell Lateral Raise',pattern:'shoulder_abduction',primary:['lateral_delts'],secondary:[],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'shoulder_isolation'},
{id:'band_lateral_raise',name:'Band Lateral Raise',pattern:'shoulder_abduction',primary:['lateral_delts'],secondary:[],equipment:['band'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_resistance',group:'shoulder_isolation'},
{id:'db_curl',name:'Dumbbell Curl',pattern:'elbow_flexion',primary:['biceps'],secondary:[],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'biceps'},
{id:'cable_curl',name:'Cable Curl',pattern:'elbow_flexion',primary:['biceps'],secondary:[],equipment:['cable'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'biceps'},
{id:'triceps_pressdown',name:'Triceps Pressdown',pattern:'elbow_extension',primary:['triceps'],secondary:[],equipment:['cable'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'triceps'},
{id:'db_triceps_extension',name:'Overhead Dumbbell Triceps Extension',pattern:'elbow_extension',primary:['triceps'],secondary:[],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'triceps'},
{id:'calf_raise',name:'Standing Calf Raise',pattern:'calf',primary:['calves'],secondary:[],equipment:['bodyweight'],optionalEquipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'calf'},
{id:'calf_extension_machine',name:'Calf Extension Machine',pattern:'calf',primary:['calves'],secondary:[],equipment:['machine'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'calf'},
{id:'single_leg_calf_raise',name:'Single-Leg Dumbbell Calf Raise',pattern:'calf',primary:['calves'],secondary:[],equipment:['dumbbell'],difficulty:2,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'calf'},
{id:'dead_bug',name:'Dead Bug',pattern:'anti_extension',primary:['core'],secondary:[],equipment:['bodyweight'],difficulty:1,goals:['general_fitness','hypertrophy'],progression:'rep_control',group:'core'},
{id:'sit_up',name:'Sit-Up',pattern:'anti_extension',primary:['core'],secondary:[],equipment:['bodyweight'],difficulty:1,goals:['general_fitness','hypertrophy'],progression:'rep_control',group:'core'},
{id:'cable_crunch',name:'Cable Crunch',pattern:'anti_extension',primary:['core'],secondary:[],equipment:['cable'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'core'},
{id:'incline_pushup',name:'Incline Push-Up',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['bodyweight'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_leverage',group:'horizontal_press'},
{id:'inverted_row',name:'Inverted Row',pattern:'horizontal_pull',primary:['upper_back'],secondary:['lats','biceps'],equipment:['bodyweight'],difficulty:2,goals:['hypertrophy','general_fitness'],progression:'rep_leverage',group:'horizontal_pull'},
{id:'band_pulldown',name:'Resistance Band Lat Pulldown',pattern:'vertical_pull',primary:['lats'],secondary:['biceps'],equipment:['band'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_resistance',group:'vertical_pull'},
{id:'split_squat',name:'Split Squat',pattern:'lunge',primary:['quads','glutes'],secondary:['hamstrings'],equipment:['bodyweight'],optionalEquipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'lunge'},
{id:'glute_bridge',name:'Glute Bridge',pattern:'hip_extension',primary:['glutes'],secondary:['hamstrings'],equipment:['bodyweight'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'hip_extension'},
{id:'pallof_press',name:'Pallof Press',pattern:'anti_rotation',primary:['core'],secondary:[],equipment:['cable'],difficulty:1,goals:['strength','general_fitness'],progression:'rep_load',group:'core'},
{id:'suitcase_carry',name:'Suitcase Carry',pattern:'carry',primary:['core'],secondary:['upper_back'],equipment:['dumbbell'],difficulty:1,goals:['strength','general_fitness'],progression:'distance_load',group:'carry'}
];

function stretch(def){
 return Object.assign({
   equipment:['bodyweight'],
   side:'both',
   minSeconds:15,
   beginnerSeconds:15,
   defaultSeconds:25,
   placements:['cooldown'],
   difficulty:1,
   compatible:['full_body'],
   cues:[],
   feel:'',
   mistakes:[],
   modification:'',
   tags:[],
   imageStatus:'needed'
 },def,{
   imageKey:def.imageKey||def.id,
   imageRequirement:def.imageRequirement||('Show the exact '+def.name+' position with the active side clearly visible when unilateral. Keep the full movement readable in the GoWorkout studio.')
 });
}

const STRETCHES=[
stretch({id:'cat_cow',name:'Cat-Cow Flow',bodyArea:'spine',regions:['spine','upper_back'],muscles:['core','upper_back'],type:'dynamic',position:'quadruped',side:'both',defaultSeconds:30,placements:['warmup','cooldown','recovery'],compatible:['upper','lower','full_body'],cues:['Stack shoulders over wrists and hips over knees.','Move slowly between spinal flexion and extension with your breath.'],feel:'A gentle wave through the full spine.',mistakes:['Forcing the neck at either end range.','Rushing through the motion.'],modification:'Reduce the range and keep the movement centered in the mid-back.',tags:['spine','thoracic','mobility_session']}),
stretch({id:'chin_tuck',name:'Chin Tuck',bodyArea:'neck',regions:['neck'],muscles:['deep_neck_flexors'],type:'active',position:'standing',side:'both',defaultSeconds:25,placements:['warmup','cooldown','recovery'],compatible:['upper','full_body'],cues:['Keep your eyes level.','Glide the chin straight back without looking down.'],feel:'Light effort at the front of the neck and length at the base of the skull.',mistakes:['Tilting the head down.'],modification:'Perform against a wall for position feedback.',tags:['neck','posture']}),
stretch({id:'neck_side_bend',name:'Neck Side-Bend Stretch',bodyArea:'neck',regions:['neck','upper_traps'],muscles:['upper_traps','scalenes'],type:'static',position:'seated',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Sit tall and keep both shoulders down.','Bring one ear toward the same-side shoulder without rotating the chin.'],feel:'A mild stretch along the opposite side of the neck.',mistakes:['Pulling hard on the head.'],modification:'Skip the hand assist and use only the weight of the head.',tags:['neck','upper_trap']}),
stretch({id:'levator_scapulae',name:'Levator Scapulae Stretch',bodyArea:'neck',regions:['neck','upper_back'],muscles:['levator_scapulae','upper_traps'],type:'static',position:'seated',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Turn your head about 45 degrees.','Look down toward your front pocket while keeping the opposite shoulder heavy.'],feel:'A stretch from the side of the neck toward the top inner shoulder blade.',mistakes:['Shrugging the shoulder being stretched.'],modification:'Use no hand pressure and shorten the range.',tags:['neck','scapula']}),
stretch({id:'upper_trap',name:'Upper-Trap Stretch',bodyArea:'neck',regions:['neck','shoulders'],muscles:['upper_traps'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Keep the ribs stacked and shoulders relaxed.','Tilt the head away from the side you are stretching.'],feel:'A broad stretch over the top of the shoulder and side of the neck.',mistakes:['Rotating the head instead of side-bending.'],modification:'Hold the edge of a chair with the stretching-side hand.',tags:['neck','upper_trap']}),
stretch({id:'arm_circles',name:'Arm Circles',bodyArea:'shoulders',regions:['shoulders'],muscles:['delts','rotator_cuff'],type:'dynamic',position:'standing',side:'both',defaultSeconds:30,placements:['warmup'],compatible:['upper','full_body'],cues:['Start with small circles and gradually increase the range.','Keep the ribs down while the shoulders move freely.'],feel:'Warmth through the shoulders without pinching.',mistakes:['Moving too fast before the shoulders are warm.'],modification:'Use smaller circles.',tags:['shoulders','dynamic','warmup']}),
stretch({id:'shoulder_cars',name:'Shoulder CARs',bodyArea:'shoulders',regions:['shoulders'],muscles:['rotator_cuff','delts'],type:'mobility',position:'standing',side:'per_side',defaultSeconds:25,placements:['warmup','recovery'],compatible:['upper','full_body'],cues:['Move one arm through the largest pain-free circle you can control.','Keep the torso still while the shoulder rotates.'],feel:'Controlled motion around the shoulder joint.',mistakes:['Twisting the torso to fake extra range.'],modification:'Use a smaller circle and bend the elbow slightly.',tags:['shoulders','cars','mobility_session']}),
stretch({id:'wall_slide',name:'Scapular Wall Slide',bodyArea:'shoulders',regions:['shoulders','upper_back'],muscles:['serratus','lower_traps','rotator_cuff'],type:'active',position:'standing',equipment:['wall'],side:'both',defaultSeconds:35,placements:['warmup','recovery'],compatible:['upper','full_body'],cues:['Keep your back gently connected to the wall.','Slide the arms upward without shrugging.'],feel:'Upper-back and shoulder-blade muscles working through a smooth range.',mistakes:['Arching the lower back.','Shrugging toward the ears.'],modification:'Stop before the elbows or wrists lose comfortable wall contact.',tags:['shoulders','scapula','warmup']}),
stretch({id:'cross_body_shoulder',name:'Cross-Body Shoulder Stretch',bodyArea:'shoulders',regions:['shoulders'],muscles:['rear_delts'],type:'static',position:'standing',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Bring one arm across the chest at shoulder height.','Draw it closer with the opposite forearm without twisting the torso.'],feel:'A stretch across the back of the shoulder.',mistakes:['Pulling directly on the elbow joint.'],modification:'Lower the arm slightly if the shoulder feels crowded.',tags:['shoulders','rear_delts']}),
stretch({id:'sleeper_stretch',name:'Side-Lying Sleeper Stretch',bodyArea:'shoulders',regions:['shoulders'],muscles:['posterior_shoulder','rotator_cuff'],type:'static',position:'side_lying',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper'],difficulty:2,cues:['Lie on the target shoulder with the upper arm about 90 degrees from the torso.','Use the opposite hand to guide the forearm toward the floor only within a comfortable range.'],feel:'A mild stretch at the back of the shoulder.',mistakes:['Forcing the hand to the floor.'],modification:'Move the elbow slightly below shoulder height and reduce pressure.',tags:['shoulders','rotator_cuff']}),
stretch({id:'triceps_overhead',name:'Overhead Triceps Stretch',bodyArea:'arms',regions:['arms','shoulders'],muscles:['triceps','lats'],type:'static',position:'standing',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Reach one hand down your upper back.','Keep the ribs stacked while the opposite hand gently guides the elbow.'],feel:'A stretch along the back of the upper arm and sometimes the side body.',mistakes:['Flaring the ribs forward.'],modification:'Use a towel between the hands instead of pressing the elbow.',tags:['triceps','shoulders']}),
stretch({id:'external_rotation_wall',name:'Wall External-Rotation Stretch',bodyArea:'shoulders',regions:['shoulders','chest'],muscles:['chest','anterior_delts'],type:'static',position:'standing',equipment:['wall'],side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper'],cues:['Place the forearm on a wall with the elbow near shoulder height.','Turn the chest gently away while keeping the shoulder down.'],feel:'A stretch through the front of the shoulder and upper chest.',mistakes:['Letting the shoulder roll forward.'],modification:'Lower the elbow below shoulder height.',tags:['shoulders','chest']}),
stretch({id:'puppy_pose_shoulder',name:'Puppy-Pose Shoulder Stretch',bodyArea:'shoulders',regions:['shoulders','upper_back'],muscles:['lats','chest'],type:'static',position:'quadruped',side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Keep hips over knees as the hands walk forward.','Let the chest move toward the floor without forcing the lower back.'],feel:'A stretch through the shoulders, lats, and upper chest.',mistakes:['Collapsing into the lower back.'],modification:'Rest the forearms on a bench or chair.',tags:['shoulders','lats']}),
stretch({id:'doorway_chest',name:'Doorway Chest Stretch',bodyArea:'chest',regions:['chest','shoulders'],muscles:['chest','anterior_delts'],type:'static',position:'standing',equipment:['wall'],side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Place the forearm on the door frame with the shoulder relaxed.','Step and turn away until you feel the chest open.'],feel:'A stretch through the chest and front shoulder.',mistakes:['Driving the shoulder forward.','Over-rotating the trunk.'],modification:'Lower the arm angle.',tags:['chest','pecs']}),
stretch({id:'corner_chest',name:'Corner Chest Stretch',bodyArea:'chest',regions:['chest','shoulders'],muscles:['chest'],type:'static',position:'standing',equipment:['wall'],side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Place both forearms on adjoining walls or a corner.','Step forward with the ribs stacked.'],feel:'An even stretch across the chest.',mistakes:['Arching the lower back to create range.'],modification:'Use a lower elbow position.',tags:['chest','pecs']}),
stretch({id:'floor_pec',name:'Prone Floor Pec Stretch',bodyArea:'chest',regions:['chest','shoulders'],muscles:['chest','biceps'],type:'static',position:'prone',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper'],difficulty:2,cues:['Lie face down with one arm out to the side.','Roll gently away from that arm while keeping the movement controlled.'],feel:'A stretch across the chest and front of the upper arm.',mistakes:['Rolling too far and stressing the shoulder.'],modification:'Keep the arm lower than shoulder height.',tags:['chest','biceps']}),
stretch({id:'dynamic_chest_opener',name:'Dynamic Chest Opener',bodyArea:'chest',regions:['chest','shoulders'],muscles:['chest','rear_delts'],type:'dynamic',position:'standing',side:'both',defaultSeconds:30,placements:['warmup'],compatible:['upper','full_body'],cues:['Sweep the arms open and then cross them loosely in front.','Alternate which arm crosses on top.'],feel:'Warmth through the chest and shoulders.',mistakes:['Snapping into the end range.'],modification:'Use a smaller arm swing.',tags:['chest','dynamic','warmup']}),
stretch({id:'thread_needle',name:'Thread the Needle',bodyArea:'upper_back',regions:['upper_back','shoulders'],muscles:['upper_back','rear_delts'],type:'mobility',position:'quadruped',side:'per_side',defaultSeconds:25,placements:['warmup','cooldown','recovery'],compatible:['upper','full_body'],cues:['Reach one arm under the body and rotate through the upper back.','Keep the hips mostly stacked above the knees.'],feel:'Rotation and a stretch through the upper back and rear shoulder.',mistakes:['Shifting most of the movement into the hips.'],modification:'Keep the reaching shoulder off the floor and use a smaller rotation.',tags:['thoracic','upper_back','mobility_session']}),
stretch({id:'thoracic_rotation',name:'Quadruped Thoracic Rotation',bodyArea:'upper_back',regions:['upper_back','thoracic_spine'],muscles:['upper_back'],type:'mobility',position:'quadruped',side:'per_side',defaultSeconds:25,placements:['warmup','recovery'],compatible:['upper','full_body'],cues:['Place one hand behind the head.','Rotate the elbow toward the ceiling while keeping the hips steady.'],feel:'Controlled rotation through the mid-back.',mistakes:['Opening the hips with the torso.'],modification:'Place the free hand on the low back instead of behind the head.',tags:['thoracic','rotation','mobility_session']}),
stretch({id:'open_book',name:'Open-Book Rotation',bodyArea:'upper_back',regions:['upper_back','chest'],muscles:['upper_back','chest'],type:'mobility',position:'side_lying',side:'per_side',defaultSeconds:25,placements:['warmup','cooldown','recovery'],compatible:['upper','full_body'],cues:['Keep knees stacked and bent.','Sweep the top arm open while following the hand with your eyes.'],feel:'Rotation through the upper back and an opening through the chest.',mistakes:['Letting the top knee drift away from the bottom knee.'],modification:'Place a pillow under the top knee.',tags:['thoracic','chest','mobility_session']}),
stretch({id:'seated_t_spine_rotation',name:'Seated Thoracic Rotation',bodyArea:'upper_back',regions:['upper_back','thoracic_spine'],muscles:['upper_back','obliques'],type:'mobility',position:'seated',side:'per_side',defaultSeconds:20,placements:['warmup','recovery'],compatible:['upper','full_body'],cues:['Sit tall with arms crossed over the chest.','Rotate from the ribs without shifting the hips.'],feel:'A controlled turn through the mid-back.',mistakes:['Leaning instead of rotating.'],modification:'Sit against a wall to limit hip movement.',tags:['thoracic','rotation']}),
stretch({id:'kneeling_lat',name:'Bench Kneeling Lat Stretch',bodyArea:'back',regions:['back','shoulders'],muscles:['lats'],type:'static',position:'kneeling',equipment:['bench'],side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Place the elbows or hands on a bench.','Sit the hips back while keeping the ribs gently tucked.'],feel:'A long stretch along both sides of the back.',mistakes:['Dropping into a deep lower-back arch.'],modification:'Move closer to the bench and reduce the depth.',tags:['lats','back']}),
stretch({id:'child_lat',name:"Child's Pose with Side Reach",bodyArea:'back',regions:['back','shoulders'],muscles:['lats','upper_back'],type:'breath_assisted',position:'kneeling',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Sit the hips toward the heels.','Walk both hands to one side and breathe into the opposite ribs.'],feel:'A stretch from the outer shoulder down the side of the back.',mistakes:['Lifting the hips to chase more range.'],modification:'Place a cushion between hips and heels.',tags:['lats','breathing']}),
stretch({id:'standing_lat_side_bend',name:'Standing Lat Side-Bend',bodyArea:'back',regions:['back','shoulders'],muscles:['lats','obliques'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Reach one arm overhead and grasp the wrist if comfortable.','Shift the ribs gently away from the reaching arm.'],feel:'A stretch down the side of the torso and lat.',mistakes:['Rotating the chest toward the floor.'],modification:'Keep both hands separate and use a smaller side bend.',tags:['lats','side_body']}),
stretch({id:'bench_prayer',name:'Bench Prayer Stretch',bodyArea:'back',regions:['back','shoulders'],muscles:['lats','triceps'],type:'static',position:'kneeling',equipment:['bench'],side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['upper'],cues:['Place elbows on a bench with palms together.','Sit the hips back while bringing the hands behind the head.'],feel:'A stretch through the lats and triceps.',mistakes:['Forcing the elbows too narrow.'],modification:'Keep the hands in front of the forehead.',tags:['lats','triceps']}),
stretch({id:'biceps_wall',name:'Wall Biceps Stretch',bodyArea:'arms',regions:['arms','chest'],muscles:['biceps','chest'],type:'static',position:'standing',equipment:['wall'],side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper'],cues:['Place the palm or fingertips on the wall with the arm slightly behind you.','Turn the body away slowly while keeping the shoulder down.'],feel:'A stretch through the front of the upper arm and chest.',mistakes:['Locking aggressively into the elbow.'],modification:'Bend the elbow slightly.',tags:['biceps','arms']}),
stretch({id:'forearm_flexor',name:'Forearm Flexor Stretch',bodyArea:'forearms',regions:['forearms','wrists'],muscles:['forearm_flexors'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Extend one arm with the palm facing up.','Gently draw the fingers down and back with the other hand.'],feel:'A stretch along the palm-side forearm.',mistakes:['Pulling hard on the fingers.'],modification:'Keep the elbow slightly bent.',tags:['forearms','wrists']}),
stretch({id:'forearm_extensor',name:'Forearm Extensor Stretch',bodyArea:'forearms',regions:['forearms','wrists'],muscles:['forearm_extensors'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Extend one arm with the palm facing down.','Gently flex the wrist and guide the knuckles toward the floor.'],feel:'A stretch along the top of the forearm.',mistakes:['Twisting the wrist sideways.'],modification:'Keep the elbow soft.',tags:['forearms','wrists']}),
stretch({id:'prayer_wrist',name:'Prayer Wrist Stretch',bodyArea:'wrists',regions:['wrists','forearms'],muscles:['forearm_flexors'],type:'static',position:'standing',side:'both',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Press palms together in front of the chest.','Lower the hands while keeping the palms connected.'],feel:'A stretch through the wrists and inner forearms.',mistakes:['Forcing the heels of the hands together when uncomfortable.'],modification:'Separate the palms slightly.',tags:['wrists','forearms']}),
stretch({id:'wrist_circles',name:'Wrist Circles',bodyArea:'wrists',regions:['wrists'],muscles:['forearms'],type:'dynamic',position:'standing',side:'both',defaultSeconds:25,placements:['warmup','recovery'],compatible:['upper','full_body'],cues:['Make slow circles through a comfortable range.','Reverse direction halfway through.'],feel:'Gentle motion and warmth around the wrists.',mistakes:['Moving quickly through a painful range.'],modification:'Make smaller circles.',tags:['wrists','dynamic','warmup']}),
stretch({id:'knees_to_chest',name:'Double Knees-to-Chest Stretch',bodyArea:'lower_back',regions:['lower_back','hips'],muscles:['lower_back','glutes'],type:'static',position:'supine',side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Lie on your back and bring both knees toward the torso.','Keep the neck relaxed and breathe slowly.'],feel:'A gentle stretch across the lower back and glutes.',mistakes:['Pulling so hard the hips lift sharply off the floor.'],modification:'Hold behind the thighs instead of over the shins.',tags:['lower_back','glutes']}),
stretch({id:'supine_twist',name:'Supine Spinal Twist',bodyArea:'lower_back',regions:['lower_back','hips'],muscles:['obliques','glutes'],type:'static',position:'supine',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Bring one knee across the body.','Keep both shoulders heavy toward the floor.'],feel:'A gentle rotation through the lower and mid-back with a glute stretch.',mistakes:['Forcing the knee to the floor.'],modification:'Place a pillow under the crossing knee.',tags:['lower_back','rotation']}),
stretch({id:'pelvic_tilt',name:'Supine Pelvic Tilt',bodyArea:'lower_back',regions:['lower_back','core'],muscles:['core','lower_back'],type:'active',position:'supine',side:'both',defaultSeconds:30,placements:['warmup','recovery'],compatible:['lower','full_body'],cues:['Lie on your back with knees bent.','Gently flatten and release the lower back against the floor.'],feel:'Controlled movement around the pelvis and lower spine.',mistakes:['Pushing hard through the feet.'],modification:'Use a smaller range.',tags:['lower_back','core','warmup']}),
stretch({id:'childs_pose_center',name:"Child's Pose",bodyArea:'lower_back',regions:['lower_back','hips','back'],muscles:['lower_back','lats','glutes'],type:'breath_assisted',position:'kneeling',side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['upper','lower','full_body'],cues:['Sit the hips toward the heels and reach forward.','Breathe into the back ribs.'],feel:'A broad stretch through the back, hips, and shoulders.',mistakes:['Forcing the hips to the heels.'],modification:'Widen the knees or place a cushion under the torso.',tags:['back','breathing']}),
stretch({id:'90_90',name:'90/90 Hip Switch',bodyArea:'hips',regions:['hips'],muscles:['glutes','adductors','hip_rotators'],type:'dynamic',position:'seated',side:'alternating',defaultSeconds:35,placements:['warmup','cooldown','recovery'],compatible:['lower','full_body'],cues:['Sit with both knees bent and rotate them side to side.','Keep the movement controlled and stay tall through the torso.'],feel:'Rotation through both hips.',mistakes:['Dropping into the end range without control.'],modification:'Place the hands behind you for support.',tags:['hips','rotation','mobility_session']}),
stretch({id:'hip_flexor',name:'Half-Kneeling Hip Flexor Stretch',bodyArea:'hips',regions:['hips'],muscles:['hip_flexors'],type:'static',position:'half_kneeling',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Tuck the pelvis slightly before shifting forward.','Keep the ribs stacked over the hips.'],feel:'A stretch across the front of the rear hip.',mistakes:['Arching the lower back to create range.'],modification:'Place a pad under the rear knee and reduce the forward shift.',tags:['hips','hip_flexors']}),
stretch({id:'standing_hip_flexor',name:'Standing Hip Flexor Stretch',bodyArea:'hips',regions:['hips'],muscles:['hip_flexors'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Take a short split stance and bend both knees slightly.','Tuck the pelvis and shift the hips forward without arching the back.'],feel:'A stretch at the front of the trailing hip.',mistakes:['Turning the pelvis open.'],modification:'Hold a wall for balance.',tags:['hips','hip_flexors','standing']}),
stretch({id:'lunge_reach',name:'Half-Kneeling Lunge with Reach',bodyArea:'hips',regions:['hips','side_body'],muscles:['hip_flexors','lats'],type:'mobility',position:'half_kneeling',side:'per_side',defaultSeconds:25,placements:['warmup','cooldown','recovery'],compatible:['lower','full_body'],cues:['Set the pelvis first, then shift gently forward.','Reach the rear-leg-side arm overhead and slightly across.'],feel:'A stretch through the front hip and side body.',mistakes:['Losing pelvic position as the arm reaches.'],modification:'Skip the side bend and reach straight up.',tags:['hips','hip_flexors','mobility_session']}),
stretch({id:'hip_cars',name:'Supported Hip CARs',bodyArea:'hips',regions:['hips'],muscles:['hip_rotators','glutes','hip_flexors'],type:'mobility',position:'standing',side:'per_side',defaultSeconds:25,placements:['warmup','recovery'],compatible:['lower','full_body'],cues:['Hold a wall or stable support.','Move one knee through a slow controlled circle without turning the pelvis.'],feel:'Controlled work around the entire hip joint.',mistakes:['Rotating the whole torso with the leg.'],modification:'Make a smaller circle.',tags:['hips','cars','mobility_session']}),
stretch({id:'adductor_rockback',name:'Adductor Rockback',bodyArea:'groin',regions:['hips','groin'],muscles:['adductors'],type:'mobility',position:'quadruped',side:'per_side',defaultSeconds:25,placements:['warmup','cooldown','recovery'],compatible:['lower','full_body'],cues:['Extend one leg out to the side with the foot planted.','Rock the hips back while keeping the spine long.'],feel:'A stretch along the inner thigh.',mistakes:['Turning the extended foot up toward the ceiling.'],modification:'Shorten the side-leg position.',tags:['adductors','groin','mobility_session']}),
stretch({id:'butterfly',name:'Seated Butterfly Stretch',bodyArea:'groin',regions:['hips','groin'],muscles:['adductors'],type:'static',position:'seated',side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Bring the soles of the feet together.','Sit tall and hinge forward slightly from the hips.'],feel:'A stretch along the inner thighs and groin.',mistakes:['Pushing the knees down with force.'],modification:'Move the feet farther from the body.',tags:['adductors','groin']}),
stretch({id:'frog_stretch',name:'Supported Frog Stretch',bodyArea:'groin',regions:['hips','groin'],muscles:['adductors'],type:'static',position:'quadruped',side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['lower'],difficulty:2,cues:['Widen the knees gradually with feet roughly in line with the knees.','Shift the hips back only as far as comfortable.'],feel:'A broad stretch through the inner thighs.',mistakes:['Forcing a deep position quickly.'],modification:'Keep the knees closer together or support the torso on a bench.',tags:['adductors','groin']}),
stretch({id:'lateral_lunge_rock',name:'Lateral Lunge Rock',bodyArea:'groin',regions:['hips','groin'],muscles:['adductors','glutes'],type:'dynamic',position:'standing',side:'alternating',defaultSeconds:35,placements:['warmup','recovery'],compatible:['lower','full_body'],cues:['Take a wide stance and shift toward one hip.','Keep the opposite leg long and the foot planted.'],feel:'A dynamic inner-thigh stretch with glute engagement.',mistakes:['Letting the working knee collapse inward.'],modification:'Use a shallower side shift.',tags:['adductors','dynamic','warmup']}),
stretch({id:'figure_four',name:'Supine Figure-Four Stretch',bodyArea:'glutes',regions:['hips','glutes'],muscles:['glutes','piriformis'],type:'static',position:'supine',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Cross one ankle over the opposite thigh.','Draw the supporting leg toward you while keeping the crossed foot flexed.'],feel:'A stretch in the outer hip and glute.',mistakes:['Pressing directly on the knee joint.'],modification:'Keep the supporting foot on the floor.',tags:['glutes','piriformis']}),
stretch({id:'pigeon',name:'Supported Pigeon Stretch',bodyArea:'glutes',regions:['hips','glutes'],muscles:['glutes','piriformis'],type:'static',position:'prone',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower'],difficulty:2,cues:['Bring the front leg across the body in a comfortable angle.','Square the hips as much as comfortable and support the front hip if needed.'],feel:'A deep but controlled stretch in the front-leg glute.',mistakes:['Forcing the shin parallel to the front edge.'],modification:'Use a cushion under the front hip or choose figure-four instead.',tags:['glutes','piriformis']}),
stretch({id:'seated_glute',name:'Seated Glute Stretch',bodyArea:'glutes',regions:['hips','glutes'],muscles:['glutes','piriformis'],type:'static',position:'seated',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Cross one ankle over the opposite thigh.','Sit tall and hinge forward until the outer hip stretches.'],feel:'A stretch in the outer hip and glute.',mistakes:['Rounding the entire back to reach farther.'],modification:'Sit on a higher surface.',tags:['glutes','piriformis','seated']}),
stretch({id:'knee_opposite_shoulder',name:'Knee-to-Opposite-Shoulder Glute Stretch',bodyArea:'glutes',regions:['hips','glutes'],muscles:['glutes','piriformis'],type:'static',position:'supine',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Lie on your back and bring one knee toward the opposite shoulder.','Keep the pelvis heavy on the floor.'],feel:'A stretch through the outer glute.',mistakes:['Twisting the pelvis sharply.'],modification:'Pull behind the thigh instead of over the shin.',tags:['glutes','piriformis']}),
stretch({id:'quad_couch',name:'Supported Quad and Hip Flexor Stretch',bodyArea:'quads',regions:['legs','hips'],muscles:['quads','hip_flexors'],type:'static',position:'half_kneeling',equipment:['bench'],side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower'],difficulty:2,cues:['Place the rear foot on a bench behind you.','Tuck the pelvis and stay tall before moving deeper.'],feel:'A stretch through the front thigh and hip.',mistakes:['Arching the lower back.'],modification:'Move the rear knee farther from the bench.',tags:['quads','hip_flexors']}),
stretch({id:'standing_quad',name:'Standing Quad Stretch',bodyArea:'quads',regions:['legs'],muscles:['quads'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Hold one ankle behind you and keep the knees close.','Tuck the pelvis gently while standing tall.'],feel:'A stretch along the front of the thigh.',mistakes:['Pulling the knee far behind the body.'],modification:'Hold a wall for balance or use a strap around the ankle.',tags:['quads','standing']}),
stretch({id:'side_lying_quad',name:'Side-Lying Quad Stretch',bodyArea:'quads',regions:['legs'],muscles:['quads','hip_flexors'],type:'static',position:'side_lying',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower'],cues:['Lie on your side and hold the top ankle behind you.','Keep the knees close while gently extending the hip.'],feel:'A stretch across the front of the thigh.',mistakes:['Letting the top knee drift far forward.'],modification:'Use a strap around the ankle.',tags:['quads','side_lying']}),
stretch({id:'hamstring_fold',name:'Single-Leg Hamstring Fold',bodyArea:'hamstrings',regions:['legs'],muscles:['hamstrings'],type:'static',position:'seated',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Extend one leg and keep the spine long.','Hinge forward from the hips rather than rounding toward the knee.'],feel:'A stretch along the back of the thigh.',mistakes:['Pulling the toes aggressively toward you.'],modification:'Bend the stretching knee slightly.',tags:['hamstrings','seated']}),
stretch({id:'supine_hamstring_strap',name:'Supine Strap Hamstring Stretch',bodyArea:'hamstrings',regions:['legs'],muscles:['hamstrings','calves'],type:'static',position:'supine',equipment:['bodyweight','strap'],side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower'],cues:['Lie on your back and loop a strap around one foot.','Raise the leg until the hamstring stretches while the pelvis stays heavy.'],feel:'A controlled stretch along the back of the thigh.',mistakes:['Lifting the pelvis off the floor.'],modification:'Bend the knee or hold behind the thigh if no strap is available.',tags:['hamstrings','strap']}),
stretch({id:'standing_hamstring',name:'Standing Hamstring Hinge',bodyArea:'hamstrings',regions:['legs'],muscles:['hamstrings'],type:'static',position:'standing',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Place one heel slightly forward with the knee soft.','Push the hips back with a long spine.'],feel:'A stretch in the back of the forward thigh.',mistakes:['Rounding deeply through the back.'],modification:'Keep more bend in the front knee.',tags:['hamstrings','standing']}),
stretch({id:'half_split',name:'Half-Split Hamstring Stretch',bodyArea:'hamstrings',regions:['legs','hips'],muscles:['hamstrings'],type:'static',position:'half_kneeling',side:'per_side',defaultSeconds:25,placements:['cooldown','recovery'],compatible:['lower'],cues:['Shift the hips back from a half-kneeling position.','Straighten the front leg only as far as you can keep the spine long.'],feel:'A stretch through the front-leg hamstring.',mistakes:['Locking the knee and rounding hard.'],modification:'Keep the front knee bent.',tags:['hamstrings','kneeling']}),
stretch({id:'calf_wall',name:'Wall Calf Stretch',bodyArea:'calves',regions:['legs','ankles'],muscles:['calves'],type:'static',position:'standing',equipment:['wall'],side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Step one foot back and keep the heel heavy.','Keep the back knee straight while the front knee bends.'],feel:'A stretch high in the back calf.',mistakes:['Turning the back foot outward.'],modification:'Shorten the stance.',tags:['calves','ankles']}),
stretch({id:'bent_knee_calf',name:'Bent-Knee Calf Stretch',bodyArea:'calves',regions:['legs','ankles'],muscles:['soleus'],type:'static',position:'standing',equipment:['wall'],side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Keep the rear heel down.','Bend the rear knee slightly while shifting forward.'],feel:'A stretch lower in the calf near the Achilles area.',mistakes:['Letting the heel lift.'],modification:'Use a smaller knee bend.',tags:['calves','soleus','ankles']}),
stretch({id:'downward_dog_pedal',name:'Downward-Dog Calf Pedal',bodyArea:'calves',regions:['calves','hamstrings','shoulders'],muscles:['calves','hamstrings'],type:'dynamic',position:'plank',side:'alternating',defaultSeconds:35,placements:['warmup','cooldown','recovery'],compatible:['lower','full_body'],cues:['Press the hips up and back.','Alternate bending one knee while lengthening the opposite heel toward the floor.'],feel:'Alternating stretch through the calves and hamstrings.',mistakes:['Forcing the heels down.'],modification:'Keep both knees more bent.',tags:['calves','dynamic','full_body']}),
stretch({id:'ankle_rocks',name:'Knee-to-Wall Ankle Rocks',bodyArea:'ankles',regions:['ankles'],muscles:['calves'],type:'mobility',position:'standing',equipment:['wall'],side:'per_side',defaultSeconds:25,placements:['warmup','recovery'],compatible:['lower','full_body'],cues:['Keep the heel planted while the knee travels toward the wall.','Track the knee over the middle toes.'],feel:'Motion at the ankle with a light calf stretch.',mistakes:['Letting the arch collapse inward.'],modification:'Move the foot closer to the wall.',tags:['ankles','dorsiflexion','mobility_session']}),
stretch({id:'ankle_circles',name:'Ankle Circles',bodyArea:'ankles',regions:['ankles'],muscles:['ankle_stabilizers'],type:'dynamic',position:'seated',side:'per_side',defaultSeconds:20,placements:['warmup','recovery'],compatible:['lower','full_body'],cues:['Lift one foot and draw slow circles with the toes.','Reverse direction halfway through.'],feel:'Gentle motion around the ankle joint.',mistakes:['Moving only the toes.'],modification:'Make smaller circles.',tags:['ankles','dynamic']}),
stretch({id:'toe_extension',name:'Toe Extension Stretch',bodyArea:'feet',regions:['feet','ankles'],muscles:['plantar_fascia','toe_flexors'],type:'static',position:'kneeling',side:'both',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],difficulty:2,cues:['Tuck the toes under while kneeling.','Shift only enough weight back to feel the soles of the feet stretch.'],feel:'A stretch under the toes and forefoot.',mistakes:['Dropping full body weight onto the toes immediately.'],modification:'Keep more weight on the hands.',tags:['feet','toes']}),
stretch({id:'plantar_fascia',name:'Seated Plantar-Fascia Stretch',bodyArea:'feet',regions:['feet'],muscles:['plantar_fascia'],type:'static',position:'seated',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['lower','full_body'],cues:['Cross one ankle over the opposite thigh.','Gently pull the toes back until the sole of the foot tightens.'],feel:'A stretch along the arch of the foot.',mistakes:['Pulling hard enough to cramp the toes.'],modification:'Stretch only the big toe if the whole forefoot is sensitive.',tags:['feet','plantar_fascia']}),
stretch({id:'world_greatest',name:"World's Greatest Stretch Flow",bodyArea:'full_body',regions:['hips','thoracic_spine','hamstrings'],muscles:['hip_flexors','glutes','hamstrings','upper_back'],type:'mobility',position:'lunge',side:'per_side',defaultSeconds:30,placements:['warmup','recovery'],compatible:['lower','full_body'],difficulty:2,cues:['Step into a long lunge and place the inside hand near the front foot.','Rotate the other arm toward the ceiling, then shift back toward the hamstring.'],feel:'Mobility through the hips, hamstrings, and upper back.',mistakes:['Rushing through each position.'],modification:'Place the hands on blocks or a bench.',tags:['full_body','hips','thoracic','mobility_session']}),
stretch({id:'deep_squat_pry',name:'Supported Deep Squat Pry',bodyArea:'full_body',regions:['hips','ankles','groin'],muscles:['adductors','glutes','calves'],type:'mobility',position:'squat',side:'both',defaultSeconds:35,placements:['warmup','recovery'],compatible:['lower','full_body'],difficulty:2,cues:['Hold a stable support and sit into a comfortable squat.','Shift gently side to side while keeping the feet planted.'],feel:'Mobility through the hips, groin, and ankles.',mistakes:['Forcing depth while the heels lift.'],modification:'Hold a higher support and stay above parallel.',tags:['full_body','squat','mobility_session']}),
stretch({id:'inchworm',name:'Inchworm Walkout',bodyArea:'full_body',regions:['hamstrings','shoulders','core'],muscles:['hamstrings','shoulders','core'],type:'dynamic',position:'standing',side:'both',defaultSeconds:35,placements:['warmup'],compatible:['upper','lower','full_body'],cues:['Hinge forward and walk the hands out to a strong plank.','Walk the hands back and stand tall with control.'],feel:'Dynamic length through the hamstrings with shoulder and core activation.',mistakes:['Letting the hips sag in the plank.'],modification:'Bend the knees during the walkout.',tags:['full_body','dynamic','warmup']}),
stretch({id:'walkout_down_dog',name:'Walkout to Downward Dog',bodyArea:'full_body',regions:['shoulders','hamstrings','calves'],muscles:['shoulders','hamstrings','calves'],type:'dynamic',position:'standing',side:'both',defaultSeconds:35,placements:['warmup'],compatible:['upper','lower','full_body'],cues:['Walk out to a plank, then press the hips up and back.','Return to plank before walking the hands back.'],feel:'Dynamic length through the shoulders and posterior chain.',mistakes:['Dropping abruptly into the shoulders.'],modification:'Keep the knees bent in downward dog.',tags:['full_body','dynamic','warmup']}),
stretch({id:'squat_to_reach',name:'Squat to Overhead Reach',bodyArea:'full_body',regions:['hips','ankles','shoulders'],muscles:['glutes','quads','shoulders'],type:'dynamic',position:'standing',side:'both',defaultSeconds:35,placements:['warmup'],compatible:['lower','full_body'],cues:['Sit into a comfortable squat.','Stand and reach both arms overhead without flaring the ribs.'],feel:'Warmth through the hips and legs with an overhead opening.',mistakes:['Losing foot pressure at the bottom.'],modification:'Squat to a bench or chair.',tags:['full_body','dynamic','warmup']}),
stretch({id:'lunge_rotation',name:'Reverse Lunge with Rotation',bodyArea:'full_body',regions:['hips','thoracic_spine'],muscles:['glutes','hip_flexors','obliques'],type:'dynamic',position:'standing',side:'alternating',defaultSeconds:35,placements:['warmup'],compatible:['lower','full_body'],cues:['Step back into a controlled lunge.','Rotate the torso toward the front leg while the pelvis stays stable.'],feel:'Warmth through the legs with controlled trunk rotation.',mistakes:['Collapsing the front knee inward.'],modification:'Use a smaller reverse step and less rotation.',tags:['full_body','rotation','warmup']}),
stretch({id:'full_body_reach',name:'Full-Body Reach and Fold',bodyArea:'full_body',regions:['shoulders','back','hamstrings'],muscles:['lats','hamstrings'],type:'dynamic',position:'standing',side:'both',defaultSeconds:30,placements:['warmup','cooldown'],compatible:['upper','lower','full_body'],cues:['Reach tall through the fingertips.','Hinge forward with soft knees, then roll or hinge back to standing.'],feel:'A gentle full-body lengthening from shoulders through hamstrings.',mistakes:['Locking the knees.'],modification:'Limit the forward fold to hands on thighs.',tags:['full_body','dynamic']}),
stretch({id:'spinal_wave_standing',name:'Standing Spinal Wave',bodyArea:'full_body',regions:['spine','shoulders'],muscles:['core','upper_back'],type:'dynamic',position:'standing',side:'both',defaultSeconds:30,placements:['warmup','recovery'],compatible:['upper','lower','full_body'],cues:['Move from a soft forward curl into a tall stacked posture.','Let each spinal segment move gradually rather than snapping upright.'],feel:'Gentle motion through the spine and shoulders.',mistakes:['Moving too fast through the neck.'],modification:'Keep hands on thighs for support.',tags:['spine','dynamic']}),
stretch({id:'kneeling_side_bend',name:'Tall-Kneeling Side-Bend Stretch',bodyArea:'side_body',regions:['lats','obliques','hips'],muscles:['lats','obliques'],type:'static',position:'kneeling',side:'per_side',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],cues:['Stand tall on both knees and reach one arm overhead.','Side-bend away without rotating the chest.'],feel:'A stretch along the side of the torso.',mistakes:['Shifting the hips far to the side.'],modification:'Perform seated on a chair.',tags:['lats','side_body']}),
stretch({id:'supported_hang_lat',name:'Supported Lat Hang',bodyArea:'back',regions:['lats','shoulders'],muscles:['lats','upper_back'],type:'static',position:'standing',equipment:['pullup_bar'],side:'both',defaultSeconds:20,placements:['cooldown','recovery'],compatible:['upper','full_body'],difficulty:2,cues:['Hold the bar with feet still supported on the floor or a box.','Sit the hips back so the arms lengthen without fully hanging body weight.'],feel:'A long stretch through the lats and shoulders.',mistakes:['Dropping into a full unsupported dead hang.'],modification:'Keep more weight through the feet.',tags:['lats','shoulders']}),
stretch({id:'breathing_reset',name:'Breathing Reset',bodyArea:'full_body',regions:['full_body'],muscles:[],type:'breath_assisted',position:'supine',side:'both',defaultSeconds:30,placements:['cooldown','recovery'],compatible:['upper','lower','full_body'],cues:['Lie comfortably and let the shoulders relax.','Use slow nasal inhales and longer easy exhales.'],feel:'Breathing and heart rate settling without strain.',mistakes:['Forcing an unusually deep breath.'],modification:'Perform seated if lying down is uncomfortable.',tags:['breathing','recovery']})
];

const MOBILITY=[
{id:'ankle_rocks',name:'Knee-to-Wall Ankle Rocks',regions:['ankles'],type:'mobility',seconds:45},
{id:'world_greatest',name:"World's Greatest Stretch Flow",regions:['hips','thoracic_spine'],type:'mobility',seconds:60},
{id:'thoracic_rotation',name:'Quadruped Thoracic Rotation',regions:['upper_back'],type:'mobility',seconds:60},
{id:'hip_cars',name:'Supported Hip CARs',regions:['hips'],type:'mobility',seconds:60},
{id:'shoulder_cars',name:'Shoulder CARs',regions:['shoulders'],type:'mobility',seconds:60},
{id:'deep_squat_pry',name:'Supported Deep Squat Pry',regions:['hips','ankles'],type:'mobility',seconds:60}
];

const CONDITIONING=[
{id:'brisk_walk',name:'Brisk Walk',equipment:['bodyweight'],mode:'steady',impact:'low'},
{id:'incline_walk',name:'Incline Treadmill Walk',equipment:['treadmill'],mode:'steady',impact:'low'},
{id:'bike_intervals',name:'Bike Intervals',equipment:['bike'],mode:'interval',impact:'low'},
{id:'row_intervals',name:'Row Erg Intervals',equipment:['rower'],mode:'interval',impact:'moderate'}
];

const WEEK_MODELS={
 hypertrophy:[
  {week:1,label:'Base',setMultiplier:1,intensity:'2-3 reps in reserve'},
  {week:2,label:'Build',setMultiplier:1,intensity:'2 reps in reserve'},
  {week:3,label:'Overload',setMultiplier:1.34,intensity:'1-2 reps in reserve'},
  {week:4,label:'Consolidate',setMultiplier:.75,intensity:'3-4 reps in reserve'}
 ],
 strength:[
  {week:1,label:'Base',setMultiplier:1,intensity:'3 reps in reserve'},
  {week:2,label:'Build',setMultiplier:1,intensity:'2 reps in reserve'},
  {week:3,label:'Overload',setMultiplier:1.34,intensity:'1-2 reps in reserve'},
  {week:4,label:'Consolidate',setMultiplier:.75,intensity:'3-4 reps in reserve'}
 ],
 general_fitness:[
  {week:1,label:'Base',setMultiplier:1,intensity:'comfortable'},
  {week:2,label:'Build',setMultiplier:1,intensity:'moderate'},
  {week:3,label:'Practice+',setMultiplier:1.1,intensity:'moderate'},
  {week:4,label:'Consolidate',setMultiplier:.8,intensity:'easy-moderate'}
 ]
};

const SPLITS={
  2:['full_a','full_b'],
  3:['full_a','full_b','full_c'],
  4:['upper_a','lower_a','upper_b','lower_b'],
  5:['upper_a','lower_a','upper_b','lower_b','full_c']
};
const SLOT_TEMPLATES={
 upper_a:['horizontal_push','horizontal_pull','vertical_pull','shoulder_abduction','elbow_flexion','elbow_extension'],
 upper_b:['vertical_push','horizontal_pull','horizontal_push','vertical_pull','shoulder_abduction','elbow_extension','elbow_flexion'],
 lower_a:['squat','hinge','lunge','knee_flexion','calf','anti_extension'],
 lower_b:['hinge','squat','lunge','knee_flexion','calf','anti_extension'],
 full_a:['squat','horizontal_push','horizontal_pull','hinge','shoulder_abduction','anti_extension'],
 full_b:['hinge','vertical_push','vertical_pull','lunge','elbow_flexion','calf'],
 full_c:['squat','horizontal_push','vertical_pull','hinge','elbow_extension','anti_extension']
};

function normalizeProfile(input){
 const p=Object.assign({goal:'hypertrophy',experience:'beginner',sessionsPerWeek:4,sessionMinutes:45,equipment:['bodyweight','dumbbell','bench'],priorities:[],preferences:[],exclusions:[],stretchMinutes:2,mobilitySessionsPerWeek:1},input||{});
 p.sessionsPerWeek=Math.max(2,Math.min(5,Number(p.sessionsPerWeek)||4));
 p.sessionMinutes=Math.max(20,Math.min(120,Number(p.sessionMinutes)||45));
 p.stretchMinutes=Math.max(1,Math.min(15,Number(p.stretchMinutes)||2));
 p.equipment=Array.from(new Set(['bodyweight'].concat(p.equipment||[]))); p.temporaryExclusions=p.temporaryExclusions||[]; p.exerciseHistory=p.exerciseHistory||{}; p.discomfortPatterns=p.discomfortPatterns||[];
 return p;
}
function equipmentFits(item,p){
 return (item.equipment||[]).every(eq=>eq==='bodyweight'||p.equipment.includes(eq)||eq==='wall');
}
function chooseExercise(pattern,p,used){
 const candidates=EXERCISES.filter(e=>e.pattern===pattern&&!p.exclusions.includes(e.id)&&!p.temporaryExclusions.includes(e.id)&&!(p.discomfortPatterns||[]).includes(e.pattern)&&equipmentFits(e,p));
 if(!candidates.length)return null;
 const scored=candidates.map(e=>{
   let score=100;
   if(e.goals.includes(p.goal))score+=20;
   if((p.preferences||[]).includes(e.id))score+=15;
   if(used.has(e.id))score-=25;
   if((p.priorities||[]).some(m=>e.primary.includes(m)))score+=10; const h=p.exerciseHistory?.[e.id]; if(h){score+=Math.min(12,(h.completedSessions||0)*2); if(h.lastFeedback==='discomfort')score-=50; if(h.lastFeedback==='liked')score+=8;}
   return {e,score};
 }).sort((a,b)=>b.score-a.score||a.e.id.localeCompare(b.e.id));
 return scored[0].e;
}
function prescriptionFor(exercise,p,week){
 const accessory=['shoulder_abduction','elbow_flexion','elbow_extension','calf','anti_extension','anti_rotation'].includes(exercise.pattern);
 const model=(WEEK_MODELS[p.goal]||WEEK_MODELS.general_fitness)[week-1];
 const baseSets=accessory?3:3;
 const sets=Math.max(2,Math.round(baseSets*model.setMultiplier));
 const reps=p.goal==='strength'&&!accessory?[5,8]:(accessory?[10,15]:[8,12]);
 return {sets,reps,restSeconds:accessory?60:(p.goal==='strength'?120:90),intensityTarget:model.intensity,progression:exercise.progression,week,weekLabel:model.label,setMultiplier:model.setMultiplier};
}
function warmupFor(label){
 const lower=label.startsWith('lower');
 return lower?
 [{name:'Easy movement',seconds:60},{name:'Ankle rocks',seconds:45},{name:'90/90 Hip Switch',seconds:60},{name:'Glute bridge',seconds:45},{name:'Bodyweight squat rehearsal',seconds:90}]:
 [{name:'Easy movement',seconds:60},{name:'Cat-Cow Flow',seconds:45},{name:'Thread the Needle',seconds:60},{name:'Scapular wall slide',seconds:45},{name:'Movement rehearsal',seconds:90}];
}
function stretchTargets(label){
 if(label.startsWith('lower'))return ['hip_flexor','standing_hip_flexor','lunge_reach','adductor_rockback','butterfly','figure_four','seated_glute','quad_couch','standing_quad','hamstring_fold','half_split','calf_wall','bent_knee_calf','90_90'];
 if(label.startsWith('upper'))return ['doorway_chest','cross_body_shoulder','triceps_overhead','thread_needle','open_book','kneeling_lat','child_lat','standing_lat_side_bend','biceps_wall','forearm_flexor','forearm_extensor','upper_trap','levator_scapulae'];
 return ['90_90','hip_flexor','hamstring_fold','figure_four','doorway_chest','thread_needle','child_lat','calf_wall','supine_twist','kneeling_side_bend','breathing_reset'];
}
function stretchPlacementFits(stretchItem,placement){
 const placements=stretchItem.placements||['cooldown'];
 return placements.includes(placement)||placements.includes('either');
}
function stretchScore(stretchItem,targetIds,trainedMuscles){
 let score=0;
 const idIndex=targetIds.indexOf(stretchItem.id);
 if(idIndex>=0)score+=200-idIndex;
 (trainedMuscles||[]).forEach(m=>{if((stretchItem.muscles||[]).includes(m))score+=24});
 if(stretchItem.type==='static'||stretchItem.type==='breath_assisted')score+=8;
 if(stretchItem.difficulty===1)score+=2;
 return score;
}
function expandStretchActivity(stretchItem,totalSeconds){
 const base={
   id:stretchItem.id,
   parentStretchId:stretchItem.id,
   name:stretchItem.name,
   type:stretchItem.type,
   regions:stretchItem.regions,
   muscles:stretchItem.muscles,
   position:stretchItem.position,
   cues:stretchItem.cues,
   feel:stretchItem.feel,
   mistakes:stretchItem.mistakes,
   modification:stretchItem.modification,
   imageKey:stretchItem.imageKey,
   imageStatus:stretchItem.imageStatus,
   imageRequirement:stretchItem.imageRequirement
 };
 if(stretchItem.side==='per_side'){
   const left=Math.floor(totalSeconds/2),right=totalSeconds-left;
   return [
     {...base,id:stretchItem.id+'_left',side:'left',perSide:true,seconds:left,secondsPerSide:left},
     {...base,id:stretchItem.id+'_right',side:'right',perSide:true,seconds:right,secondsPerSide:right}
   ];
 }
 return [{...base,side:stretchItem.side||'both',perSide:false,seconds:totalSeconds,secondsPerSide:null}];
}
function movementStageDuration(item){
 const seconds=Math.max(0,Number(item?.seconds)||0);
 return seconds*(item?.side==='each side'?2:1);
}
function movementSessionActivity(stretchItem,secondsPerSide){
 return {
   id:stretchItem.id,
   catalogId:stretchItem.id,
   name:stretchItem.name,
   bodyArea:stretchItem.bodyArea,
   type:stretchItem.type,
   regions:stretchItem.regions,
   muscles:stretchItem.muscles,
   position:stretchItem.position,
   equipment:stretchItem.equipment,
   side:stretchItem.side==='per_side'?'each side':'',
   alternating:stretchItem.side==='alternating',
   seconds:Math.max(1,Math.round(secondsPerSide)),
   cues:stretchItem.cues,
   feel:stretchItem.feel,
   mistakes:stretchItem.mistakes,
   modification:stretchItem.modification,
   placements:stretchItem.placements,
   compatible:stretchItem.compatible,
   imageKey:stretchItem.imageKey,
   imageStatus:stretchItem.imageStatus,
   imageRequirement:stretchItem.imageRequirement,
   tags:stretchItem.tags
 };
}
function stageEquipmentFits(item,p,options){
 const available=new Set((options?.availableEquipment||p?.equipment||[]).concat('bodyweight'));
 return (item.equipment||[]).every(eq=>eq==='bodyweight'||eq==='wall'||available.has(eq));
}
function stageCompatible(item,label){
 const wanted=String(label||'').startsWith('upper')?'upper':String(label||'').startsWith('lower')?'lower':'full_body';
 const compatible=item.compatible||['full_body'];
 return compatible.includes(wanted)||compatible.includes('full_body')||wanted==='full_body';
}
function stageTypeScore(item,placement){
 if(placement==='warmup'){
   if(item.type==='dynamic')return 70;
   if(item.type==='mobility')return 60;
   if(item.type==='active')return 50;
   if(item.type==='breath_assisted')return -20;
   if(item.type==='static')return -45;
 }
 if(placement==='cooldown'){
   if(item.type==='static')return 60;
   if(item.type==='breath_assisted')return 45;
   if(item.type==='mobility')return 10;
   if(item.type==='dynamic')return -25;
 }
 return item.type==='mobility'?35:item.type==='static'?25:15;
}
function buildMovementSession(seconds,label,p,options){
 const opts=options||{};
 const placement=opts.placement||'recovery';
 const target=Math.max(60,Math.min(900,Number(seconds)||120));
 const trainedMuscles=Array.from(new Set(opts.trainedMuscles||[]));
 const excludedPositions=new Set(opts.excludedPositions||[]);
 const excludedIds=new Set(opts.excludedIds||[]);
 const targets=stretchTargets(label);
 const maxItems=Math.max(1,Math.min(8,Number(opts.maxItems)||(placement==='warmup'?5:placement==='cooldown'?4:6)));
 let pool=STRETCHES.filter(item=>
   !excludedIds.has(item.id)&&
   !excludedPositions.has(item.position)&&
   stretchPlacementFits(item,placement)&&
   stageCompatible(item,label)&&
   stageEquipmentFits(item,p,opts)
 );
 if(!pool.length){
   pool=STRETCHES.filter(item=>
     !excludedIds.has(item.id)&&
     !excludedPositions.has(item.position)&&
     stretchPlacementFits(item,placement)&&
     stageEquipmentFits(item,p,opts)
   );
 }
 pool=pool.slice().sort((a,b)=>{
   const aScore=stretchScore(a,targets,trainedMuscles)+stageTypeScore(a,placement);
   const bScore=stretchScore(b,targets,trainedMuscles)+stageTypeScore(b,placement);
   return bScore-aScore||a.id.localeCompare(b.id);
 });
 const activities=[];
 let total=0;
 for(const item of pool){
   if(activities.length>=maxItems||total>=target)break;
   const perSide=item.side==='per_side';
   const units=perSide?2:1;
   const preferred=Math.max(15,Number(item.defaultSeconds)||25);
   const minimum=Math.max(10,Number(item.minSeconds)||Number(item.beginnerSeconds)||15);
   const remaining=target-total;
   if(remaining<minimum*units)continue;
   const secondsPerSide=Math.min(preferred,Math.floor(remaining/units));
   if(secondsPerSide<minimum)continue;
   const activity=movementSessionActivity(item,secondsPerSide);
   activities.push(activity);
   total+=movementStageDuration(activity);
 }
 if(placement!=='warmup'&&total<target){
   const reset=STRETCHES.find(item=>item.id==='breathing_reset');
   if(reset&&!activities.some(item=>item.catalogId===reset.id)&&stageEquipmentFits(reset,p,opts)&&!excludedPositions.has(reset.position)){
     const remaining=target-total;
     if(remaining>=10){
       const activity=movementSessionActivity(reset,remaining);
       activities.push(activity);
       total+=movementStageDuration(activity);
     }
   }
 }
 return {
   type:placement==='warmup'?'warmup':placement==='cooldown'?'stretch':'mobility',
   placement,
   targetSeconds:target,
   targetMinutes:Math.round(target/6)/10,
   totalSeconds:total,
   activities,
   catalogVersion:1,
   targetedMuscles:trainedMuscles,
   setupFiltered:Boolean(opts.availableEquipment||opts.excludedPositions)
 };
}

function buildStretchSession(minutes,label,p,options){
 const target=Math.max(60,Math.min(900,minutes*60));
 const opts=options||{},placement=opts.placement||'cooldown';
 const targets=stretchTargets(label);
 const trainedMuscles=Array.from(new Set(opts.trainedMuscles||[]));
 let pool=STRETCHES.filter(s=>equipmentFits(s,p)&&stretchPlacementFits(s,placement));
 if(!pool.length)pool=STRETCHES.filter(s=>equipmentFits(s,p));
 pool=pool.slice().sort((a,b)=>stretchScore(b,targets,trainedMuscles)-stretchScore(a,targets,trainedMuscles)||a.id.localeCompare(b.id));
 const activities=[];let total=0,i=0;
 while(total<target&&i<pool.length){
   const s=pool[i++];
   const remaining=target-total;
   const perSide=s.side==='per_side';
   const preferred=(Number(s.defaultSeconds)||25)*(perSide?2:1);
   const minimum=(Number(s.beginnerSeconds)||Number(s.minSeconds)||15)*(perSide?2:1);
   if(remaining<minimum)continue;
   const allotted=Math.min(preferred,remaining);
   const steps=expandStretchActivity(s,allotted);
   steps.forEach(step=>activities.push(step));
   total+=steps.reduce((n,step)=>n+step.seconds,0);
 }
 if(total<target){
   const reset=STRETCHES.find(s=>s.id==='breathing_reset');
   const remaining=target-total;
   activities.push(...expandStretchActivity(reset,remaining));
   total=target;
 }
 return {type:'stretch',placement,targetMinutes:minutes,totalSeconds:target,activities,catalogVersion:1,targetedMuscles:trainedMuscles};
}
function estimateStrengthMinutes(strength){
 return strength.reduce((sum,x)=>{
  if(!x.exercise)return sum;
  const pr=x.prescription;
  return sum + pr.sets*((pr.restSeconds+45)/60);
 },0);
}
function timeBudgetSession(session,p){
 const warmupSeconds=session.warmup.reduce((n,x)=>n+movementStageDuration(x),0);
 const stretchSeconds=session.stretch.totalSeconds;
 const availableStrength=Math.max(8,p.sessionMinutes-(warmupSeconds+stretchSeconds)/60);
 let running=0;
 session.strength.forEach((x,i)=>{
  if(!x.exercise){x.inMinimumViable=false;return}
  const cost=x.prescription.sets*((x.prescription.restSeconds+45)/60);
  running+=cost;
  x.estimatedMinutes=Math.round(cost*10)/10;
  x.inMinimumViable=i<3;
  x.timeFit=running<=availableStrength;
 });
 session.minimumViableWorkout=session.strength.filter(x=>x.exercise&&x.inMinimumViable).map(x=>x.exercise.id);
 session.timeBudget={targetMinutes:p.sessionMinutes,warmupMinutes:Math.round(warmupSeconds/6)/10,stretchMinutes:stretchSeconds/60,strengthBudgetMinutes:Math.round(availableStrength*10)/10,estimatedStrengthMinutes:Math.round(estimateStrengthMinutes(session.strength)*10)/10};
 return session;
}
function applySupersets(session){
 const eligible=session.strength.filter(x=>x.exercise&&['shoulder_abduction','elbow_flexion','elbow_extension','calf','anti_extension'].includes(x.slot));
 session.supersets=[];
 for(let i=0;i+1<eligible.length;i+=2){
  const id='SS'+(session.supersets.length+1);
  eligible[i].superset=id;eligible[i+1].superset=id;
  session.supersets.push({id,exerciseIds:[eligible[i].exercise.id,eligible[i+1].exercise.id],reason:'Pairs lower-conflict accessory work to improve session efficiency'});
 }
 return session;
}
function substitutionsFor(exercise,p){
 if(!exercise)return[];
 return EXERCISES.filter(e=>e.id!==exercise.id&&e.pattern===exercise.pattern&&!p.exclusions.includes(e.id)&&equipmentFits(e,p))
  .map(e=>({id:e.id,name:e.name,reasons:['same movement objective','available equipment',e.group===exercise.group?'same substitution group':'compatible pattern']})).slice(0,3);
}
function buildMobilitySession(minutes,p,focus){
 const target=Math.max(300,Math.min(900,(Number(minutes)||10)*60));
 const wanted=focus==='upper'?['upper_back','shoulders']:focus==='lower'?['hips','ankles']:null;
 let pool=MOBILITY.filter(m=>!wanted||m.regions.some(r=>wanted.includes(r)));
 if(!pool.length)pool=MOBILITY;
 const activities=[];let total=0,i=0;
 while(total<target){const m=pool[i%pool.length],seconds=Math.min(m.seconds,target-total);activities.push({...m,seconds});total+=seconds;i++}
 return {type:'mobility',focus:focus||'full_body',targetMinutes:target/60,totalSeconds:target,activities};
}
function buildConditioningSession(minutes,p,mode){
 const target=Math.max(5,Math.min(45,Number(minutes)||15));
 const candidates=CONDITIONING.filter(x=>equipmentFits(x,p)&&(mode?x.mode===mode:true));
 const activity=candidates[0]||CONDITIONING[0];
 return {type:'conditioning',activity,minutes:target,prescription:activity.mode==='interval'?{workSeconds:30,recoverySeconds:60,rounds:Math.max(4,Math.floor(target*60/90))}:{intensity:'conversational to moderate',minutes:target}};
}
function buildStrategy(p){
 const split=p.sessionsPerWeek===4?'upper_lower':p.sessionsPerWeek===3?'full_body_3':p.sessionsPerWeek===2?'full_body_2':'hybrid_5';
 return {goal:p.goal,frequency:p.sessionsPerWeek,split,blockWeeks:4,progression:'weekly_block_plus_exercise_specific',stretchMinutes:p.stretchMinutes,mobilitySessionsPerWeek:p.mobilitySessionsPerWeek,weekModel:WEEK_MODELS[p.goal]||WEEK_MODELS.general_fitness};
}
function eligibleExercises(pattern,p){
 return EXERCISES.filter(e=>e.pattern===pattern&&!p.exclusions.includes(e.id)&&!p.temporaryExclusions.includes(e.id)&&!(p.discomfortPatterns||[]).includes(e.pattern)&&equipmentFits(e,p));
}
function rotationScore(exercise,p,exposure,baselineId){
 let score=100;
 if(exercise.goals.includes(p.goal))score+=20;
 if((p.preferences||[]).includes(exercise.id))score+=15;
 if((p.priorities||[]).some(m=>exercise.primary.includes(m)))score+=10;
 if(exercise.id!==baselineId)score+=12;
 score-=(exposure.get(exercise.id)||0)*14;
 const h=p.exerciseHistory?.[exercise.id];
 if(h){
   score+=Math.min(10,(h.completedSessions||0)*1.5);
   if(h.lastFeedback==='discomfort')score-=60;
   if(h.lastFeedback==='liked')score+=8;
 }
 return score;
}
function chooseBlockExercise(pattern,p,{baseline=null,role='anchor',week=1,sessionIndex=0,slotIndex=0,exposure=new Map()}={}){
 const candidates=eligibleExercises(pattern,p);
 if(!candidates.length)return null;
 if(role==='anchor'&&baseline)return baseline;
 if(role==='rotation'&&week===4&&baseline)return baseline;
 const baselineId=baseline?.id||'';
 const ranked=candidates.map(e=>({e,score:rotationScore(e,p,exposure,baselineId)})).sort((a,b)=>b.score-a.score||a.e.id.localeCompare(b.e.id));
 if(role==='rotation'&&baseline&&week>1&&week<4){
   const alternates=ranked.filter(item=>item.e.id!==baseline.id);
   if(alternates.length){
     const pick=alternates[(week+sessionIndex+slotIndex-3)%alternates.length];
     return pick.e;
   }
 }
 if(baseline)return baseline;
 return ranked[0].e;
}
function sessionChangeSummary(session,baselineSession){
 const current=(session.strength||[]).filter(x=>x.exercise);
 const baseline=(baselineSession?.strength||[]).filter(x=>x.exercise);
 let retained=0,rotated=0,progressed=0;
 current.forEach((item,index)=>{
   const base=baseline[index];
   if(base?.exercise?.id===item.exercise?.id)retained++;
   else if(base?.exercise&&item.exercise)rotated++;
   const currentSets=Number(item.prescription?.sets)||0;
   const baseSets=Number(base?.prescription?.sets)||0;
   if(currentSets>baseSets)progressed++;
 });
 return {retained,rotated,progressed,total:current.length};
}
function buildProgram(input){
 const p=normalizeProfile(input), strategy=buildStrategy(p), labels=SPLITS[p.sessionsPerWeek], weeks=[];
 const exposure=new Map(),baselineSessions=[];
 for(let week=1;week<=4;week++){
   const sessions=labels.map((label,index)=>{
     const slots=SLOT_TEMPLATES[label];
     const baselineSession=baselineSessions[index]||null;
     const anchorCount=Math.max(1,Math.ceil(slots.length*.6));
     const strength=slots.map((pattern,slotIndex)=>{
       const role=slotIndex<anchorCount?'anchor':'rotation';
       const baseline=baselineSession?.strength?.[slotIndex]?.exercise||null;
       const exercise=chooseBlockExercise(pattern,p,{baseline,role,week,sessionIndex:index,slotIndex,exposure});
       if(!exercise)return {slot:pattern,programRole:role,unfilled:true,reason:'No compatible exercise for available equipment/exclusions'};
       exposure.set(exercise.id,(exposure.get(exercise.id)||0)+1);
       const changed=Boolean(baseline&&baseline.id!==exercise.id);
       return {
         slot:pattern,
         programRole:role,
         changedFromWeek1:changed?{id:baseline.id,name:baseline.name}:null,
         exercise:Object.assign({},exercise),
         prescription:prescriptionFor(exercise,p,week),
         substitutions:substitutionsFor(exercise,p),
         reason:[
           'matches '+pattern,
           'equipment available',
           role==='anchor'?'anchor movement retained for measurable progression':'rotation slot balances variety with progression',
           changed?'rotated from '+baseline.name:'retained from block baseline',
           exercise.goals.includes(p.goal)?'supports '+p.goal:'compatible training option'
         ]
       };
     });
     const trainedMuscles=Array.from(new Set(strength.filter(x=>x.exercise).flatMap(x=>(x.exercise.primary||[]).concat(x.exercise.secondary||[]))));
     const warmupSeconds=p.sessionMinutes<=30?180:p.sessionMinutes>=60?300:240;
     let session={id:'w'+week+'s'+(index+1),week,index:index+1,label,type:'strength',estimatedMinutes:p.sessionMinutes,warmup:buildMovementSession(warmupSeconds,label,p,{placement:'warmup',trainedMuscles,maxItems:5}).activities,strength,stretch:buildStretchSession(p.stretchMinutes,label,p,{placement:'cooldown',trainedMuscles}),status:'scheduled'};
     session=applySupersets(session);
     session=timeBudgetSession(session,p);
     if(week===1)baselineSessions[index]=JSON.parse(JSON.stringify(session));
     session.changeSummary=sessionChangeSummary(session,baselineSessions[index]);
     return session;
   });
   const model=(WEEK_MODELS[p.goal]||WEEK_MODELS.general_fitness)[week-1];
   const recoveryActivities=[];
   for(let m=0;m<p.mobilitySessionsPerWeek;m++)recoveryActivities.push(buildMobilitySession(p.stretchMinutes,p,'full'));
   const totals=sessions.reduce((acc,session)=>{
     acc.retained+=session.changeSummary?.retained||0;
     acc.rotated+=session.changeSummary?.rotated||0;
     acc.progressed+=session.changeSummary?.progressed||0;
     acc.total+=session.changeSummary?.total||0;
     return acc;
   },{retained:0,rotated:0,progressed:0,total:0});
   weeks.push({week,label:model.label,sessions,recoveryActivities,changeSummary:totals,provisional:week>1});
 }
 return {version:'1.8.0',profile:p,strategy,weeks,createdBy:'GoWorkout Program Engine v1.8',programModel:'anchor_rotation',stretchCatalogVersion:1};
}
function validateProgram(program){
 const errors=[];
 if(!program||program.weeks?.length!==4)errors.push('Program must contain four weeks');
 const sessions=(program.weeks||[]).flatMap(w=>w.sessions||[]);
 if(sessions.length!==program.profile.sessionsPerWeek*4)errors.push('Session count does not match frequency');
 sessions.forEach(s=>{
   if(!s.warmup?.length)errors.push(s.id+': missing warmup');
   if(!s.stretch||s.stretch.totalSeconds<60||s.stretch.totalSeconds>900)errors.push(s.id+': stretch duration invalid');
   s.strength.forEach(x=>{
     if(x.exercise&&!equipmentFits(x.exercise,program.profile))errors.push(s.id+': incompatible equipment '+x.exercise.id);
     if(x.exercise&&program.profile.exclusions.includes(x.exercise.id))errors.push(s.id+': excluded exercise selected '+x.exercise.id);
   });
 });
 return {valid:errors.length===0,errors};
}
function weeklyMuscleTargets(profile){
 const p=normalizeProfile(profile), base=p.goal==='hypertrophy'?10:p.goal==='strength'?8:6;
 const targets={};
 TAXONOMY.muscles.forEach(m=>targets[m]=base);
 ['hip_flexors','adductors'].forEach(m=>targets[m]=Math.max(4,base-4));
 (p.priorities||[]).forEach(m=>{if(targets[m]!=null)targets[m]+=4});
 return targets;
}
function weeklyMuscleVolume(program,weekNumber){
 const totals={};
 const week=(program.weeks||[]).find(w=>w.week===weekNumber);
 (week?.sessions||[]).forEach(s=>(s.strength||[]).forEach(x=>{if(!x.exercise)return;const sets=x.prescription?.sets||0;(x.exercise.primary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets);(x.exercise.secondary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets*.5)}));
 return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.round(v*10)/10]));
}
function rebalancePriorityVolume(program){
 const clone=JSON.parse(JSON.stringify(program)),targets=weeklyMuscleTargets(clone.profile);
 (clone.weeks||[]).forEach(w=>{
  const actual=weeklyMuscleVolume({weeks:[w]},w.week);
  (clone.profile.priorities||[]).forEach(m=>{
   let deficit=Math.max(0,(targets[m]||0)-(actual[m]||0));
   if(deficit<=0)return;
   const candidates=w.sessions.flatMap(s=>s.strength.map(x=>({s,x}))).filter(o=>o.x.exercise?.primary?.includes(m));
   let i=0;
   while(deficit>0&&candidates.length&&i<20){
    const o=candidates[i%candidates.length];
    if(o.x.prescription.sets<7){o.x.prescription.sets+=1;o.x.priorityVolumeAdded=(o.x.priorityVolumeAdded||0)+1;deficit-=1}
    i++;
    if(candidates.every(z=>z.x.prescription.sets>=7))break;
   }
  });
 });
 clone.volumeAudit=volumeAudit(clone);
 return clone;
}
function volumeAudit(program){
 const targets=weeklyMuscleTargets(program.profile),weeks=(program.weeks||[]).map(w=>{
  const actual=weeklyMuscleVolume(program,w.week),muscles={};
  Object.keys(targets).forEach(m=>{const a=actual[m]||0,t=targets[m];muscles[m]={target:t,actual:a,status:a<t*.7?'low':a>t*1.5?'high':'in_range'}});
  return {week:w.week,muscles};
 });
 return {targets,weeks};
}
function interpretPostWorkoutFeedback(feedback){
 const f=Object.assign({difficulty:3,energyAfter:3,pain:false,enjoyment:3},feedback||{});
 let action='none',reason='Feedback is compatible with the current prescription';
 if(f.pain){action='route_discomfort';reason='Pain/discomfort feedback should route the movement for review rather than automatic progression'}
 else if(Number(f.difficulty)>=5&&Number(f.energyAfter)<=2){action='reduce_next';reason='Very high difficulty with low post-session energy suggests reducing the next exposure'}
 else if(Number(f.difficulty)<=2&&Number(f.enjoyment)>=3){action='consider_progression';reason='Low difficulty with acceptable enjoyment supports reviewing progression'}
 return {action,reason,feedback:f};
}
function substitutionOptions(exercise,p,context){
 const profile=normalizeProfile(p),ctx=context||{};
 return EXERCISES.filter(e=>e.id!==exercise.id&&e.pattern===exercise.pattern&&!profile.exclusions.includes(e.id)&&!profile.temporaryExclusions.includes(e.id)&&equipmentFits(e,profile))
 .map(e=>{let score=100,reasons=['preserves '+exercise.pattern+' objective','works with available equipment'];if(e.group===exercise.group){score+=10;reasons.push('same substitution family')}if(ctx.reason==='discomfort'){score+=(e.difficulty<=exercise.difficulty?8:0);reasons.push('selected conservatively after discomfort report')}if(profile.preferences.includes(e.id)){score+=10;reasons.push('user preference')}return {id:e.id,name:e.name,score,reasons}})
 .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,4);
}
function createSchedule(program,startDate,trainingDays){
 const start=new Date((startDate||new Date().toISOString().slice(0,10))+'T12:00:00');
 const days=(trainingDays&&trainingDays.length?trainingDays:[1,3,5,6]).map(Number);
 const entries=[];let cursor=new Date(start),wi=0,si=0;
 while(wi<program.weeks.length){
  if(days.includes(cursor.getDay())){
   const session=program.weeks[wi].sessions[si];
   if(session){entries.push({id:'schedule_'+session.id,sessionId:session.id,week:wi+1,date:cursor.toISOString().slice(0,10),status:'scheduled',history:[]});si++}
   if(si>=program.weeks[wi].sessions.length){wi++;si=0}
  }
  cursor.setDate(cursor.getDate()+1);
 }
 return entries;
}
function transitionScheduleEntry(entry,status,date){
 const allowed={scheduled:['started','skipped','rescheduled'],started:['in_progress','completed'],in_progress:['paused','completed'],paused:['in_progress','completed'],skipped:['rescheduled'],rescheduled:['started','skipped','rescheduled'],completed:[]};
 if(!(allowed[entry.status]||[]).includes(status))return {ok:false,error:'Invalid schedule transition '+entry.status+' -> '+status,entry};
 const next=JSON.parse(JSON.stringify(entry));next.history.push({from:entry.status,to:status,date:date||null});next.status=status;if(status==='rescheduled'&&date)next.date=date;return {ok:true,entry:next};
}
function readinessDecision(input){
 const r=Object.assign({energy:3,sleep:3,soreness:2,stress:2},input||{});
 const clamp=n=>Math.max(1,Math.min(5,Number(n)||3));
 const energy=clamp(r.energy),sleep=clamp(r.sleep),soreness=clamp(r.soreness),stress=clamp(r.stress);
 const score=Math.round(((energy+sleep+(6-soreness)+(6-stress))/20)*100);
 let mode='normal',volumeMultiplier=1,intensityAdjustment='none';
 if(score<45){mode='recovery';volumeMultiplier=.55;intensityAdjustment='reduce load and keep 4+ reps in reserve'}
 else if(score<70){mode='reduced';volumeMultiplier=.75;intensityAdjustment='keep 3+ reps in reserve'}
 return {score,mode,volumeMultiplier,intensityAdjustment,inputs:{energy,sleep,soreness,stress},reason:mode==='normal'?'Readiness supports planned training':mode==='reduced'?'Readiness is below baseline; reduce workload':'Readiness is low; prioritize recovery-quality work'};
}
function applyReadiness(session,readiness){
 const decision=readinessDecision(readiness);
 const clone=JSON.parse(JSON.stringify(session));
 clone.readiness=decision;
 if(decision.mode!=='normal'){
  clone.strength.forEach(x=>{if(x.exercise){x.prescription.sets=Math.max(1,Math.round(x.prescription.sets*decision.volumeMultiplier));x.prescription.intensityTarget=decision.intensityAdjustment}});
 }
 return clone;
}
function muscleVolume(program){
 const totals={};
 (program.weeks||[]).forEach(w=>(w.sessions||[]).forEach(s=>(s.strength||[]).forEach(x=>{
  if(!x.exercise)return;
  const sets=x.prescription?.sets||0;
  (x.exercise.primary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets);
  (x.exercise.secondary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets*.5);
 })));
 return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.round(v*10)/10]));
}
function ingestPerformance(session,performed){
 const entries=(performed?.exercises||[]).map(e=>{
  const planned=(session.strength||[]).find(x=>x.exercise?.id===e.exerciseId);
  if(!planned)return {exerciseId:e.exerciseId,status:'unplanned',sets:e.sets||[]};
  const completed=(e.sets||[]).filter(s=>s.completed!==false);
  const targetSets=planned.prescription.sets;
  const avgReps=completed.length?completed.reduce((n,s)=>n+(Number(s.reps)||0),0)/completed.length:0;
  return {exerciseId:e.exerciseId,status:'planned',targetSets,completedSets:completed.length,completionRate:targetSets?Math.round(completed.length/targetSets*100):0,averageReps:Math.round(avgReps*10)/10,sets:completed};
 });
 const plannedIds=(session.strength||[]).filter(x=>x.exercise).map(x=>x.exercise.id);
 const completedIds=new Set(entries.filter(x=>x.status==='planned'&&x.completedSets>0).map(x=>x.exerciseId));
 const adherence=plannedIds.length?Math.round(completedIds.size/plannedIds.length*100):100;
 return {sessionId:session.id,completedAt:performed?.completedAt||null,entries,adherence,feedback:performed?.feedback||{},source:'performance_ingestion_v1'};
}
function compressSession(session,availableMinutes){
 const clone=JSON.parse(JSON.stringify(session));
 const minutes=Math.max(10,Number(availableMinutes)||clone.estimatedMinutes||30);
 const warm=clone.timeBudget?.warmupMinutes||5,stretch=Math.min(clone.timeBudget?.stretchMinutes||5,minutes<=25?5:clone.timeBudget?.stretchMinutes||5);
 let budget=Math.max(5,minutes-warm-stretch),used=0;
 clone.strength.forEach((x,i)=>{
  if(!x.exercise){x.compressionStatus='unfilled';return}
  const setCost=(x.prescription.restSeconds+45)/60;
  const fullCost=x.prescription.sets*setCost;
  if(used+fullCost<=budget){x.compressionStatus='full';used+=fullCost;return}
  if(i<3){const remaining=Math.max(0,budget-used);const fit=Math.floor(remaining/setCost);if(fit>0){x.prescription.sets=Math.min(x.prescription.sets,fit);x.compressionStatus='reduced';used+=x.prescription.sets*setCost;return} if(i===2&&used>0){const donor=clone.strength.slice(0,2).reverse().find(y=>y.exercise&&y.prescription.sets>1);if(donor){donor.prescription.sets-=1;used-=((donor.prescription.restSeconds+45)/60);if(used+setCost<=budget){x.prescription.sets=1;x.compressionStatus='minimum_priority';used+=setCost;return}}}}
  x.prescription.sets=0;x.compressionStatus='removed_for_time';
 });
 clone.stretch=buildStretchSession(stretch<=5?5:stretch,clone.label,{equipment:['bodyweight','wall','bench']});
 clone.compressedFromMinutes=session.estimatedMinutes;
 clone.estimatedMinutes=minutes;
 clone.compression={availableMinutes:minutes,strengthBudgetMinutes:Math.round(budget*10)/10,estimatedUsedMinutes:Math.round(used*10)/10,principle:'preserve highest-priority movements before accessory work'};
 return clone;
}
function adaptationDecision(program,performanceRecords,readinessRecords){
 const records=performanceRecords||[], readiness=readinessRecords||[];
 const avgAdherence=records.length?records.reduce((n,r)=>n+(r.adherence||0),0)/records.length:100;
 const lowReadiness=readiness.filter(r=>readinessDecision(r).mode!=='normal').length;
 const ratio=readiness.length?lowReadiness/readiness.length:0;
 let action='continue',reason='Adherence and readiness support the current strategy',volumeMultiplier=1;
 if(avgAdherence<60){action='simplify';volumeMultiplier=.8;reason='Low adherence suggests the current program demand is too high'}
 else if(ratio>=.5){action='reduce';volumeMultiplier=.85;reason='Repeated reduced readiness suggests accumulated recovery demand'}
 else if(avgAdherence>=90&&records.length>=4){action='progress';volumeMultiplier=1.05;reason='High adherence supports a modest next-block progression'}
 return {action,reason,volumeMultiplier,averageAdherence:Math.round(avgAdherence),lowReadinessRate:Math.round(ratio*100)};
}
function createProgramVersion(program,adaptation){
 const next=JSON.parse(JSON.stringify(program));
 const current=String(program.version||'1.0.0').split('.').map(Number);
 current[1]=(current[1]||0)+1;current[2]=0;
 next.version=current.join('.');
 next.parentVersion=program.version;
 next.versionReason=adaptation?.reason||'Program revision';
 next.previousProgramSnapshot={version:program.version,createdBy:program.createdBy};
 next.createdBy='GoWorkout Program Engine '+next.version;
 const multiplier=adaptation?.volumeMultiplier||1;
 next.weeks.forEach(w=>w.sessions.forEach(s=>{
  const items=s.strength.filter(x=>x.exercise),before=items.reduce((n,x)=>n+x.prescription.sets,0),target=Math.max(items.length,Math.round(before*multiplier));
  let delta=target-before;
  if(delta>0){let i=0;while(delta>0&&items.length){const x=items[i%items.length];if(x.prescription.sets<6){x.prescription.sets++;delta--}i++;if(i>items.length*6)break}}
  if(delta<0){let i=items.length-1;while(delta<0&&items.length){const x=items[(i+items.length)%items.length];if(x.prescription.sets>1){x.prescription.sets--;delta++}i--;if(Math.abs(i)>items.length*8)break}}
  s.versionedVolume={previousSets:before,targetSets:target,appliedSets:items.reduce((n,x)=>n+x.prescription.sets,0),multiplier};
 }));
 return next;
}
const EXECUTION_STATES=['scheduled','preparing','warmup','active','resting','paused','stretching','completed','exited_resumable'];
function createWorkoutExecution(session){
 const strength=(session.strength||[]).filter(x=>x.exercise).map((x,index)=>({
  index,exerciseId:x.exercise.id,name:x.exercise.name,prescription:JSON.parse(JSON.stringify(x.prescription)),
  originalExerciseId:x.exercise.id,sets:Array.from({length:x.prescription.sets},(_,i)=>({index:i+1,reps:null,weight:null,completed:false,completedAt:null})),
  substitutions:x.substitutions||[],status:'pending'
 }));
 return {schemaVersion:2,sessionId:session.id,state:'scheduled',phase:'scheduled',warmupIndex:0,exerciseIndex:0,stretchIndex:0,warmup:(session.warmup||[]).map((x,i)=>({...x,index:i,completed:false})),stretch:(session.stretch?.activities||[]).map((x,i)=>({...x,index:i,completed:false})),strength,startedAt:null,completedAt:null,pausedAt:null,lastSavedAt:null,rest:null,eventLog:[],revision:0};
}
function executionTransition(execution,next,meta){
 const allowed={scheduled:['preparing'],preparing:['warmup','active','exited_resumable'],warmup:['warmup','active','paused','exited_resumable'],active:['active','resting','stretching','paused','exited_resumable'],resting:['active','paused','exited_resumable'],paused:['warmup','active','resting','stretching','exited_resumable'],stretching:['stretching','completed','paused','exited_resumable'],exited_resumable:['preparing'],completed:[]};
 if(!(allowed[execution.state]||[]).includes(next))return {ok:false,error:'Invalid execution transition '+execution.state+' -> '+next,execution};
 const e=JSON.parse(JSON.stringify(execution)),now=meta?.at||null;
 e.eventLog.push({type:'state',from:e.state,to:next,at:now});e.state=next;e.revision++;
 if(next==='preparing'&&!e.startedAt)e.startedAt=now;
 if(next==='paused')e.pausedAt=now;
 if(next==='warmup')e.phase='warmup';
 if(next==='active')e.phase='strength';
 if(next==='stretching')e.phase='stretch';
 if(next==='completed'){e.phase='completed';e.completedAt=now;e.rest=null}
 return {ok:true,execution:e};
}
function recordSet(execution,exerciseIndex,setIndex,data){
 const e=JSON.parse(JSON.stringify(execution)),ex=e.strength[exerciseIndex],set=ex?.sets?.[setIndex];
 if(!set)return {ok:false,error:'Set not found',execution};
 if(!['active','resting'].includes(e.state))return {ok:false,error:'Sets can only be recorded during active strength work',execution};
 set.reps=data?.reps==null?set.reps:Number(data.reps);set.weight=data?.weight==null?set.weight:Number(data.weight);set.completed=data?.completed!==false;set.completedAt=data?.at||null;
 ex.status=ex.sets.every(s=>s.completed)?'completed':'in_progress';e.exerciseIndex=exerciseIndex;e.revision++;e.eventLog.push({type:'set_recorded',exerciseId:ex.exerciseId,set:setIndex+1,at:data?.at||null});
 return {ok:true,execution:e};
}
function startRest(execution,seconds,atMs){
 if(execution.state!=='active')return {ok:false,error:'Rest can only start from active state',execution};
 const e=JSON.parse(JSON.stringify(execution)),duration=Math.max(0,Number(seconds)||0),start=Number(atMs)||0;
 e.state='resting';e.rest={durationSeconds:duration,startedAtMs:start,endsAtMs:start+duration*1000};e.revision++;e.eventLog.push({type:'rest_started',seconds:duration,atMs:start});
 return {ok:true,execution:e};
}
function restRemaining(execution,nowMs){
 if(!execution.rest)return 0;
 return Math.max(0,Math.ceil((execution.rest.endsAtMs-Number(nowMs))/1000));
}
function finishRest(execution,nowMs){
 if(execution.state!=='resting')return {ok:false,error:'Not resting',execution};
 if(restRemaining(execution,nowMs)>0)return {ok:false,error:'Rest timer has not finished',execution};
 const e=JSON.parse(JSON.stringify(execution));e.state='active';e.rest=null;e.revision++;e.eventLog.push({type:'rest_finished',atMs:Number(nowMs)});return {ok:true,execution:e};
}
function previewNextExercise(execution){
 const current=execution.exerciseIndex,next=execution.strength[current+1];
 return next?{exerciseId:next.exerciseId,name:next.name,prescription:JSON.parse(JSON.stringify(next.prescription)),previewOnly:true}:null;
}
function navigateExercise(execution,index){
 const i=Number(index);
 if(i<0||i>=execution.strength.length)return {ok:false,error:'Exercise index out of range',execution};
 const e=JSON.parse(JSON.stringify(execution));e.exerciseIndex=i;e.revision++;e.eventLog.push({type:'navigate',exerciseIndex:i});return {ok:true,execution:e};
}
function canAdvanceExercise(execution){
 const ex=execution.strength[execution.exerciseIndex];
 return !!ex&&ex.sets.length>0&&ex.sets.every(s=>s.completed);
}
function advanceExercise(execution){
 if(!canAdvanceExercise(execution))return {ok:false,error:'Current exercise still has incomplete sets',execution};
 const e=JSON.parse(JSON.stringify(execution));
 if(e.exerciseIndex<e.strength.length-1){e.exerciseIndex++;e.state='active';e.rest=null;e.revision++;e.eventLog.push({type:'exercise_advanced',exerciseIndex:e.exerciseIndex});return {ok:true,execution:e,finishedStrength:false}}
 e.state='stretching';e.phase='stretch';e.rest=null;e.revision++;e.eventLog.push({type:'strength_completed'});return {ok:true,execution:e,finishedStrength:true};
}
function substituteDuringWorkout(execution,replacement,reason){
 if(!['active','resting'].includes(execution.state))return {ok:false,error:'Substitution unavailable outside active strength work',execution};
 const e=JSON.parse(JSON.stringify(execution)),ex=e.strength[e.exerciseIndex];
 if(!ex)return {ok:false,error:'Current exercise not found',execution};
 const completed=ex.sets.filter(s=>s.completed).length;
 ex.substitutionHistory=ex.substitutionHistory||[];ex.substitutionHistory.push({from:ex.exerciseId,to:replacement.id,reason:reason||'user_choice',afterCompletedSets:completed});
 ex.exerciseId=replacement.id;ex.name=replacement.name;ex.status=completed?'in_progress':'pending';e.state='active';e.rest=null;e.revision++;e.eventLog.push({type:'substitution',to:replacement.id,reason:reason||'user_choice'});
 return {ok:true,execution:e};
}
function executionSnapshot(execution){
 return JSON.parse(JSON.stringify(execution));
}
function resumeExecution(snapshot){
 const e=executionSnapshot(snapshot);
 if(e.state!=='exited_resumable'&&e.state!=='paused')return {ok:false,error:'Execution is not resumable',execution:e};
 e.state=e.phase==='warmup'?'warmup':e.phase==='stretch'?'stretching':'active';e.revision++;e.eventLog.push({type:'resumed'});return {ok:true,execution:e};
}
function completeWarmupStep(execution,index,at){
 const e=executionSnapshot(execution);
 if(e.state!=='warmup')return {ok:false,error:'Warm-up step unavailable outside warm-up phase',execution};
 const step=e.warmup?.[index];if(!step)return {ok:false,error:'Warm-up step not found',execution};
 step.completed=true;step.completedAt=at||null;e.warmupIndex=Math.min(index+1,e.warmup.length-1);e.revision++;e.eventLog.push({type:'warmup_step_completed',index,at:at||null});
 if(e.warmup.every(x=>x.completed)){e.state='active';e.phase='strength';e.warmupIndex=e.warmup.length}
 return {ok:true,execution:e};
}
function completeStretchStep(execution,index,at){
 const e=executionSnapshot(execution);
 if(e.state!=='stretching')return {ok:false,error:'Stretch step unavailable outside stretch phase',execution};
 const step=e.stretch?.[index];if(!step)return {ok:false,error:'Stretch step not found',execution};
 step.completed=true;step.completedAt=at||null;e.stretchIndex=Math.min(index+1,e.stretch.length-1);e.revision++;e.eventLog.push({type:'stretch_step_completed',index,at:at||null});
 if(e.stretch.every(x=>x.completed)){e.state='completed';e.phase='completed';e.completedAt=at||null;e.stretchIndex=e.stretch.length;e.eventLog.push({type:'workout_completed',at:at||null})}
 return {ok:true,execution:e};
}
function completionPayload(execution,feedback){
 if(execution.state!=='completed')return {ok:false,error:'Workout is not completed'};
 const completedSets=execution.strength.flatMap(x=>x.sets.filter(s=>s.completed).map(s=>({exerciseId:x.exerciseId,originalExerciseId:x.originalExerciseId,set:s.index,reps:s.reps,weight:s.weight,completedAt:s.completedAt})));
 return {ok:true,payload:{schemaVersion:1,sessionId:execution.sessionId,startedAt:execution.startedAt,completedAt:execution.completedAt,completedSets,exerciseSummary:execution.strength.map(x=>({exerciseId:x.exerciseId,originalExerciseId:x.originalExerciseId,completedSets:x.sets.filter(s=>s.completed).length,plannedSets:x.sets.length,substitutionHistory:x.substitutionHistory||[]})),warmupCompleted:execution.warmup.every(x=>x.completed),stretchCompleted:execution.stretch.every(x=>x.completed),feedback:feedback||{},executionRevision:execution.revision}};
}
function serializeExecution(execution,savedAt){
 const envelope={storageSchema:1,savedAt:savedAt||null,revision:execution.revision,execution:executionSnapshot(execution)};
 return JSON.stringify(envelope);
}
function restoreExecution(serialized,options){
 let envelope;try{envelope=typeof serialized==='string'?JSON.parse(serialized):serialized}catch(e){return {ok:false,recovery:'discard',error:'Stored workout is corrupted JSON'}}
 if(!envelope||envelope.storageSchema!==1||!envelope.execution)return {ok:false,recovery:'discard',error:'Stored workout envelope is invalid'};
 const x=envelope.execution;
 if(x.schemaVersion!==2||!x.sessionId||!EXECUTION_STATES.includes(x.state)||!Array.isArray(x.strength))return {ok:false,recovery:'discard',error:'Stored workout schema is unsupported or incomplete'};
 const now=Number(options?.nowMs)||0,saved=Number(options?.savedAtMs??envelope.savedAt)||0,maxAge=Number(options?.maxAgeMs)||1000*60*60*24;
 const stale=!!(now&&saved&&now-saved>maxAge);
 return {ok:true,execution:executionSnapshot(x),stale,recovery:stale?'confirm_resume':'resume',savedAt:envelope.savedAt};
}
function guardedExecutionWrite(current,incoming,expectedRevision){
 if(!incoming)return {ok:false,error:'Incoming execution missing'};
 if(Number(current?.revision)!==Number(expectedRevision))return {ok:false,conflict:true,error:'Execution revision conflict',currentRevision:current?.revision,expectedRevision};
 if(incoming.revision<=current.revision)return {ok:false,conflict:true,error:'Incoming execution is not newer',currentRevision:current.revision,incomingRevision:incoming.revision};
 return {ok:true,execution:executionSnapshot(incoming)};
}
function recoverExecution(serialized,options){
 const restored=restoreExecution(serialized,options);
 if(!restored.ok)return {action:'clear_invalid',canResume:false,error:restored.error};
 if(restored.execution.state==='completed')return {action:'archive_completed',canResume:false,execution:restored.execution};
 if(restored.stale)return {action:'ask_resume_or_discard',canResume:true,execution:restored.execution};
 return {action:'resume',canResume:true,execution:restored.execution};
}
function progressionDecision(history,target){
 if(!Array.isArray(history)||history.length<2)return {action:'repeat',reason:'Need at least two comparable performances'};
 const recent=history.slice(-2);
 const top=target?.reps?.[1]||10;
 const allTop=recent.every(session=>session.reps?.length&&session.reps.every(r=>r>=top));
 if(allTop)return {action:'progress',reason:'Top of rep range achieved across two sessions'};
 const below=recent.every(session=>session.reps?.length&&session.reps.some(r=>r<(target?.reps?.[0]||8)));
 if(below)return {action:'review',reason:'Below target range across two sessions'};
 return {action:'maintain',reason:'Performance remains within progression range'};
}

const API={TAXONOMY,EXERCISES,STRETCHES,MOBILITY,CONDITIONING,WEEK_MODELS,EXECUTION_STATES,normalizeProfile,buildStrategy,stretchTargets,expandStretchActivity,movementStageDuration,buildMovementSession,buildStretchSession,buildMobilitySession,buildConditioningSession,substitutionsFor,substitutionOptions,weeklyMuscleTargets,weeklyMuscleVolume,volumeAudit,rebalancePriorityVolume,interpretPostWorkoutFeedback,createSchedule,transitionScheduleEntry,buildProgram,validateProgram,readinessDecision,applyReadiness,muscleVolume,ingestPerformance,compressSession,adaptationDecision,createProgramVersion,createWorkoutExecution,executionTransition,recordSet,startRest,restRemaining,finishRest,previewNextExercise,navigateExercise,canAdvanceExercise,advanceExercise,substituteDuringWorkout,executionSnapshot,resumeExecution,completeWarmupStep,completeStretchStep,completionPayload,serializeExecution,restoreExecution,guardedExecutionWrite,recoverExecution,progressionDecision};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.GoWorkoutProgramEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
