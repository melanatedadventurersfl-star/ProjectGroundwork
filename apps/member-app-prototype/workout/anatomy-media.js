(function(){
  const clampLevel=value=>Math.max(0,Math.min(4,Number(value)||0));
  const heat=(group,levels)=>' anatomy-muscle muscle-'+group+' heat-'+clampLevel(levels?.[group]);

  function front(levels={}){
    const h=group=>heat(group,levels);
    return '<svg class="home-anatomy-svg anatomy-pro front" viewBox="0 0 280 520" role="img" aria-label="Front muscular anatomy training load">'+
      '<defs>'+
        '<linearGradient id="anatomyFrontSkin" x1="0" x2="1"><stop offset="0" stop-color="#17251d"/><stop offset=".48" stop-color="#304338"/><stop offset="1" stop-color="#142119"/></linearGradient>'+
        '<linearGradient id="anatomyFrontMuscle" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#415348"/><stop offset=".55" stop-color="#2d4135"/><stop offset="1" stop-color="#1d2e25"/></linearGradient>'+
        '<radialGradient id="anatomyFrontHead" cx=".5" cy=".38" r=".64"><stop offset="0" stop-color="#3d4f44"/><stop offset=".7" stop-color="#283a30"/><stop offset="1" stop-color="#18261e"/></radialGradient>'+
      '</defs>'+
      '<ellipse class="anatomy-ground" cx="140" cy="500" rx="70" ry="9"/>'+
      '<path class="anatomy-body" d="M124 54Q115 64 114 84L103 95Q82 102 65 116L48 151 37 205 25 254 37 260 55 216 67 172 74 148 78 207 71 263 79 315 75 381 81 463 98 489 113 489 118 422 128 337 140 322 152 337 162 422 167 489 182 489 199 463 205 381 201 315 209 263 202 207 206 148 213 172 225 216 243 260 255 254 243 205 232 151 215 116Q198 102 177 95L166 84Q165 64 156 54Z"/>'+
      '<ellipse class="anatomy-head" cx="140" cy="37" rx="25" ry="30"/>'+
      '<path class="anatomy-neck" d="M124 58Q140 72 156 58L162 92 140 107 118 92Z"/>'+
      '<path class="'+h('shoulders')+'" d="M114 96Q91 94 72 108L60 127Q78 121 97 132L121 113Z"/>'+
      '<path class="'+h('shoulders')+'" d="M166 96Q189 94 208 108L220 127Q202 121 183 132L159 113Z"/>'+
      '<path class="'+h('chest')+'" d="M121 108Q97 103 82 118L86 153Q104 166 136 151L136 116Z"/>'+
      '<path class="'+h('chest')+'" d="M159 108Q183 103 198 118L194 153Q176 166 144 151L144 116Z"/>'+
      '<path class="anatomy-separator" d="M140 111V162M88 153Q113 168 136 154M192 153Q167 168 144 154"/>'+
      '<path class="'+h('biceps')+'" d="M70 131Q55 150 55 184L65 205Q82 177 83 143Z"/>'+
      '<path class="'+h('biceps')+'" d="M210 131Q225 150 225 184L215 205Q198 177 197 143Z"/>'+
      '<path class="'+h('forearms')+'" d="M55 184Q44 211 38 248L48 252Q64 221 68 200Z"/>'+
      '<path class="'+h('forearms')+'" d="M225 184Q236 211 242 248L232 252Q216 221 212 200Z"/>'+
      '<path class="'+h('forearms')+'" d="M47 251 34 286 24 282 36 247Z"/>'+
      '<path class="'+h('forearms')+'" d="M233 251 246 286 256 282 244 247Z"/>'+
      '<path class="'+h('core')+'" d="M111 165Q124 158 136 164L135 190Q124 197 113 190Z"/>'+
      '<path class="'+h('core')+'" d="M144 164Q156 158 169 165L167 190Q156 197 145 190Z"/>'+
      '<path class="'+h('core')+'" d="M113 193Q124 188 135 194L134 219Q124 225 114 219Z"/>'+
      '<path class="'+h('core')+'" d="M145 194Q156 188 167 193L166 219Q156 225 146 219Z"/>'+
      '<path class="'+h('core')+'" d="M115 222Q125 218 134 224L133 249Q124 255 116 249Z"/>'+
      '<path class="'+h('core')+'" d="M146 224Q155 218 165 222L164 249Q156 255 147 249Z"/>'+
      '<path class="'+h('core')+'" d="M94 163Q107 169 111 188L113 245 101 265 87 240 89 192Z"/>'+
      '<path class="'+h('core')+'" d="M186 163Q173 169 169 188L167 245 179 265 193 240 191 192Z"/>'+
      '<path class="'+h('core')+'" d="M102 262Q119 252 135 260L132 286 112 299 98 281Z"/>'+
      '<path class="'+h('core')+'" d="M178 262Q161 252 145 260L148 286 168 299 182 281Z"/>'+
      '<path class="'+h('quads')+'" d="M89 292Q110 285 127 300L121 354 108 391 92 373 84 331Z"/>'+
      '<path class="'+h('quads')+'" d="M191 292Q170 285 153 300L159 354 172 391 188 373 196 331Z"/>'+
      '<path class="'+h('quads')+'" d="M128 303Q139 296 140 313L137 365 124 392 119 357Z"/>'+
      '<path class="'+h('quads')+'" d="M152 303Q141 296 140 313L143 365 156 392 161 357Z"/>'+
      '<path class="'+h('quads')+'" d="M92 305Q103 305 112 318L106 369 96 383 88 359Z"/>'+
      '<path class="'+h('quads')+'" d="M188 305Q177 305 168 318L174 369 184 383 192 359Z"/>'+
      '<path class="'+h('quads')+'" d="M118 291Q125 285 134 292L128 321 119 338 111 322Z"/>'+
      '<path class="'+h('quads')+'" d="M162 291Q155 285 146 292L152 321 161 338 169 322Z"/>'+
      '<path class="'+h('calves')+'" d="M88 385Q105 394 111 421L104 470 92 483 80 455 79 421Z"/>'+
      '<path class="'+h('calves')+'" d="M192 385Q175 394 169 421L176 470 188 483 200 455 201 421Z"/>'+
      '<path class="'+h('calves')+'" d="M112 400Q121 410 119 438L114 473 104 470 110 421Z"/>'+
      '<path class="'+h('calves')+'" d="M168 400Q159 410 161 438L166 473 176 470 170 421Z"/>'+
      '<path class="anatomy-line" d="M140 106V285M104 165Q140 178 176 165M102 262Q140 280 178 262M89 292Q140 308 191 292M83 384Q106 398 119 389M197 384Q174 398 161 389"/>'+
      '<path class="anatomy-highlight-line" d="M94 124Q109 114 126 119M186 124Q171 114 154 119M102 315Q112 329 119 350M178 315Q168 329 161 350"/>'+
    '</svg>';
  }

  function back(levels={}){
    const h=group=>heat(group,levels);
    return '<svg class="home-anatomy-svg anatomy-pro back" viewBox="0 0 280 520" role="img" aria-label="Back muscular anatomy training load">'+
      '<defs>'+
        '<linearGradient id="anatomyBackSkin" x1="0" x2="1"><stop offset="0" stop-color="#17251d"/><stop offset=".48" stop-color="#304338"/><stop offset="1" stop-color="#142119"/></linearGradient>'+
        '<linearGradient id="anatomyBackMuscle" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#415348"/><stop offset=".55" stop-color="#2d4135"/><stop offset="1" stop-color="#1d2e25"/></linearGradient>'+
      '</defs>'+
      '<ellipse class="anatomy-ground" cx="140" cy="500" rx="70" ry="9"/>'+
      '<path class="anatomy-body" d="M124 54Q115 64 114 84L103 95Q82 102 65 116L48 151 37 205 25 254 37 260 55 216 67 172 74 148 78 207 71 263 79 315 75 381 81 463 98 489 113 489 118 422 128 337 140 322 152 337 162 422 167 489 182 489 199 463 205 381 201 315 209 263 202 207 206 148 213 172 225 216 243 260 255 254 243 205 232 151 215 116Q198 102 177 95L166 84Q165 64 156 54Z"/>'+
      '<ellipse class="anatomy-head" cx="140" cy="37" rx="25" ry="30"/>'+
      '<path class="anatomy-neck" d="M124 58Q140 70 156 58L162 92 140 107 118 92Z"/>'+
      '<path class="'+h('back')+'" d="M121 83 140 103 159 83 181 107 162 135 140 148 118 135 99 107Z"/>'+
      '<path class="'+h('shoulders')+'" d="M99 102Q78 98 62 116L60 137Q81 124 104 130L121 112Z"/>'+
      '<path class="'+h('shoulders')+'" d="M181 102Q202 98 218 116L220 137Q199 124 176 130L159 112Z"/>'+
      '<path class="'+h('back')+'" d="M108 126Q91 130 79 149L81 198 102 238 128 204 131 146Z"/>'+
      '<path class="'+h('back')+'" d="M172 126Q189 130 201 149L199 198 178 238 152 204 149 146Z"/>'+
      '<path class="'+h('back')+'" d="M128 136Q136 144 140 156L140 226 128 248 119 221 123 167Z"/>'+
      '<path class="'+h('back')+'" d="M152 136Q144 144 140 156L140 226 152 248 161 221 157 167Z"/>'+
      '<path class="'+h('triceps')+'" d="M66 139Q53 158 55 190L65 211Q81 181 82 151Z"/>'+
      '<path class="'+h('triceps')+'" d="M214 139Q227 158 225 190L215 211Q199 181 198 151Z"/>'+
      '<path class="'+h('forearms')+'" d="M55 188Q45 216 38 249L49 254Q64 223 67 204Z"/>'+
      '<path class="'+h('forearms')+'" d="M225 188Q235 216 242 249L231 254Q216 223 213 204Z"/>'+
      '<path class="'+h('forearms')+'" d="M48 252 34 286 24 282 36 248Z"/>'+
      '<path class="'+h('forearms')+'" d="M232 252 246 286 256 282 244 248Z"/>'+
      '<path class="'+h('back')+'" d="M112 224Q125 235 136 248L134 285 112 303 94 282 98 249Z"/>'+
      '<path class="'+h('back')+'" d="M168 224Q155 235 144 248L146 285 168 303 186 282 182 249Z"/>'+
      '<path class="'+h('glutes')+'" d="M91 286Q113 274 136 292L135 333Q114 351 87 333L82 309Z"/>'+
      '<path class="'+h('glutes')+'" d="M189 286Q167 274 144 292L145 333Q166 351 193 333L198 309Z"/>'+
      '<path class="'+h('hamstrings')+'" d="M87 336Q108 338 127 351L120 407 104 432 88 414 80 374Z"/>'+
      '<path class="'+h('hamstrings')+'" d="M193 336Q172 338 153 351L160 407 176 432 192 414 200 374Z"/>'+
      '<path class="'+h('hamstrings')+'" d="M128 346Q137 351 136 368L131 410 119 429 114 401Z"/>'+
      '<path class="'+h('hamstrings')+'" d="M152 346Q143 351 144 368L149 410 161 429 166 401Z"/>'+
      '<path class="'+h('calves')+'" d="M88 414Q105 423 110 449L103 479 92 488 80 463 79 438Z"/>'+
      '<path class="'+h('calves')+'" d="M192 414Q175 423 170 449L177 479 188 488 200 463 201 438Z"/>'+
      '<path class="'+h('calves')+'" d="M111 424Q121 435 118 458L113 481 103 479 109 449Z"/>'+
      '<path class="'+h('calves')+'" d="M169 424Q159 435 162 458L167 481 177 479 171 449Z"/>'+
      '<path class="anatomy-line" d="M140 105V286M84 132Q140 151 196 132M83 286Q140 306 197 286M86 334Q140 350 194 334M81 413Q105 429 120 419M199 413Q175 429 160 419"/>'+
      '<path class="anatomy-highlight-line" d="M102 150Q113 167 120 193M178 150Q167 167 160 193M96 354Q107 371 112 397M184 354Q173 371 168 397"/>'+
    '</svg>';
  }

  window.GoWorkoutAnatomy={front,back};
})();