window.EXERCISE_CATALOG = [
  {id:'goblet-squat',name:'Goblet Squat',movement:'squat',muscles:['Quads','Glutes'],equipment:['dumbbells','full-gym','mixed-home'],style:'free',difficulty:'beginner',loadMode:'dumbbell',baseLoadFactor:.12,increment:5,referenceKey:'squat',referenceMultiplier:.28,setup:35},
  {id:'back-squat',name:'Barbell Back Squat',movement:'squat',muscles:['Quads','Glutes','Core'],equipment:['full-gym'],style:'free',difficulty:'intermediate',loadMode:'barbell',baseLoadFactor:.38,increment:5,referenceKey:'squat',referenceMultiplier:.82,setup:70},
  {id:'leg-press',name:'Leg Press',movement:'squat',muscles:['Quads','Glutes'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.65,increment:10,referenceKey:'squat',referenceMultiplier:1.25,setup:40},
  {id:'bodyweight-squat',name:'Bodyweight Squat',movement:'squat',muscles:['Quads','Glutes'],equipment:['bodyweight','dumbbells','bands','mixed-home','full-gym'],style:'bodyweight',difficulty:'beginner',loadMode:'bodyweight',increment:0,setup:20},

  {id:'romanian-deadlift',name:'Romanian Deadlift',movement:'hinge',muscles:['Hamstrings','Glutes','Back'],equipment:['full-gym'],style:'free',difficulty:'intermediate',loadMode:'barbell',baseLoadFactor:.34,increment:5,referenceKey:'deadlift',referenceMultiplier:.62,setup:55},
  {id:'db-rdl',name:'Dumbbell Romanian Deadlift',movement:'hinge',muscles:['Hamstrings','Glutes'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.10,increment:5,referenceKey:'deadlift',referenceMultiplier:.18,setup:35},
  {id:'hip-thrust',name:'Hip Thrust',movement:'hinge',muscles:['Glutes','Hamstrings'],equipment:['full-gym'],style:'free',difficulty:'beginner',loadMode:'barbell',baseLoadFactor:.42,increment:5,referenceKey:'deadlift',referenceMultiplier:.72,setup:65},
  {id:'glute-bridge',name:'Glute Bridge',movement:'hinge',muscles:['Glutes','Hamstrings'],equipment:['bodyweight','dumbbells','bands','mixed-home','full-gym'],style:'bodyweight',difficulty:'beginner',loadMode:'bodyweight',increment:0,setup:20},

  {id:'split-squat',name:'Bulgarian Split Squat',movement:'single-leg',muscles:['Quads','Glutes'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'intermediate',loadMode:'dumbbell-pair',baseLoadFactor:.07,increment:5,referenceKey:'squat',referenceMultiplier:.14,setup:45},
  {id:'reverse-lunge',name:'Reverse Lunge',movement:'single-leg',muscles:['Quads','Glutes'],equipment:['bodyweight','dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.06,increment:5,referenceKey:'squat',referenceMultiplier:.12,setup:30},
  {id:'step-up',name:'Step-Up',movement:'single-leg',muscles:['Quads','Glutes'],equipment:['bodyweight','dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.06,increment:5,referenceKey:'squat',referenceMultiplier:.12,setup:30},

  {id:'bench-press',name:'Barbell Bench Press',movement:'horizontal-push',muscles:['Chest','Triceps','Front Delts'],equipment:['full-gym'],style:'free',difficulty:'intermediate',loadMode:'barbell',baseLoadFactor:.32,increment:5,referenceKey:'bench',referenceMultiplier:.88,setup:60},
  {id:'db-bench',name:'Dumbbell Bench Press',movement:'horizontal-push',muscles:['Chest','Triceps'],equipment:['dumbbells','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.09,increment:5,referenceKey:'bench',referenceMultiplier:.20,setup:40},
  {id:'db-floor-press',name:'Dumbbell Floor Press',movement:'horizontal-push',muscles:['Chest','Triceps'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.08,increment:5,referenceKey:'bench',referenceMultiplier:.18,setup:30},
  {id:'chest-press-machine',name:'Chest Press Machine',movement:'horizontal-push',muscles:['Chest','Triceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.28,increment:5,referenceKey:'bench',referenceMultiplier:.72,setup:25},
  {id:'push-up',name:'Push-Up',movement:'horizontal-push',muscles:['Chest','Triceps','Core'],equipment:['bodyweight','dumbbells','bands','mixed-home','full-gym'],style:'bodyweight',difficulty:'beginner',loadMode:'bodyweight',increment:0,setup:15},

  {id:'cable-row',name:'Seated Cable Row',movement:'horizontal-pull',muscles:['Back','Biceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.26,increment:5,referenceKey:'row',referenceMultiplier:1,setup:25},
  {id:'chest-row',name:'Chest-Supported Row',movement:'horizontal-pull',muscles:['Back','Biceps'],equipment:['dumbbells','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.08,increment:5,referenceKey:'row',referenceMultiplier:.35,setup:35},
  {id:'one-arm-row',name:'One-Arm Dumbbell Row',movement:'horizontal-pull',muscles:['Back','Biceps'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell',baseLoadFactor:.11,increment:5,referenceKey:'row',referenceMultiplier:.42,setup:25},
  {id:'band-row',name:'Band Row',movement:'horizontal-pull',muscles:['Back','Biceps'],equipment:['bands','mixed-home'],style:'band',difficulty:'beginner',loadMode:'band',increment:0,setup:20},

  {id:'lat-pulldown',name:'Lat Pulldown',movement:'vertical-pull',muscles:['Lats','Biceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.28,increment:5,referenceKey:'row',referenceMultiplier:1.05,setup:25},
  {id:'assisted-pullup',name:'Assisted Pull-Up',movement:'vertical-pull',muscles:['Lats','Biceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'assisted',increment:5,setup:35},
  {id:'pull-up',name:'Pull-Up',movement:'vertical-pull',muscles:['Lats','Biceps','Core'],equipment:['bodyweight','mixed-home','full-gym'],style:'bodyweight',difficulty:'intermediate',loadMode:'bodyweight',increment:0,setup:20},
  {id:'band-pulldown',name:'Band Lat Pulldown',movement:'vertical-pull',muscles:['Lats','Biceps'],equipment:['bands','mixed-home'],style:'band',difficulty:'beginner',loadMode:'band',increment:0,setup:25},

  {id:'shoulder-press-machine',name:'Shoulder Press Machine',movement:'vertical-push',muscles:['Shoulders','Triceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.18,increment:5,referenceKey:'overhead',referenceMultiplier:.85,setup:25},
  {id:'db-shoulder-press',name:'Dumbbell Shoulder Press',movement:'vertical-push',muscles:['Shoulders','Triceps'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.055,increment:5,referenceKey:'overhead',referenceMultiplier:.32,setup:30},
  {id:'overhead-press',name:'Barbell Overhead Press',movement:'vertical-push',muscles:['Shoulders','Triceps'],equipment:['full-gym'],style:'free',difficulty:'intermediate',loadMode:'barbell',baseLoadFactor:.20,increment:5,referenceKey:'overhead',referenceMultiplier:.9,setup:45},
  {id:'pike-pushup',name:'Pike Push-Up',movement:'vertical-push',muscles:['Shoulders','Triceps'],equipment:['bodyweight','mixed-home'],style:'bodyweight',difficulty:'intermediate',loadMode:'bodyweight',increment:0,setup:15},

  {id:'leg-curl',name:'Leg Curl',movement:'hamstring-accessory',muscles:['Hamstrings'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.20,increment:5,setup:20},
  {id:'leg-extension',name:'Leg Extension',movement:'quad-accessory',muscles:['Quads'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.22,increment:5,setup:20},
  {id:'lateral-raise',name:'Dumbbell Lateral Raise',movement:'shoulder-accessory',muscles:['Shoulders'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.025,increment:5,setup:15},
  {id:'band-lateral-raise',name:'Band Lateral Raise',movement:'shoulder-accessory',muscles:['Shoulders'],equipment:['bands','mixed-home'],style:'band',difficulty:'beginner',loadMode:'band',increment:0,setup:15},
  {id:'biceps-curl',name:'Dumbbell Curl',movement:'biceps',muscles:['Biceps'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.035,increment:5,setup:15},
  {id:'cable-curl',name:'Cable Curl',movement:'biceps',muscles:['Biceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.09,increment:5,setup:15},
  {id:'triceps-pushdown',name:'Triceps Pushdown',movement:'triceps',muscles:['Triceps'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.10,increment:5,setup:15},
  {id:'db-triceps-extension',name:'Overhead Dumbbell Triceps Extension',movement:'triceps',muscles:['Triceps'],equipment:['dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell',baseLoadFactor:.07,increment:5,setup:20},
  {id:'calf-raise',name:'Standing Calf Raise',movement:'calves',muscles:['Calves'],equipment:['bodyweight','dumbbells','mixed-home','full-gym'],style:'free',difficulty:'beginner',loadMode:'dumbbell-pair',baseLoadFactor:.08,increment:5,setup:15},
  {id:'plank',name:'Plank',movement:'core',muscles:['Core'],equipment:['bodyweight','dumbbells','bands','mixed-home','full-gym'],style:'bodyweight',difficulty:'beginner',loadMode:'timed',increment:0,setup:10},
  {id:'dead-bug',name:'Dead Bug',movement:'core',muscles:['Core'],equipment:['bodyweight','mixed-home','full-gym'],style:'bodyweight',difficulty:'beginner',loadMode:'bodyweight',increment:0,setup:10},
  {id:'cable-crunch',name:'Cable Crunch',movement:'core',muscles:['Core'],equipment:['full-gym'],style:'machine',difficulty:'beginner',loadMode:'machine',baseLoadFactor:.16,increment:5,setup:20},
  {id:'prone-w-raise',name:'Prone W Raise',movement:'horizontal-pull',muscles:['Upper Back','Rear Delts'],equipment:['bodyweight','bands','mixed-home'],style:'bodyweight',difficulty:'beginner',loadMode:'bodyweight',increment:0,setup:15},
  {id:'prone-lat-pull',name:'Prone Lat Pull-Down',movement:'vertical-pull',muscles:['Lats','Upper Back'],equipment:['bodyweight','bands','mixed-home'],style:'bodyweight',difficulty:'beginner',loadMode:'bodyweight',increment:0,setup:15},
  {id:'band-overhead-press',name:'Band Overhead Press',movement:'vertical-push',muscles:['Shoulders','Triceps'],equipment:['bands','mixed-home'],style:'band',difficulty:'beginner',loadMode:'band',increment:0,setup:20}
];

window.EXERCISE_MOVEMENTS = {
  'squat':'Squat / knee dominant','hinge':'Hip hinge','single-leg':'Single-leg',
  'horizontal-push':'Horizontal push','horizontal-pull':'Horizontal pull',
  'vertical-push':'Vertical push','vertical-pull':'Vertical pull',
  'hamstring-accessory':'Hamstrings','quad-accessory':'Quads',
  'shoulder-accessory':'Shoulders','biceps':'Biceps','triceps':'Triceps',
  'calves':'Calves','core':'Core'
};

/*
 * Exercise imagery is sourced from the public-domain Free Exercise DB.
 * Paths point at the repository's exercise image folders. If a specific
 * match fails to load, app.js falls back to a movement-level image.
 */
window.EXERCISE_MEDIA = {
  'goblet-squat': {sourceId:'Goblet_Squat',verified:true},
  'back-squat': {sourceId:'Barbell_Squat',verified:true},
  'leg-press': {sourceId:'Leg_Press',verified:true},
  'bodyweight-squat': {sourceId:'Bodyweight_Squat',verified:true},
  'romanian-deadlift': {sourceId:'Romanian_Deadlift_from_Deficit',verified:true},
  'db-rdl': {sourceId:'Stiff-Legged_Dumbbell_Deadlift',verified:true},
  'hip-thrust': {sourceId:'Barbell_Hip_Thrust',verified:true},
  'glute-bridge': {sourceId:'Butt_Lift_Bridge',verified:true},
  'split-squat': {sourceId:'Split_Squat_with_Dumbbells',verified:true},
  'reverse-lunge': {sourceId:'Dumbbell_Rear_Lunge',verified:true},
  'step-up': {sourceId:'Dumbbell_Step_Ups',verified:true},
  'bench-press': {sourceId:'Barbell_Bench_Press_-_Medium_Grip',verified:true},
  'db-bench': {sourceId:'Dumbbell_Bench_Press',verified:true},
  'db-floor-press': {sourceId:'Dumbbell_Floor_Press',verified:true},
  'chest-press-machine': {sourceId:'Machine_Bench_Press',verified:true},
  'push-up': {sourceId:'Pushups',verified:true},
  'cable-row': {sourceId:'Seated_Cable_Rows',verified:true},
  'chest-row': {sourceId:'Dumbbell_Incline_Row',verified:true},
  'one-arm-row': {sourceId:'One-Arm_Dumbbell_Row',verified:true},
  'lat-pulldown': {sourceId:'Wide-Grip_Lat_Pulldown',verified:true},
  'assisted-pullup': {sourceId:'Assisted_Chin-Up',verified:true},
  'pull-up': {sourceId:'Pullups',verified:true},
  'shoulder-press-machine': {sourceId:'Machine_Shoulder_Military_Press',verified:true},
  'db-shoulder-press': {sourceId:'Dumbbell_Shoulder_Press',verified:true},
  'overhead-press': {sourceId:'Standing_Military_Press',verified:true},
  'leg-curl': {sourceId:'Lying_Leg_Curls',verified:true},
  'leg-extension': {sourceId:'Leg_Extensions',verified:true},
  'lateral-raise': {sourceId:'Side_Lateral_Raise',verified:true},
  'band-lateral-raise': {sourceId:'Lateral_Raise_-_With_Bands',verified:true},
  'biceps-curl': {sourceId:'Dumbbell_Bicep_Curl',verified:true},
  'cable-curl': {sourceId:'High_Cable_Curls',verified:true},
  'triceps-pushdown': {sourceId:'Triceps_Pushdown',verified:true},
  'db-triceps-extension': {sourceId:'Standing_Dumbbell_Triceps_Extension',verified:true},
  'calf-raise': {sourceId:'Standing_Calf_Raises',verified:true},
  'plank': {sourceId:'Plank',verified:true},
  'dead-bug': {sourceId:'Dead_Bug',verified:true},
  'cable-crunch': {sourceId:'Cable_Crunch',verified:true},
  'band-overhead-press': {sourceId:'Shoulder_Press_-_With_Bands',verified:true}
};

window.EXERCISE_MEDIA_FALLBACKS = {
  'squat':'Barbell_Squat',
  'hinge':'Barbell_Deadlift',
  'single-leg':'Dumbbell_Step_Ups',
  'horizontal-push':'Dumbbell_Bench_Press',
  'horizontal-pull':'Seated_Cable_Rows',
  'vertical-pull':'Wide-Grip_Lat_Pulldown',
  'vertical-push':'Dumbbell_Shoulder_Press',
  'hamstring-accessory':'Lying_Leg_Curls',
  'quad-accessory':'Leg_Extensions',
  'shoulder-accessory':'Side_Lateral_Raise',
  'biceps':'Alternate_Hammer_Curl',
  'triceps':'Triceps_Pushdown',
  'calves':'Standing_Calf_Raises',
  'core':'Plank'
};

