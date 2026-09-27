const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
let W=1280,H=720, last=0, running=false, paused=false, state='menu', shake=0;
const keys=new Set(); const mouse={x:W/2,y:H/2,down:false};
const assets={};
const assetPaths={
  player:'assets/sprites/player.svg', drone:'assets/sprites/drone.svg', tank:'assets/sprites/tank.svg', boss:'assets/sprites/boss.svg', core:'assets/sprites/core.svg'
};
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function loadAssets(){for(const [k,p] of Object.entries(assetPaths)){try{assets[k]=await loadImg(p)}catch{}}}
function fit(){W=window.innerWidth;H=window.innerHeight;canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener('resize',fit); fit();

const ui={menu:document.getElementById('menu'),hud:document.getElementById('hud'),level:document.getElementById('levelUp'),pause:document.getElementById('pause'),gameOver:document.getElementById('gameOver'),toast:document.getElementById('toast')};
const waveEl=document.getElementById('wave'),scoreEl=document.getElementById('score'),coinsEl=document.getElementById('coins'),levelEl=document.getElementById('level'),hpBar=document.getElementById('hpBar'),xpBar=document.getElementById('xpBar'),bestScoreEl=document.getElementById('bestScore');
const bestKey='neon-rift-best'; bestScoreEl.textContent=Number(localStorage.getItem(bestKey)||0).toLocaleString();

const upgrades=[
 {id:'damage',name:'Overcharge',desc:'Weapon damage +25%. Projectiles gain a brighter trail.',tag:'DAMAGE',icon:'✦'},
 {id:'firerate',name:'Hot Trigger',desc:'Fire rate +22%. More bolts, more pressure.',tag:'FIRE RATE',icon:'⚡'},
 {id:'speed',name:'Vector Boots',desc:'Move speed +16%. Dash recovers 15% faster.',tag:'MOBILITY',icon:'↯'},
 {id:'maxhp',name:'Reinforced Hull',desc:'Maximum HP +25 and fully repair 25 HP.',tag:'SURVIVAL',icon:'✚'},
 {id:'magnet',name:'Core Magnet',desc:'XP and coins pull from twice the distance.',tag:'ECONOMY',icon:'◉'},
 {id:'multishot',name:'Twin Arc',desc:'Fire an additional projectile at a slight angle.',tag:'WEAPON',icon:'⌁'}
];
const game={};
function resetGame(){
 Object.assign(game,{player:{x:W/2,y:H/2,r:23,hp:100,maxHp:100,speed:260,damage:16,fireRate:5.5,cool:0,dashCd:0,magnet:100,multi:1,inv:0},enemies:[],bullets:[],enemyBullets:[],particles:[],cores:[],score:0,coins:0,wave:1,level:1,xp:0,nextXp:90,kills:0,spawnLeft:12,spawnTimer:0,waveTimer:0,bossAlive:false,startedAt:performance.now()});
}
function show(el){el.classList.remove('hidden')};function hide(el){el.classList.add('hidden')};
function start(){resetGame();state='playing';running=true;paused=false;hide(ui.menu);hide(ui.gameOver);hide(ui.pause);hide(ui.level);show(ui.hud);updateHud();toast('WAVE 1 — SURVIVE');}
function pause(){if(state!=='playing')return;paused=true;state='paused';show(ui.pause)}
function resume(){paused=false;state='playing';hide(ui.pause)}
function toMenu(){running=false;state='menu';hide(ui.hud);hide(ui.pause);hide(ui.gameOver);hide(ui.level);show(ui.menu);bestScoreEl.textContent=Number(localStorage.getItem(bestKey)||0).toLocaleString();}

document.getElementById('playBtn').onclick=start;document.getElementById('resumeBtn').onclick=resume;document.getElementById('pauseBtn').onclick=pause;document.getElementById('restartBtn').onclick=start;document.getElementById('againBtn').onclick=start;document.getElementById('menuBtn').onclick=toMenu;
window.addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.key==='Escape'){if(state==='playing')pause();else if(state==='paused')resume();}if(e.key.toLowerCase()==='shift'&&!e.repeat)dash()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY});canvas.addEventListener('mousedown',e=>{if(e.button===0)mouse.down=true});window.addEventListener('mouseup',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());

