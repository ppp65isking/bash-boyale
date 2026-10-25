// Bash Boyale — PR 1
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

  // id, name, emoji, elixir, type, hp, dmg, hitSpeed, rangeTiles, speed, count, special
  var CARDS = [
    { id: 'mustard', name: 'Mustard', emoji: '🌭', elixir: 1, type: 'troop', hp: 1250, dmg: 300, hitSpeed: 1.7, range: 1, speed: 'slow', count: 1 },
    { id: 'plant_spirit', name: 'Plant Spirit', emoji: '🌱', elixir: 1, type: 'troop', hp: 680, dmg: 130, hitSpeed: 1.1, range: 1, speed: 'fast', count: 1, root: 1 },
    { id: 'guard', name: 'Guard', emoji: '🪖', elixir: 1, type: 'troop', hp: 1200, dmg: 0, hitSpeed: 1, range: 0, speed: 'norm', count: 1, shieldAura: 1000, shieldRadius: 2.5 },
    { id: 'firelight_ball', name: 'Firelight Ball', emoji: '🔥', elixir: 3, type: 'spell', dmg: 650, towerDmg: 300, burn: 100, burnTime: 3, radius: 2 },
    { id: 'ravirolli', name: 'Ravirolli', emoji: '🍝', elixir: 4, type: 'troop', hp: 1900, dmg: 180, hitSpeed: 1.6, range: 3, speed: 'norm', count: 3, burn: 40, burnTime: 2, rollEvery: 5, rollDmg: 130 },
    { id: 'eagle_eye', name: 'Eagle Eye', emoji: '🦅', elixir: 4, type: 'troop', hp: 1200, dmg: 111, hitSpeed: 1.0, range: 4, speed: 'fast', count: 1, spawnEvery: 3 },
    { id: 'lazah_beam', name: 'Lazah-Beam', emoji: '🤖', elixir: 4, type: 'troop', hp: 5500, dmg: 1850, hitSpeed: 5.8, range: 5, speed: 'slow', count: 1, deathFire: 250, deathFireTime: 2 },
    { id: 'radio_tower', name: 'Radio Tower', emoji: '📻', elixir: 4, type: 'building', hp: 3000, dmg: 500, hitSpeed: 1.9, range: 4, count: 1 },
    { id: 'portn_shield', name: 'Portn-Shield', emoji: '🛡️', elixir: 5, type: 'spell', radius: 4, drMain: 0.40, drOthers: 0.10, drTime: 7 },
    { id: 'wolverdog', name: 'Wolverdog', emoji: '🐺', elixir: 6, type: 'troop', hp: 6200, dmg: 350, hitSpeed: 1.1, range: 4, speed: 'fast', count: 1, poison: 55, poisonTicks: 3 },
    { id: 'pb_bounce', name: "PB n' Bounce", emoji: '🥜', elixir: 6, type: 'building', hp: 6000, dmg: [410, 300, 150], hitSpeed: 1.6, range: 6, bounceRange: 2, count: 1 }, // hitSpeed CHOSEN (notes give no rate)
    { id: 'waaflee', name: 'Waaflee', emoji: '🧇', elixir: 9, type: 'troop', hp: 9400, dmg: 980, hitSpeed: 2.6, range: 1, speed: 'fast', count: 1, splitAt: 0.25 },
    { id: 'windblower', name: 'Windblower', emoji: '🌀', elixir: 9, type: 'building', hp: 1400, pushTiles: 1, pushEvery: 1.2, decay: 70, range: 3, count: 1 }, // decay + range CHOSEN (notes: "Decaying HP", no rate/range)
    { id: 'back_to_begin', name: 'Back To Begin', emoji: '⏪', elixir: 10, type: 'troop', hp: 4720, dmg: 783, hitSpeed: 1.9, range: 1, speed: 'fast', count: 1, rewindAt: 0.20 },
    { id: 'no_skill', name: 'No-skill', emoji: '🎯', elixir: 11, type: 'building', hp: 9900, dmg: 45, hitSpeed: 0.9, range: 9, pierceEvery: 3, pierceBonus: 16, count: 1 }
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
      id: nextId++, cardId: card ? card.id : (isMini ? 'mini' : 'tower'),
      name: isMini ? (parent === 'waaflee' ? 'Mini Waffle' : 'Mini Eagle') : (card ? card.name : 'Tower'),
      emoji: card ? card.emoji : '🏰',
      side: side, x: x, y: y, hp: hp, maxHp: hp, shield: 0,
      atkCd: 0, isBuilding: !!(card && card.type === 'building'), isTower: !card,
      isMini: !!isMini, miniDef: miniDef || null, parent: parent || null,
      dead: false, effects: [], shotCount: 0, spawnT: 0, rollT: card && card.rollEvery ? card.rollEvery : 0,
      rollState: null, history: [], splitDone: false, rewindDone: false,
      shieldedAllies: {}, dmg: isMini ? miniDef.dmg : (card ? card.dmg : TOWER.dmg),
      hitSpeed: isMini ? miniDef.hitSpeed : (card ? card.hitSpeed : TOWER.hitSpeed),
      range: isMini ? miniDef.range : (card ? card.range : TOWER.range),
      speed: isMini ? miniDef.speed : (card ? card.speed : null)
    };
  }

  function createBattle(playerDeck, aiDeck) {
    var s = {
      timeLeft: MATCH_TIME, over: false, result: null,
      elixir: { player: ELIXIR_START, ai: ELIXIR_START },
      entities: [], zones: [], tracers: [],
      towers: {
        player: makeEntity(null, 'player', W / 2, H - 60, false),
        ai: makeEntity(null, 'ai', W / 2, 60, false)
      },
      hands: {}, decks: { player: playerDeck.slice(), ai: aiDeck.slice() },
      nextIdx: { player: 0, ai: 0 }, aiT: 4, log: []
    };
    s.entities.push(s.towers.player, s.towers.ai);
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
    if (card && card.splitAt && !e.splitDone) {
      e.splitDone = true;
      for (var i = 0; i < 2; i++) {
        var m = makeEntity(card, e.side, e.x + (i === 0 ? -18 : 18), e.y, true, MINI_WAFFLE, 'waaflee');
        s.entities.push(m);
      }
    }
  }

  // Play a card from a hand slot. Returns true on success.
  function playCard(s, side, slot, x, y) {
    var card = cardById(s.hands[side][slot]);
    if (!card) return false;
    if (s.elixir[side] < card.elixir) return false;
    var ownHalf = side === 'player' ? (y > BRIDGE_Y + 6) : (y < BRIDGE_Y - 6);
    if (card.type === 'spell') {
      if (card.id === 'firelight_ball') {
        s.elixir[side] -= card.elixir;
        var foes = enemiesOf(s, side);
        for (var i = 0; i < foes.length; i++) {
          var f = foes[i];
          if (Math.hypot(f.x - x, f.y - y) <= card.radius * TILE) {
            var dmg = f.isTower || f.isBuilding ? card.towerDmg : card.dmg;
            applyDamage(s, f, dmg, side);
            if (!f.isTower && !f.isBuilding && !f.dead) addEffect(f, { kind: 'burn', dmg: card.burn, t: card.burnTime, tick: 1 });
          }
        }
        s.tracers.push({ x1: x - 20, y1: y - 20, x2: x + 20, y2: y + 20, t: 0.25, color: '#ff7b00' });
        cycleHand(s, side, slot);
        return true;
      }
      if (card.id === 'portn_shield') {
        s.elixir[side] -= card.elixir;
        var friends = friendliesOf(s, side);
        var inRadius = [];
        for (var j = 0; j < friends.length; j++) {
          if (Math.hypot(friends[j].x - x, friends[j].y - y) <= card.radius * TILE) inRadius.push(friends[j]);
        }
        var main = nearest(inRadius, x, y);
        for (var k = 0; k < inRadius.length; k++) {
          addEffect(inRadius[k], { kind: 'dr', mult: inRadius[k] === main ? card.drMain : card.drOthers, t: card.drTime });
        }
        s.tracers.push({ x1: x, y1: y, x2: x, y2: y, t: 0.4, color: '#62ef88' });
        cycleHand(s, side, slot);
        return true;
      }
      return false;
    }
    if (!ownHalf) return false;
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
        var target = foes.length ? nearest(foes, W / 2, H - 200) : s.towers.player;
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

    var towerTarget = { player: s.towers.ai, ai: s.towers.player };
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
      var rooted = e.effects.some(function (x) { return x.kind === 'root' || x.kind === 'stun'; });

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
          if (e.history.length) { e.x = e.history[0].x; e.y = e.history[0].y; }
        }
      }
      // Waaflee split at 25% HP
      if (card && card.splitAt && !e.splitDone && e.hp <= e.maxHp * card.splitAt) {
        e.splitDone = true;
        for (var w = 0; w < 2; w++) s.entities.push(makeEntity(card, e.side, e.x + (w === 0 ? -18 : 18), e.y, true, MINI_WAFFLE, 'waaflee'));
      }
      // Eagle Eye spawns a mini eagle every 3s
      if (card && card.spawnEvery) {
        e.spawnT += dt;
        if (e.spawnT >= card.spawnEvery) {
          e.spawnT = 0;
          var minis = 0;
          for (var mi = 0; mi < s.entities.length; mi++) if (s.entities[mi].parent === 'eagle' && s.entities[mi].side === e.side && !s.entities[mi].dead) minis++;
          if (minis < 5) s.entities.push(makeEntity(card, e.side, e.x + 14, e.y, true, MINI_EAGLE, 'eagle'));
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
              foes[pi].y += (foes[pi].y >= e.y ? 1 : -1) * card.pushTiles * TILE;
              foes[pi].y = clamp(foes[pi].y, 30, H - 30);
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
        var dest = towerTarget[e.side];
        // Aggro: chase a nearby enemy instead of marching past it.
        var nearFoe = nearest(foes2, e.x, e.y);
        if (nearFoe && Math.hypot(nearFoe.x - e.x, nearFoe.y - e.y) <= ((e.range || 1) + 2) * TILE) dest = nearFoe;
        var dx = dest.x - e.x, dy = dest.y - e.y;
        var d = Math.hypot(dx, dy);
        if (d > (e.range || 1) * TILE) {
          var sp = SPEEDS[e.speed] || 65;
          e.x += dx / d * sp * dt;
          e.y += dy / d * sp * dt;
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

    // Towers shoot
    [s.towers.player, s.towers.ai].forEach(function (t) {
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

    // Cleanup + win check
    s.entities = s.entities.filter(function (e) { return !e.dead || e.isTower; });
    if (s.towers.ai.hp <= 0 || s.towers.player.hp <= 0) {
      s.over = true;
      s.result = s.towers.ai.hp <= 0 && s.towers.player.hp > 0 ? 'win' : (s.towers.player.hp <= 0 && s.towers.ai.hp > 0 ? 'lose' : 'draw');
    } else if (s.timeLeft <= 0) {
      s.over = true;
      var pPct = s.towers.player.hp / s.towers.player.maxHp, aPct = s.towers.ai.hp / s.towers.ai.maxHp;
      s.result = aPct < pPct ? 'win' : (pPct < aPct ? 'lose' : 'draw');
    }
  }

  function attack(s, e, tgt, card) {
    if (card && card.id === 'pb_bounce') {
      var hit = [tgt], cur = tgt, dmgIdx = 0;
      applyDamage(s, tgt, card.dmg[0], e.side);
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
        applyDamage(s, nxt, card.dmg[dmgIdx], e.side);
        hit.push(nxt); cur = nxt;
      }
      return;
    }
    if (card && card.id === 'no_skill') {
      e.shotCount++;
      var isPierce = e.shotCount % card.pierceEvery === 0;
      s.tracers.push({ x1: e.x, y1: e.y, x2: tgt.x, y2: tgt.y, t: 0.15, color: isPierce ? '#ff4bd8' : '#fff' });
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
    if (card && card.id === 'plant_spirit') { e.x = tgt.x; e.y = tgt.y + (e.side === 'player' ? 24 : -24); } // pounce onto target
  }

  // ---------- Rendering (browser only) ----------
  function drawBattle(ctx, s) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#3d9b4f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b6cb0'; ctx.fillRect(0, BRIDGE_Y - 14, W, 28); // river
    ctx.fillStyle = '#d9c08a'; ctx.fillRect(W / 2 - 30, BRIDGE_Y - 14, 60, 28); // bridge
    for (var zi = 0; zi < s.zones.length; zi++) {
      var z = s.zones[zi];
      ctx.fillStyle = 'rgba(255,123,0,0.35)';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
    }
    for (var ti = 0; ti < s.tracers.length; ti++) {
      var t = s.tracers[ti];
      ctx.strokeStyle = t.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    for (var ei = 0; ei < s.entities.length; ei++) {
      var e = s.entities[ei];
      if (e.dead) continue;
      var r = e.isTower ? 26 : (e.isBuilding ? 20 : 13);
      ctx.fillStyle = e.side === 'player' ? '#2563eb' : '#dc2626';
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.font = (e.isTower ? 24 : 18) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(e.emoji, e.x, e.y);
      if (e.shield > 0) {
        ctx.strokeStyle = '#62ef88'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 4, 0, Math.PI * 2); ctx.stroke();
      }
      if (!e.isTower) {
        var w = e.isBuilding ? 40 : 30;
        ctx.fillStyle = '#222'; ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 5);
        ctx.fillStyle = '#62ef88'; ctx.fillRect(e.x - w / 2, e.y - r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    }
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
    globalThis.BashBoyale = { CARDS: CARDS, cardById: cardById, createBattle: createBattle, update: update, playCard: playCard, chestReward: chestReward, makeEntity: makeEntity, applyDamage: applyDamage, DEFAULT_DECK: DEFAULT_DECK, AI_DECK: AI_DECK };
  }

  // ---------- Browser UI ----------
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  function show(id) {
    ['screen-home', 'screen-deck', 'screen-chests', 'screen-battle'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
  }
  function getDeck() {
    var d = storeGet('bb_deck', null);
    if (!d || d.length !== 8) return DEFAULT_DECK.slice();
    return d;
  }
  function getChests() { return storeGet('bb_chests', []); }
  function getCrystals() { return storeGet('bb_crystals', 0); }
  function getCollection() { return storeGet('bb_cards', {}); }

  function refreshHome() {
    var chests = getChests();
    $('chest-count').textContent = chests.length ? '(' + chests.length + ')' : '';
    var col = getCollection(), total = 0;
    Object.keys(col).forEach(function (k) { total += col[k]; });
    $('collection-summary').textContent = 'Collection: ' + total + ' cards · 💎 ' + getCrystals() + ' Crystils';
  }
  function renderDeckScreen() {
    var deck = getDeck();
    $('deck-slots').innerHTML = deck.map(function (id) {
      var c = cardById(id);
      return '<div class="card in-deck"><div class="emoji">' + c.emoji + '</div><div class="name">' + c.name + '</div></div>';
    }).join('');
    $('deck-status').textContent = 'Deck: ' + deck.length + ' / 8' + (deck.length === 8 ? ' ✓ ready' : ' — tap cards below to add/remove');
    $('card-grid').innerHTML = CARDS.map(function (c) {
      var n = deck.filter(function (x) { return x === c.id; }).length;
      return '<div class="card' + (n ? ' in-deck' : '') + '" data-id="' + c.id + '"><div class="emoji">' + c.emoji + '</div><div class="name">' + c.name + '</div><div class="cost">💧' + c.elixir + ' · ' + c.type + '</div><div>' + (n ? 'in deck' : 'tap to add') + '</div></div>';
    }).join('');
    var grid = $('card-grid');
    grid.querySelectorAll('.card').forEach(function (el) {
      el.onclick = function () {
        var id = el.getAttribute('data-id'), d = getDeck();
        var ix = d.indexOf(id);
        if (ix >= 0) d.splice(ix, 1);
        else if (d.length < 8) d.push(id);
        else return;
        storeSet('bb_deck', d);
        renderDeckScreen();
      };
    });
  }
  function renderChestScreen() {
    $('crystal-count').textContent = getCrystals();
    var chests = getChests();
    $('chest-list').innerHTML = chests.length ? chests.map(function (t, i) {
      return '<div class="chest" data-i="' + i + '">📦<div>Tier ' + t + ' chest</div><div>tap to open</div></div>';
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
        $('chest-rewards').textContent = 'Opened a Tier ' + tier + ' chest! +' + rw.crs + ' 💎 Crystils and: ' +
          rw.cards.map(function (id) { return cardById(id).emoji + ' ' + cardById(id).name; }).join(', ');
        renderChestScreen();
      };
    });
  }

  var battle = null, selectedSlot = -1, raf = 0, lastT = 0;
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function renderHand() {
    if (!battle) return;
    $('hand').innerHTML = battle.hands.player.map(function (id, i) {
      var c = cardById(id);
      var afford = battle.elixir.player >= c.elixir;
      return '<div class="card' + (selectedSlot === i ? ' selected' : '') + (afford ? '' : ' cant-afford') + '" data-i="' + i + '"><div class="emoji">' + c.emoji + '</div><div class="name">' + c.name + '</div><div class="cost">💧' + c.elixir + '</div></div>';
    }).join('');
    $('hand').querySelectorAll('.card').forEach(function (el) {
      el.onclick = function () { selectedSlot = parseInt(el.getAttribute('data-i'), 10); renderHand(); };
    });
    var deck = battle.decks.player;
    var nextId = deck[battle.nextIdx.player % deck.length];
    $('next-card').textContent = cardById(nextId).emoji + ' ' + cardById(nextId).name;
    $('elixir-fill').style.width = (battle.elixir.player / ELIXIR_MAX * 100) + '%';
    $('elixir-text').textContent = Math.floor(battle.elixir.player) + ' / ' + ELIXIR_MAX;
    $('ai-tower-hp').style.width = Math.max(0, battle.towers.ai.hp / battle.towers.ai.maxHp * 100) + '%';
    $('player-tower-hp').style.width = Math.max(0, battle.towers.player.hp / battle.towers.player.maxHp * 100) + '%';
    $('timer').textContent = fmtTime(Math.max(0, battle.timeLeft));
  }
  function battleLoop(ts) {
    if (!battle) return;
    var dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    update(battle, dt);
    var ctx = $('arena').getContext('2d');
    drawBattle(ctx, battle);
    renderHand();
    if (battle.over) { endBattle(); return; }
    raf = requestAnimationFrame(battleLoop);
  }
  function endBattle() {
    cancelAnimationFrame(raf);
    var title = battle.result === 'win' ? '🏆 YOU WIN!' : (battle.result === 'lose' ? '💀 You lose' : '🤝 Draw');
    var sub = 'AI tower ' + Math.max(0, Math.round(battle.towers.ai.hp)) + ' HP · Your tower ' + Math.max(0, Math.round(battle.towers.player.hp)) + ' HP';
    if (battle.result === 'win') {
      var chests = getChests();
      if (chests.length < 4) { chests.push(rollChestTier()); storeSet('bb_chests', chests); sub += ' · 📦 You earned a chest!'; }
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
    if (!battle || battle.over || selectedSlot < 0) return;
    var rect = $('arena').getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width * W;
    var y = (ev.clientY - rect.top) / rect.height * H;
    var card = cardById(battle.hands.player[selectedSlot]);
    if (card.type !== 'spell' && y <= BRIDGE_Y + 6) { $('battle-msg').textContent = 'Troops and buildings go on YOUR half (below the river)!'; return; }
    if (playCard(battle, 'player', selectedSlot, x, y)) {
      $('battle-msg').textContent = card.emoji + ' ' + card.name + ' played!';
      selectedSlot = -1;
    } else {
      $('battle-msg').textContent = 'Not enough elixir for ' + card.name + '!';
    }
    renderHand();
  });

  show('screen-home');
  refreshHome();
})();
