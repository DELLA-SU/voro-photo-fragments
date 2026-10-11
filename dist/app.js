import {FractureScene} from './scene3d.js';
const W=736,H=737;
const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const density=document.getElementById('density'),spread=document.getElementById('spread');
const edges=document.getElementById('edges'),compare=document.getElementById('compare'),scatter=document.getElementById('scatter');
const fileInput=document.getElementById('image-file'),fileStatus=document.getElementById('file-status');
const photo=document.createElement('canvas');photo.width=W;photo.height=H;
const photoCtx=photo.getContext('2d',{willReadFrequently:true});
const fragments=document.createElement('canvas');fragments.width=W;fragments.height=H;
const fragmentCtx=fragments.getContext('2d',{willReadFrequently:true});
const play=document.getElementById('play');let playing=false,cycleStart=0;
const defaultImage=new Image();defaultImage.src='reference.jpeg';
let geometry=[],levels=[],original=false,boundaries=false,custom=false,ready=false;
let currentSpread=.5,targetSpread=.5,raf=0,transition=null,currentLevel=3,imageRequest=0;
const names=['10 조각','20 조각','50 조각','100 조각','400 조각','1,600 조각','6,400 조각','14,400 조각'];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scene3d=null;
try{scene3d=new FractureScene();scene3d.bindDrag(canvas,()=>render());canvas.dataset.renderer='webgl';}catch(e){console.warn('3D unavailable; using textured Canvas fragments.',e);canvas.dataset.renderer='canvas2d';document.querySelector('.live').textContent='2D · WebGL 미지원';}
function makePhoto(image){
 photoCtx.clearRect(0,0,W,H);photoCtx.fillStyle='white';photoCtx.fillRect(0,0,W,H);
 const s=Math.min(W/image.naturalWidth,H/image.naturalHeight);
 const w=image.naturalWidth*s,h=image.naturalHeight*s;
 photoCtx.drawImage(image,(W-w)/2,(H-h)/2,w,h);
 fragmentCtx.clearRect(0,0,W,H);fragmentCtx.drawImage(image,(W-w)/2,(H-h)/2,w,h);
 const fragmentData=fragmentCtx.getImageData(0,0,W,H),pixels=fragmentData.data;
 if(!custom){
   // Only the connected white backdrop is removed; enclosed eye highlights stay.
   const seen=new Uint8Array(W*H),queue=new Uint32Array(W*H);let head=0,tail=0;
   const visit=p=>{if(seen[p])return;seen[p]=1;const i=p*4;if(Math.min(pixels[i],pixels[i+1],pixels[i+2])<246)return;queue[tail++]=p;};
   for(let x=0;x<W;x++){visit(x);visit((H-1)*W+x);}for(let y=0;y<H;y++){visit(y*W);visit(y*W+W-1);}
   while(head<tail){const p=queue[head++];pixels[p*4+3]=0;const x=p%W;if(x>0)visit(p-1);if(x<W-1)visit(p+1);if(p>=W)visit(p-W);if(p<(H-1)*W)visit(p+W);}
   fragmentCtx.putImageData(fragmentData,0,0);
 }
 levels=geometry.map(level=>({...level,cells:level.cells.filter(cell=>{
   if(level.seeds<=100)return true;
   const samples=[[cell.cx,cell.cy],[cell.minX+1,cell.minY+1],[cell.maxX-1,cell.maxY-1]];
   return samples.some(([x,y])=>{const pos=(Math.max(0,Math.min(H-1,Math.round(y)))*W+Math.max(0,Math.min(W-1,Math.round(x))))*4;return pixels[pos+3]>0;});
 }).map(cell=>{
   if(level.seeds>400)return cell;
   const x=Math.max(0,Math.floor(cell.minX)),y=Math.max(0,Math.floor(cell.minY));
   const sw=Math.min(W-x,Math.ceil(cell.maxX)-x+1),sh=Math.min(H-y,Math.ceil(cell.maxY)-y+1);
   const sprite=document.createElement('canvas');sprite.width=sw;sprite.height=sh;const sc=sprite.getContext('2d');
   sc.translate(-x,-y);sc.clip(cell.path);sc.drawImage(fragments,0,0);
   const side=document.createElement('canvas');side.width=sw;side.height=sh;const sideCtx=side.getContext('2d');
   sideCtx.drawImage(sprite,0,0);sideCtx.globalCompositeOperation='source-in';sideCtx.fillStyle='#7c97a7';sideCtx.fillRect(0,0,sw,sh);
   return {...cell,sprite,side,spriteX:x,spriteY:y};
 }).sort((a,b)=>a.cy-b.cy)}));
 scene3d?.setPhoto(fragments);
 if(custom){
   const bins=new Map();for(let i=0;i<pixels.length;i+=4*29){if(!pixels[i+3])continue;const rgb=[pixels[i],pixels[i+1],pixels[i+2]];if(Math.min(...rgb)>245)continue;const key=rgb.map(v=>Math.min(255,Math.round(v/32)*32)).join(',');bins.set(key,(bins.get(key)||0)+1);}
   const colors=[...bins].sort((a,b)=>b[1]-a[1]).slice(0,5);
   document.querySelectorAll('.palette i').forEach((el,i)=>el.style.setProperty('--c',colors.length?`rgb(${colors[i%colors.length][0]})`:'#ffffff'));
 }else document.querySelectorAll('.palette i').forEach((el,i)=>el.style.setProperty('--c',['#8aaec3','#bdd3dc','#f0eedb','#dcaeaa','#493427'][i]));
}
function pieces(levelIndex,amount,opacity=1){
 const level=levels[levelIndex];ctx.globalAlpha=opacity;
 // Joined images keep every original pixel: density never pixelates the photo.
 if(amount<.0001){ctx.drawImage(photo,0,0);if(boundaries){ctx.strokeStyle='rgba(55,83,96,.26)';ctx.lineWidth=.55;for(const cell of level.cells)ctx.stroke(cell.path);}ctx.globalAlpha=1;return;}
 ctx.save();const sceneScale=1/(1+.65*amount);ctx.translate(W/2,H/2);ctx.scale(sceneScale,sceneScale);ctx.translate(-W/2,-H/2);
 for(const cell of level.cells){
   const dx=((cell.cx-W/2)*.48+cell.jitterX*30)*amount;
   const dy=((cell.cy-H/2)*.48+cell.jitterY*30)*amount;
   const scale=1-.22*amount;
   ctx.save();ctx.translate(cell.cx+dx,cell.cy+dy);ctx.rotate(cell.angle*amount);ctx.scale(scale,scale);ctx.translate(-cell.cx,-cell.cy);
   if(cell.sprite){
     const depth=11*amount;
     ctx.shadowColor=`rgba(38,61,75,${.16*amount})`;ctx.shadowBlur=13*amount;ctx.shadowOffsetY=7*amount;
     ctx.drawImage(cell.side,cell.spriteX+depth*.7,cell.spriteY+depth);ctx.shadowColor='transparent';
     for(let d=depth;d>0;d-=2)ctx.drawImage(cell.side,cell.spriteX+d*.7,cell.spriteY+d);
     ctx.drawImage(cell.sprite,cell.spriteX,cell.spriteY);
   }else{ctx.save();ctx.clip(cell.path);
   const x=Math.max(0,Math.floor(cell.minX)),y=Math.max(0,Math.floor(cell.minY));
   const w=Math.min(W-x,Math.ceil(cell.maxX)-x+1),h=Math.min(H-y,Math.ceil(cell.maxY)-y+1);
   ctx.drawImage(fragments,x,y,w,h,x,y,w,h);ctx.restore();}
   if(boundaries){ctx.strokeStyle='rgba(55,83,96,.30)';ctx.lineWidth=.6;ctx.stroke(cell.path);}
   ctx.restore();
 }ctx.restore();ctx.globalAlpha=1;
}
function render(now=performance.now()){
 if(!ready)return;ctx.setTransform(2,0,0,2,0,0);ctx.globalAlpha=1;ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
 if(original){ctx.drawImage(photo,0,0);return;}
 if(scene3d){
   if(transition){const t=Math.min(1,(now-transition.start)/transition.duration),e=1-Math.pow(1-t,3);currentSpread=transition.from+(targetSpread-transition.from)*e;if(t>=1){currentSpread=targetSpread;transition=null;}}
   if(currentSpread<.0001&&Math.abs(scene3d.yaw)+Math.abs(scene3d.pitch)<.0001&&!boundaries){ctx.drawImage(photo,0,0);}
   else ctx.drawImage(scene3d.draw(levels[currentLevel],currentSpread,boundaries),0,0,W,H);
   return;
 }
 if(transition){const t=Math.min(1,(now-transition.start)/transition.duration),e=1-Math.pow(1-t,3);currentSpread=transition.from+(targetSpread-transition.from)*e;
   if(t<1&&transition.oldLevel!==currentLevel){pieces(transition.oldLevel,currentSpread,1-e);pieces(currentLevel,currentSpread,e);}else pieces(currentLevel,currentSpread);
   if(t>=1){currentSpread=targetSpread;transition=null;}
 }else pieces(currentLevel,currentSpread);
}
function tick(now){raf=0;if(playing){const phase=((now-cycleStart)%5200)/5200;const pulse=(1-Math.cos(phase*Math.PI*2))/2;currentSpread=pulse;targetSpread=pulse;spread.value=Math.round(pulse*100);updateUI();}render(now);if((transition||playing)&&!original)raf=requestAnimationFrame(tick);}
function stopPlayback(){playing=false;play.textContent='자동 재생 ▷';play.setAttribute('aria-pressed','false');}
function animateTo(amount,newLevel=currentLevel){
 if(!ready)return;if(raf)cancelAnimationFrame(raf);raf=0;
 stopPlayback();
 targetSpread=Math.max(0,Math.min(1,amount));const oldLevel=currentLevel;currentLevel=newLevel;
 transition=reduceMotion.matches?null:{from:currentSpread,oldLevel,start:performance.now(),duration:800};
 if(reduceMotion.matches)currentSpread=targetSpread;
 spread.value=Math.round(targetSpread*100);original=false;compare.setAttribute('aria-pressed','false');updateUI();
 raf=requestAnimationFrame(tick);
}
function updateUI(){
 document.getElementById('density-value').textContent=names[currentLevel];
 document.getElementById('spread-value').textContent=`${Math.round(targetSpread*100)}%`;
 scatter.textContent=targetSpread>.01?'모이기 ↙':'흩어지기 ↗';scatter.setAttribute('aria-pressed',String(targetSpread>.01));
 document.getElementById('cell-count').textContent=original?'ORIGINAL PHOTO':`${levels[currentLevel]?.cells.length.toLocaleString()??'—'} CELLS`;
 document.getElementById('mode-label').textContent=original?'ORIGINAL PHOTOGRAPH':targetSpread>.01?'SCATTERED FRAGMENTS':'VORONOI PORTRAIT';
 canvas.setAttribute('aria-label',original?'선택한 원본 사진':`${levels[currentLevel]?.cells.length??0}개의 보로노이 조각, 흩어지는 거리 ${Math.round(targetSpread*100)}%`);
}
density.addEventListener('input',()=>animateTo([.8,.7,.6,.5,.4,.25,.1,0][Number(density.value)],Number(density.value)));
spread.addEventListener('input',()=>animateTo(Number(spread.value)/100));
scatter.addEventListener('click',()=>animateTo(targetSpread>.01?0:1));
document.getElementById('reset-view').addEventListener('click',()=>{scene3d?.resetView();render();});
play.addEventListener('click',()=>{if(!ready)return;if(playing){stopPlayback();return;}original=false;compare.setAttribute('aria-pressed','false');transition=null;playing=true;cycleStart=performance.now()-Math.acos(1-2*currentSpread)/(2*Math.PI)*5200;play.textContent='재생 멈추기 Ⅱ';play.setAttribute('aria-pressed','true');if(!raf)raf=requestAnimationFrame(tick);});
edges.addEventListener('click',()=>{boundaries=!boundaries;edges.setAttribute('aria-pressed',String(boundaries));original=false;compare.setAttribute('aria-pressed','false');updateUI();render();if(transition&&!raf)raf=requestAnimationFrame(tick);});
compare.addEventListener('click',()=>{if(!ready)return;stopPlayback();original=!original;compare.setAttribute('aria-pressed',String(original));if(raf)cancelAnimationFrame(raf);raf=0;transition=null;currentSpread=targetSpread;updateUI();render();});
document.getElementById('upload').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',async()=>{
 const file=fileInput.files[0];if(!file)return;if(!ready){fileStatus.textContent='조각 준비가 끝난 뒤 이미지를 다시 선택해 주세요.';fileInput.value='';return;}const request=++imageRequest;
 if(file.size>20*1024*1024){fileStatus.textContent='20MB 이하의 이미지를 선택해 주세요.';fileInput.value='';return;}
 if(!file.type.startsWith('image/')){fileStatus.textContent='JPG, PNG, WEBP 등의 이미지 파일을 선택해 주세요.';fileInput.value='';return;}
 fileStatus.textContent='새 이미지를 준비하는 중…';const url=URL.createObjectURL(file),image=new Image();image.src=url;
 try{await image.decode();if(request!==imageRequest)return;custom=true;makePhoto(image);
   animateTo(.15,Number(density.value));document.querySelector('.art-bottom>span').textContent='02 / YOUR PHOTO';
   document.getElementById('reset-image').hidden=false;fileStatus.textContent=`${file.name} · 이 브라우저에서만 사용됩니다.`;
 }catch{if(request===imageRequest)fileStatus.textContent='이 이미지를 열 수 없습니다. JPG, PNG, WEBP 파일을 다시 선택해 주세요.';}
 finally{URL.revokeObjectURL(url);fileInput.value='';}
});
document.getElementById('reset-image').addEventListener('click',()=>{if(!ready)return;++imageRequest;custom=false;makePhoto(defaultImage);animateTo(.15,Number(density.value));document.querySelector('.art-bottom>span').textContent='01 / BLUE CAT';document.getElementById('reset-image').hidden=true;fileStatus.textContent='최대 20MB · 이미지는 이 브라우저에서만 사용됩니다.';});
document.getElementById('save').addEventListener('click',()=>{if(!ready)return;canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=original?'voro-original.png':'voro-fragments.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');});
Promise.all([fetch('cells.json').then(r=>{if(!r.ok)throw Error('cells');return r.json();}),defaultImage.decode()]).then(([data])=>{
 geometry=data.map(level=>({...level,cells:level.cells.map(([,p],i)=>{
   const path=new Path2D();path.moveTo(p[0],p[1]);let cx=0,cy=0,minX=W,minY=H,maxX=0,maxY=0;
   for(let k=0;k<p.length;k+=2){if(k)path.lineTo(p[k],p[k+1]);cx+=p[k];cy+=p[k+1];minX=Math.min(minX,p[k]);minY=Math.min(minY,p[k+1]);maxX=Math.max(maxX,p[k]);maxY=Math.max(maxY,p[k+1]);}path.closePath();cx/=p.length/2;cy/=p.length/2;
   const hash=n=>{const v=Math.sin((i+1)*n)*43758.5453;return (v-Math.floor(v))*2-1;};
   return {p,path,cx,cy,minX,minY,maxX,maxY,jitterX:hash(12.9898),jitterY:hash(78.233),angle:hash(39.425)*.22};
 })}));makePhoto(defaultImage);ready=true;document.getElementById('loading').hidden=true;updateUI();render();
}).catch(()=>{document.getElementById('loading').hidden=true;document.getElementById('error').hidden=false;});