function dash(){const p=game.player;if(state!=='playing'||p.dashCd>0)return;let dx=(keys.has('d')?1:0)-(keys.has('a')?1:0),dy=(keys.has('s')?1:0)-(keys.has('w')?1:0);if(!dx&&!dy){dx=mouse.x-p.x;dy=mouse.y-p.y}const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;for(let i=0;i<14;i++)particle(p.x,p.y,dx*-1+rand(-.5,.5),dy*-1+rand(-.5,.5),80,0.5,'cyan');p.x=clamp(p.x+dx*150,40,W-40);p.y=clamp(p.y+dy*150,90,H-40);p.inv=.5;p.dashCd=2.2;shake=.3}
function rand(a,b){return a+Math.random()*(b-a)}function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function particle(x,y,vx,vy,life,size,color='cyan'){game.particles.push({x,y,vx,vy,life,max:life,size,color,drag:.94});}
function burst(x,y,color='cyan',n=14,power=140){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=rand(power*.35,power);particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(.35,.8),rand(2,5),color)}}
function spawnCore(x,y,value=15){game.cores.push({x,y,r:8,value,spin:Math.random()*6.28})}
function xpGain(v){game.xp+=v;while(game.xp>=game.nextXp){game.xp-=game.nextXp;game.level++;game.nextXp=Math.floor(game.nextXp*1.24);levelUp()}}
function levelUp(){state='level';paused=true;hide(ui.hud);show(ui.level);const grid=document.getElementById('upgradeCards');grid.innerHTML='';const pool=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);for(const u of pool){const card=document.createElement('button');card.className='upgrade-card';card.innerHTML=`<div class="upgrade-icon">${u.icon}</div><h3>${u.name}</h3><p>${u.desc}</p><span class="tag">${u.tag}</span>`;card.onclick=()=>applyUpgrade(u);grid.appendChild(card)}}
function applyUpgrade(u){const p=game.player;if(u.id==='damage')p.damage*=1.25;if(u.id==='firerate')p.fireRate*=1.22;if(u.id==='speed'){p.speed*=1.16;p.dashCd=Math.max(0,p.dashCd-.3)}if(u.id==='maxhp'){p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+25)}if(u.id==='magnet')p.magnet*=2;if(u.id==='multishot')p.multi=Math.min(3,p.multi+1);state='playing';paused=false;hide(ui.level);show(ui.hud);toast(u.name.toUpperCase());updateHud()}

function newWave(){game.wave++;game.spawnLeft=10+game.wave*4;game.spawnTimer=0;game.waveTimer=0;if(game.wave%5===0){spawnEnemy('boss');toast('BOSS WAVE');}else toast('WAVE '+game.wave);}
function chooseEnemy(){const r=Math.random();if(game.wave<3)return r<.75?'drone':'tank';if(game.wave<6)return r<.62?'drone':r<.93?'tank':'orb';return r<.5?'drone':r<.84?'tank':'orb'}
function spawnEnemy(type=chooseEnemy()){
 let x,y;const edge=Math.floor(Math.random()*4);if(edge<2){x=edge===0?-50:W+50;y=rand(90,H-30)}else{y=edge===2?70:H+50;x=rand(0,W)}
 const scale=1+game.wave*.07;
 if(type==='drone')game.enemies.push({type,x,y,r:21,hp:40*scale,max:40*scale,speed:75+game.wave*2,damage:14,score:60,coins:2,shoot:0,color:'pink'});
 if(type==='tank')game.enemies.push({type,x,y,r:34,hp:150*scale,max:150*scale,speed:38+game.wave,damage:22,score:160,coins:5,shoot:1.6,color:'gold'});
 if(type==='orb')game.enemies.push({type,x,y,r:16,hp:65*scale,max:65*scale,speed:130+game.wave*3,damage:18,score:90,coins:3,shoot:2,color:'cyan'});
 if(type==='boss'){const hp=1500+game.wave*250;game.enemies.push({type,x:W/2,y:120,r:66,hp,max:hp,speed:44,damage:34,score:1500,coins:30,shoot:.7,phase:0,color:'boss'});game.bossAlive=true}
}
function fire(){const p=game.player;if(p.cool>0)return;const a=Math.atan2(mouse.y-p.y,mouse.x-p.x);const spread=.13;for(let i=0;i<p.multi;i++){const off=(i-(p.multi-1)/2)*spread;const ang=a+off;game.bullets.push({x:p.x+Math.cos(ang)*25,y:p.y+Math.sin(ang)*25,vx:Math.cos(ang)*650,vy:Math.sin(ang)*650,r:5,damage:p.damage,life:1.4});}p.cool=1/p.fireRate;particle(p.x+Math.cos(a)*24,p.y+Math.sin(a)*24,Math.cos(a)*30,Math.sin(a)*30,.18,5,'gold')}
function enemyShoot(e){const p=game.player;const a=Math.atan2(p.y-e.y,p.x-e.x);if(e.type==='boss'){for(let i=-2;i<=2;i++){const an=a+i*.14;game.enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(an)*240,vy:Math.sin(an)*240,r:7,damage:12,life:3,color:'pink'});}}else game.enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,r:6,damage:e.damage,life:3,color:e.color})}
function hitPlayer(d){const p=game.player;if(p.inv>0)return;p.hp-=d;p.inv=.18;shake=.16;burst(p.x,p.y,'red',8,90);if(p.hp<=0)endGame()}
function endGame(){state='gameover';running=false;hide(ui.hud);show(ui.gameOver);document.getElementById('finalScore').textContent=Math.floor(game.score).toLocaleString();document.getElementById('finalWave').textContent=game.wave;document.getElementById('finalLevel').textContent=game.level;const best=Math.max(Number(localStorage.getItem(bestKey)||0),Math.floor(game.score));localStorage.setItem(bestKey,best);bestScoreEl.textContent=best.toLocaleString()}
function toast(t){ui.toast.textContent=t;show(ui.toast);clearTimeout(toast.t);toast.t=setTimeout(()=>hide(ui.toast),1600)}

