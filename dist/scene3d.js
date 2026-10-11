import * as THREE from './vendor/three.module.js';
const W=736,H=737;
// Trace the photo's alpha mask into closed polygon rings. The white backdrop
// is already removed from the default cat; uploads retain their own alpha.
function traceMask(canvas){
 const step=4,nx=Math.ceil(W/step),ny=Math.ceil(H/step),d=canvas.getContext('2d').getImageData(0,0,W,H).data;
 const mask=new Uint8Array(nx*ny);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const px=Math.min(W-1,x*step+2),py=Math.min(H-1,y*step+2);mask[y*nx+x]=d[(py*W+px)*4+3]>32?1:0;}
 const links=new Map(),base=nx+1;
 const edge=(ax,ay,bx,by)=>{const key=ay*base+ax;if(!links.has(key))links.set(key,[]);links.get(key).push(by*base+bx);};
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(mask[y*nx+x]){
  if(y===0||!mask[(y-1)*nx+x])edge(x,y,x+1,y);
  if(x===nx-1||!mask[y*nx+x+1])edge(x+1,y,x+1,y+1);
  if(y===ny-1||!mask[(y+1)*nx+x])edge(x+1,y+1,x,y+1);
  if(x===0||!mask[y*nx+x-1])edge(x,y+1,x,y);
 }
 const rings=[];
 while(links.size){const start=links.keys().next().value;let key=start;const ring=[];
  for(let guard=0;guard<(nx+1)*(ny+1)*5;guard++){
   ring.push([Math.min(W,(key%base)*step),Math.min(H,Math.floor(key/base)*step)]);
   const options=links.get(key);if(!options?.length)break;const next=options.pop();if(!options.length)links.delete(key);key=next;if(key===start)break;
  }
  if(key!==start||ring.length<4)continue;
  const simple=ring.filter((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];return (p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0])!==0;});
  if(simple.length<3)continue;simple.push(simple[0]);
  const area=simple.slice(0,-1).reduce((a,p,i)=>a+p[0]*simple[i+1][1]-simple[i+1][0]*p[1],0)/2;
  if(Math.abs(area)>20)rings.push({ring:simple,area});
 }
 const contains=(ring,p)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const polys=rings.filter(r=>r.area>0).map(r=>[r.ring]);
 for(const hole of rings.filter(r=>r.area<0)){const outer=polys.find(p=>contains(p[0],hole.ring[0]));if(outer)outer.push(hole.ring);}
 return polys;
}
const vertexShader=`
 attribute vec2 cellCenter;
 attribute vec3 cellRandom;
 varying vec2 vUv;
 varying vec3 vNormal;
 varying float vFace;
 uniform float separation;
 uniform float thickness;
 mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
 mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
 mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
 void main(){
  mat3 rotation=rz(cellRandom.z*.26*separation)*ry(cellRandom.y*.95*separation)*rx(cellRandom.x*.85*separation);
  vec3 p=position; p.z-=thickness*.5;
  p=rotation*p*(1.-.10*separation);p.z+=thickness*.5;
  p.xy+=cellCenter*(1.+.48*separation)+cellRandom.xy*30.*separation;
  p.z+=cellRandom.z*145.*separation-thickness;
  vUv=uv;vFace=normal.z;vNormal=normalize(normalMatrix*rotation*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
 }
`;
const fragmentShader=`
 uniform sampler2D photograph;
 varying vec2 vUv;
 varying vec3 vNormal;
 varying float vFace;
 void main(){
  vec4 tex=texture2D(photograph,vUv);
  vec3 n=normalize(vNormal);float light=.53+.47*max(0.,dot(n,normalize(vec3(-.45,.7,1.))));
  vec3 color;
  if(vFace>.5){if(tex.a<.12)discard;color=tex.rgb*(.95+.05*light);}
  else {color=mix(vec3(.34,.49,.59),vec3(.68,.78,.82),max(0.,n.y))*(.60+.40*light);}
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
export class FractureScene {
 constructor(){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  this.renderer.setSize(W*2,H*2,false);this.renderer.setClearColor(0xffffff);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.scene=new THREE.Scene();this.root=new THREE.Group();this.scene.add(this.root);
  this.camera=new THREE.PerspectiveCamera(38,W/H,1,4000);this.distance=(H/2)/Math.tan(38*Math.PI/360);this.camera.position.z=this.distance;
  this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{photograph:{value:null},separation:{value:0},thickness:{value:30}},side:THREE.DoubleSide});
  this.lineMaterial=new THREE.ShaderMaterial({vertexShader,fragmentShader:'void main(){gl_FragColor=vec4(.35,.47,.54,.42);}',uniforms:this.material.uniforms,transparent:true,depthWrite:false});
  this.cache=new Map();this.yaw=0;this.pitch=0;this.texture=null;
 }
 setPhoto(canvas){
  for(const item of this.cache.values()){item.mesh.geometry.dispose();item.lines.geometry.dispose();}
  this.cache.clear();this.root.clear();this.texture?.dispose();this.texture=new THREE.CanvasTexture(canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;this.material.uniforms.photograph.value=this.texture;
  this.outline=traceMask(canvas);
 }
 build(level){
  const depth=level.seeds<=20?34:level.seeds<=100?25:level.seeds<=400?14:level.seeds<=1600?7:3;
  const arrays={position:[],normal:[],uv:[],cellCenter:[],cellRandom:[]},lineArrays={position:[],normal:[],uv:[],cellCenter:[],cellRandom:[]};
  for(const cell of level.cells){
   const ring=[];for(let i=0;i<cell.p.length;i+=2)ring.push([cell.p[i],cell.p[i+1]]);ring.push(ring[0]);
   let polys;
   if(level.seeds<=400&&this.outline.length){try{polys=window.polygonClipping.intersection([[ring]],this.outline);}catch{polys=[[ring]];}}
   else polys=[[ring]];
   for(const polygon of polys){
    const shape=new THREE.Shape(polygon[0].slice(0,-1).map(p=>new THREE.Vector2(p[0]-cell.cx,cell.cy-p[1])));
    for(const hole of polygon.slice(1))shape.holes.push(new THREE.Path(hole.slice(0,-1).map(p=>new THREE.Vector2(p[0]-cell.cx,cell.cy-p[1]))));
    let geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});
    const pos=geometry.attributes.position,norm=geometry.attributes.normal;
    for(let i=0;i<pos.count;i++){
     const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);arrays.position.push(x,y,z);arrays.normal.push(norm.getX(i),norm.getY(i),norm.getZ(i));
     arrays.uv.push((x+cell.cx)/W,1-(cell.cy-y)/H);arrays.cellCenter.push(cell.cx-W/2,H/2-cell.cy);arrays.cellRandom.push(cell.jitterX,cell.jitterY,cell.angle/.22);
    }
    {const edges=new THREE.EdgesGeometry(geometry,35),ep=edges.attributes.position;
     for(let i=0;i<ep.count;i++){lineArrays.position.push(ep.getX(i),ep.getY(i),ep.getZ(i));lineArrays.normal.push(0,0,1);lineArrays.uv.push(0,0);lineArrays.cellCenter.push(cell.cx-W/2,H/2-cell.cy);lineArrays.cellRandom.push(cell.jitterX,cell.jitterY,cell.angle/.22);}edges.dispose();}
    geometry.dispose();
   }
  }
  const createGeometry=data=>{const g=new THREE.BufferGeometry();for(const [name,size] of [['position',3],['normal',3],['uv',2],['cellCenter',2],['cellRandom',3]])g.setAttribute(name,new THREE.Float32BufferAttribute(data[name],size));return g;};
  const mesh=new THREE.Mesh(createGeometry(arrays),this.material),lines=new THREE.LineSegments(createGeometry(lineArrays),this.lineMaterial);mesh.frustumCulled=false;lines.frustumCulled=false;lines.renderOrder=1;
  const item={mesh,lines,depth};this.cache.set(level.seeds,item);return item;
 }
 draw(level,amount,boundaries){
  const item=this.cache.get(level.seeds)||this.build(level);this.root.clear();this.root.add(item.mesh);if(boundaries)this.root.add(item.lines);
  this.material.uniforms.separation.value=amount;this.material.uniforms.thickness.value=item.depth;
  this.root.rotation.set(this.pitch,this.yaw,0);this.root.scale.setScalar(1/(1+.54*amount));
  this.renderer.render(this.scene,this.camera);return this.renderer.domElement;
 }
 bindDrag(canvas,onChange){
  let drag=null;
  canvas.tabIndex=0;
  canvas.addEventListener('keydown',e=>{const k=e.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(k))return;e.preventDefault();if(k==='Home')this.resetView();else if(k==='ArrowLeft')this.yaw=Math.max(-.95,this.yaw-.08);else if(k==='ArrowRight')this.yaw=Math.min(.95,this.yaw+.08);else if(k==='ArrowUp')this.pitch=Math.max(-.8,this.pitch-.08);else this.pitch=Math.min(.8,this.pitch+.08);onChange();});
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;this.yaw=Math.max(-.95,Math.min(.95,drag.yaw+(e.clientX-drag.x)*.008));this.pitch=Math.max(-.8,Math.min(.8,drag.pitch+(e.clientY-drag.y)*.008));onChange();});
  const end=()=>{drag=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 }
 resetView(){this.yaw=0;this.pitch=0;}
}
