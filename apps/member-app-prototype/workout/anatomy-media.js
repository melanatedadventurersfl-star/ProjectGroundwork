(function(){
  const clampLevel=value=>Math.max(0,Math.min(4,Number(value)||0));
  const region=(group,levels,prefix)=>{
    const level=clampLevel(levels?.[group]);
    return 'class="anatomy-muscle muscle-'+group+' heat-'+level+'" style="fill:url(#'+prefix+'Heat'+level+')"';
  };
  const defs=prefix=>
    '<defs>'+
      '<linearGradient id="'+prefix+'Body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101b15"/><stop offset=".30" stop-color="#34463b"/><stop offset=".58" stop-color="#1d3026"/><stop offset="1" stop-color="#0d1712"/></linearGradient>'+
      '<radialGradient id="'+prefix+'Head" cx=".48" cy=".34" r=".72"><stop offset="0" stop-color="#48594e"/><stop offset=".48" stop-color="#283a30"/><stop offset="1" stop-color="#101a15"/></radialGradient>'+
      '<linearGradient id="'+prefix+'Heat0" x1="0" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#4a5b50"/><stop offset=".38" stop-color="#31463a"/><stop offset=".72" stop-color="#24362c"/><stop offset="1" stop-color="#15231c"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat1" x1="0" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#6b8f69"/><stop offset=".45" stop-color="#527856"/><stop offset="1" stop-color="#34533d"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat2" x1="0" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#a1cf70"/><stop offset=".46" stop-color="#78ae5d"/><stop offset="1" stop-color="#4f7f45"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat3" x1="0" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#d4f27a"/><stop offset=".42" stop-color="#a9dd59"/><stop offset="1" stop-color="#79b746"/></linearGradient>'+
      '<linearGradient id="'+prefix+'Heat4" x1="0" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#ffe38a"/><stop offset=".42" stop-color="#efc65c"/><stop offset="1" stop-color="#bd8f31"/></linearGradient>'+
    '</defs>';

  function maleFront(levels={}){
    const p='mf',m=group=>region(group,levels,p);
    return '<svg class="home-anatomy-svg anatomy-pro anatomy-male front" viewBox="0 0 320 560" role="img" aria-label="Front male muscular anatomy training load">'+
      defs(p)+
      '<ellipse class="anatomy-ground" cx="160" cy="536" rx="76" ry="9"/>'+
      '<path class="anatomy-body male-body" style="fill:url(#mfBody)" d="M137 70C129 78 125 91 124 105L111 116C91 121 72 131 60 147 49 165 44 187 40 211L29 261 19 300 32 306 49 271 64 221 73 185 80 162 83 213 77 267 83 309 78 355 82 410 86 474 94 521 113 533 132 531 139 470 145 399 151 342 160 326 169 342 175 399 181 470 188 531 207 533 226 521 234 474 238 410 242 355 237 309 243 267 237 213 240 162 247 185 256 221 271 271 288 306 301 300 291 261 280 211C276 187 271 165 260 147 248 131 229 121 209 116L196 105C195 91 191 78 183 70Z"/>'+
      '<ellipse class="anatomy-head male-head" style="fill:url(#mfHead)" cx="160" cy="44" rx="29" ry="35"/>'+
      '<path class="anatomy-face-shade" d="M140 34C145 18 175 18 180 34 177 57 169 68 160 70 151 68 143 57 140 34Z"/>'+
      '<path class="anatomy-neck" d="M137 70C144 79 151 83 160 84 169 83 176 79 183 70L190 110 160 126 130 110Z"/>'+

      '<path '+m('shoulders')+' d="M130 111C108 105 88 110 72 126 66 132 62 141 60 151 76 145 91 148 104 158L132 139C139 129 139 118 130 111Z"/>'+
      '<path '+m('shoulders')+' d="M190 111C212 105 232 110 248 126 254 132 258 141 260 151 244 145 229 148 216 158L188 139C181 129 181 118 190 111Z"/>'+

      '<path '+m('chest')+' d="M132 124C110 118 91 123 80 139L84 171C98 185 119 187 153 170L154 135C148 130 141 126 132 124Z"/>'+
      '<path '+m('chest')+' d="M188 124C210 118 229 123 240 139L236 171C222 185 201 187 167 170L166 135C172 130 179 126 188 124Z"/>'+
      '<path class="anatomy-separator" d="M160 127V181M87 169C108 186 133 188 154 174M233 169C212 186 187 188 166 174"/>'+

      '<path '+m('biceps')+' d="M77 154C62 169 57 194 59 216 61 231 67 243 76 249 88 224 94 198 91 171 88 162 83 157 77 154Z"/>'+
      '<path '+m('biceps')+' d="M243 154C258 169 263 194 261 216 259 231 253 243 244 249 232 224 226 198 229 171 232 162 237 157 243 154Z"/>'+
      '<path '+m('forearms')+' d="M60 211C50 232 44 257 39 286L28 319 41 324 57 295 72 247 75 230C72 221 67 215 60 211Z"/>'+
      '<path '+m('forearms')+' d="M260 211C270 232 276 257 281 286L292 319 279 324 263 295 248 247 245 230C248 221 253 215 260 211Z"/>'+
      '<path class="anatomy-hand" d="M28 318 17 343 21 356 29 348 34 361 40 355 41 326Z"/>'+
      '<path class="anatomy-hand" d="M292 318 303 343 299 356 291 348 286 361 280 355 279 326Z"/>'+

      '<path '+m('core')+' d="M126 185C136 180 146 180 155 186L154 211C146 219 136 219 128 212Z"/>'+
      '<path '+m('core')+' d="M165 186C174 180 184 180 194 185L192 212C184 219 174 219 166 211Z"/>'+
      '<path '+m('core')+' d="M129 215C137 211 146 211 154 216L153 241C146 248 137 248 130 242Z"/>'+
      '<path '+m('core')+' d="M166 216C174 211 183 211 191 215L190 242C183 248 174 248 167 241Z"/>'+
      '<path '+m('core')+' d="M131 245C139 241 147 242 153 247L152 271C146 278 139 278 132 272Z"/>'+
      '<path '+m('core')+' d="M167 247C173 242 181 241 189 245L188 272C181 278 174 278 168 271Z"/>'+
      '<path '+m('core')+' d="M101 181C115 188 123 199 126 216L129 267 117 289C104 277 96 259 93 236L95 202C96 193 98 186 101 181Z"/>'+
      '<path '+m('core')+' d="M219 181C205 188 197 199 194 216L191 267 203 289C216 277 224 259 227 236L225 202C224 193 222 186 219 181Z"/>'+
      '<path class="anatomy-ridge" d="M111 188C119 197 123 210 123 226M209 188C201 197 197 210 197 226M160 186V279"/>'+

      '<path '+m('quads')+' d="M103 294C120 286 137 291 148 305L143 352C138 381 129 408 115 426 99 410 91 385 89 357L91 320C94 307 98 299 103 294Z"/>'+
      '<path '+m('quads')+' d="M217 294C200 286 183 291 172 305L177 352C182 381 191 408 205 426 221 410 229 385 231 357L229 320C226 307 222 299 217 294Z"/>'+
      '<path '+m('quads')+' d="M143 302C151 294 158 299 159 311L157 361C154 386 149 407 140 425 131 410 128 392 130 368L133 325C135 314 138 306 143 302Z"/>'+
      '<path '+m('quads')+' d="M177 302C169 294 162 299 161 311L163 361C166 386 171 407 180 425 189 410 192 392 190 368L187 325C185 314 182 306 177 302Z"/>'+
      '<path '+m('quads')+' d="M94 309C105 305 116 313 122 328L118 371C114 392 108 407 101 415 92 403 88 384 88 360L89 331C90 321 92 314 94 309Z"/>'+
      '<path '+m('quads')+' d="M226 309C215 305 204 313 198 328L202 371C206 392 212 407 219 415 228 403 232 384 232 360L231 331C230 321 228 314 226 309Z"/>'+
      '<path class="anatomy-knee" d="M110 424C117 418 128 419 134 427L132 442C126 450 116 450 109 443Z"/>'+
      '<path class="anatomy-knee" d="M210 424C203 418 192 419 186 427L188 442C194 450 204 450 211 443Z"/>'+

      '<path '+m('calves')+' d="M101 443C114 441 125 452 130 470 131 489 125 510 115 524L99 521C91 504 89 483 92 462 94 453 97 447 101 443Z"/>'+
      '<path '+m('calves')+' d="M219 443C206 441 195 452 190 470 189 489 195 510 205 524L221 521C229 504 231 483 228 462 226 453 223 447 219 443Z"/>'+
      '<path '+m('calves')+' d="M132 449C139 455 141 468 139 485L133 522 116 524C125 506 129 489 128 470Z"/>'+
      '<path '+m('calves')+' d="M188 449C181 455 179 468 181 485L187 522 204 524C195 506 191 489 192 470Z"/>'+
      '<path class="anatomy-foot" d="M95 518C105 522 115 525 123 533L117 541 86 540 82 530Z"/>'+
      '<path class="anatomy-foot" d="M225 518C215 522 205 525 197 533L203 541 234 540 238 530Z"/>'+

      '<path class="anatomy-line" d="M160 111V283M105 181C125 192 144 194 154 185M215 181C195 192 176 194 166 185M102 292C122 306 141 309 154 302M218 292C198 306 179 309 166 302M92 438C104 446 119 447 130 441M228 438C216 446 201 447 190 441"/>'+
      '<path class="anatomy-highlight-line" d="M91 133C103 128 115 128 127 132M229 133C217 128 205 128 193 132M107 318C115 333 118 352 116 370M213 318C205 333 202 352 204 370M106 455C113 466 116 483 114 498M214 455C207 466 204 483 206 498"/>'+
    '</svg>';
  }

  function maleBack(levels={}){
    const p='mb',m=group=>region(group,levels,p);
    return '<svg class="home-anatomy-svg anatomy-pro anatomy-male back" viewBox="0 0 320 560" role="img" aria-label="Back male muscular anatomy training load">'+
      defs(p)+
      '<ellipse class="anatomy-ground" cx="160" cy="536" rx="76" ry="9"/>'+
      '<path class="anatomy-body male-body" style="fill:url(#mbBody)" d="M137 70C129 78 125 91 124 105L111 116C91 121 72 131 60 147 49 165 44 187 40 211L29 261 19 300 32 306 49 271 64 221 73 185 80 162 83 213 77 267 83 309 78 355 82 410 86 474 94 521 113 533 132 531 139 470 145 399 151 342 160 326 169 342 175 399 181 470 188 531 207 533 226 521 234 474 238 410 242 355 237 309 243 267 237 213 240 162 247 185 256 221 271 271 288 306 301 300 291 261 280 211C276 187 271 165 260 147 248 131 229 121 209 116L196 105C195 91 191 78 183 70Z"/>'+
      '<ellipse class="anatomy-head male-head" style="fill:url(#mbHead)" cx="160" cy="44" rx="29" ry="35"/>'+
      '<path class="anatomy-neck" d="M137 70C144 79 151 83 160 84 169 83 176 79 183 70L190 110 160 126 130 110Z"/>'+

      '<path '+m('back')+' d="M132 93C142 101 151 109 160 124 169 109 178 101 188 93L205 118 188 146 160 161 132 146 115 118Z"/>'+
      '<path '+m('shoulders')+' d="M120 112C100 104 79 111 64 128 59 135 57 143 58 151 78 143 96 146 112 158L136 137C135 126 130 118 120 112Z"/>'+
      '<path '+m('shoulders')+' d="M200 112C220 104 241 111 256 128 261 135 263 143 262 151 242 143 224 146 208 158L184 137C185 126 190 118 200 112Z"/>'+

      '<path '+m('back')+' d="M118 145C101 149 88 160 79 178L82 225C91 249 103 269 119 286L145 250 148 176C139 159 130 149 118 145Z"/>'+
      '<path '+m('back')+' d="M202 145C219 149 232 160 241 178L238 225C229 249 217 269 201 286L175 250 172 176C181 159 190 149 202 145Z"/>'+
      '<path '+m('back')+' d="M145 151C152 158 157 168 160 181V260L148 288 136 257 137 183C139 168 142 157 145 151Z"/>'+
      '<path '+m('back')+' d="M175 151C168 158 163 168 160 181V260L172 288 184 257 183 183C181 168 178 157 175 151Z"/>'+
      '<path class="anatomy-ridge" d="M160 126V291M126 154C136 168 141 184 142 207M194 154C184 168 179 184 178 207"/>'+

      '<path '+m('triceps')+' d="M72 150C59 165 56 189 59 214 62 229 68 241 77 247 89 222 95 196 92 170 88 160 81 153 72 150Z"/>'+
      '<path '+m('triceps')+' d="M248 150C261 165 264 189 261 214 258 229 252 241 243 247 231 222 225 196 228 170 232 160 239 153 248 150Z"/>'+
      '<path '+m('forearms')+' d="M60 209C50 232 44 258 39 286L28 319 41 324 57 295 72 247 75 229C72 220 67 214 60 209Z"/>'+
      '<path '+m('forearms')+' d="M260 209C270 232 276 258 281 286L292 319 279 324 263 295 248 247 245 229C248 220 253 214 260 209Z"/>'+
      '<path class="anatomy-hand" d="M28 318 17 343 21 356 29 348 34 361 40 355 41 326Z"/>'+
      '<path class="anatomy-hand" d="M292 318 303 343 299 356 291 348 286 361 280 355 279 326Z"/>'+

      '<path '+m('back')+' d="M116 269C129 279 143 289 155 303L151 326 131 340 108 323 101 295Z"/>'+
      '<path '+m('back')+' d="M204 269C191 279 177 289 165 303L169 326 189 340 212 323 219 295Z"/>'+

      '<path '+m('glutes')+' d="M101 326C119 314 141 317 157 333L155 373C144 389 124 395 102 384 91 375 86 361 88 344 91 336 95 330 101 326Z"/>'+
      '<path '+m('glutes')+' d="M219 326C201 314 179 317 163 333L165 373C176 389 196 395 218 384 229 375 234 361 232 344 229 336 225 330 219 326Z"/>'+
      '<path class="anatomy-separator" d="M160 330V383M94 342C112 352 136 356 155 347M226 342C208 352 184 356 165 347"/>'+

      '<path '+m('hamstrings')+' d="M94 386C112 383 132 391 145 407L139 455C133 478 123 499 109 514 94 501 86 482 83 459L83 414C85 401 89 392 94 386Z"/>'+
      '<path '+m('hamstrings')+' d="M226 386C208 383 188 391 175 407L181 455C187 478 197 499 211 514 226 501 234 482 237 459L237 414C235 401 231 392 226 386Z"/>'+
      '<path '+m('hamstrings')+' d="M145 397C154 391 160 399 159 414L156 464 143 506 132 486 135 442Z"/>'+
      '<path '+m('hamstrings')+' d="M175 397C166 391 160 399 161 414L164 464 177 506 188 486 185 442Z"/>'+

      '<path '+m('calves')+' d="M98 493C111 488 124 499 129 515L125 536 112 543 99 536 91 517C91 506 93 498 98 493Z"/>'+
      '<path '+m('calves')+' d="M222 493C209 488 196 499 191 515L195 536 208 543 221 536 229 517C229 506 227 498 222 493Z"/>'+
      '<path class="anatomy-foot" d="M96 533C106 536 116 539 124 546L118 553 87 552 83 542Z"/>'+
      '<path class="anatomy-foot" d="M224 533C214 536 204 539 196 546L202 553 233 552 237 542Z"/>'+

      '<path class="anatomy-line" d="M160 124V325M90 159C111 170 132 173 149 165M230 159C209 170 188 173 171 165M105 327C124 339 143 341 156 334M215 327C196 339 177 341 164 334M92 388C113 399 132 401 146 394M228 388C207 399 188 401 174 394"/>'+
      '<path class="anatomy-highlight-line" d="M95 177C108 188 119 207 124 229M225 177C212 188 201 207 196 229M105 402C114 419 119 441 117 462M215 402C206 419 201 441 203 462"/>'+
    '</svg>';
  }

  const variants={male:{front:maleFront,back:maleBack}};
  function render(view,levels={},variant='male'){
    const renderer=variants[variant]?.[view]||variants.male[view];
    return renderer?renderer(levels):'';
  }

  window.GoWorkoutAnatomy={
    front:(levels,variant='male')=>render('front',levels,variant),
    back:(levels,variant='male')=>render('back',levels,variant),
    render,
    variants:['male'],
    defaultVariant:'male'
  };
})();