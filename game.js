import { Town3D } from './town3d.js';

(() => {
  const canvas = document.querySelector('#game');
  const ctx = document.createElement('canvas').getContext('2d');
  const cashEl = document.querySelector('#cash');
  const lootEl = document.querySelector('#loot');
  const cleanEl = document.querySelector('#clean');
  const wantedEl = document.querySelector('#wanted');
  const wantedFill = document.querySelector('#wantedFill');
  const toastEl = document.querySelector('#toast');
  const W = 1900, H = 1350;
  const keys = new Set();
  const held = new Set();
  const player = { x: 470, y: 545, r: 15, dir: 1, speed: 190, clean: 0, money: 0, loot: [], poops: 2, poopWait: 0, invuln: 0 };
  const vendors = [{x:990,y:797,name:'TÍO PACO',kind:'vendor'},{x:350,y:890,name:'DUCHAS CANINAS',kind:'bath'}];
  const shops = [
    {x:270,y:240,w:205,h:150,name:'MINI SÚPER',icon:'🥫',color:'#f4bd68',stock:3,price:15},
    {x:830,y:225,w:205,h:150,name:'TIENDA DE BARRIO',icon:'🧀',color:'#ee9270',stock:3,price:19},
    {x:1430,y:245,w:205,h:150,name:'PUESTO DE FRUTA',icon:'🍎',color:'#a9c77d',stock:3,price:17},
    {x:1480,y:915,w:215,h:160,name:'PELUQUERÍA CANINA',icon:'🎀',color:'#c6a0d4',stock:3,price:22},
    {x:700,y:1035,w:205,h:150,name:'QUIOSCO',icon:'📰',color:'#83b9bd',stock:3,price:16}
  ];
  const buildings = shops.map(s=>({x:s.x,y:s.y,w:s.w,h:s.h})).concat([
    {x:65,y:210,w:115,h:190},{x:595,y:195,w:120,h:205},{x:1130,y:210,w:135,h:190},{x:1720,y:210,w:115,h:200},
    {x:80,y:695,w:140,h:210},{x:600,y:730,w:160,h:170},{x:1200,y:690,w:160,h:200},{x:1620,y:680,w:220,h:190},
    {x:80,y:1035,w:155,h:180},{x:1120,y:1050,w:180,h:170},{x:1420,y:1120,w:240,h:120}
  ]);
  const cops = [];
  const poopPiles = [];
  const props = [];
  for(let i=0;i<34;i++) props.push({x:80+(i*193)%1740,y:145+(i*277)%1080,r:10+(i*7)%12,type:i%3});
  let running=false, last=performance.now(), camera={x:0,y:0}, toastTimer=0, wanted=0, alertTimer=0, robberyCount=0, showered=false, won=false, elapsed=0, poopRegen=0, arresting=false, arrestTimer=0;
  let canvasW=innerWidth,canvasH=innerHeight,dpr=1;
  function resize(){dpr=Math.min(devicePixelRatio||1,2);canvasW=canvas.clientWidth;canvasH=canvas.clientHeight;canvas.width=Math.floor(canvasW*dpr);canvas.height=Math.floor(canvasH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  let town;
  try { town = new Town3D(canvas,shops,buildings,props); }
  catch (error) { console.error('No se pudo iniciar el mapa 3D:',error); }
  function toast(text){toastEl.textContent=text;toastEl.classList.add('show');toastTimer=2.25}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function closestTarget(){let list=[...shops.map(o=>({...o,kind:'shop',obj:o})),...vendors.map(o=>({...o,r:35,obj:o}))];let near=list.map(o=>({o,d:Math.hypot(player.x-(o.kind==='shop'?o.x+o.w/2:o.x),player.y-(o.kind==='shop'?o.y+o.h/2:o.y))})).filter(a=>a.d<(a.o.kind==='shop'?Math.hypot(a.o.w/2,a.o.h/2)+40:65)).sort((a,b)=>a.d-b.d);return near[0]?.o}
  function interact(){if(!running)return;const t=closestTarget();if(!t){toast('No hay nada interesante por aquí.');return}
    if(t.kind==='shop'){
      const s=t.obj;if(s.stock<=0){toast('Está todo vendido... o vigilado.');return}
      if(player.loot.length>=5){toast('La mochila está llena. ¡Busca a Tío Paco!');return}
      s.stock--;player.loot.push({name:s.name,price:s.price+Math.floor(Math.random()*7)});robberyCount++;wanted=Math.min(100,wanted+48);alertTimer=15;toast(`¡${s.icon} al saco! ¡La poli ya viene!`);spawnCops();updateHud();return;
    }
    if(t.kind==='vendor'){
      if(!player.loot.length){toast('Tío Paco: vuelve cuando tengas algo para vender.');return}
      const amount=player.loot.reduce((n,a)=>n+a.price,0);player.loot=[];player.money+=amount;toast(`Tío Paco te da ${amount} monedas. ¡Buen trato!`);updateHud();checkWin();return;
    }
    if(t.kind==='bath'){
      if(player.clean>=3){toast('¡Ya estás más limpio que un plato lamido!');return}
      const cost=20+player.clean*10;
      if(player.money<cost){toast(`Un baño cuesta ${cost} monedas. Aún te faltan ${cost-player.money}.`);return}
      player.money-=cost;player.clean++;player.speed+=24;showered=true;toast(player.clean===1?'¡Baño calentito! Hueles a perro nuevo.':'¡Corte, baño y uñas! Qué elegancia.');updateHud();checkWin();return;
    }
  }
  function poop(){if(!running)return;if(player.poopWait>0){toast('Aguanta un poco, la naturaleza tiene sus tiempos.');return}if(player.poops<=0){toast('No te queda munición... por ahora.');return}
    player.poops--;player.poopWait=12;poopPiles.push({x:player.x-player.dir*16,y:player.y+10,life:18});let distracted=0;
    for(const c of cops)if(dist(c,player)<245){c.distract=4.2;distracted++}
    if(distracted)toast('¡PLOP! El agente se distrae. ¡Corre, Chucho!');else toast('¡PLOP! Un recuerdo para el barrio.');updateHud();
  }
  function spawnCops(){if(!cops.length){cops.push({x:player.x+310,y:player.y-280,r:14,speed:122,distract:0,dx:0,dy:0});cops.push({x:player.x-340,y:player.y+220,r:14,speed:110,distract:0,dx:0,dy:0})}else if(cops.length<4&&wanted>70)cops.push({x:player.x+360,y:player.y+230,r:14,speed:115,distract:0,dx:0,dy:0})}
  function updateHud(){cashEl.textContent=player.money;lootEl.textContent=player.loot.length;cleanEl.textContent=player.clean+'/3';document.querySelector('#poops').textContent=player.poops;wantedEl.classList.toggle('active',wanted>0);wantedFill.style.width=wanted+'%';document.querySelector('#mission').innerHTML=player.money>=60&&showered?'<span>★</span> ¡Objetivo cumplido! Chucho ya es todo un señor perro.':`<span>★</span> Junta <b>60 monedas</b> y date un baño para ser el perro más elegante del barrio.`}
  function checkWin(){if(!won&&player.money>=60&&showered){won=true;document.querySelector('#winStats').innerHTML=`<span>🪙 ${player.money} monedas</span><span>🎒 ${robberyCount} botines</span><span>🫧 ${player.clean} baños</span>`;document.querySelector('#win').classList.remove('hidden')}}
  function start(){document.querySelector('#intro').classList.add('hidden');running=true;last=performance.now();toast('¡A la aventura, Chucho! Busca una tienda.');requestAnimationFrame(frame)}
  document.querySelector('#startBtn').addEventListener('click',start);
  document.querySelector('#helpBtn').addEventListener('click',()=>{document.querySelector('#help').classList.remove('hidden');running=false});
  function closeHelp(){document.querySelector('#help').classList.add('hidden');if(!document.querySelector('#intro').classList.contains('hidden'))return;running=true;last=performance.now();requestAnimationFrame(frame)}
  document.querySelector('#closeHelp').addEventListener('click',closeHelp);document.querySelector('#backBtn').addEventListener('click',closeHelp);
  document.querySelector('#keepPlaying').addEventListener('click',()=>document.querySelector('#win').classList.add('hidden'));
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if((k==='e'||k==='enter')&&!e.repeat)interact();if(k===' '&&!e.repeat)poop()});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('[data-dir]').forEach(b=>{const d=b.dataset.dir;const down=e=>{e.preventDefault();held.add(d)};const up=e=>{e.preventDefault();held.delete(d)};b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,up))});
  document.querySelector('#touchInteract').addEventListener('pointerdown',e=>{e.preventDefault();interact()});document.querySelector('#touchPoop').addEventListener('pointerdown',e=>{e.preventDefault();poop()});
  function collides(x,y){return buildings.some(b=>x+player.r>b.x&&x-player.r<b.x+b.w&&y+player.r>b.y&&y-player.r<b.y+b.h)}
  function beginArrest(){arresting=true;arrestTimer=0;const lost=player.loot.length;player.loot=[];wanted=0;alertTimer=0;cops.length=0;document.querySelector('#arrestText').textContent=lost?`El agente te esposa y confisca tus ${lost} objetos de botín.`:'El agente te esposa y te lleva a dar una vuelta por comisaría.';document.querySelector('#arrestTitle').textContent='¡TE PILLARON!';document.querySelector('#arrest').classList.remove('hidden');updateHud()}
  function finishArrest(){arresting=false;document.querySelector('#arrest').classList.add('hidden');player.x=990;player.y=900;player.dir=1;player.invuln=2;camera.x=Math.max(0,Math.min(W-canvasW,player.x-canvasW/2));camera.y=Math.max(0,Math.min(H-canvasH,player.y-canvasH/2));updateHud();toast('¡Libre! Chucho reaparece en el parque. ¡A seguir!')}
  function update(dt){if(arresting){arrestTimer+=dt;if(arrestTimer>=1.55&&document.querySelector('#arrestTitle').textContent==='¡TE PILLARON!'){document.querySelector('#arrestTitle').textContent='RUMBO A COMISARÍA';document.querySelector('#arrestText').textContent='Un ratito después, Chucho vuelve al barrio...'}if(arrestTimer>=3.8)finishArrest();return}elapsed+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastEl.classList.remove('show')}
    player.poopWait=Math.max(0,player.poopWait-dt);player.invuln=Math.max(0,player.invuln-dt);if(player.poops<2){poopRegen+=dt;if(poopRegen>=18){player.poops++;poopRegen=0;updateHud()}}
    let dx=0,dy=0;if(keys.has('w')||keys.has('arrowup')||held.has('up'))dy--;if(keys.has('s')||keys.has('arrowdown')||held.has('down'))dy++;if(keys.has('a')||keys.has('arrowleft')||held.has('left'))dx--;if(keys.has('d')||keys.has('arrowright')||held.has('right'))dx++;
    if(dx||dy){const n=Math.hypot(dx,dy);dx/=n;dy/=n;player.dir=dx<0?-1:dx>0?1:player.dir;let nx=Math.max(22,Math.min(W-22,player.x+dx*player.speed*dt)),ny=Math.max(110,Math.min(H-22,player.y+dy*player.speed*dt));if(!collides(nx,player.y))player.x=nx;if(!collides(player.x,ny))player.y=ny}
    for(const p of poopPiles)p.life-=dt;while(poopPiles.length&&poopPiles[0].life<=0)poopPiles.shift();
    if(alertTimer>0){alertTimer-=dt;wanted=Math.max(0,wanted-dt*3.1)}else if(cops.length)wanted=Math.max(0,wanted-dt*5.2);
    for(let i=cops.length-1;i>=0;i--){const c=cops[i];if(c.distract>0){c.distract-=dt;let p=poopPiles.reduce((a,b)=>!a||dist(b,c)<dist(a,c)?b:a,null);if(p){let a=Math.atan2(p.y-c.y,p.x-c.x);c.x+=Math.cos(a)*c.speed*.72*dt;c.y+=Math.sin(a)*c.speed*.72*dt}continue}
      const d=dist(c,player);if(d>760&&alertTimer<=0){cops.splice(i,1);continue}if(d<20&&player.invuln<=0){beginArrest();return}
      else{const a=Math.atan2(player.y-c.y,player.x-c.x),speed=c.speed*(c.distract?0.7:1);c.x+=Math.cos(a)*speed*dt;c.y+=Math.sin(a)*speed*dt}
    }
    const t=closestTarget();if(t&&Math.random()<dt*.08){const label=t.kind==='shop'?`E · HUSMEAR EN ${t.name}`:t.kind==='vendor'?'E · VENDER BOTÍN A TÍO PACO':'E · DUCHA Y ARREGLO';toast(label)}
    camera.x=Math.max(0,Math.min(W-canvasW,camera.x+(player.x-canvasW/2-camera.x)*Math.min(1,dt*5)));camera.y=Math.max(0,Math.min(H-canvasH,camera.y+(player.y-canvasH/2-camera.y)*Math.min(1,dt*5)));
  }
  function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
  function text(str,x,y,size,color,weight='700',align='center'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px "DM Sans", sans-serif`;ctx.textAlign=align;ctx.fillText(str,x,y)}
  function drawWorld(){ctx.fillStyle='#b9cc91';ctx.fillRect(0,0,W,H);
    // grassy city blocks, paved avenues
    ctx.fillStyle='#d5d0ae';ctx.fillRect(0,445,W,225);ctx.fillRect(520,0,155, H);ctx.fillRect(1260,0,150,H);
    ctx.fillStyle='#eee3c5';for(let x=0;x<W;x+=78){ctx.fillRect(x,455,40,4);ctx.fillRect(x,657,40,4)}for(let y=0;y<H;y+=78){ctx.fillRect(525,y,4,40);ctx.fillRect(1265,y,4,40)}
    ctx.fillStyle='#f6efdb';ctx.fillRect(0,525,W,65);ctx.fillRect(560,0,65,H);ctx.fillRect(1300,0,65,H);
    ctx.strokeStyle='#c2b69a';ctx.lineWidth=2;ctx.setLineDash([17,15]);ctx.beginPath();ctx.moveTo(0,557);ctx.lineTo(W,557);ctx.moveTo(590,0);ctx.lineTo(590,H);ctx.moveTo(1330,0);ctx.lineTo(1330,H);ctx.stroke();ctx.setLineDash([]);
    // park
    ctx.fillStyle='#97bd7f';ctx.beginPath();ctx.roundRect(795,700,390,300,30);ctx.fill();ctx.strokeStyle='#759d68';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#d6c99e';ctx.beginPath();ctx.roundRect(830,835,315,38,19);ctx.fill();ctx.beginPath();ctx.roundRect(955,720,40,260,20);ctx.fill();
    // trees
    for(const p of props){ctx.fillStyle='#789765';ctx.beginPath();ctx.ellipse(p.x+4,p.y+9,p.r*1.1,p.r*.7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=['#60865c','#749769','#8baa6d'][p.type];ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9fbc7b';ctx.beginPath();ctx.arc(p.x-p.r*.25,p.y-p.r*.3,p.r*.48,0,Math.PI*2);ctx.fill()}
    // buildings & shop fronts
    for(const s of shops){ctx.fillStyle='#948b72';ctx.fillRect(s.x+6,s.y+8,s.w,s.h);ctx.fillStyle='#f3e7c9';ctx.fillRect(s.x,s.y,s.w,s.h);ctx.fillStyle=s.color;ctx.fillRect(s.x,s.y,s.w,38);ctx.fillStyle='#fff5de';ctx.fillRect(s.x+15,s.y+52,s.w-30,s.h-67);ctx.fillStyle='#aac7c2';ctx.fillRect(s.x+27,s.y+62,53,52);ctx.fillRect(s.x+s.w-80,s.y+62,53,52);ctx.fillStyle='#b88052';ctx.fillRect(s.x+s.w/2-19,s.y+s.h-49,38,49);ctx.fillStyle='#ffdf8d';ctx.beginPath();ctx.arc(s.x+s.w/2+9,s.y+s.h-25,3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=s.color;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(s.x+i*s.w/8,s.y+38);ctx.lineTo(s.x+(i+.5)*s.w/8,s.y+50);ctx.lineTo(s.x+(i+1)*s.w/8,s.y+38);ctx.fill()}
      text(s.name,s.x+s.w/2,s.y+26,12,'#29352a','800');text(s.icon,s.x+s.w/2,s.y+s.h-12,22,'#fff','600');if(s.stock===0){roundRect(s.x,s.y,s.w,s.h,8,'#1b281d99');text('CERRADO POR HOY',s.x+s.w/2,s.y+s.h/2,13,'#fff','800')}
    }
    // vendor stall
    roundRect(910,742,154,95,10,'#da9a5c','#6e5940');ctx.fillStyle='#a65943';ctx.fillRect(908,735,158,24);text('TÍO PACO',987,777,13,'#fff4d8','800');text('COMPRO BOTÍN',987,798,9,'#492f23','700');text('🧢',987,829,25,'#fff');
    // wash station
    roundRect(275,846,154,100,10,'#89bfc0','#557c7b');ctx.fillStyle='#eef2d8';ctx.fillRect(289,862,126,56);text('DUCHAS',352,882,13,'#315152','800');text('🫧  🐾  🫧',352,908,16,'#315152');
    // benches and hydrants
    for(const [x,y] of [[880,810],[1080,905],[350,480],[1520,480],[480,690]]){ctx.fillStyle='#805b3b';ctx.fillRect(x-19,y,38,6);ctx.fillRect(x-15,y+6,4,10);ctx.fillRect(x+11,y+6,4,10)}
    for(const [x,y] of [[490,610],[1175,621],[1720,630]]){ctx.fillStyle='#dc7357';ctx.fillRect(x-7,y,14,24);ctx.fillRect(x-11,y+5,22,6);ctx.fillRect(x-4,y-6,8,7)}
  }
  function drawDog(x,y){ctx.save();ctx.translate(x,y);ctx.scale(player.dir,1);ctx.fillStyle='#354135';ctx.beginPath();ctx.ellipse(1,8,19,6,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#714a32';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-14,-3);ctx.quadraticCurveTo(-26,-15,-24,-23);ctx.stroke();ctx.fillStyle=player.clean>0?'#d9b786':'#9a704e';ctx.beginPath();ctx.ellipse(0,0,17,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=player.clean>0?'#f0d9b0':'#b9946e';ctx.beginPath();ctx.ellipse(12,-5,11,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#674531';ctx.beginPath();ctx.ellipse(7,-13,5,9,-.35,0,Math.PI*2);ctx.ellipse(17,-13,5,9,.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#252920';ctx.beginPath();ctx.arc(16,-7,1.8,0,Math.PI*2);ctx.arc(24,-3,2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6b472e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,9);ctx.lineTo(-11,15);ctx.moveTo(3,10);ctx.lineTo(3,15);ctx.stroke();if(player.clean>0){ctx.fillStyle='#ef805e';ctx.fillRect(3,-1,16,4);ctx.fillStyle='#f6df89';ctx.beginPath();ctx.arc(18,1,3,0,Math.PI*2);ctx.fill()}ctx.restore();
  }
  function drawCop(c){ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle='#27364a';ctx.beginPath();ctx.arc(0,2,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#557ca2';ctx.beginPath();ctx.arc(0,1,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d9ad84';ctx.beginPath();ctx.arc(0,-5,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#243146';ctx.fillRect(-8,-11,16,4);ctx.fillRect(-4,-15,9,5);ctx.fillStyle=elapsed%0.5<.25?'#fa6b62':'#6aa8fa';ctx.beginPath();ctx.arc(-5,-1,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(5,-1,3,0,Math.PI*2);ctx.fill();if(c.distract>0)text('?',0,-22,14,'#fff4b0');ctx.restore()}
  function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvasW,canvasH);ctx.save();ctx.translate(-camera.x,-camera.y);drawWorld();for(const p of poopPiles){text('💩',p.x,p.y,17,'#fff');}vendors.forEach(v=>{if(v.kind==='vendor'){text('🧢',v.x,v.y-42,19,'#fff')}});for(const c of cops)drawCop(c);drawDog(player.x,player.y);
    const t=closestTarget();if(t){let x=t.kind==='shop'?t.x+t.w/2:t.x,y=t.kind==='shop'?t.y-13:t.y-58;const label=t.kind==='shop'?'E · ROBAR':t.kind==='vendor'?'E · VENDER':'E · BAÑARSE';ctx.font='700 11px "DM Mono", monospace';let w=ctx.measureText(label).width+18;roundRect(x-w/2,y-19,w,25,7,'#18251eeF','#d2f36b');text(label,x,y-2,10,'#e8f4ca','700')}
    ctx.restore();
  }
  function render(){
    if(town){town.sync({player,cops,piles:poopPiles,camera,viewport:{width:canvasW,height:canvasH},dt:0});return}
    draw();
  }
  function frame(now){if(!running)return;let dt=Math.min(.04,(now-last)/1000);last=now;update(dt);if(town)town.sync({player,cops,piles:poopPiles,camera,viewport:{width:canvasW,height:canvasH},dt});else draw();requestAnimationFrame(frame)}
  render();updateHud();
})();
