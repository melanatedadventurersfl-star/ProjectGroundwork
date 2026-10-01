(function(){
  const CANVAS={width:1000,height:1800}
  const INTENSITY={
    1:{label:'Light',color:'#6f9f69',opacity:.34,glow:8},
    2:{label:'Moderate',color:'#86c966',opacity:.48,glow:14},
    3:{label:'High',color:'#b7eb5c',opacity:.62,glow:20},
    4:{label:'Very high',color:'#efc75c',opacity:.72,glow:26}
  }
  const REGIONS={
    front:[
      {id:'chest',label:'Chest'},
      {id:'shoulders',label:'Shoulders'},
      {id:'biceps',label:'Biceps'},
      {id:'forearms',label:'Forearms'},
      {id:'core',label:'Core'},
      {id:'quads',label:'Quads'},
      {id:'adductors',label:'Adductors'},
      {id:'calves',label:'Calves'}
    ],
    back:[
      {id:'traps',label:'Traps'},
      {id:'rear_delts',label:'Rear delts'},
      {id:'upper_back',label:'Upper back'},
      {id:'lats',label:'Lats'},
      {id:'triceps',label:'Triceps'},
      {id:'forearms',label:'Forearms'},
      {id:'lower_back',label:'Lower back'},
      {id:'glutes',label:'Glutes'},
      {id:'hamstrings',label:'Hamstrings'},
      {id:'calves',label:'Calves'}
    ]
  }
  function assetName({variant='male',view,region,level}){
    return variant+'-'+view+'-'+region+'-'+level+'.png'
  }
  function maskName({variant='male',view,region}){
    return variant+'-'+view+'-'+region+'-master-mask.png'
  }
  window.GoWorkoutAnatomyRegions={
    canvas:CANVAS,
    intensities:INTENSITY,
    regions:REGIONS,
    assetName,
    maskName
  }
})()