import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const M = (color, roughness = 0.88) => new THREE.MeshStandardMaterial({ color, roughness });

export class Town3D {
  constructor(canvas, shops, buildings, props) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a9c7d0');
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.dynamic = new THREE.Group();
    this.root.add(this.dynamic);
    this.cops = new Map();
    this.piles = [];
    this.clock = 0;
    this.lastPlayerPosition = null;
    this.build(shops, buildings, props);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  box(parent, x, y, z, w, h, d, material) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    o.castShadow = true;
    o.receiveShadow = true;
    o.position.set(x, y + h / 2, z);
    parent.add(o);
    return o;
  }

  ball(parent, x, y, z, sx, sy, sz, material, segments = 10) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 7), material);
    o.castShadow = true;
    o.receiveShadow = true;
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o;
  }

  pole(parent, x, y, z, rt, rb, h, material, sides = 9) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material);
    o.castShadow = true;
    o.receiveShadow = true;
    o.position.set(x, y + h / 2, z); parent.add(o); return o;
  }

  label(parent, text, x, y, z, background = '#665743') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const g = c.getContext('2d'); g.fillStyle = background; g.beginPath(); g.roundRect(8, 8, 496, 80, 16); g.fill();
    g.fillStyle = '#fff5df'; g.font = 'bold 42px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 49, 470);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    s.position.set(x, y, z); s.scale.set(112, 21, 1); parent.add(s); return s;
  }

  build(shops, buildings, props) {
    this.scene.add(new THREE.HemisphereLight('#f5f7df', '#657358', 1.45));
    const sun = new THREE.DirectionalLight('#fff0d3', 2.5);
    sun.position.set(-500, 1400, 700);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1250;
    sun.shadow.camera.right = 1250;
    sun.shadow.camera.top = 1050;
    sun.shadow.camera.bottom = -1050;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 3600;
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.00008;
    sun.shadow.radius = 3;
    sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(sun);
    this.makeGround(); this.makeRoads(); this.makePark();
    this.makeBuildings(shops, buildings); this.makeTrees(props, buildings);
    this.makeStreetLife(); this.makeResidents();
    this.dog = this.makeDog(); this.dynamic.add(this.dog);
  }

  makeGround() {
    // Keep the walkable surface at y=0 so characters sit on top instead of being buried.
    // A lower backing plane prevents z-fighting with the walkable surface details.
    this.box(this.root, 950, -2, 675, 2050, 1, 1510, M('#a8bb87'));
    for (const [x,z,w,d,c] of [[150,300,240,150,'#afc28f'],[730,280,185,140,'#91ad78'],[1110,330,180,145,'#b9c48e'],[1545,335,195,160,'#a0b57f'],[330,830,230,145,'#9eb980'],[1500,820,250,150,'#92ad78'],[260,1150,200,125,'#b1c28e'],[1120,1160,230,120,'#9db57d'],[1720,1180,220,130,'#b6c38c']]) this.box(this.root,x,-1,z,w,1,d,M(c));
    for (const [x,z,w,d] of [[350,430,330,34],[950,430,420,34],[1580,430,370,34],[350,680,360,34],[1570,680,360,34],[365,1005,410,32],[1510,1005,410,32]]) this.box(this.root,x,-1,z,w,1,d,M('#d4c9ad'));
  }

  makeRoads() {
    const asphalt=M('#777c78'), curb=M('#d6d0bb'), paint=M('#eee3c5');
    this.box(this.root,950,-1,557,2050,1,225,asphalt);
    for(const x of [515,1330]) this.box(this.root,x,-1,675,155,1,1510,asphalt);
    for(const [x,z,w,d] of [[950,438,2050,10],[950,676,2050,10],[436,675,10,1510],[594,675,10,1510],[1251,675,10,1510],[1409,675,10,1510]]) this.box(this.root,x,0,z,w,3,d,curb);
    this.box(this.root,950,0,557,2050,1,5,paint);
    for(const x of [515,1330]) this.box(this.root,x,0,675,4,1,1510,paint);
    for(let x=35;x<1900;x+=95)this.box(this.root,x,0,557,46,1,3,paint);
    for(const x of [515,1330]) for(let z=28;z<1330;z+=95)this.box(this.root,x,0,z,3,1,42,paint);
    for(const x of [515,1330])for(let i=-4;i<=4;i++)this.box(this.root,x+i*13,1,490,7,1,36,M('#f2ead5'));
    for(const x of [220,287,760,827,1495,1562,1730]){this.box(this.root,x,0,466,2,1,42,paint);this.box(this.root,x+55,0,466,2,1,42,paint)}
    this.box(this.root,950,0,458,2050,1,26,M('#d9d2bd'));
    this.box(this.root,950,0,656,2050,1,26,M('#d9d2bd'));
  }

  makePark() {
    this.box(this.root,990,-1,850,390,1,300,M('#8fb47b'));
    this.box(this.root,990,-1,835,315,1,34,M('#d7c89e'));
    this.box(this.root,990,-1,875,42,1,220,M('#d7c89e'));
    const base=new THREE.Mesh(new THREE.CylinderGeometry(43,43,5,24),M('#d9cfb8'));base.position.set(1090,7,920);this.root.add(base);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(27,30,12,24),M('#9caa9a'));bowl.position.set(1090,15,920);this.root.add(bowl);
    const water=new THREE.Mesh(new THREE.CylinderGeometry(22,22,2,24),M('#79b8b8'));water.position.set(1090,22,920);this.root.add(water);
    this.pole(this.root,1090,23,920,4,7,25,M('#d5c7a6'),12);this.ball(this.root,1090,51,920,7,7,7,M('#79b8b8'));
    this.box(this.root,875,7,930,56,7,34,M('#d88d62'));
    for(const x of [848,902])this.box(this.root,x,10,930,5,30,5,M('#6a7255'));
    this.box(this.root,1020,7,963,74,4,23,M('#627d54'));
    for(let i=0;i<8;i++)this.ball(this.root,990+i*9,13,963,4,5,4,M(['#e58b71','#e8c86d','#d5a5cc'][i%3]),7);
    this.bench(875,790);this.bench(1140,804,Math.PI/2);this.bench(930,962);
  }

  makeBuildings(shops, buildings) {
    const walls=['#e8d9b8','#d8cbb1','#e9c8a9','#c9d6c1','#e5d7c2','#d2c8b7'], roofs=['#a45f49','#8b6a51','#b47a56','#716e63','#995b4c'];
    const byPos=new Map(shops.map(s=>[`${s.x},${s.y}`,s]));
    buildings.forEach((b,i)=>{
      const shop=byPos.get(`${b.x},${b.y}`), g=new THREE.Group();g.position.set(b.x+b.w/2,0,b.y+b.h/2);this.root.add(g);
      const w=b.w,d=b.h,h=shop?82:78+(i%3)*15;
      this.box(g,0,0,0,w,h,d,M(shop?.color||walls[i%walls.length]));
      this.box(g,0,0,d/2+2,w+8,12,8,M('#c7b99d'));
      if(shop){
        this.box(g,0,h,0,w+22,13,d+22,M('#776d5d'));this.box(g,0,h+9,0,w+12,9,d+12,M(shop.color));
        this.box(g,0,20,d/2+4,w-26,53,5,M('#665646'));this.box(g,0,23,d/2+7,w-36,45,2,M('#86aeb0'));
        this.box(g,0,0,d/2+12,38,53,16,M('#7a503c'));this.box(g,0,27,d/2+21,2,48,2,M('#d7ba88'));
        this.box(g,0,73,d/2+1,w-14,4,8,M('#f3e5c7'));this.box(g,0,86,d/2+14,w+9,6,26,M('#fff0ce'));
        this.label(g,shop.name,0,91,d/2+29,shop.color);
        for(let x=-w/2+10;x<w/2;x+=19)this.box(g,x,58,d/2+14,18,3,26,M(Math.floor((x+w/2)/19)%2?'#f2e0bd':'#d87659'));
        this.box(g,-w/2+13,35,d/2+11,4,43,5,M('#f2e7d2'));this.box(g,w/2-13,35,d/2+11,4,43,5,M('#f2e7d2'));
        this.box(g,w/2+3,45,0,9,26,26,M('#e2d4b8'));this.box(g,w/2-20,h+19,-d/2+20,28,12,24,M('#8d9288'));
      } else {
        this.box(g,0,h/2,d/2+2,w-20,h-18,5,M('#f3e7d0'));
        const dx=i%2?-w*.24:w*.24;this.box(g,dx,0,d/2+6,25,48,8,M('#815840'));
        for(const wx of [-w*.25,w*.25])if(Math.abs(wx-dx)>22){
          this.box(g,wx,35,d/2+6,35,28,8,M('#86aeb0'));this.box(g,wx,35,d/2+11,4,31,3,M('#f2e7d2'));
          this.box(g,wx,35,d/2+11,39,4,3,M('#f2e7d2'));this.box(g,wx,50,d/2+8,42,5,13,M('#f2e7d2'));
        }
        const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.69,38,4),M(roofs[i%roofs.length]));roof.position.set(0,h+18,0);roof.rotation.y=Math.PI/4;g.add(roof);
        this.box(g,w*.27,h+48,-d*.12,13,36,15,M('#9a5945'));this.box(g,0,12,d/2+7,w-9,6,9,M('#d0b894'));
        if(i%3===0){this.box(g,0,h+4,d/2+3,w-14,9,8,M('#584a3d'));this.label(g,['CASA','LA PLAZA','CASA RURAL','PAN Y MÁS'][i%4],0,h+12,d/2+9)}
      }
      for(const side of [-1,1]){this.box(g,side*(w/2+3),35,-d*.18,5,26,31,M('#86aeb0'));this.box(g,side*(w/2+6),35,-d*.18,3,30,4,M('#f2e7d2'))}
    });
    this.church(1035,176);this.stall();this.wash();
  }

  church(x,z) {
    const g=new THREE.Group();g.position.set(x,0,z);this.root.add(g);
    this.box(g,0,0,0,106,108,116,M('#e7dec9'));this.box(g,0,0,61,118,12,10,M('#c3b79d'));
    this.box(g,0,108,0,116,12,126,M('#c3b79d'));this.box(g,0,43,64,28,56,8,M('#75543f'));
    for(const wx of [-33,33]){this.box(g,wx,62,63,18,34,6,M('#83aab0'));this.box(g,wx,62,67,3,40,3,M('#c3b79d'))}
    this.box(g,0,107,-8,40,112,42,M('#e7dec9'));this.box(g,0,218,-8,35,12,36,M('#c3b79d'));
    const spire=new THREE.Mesh(new THREE.ConeGeometry(32,64,4),M('#7a5141'));spire.position.set(0,255,-8);spire.rotation.y=Math.PI/4;g.add(spire);
    this.box(g,0,314,-8,4,27,4,M('#e5cf93'));this.label(g,'SAN ROQUE',0,124,66,'#87775f');
  }

  stall() {
    const g=new THREE.Group();g.position.set(987,0,786);this.root.add(g);
    this.box(g,0,0,0,150,56,88,M('#9e704d'));this.box(g,0,56,0,164,9,100,M('#a8513f'));
    for(let i=0;i<7;i++)this.box(g,-69+i*23,56,55,21,24,8,M(i%2?'#f0d7a8':'#d47a58'));
    this.box(g,0,35,48,130,22,6,M('#e3bb75'));this.label(g,'TÍO PACO · COMPRO BOTÍN',0,72,64,'#8e563f');
    for(let i=0;i<5;i++)this.ball(g,-48+i*23,68,0,9,8,9,M(['#cf7651','#d0a452','#8ba45d'][i%3]),9);
  }

  wash() {
    const g=new THREE.Group();g.position.set(350,0,890);this.root.add(g);
    this.box(g,0,0,0,150,55,90,M('#a8ccca'));this.box(g,0,55,0,160,10,100,M('#577d79'));
    this.box(g,0,18,49,126,33,7,M('#dce5d2'));this.box(g,0,15,55,86,15,4,M('#7bb9bb'));
    for(const x of [-43,43]){this.pole(g,x,34,55,3,3,17,M('#ded6bf'));this.ball(g,x,54,55,5,5,5,M('#e9efe1'))}
    this.label(g,'DUCHAS CANINAS',0,72,59,'#477578');
  }

  tree(x,z,r,color) {
    const g=new THREE.Group();g.position.set(x,0,z);this.root.add(g);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,14),M('#6e735c'));shadow.rotation.x=-Math.PI/2;shadow.position.y=1;shadow.scale.set(r*1.25,r*.7,1);g.add(shadow);
    this.pole(g,0,1,0,4,6,24,M('#77583e'),7);
    this.ball(g,-r*.32,36,0,r*.78,r*.65,r*.72,M(color),9);
    this.ball(g,r*.34,39,-r*.1,r*.72,r*.68,r*.75,M(color),9);
    this.ball(g,0,50,0,r*.65,r*.63,r*.67,M(color),9);
  }

  makeTrees(props, buildings) {
    const greens=['#557d50','#668a55','#79975c','#4f7550','#8ca467'];
    const blocked=(x,z)=>buildings.some(b=>x>b.x-35&&x<b.x+b.w+35&&z>b.y-35&&z<b.y+b.h+35)||(z>445&&z<670)||(x>790&&x<1190&&z>700&&z<1000);
    for(const p of props)if(!blocked(p.x,p.y))this.tree(p.x,p.y,p.r,greens[p.type%greens.length]);
    for(let i=0;i<18;i++){const x=42+(i*311)%1815,z=145+(i*197)%1160;if(!blocked(x,z))this.tree(x,z,12+(i%4)*2,greens[i%greens.length])}
    for(const [x,z] of [[250,427],[440,685],[790,425],[1170,684],[1500,428],[1680,685],[750,1005],[1300,1007]]){
      this.box(this.root,x,5,z,76,11,24,M('#8b7257'));this.box(this.root,x,16,z,67,12,18,M('#78965e'));
      for(let i=0;i<5;i++)this.ball(this.root,x-26+i*13,28,z,4,4,4,M(i%2?'#e1a6a4':'#e5cb72'),7);
    }
  }

  bench(x,z,rotation=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;this.root.add(g);
    this.box(g,0,13,0,46,6,13,M('#805a3b'));this.box(g,0,23,-4,46,17,5,M('#a8794e'));
    for(const sx of [-17,17]){this.box(g,sx,0,0,5,14,5,M('#554735'));this.box(g,sx,0,-4,5,22,4,M('#554735'))}
  }

  hydrant(x,z) {
    this.pole(this.root,x,2,z,7,9,24,M('#c65e4d'),10);this.box(this.root,x,13,z,21,6,12,M('#e28863'));
    this.pole(this.root,x,24,z,4,5,5,M('#b94c43'),10);this.ball(this.root,x,30,z,5,4,5,M('#4b7352'),8);
  }

  lamp(x,z) {
    this.pole(this.root,x,0,z,3,4,118,M('#545951'),8);this.box(this.root,x,110,z,22,5,20,M('#545951'));
    this.ball(this.root,x,124,z,8,11,8,M('#f3d996'),8);
  }

  makeCar(x,z,rotation,color) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;this.root.add(g);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,14),M('#59645c'));shadow.rotation.x=-Math.PI/2;shadow.position.y=2;shadow.scale.set(30,16,1);g.add(shadow);
    this.box(g,0,5,0,51,13,25,M(color));this.box(g,0,17,-1,28,12,20,M(color));this.box(g,0,18,0,23,9,17,M('#8cabb0'));
    for(const wx of [-17,17])for(const wz of [-11,11]){const wheel=this.pole(g,wx,0,wz,5,5,4,M('#353a37'),10);wheel.rotation.z=Math.PI/2}
    for(const side of [-1,1]){this.box(g,side*27,8,0,3,5,6,M('#efe0b3'));this.box(g,-side*26,8,0,3,5,6,M('#a84943'))}
  }

  makeStreetLife() {
    for(const [x,z,r] of [[880,810,0],[1140,900,Math.PI/2],[350,480,0],[1520,480,Math.PI/2],[480,690,0],[690,965,Math.PI/2],[1200,820,0]])this.bench(x,z,r);
    for(const [x,z] of [[490,610],[1175,621],[1720,630],[730,455],[1430,686]])this.hydrant(x,z);
    for(const [x,z] of [[470,470],[620,468],[1270,470],[1450,468],[468,700],[1380,700],[760,1008],[1220,1008]])this.lamp(x,z);
    for(const [x,z] of [[550,690],[1260,690],[1185,1012]]){this.pole(this.root,x,0,z,10,12,30,M('#5f8569'),10);this.box(this.root,x,30,z,22,5,22,M('#536e5b'))}
    this.box(this.root,760,0,1009,75,5,6,M('#755840'));this.box(this.root,760,5,1009,59,48,3,M('#dfd2ad'));
    this.box(this.root,760,53,1009,81,8,10,M('#667b68'));this.label(this.root,'AUTOBÚS · 12:30',760,32,1012,'#66806f');
    const colors=['#c96d58','#628998','#d6ae5d','#788b68','#e2dfd1'];
    [[220,480,0],[287,480,0],[760,480,0],[827,480,0],[1495,480,0],[1562,480,0],[1730,480,0],[700,710,Math.PI/2],[1415,716,Math.PI/2]].forEach((p,i)=>this.makeCar(...p,colors[i%colors.length]));
  }

  human(x,z,options={}) {
    const g=new THREE.Group();g.position.set(x,0,z);this.dynamic.add(g);
    const skin=M(options.skin||'#d8a57e'), clothes=M(options.clothes||'#587e67'), pants=M(options.pants||'#4b5260'), hair=M(options.hair||'#514137');
    const torso=this.box(g,0,19,0,15,22,9,clothes);this.box(g,0,37,0,12,10,11,skin);
    this.ball(g,0,46,0,8,9,8,skin,9);this.ball(g,0,53,0,8,4,8,hair,8);
    const legs=[], arms=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*4,15,0);g.add(leg);
      this.box(leg,0,-14,0,5,15,6,pants);this.box(leg,0,-14,3,6,4,9,M('#413d38'));
      legs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*9,34,0);g.add(arm);
      this.box(arm,0,-16,0,5,18,6,clothes);this.ball(arm,0,-16,1,3,3,3,skin,7);arms.push(arm);
    }
    if(options.apron){this.box(g,0,21,5,10,17,2,M(options.apron));this.box(g,0,37,5,8,2,2,M('#e5d7b6'))}
    if(options.hat){this.ball(g,0,53,0,9,3,9,M(options.hat),8);this.box(g,0,52,6,13,2,6,M(options.hat))}
    if(options.bag){this.box(g,-9,24,-3,8,11,6,M(options.bag))}
    if(options.phone){this.box(g,11,29,5,2,6,2,M('#282b29'))}
    g.userData.torso=torso;g.userData.arms=arms;g.userData.legs=legs;g.userData.phase=Math.random()*Math.PI*2;g.userData.sway=options.sway||0;
    return g;
  }

  makeResidents() {
    const outfits=[['#627f6c','#43515a'],['#bd7458','#55515a'],['#577792','#665747'],['#d0a34f','#55534c'],['#8d7395','#46505a']];
    this.residents=[];
    for(let i=0;i<5;i++){
      const s=[[270,240,205,150],[830,225,205,150],[1430,245,205,150],[1480,915,215,160],[700,1035,205,150]][i];
      const [shirt,pants]=outfits[i];
      const owner=this.human(s[0]+s[2]*.34,s[1]+s[3]+30,{clothes:shirt,pants,apron:i===0?'#d8c49c':null,hat:i===2?'#73804f':null});
      const worker=this.human(s[0]+s[2]*.68,s[1]+s[3]+42,{clothes:outfits[(i+2)%outfits.length][0],pants:outfits[(i+2)%outfits.length][1],apron:i===1?'#e7d8ba':null,hat:i===4?'#a95b48':null});
      const customer=this.human(s[0]+s[2]/2-23,s[1]+s[3]+76,{clothes:outfits[(i+1)%outfits.length][0],pants:outfits[(i+1)%outfits.length][1],bag:'#9b7551',phone:i%2===0});
      this.residents.push({mesh:owner,kind:'shopkeeper',offset:0},{mesh:worker,kind:'worker',offset:1.2},{mesh:customer,kind:'customer',offset:2.4});
    }
    const passers=[[650,545],[730,587],[1210,548],[1500,575],[450,760],[1365,820],[1040,1000],[600,980]];
    passers.forEach((p,i)=>this.residents.push({mesh:this.human(p[0],p[1],{clothes:outfits[i%5][0],pants:outfits[i%5][1],bag:i%3===0?'#8f714b':null}),kind:'passer',offset:i*.7}));
    this.createHobo();
  }

  createHobo() {
    const g=new THREE.Group();g.position.set(1056,0,837);g.rotation.y=-.32;this.dynamic.add(g);
    const rag=M('#8b7557'), pants=M('#514a40'), skin=M('#b48160'), dark=M('#493b32');
    // Reclining full-body silhouette: legs, torso and head remain distinct above the ground.
    const body=this.box(g,-1,5,0,34,14,17,rag);body.rotation.z=-.08;
    this.box(g,-24,3,0,19,8,13,pants).rotation.z=.08;
    this.box(g,-37,2,2,12,5,10,M('#67503e'));
    this.box(g,-39,1,4,12,2,11,M('#342f2a'));
    this.ball(g,22,14,2,10,9,9,skin,10);
    this.ball(g,20,8,7,8,5,4,M('#78604b'),8);
    this.ball(g,17,15,10,1.3,1.3,1.3,dark,7);
    this.ball(g,25,15,10,1.3,1.3,1.3,dark,7);
    this.ball(g,30,13,8,2,2,2,dark,7);
    this.ball(g,21,23,1,10,4,9,M('#594638'),8);
    this.box(g,23,20,6,14,3,7,M('#594638'));
    const arm=this.ball(g,8,10,10,13,4,4,rag,8);arm.rotation.z=-.1;
    this.ball(g,18,8,12,4,3,3,skin,8);
    const cig=this.box(g,32,12,8,8,1,1,M('#e1d2b5'));cig.rotation.z=-.08;
    this.ball(g,37,12,8,2,2,2,M('#ee7453'),7);
    const smoke=[];
    for(let i=0;i<3;i++){const puff=this.ball(g,38+i*3,17+i*7,8,3+i*.7,3+i*.7,3+i*.7,new THREE.MeshStandardMaterial({color:'#dedbd0',transparent:true,opacity:.34,roughness:1}),8);smoke.push(puff)}
    this.vendorSmoke=smoke;this.hobo=g;this.hoboBody=body;
  }

  makeDog() {
    const g=new THREE.Group();
    const fur=M('#9a704e'), light=M('#b9946e'), dark=M('#553b2b');
    const body=this.ball(g,-2,13,0,23,12,13,fur,12);
    const head=new THREE.Group();head.position.set(14,17,0);g.add(head);
    this.ball(head,0,0,0,12,9,9,light,10);
    this.ball(head,-3,8,-5,5,8,4,dark,8);this.ball(head,5,8,-5,5,8,4,dark,8);
    this.ball(head,2,2,7,2,2,2,M('#25251f'),8);this.ball(head,10,0,2,3,3,3,M('#25251f'),8);
    const tail=this.pole(g,-24,13,0,2,3,15,dark,8);tail.rotation.z=.7;
    const legs=[];
    for(const x of [-14,7])for(const z of [-8,8]){
      const leg=new THREE.Group();leg.position.set(x,9,z);g.add(leg);
      this.box(leg,0,-9,0,4,9,5,dark);legs.push(leg);
    }
    g.userData.fur=fur;g.userData.light=light;g.userData.body=body;g.userData.head=head;g.userData.legs=legs;g.userData.tail=tail;
    return g;
  }

  addCop() {
    const g=new THREE.Group();
    const blue=M('#426b8d'), navy=M('#27384a');
    this.box(g,0,13,0,14,18,10,blue);this.ball(g,0,29,0,7,8,7,M('#d9ad84'),9);
    this.ball(g,0,36,0,8,3,8,navy,8);this.box(g,0,35,5,11,2,5,navy);
    this.box(g,-5,3,0,4,8,5,navy);this.box(g,5,3,0,4,8,5,navy);
    this.ball(g,-4,20,6,2,2,2,M('#eee2be'),7);
    g.userData.flash=this.ball(g,-5,15,7,2,2,2,M('#fa6b62'),7);
    return g;
  }

  addPoop() {
    const g=new THREE.Group();
    this.ball(g,0,4,0,8,4,7,M('#705037'),8);this.ball(g,-2,8,0,5,4,5,M('#805c3d'),8);this.ball(g,1,11,0,2,3,2,M('#916945'),7);
    this.dynamic.add(g);return g;
  }

  resize() {
    const width=this.canvas.clientWidth||innerWidth,height=this.canvas.clientHeight||innerHeight;
    this.renderer.setSize(width,height,false);
    const aspect=width/height, viewHeight=Math.max(550,height*1.45);
    this.camera.left=-viewHeight*aspect/2;this.camera.right=viewHeight*aspect/2;
    this.camera.top=viewHeight/2;this.camera.bottom=-viewHeight/2;this.camera.updateProjectionMatrix();
  }

  sync(state) {
    const {player,cops,piles,camera,viewport,dt=0}=state;
    const focusX=camera.x+viewport.width/2, focusZ=camera.y+viewport.height/2;
    this.camera.position.set(focusX,1450,focusZ+1250);this.camera.lookAt(focusX,0,focusZ);
    const at=(obj,x,z,y=0)=>{obj.position.set(x,y,z);};
    let moveSpeed=0;
    if(this.lastPlayerPosition&&dt>0){
      moveSpeed=Math.hypot(player.x-this.lastPlayerPosition.x,player.y-this.lastPlayerPosition.y)/dt;
    }
    this.lastPlayerPosition={x:player.x,y:player.y};
    const gait=Math.min(1,moveSpeed/105), gaitPhase=this.clock*15;
    at(this.dog,player.x,player.y,player.jumpHeight||0);this.dog.rotation.y=player.dir<0?Math.PI:0;
    this.dog.userData.fur.color.set(player.clean>0?'#d9b786':'#9a704e');
    this.dog.userData.light.color.set(player.clean>0?'#f0d9b0':'#b9946e');
    this.dog.userData.body.position.y=13+Math.abs(Math.sin(gaitPhase))*1.5*gait;
    this.dog.userData.head.rotation.z=Math.sin(gaitPhase+0.6)*.06*gait;
    this.dog.userData.legs.forEach((leg,i)=>{
      const diagonal=(i===0||i===3)?0:Math.PI;
      leg.rotation.z=Math.sin(gaitPhase+diagonal)*.48*gait;
    });
    this.dog.userData.tail.rotation.z=.7+Math.sin(this.clock*9)*(.16+.22*gait);
    while(this.cops.size<cops.length){const mesh=this.addCop();this.dynamic.add(mesh);this.cops.set(this.cops.size,mesh)}
    for(let i=0;i<this.cops.size;i++){const mesh=this.cops.get(i),cop=cops[i];mesh.visible=!!cop;if(cop){at(mesh,cop.x,cop.y,0);mesh.userData.flash.material.color.set(this.clock%0.5<.25?'#fa6b62':'#6aa8fa')}}
    while(this.piles.length<piles.length)this.piles.push(this.addPoop());
    this.piles.forEach((mesh,i)=>{const p=piles[i];mesh.visible=!!p;if(p)at(mesh,p.x,p.y,0)});
    this.clock+=dt;
    for(const person of this.residents){
      const mesh=person.mesh, phase=this.clock*6+person.offset, walking=person.kind==='passer';
      mesh.position.y=Math.sin(phase)*.18;
      mesh.userData.legs.forEach((leg,i)=>{leg.rotation.z=Math.sin(phase+(i?Math.PI:0))*(walking?.34:.045)});
      mesh.userData.arms.forEach((arm,i)=>{arm.rotation.z=Math.sin(phase+(i?0:Math.PI))*(walking?.24:.055)});
      mesh.rotation.z=Math.sin(phase)*.018;
      if(walking)mesh.rotation.y=Math.sin(this.clock*.65+person.offset)*.22;
    }
    this.hobo.rotation.z=Math.sin(this.clock*1.6)*.025;
    this.hoboBody.scale.y=1+Math.sin(this.clock*1.8)*.012;
    this.vendorSmoke.forEach((p,i)=>{const t=(this.clock*1.1+i*.36)%1;p.position.y=17+i*7+t*23;p.position.x=34+i*3+Math.sin(this.clock*2+i)*3;p.material.opacity=.3*(1-t);p.scale.setScalar(.7+t*.7)});
    this.renderer.render(this.scene,this.camera);
  }
}

