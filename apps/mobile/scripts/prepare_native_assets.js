const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const W = 1024;
const H = 1024;
const target = path.resolve(__dirname, '..', 'assets', 'ma-app-icon.png');
const C = {
  bg: [11, 16, 21, 255], orange: [243, 106, 16, 255], gold: [244, 182, 58, 255],
  cream: [244, 215, 141, 255], ochre: [198, 132, 49, 255], brown: [138, 98, 46, 255],
  green: [72, 101, 45, 255], fire: [255, 100, 23, 255], fire2: [255, 181, 49, 255],
};
const px = Buffer.alloc(W * H * 4);
for (let i = 0; i < px.length; i += 4) { px[i]=C.bg[0]; px[i+1]=C.bg[1]; px[i+2]=C.bg[2]; px[i+3]=255; }

function dot(x,y,c){ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=W||y>=H)return; const i=(y*W+x)*4; px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];px[i+3]=255; }
function rect(x1,y1,x2,y2,c){ for(let y=Math.max(0,Math.floor(y1));y<=Math.min(H-1,Math.ceil(y2));y++) for(let x=Math.max(0,Math.floor(x1));x<=Math.min(W-1,Math.ceil(x2));x++) dot(x,y,c); }
function circle(cx,cy,r,c){ const rr=r*r; for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++){const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy<=rr)dot(x,y,c);} }
function roundRect(x1,y1,x2,y2,r,c){rect(x1+r,y1,x2-r,y2,c);rect(x1,y1+r,x2,y2-r,c);circle(x1+r,y1+r,r,c);circle(x2-r,y1+r,r,c);circle(x1+r,y2-r,r,c);circle(x2-r,y2-r,r,c);}
function poly(p,c){let a=H-1,b=0;for(const[,y]of p){a=Math.min(a,y);b=Math.max(b,y);}for(let y=Math.floor(a);y<=Math.ceil(b);y++){const xs=[];for(let i=0,j=p.length-1;i<p.length;j=i++){const[xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y))xs.push(xi+(y-yi)*(xj-xi)/(yj-yi));}xs.sort((m,n)=>m-n);for(let i=0;i+1<xs.length;i+=2)rect(xs[i],y,xs[i+1],y,c);}}
function line(x1,y1,x2,y2,w,c){const n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));for(let i=0;i<=n;i++){const t=i/n;circle(x1+(x2-x1)*t,y1+(y2-y1)*t,w/2,c);}}

// Outer badge has generous dark padding so circular/squircle Android masks cannot crop the mark.
roundRect(78,78,946,946,110,C.orange); roundRect(90,90,934,934,102,C.gold); roundRect(106,106,918,918,90,C.bg);

// Striped sunset.
const stripes=[[244,182,58,255],[244,182,58,255],[238,140,36,255],[244,182,58,255],[245,123,22,255]];
const cx=512,cy=288,r=215;
for(let s=0;s<stripes.length;s++){const y1=cy-r+s*(2*r/stripes.length),y2=cy-r+(s+1)*(2*r/stripes.length);for(let y=Math.floor(y1);y<=Math.ceil(y2);y++){const dy=y-cy,h=Math.sqrt(Math.max(0,r*r-dy*dy));rect(cx-h,y,cx+h,y,stripes[s]);}}

// Mountains and snowcaps.
poly([[300,425],[515,205],[760,425],[660,325],[605,380],[530,285],[450,390],[375,330]],C.bg);
poly([[170,430],[275,350],[375,430],[305,390],[260,430],[235,395]],C.ochre);
poly([[650,430],[790,345],[860,430],[790,390],[748,430],[720,405]],C.ochre);
poly([[445,390],[530,285],[605,380],[570,360],[535,320],[520,345],[485,380]],C.cream);
poly([[210,405],[275,350],[340,400],[305,390],[260,430]],C.cream);
poly([[730,395],[790,345],[835,405],[790,390],[760,430]],C.cream);

function tree(x,y,s){for(const[d,w]of[[0,54],[28,44],[54,34]])poly([[x,y+d],[x-w*s/2,y+d+46*s],[x+w*s/2,y+d+46*s]],C.green);rect(x-4*s,y+78*s,x+4*s,y+96*s,C.brown);}
for(const t of [[190,430,1],[275,440,.9],[352,440,.9],[590,432,1],[665,442,.85],[742,430,1],[815,446,.8]])tree(...t);

// Tent, ground and campfire.
poly([[355,610],[492,455],[624,610],[570,610],[512,515],[458,610]],C.cream);
poly([[392,610],[512,490],[590,610],[547,610],[512,535],[477,610]],C.orange);
poly([[470,610],[512,535],[555,610]],C.bg); poly([[370,610],[430,548],[440,610]],C.brown);
roundRect(155,610,330,630,10,C.brown);roundRect(180,640,365,660,10,C.brown);roundRect(365,650,600,670,10,C.orange);roundRect(740,610,860,630,10,C.brown);roundRect(700,640,860,660,10,C.brown);
line(625,645,690,665,18,C.brown);line(690,645,755,665,18,C.brown);line(655,682,705,715,18,C.brown);line(710,674,760,705,18,C.brown);
poly([[700,620],[675,540],[730,490],[735,560],[765,505],[790,575],[770,620]],C.fire);
poly([[715,620],[700,565],[728,530],[732,575],[755,540],[775,595],[760,620]],C.fire2);

// Bold built-in bitmap lettering keeps the generator dependency-free in EAS.
const F={A:['01110','10001','10001','11111','10001','10001','10001'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],G:['01110','10001','10000','10111','10001','10001','01110'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],T:['11111','00100','00100','00100','00100','00100','00100'],' ':['00000','00000','00000','00000','00000','00000','00000']};
function text(str,y,s,c){const gw=5*s,sp=2*s,total=str.length*gw+(str.length-1)*sp;let x=Math.round((W-total)/2);for(const ch of str){const g=F[ch]||F[' '];for(let yy=0;yy<7;yy++)for(let xx=0;xx<5;xx++)if(g[yy][xx]==='1')rect(x+xx*s,y+yy*s,x+(xx+1)*s-1,y+(yy+1)*s-1,c);x+=gw+sp;}}
text('GO MELANATED',735,9,C.cream); line(300,850,465,850,8,C.orange);line(560,850,725,850,8,C.orange);poly([[512,820],[526,845],[552,854],[526,864],[512,890],[498,864],[472,854],[498,845]],C.orange);

function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),o=Buffer.alloc(12+data.length);o.writeUInt32BE(data.length,0);t.copy(o,4);data.copy(o,8);o.writeUInt32BE(crc32(Buffer.concat([t,data])),8+data.length);return o;}
const raw=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++){const d=y*(W*4+1);raw[d]=0;px.copy(raw,d+1,y*W*4,(y+1)*W*4);}const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=6;
const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
if(png.length<1000)throw new Error(`Generated launcher icon is unexpectedly small (${png.length} bytes).`);
fs.writeFileSync(target,png);
console.log(`Prepared Go Melanated launcher icon: ${path.basename(target)} (${W}x${H}, ${png.length} bytes).`);