function update(dt){if(state!=='playing')return;const p=game.player;p.cool=Math.max(0,p.cool-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.inv=Math.max(0,p.inv-dt);
 let dx=(keys.has('d')?1:0)-(keys.has('a')?1:0),dy=(keys.has('s')?1:0)-(keys.has('w')?1:0);if(dx||dy){const l=Math.hypot(dx,dy);dx/=l;dy/=l;p.x+=dx*p.speed*dt;p.y+=dy*p.speed*dt;for(let i=0;i<2;i++)particle(p.x,p.y,-dx*30+rand(-15,15),-dy*30+rand(-15,15),.25,rand(1,3),'cyan')}
 p.x=clamp(p.x,30,W-30);p.y=clamp(p.y,85,H-30);if(mouse.down)fire();
 game.spawnTimer-=dt;if(game.spawnLeft>0&&game.spawnTimer<=0){spawnEnemy();game.spawnLeft--;game.spawnTimer=Math.max(.18,.75-game.wave*.025)}
 if(game.spawnLeft===0&&game.enemies.length===0&&!game.bossAlive){game.waveTimer+=dt;if(game.waveTimer>1.4)newWave()};
 for(let i=game.bullets.length-1;i>=0;i--){const b=game.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt; if(b.life<=0||b.x<-30||b.x>W+30||b.y<50||b.y>H+30){game.bullets.splice(i,1);continue} for(let j=game.enemies.length-1;j>=0;j--){const e=game.enemies[j];if(dist(b.x,b.y,e.x,e.y)<b.r+e.r){e.hp-=b.damage;burst(b.x,b.y,e.color==='gold'?'gold':'cyan',3,50);game.bullets.splice(i,1);if(e.hp<=0)killEnemy(j,e);break}}}
 for(let i=game.enemyBullets.length-1;i>=0;i--){const b=game.enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0){game.enemyBullets.splice(i,1);continue}if(dist(b.x,b.y,p.x,p.y)<b.r+p.r){hitPlayer(b.damage);game.enemyBullets.splice(i,1)}}
 for(let i=game.enemies.length-1;i>=0;i--){const e=game.enemies[i];const a=Math.atan2(p.y-e.y,p.x-e.x);const d=dist(p.x,p.y,e.x,e.y);if(e.type==='boss'){e.phase+=dt;e.x+=Math.sin(e.phase*.7)*18*dt;e.y+=Math.cos(e.phase*.5)*10*dt;e.shoot-=dt;if(e.shoot<=0){enemyShoot(e);e.shoot=.9}}else{e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;e.shoot-=dt;if(d<460&&e.shoot<=0){enemyShoot(e);e.shoot=e.type==='tank'?2.2:1.5}}if(d<e.r+p.r){hitPlayer(e.damage);if(e.type!=='tank'){e.hp=0;killEnemy(i,e)}}}
 for(let i=game.cores.length-1;i>=0;i--){const c=game.cores[i];c.spin+=dt*3;const d=dist(c.x,c.y,p.x,p.y);if(d<p.magnet){const a=Math.atan2(p.y-c.y,p.x-c.x);const sp=d<80?420:180;c.x+=Math.cos(a)*sp*dt;c.y+=Math.sin(a)*sp*dt}if(d<24){xpGain(c.value);game.coins+=Math.ceil(c.value/8);game.score+=c.value*2;burst(c.x,c.y,'gold',7,70);game.cores.splice(i,1)}}
 for(let i=game.particles.length-1;i>=0;i--){const q=game.particles[i];q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=q.drag;q.vy*=q.drag;q.life-=dt;if(q.life<=0)game.particles.splice(i,1)}
 shake=Math.max(0,shake-dt);updateHud();
}
function killEnemy(i,e){game.enemies.splice(i,1);game.kills++;game.score+=e.score;game.coins+=e.coins;burst(e.x,e.y,e.color==='boss'?'pink':e.color, e.type==='boss'?50:16,e.type==='boss'?260:160);spawnCore(e.x,e.y,e.type==='boss'?80:rand(10,24));if(e.type==='boss'){game.bossAlive=false;toast('BOSS DEFEATED!')}}
function updateHud(){const p=game.player;waveEl.textContent=game.wave;scoreEl.textContent=Math.floor(game.score).toLocaleString();coinsEl.textContent=game.coins;levelEl.textContent=game.level;hpBar.style.width=(clamp(p.hp/p.maxHp,0,1)*100)+'%';xpBar.style.width=(clamp(game.xp/game.nextXp,0,1)*100)+'%'}
function dist(a,b,c,d){return Math.hypot(a-c,b-d)}
function drawSprite(img,x,y,size,rot=0,alpha=1){if(!img)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rot);ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore()}
function drawBackground(t){ctx.fillStyle='#050912';ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(51,120,180,.03)';for(let x=0;x<W;x+=64)ctx.fillRect(x,70,1,H-70);for(let y=70;y<H;y+=64)ctx.fillRect(0,y,W,1);const g=ctx.createRadialGradient(W*.5,H*.45,40,W*.5,H*.45,Math.max(W,H)*.6);g.addColorStop(0,'rgba(85,149,255,.08)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);for(let i=0;i<70;i++){const x=(i*173+t*.02)%W,y=90+((i*97)%Math.max(1,H-110));ctx.fillStyle=`rgba(110,220,255,${.15+.15*Math.sin(i+t*.001)})`;ctx.fillRect(x,y,1.5,1.5)}}
function draw(){const t=performance.now();drawBackground(t);ctx.save();if(shake>0)ctx.translate(rand(-4,4)*shake*10,rand(-4,4)*shake*10);
 for(const c of game.cores){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.spin);ctx.shadowBlur=20;ctx.shadowColor='#ffd166';ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(8,0);ctx.lineTo(0,10);ctx.lineTo(-8,0);ctx.closePath();ctx.fill();ctx.restore()}
 for(const b of game.bullets){ctx.save();ctx.strokeStyle='#ffe38b';ctx.lineWidth=4;ctx.shadowBlur=15;ctx.shadowColor='#ffd166';ctx.beginPath();ctx.moveTo(b.x-b.vx*.02,b.y-b.vy*.02);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}
 for(const b of game.enemyBullets){ctx.save();ctx.fillStyle=b.color==='pink'?'#ff78da':'#71efff';ctx.shadowBlur=18;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.restore()}
 for(const e of game.enemies){let img=e.type==='boss'?assets.boss:e.type==='tank'?assets.tank:e.type==='drone'?assets.drone:assets.drone;const rot=Math.atan2(game.player.y-e.y,game.player.x-e.x)+Math.PI/2;drawSprite(img,e.x,e.y,e.r*2.5,rot);const w=e.type==='boss'?130:e.r*1.8;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(e.x-w/2,e.y-e.r-14,w,5);ctx.fillStyle=e.type==='boss'?'#ff6fd8':e.color==='gold'?'#ffd166':'#71efff';ctx.fillRect(e.x-w/2,e.y-e.r-14,w*clamp(e.hp/e.max,0,1),5)}
 const p=game.player;const aim=Math.atan2(mouse.y-p.y,mouse.x-p.x);drawSprite(assets.player,p.x,p.y,58,aim+Math.PI/2,p.inv>0?(.45+.55*Math.abs(Math.sin(performance.now()*.03))):1);if(p.dashCd<=0){ctx.strokeStyle='rgba(113,239,255,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,34,0,Math.PI*2);ctx.stroke()}
 for(const q of game.particles){ctx.save();ctx.globalAlpha=q.life/q.max;ctx.fillStyle=q.color==='gold'?'#ffd166':q.color==='pink'?'#ff6fd8':q.color==='red'?'#ff5f6d':'#71efff';ctx.shadowBlur=10;ctx.shadowColor=ctx.fillStyle;ctx.fillRect(q.x,q.y,q.size,q.size);ctx.restore()}
 ctx.restore();
 if(state==='playing'&&game.enemies.some(e=>e.type==='boss')){const boss=game.enemies.find(e=>e.type==='boss');ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(W*.18,76,W*.64,10);ctx.fillStyle='#ff6fd8';ctx.fillRect(W*.18,76,W*.64*clamp(boss.hp/boss.max,0,1),10)}
}
function loop(ts){const dt=Math.min(.033,(ts-last)/1000||0);last=ts;if(running&&!paused)update(dt);draw();requestAnimationFrame(loop)}
loadAssets().then(()=>requestAnimationFrame(loop));
