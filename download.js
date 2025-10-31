const W = 1024, H = 576;
const PHYSICS_GRAVITY = 1400;
const HEAL_HOLD_THRESHOLD = 0.25;
const HEAL_RATE = 20;
const HEAL_SOUL_COST_RATE = 20;
const SOUL_TAP_COST = 14;
const SOUL_PROJECTILE_BASE_DAMAGE = 18;
const CHEAT_INVINCIBILITY_ENABLED = true;
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: W, height: H,
  backgroundColor: 0x071324,
  physics: { default: 'arcade', arcade: { gravity: { y: PHYSICS_GRAVITY }, debug: false } },
  scene: [BootScene, HubScene, LevelScene]
};
const game = new Phaser.Game(config);
const G = {
  echoes: 0,
  unlocked: { dash: true, double_jump: true, wall_jump: false, grapple: false, soulflare: false },
  upgrades: {},
  saveKey: 'hollow_like_full_save_v1'
};
function saveGame() {
  const payload = { echoes: G.echoes, unlocked: G.unlocked, upgrades: G.upgrades };
  try { localStorage.setItem(G.saveKey, JSON.stringify(payload)); } catch(e){}
}
function loadGame() {
  try {
    const raw = localStorage.getItem(G.saveKey);
    if (!raw) return;
    const d = JSON.parse(raw);
    G.echoes = d.echoes||0; G.unlocked = d.unlocked||G.unlocked; G.upgrades = d.upgrades||{};
  } catch(e){}
}
function BootScene() { Phaser.Scene.call(this, {key:'BootScene'}); }
BootScene.prototype = Object.create(Phaser.Scene.prototype);
BootScene.prototype.constructor = BootScene;
BootScene.prototype.preload = function() {};
BootScene.prototype.create = function() { loadGame(); this.scene.start('HubScene'); };
function HubScene() { Phaser.Scene.call(this, {key:'HubScene'}); }
HubScene.prototype = Object.create(Phaser.Scene.prototype);
HubScene.prototype.constructor = HubScene;
HubScene.prototype.create = function() {
  const scene = this;
  scene.cameras.main.setBackgroundColor(0x061026);
  const ground = scene.add.rectangle(W/2, H-20, W-60, 40, 0x173a50);
  scene.physics.add.existing(ground, true);
  const platform = scene.add.rectangle(300, 380, 300, 20, 0x1f4e66);
  scene.physics.add.existing(platform, true);
  scene.player = createPlayer(scene, 160, H-140);
  scene.physics.add.collider(scene.player.sprite, ground);
  scene.physics.add.collider(scene.player.sprite, platform);
  const bench = scene.add.rectangle(520, H-90, 60, 18, 0x6fcf8c);
  bench.setInteractive();
  bench.on('pointerdown', () => {
    scene.player.healFull();
    saveGame();
    showModal("Saved at bench", ["OK"], [() => hideModal()]);
  });
  const shop = scene.add.rectangle(780, H-120, 90, 26, 0xffd27a);
  shop.setInteractive();
  shop.on('pointerdown', () => openShop(scene));
  const door = scene.add.rectangle(W-90, H-90, 60, 90, 0x8ad1ff);
  door.setInteractive();
  door.on('pointerdown', () => scene.scene.start('LevelScene', { from: 'hub' }));
  setupCommonUI(scene, 'Hub');
  setPauseKey(scene);
};
function LevelScene() { Phaser.Scene.call(this, {key:'LevelScene'}); }
LevelScene.prototype = Object.create(Phaser.Scene.prototype);
LevelScene.prototype.constructor = LevelScene;
LevelScene.prototype.init = function(data){ this._from = data.from||null; };
LevelScene.prototype.create = function() {
  const scene = this;
  scene.cameras.main.setBackgroundColor(0x041226);
  const ground = scene.add.rectangle(W/2, H-20, W-40, 40, 0x223b4f);
  scene.physics.add.existing(ground, true);
  const pA = scene.add.rectangle(260, 380, 260, 18, 0x24596f); scene.physics.add.existing(pA, true);
  const pB = scene.add.rectangle(620, 300, 240, 18, 0x24596f); scene.physics.add.existing(pB, true);
  const pC = scene.add.rectangle(860, 420, 220, 18, 0x24596f); scene.physics.add.existing(pC, true);
  scene.player = createPlayer(scene, 140, H-140);
  scene.physics.add.collider(scene.player.sprite, ground);
  scene.physics.add.collider(scene.player.sprite, pA);
  scene.physics.add.collider(scene.player.sprite, pB);
  scene.physics.add.collider(scene.player.sprite, pC);
  scene.enemies = scene.physics.add.group();
  scene.projectiles = scene.physics.add.group();
  scene.enemyProjectiles = scene.physics.add.group();
  spawnPatrolEnemy(scene, 600, H-110, 60, 520, 740);
  spawnPatrolEnemy(scene, 780, H-110, 60, 700, 900);
  scene.miniboss = spawnMiniBoss(scene, 490, H-160);
  scene.gate = scene.add.rectangle(950, H-110, 40, 160, 0x222f44);
  scene.physics.add.existing(scene.gate, true);
  scene.boss = null;
  scene.bossActive = false;
  scene.physics.add.overlap(scene.player.sprite, scene.enemies, (p, e)=> {
    if (scene.player.canBeHit()) scene.player.applyDamage(12);
  });
  scene.physics.add.overlap(scene.player.sprite, scene.enemyProjectiles, (p, proj)=> {
    if (scene.player.canBeHit()) {
      scene.player.applyDamage(proj.damage||10);
      proj.destroy();
    }
  });
  setupCommonUI(scene, 'Spore Gardens');
  setPauseKey(scene);
  showModal("Enter the Spore Gardens. Defeat the lurking boss to open the gate.", ["OK"], [() => hideModal()]);
};
function setupCommonUI(scene, areaName) {
  scene.hpEl = document.getElementById('hp');
  scene.soulEl = document.getElementById('soul');
  scene.echoEl = document.getElementById('echoes');
  scene.levelEl = document.getElementById('level');
  scene.bossBar = document.getElementById('bossbar');
  scene.bossHpEl = document.getElementById('bosshp');
  scene.levelEl.innerText = 'Area: ' + areaName;
  scene.events.on('update', () => {
    if (!scene.player) return;
    scene.hpEl.innerText = `HP: ${Math.round(scene.player.hp)}`;
    scene.soulEl.innerText = `Soul: ${Math.round(scene.player.soul)}`;
    scene.echoEl.innerText = `Echoes: ${G.echoes}`;
    if (scene.boss) {
      scene.bossBar.style.display = 'inline-block';
      scene.bossHpEl.innerText = Math.max(0, Math.round(scene.boss.hp));
    } else scene.bossBar.style.display = 'none';
  });
}
function setPauseKey(scene) {
  const keyP = scene.input.keyboard.addKey('P');
  keyP.on('down', () => {
    if (scene.scene.isPaused()) return;
    openPauseMenu(scene);
  });
}
function createPlayer(scene, x, y) {
  const size = 28;
  const sprite = scene.add.rectangle(x, y, size, size, 0xd0efff);
  scene.physics.add.existing(sprite);
  sprite.body.setCollideWorldBounds(true);
  sprite.body.setSize(size, size);
  const player = {
    sprite,
    hp: 100, maxHp: 100,
    soul: 100, maxSoul: 100,
    facing: 1,
    canDoubleJump: true, dashTimer:0, dashCooldown:0, isDashing:false,
    invul:0, attackCooldown:0, charge:0, charging:false, healing:false,
    maxSpeed: 280, jumpVel: -520, dashVel: 700,
    invincibleCheat: false,
    scene
  };
  const keys = scene.input.keyboard.addKeys({
    left: 'A', right: 'D', jump: 'SPACE', attack: 'K', dash: 'L', F: 'F', V: 'V', map: 'M'
  });
  player.healFull = function(){ this.hp = this.maxHp; };
  player.canBeHit = function(){ return this.invul <= 0 && !this.invincibleCheat; };
  player.applyDamage = function(d) {
    if (!this.canBeHit()) return;
    this.hp -= d; this.invul = 0.9;
    this.sprite.setFillStyle(0xff9999);
    scene.time.delayedCall(140, ()=>{ if (this.sprite) this.sprite.setFillStyle(0xd0efff); });
    if (this.hp <= 0) this.die();
  };
  player.die = function() {
    this.hp = this.maxHp;
    this.soul = this.maxSoul;
    this.sprite.x = 160; this.sprite.y = H-140;
    G.echoes = Math.max(0, G.echoes - 10);
    saveGame();
  };
  player.canJump = function() {
    return sprite.body.blocked.down || this.canDoubleJump || (G.unlocked.wall_jump && this.isTouchingWall);
  };
  scene.events.on('update', (t, dt) => {
    const delta = dt/1000;
    if (!player) return;
    let dir = 0;
    if (keys.left.isDown) dir -=1;
    if (keys.right.isDown) dir +=1;
    if (dir!==0) player.facing = dir;
    if (!player.isDashing) {
      const target = dir * player.maxSpeed;
      sprite.body.velocity.x = Phaser.Math.Linear(sprite.body.velocity.x, target, 0.14);
    }
    player.isTouchingWall = (sprite.body.blocked.left || sprite.body.blocked.right) && !sprite.body.blocked.down;
    if (Phaser.Input.Keyboard.JustDown(keys.jump)) {
      if (sprite.body.blocked.down) {
        sprite.body.setVelocityY(player.jumpVel); player.canDoubleJump = true;
      } else if (player.canDoubleJump && G.unlocked.double_jump) {
        sprite.body.setVelocityY(player.jumpVel*0.92); player.canDoubleJump = false;
      } else if (player.isTouchingWall && G.unlocked.wall_jump) {
        sprite.body.setVelocityY(-480);
        sprite.body.setVelocityX(-player.facing * player.maxSpeed * 0.9);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(keys.dash) && player.dashCooldown<=0 && G.unlocked.dash) {
      player.isDashing = true; player.dashTimer = 0.16; player.dashCooldown = 0.45;
      sprite.body.setVelocityX(player.facing * player.dashVel);
      player.invul = 0.12;
    }
    if (player.isDashing) {
      player.dashTimer -= delta;
      if (player.dashTimer <=0) player.isDashing=false;
    } else {
      if (player.dashCooldown>0) player.dashCooldown = Math.max(0, player.dashCooldown - delta);
    }
    if (Phaser.Input.Keyboard.JustDown(keys.attack) && player.attackCooldown<=0) {
      player.attackCooldown = 0.32;
      meleeAttack(scene, player);
    }
    if (player.attackCooldown>0) player.attackCooldown = Math.max(0, player.attackCooldown - delta);
    const keyF = keys.F;
    if (Phaser.Input.Keyboard.JustDown(keyF)) {
      player.charging = true;
      player.charge = 0;
      player.healing = false;
    }
    if (keyF.isDown && player.charging) {
      player.charge = Math.min(2.5, player.charge + delta);
      if (!player.healing && player.charge >= HEAL_HOLD_THRESHOLD) {
        player.healing = true;
        player.sprite.setStrokeStyle(2, 0x8bf0a6);
      }
    }
    if (player.charging && Phaser.Input.Keyboard.JustUp(keyF)) {
      if (player.healing) {
        player.healing = false;
        player.charging = false;
        player.charge = 0;
        player.sprite.setStrokeStyle();
      } else {
        if (player.soul >= SOUL_TAP_COST && G.unlocked.soulflare) {
          const power = 1 + Math.min(1.5, player.charge);
          fireSoul(scene, player, power);
          player.soul = Math.max(0, player.soul - SOUL_TAP_COST);
        }
        player.charging = false;
        player.charge = 0;
      }
    }
    if (player.healing) {
      const hpGain = HEAL_RATE * delta;
      const soulCost = HEAL_SOUL_COST_RATE * delta;
      if (player.soul >= soulCost && player.hp < player.maxHp) {
        player.soul = Math.max(0, player.soul - soulCost);
        player.hp = Math.min(player.maxHp, player.hp + hpGain);
      } else {
        player.healing = false;
        player.charging = false;
        player.charge = 0;
        player.sprite.setStrokeStyle();
      }
    }
    const keyV = keys.V;
    if (CHEAT_INVINCIBILITY_ENABLED && Phaser.Input.Keyboard.JustDown(keyV)) {
      player.invincibleCheat = !player.invincibleCheat;
      if (player.invincibleCheat) {
        player.sprite.setAlpha(0.85);
        player.sprite.setStrokeStyle(2, 0xffe38a);
      } else {
        player.sprite.setAlpha(1.0);
        player.sprite.setStrokeStyle();
      }
    }
    player.soul = Math.min(player.maxSoul, player.soul + 16*delta);
    if (player.invul > 0) player.invul = Math.max(0, player.invul - delta);
    if (scene.scene.key === 'LevelScene' && !scene.bossActive && player.sprite.x > 780) {
      scene.bossActive = true;
      scene.boss = spawnMainBoss(scene, 850, H-140);
    }
  });
  sprite.playerRef = player;
  sprite.getPlayer = () => player;
  player.applyDamage = player.applyDamage;
  player.healFull = player.healFull;
  return player;
}
function meleeAttack(scene, player) {
  const size = 36;
  const hx = player.sprite.x + player.facing * (player.sprite.width/2 + size/2);
  const hy = player.sprite.y;
  const hit = scene.add.rectangle(hx, hy, size, 28, 0xffffff, 0.0001);
  scene.physics.add.existing(hit);
  hit.body.setAllowGravity(false);
  scene.physics.add.overlap(hit, scene.enemies, (h, e)=> damageEnemy(scene, e, 36));
  if (scene.boss) scene.physics.add.overlap(hit, scene.boss.sprite, ()=> damageBoss(scene, 30));
  scene.time.delayedCall(80, ()=>{ hit.destroy(); });
}
function fireSoul(scene, player, power=1.0) {
  if (!G.unlocked.soulflare) return;
  const bullet = scene.add.circle(player.sprite.x + player.facing*18, player.sprite.y - 8, 8, 0xbfe8ff);
  scene.physics.add.existing(bullet);
  bullet.body.setAllowGravity(false);
  bullet.damage = Math.round(SOUL_PROJECTILE_BASE_DAMAGE * power);
  bullet.body.velocity.x = player.facing * (420 * (1 + 0.4*(power-1)));
  bullet.setDepth(2);
  scene.projectiles.add(bullet);
  scene.physics.add.overlap(bullet, scene.enemies, (b, e)=> { damageEnemy(scene, e, b.damage); b.destroy(); });
  if (scene.boss) scene.physics.add.overlap(bullet, scene.boss.sprite, (b, bs)=> { damageBoss(scene, b.damage); b.destroy(); });
  scene.time.delayedCall(3000, ()=>{ if (bullet && bullet.destroy) bullet.destroy(); });
}
function spawnPatrolEnemy(scene, x, y, size=44, left=0, right=W) {
  const en = scene.add.rectangle(x, y, size, size, 0xff9999);
  scene.physics.add.existing(en);
  en.body.setCollideWorldBounds(true);
  en.hp = 60; en.patrol = {dir: -1, speed: 60, left, right};
  scene.enemies.add(en);
  scene.physics.add.collider(en, scene.children.list.filter(ch=>ch.body && ch.body.immovable));
  scene.time.addEvent({delay:1200, loop:true, callback: ()=> {
    if (Phaser.Math.FloatBetween(0,1) < 0.28) {
      const p = scene.add.circle(en.x + en.patrol.dir*10, en.y - 6, 6, 0xffe0d0);
      scene.physics.add.existing(p); p.body.setAllowGravity(false); p.damage=10;
      p.body.velocity.x = -en.patrol.dir * (120 + Phaser.Math.Between(0,60));
      scene.enemyProjectiles.add(p);
      scene.time.delayedCall(5000, ()=>{ if (p && p.destroy) p.destroy(); });
    }
  }});
  scene.events.on('update', ()=> {
    if (!en.body) return;
    en.x += en.patrol.dir * en.patrol.speed * scene.game.loop.delta/1000;
    if (en.x < en.patrol.left) en.patrol.dir = 1;
    if (en.x > en.patrol.right) en.patrol.dir = -1;
  });
  return en;
}
function spawnMiniBoss(scene, x, y) {
  const boss = { sprite: scene.add.rectangle(x, y, 84, 84, 0xffc080), hp: 160 };
  scene.physics.add.existing(boss.sprite);
  boss.sprite.body.setImmovable(true);
  scene.time.addEvent({ delay: 2500, loop: true, callback: ()=> {
    boss.sprite.setFillStyle(0xffe0b0);
    scene.time.delayedCall(320, ()=> {
      boss.sprite.setFillStyle(0xffc080);
      const area = scene.add.rectangle(boss.sprite.x, boss.sprite.y + 48, 120, 40, 0xff5555, 0.08);
      scene.physics.add.existing(area, true);
      scene.physics.add.overlap(area, scene.player.sprite, ()=> { if (scene.player.canBeHit()) scene.player.applyDamage(22); });
      scene.time.delayedCall(200, ()=> area.destroy());
    });
  }});
  return boss;
}
function damageEnemy(scene, en, amount) {
  en.hp -= amount;
  en.setFillStyle(0xff7b7b);
  scene.time.delayedCall(140, ()=>{ if (en && en.setFillStyle) en.setFillStyle(0xff9999); });
  if (en.hp <= 0) {
    en.destroy();
    G.echoes += 6;
    saveGame();
  }
}
function spawnMainBoss(scene, x, y) {
  const boss = {};
  boss.sprite = scene.add.rectangle(x, y, 140, 140, 0xa0c8ff).setStrokeStyle(4, 0x274d7b);
  scene.physics.add.existing(boss.sprite); boss.sprite.body.setImmovable(true);
  boss.hp = 520; boss.phase = 1; boss.timer = 1.2; boss.summonTimer = 6.0;
  boss.attackArea = scene.add.rectangle(boss.sprite.x, boss.sprite.y + 74, 200, 50, 0xff0000, 0.12); boss.attackArea.setVisible(false);
  scene.physics.add.existing(boss.attackArea, true);
  scene.events.on('update', ()=> {
    const dt = scene.game.loop.delta/1000;
    if (boss.hp <= 0) return;
    boss.timer -= dt; boss.summonTimer -= dt;
    if (boss.timer <= 0) {
      boss.sprite.setFillStyle(0xffa8a8);
      scene.time.delayedCall(380, ()=> {
        boss.attackArea.x = boss.sprite.x; boss.attackArea.y = boss.sprite.y + 80; boss.attackArea.setVisible(true);
        scene.time.delayedCall(160, ()=> boss.attackArea.setVisible(false));
        boss.sprite.setFillStyle(0xa0c8ff);
      });
      boss.timer = Phaser.Math.Clamp(1.6 - 0.12*(boss.phase-1), 0.6, 2.0);
    }
    if (boss.phase >= 2 && boss.summonTimer <= 0) {
      for (let i=0;i<2;i++){
        spawnPatrolEnemy(scene, boss.sprite.x + (i?80:-80), boss.sprite.y + 50, 28, boss.sprite.x - 120, boss.sprite.x + 120);
      }
      boss.summonTimer = 5.0;
    }
    if (boss.phase === 3 && Phaser.Math.FloatBetween(0,1) < 0.02) {
      scene.tweens.add({ targets: boss.sprite, x: scene.player.sprite.x + Phaser.Math.Between(-80,80), duration: 220, ease: 'Sine.easeInOut' });
    }
    if (boss.attackArea.visible) {
      scene.physics.overlap(scene.player.sprite, boss.attackArea, ()=> { if (scene.player.canBeHit()) scene.player.applyDamage(28); });
    }
  });
  scene.boss = boss;
  scene.bossActive = true;
  return boss;
}
function damageBoss(scene, amount) {
  const boss = scene.boss;
  if (!boss || boss.hp <= 0) return;
  boss.hp -= amount;
  boss.sprite.setFillStyle(0xffd9d9);
  boss.sprite.scene.time.delayedCall(90, ()=> { if (boss.sprite) boss.sprite.setFillStyle(0xa0c8ff); });
  if (boss.hp <= 0) {
    boss.sprite.setFillStyle(0x66ff99);
    scene.boss = null; scene.bossActive = false;
    G.echoes += 120; saveGame();
    showModal("Boss defeated! Gate is open.", ["OK"], [() => hideModal()]);
    scene.children.list.forEach(c => { if (c.fillColor === 0x222f44) c.destroy(); });
  } else {
    if (boss.hp < 360 && boss.phase === 1) boss.phase = 2;
    if (boss.hp < 140 && boss.phase === 2) boss.phase = 3;
  }
}
function showModal(text, buttons=['OK'], callbacks=[()=>hideModal()]) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  const btns = document.getElementById('modal-buttons');
  content.innerHTML = Array.isArray(text)? text.join('<br>') : text;
  btns.innerHTML = '';
  buttons.forEach((b,i)=> {
    const btn = document.createElement('button');
    btn.className = 'btn' + (i? ' secondary' : '');
    btn.textContent = b; btn.onclick = ()=> { callbacks[i] && callbacks[i](); };
    btns.appendChild(btn);
  });
  modal.classList.remove('hidden');
}
function hideModal(){ document.getElementById('modal').classList.add('hidden'); }
function openShop(scene) {
  const offers = [
    {id:'wall_jump', price: 60, label:'Wall Jump'},
    {id:'soulflare', price: 80, label:'Soul Flare'},
    {id:'grapple', price: 120, label:'Grapple'}
  ];
  const lines = offers.map(o => `${o.label} — ${o.price} Echoes ${G.unlocked[o.id] ? '(Owned)' : ''}`);
  showModal(lines.join('<br>'), ['Buy 1','Close'], [
    ()=> {
      for (const o of offers) {
        if (!G.unlocked[o.id] && G.echoes >= o.price) {
          G.echoes -= o.price; G.unlocked[o.id] = true; saveGame();
          showModal(`${o.label} unlocked.`, ['OK'], [()=> hideModal()]);
          return;
        }
      }
      showModal("Not enough Echoes or all owned.", ['OK'], [()=> hideModal()]);
    },
    ()=> hideModal()
  ]);
}
function openPauseMenu(scene) {
  showModal("Paused", ["Resume","Save & Quit"], [
    ()=> hideModal(),
    ()=> { saveGame(); window.location.reload(); }
  ]);
}
