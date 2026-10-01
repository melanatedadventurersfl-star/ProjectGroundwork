(function(){
  const SCHEMA=[
    'chest','front_delts','side_delts','rear_delts','biceps','triceps','forearms',
    'upper_abs','lower_abs','obliques','traps','upper_back','lats','lower_back',
    'glutes','adductors','quads','hamstrings','calves'
  ];
  const LANDMARKS={
    male:{
      head:{x:160,y:43},
      shoulders:{left:{x:73,y:128},right:{x:247,y:128}},
      sternum:{x:160,y:140},
      navel:{x:160,y:244},
      iliac:{left:{x:111,y:292},right:{x:209,y:292}},
      elbows:{left:{x:54,y:239},right:{x:266,y:239}},
      wrists:{left:{x:32,y:324},right:{x:288,y:324}},
      knees:{left:{x:111,y:432},right:{x:209,y:432}},
      ankles:{left:{x:104,y:523},right:{x:216,y:523}},
      heel:{y:548}
    }
  };
  const DEBUG_PRESETS={
    none:{},
    lower:{quads:3,glutes:4,hamstrings:3,calves:2,adductors:1},
    push:{chest:4,front_delts:3,side_delts:2,triceps:3},
    pull:{lats:4,upper_back:3,traps:2,rear_delts:3,biceps:3},
    full:{chest:2,front_delts:2,side_delts:2,biceps:1,triceps:1,upper_abs:2,lower_abs:1,obliques:1,lats:2,upper_back:2,glutes:3,quads:3,hamstrings:2,calves:1}
  };
  const clampLevel=value=>Math.max(0,Math.min(4,Number(value)||0));
  const resolveLevel=(levels,group,side)=>{
    const sideKey=side?group+'_'+side:'';
    if(sideKey&&levels?.[sideKey]!==undefined)return clampLevel(levels[sideKey]);
    return clampLevel(levels?.[group]);
  };
  const defs=prefix=>
    '<defs>'+
      '<linearGradient id="'+prefix+'Body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1712"/><stop offset=".24" stop-color="#34463b"/><stop offset=".52" stop-color="#22352a"/><stop offset=".82" stop-color="#17261e"/><stop offset="1" stop-color="#0b130f"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Muscle" x1="0" y1="0" x2=".95" y2="1"><stop offset="0" stop-color="#5a695f"/><stop offset=".18" stop-color="#3f5146"/><stop offset=".48" stop-color="#2b4034"/><stop offset=".78" stop-color="#1d3026"/><stop offset="1" stop-color="#122019"/></linearGradient>'+
      '<radialGradient id="'+prefix+'Head" cx=".43" cy=".30" r=".78"><stop offset="0" stop-color="#4a5c50"/><stop offset=".46" stop-color="#2b3d32"/><stop offset="1" stop-color="#111b16"/></radialGradient>'+
      '<linearGradient id="'+prefix+'Heat1" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#7e9b73"/><stop offset=".52" stop-color="#527957"/><stop offset="1" stop-color="#36553e"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat2" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#b3d97e"/><stop offset=".48" stop-color="#78ae5d"/><stop offset="1" stop-color="#4f7f45"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat3" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#e0f894"/><stop offset=".44" stop-color="#a9df59"/><stop offset="1" stop-color="#77b644"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat4" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#ffe89a"/><stop offset=".42" stop-color="#efc65c"/><stop offset="1" stop-color="#b9882c"/></linearGradient>'+
    '</defs>';

  function muscle(prefix,levels,group,side,d,detail=''){
    const level=resolveLevel(levels,group,side);
    const id=group+(side?'_'+side:'');
    const overlay=level
      ?'<path class="anatomy-heat-overlay heat-'+level+'" style="fill:url(#'+prefix+'Heat'+level+')" d="'+d+'"/>'
      :'';
    return '<g class="anatomy-region region-'+group+' side-'+(side||'center')+'" data-muscle="'+id+'" data-group="'+group+'" data-side="'+(side||'center')+'" data-heat="'+level+'">'+
      '<path class="anatomy-muscle-base" style="fill:url(#'+prefix+'Muscle)" d="'+d+'"/>'+overlay+detail+
    '</g>';
  }
  const line=(cls,d)=>'<path class="'+cls+'" d="'+d+'"/>';

  function maleFront(levels={}){
    const p='m3f',m=(group,side,d,detail='')=>muscle(p,levels,group,side,d,detail);
    return '<svg class="home-anatomy-svg anatomy-pro anatomy-male anatomy-v3 front" viewBox="0 0 320 570" role="img" aria-label="Front male muscular anatomy training load">'+
      defs(p)+
      '<ellipse class="anatomy-ground" cx="160" cy="549" rx="74" ry="8"/>'+
      '<path class="anatomy-body-shell" style="fill:url(#m3fBody)" d="M136 72C127 84 124 95 124 109L108 118C88 123 68 134 56 151 45 170 41 194 38 217L27 268 17 307 31 313 49 275 63 226 72 186 79 163 82 215 76 267 81 307 76 352 80 405 85 468 92 520 105 538 125 536 134 474 143 400 151 339 160 325 169 339 177 400 186 474 195 536 215 538 228 520 235 468 240 405 244 352 239 307 244 267 238 215 241 163 248 186 257 226 271 275 289 313 303 307 293 268 282 217C279 194 275 170 264 151 252 134 232 123 212 118L196 109C196 95 193 84 184 72Z"/>'+
      '<path class="anatomy-head-shell" style="fill:url(#m3fHead)" d="M137 19C146 7 174 7 183 19 190 29 190 49 185 62 179 75 170 82 160 83 150 82 141 75 135 62 130 49 130 29 137 19Z"/>'+
      '<path class="anatomy-jaw" d="M141 54C147 65 153 70 160 71 167 70 173 65 179 54 175 72 169 82 160 84 151 82 145 72 141 54Z"/>'+
      '<path class="anatomy-neck-shell" d="M139 76C143 88 142 99 132 111L118 124 133 135 160 123 187 135 202 124 188 111C178 99 177 88 181 76 174 84 168 88 160 89 152 88 146 84 139 76Z"/>'+

      m('front_delts','left','M126 113C108 107 89 112 74 125 66 132 61 142 59 153 76 147 92 150 105 160L129 143C137 132 136 121 126 113Z')+
      m('front_delts','right','M194 113C212 107 231 112 246 125 254 132 259 142 261 153 244 147 228 150 215 160L191 143C183 132 184 121 194 113Z')+
      m('side_delts','left','M75 124C63 133 57 146 58 160 61 171 68 179 78 184 86 170 91 156 91 142 87 132 82 126 75 124Z')+
      m('side_delts','right','M245 124C257 133 263 146 262 160 259 171 252 179 242 184 234 170 229 156 229 142 233 132 238 126 245 124Z')+

      m('chest','left','M130 125C111 119 92 123 80 137 78 150 81 164 88 175 105 185 126 183 154 170L154 138C149 131 141 127 130 125Z',line('anatomy-detail-fine','M91 143C108 136 130 137 151 145M92 169C111 176 130 175 151 166'))+
      m('chest','right','M190 125C209 119 228 123 240 137 242 150 239 164 232 175 215 185 194 183 166 170L166 138C171 131 179 127 190 125Z',line('anatomy-detail-fine','M229 143C212 136 190 137 169 145M228 169C209 176 190 175 169 166'))+
      line('anatomy-separator','M160 128V181')+

      m('biceps','left','M80 158C68 165 61 181 59 202 58 220 64 239 75 250 87 239 94 216 93 192 92 176 88 165 80 158Z',line('anatomy-detail-fine','M72 172C66 192 67 219 75 238'))+
      m('biceps','right','M240 158C252 165 259 181 261 202 262 220 256 239 245 250 233 239 226 216 227 192 228 176 232 165 240 158Z',line('anatomy-detail-fine','M248 172C254 192 253 219 245 238'))+
      m('forearms','left','M60 207C50 229 44 255 39 284L29 316 42 322 57 295 72 248 76 226C73 217 68 211 60 207Z')+
      m('forearms','right','M260 207C270 229 276 255 281 284L291 316 278 322 263 295 248 248 244 226C247 217 252 211 260 207Z')+
      '<path class="anatomy-hand" d="M29 315 18 339 20 352 26 348 31 359 36 355 40 363 45 355 42 324Z"/>'+
      '<path class="anatomy-hand" d="M291 315 302 339 300 352 294 348 289 359 284 355 280 363 275 355 278 324Z"/>'+

      m('upper_abs','left','M128 185C136 181 146 181 154 186L153 211C146 218 137 218 129 212Z')+
      m('upper_abs','right','M166 186C174 181 184 181 192 185L191 212C183 218 174 218 167 211Z')+
      m('upper_abs','left','M130 214C137 211 146 211 153 216L152 240C145 247 137 247 131 241Z')+
      m('upper_abs','right','M167 216C174 211 183 211 190 214L189 241C183 247 175 247 168 240Z')+
      m('lower_abs','left','M132 243C139 240 146 241 152 246L151 270C145 277 139 277 133 271Z')+
      m('lower_abs','right','M168 246C174 241 181 240 188 243L187 271C181 277 175 277 169 270Z')+
      m('obliques','left','M102 179C113 184 121 196 125 213L129 264 116 290C104 278 96 260 92 238L94 202C96 191 99 183 102 179Z',line('anatomy-detail-fine','M102 193C111 207 115 228 115 252'))+
      m('obliques','right','M218 179C207 184 199 196 195 213L191 264 204 290C216 278 224 260 228 238L226 202C224 191 221 183 218 179Z',line('anatomy-detail-fine','M218 193C209 207 205 228 205 252'))+
      line('anatomy-ridge','M160 184V278')+

      m('adductors','left','M131 289C141 284 150 291 154 307L151 351 140 378 130 355 125 321C125 306 127 295 131 289Z')+
      m('adductors','right','M189 289C179 284 170 291 166 307L169 351 180 378 190 355 195 321C195 306 193 295 189 289Z')+
      m('quads','left','M102 291C116 284 132 288 142 301L137 348C134 378 125 407 112 426 97 414 89 390 87 360L89 322C92 307 96 297 102 291Z',line('anatomy-detail-fine','M104 306C111 326 112 352 108 382'))+
      m('quads','right','M218 291C204 284 188 288 178 301L183 348C186 378 195 407 208 426 223 414 231 390 233 360L231 322C228 307 224 297 218 291Z',line('anatomy-detail-fine','M216 306C209 326 208 352 212 382'))+
      m('quads','left','M142 302C150 294 157 300 158 312L156 362C153 387 148 407 140 425 132 412 129 394 130 370L133 326C135 315 138 307 142 302Z')+
      m('quads','right','M178 302C170 294 163 300 162 312L164 362C167 387 172 407 180 425 188 412 191 394 190 370L187 326C185 315 182 307 178 302Z')+
      '<path class="anatomy-knee" d="M107 426C115 419 127 420 134 429L132 444C125 451 115 451 108 443Z"/>'+
      '<path class="anatomy-knee" d="M213 426C205 419 193 420 186 429L188 444C195 451 205 451 212 443Z"/>'+

      m('calves','left','M100 444C113 441 124 452 129 471 130 492 124 512 114 526L99 522C91 506 89 484 92 463 94 454 97 448 100 444Z',line('anatomy-detail-fine','M104 456C111 473 111 493 106 512'))+
      m('calves','right','M220 444C207 441 196 452 191 471 190 492 196 512 206 526L221 522C229 506 231 484 228 463 226 454 223 448 220 444Z',line('anatomy-detail-fine','M216 456C209 473 209 493 214 512'))+
      '<path class="anatomy-foot" d="M94 519C105 523 116 527 124 535L118 545 86 544 82 533Z"/>'+
      '<path class="anatomy-foot" d="M226 519C215 523 204 527 196 535L202 545 234 544 238 533Z"/>'+

      line('anatomy-line','M99 125C116 111 139 108 154 118M221 125C204 111 181 108 166 118M105 291C123 301 141 303 153 297M215 291C197 301 179 303 167 297M91 439C104 447 119 448 131 441M229 439C216 447 201 448 189 441')+
    '</svg>';
  }

  function maleBack(levels={}){
    const p='m3b',m=(group,side,d,detail='')=>muscle(p,levels,group,side,d,detail);
    return '<svg class="home-anatomy-svg anatomy-pro anatomy-male anatomy-v3 back" viewBox="0 0 320 570" role="img" aria-label="Back male muscular anatomy training load">'+
      defs(p)+
      '<ellipse class="anatomy-ground" cx="160" cy="549" rx="74" ry="8"/>'+
      '<path class="anatomy-body-shell" style="fill:url(#m3bBody)" d="M136 72C127 84 124 95 124 109L108 118C88 123 68 134 56 151 45 170 41 194 38 217L27 268 17 307 31 313 49 275 63 226 72 186 79 163 82 215 76 267 81 307 76 352 80 405 85 468 92 520 105 538 125 536 134 474 143 400 151 339 160 325 169 339 177 400 186 474 195 536 215 538 228 520 235 468 240 405 244 352 239 307 244 267 238 215 241 163 248 186 257 226 271 275 289 313 303 307 293 268 282 217C279 194 275 170 264 151 252 134 232 123 212 118L196 109C196 95 193 84 184 72Z"/>'+
      '<path class="anatomy-head-shell" style="fill:url(#m3bHead)" d="M137 19C146 7 174 7 183 19 190 29 190 49 185 62 179 75 170 82 160 83 150 82 141 75 135 62 130 49 130 29 137 19Z"/>'+
      '<path class="anatomy-neck-shell" d="M139 76C143 88 142 99 132 111L118 124 133 135 160 123 187 135 202 124 188 111C178 99 177 88 181 76 174 84 168 88 160 89 152 88 146 84 139 76Z"/>'+

      m('traps','left','M135 96C143 102 152 112 160 126L153 160 131 148 111 118 126 104Z')+
      m('traps','right','M185 96C177 102 168 112 160 126L167 160 189 148 209 118 194 104Z')+
      m('rear_delts','left','M119 113C100 106 81 112 66 127 60 134 58 143 59 153 78 145 96 149 111 160L135 139C134 127 129 119 119 113Z')+
      m('rear_delts','right','M201 113C220 106 239 112 254 127 260 134 262 143 261 153 242 145 224 149 209 160L185 139C186 127 191 119 201 113Z')+

      m('upper_back','left','M129 143C116 141 102 147 91 159L98 194 119 214 145 196 147 167C141 155 135 147 129 143Z',line('anatomy-detail-fine','M101 161C114 169 128 176 142 179'))+
      m('upper_back','right','M191 143C204 141 218 147 229 159L222 194 201 214 175 196 173 167C179 155 185 147 191 143Z',line('anatomy-detail-fine','M219 161C206 169 192 176 178 179'))+
      m('lats','left','M98 177C87 187 81 202 82 222 89 248 102 271 119 288L145 251 145 198C131 205 115 199 98 177Z',line('anatomy-detail-fine','M94 205C106 226 118 246 131 263'))+
      m('lats','right','M222 177C233 187 239 202 238 222 231 248 218 271 201 288L175 251 175 198C189 205 205 199 222 177Z',line('anatomy-detail-fine','M226 205C214 226 202 246 189 263'))+
      line('anatomy-ridge','M160 126V291')+

      m('triceps','left','M76 152C64 161 58 179 59 202 60 220 66 238 76 249 88 237 94 214 93 190 92 173 86 159 76 152Z')+
      m('triceps','right','M244 152C256 161 262 179 261 202 260 220 254 238 244 249 232 237 226 214 227 190 228 173 234 159 244 152Z')+
      m('forearms','left','M60 207C50 229 44 255 39 284L29 316 42 322 57 295 72 248 76 226C73 217 68 211 60 207Z')+
      m('forearms','right','M260 207C270 229 276 255 281 284L291 316 278 322 263 295 248 248 244 226C247 217 252 211 260 207Z')+
      '<path class="anatomy-hand" d="M29 315 18 339 20 352 26 348 31 359 36 355 40 363 45 355 42 324Z"/>'+
      '<path class="anatomy-hand" d="M291 315 302 339 300 352 294 348 289 359 284 355 280 363 275 355 278 324Z"/>'+

      m('lower_back','left','M119 267C131 278 144 288 155 301L151 326 132 341 109 324 101 296Z')+
      m('lower_back','right','M201 267C189 278 176 288 165 301L169 326 188 341 211 324 219 296Z')+

      m('glutes','left','M101 326C117 315 139 316 156 331L156 371C146 389 126 396 104 386 91 379 85 364 87 347 90 337 95 330 101 326Z',line('anatomy-detail-fine','M96 345C113 355 134 357 153 348'))+
      m('glutes','right','M219 326C203 315 181 316 164 331L164 371C174 389 194 396 216 386 229 379 235 364 233 347 230 337 225 330 219 326Z',line('anatomy-detail-fine','M224 345C207 355 186 357 167 348'))+
      line('anatomy-separator','M160 330V384')+

      m('hamstrings','left','M96 388C112 383 130 389 144 403L140 451C136 476 126 500 112 517 96 507 87 487 83 462L83 418C85 404 90 394 96 388Z',line('anatomy-detail-fine','M102 405C110 428 112 455 107 483'))+
      m('hamstrings','right','M224 388C208 383 190 389 176 403L180 451C184 476 194 500 208 517 224 507 233 487 237 462L237 418C235 404 230 394 224 388Z',line('anatomy-detail-fine','M218 405C210 428 208 455 213 483'))+
      m('hamstrings','left','M144 399C152 393 159 398 159 411L156 460 144 507 132 487 135 443Z')+
      m('hamstrings','right','M176 399C168 393 161 398 161 411L164 460 176 507 188 487 185 443Z')+

      m('calves','left','M99 493C111 489 124 498 129 515L126 535 113 543 99 537 91 519C91 507 94 498 99 493Z')+
      m('calves','right','M221 493C209 489 196 498 191 515L194 535 207 543 221 537 229 519C229 507 226 498 221 493Z')+
      '<path class="anatomy-foot" d="M96 533C106 536 116 539 124 546L118 553 87 552 83 542Z"/>'+
      '<path class="anatomy-foot" d="M224 533C214 536 204 539 196 546L202 553 233 552 237 542Z"/>'+

      line('anatomy-line','M93 154C111 164 130 169 147 164M227 154C209 164 190 169 173 164M102 326C121 339 141 341 155 334M218 326C199 339 179 341 165 334M91 386C113 399 133 401 146 394M229 386C207 399 187 401 174 394')+
    '</svg>';
  }

  const variants={male:{front:maleFront,back:maleBack}};
  function render(view,levels={},variant='male'){
    const renderer=variants[variant]?.[view]||variants.male[view];
    return renderer?renderer(levels):'';
  }
  function debugGrid(variant='male'){
    return Object.entries(DEBUG_PRESETS).map(([name,levels])=>({
      name,
      front:render('front',levels,variant),
      back:render('back',levels,variant)
    }));
  }

  window.GoWorkoutAnatomy={
    front:(levels,variant='male')=>render('front',levels,variant),
    back:(levels,variant='male')=>render('back',levels,variant),
    render,
    debugGrid,
    schema:SCHEMA.slice(),
    landmarks:LANDMARKS,
    debugPresets:DEBUG_PRESETS,
    variants:['male'],
    defaultVariant:'male'
  };
})();