// Bash Boyale — PR 2
// Browser-first Clash Royale-style battler. Stats come from Anthony's
// handwritten notes (see bash-boyale-transcript.md). Where a note leaves a
// number out (e.g. an attack speed), the chosen value is marked CHOSEN.
(function () {
  'use strict';
  var TILE = 40;
  var W = 400, H = 600, BRIDGE_Y = 300;
  var SPEEDS = { slow: 45, norm: 65, med: 80, fast: 100, vfast: 130 };
  var TOWER = { hp: 1800, dmg: 100, hitSpeed: 1.5, range: 5 }; // notes p.15, L1
  var ELIXIR_MAX = 10, ELIXIR_START = 5, ELIXIR_REGEN = 2.8; // seconds per 1
  var MATCH_TIME = 120;

  // id, name, elixir, type, hp, dmg, hitSpeed, rangeTiles, speed, count, special
  var CARDS = [
    { id: 'mustard', name: 'Mustard', elixir: 1, type: 'troop', hp: 1250, dmg: 300, hitSpeed: 1.7, range: 1, speed: 'slow', count: 1 },
    { id: 'plant_spirit', name: 'Plant Spirit', elixir: 1, type: 'troop', hp: 680, dmg: 130, hitSpeed: 1.1, range: 1, speed: 'fast', count: 1, root: 1 },
    { id: 'guard', name: 'Guard', elixir: 1, type: 'troop', hp: 1200, dmg: 0, hitSpeed: 1, range: 0, speed: 'norm', count: 1, shieldAura: 1000, shieldRadius: 2.5 },
    { id: 'firelight_ball', name: 'Firelight Ball', elixir: 3, type: 'spell', dmg: 650, towerDmg: 300, burn: 100, burnTime: 3, radius: 2 },
    { id: 'ravirolli', name: 'Ravirolli', elixir: 4, type: 'troop', hp: 1900, dmg: 180, hitSpeed: 1.6, range: 3, speed: 'norm', count: 3, burn: 40, burnTime: 2, rollEvery: 5, rollDmg: 130 },
    { id: 'eagle_eye', name: 'Eagle Eye', elixir: 4, type: 'troop', hp: 1200, dmg: 111, hitSpeed: 1.0, range: 4, speed: 'fast', count: 1, spawnEvery: 3 },
    { id: 'lazah_beam', name: 'Lazah-Beam', elixir: 4, type: 'troop', hp: 5500, dmg: 1850, hitSpeed: 5.8, range: 5, speed: 'slow', count: 1, deathFire: 250, deathFireTime: 2 },
    { id: 'radio_tower', name: 'Radio Tower', elixir: 4, type: 'building', hp: 3000, dmg: 500, hitSpeed: 1.9, range: 4, count: 1 },
    { id: 'portn_shield', name: 'Portn-Shield', elixir: 5, type: 'spell', radius: 4, drMain: 0.40, drOthers: 0.10, drTime: 7 },
    { id: 'wolverdog', name: 'Wolverdog', elixir: 6, type: 'troop', hp: 6200, dmg: 350, hitSpeed: 1.1, range: 4, speed: 'fast', count: 1, poison: 55, poisonTicks: 3 },
    { id: 'pb_bounce', name: "PB n' Bounce", elixir: 6, type: 'building', hp: 6000, dmg: [410, 300, 150], hitSpeed: 1.6, range: 6, bounceRange: 2, count: 1 }, // hitSpeed CHOSEN (notes give no rate)
    { id: 'waaflee', name: 'Waaflee', elixir: 9, type: 'troop', hp: 9400, dmg: 980, hitSpeed: 2.6, range: 1, speed: 'fast', count: 1, splitAt: 0.25 },
    { id: 'windblower', name: 'Windblower', elixir: 9, type: 'building', hp: 1400, pushTiles: 1, pushEvery: 1.2, decay: 70, range: 3, count: 1 }, // decay + range CHOSEN (notes: "Decaying HP", no rate/range)
    { id: 'back_to_begin', name: 'Back To Begin', elixir: 10, type: 'troop', hp: 4720, dmg: 783, hitSpeed: 1.9, range: 1, speed: 'fast', count: 1, rewindAt: 0.20 },
    { id: 'no_skill', name: 'No-skill', elixir: 11, type: 'building', hp: 9900, dmg: 45, hitSpeed: 0.9, range: 9, pierceEvery: 3, pierceBonus: 16, count: 1 }
  ];
  var MINI_WAFFLE = { hp: 1000, dmg: 120, hitSpeed: 1.4, range: 1, speed: 'norm' };
  var MINI_EAGLE = { hp: 600, dmg: 60, hitSpeed: 1.0, range: 3, speed: 'fast' };

  function cardById(id) { for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i]; return null; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  var nextId = 1;
  function makeEntity(card, side, x, y, isMini, miniDef, parent) {
    var hp = isMini ? miniDef.hp : (card ? card.hp : TOWER.hp);
    return {
      id: nextId++, cardId: isMini ? ('mini_' + parent) : (card ? card.id : 'tower'),
      name: isMini ? (parent === 'waaflee' ? 'Mini Waffle' : 'Mini Eagle') : (card ? card.name : 'Tower'),
      side: side, x: x, y: y, hp: hp, maxHp: hp, shield: 0, popT: card ? (isMini ? 0.3 : 0.25) : 0,
      atkCd: 0, isBuilding: !!(card && card.type === 'building'), isTower: !card, isKing: false,
      isMini: !!isMini, miniDef: miniDef || null, parent: parent || null,
      dead: false, effects: [], shotCount: 0, spawnT: 0, rollT: card && card.rollEvery ? card.rollEvery : 0,
      rollState: null, history: [], splitDone: false, rewindDone: false,
      shieldedAllies: {}, dmg: isMini ? miniDef.dmg : (card ? card.dmg : TOWER.dmg),
      hitSpeed: isMini ? miniDef.hitSpeed : (card ? card.hitSpeed : TOWER.hitSpeed),
      range: isMini ? miniDef.range : (card ? card.range : TOWER.range),
      speed: isMini ? miniDef.speed : (card ? card.speed : null)
    };
  }

  function makeTower(side, x, y, isKing) {
    var t = makeEntity(null, side, x, y, false);
    t.isKing = !!isKing;
    return t;
  }
  function allTowers(s) {
    return s.towers.player.sides.concat([s.towers.player.king], s.towers.ai.sides, [s.towers.ai.king]);
  }
  function enemyTowers(s, side) {
    return side === 'player' ? s.towers.ai.sides.concat([s.towers.ai.king]) : s.towers.player.sides.concat([s.towers.player.king]);
  }
  function ownTowers(s, side) {
    var tw = side === 'player' ? s.towers.player : s.towers.ai;
    return tw.sides.concat([tw.king]);
  }
  function towersAlive(tw) {
    var n = 0;
    tw.sides.forEach(function (t) { if (t.hp > 0) n++; });
    if (tw.king.hp > 0) n++;
    return n;
  }
  function towersHpPct(tw) {
    var all = tw.sides.concat([tw.king]), hp = 0, max = 0;
    all.forEach(function (t) { hp += Math.max(0, t.hp); max += t.maxHp; });
    return max ? hp / max : 0;
  }

  function createBattle(playerDeck, aiDeck) {
    var s = {
      timeLeft: MATCH_TIME, over: false, result: null,
      elixir: { player: ELIXIR_START, ai: ELIXIR_START },
      entities: [], zones: [], tracers: [], particles: [], ghosts: [], animT: 0,
      towers: {
        player: { sides: [makeTower('player', 80, 430), makeTower('player', 320, 430)], king: makeTower('player', W / 2, H - 60, true) },
        ai: { sides: [makeTower('ai', 80, 170), makeTower('ai', 320, 170)], king: makeTower('ai', W / 2, 60, true) }
      },
      hands: {}, decks: { player: playerDeck.slice(), ai: aiDeck.slice() },
      nextIdx: { player: 0, ai: 0 }, aiT: 4, log: []
    };
    s.entities.push.apply(s.entities, allTowers(s));
    s.hands.player = drawHand(s, 'player');
    s.hands.ai = drawHand(s, 'ai');
    return s;
  }
  function drawHand(s, side) {
    var deck = s.decks[side], hand = [];
    for (var i = 0; i < 4; i++) { hand.push(deck[s.nextIdx[side] % deck.length]); s.nextIdx[side]++; }
    return hand;
  }
  function cycleHand(s, side, slot) {
    var deck = s.decks[side];
    s.hands[side][slot] = deck[s.nextIdx[side] % deck.length];
    s.nextIdx[side]++;
  }

  function enemiesOf(s, side) {
    var out = [];
    for (var i = 0; i < s.entities.length; i++) {
      var e = s.entities[i];
      if (!e.dead && e.side !== side) out.push(e);
    }
    return out;
  }
  function friendliesOf(s, side) {
    var out = [];
    for (var i = 0; i < s.entities.length; i++) {
      var e = s.entities[i];
      if (!e.dead && e.side === side && !e.isTower) out.push(e);
    }
    return out;
  }
  function nearest(list, x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var d = Math.hypot(list[i].x - x, list[i].y - y);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }

  function applyDamage(s, target, amount, sourceSide) {
    if (!target || target.dead) return;
    var amt = amount;
    for (var i = 0; i < target.effects.length; i++) {
      if (target.effects[i].kind === 'dr') amt *= (1 - target.effects[i].mult);
    }
    amt = Math.round(amt);
    if (target.shield > 0) {
      var soaked = Math.min(target.shield, amt);
      target.shield -= soaked; amt -= soaked;
    }
    if (amt > 0) target.hp -= amt;
    if (target.hp <= 0 && !target.dead) killEntity(s, target);
  }
  function addEffect(target, eff) { target.effects.push(eff); }
  function killEntity(s, e) {
    e.dead = true; e.hp = 0;
    var card = cardById(e.cardId);
    if (card && card.deathFire) {
      s.zones.push({ x: e.x, y: e.y, r: 1.5 * TILE, t: card.deathFireTime, dmg: card.deathFire, side: e.side });
    }
    if (card && card.splitAt && !e.splitDone && !e.isMini) {
      e.splitDone = true;
      burst(s, e.x, e.y, '#e0a458', 14, 130, 4, 0.6);
      for (var i = 0; i < 2; i++) {
        var m = makeEntity(card, e.side, e.x + (i === 0 ? -18 : 18), e.y, true, MINI_WAFFLE, 'waaflee');
        s.entities.push(m);
      }
    }
  }

  // Play a card from a hand slot. Returns true on success.
  // playFailReason is set on failure: 'elixir' | 'half' | 'tower' | 'targets'.
  var playFailReason = null;
  function playCard(s, side, slot, x, y) {
    playFailReason = null;
    var card = cardById(s.hands[side][slot]);
    if (!card) return false;
    if (s.elixir[side] < card.elixir) { playFailReason = 'elixir'; return false; }
    var ownHalf = side === 'player' ? (y > BRIDGE_Y + 6) : (y < BRIDGE_Y - 6);
    if (card.type === 'spell') {
      if (card.id === 'firelight_ball') {
        var foes = enemiesOf(s, side), hit = 0;
        for (var i = 0; i < foes.length; i++) {
          if (Math.hypot(foes[i].x - x, foes[i].y - y) <= card.radius * TILE) hit++;
        }
        if (!hit) { playFailReason = 'targets'; return false; }
        s.elixir[side] -= card.elixir;
        for (var j = 0; j < foes.length; j++) {
          var f = foes[j];
          if (Math.hypot(f.x - x, f.y - y) <= card.radius * TILE) {
            var dmg = f.isTower || f.isBuilding ? card.towerDmg : card.dmg;
            applyDamage(s, f, dmg, side);
            if (!f.isTower && !f.isBuilding && !f.dead) addEffect(f, { kind: 'burn', dmg: card.burn, t: card.burnTime, tick: 1 });
          }
        }
        s.tracers.push({ x1: x - 20, y1: y - 20, x2: x + 20, y2: y + 20, t: 0.25, color: '#ff7b00' });
        burst(s, x, y, '#ff7b00', 12, 120, 4, 0.5);
        burst(s, x, y, '#ffd34f', 6, 80, 3, 0.4);
        cycleHand(s, side, slot);
        return true;
      }
      if (card.id === 'portn_shield') {
        var friends = friendliesOf(s, side);
        var inRadius = [];
        for (var k = 0; k < friends.length; k++) {
          if (Math.hypot(friends[k].x - x, friends[k].y - y) <= card.radius * TILE) inRadius.push(friends[k]);
        }
        if (!inRadius.length) { playFailReason = 'targets'; return false; }
        s.elixir[side] -= card.elixir;
        var main = nearest(inRadius, x, y);
        for (var m2 = 0; m2 < inRadius.length; m2++) {
          addEffect(inRadius[m2], { kind: 'dr', mult: inRadius[m2] === main ? card.drMain : card.drOthers, t: card.drTime });
        }
        s.tracers.push({ x1: x, y1: y, x2: x, y2: y, t: 0.4, color: '#62ef88' });
        burst(s, main.x, main.y, '#62ef88', 10, 70, 3, 0.6);
        burst(s, main.x, main.y, '#ffd34f', 5, 50, 2, 0.5);
        cycleHand(s, side, slot);
        return true;
      }
      playFailReason = 'targets';
      return false;
    }
    if (!ownHalf) { playFailReason = 'half'; return false; }
    // Don't stack a troop/building on top of an own tower.
    var ownTw = ownTowers(s, side);
    for (var ti = 0; ti < ownTw.length; ti++) {
      if (Math.hypot(ownTw[ti].x - x, ownTw[ti].y - y) < 34) { playFailReason = 'tower'; return false; }
    }
    s.elixir[side] -= card.elixir;
    x = clamp(x, 24, W - 24);
    y = clamp(y, side === 'player' ? BRIDGE_Y + 20 : 90, side === 'player' ? H - 90 : BRIDGE_Y - 20);
    var n = card.count || 1;
    for (var m = 0; m < n; m++) {
      var ox = n === 1 ? 0 : (m - (n - 1) / 2) * 26;
      s.entities.push(makeEntity(card, side, x + ox, y + (m % 2) * 12, false));
    }
    cycleHand(s, side, slot);
    return true;
  }

  function aiThink(s, dt) {
    s.aiT -= dt;
    if (s.aiT > 0) return;
    s.aiT = 3.5 + Math.random() * 2.5;
    var hand = s.hands.ai;
    var affordable = [];
    for (var i = 0; i < hand.length; i++) if (cardById(hand[i]).elixir <= s.elixir.ai) affordable.push(i);
    if (!affordable.length) return;
    var slot = affordable[Math.floor(Math.random() * affordable.length)];
    var card = cardById(hand[slot]);
    if (card.type === 'spell') {
      if (card.id === 'firelight_ball') {
        var foes = friendliesOf(s, 'player');
        var target = foes.length ? nearest(foes, W / 2, H - 200) : s.towers.player.king;
        playCard(s, 'ai', slot, target.x, target.y);
      } else {
        var friends = friendliesOf(s, 'ai');
        if (friends.length) { var f = friends[Math.floor(Math.random() * friends.length)]; playCard(s, 'ai', slot, f.x, f.y); }
      }
    } else {
      playCard(s, 'ai', slot, 60 + Math.random() * (W - 120), 100 + Math.random() * 160);
    }
  }

  function update(s, dt) {
    if (s.over) return;
    s.timeLeft -= dt;
    s.animT += dt;
    for (var pi2 = s.particles.length - 1; pi2 >= 0; pi2--) {
      var pt = s.particles[pi2];
      pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.t >= pt.life) s.particles.splice(pi2, 1);
    }
    for (var gi = s.ghosts.length - 1; gi >= 0; gi--) {
      s.ghosts[gi].t += dt;
      if (s.ghosts[gi].t >= s.ghosts[gi].life) s.ghosts.splice(gi, 1);
    }
    s.elixir.player = Math.min(ELIXIR_MAX, s.elixir.player + dt / ELIXIR_REGEN);
    s.elixir.ai = Math.min(ELIXIR_MAX, s.elixir.ai + dt / ELIXIR_REGEN);
    aiThink(s, dt);

    // Zones (Lazah-Beam fire)
    for (var zi = s.zones.length - 1; zi >= 0; zi--) {
      var z = s.zones[zi];
      z.t -= dt; z.tick = (z.tick || 0) - dt;
      if (z.tick <= 0) {
        z.tick = 1;
        var foes = enemiesOf(s, z.side);
        for (var f = 0; f < foes.length; f++) if (Math.hypot(foes[f].x - z.x, foes[f].y - z.y) <= z.r) applyDamage(s, foes[f], z.dmg, z.side);
      }
      if (z.t <= 0) s.zones.splice(zi, 1);
    }
    for (var ti = s.tracers.length - 1; ti >= 0; ti--) {
      s.tracers[ti].t -= dt;
      if (s.tracers[ti].t <= 0) s.tracers.splice(ti, 1);
    }

    for (var ei = 0; ei < s.entities.length; ei++) {
      var e = s.entities[ei];
      if (e.dead || e.isTower) continue;
      var card = cardById(e.cardId);

      // Timed effects
      for (var fi = e.effects.length - 1; fi >= 0; fi--) {
        var eff = e.effects[fi];
        eff.t -= dt;
        if ((eff.kind === 'burn' || eff.kind === 'poison')) {
          eff.tick -= dt;
          if (eff.tick <= 0) { eff.tick = 1; applyDamage(s, e, eff.dmg, eff.kind === 'burn' ? 'burn' : 'poison'); if (e.dead) break; }
        }
        if (eff.t <= 0) e.effects.splice(fi, 1);
      }
      if (e.dead) continue;
      if (e.popT > 0) e.popT -= dt;
      var rooted = e.effects.some(function (x) { return x.kind === 'root' || x.kind === 'stun'; });
      if (e.effects.some(function (x) { return x.kind === 'poison'; }) && Math.random() < dt * 8) s.particles.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y, vx: 0, vy: 20, t: 0, life: 0.5, color: '#4ade80', size: 3 });
      if (e.effects.some(function (x) { return x.kind === 'burn'; }) && Math.random() < dt * 8) s.particles.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y + 6, vx: 0, vy: -30, t: 0, life: 0.4, color: '#ff7b00', size: 3 });
      if (e.effects.some(function (x) { return x.kind === 'dr'; }) && Math.random() < dt * 4) s.particles.push({ x: e.x + (Math.random() - 0.5) * 24, y: e.y + (Math.random() - 0.5) * 24, vx: 0, vy: -15, t: 0, life: 0.5, color: '#ffd34f', size: 2 });

      // Back To Begin: record position every 0.2s, rewind once at 20% HP
      if (card && card.rewindAt && !e.rewindDone) {
        e.histT = (e.histT || 0) + dt;
        if (e.histT >= 0.2) {
          e.histT = 0;
          e.history.push({ x: e.x, y: e.y });
          if (e.history.length > 20) e.history.shift(); // 20 * 0.2s = 4s of history
        }
        if (e.hp <= e.maxHp * card.rewindAt) {
          e.rewindDone = true;
          if (e.history.length) {
            for (var ghi = 0; ghi < e.history.length; ghi++) s.ghosts.push({ x: e.history[ghi].x, y: e.history[ghi].y, t: 0, life: 0.7, color: e.side === 'player' ? '#60a5fa' : '#f87171' });
            burst(s, e.x, e.y, '#60a5fa', 10, 90, 3, 0.5);
            e.x = e.history[0].x; e.y = e.history[0].y;
          }
        }
      }
      // Waaflee split at 25% HP
      if (card && card.splitAt && !e.splitDone && !e.isMini && e.hp <= e.maxHp * card.splitAt) {
        e.splitDone = true;
        burst(s, e.x, e.y, '#e0a458', 14, 130, 4, 0.6);
        for (var w = 0; w < 2; w++) s.entities.push(makeEntity(card, e.side, e.x + (w === 0 ? -18 : 18), e.y, true, MINI_WAFFLE, 'waaflee'));
      }
      // Eagle Eye spawns a mini eagle every 3s
      if (card && card.spawnEvery && !e.isMini) {
        e.spawnT += dt;
        if (e.spawnT >= card.spawnEvery) {
          e.spawnT = 0;
          var minis = 0;
          for (var mi = 0; mi < s.entities.length; mi++) if (s.entities[mi].parent === 'eagle' && s.entities[mi].side === e.side && !s.entities[mi].dead) minis++;
          if (minis < 5) { s.entities.push(makeEntity(card, e.side, e.x + 14, e.y, true, MINI_EAGLE, 'eagle')); burst(s, e.x + 14, e.y, '#f5f5f4', 6, 60, 3, 0.5); }
        }
      }
      // Guard shield aura
      if (card && card.shieldAura) {
        var allies = friendliesOf(s, e.side);
        for (var ai = 0; ai < allies.length; ai++) {
          var a = allies[ai];
          if (a !== e && !e.shieldedAllies[a.id] && Math.hypot(a.x - e.x, a.y - e.y) <= card.shieldRadius * TILE) {
            e.shieldedAllies[a.id] = true;
            a.shield += card.shieldAura;
          }
        }
      }
      // Windblower: decay + pushback
      if (card && card.decay) {
        e.hp -= card.decay * dt;
        if (e.hp <= 0) { killEntity(s, e); continue; }
        e.atkCd -= dt;
        if (e.atkCd <= 0) {
          e.atkCd = card.pushEvery;
          var foes = enemiesOf(s, e.side);
          for (var pi = 0; pi < foes.length; pi++) {
            if (!foes[pi].isTower && Math.hypot(foes[pi].x - e.x, foes[pi].y - e.y) <= card.range * TILE) {
              // Push the foe 1 tile away from the Windblower along the lane.
              var dir = foes[pi].y >= e.y ? 1 : -1;
              foes[pi].y += dir * card.pushTiles * TILE;
              foes[pi].y = clamp(foes[pi].y, 30, H - 30);
              for (var gp = 0; gp < 3; gp++) s.particles.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y, vx: (Math.random() - 0.5) * 40, vy: dir * (60 + Math.random() * 60), t: 0, life: 0.4, color: '#bae6fd', size: 2 });
            }
          }
        }
        continue;
      }
      // Ravirolli roll every 5s
      if (card && card.rollEvery) {
        e.rollT -= dt;
        if (e.rollT <= 0 && !e.rollState) {
          e.rollT = card.rollEvery;
          e.rollState = { t: 0, fromY: e.y, toY: e.y + (e.side === 'player' ? -2 * TILE : 2 * TILE), back: false, hit: {} };
        }
      }
      if (e.rollState) {
        var rs = e.rollState;
        rs.t += dt;
        if (Math.random() < dt * 20) s.particles.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y + 10, vx: 0, vy: 10, t: 0, life: 0.3, color: '#d6c9a8', size: 2 });
        var dur = 0.25;
        if (!rs.back) {
          e.y = rs.fromY + (rs.toY - rs.fromY) * Math.min(1, rs.t / dur);
          var rfoes = enemiesOf(s, e.side);
          for (var ri = 0; ri < rfoes.length; ri++) {
            var rf = rfoes[ri];
            if (!rs.hit[rf.id] && !rf.isTower && Math.abs(rf.y - e.y) < 30 && Math.abs(rf.x - e.x) < 30) {
              rs.hit[rf.id] = true;
              applyDamage(s, rf, card.rollDmg, e.side);
              if (!rf.dead) addEffect(rf, { kind: 'stun', t: 0.5 });
            }
          }
          if (rs.t >= dur) { rs.back = true; rs.t = 0; }
        } else {
          e.y = rs.toY + (rs.fromY - rs.toY) * Math.min(1, rs.t / dur);
          if (rs.t >= dur) e.rollState = null;
        }
        continue;
      }

      // Combat / movement
      e.atkCd -= dt;
      var foes2 = enemiesOf(s, e.side);
      var inRange = [];
      for (var q = 0; q < foes2.length; q++) {
        if (Math.hypot(foes2[q].x - e.x, foes2[q].y - e.y) <= (e.range || 1) * TILE) inRange.push(foes2[q]);
      }
      var tgt = inRange.length ? nearest(inRange, e.x, e.y) : null;
      if (tgt && e.dmg && (typeof e.dmg === 'number' || Array.isArray(e.dmg)) && e.atkCd <= 0) {
        e.atkCd = e.hitSpeed;
        attack(s, e, tgt, card);
      } else if (!e.isBuilding && !rooted) {
        var dest = nearest(enemyTowers(s, e.side), e.x, e.y);
        // Aggro: chase a nearby enemy instead of marching past it.
        var nearFoe = nearest(foes2, e.x, e.y);
        if (nearFoe && Math.hypot(nearFoe.x - e.x, nearFoe.y - e.y) <= ((e.range || 1) + 2) * TILE) dest = nearFoe;
        if (dest) {
          var dx = dest.x - e.x, dy = dest.y - e.y;
          var d = Math.hypot(dx, dy);
          if (d > (e.range || 1) * TILE) {
            var sp = SPEEDS[e.speed] || 65;
            e.x += dx / d * sp * dt;
            e.y += dy / d * sp * dt;
          }
        }
      }
      // Separation: don't stack units
      for (var si = 0; si < s.entities.length; si++) {
        var o = s.entities[si];
        if (o !== e && !o.dead && !o.isTower && !o.isBuilding && !e.isBuilding) {
          var dd = Math.hypot(o.x - e.x, o.y - e.y);
          if (dd > 0 && dd < 22) { e.x += (e.x - o.x) / dd * 8 * dt * 10; e.y += (e.y - o.y) / dd * 8 * dt * 10; }
        }
      }
      e.x = clamp(e.x, 20, W - 20); e.y = clamp(e.y, 30, H - 30);
    }

    // Towers shoot (all six)
    allTowers(s).forEach(function (t) {
      if (t.dead) return;
      t.atkCd -= dt;
      if (t.atkCd > 0) return;
      var foes = enemiesOf(s, t.side);
      var inR = [];
      for (var i = 0; i < foes.length; i++) if (!foes[i].isTower && Math.hypot(foes[i].x - t.x, foes[i].y - t.y) <= TOWER.range * TILE) inR.push(foes[i]);
      if (inR.length) {
        t.atkCd = TOWER.hitSpeed;
        var tg = nearest(inR, t.x, t.y);
        s.tracers.push({ x1: t.x, y1: t.y, x2: tg.x, y2: tg.y, t: 0.15, color: '#ffd34f' });
        applyDamage(s, tg, TOWER.dmg, t.side);
      }
    });

    // Cleanup + win check (CR-style: king tower destroyed = instant win)
    s.entities = s.entities.filter(function (e) { return !e.dead || e.isTower; });
    var pk = s.towers.player.king, ak = s.towers.ai.king;
    if (ak.hp <= 0 || pk.hp <= 0) {
      s.over = true;
      s.result = ak.hp <= 0 && pk.hp > 0 ? 'win' : (pk.hp <= 0 && ak.hp > 0 ? 'lose' : 'draw');
    } else if (s.timeLeft <= 0) {
      s.over = true;
      var pDown = 3 - towersAlive(s.towers.player), aDown = 3 - towersAlive(s.towers.ai);
      if (aDown > pDown) s.result = 'win';
      else if (pDown > aDown) s.result = 'lose';
      else {
        var pPct = towersHpPct(s.towers.player), aPct = towersHpPct(s.towers.ai);
        s.result = aPct < pPct ? 'win' : (pPct < aPct ? 'lose' : 'draw');
      }
    }
  }

  function attack(s, e, tgt, card) {
    if (card && card.id === 'pb_bounce') {
      var hit = [tgt], cur = tgt, dmgIdx = 0;
      applyDamage(s, tgt, card.dmg[0], e.side);
      s.particles.push({ x: tgt.x, y: tgt.y, vx: 0, vy: -20, t: 0, life: 0.4, color: '#c98a4b', size: 7 });
      while (dmgIdx < 2) {
        dmgIdx++;
        var foes = enemiesOf(s, e.side).filter(function (f) { return hit.indexOf(f) < 0 && !f.isTower; });
        var nxt = null, bd = card.bounceRange * TILE;
        for (var i = 0; i < foes.length; i++) {
          var d = Math.hypot(foes[i].x - cur.x, foes[i].y - cur.y);
          if (d <= bd) { bd = d; nxt = foes[i]; }
        }
        if (!nxt) break;
        s.tracers.push({ x1: cur.x, y1: cur.y, x2: nxt.x, y2: nxt.y, t: 0.2, color: '#c98a4b' });
        s.particles.push({ x: nxt.x, y: nxt.y, vx: 0, vy: -20, t: 0, life: 0.4, color: '#c98a4b', size: dmgIdx === 1 ? 5 : 3 });
        applyDamage(s, nxt, card.dmg[dmgIdx], e.side);
        hit.push(nxt); cur = nxt;
      }
      return;
    }
    if (card && card.id === 'no_skill') {
      e.shotCount++;
      var isPierce = e.shotCount % card.pierceEvery === 0;
      if (isPierce) {
        var pdx = tgt.x - e.x, pdy = tgt.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
        s.tracers.push({ x1: e.x, y1: e.y, x2: tgt.x + pdx / pd * 70, y2: tgt.y + pdy / pd * 70, t: 0.2, color: '#ff4bd8', w: 4 });
      } else {
        s.tracers.push({ x1: e.x, y1: e.y, x2: tgt.x, y2: tgt.y, t: 0.15, color: '#fff' });
      }
      applyDamage(s, tgt, card.dmg + (isPierce ? card.pierceBonus : 0), e.side);
      if (isPierce) {
        var foes = enemiesOf(s, e.side);
        for (var j = 0; j < foes.length; j++) {
          var f = foes[j];
          if (f !== tgt && !f.isTower && Math.abs(f.x - tgt.x) < 20 && ((f.y - e.y) * (tgt.y - e.y) > 0)) applyDamage(s, f, card.dmg + card.pierceBonus, e.side);
        }
      }
      return;
    }
    var dmg = typeof e.dmg === 'number' ? e.dmg : 0;
    if (card && card.id === 'mustard') {
      var mdx = tgt.x - e.x, mdy = tgt.y - e.y, md = Math.hypot(mdx, mdy) || 1;
      for (var sq = 0; sq < 6; sq++) s.particles.push({ x: e.x + mdx / md * (8 + sq * 4), y: e.y + mdy / md * (8 + sq * 4), vx: mdx / md * 60, vy: mdy / md * 60, t: 0, life: 0.3, color: '#f7c948', size: 3 });
    }
    s.tracers.push({ x1: e.x, y1: e.y, x2: tgt.x, y2: tgt.y, t: 0.12, color: '#ffffff' });
    applyDamage(s, tgt, dmg, e.side);
    if (card && card.poison && !tgt.isTower && !tgt.isBuilding && !tgt.dead) {
      addEffect(tgt, { kind: 'poison', dmg: card.poison, t: card.poisonTicks, tick: 1 });
    }
    if (card && card.burn && !tgt.isTower && !tgt.isBuilding && !tgt.dead) {
      addEffect(tgt, { kind: 'burn', dmg: card.burn, t: card.burnTime, tick: 1 });
    }
    if (card && card.root && !tgt.isTower && !tgt.dead) {
      addEffect(tgt, { kind: 'root', t: card.root });
    }
    if (card && card.id === 'plant_spirit') {
      var px = e.x, py = e.y;
      e.x = tgt.x; e.y = tgt.y + (e.side === 'player' ? 24 : -24);
      for (var pa = 1; pa <= 5; pa++) s.particles.push({ x: px + (e.x - px) * pa / 5, y: py + (e.y - py) * pa / 5 - Math.sin(pa / 5 * Math.PI) * 18, vx: 0, vy: 0, t: 0, life: 0.35, color: '#4ade80', size: 3 });
    }
  }

  // ---------- Rendering (browser only) ----------
  // Particles: visual-only bursts. burst() is hoisted, so update/attack
  // can call it even though it lives in this section.
  function burst(s, x, y, color, n, speed, size, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      s.particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life || 0.5, color: color, size: size || 3 });
    }
  }
  function circ(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function line(ctx, x1, y1, x2, y2, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w || 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function rr(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function leaf(ctx, x, y, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function eyes(ctx, dx, dy, gap) {
    circ(ctx, -gap + dx, dy, 1.6, '#222'); circ(ctx, gap + dx, dy, 1.6, '#222');
  }
  function poly(ctx, pts, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }

  // Draw one unit as a proper little character (notebook doodles as the
  // reference). t = battle anim clock. r = body radius.
  function drawCharacter(ctx, e, t, r) {
    var bob = (e.isBuilding || e.isTower) ? 0 : Math.sin(t * 8 + e.id * 1.7) * 2;
    var sc = 1;
    if (e.popT > 0) sc = 1 - (e.popT / 0.3) * 0.5;
    if (e.cardId === 'windblower') sc *= 0.6 + 0.4 * Math.max(0, e.hp / e.maxHp); // visibly decays
    var team = e.side === 'player' ? '#2563eb' : '#dc2626';
    var dir = e.side === 'player' ? -1 : 1; // player marches up, AI marches down
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    ctx.scale(sc, sc);
    ctx.strokeStyle = team; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.stroke();
    var id = e.cardId;
    var charging = id === 'lazah_beam' && e.atkCd > 0 && e.atkCd < 1.2;
    if (id === 'mustard') {
      // Mustard bottle character with arms, squirting mustard.
      rr(ctx, -7, -11, 14, 22, 5, '#f7c948');
      rr(ctx, -5, -16, 10, 5, 2, '#dc2626');
      rr(ctx, -7, -3, 14, 6, 2, '#fff7d6');
      line(ctx, -7, 0, -13, 5, '#7a5b00', 2); line(ctx, 7, 0, 13, -5, '#7a5b00', 2);
      eyes(ctx, 0, -6, 3);
    } else if (id === 'plant_spirit') {
      line(ctx, 0, 10, 0, -2, '#2f7d32', 3);
      leaf(ctx, -6, -4, -0.7, '#4ade80'); leaf(ctx, 6, -4, 0.7, '#4ade80'); leaf(ctx, 0, -9, 0, '#22c55e');
      circ(ctx, 0, 3, 6, '#166534'); eyes(ctx, 0, 2, 2.5);
    } else if (id === 'guard') {
      // Pentagon-shaped guard.
      poly(ctx, [[0, -r], [r * 0.95, -r * 0.3], [r * 0.6, r], [-r * 0.6, r], [-r * 0.95, -r * 0.3]], '#4a5568');
      line(ctx, -r * 0.6, -2, r * 0.6, -2, '#111827', 3);
      rr(ctx, -2, -r - 4, 4, 5, 1, '#dc2626');
    } else if (id === 'ravirolli') {
      var roll = e.rollState ? Math.sin(e.rollState.t * 20) * 3 : 0;
      ctx.rotate(roll * 0.2);
      rr(ctx, -10, -10, 20, 20, 5, '#e8c98a');
      circ(ctx, 0, 0, 4, '#c0392b');
      ctx.strokeStyle = '#b89a5e'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -7, 14, 14);
      eyes(ctx, 0, -3, 3);
    } else if (id === 'eagle_eye' || id === 'mini_eagle') {
      ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      circ(ctx, dir * 0 + 4, -r * 0.6, r * 0.45, '#f5f5f4');
      poly(ctx, [[8, -r * 0.6], [14, -r * 0.4], [8, -r * 0.2]], '#f7c948');
      ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.7, 0.3, 2.4); ctx.stroke();
      eyes(ctx, 4, -r * 0.6, 2);
    } else if (id === 'lazah_beam') {
      rr(ctx, -9, -6, 18, 18, 3, '#9aa5b1');
      rr(ctx, -7, -16, 14, 10, 3, '#6b7280');
      line(ctx, 0, -16, 0, -22, '#4b5563', 2);
      circ(ctx, 0, -23, charging ? 4 : 2.5, charging ? '#22d3ee' : '#f43f5e');
      eyes(ctx, 0, -11, 3.5);
      // Arm cannon points toward the enemy side.
      rr(ctx, -3, dir < 0 ? -26 : 12, 6, 10, 2, '#374151');
      if (charging) {
        ctx.strokeStyle = 'rgba(34,211,238,' + (0.5 + 0.4 * Math.sin(t * 20)) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, dir < 0 ? -26 : 22, 10 + Math.sin(t * 20) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (id === 'radio_tower') {
      line(ctx, 0, 14, 0, -14, '#4b5563', 3);
      line(ctx, -10, -4, 10, -4, '#4b5563', 2);
      circ(ctx, 0, -18, 4, '#374151');
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
      for (var sg = 1; sg <= 2; sg++) {
        ctx.beginPath(); ctx.arc(0, -18, 8 + sg * 5 + Math.sin(t * 4 + sg) * 1.5, -0.9, 0.9); ctx.stroke();
      }
      rr(ctx, -8, 8, 16, 8, 2, '#6b7280');
    } else if (id === 'wolverdog') {
      ctx.fillStyle = '#6b4a2f'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      poly(ctx, [[-r * 0.7, -r * 0.6], [-r * 0.4, -r * 1.2], [-r * 0.2, -r * 0.5]], '#5d3a1a');
      poly(ctx, [[r * 0.7, -r * 0.6], [r * 0.4, -r * 1.2], [r * 0.2, -r * 0.5]], '#5d3a1a');
      circ(ctx, dir * 0 + 6, 2, r * 0.4, '#d9b48f');
      eyes(ctx, 2, -3, 3);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.5;
      for (var cl = 0; cl < 3; cl++) line(ctx, -r * 0.4 + cl * 3, r * 0.8, -r * 0.5 + cl * 3, r * 1.1, '#e5e7eb', 1.5);
    } else if (id === 'pb_bounce') {
      rr(ctx, -11, -12, 22, 26, 5, '#c98a4b');
      rr(ctx, -11, -16, 22, 6, 2, '#8b5a2b');
      rr(ctx, -8, -4, 16, 10, 2, '#fff3d6');
      ctx.fillStyle = '#7c4a21'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PB', 0, 1);
      circ(ctx, -16, 8, 4, '#a16207'); circ(ctx, 16, 4, 4, '#a16207');
    } else if (id === 'waaflee' || id === 'mini_waaffle' || id === 'mini_waaflee') {
      rr(ctx, -10, -10, 20, 20, 4, '#e0a458');
      ctx.strokeStyle = '#b97f3e'; ctx.lineWidth = 1.5;
      line(ctx, -3, -10, -3, 10, '#b97f3e', 1.5); line(ctx, 4, -10, 4, 10, '#b97f3e', 1.5);
      line(ctx, -10, -3, 10, -3, '#b97f3e', 1.5); line(ctx, -10, 4, 10, 4, '#b97f3e', 1.5);
      poly(ctx, [[-6, -10], [0, -14], [6, -10]], '#8b5a2b');
      eyes(ctx, 0, 0, 3.5);
    } else if (id === 'windblower') {
      circ(ctx, 0, 0, r, '#94a3b8');
      circ(ctx, 0, 0, r * 0.5, '#cbd5e1');
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2.5;
      for (var bl = 0; bl < 3; bl++) {
        var ba = t * 8 + bl * 2.1;
        line(ctx, 0, 0, Math.cos(ba) * r * 0.85, Math.sin(ba) * r * 0.85, '#e2e8f0', 2.5);
      }
      circ(ctx, 0, 0, 3, '#475569');
    } else if (id === 'back_to_begin') {
      rr(ctx, -7, -4, 14, 18, 4, '#7c5cff');
      circ(ctx, 0, -10, 6, '#f2c79b');
      line(ctx, 8, -14, 14, -2, '#e5e7eb', 2.5);
      circ(ctx, 0, 4, 4, '#ffd34f');
      line(ctx, 0, 4, 0, 1, '#7c2d12', 1.5); line(ctx, 0, 4, 2.5, 5, '#7c2d12', 1.5);
    } else if (id === 'no_skill') {
      rr(ctx, -12, -12, 24, 26, 3, '#6b7280');
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -16, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -16, 3, 0, Math.PI * 2); ctx.stroke();
      line(ctx, -12, -16, -20, -16, '#374151', 2); line(ctx, 12, -16, 20, -16, '#374151', 2);
      rr(ctx, -8, 6, 16, 8, 2, '#4b5563');
    } else if (id === 'firelight_ball') {
      circ(ctx, 0, 0, r, '#ff7b00');
      circ(ctx, -2, -2, r * 0.55, '#ffd34f');
      poly(ctx, [[-4, -r], [0, -r - 6], [4, -r]], '#ff7b00');
    } else if (id === 'portn_shield') {
      poly(ctx, [[0, -r - 2], [r * 0.8, -r * 0.4], [r * 0.6, r * 0.8], [0, r + 2], [-r * 0.6, r * 0.8], [-r * 0.8, -r * 0.4]], '#22c55e');
      poly(ctx, [[0, -r + 3], [r * 0.45, -r * 0.2], [r * 0.35, r * 0.5], [0, r - 2], [-r * 0.35, r * 0.5], [-r * 0.45, -r * 0.2]], '#bbf7d0');
    } else {
      circ(ctx, 0, 0, r, team);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((e.name || '?').charAt(0), 0, 0);
    }
    ctx.restore();
    // Status overlays (drawn unscaled, in arena space).
    if (e.shield > 0) {
      ctx.fillStyle = 'rgba(98,239,136,0.22)';
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#62ef88'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    var hasDr = e.effects.some(function (x) { return x.kind === 'dr'; });
    if (hasDr) {
      ctx.strokeStyle = '#ffd34f'; ctx.lineWidth = 2;
      try { ctx.setLineDash([4, 3]); } catch (err) {}
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 8, 0, Math.PI * 2); ctx.stroke();
      try { ctx.setLineDash([]); } catch (err) {}
    }
    var rooted = e.effects.some(function (x) { return x.kind === 'root'; });
    if (rooted) {
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x - r, e.y + r);
      ctx.quadraticCurveTo(e.x - r / 2, e.y + r + 5, e.x, e.y + r);
      ctx.quadraticCurveTo(e.x + r / 2, e.y + r + 5, e.x + r, e.y + r); ctx.stroke();
    }
    if (!e.isTower) {
      var w = e.isBuilding ? 40 : 30;
      ctx.fillStyle = '#222'; ctx.fillRect(e.x - w / 2, e.y - r - 12, w, 6);
      ctx.fillStyle = '#62ef88'; ctx.fillRect(e.x - w / 2, e.y - r - 12, w * Math.max(0, e.hp / e.maxHp), 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(e.x - w / 2, e.y - r - 12, w, 6);
    }
  }

  // Towers as stone structures: side towers crenellated, king tower crowned.
  function drawTower(ctx, tw, t) {
    var team = tw.side === 'player' ? '#2563eb' : '#dc2626';
    var w = tw.isKing ? 56 : 44, h = tw.isKing ? 64 : 50;
    var x = tw.x - w / 2, y = tw.y - h / 2;
    rr(ctx, x, y, w, h, 4, '#8d8d9b');
    ctx.fillStyle = '#6e6e7d';
    for (var i = 0; i < 3; i++) ctx.fillRect(x + 4 + i * (w - 8) / 3, y - 6, (w - 8) / 3 - 4, 7);
    rr(ctx, x + w / 2 - 7, y + h - 18, 14, 18, 3, '#4a4a58');
    rr(ctx, x + w / 2 - 10, y + 10, 20, 8, 2, team);
    if (tw.isKing) {
      poly(ctx, [[tw.x - 14, y - 8], [tw.x - 8, y - 18], [tw.x, y - 9], [tw.x + 8, y - 18], [tw.x + 14, y - 8]], '#ffd34f');
      circ(ctx, tw.x, y - 8, 2.5, '#ef4444');
    }
    var bw = w;
    ctx.fillStyle = '#222'; ctx.fillRect(tw.x - bw / 2, y - 14, bw, 6);
    ctx.fillStyle = tw.side === 'player' ? '#62ef88' : '#ff4b55';
    ctx.fillRect(tw.x - bw / 2, y - 14, bw * Math.max(0, tw.hp / tw.maxHp), 6);
  }

  function drawBattle(ctx, s) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#3d9b4f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b6cb0'; ctx.fillRect(0, BRIDGE_Y - 14, W, 28); // river
    ctx.fillStyle = '#d9c08a'; ctx.fillRect(W / 2 - 30, BRIDGE_Y - 14, 60, 28); // bridge
    for (var zi = 0; zi < s.zones.length; zi++) {
      var z = s.zones[zi];
      ctx.fillStyle = 'rgba(255,123,0,0.35)';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7b00';
      for (var fl = 0; fl < 6; fl++) {
        var fa = fl / 6 * Math.PI * 2 + s.animT * 3;
        var fx = z.x + Math.cos(fa) * z.r * 0.8, fy = z.y + Math.sin(fa) * z.r * 0.8;
        poly(ctx, [[fx - 4, fy + 4], [fx, fy - 6 - Math.sin(s.animT * 9 + fl) * 2], [fx + 4, fy + 4]], '#ff7b00');
      }
    }
    for (var gi2 = 0; gi2 < s.ghosts.length; gi2++) {
      var g = s.ghosts[gi2];
      ctx.fillStyle = g.color; ctx.globalAlpha = Math.max(0, 0.5 * (1 - g.t / g.life));
      ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (var ti = 0; ti < s.tracers.length; ti++) {
      var tr = s.tracers[ti];
      ctx.strokeStyle = tr.color; ctx.lineWidth = tr.w || 2;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
    }
    for (var pi3 = 0; pi3 < s.particles.length; pi3++) {
      var pp = s.particles[pi3];
      ctx.fillStyle = pp.color; ctx.globalAlpha = Math.max(0, 1 - pp.t / pp.life);
      ctx.fillRect(pp.x - pp.size / 2, pp.y - pp.size / 2, pp.size, pp.size);
      ctx.globalAlpha = 1;
    }
    for (var ei = 0; ei < s.entities.length; ei++) {
      var e = s.entities[ei];
      if (e.dead) continue;
      if (e.isTower) { drawTower(ctx, e, s.animT); continue; }
      var r = e.isBuilding ? 20 : (e.isMini ? 9 : 13);
      drawCharacter(ctx, e, s.animT, r);
    }
  }

  // Small canvas icons for hand / deck grid, drawn with the same characters.
  function drawIcon(canvas, cardId) {
    var c = cardById(cardId);
    if (!c) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var fake = { id: 1, cardId: cardId, side: 'player', x: 0, y: 0, hp: 1, maxHp: 1, shield: 0, effects: [], isTower: false, isBuilding: c.type === 'building', isMini: false, atkCd: 99, popT: 0 };
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 2);
    drawCharacter(ctx, fake, 0, 16);
    ctx.restore();
  }
  function drawIcons(container) {
    if (!container) return;
    container.querySelectorAll('canvas.icon').forEach(function (cv) { drawIcon(cv, cv.getAttribute('data-icon')); });
  }

  // ---------- Persistence (guarded for non-browser use) ----------
  function storeGet(k, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      var v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch (err) { return fallback; }
  }
  function storeSet(k, v) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, JSON.stringify(v)); } catch (err) {}
  }
  var DEFAULT_DECK = ['mustard', 'plant_spirit', 'guard', 'firelight_ball', 'ravirolli', 'eagle_eye', 'radio_tower', 'lazah_beam'];
  var AI_DECK = ['mustard', 'plant_spirit', 'firelight_ball', 'ravirolli', 'eagle_eye', 'radio_tower', 'wolverdog', 'lazah_beam'];

  function chestReward(tier) {
    var counts = { 1: 3, 2: 4, 3: 5, 4: 8 };
    var crs = { 1: 50, 2: 100, 3: 200, 4: 400 };
    var cards = [];
    for (var i = 0; i < (counts[tier] || 3); i++) cards.push(CARDS[Math.floor(Math.random() * CARDS.length)].id);
    return { cards: cards, crs: crs[tier] || 50 };
  }
  function rollChestTier() {
    var r = Math.random();
    return r < 0.7 ? 1 : (r < 0.9 ? 2 : (r < 0.98 ? 3 : 4));
  }

  // Expose core for headless smoke tests (node).
  if (typeof globalThis !== 'undefined') {
    globalThis.BashBoyale = { CARDS: CARDS, cardById: cardById, createBattle: createBattle, update: update, playCard: playCard, chestReward: chestReward, makeEntity: makeEntity, applyDamage: applyDamage, drawBattle: drawBattle, DEFAULT_DECK: DEFAULT_DECK, AI_DECK: AI_DECK, getPlayFailReason: function () { return playFailReason; } };
  }

  // ---------- Browser UI ----------
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  function show(id) {
    ['screen-home', 'screen-deck', 'screen-chests', 'screen-battle'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
  }
  function getDeck() {
    var d = storeGet('bb_deck', null);
    if (!Array.isArray(d)) return DEFAULT_DECK.slice();
    var clean = d.filter(function (id) { return !!cardById(id); });
    return clean.length ? clean : DEFAULT_DECK.slice();
  }
  function getChests() { return storeGet('bb_chests', []); }
  function getCrystals() { return storeGet('bb_crystals', 0); }
  function getCollection() { return storeGet('bb_cards', {}); }

  function refreshHome() {
    var chests = getChests();
    $('chest-count').textContent = chests.length ? '(' + chests.length + ')' : '';
    var col = getCollection(), total = 0;
    Object.keys(col).forEach(function (k) { total += col[k]; });
    $('collection-summary').textContent = 'Collection: ' + total + ' cards · ' + getCrystals() + ' Crystils';
  }
  function renderDeckScreen() {
    var deck = getDeck();
    $('deck-slots').innerHTML = deck.map(function (id) {
      var c = cardById(id);
      return '<div class="card in-deck"><canvas class="icon" width="40" height="40" data-icon="' + id + '"></canvas><div class="name">' + c.name + '</div></div>';
    }).join('');
    drawIcons($('deck-slots'));
    $('deck-status').textContent = 'Deck: ' + deck.length + ' / 8' + (deck.length === 8 ? ' — ready' : ' — tap cards below to add/remove');
    $('card-grid').innerHTML = CARDS.map(function (c) {
      var n = deck.filter(function (x) { return x === c.id; }).length;
      return '<div class="card' + (n ? ' in-deck' : '') + '" data-id="' + c.id + '"><canvas class="icon" width="48" height="48" data-icon="' + c.id + '"></canvas><div class="name">' + c.name + '</div><div class="cost">' + c.elixir + ' elixir · ' + c.type + '</div><div>' + (n ? 'in deck' : 'tap to add') + '</div></div>';
    }).join('');
    drawIcons($('card-grid'));
    var grid = $('card-grid');
    grid.querySelectorAll('.card').forEach(function (el) {
      el.onclick = function () {
        var id = el.getAttribute('data-id'), d = getDeck();
        var ix = d.indexOf(id);
        if (ix >= 0) d.splice(ix, 1);
        else if (d.length < 8) d.push(id);
        else { $('deck-status').textContent = 'Deck full — remove a card first'; return; }
        storeSet('bb_deck', d);
        renderDeckScreen();
      };
    });
  }
  function renderChestScreen() {
    $('crystal-count').textContent = getCrystals();
    var chests = getChests();
    $('chest-list').innerHTML = chests.length ? chests.map(function (t, i) {
      return '<div class="chest" data-i="' + i + '"><div>Tier ' + t + ' chest</div><div>tap to open</div></div>';
    }).join('') : '<p>No chests yet — win a battle to earn one!</p>';
    $('chest-list').querySelectorAll('.chest').forEach(function (el) {
      el.onclick = function () {
        var idx = parseInt(el.getAttribute('data-i'), 10);
        var all = getChests(), tier = all.splice(idx, 1)[0];
        var rw = chestReward(tier), col = getCollection();
        rw.cards.forEach(function (id) { col[id] = (col[id] || 0) + 1; });
        storeSet('bb_cards', col);
        storeSet('bb_crystals', getCrystals() + rw.crs);
        storeSet('bb_chests', all);
        $('chest-rewards').textContent = 'Opened a Tier ' + tier + ' chest! +' + rw.crs + ' Crystils and: ' +
          rw.cards.map(function (id) { return cardById(id).name; }).join(', ');
        renderChestScreen();
      };
    });
  }

  var battle = null, selectedSlot = -1, raf = 0, lastT = 0;
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  // Rebuilds the hand cards. Called ONLY when the hand changes (battle start,
  // card played, selection changed) — never every frame, or taps die mid-click.
  function renderHand() {
    if (!battle) return;
    $('hand').innerHTML = battle.hands.player.map(function (id, i) {
      var c = cardById(id);
      var afford = battle.elixir.player >= c.elixir;
      return '<div class="card' + (selectedSlot === i ? ' selected' : '') + (afford ? '' : ' cant-afford') + '" data-i="' + i + '"><canvas class="icon" width="48" height="48" data-icon="' + id + '"></canvas><div class="name">' + c.name + '</div><div class="cost">' + c.elixir + ' elixir</div></div>';
    }).join('');
    $('hand').querySelectorAll('.card').forEach(function (el) {
      el.onclick = function () { selectedSlot = parseInt(el.getAttribute('data-i'), 10); renderHand(); };
    });
    drawIcons($('hand'));
    updateHud();
  }
  // Cheap per-frame HUD refresh: never touches the hand nodes themselves.
  function updateHud() {
    if (!battle) return;
    var deck = battle.decks.player;
    var nextId = deck[battle.nextIdx.player % deck.length];
    $('next-card').textContent = cardById(nextId).name;
    $('elixir-fill').style.width = (battle.elixir.player / ELIXIR_MAX * 100) + '%';
    $('elixir-text').textContent = Math.floor(battle.elixir.player) + ' / ' + ELIXIR_MAX;
    $('ai-elixir-text').textContent = 'AI: ' + Math.floor(battle.elixir.ai) + ' / ' + ELIXIR_MAX;
    $('ai-tower-hp').style.width = Math.max(0, battle.towers.ai.king.hp / battle.towers.ai.king.maxHp * 100) + '%';
    $('player-tower-hp').style.width = Math.max(0, battle.towers.player.king.hp / battle.towers.player.king.maxHp * 100) + '%';
    $('ai-towers-left').textContent = towersAlive(battle.towers.ai) + '/3 towers';
    $('player-towers-left').textContent = towersAlive(battle.towers.player) + '/3 towers';
    $('timer').textContent = fmtTime(Math.max(0, battle.timeLeft));
    $('hand').querySelectorAll('.card').forEach(function (el) {
      var c = cardById(battle.hands.player[parseInt(el.getAttribute('data-i'), 10)]);
      el.classList.toggle('cant-afford', !!c && battle.elixir.player < c.elixir);
    });
  }
  function battleLoop(ts) {
    if (!battle) return;
    var dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    update(battle, dt);
    var ctx = $('arena').getContext('2d');
    drawBattle(ctx, battle);
    updateHud();
    if (battle.over) { endBattle(); return; }
    raf = requestAnimationFrame(battleLoop);
  }
  function endBattle() {
    cancelAnimationFrame(raf);
    var title = battle.result === 'win' ? 'YOU WIN!' : (battle.result === 'lose' ? 'You lose' : 'Draw');
    var sub = 'AI towers down ' + (3 - towersAlive(battle.towers.ai)) + '/3 · Your towers down ' + (3 - towersAlive(battle.towers.player)) + '/3 · King HP: AI ' + Math.max(0, Math.round(battle.towers.ai.king.hp)) + ' / You ' + Math.max(0, Math.round(battle.towers.player.king.hp));
    if (battle.result === 'win') {
      var chests = getChests();
      if (chests.length < 4) { chests.push(rollChestTier()); storeSet('bb_chests', chests); sub += ' · You earned a chest!'; }
      else sub += ' · (chest slots full — open one first!)';
    }
    $('end-title').textContent = title;
    $('end-sub').textContent = sub;
    $('battle-end').classList.remove('hidden');
  }
  function startBattle() {
    battle = createBattle(getDeck(), AI_DECK);
    selectedSlot = -1;
    $('battle-end').classList.add('hidden');
    $('battle-msg').textContent = 'Pick a card, then tap your side of the arena!';
    show('screen-battle');
    lastT = performance.now();
    renderHand();
    raf = requestAnimationFrame(battleLoop);
  }

  $('btn-play').onclick = function () {
    if (getDeck().length !== 8) { show('screen-deck'); renderDeckScreen(); $('deck-status').textContent = 'Pick 8 cards first!'; return; }
    startBattle();
  };
  $('btn-deck').onclick = function () { show('screen-deck'); renderDeckScreen(); };
  $('btn-deck-back').onclick = function () { show('screen-home'); refreshHome(); };
  $('btn-chests').onclick = function () { show('screen-chests'); renderChestScreen(); };
  $('btn-chests-back').onclick = function () { show('screen-home'); refreshHome(); };
  $('btn-rematch').onclick = startBattle;
  $('btn-battle-home').onclick = function () { battle = null; cancelAnimationFrame(raf); show('screen-home'); refreshHome(); };
  $('btn-quit').onclick = function () { battle = null; cancelAnimationFrame(raf); show('screen-home'); refreshHome(); };
  $('arena').addEventListener('click', function (ev) {
    if (!battle || battle.over) return;
    if (selectedSlot < 0) { $('battle-msg').textContent = 'Pick a card first!'; return; }
    var rect = $('arena').getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width * W;
    var y = (ev.clientY - rect.top) / rect.height * H;
    var card = cardById(battle.hands.player[selectedSlot]);
    if (card.type !== 'spell' && y <= BRIDGE_Y + 6) { $('battle-msg').textContent = 'Troops and buildings go on YOUR half (below the river)!'; return; }
    if (playCard(battle, 'player', selectedSlot, x, y)) {
      $('battle-msg').textContent = card.name + ' played!';
      selectedSlot = -1;
    } else if (playFailReason === 'targets') {
      $('battle-msg').textContent = 'No targets there!';
    } else if (playFailReason === 'tower') {
      $('battle-msg').textContent = 'Too close to your tower!';
    } else if (playFailReason === 'half') {
      $('battle-msg').textContent = 'Troops and buildings go on YOUR half (below the river)!';
    } else {
      $('battle-msg').textContent = 'Not enough elixir for ' + card.name + '!';
    }
    renderHand();
  });

  show('screen-home');
  refreshHome();

  // Test seams for the PR 2 regression test (harmless extra global in browsers).
  if (typeof globalThis !== 'undefined') {
    globalThis.BashBoyaleUI = {
      getDeck: getDeck, renderDeckScreen: renderDeckScreen, renderHand: renderHand,
      updateHud: updateHud, startBattle: startBattle,
      getSelectedSlot: function () { return selectedSlot; },
      getBattle: function () { return battle; }
    };
  }
})();
