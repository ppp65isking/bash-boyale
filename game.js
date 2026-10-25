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
  // PR 5: per-side projectile tint. Player side is blue, AI side is red
  // (matching the tower team colors). Change these two values to recolor
  // every projectile in the game — temporary colors, one-line future change.
  var SIDE_PROJECTILE_COLORS = { player: '#2563eb', ai: '#dc2626' };
  // Projectile kind per shooter id. Ranged shooters get their own kind;
  // melee-only units share 'melee' (a slash mark at the target, not a
  // traveling projectile — correct, not a gap). Spells keep their own
  // visuals and never go through this table.
  var PROJECTILE_KINDS = {
    mustard: 'mustard', ravirolli: 'ravirolli', eagle_eye: 'eagle_eye',
    lazah_beam: 'lazah_beam', radio_tower: 'radio_tower', wolverdog: 'wolverdog',
    pb_bounce: 'pb_bounce', no_skill: 'no_skill'
  };
  var PROJECTILE_WIDTHS = { mustard: 5, lazah_beam: 6, pb_bounce: 5, no_skill_pierce: 4, tower: 3 };
  function projectileKindFor(e, card) {
    if (e.isMini) return e.cardId === 'mini_eagle' ? 'mini_eagle' : 'melee';
    if (card && PROJECTILE_KINDS[card.id]) return PROJECTILE_KINDS[card.id];
    return 'melee';
  }
  function pushProjectile(s, x1, y1, x2, y2, side, kind, t, w) {
    s.tracers.push({ x1: x1, y1: y1, x2: x2, y2: y2, t: t || 0.12, kind: kind, side: side, w: w || PROJECTILE_WIDTHS[kind] || 2 });
  }
  // Tower levels (notes p.15): HP / DMG per level, hit speed 1.5s always.
  var TOWER_LEVELS = [
    { hp: 1800, dmg: 100 }, { hp: 1950, dmg: 125 }, { hp: 2100, dmg: 140 }, { hp: 2300, dmg: 180 },
    { hp: 2450, dmg: 220 }, { hp: 2500, dmg: 250 }, { hp: 2700, dmg: 300 }, { hp: 2950, dmg: 340 },
    { hp: 3200, dmg: 360 }, { hp: 3400, dmg: 375 }, { hp: 3500, dmg: 395 }, { hp: 3650, dmg: 410 },
    { hp: 3720, dmg: 420 }, { hp: 3900, dmg: 425 }, { hp: 4100, dmg: 430 }, { hp: 4400, dmg: 435 },
    { hp: 4550, dmg: 445 }, { hp: 4800, dmg: 450 }, { hp: 5250, dmg: 470 }, { hp: 5500, dmg: 485 },
    { hp: 5600, dmg: 500 }
  ];
  // Notes p.15: "MAIN Mortar DS +2000 HP every lvl" — read as: at every level
  // the king (main) tower gets +2000 HP over the table value. Side towers use
  // the table as-is. (The per-level reading, +2000 x level, would dwarf the
  // whole table and contradict it, so it is not used.)
  var KING_HP_BONUS = 2000;
  // Average card level required per tower level (notes p.17). L1 is free
  // ("needs one card at L1"); L2 = 1.25 is interpolated between L1 (1.0) and
  // L3 (1.5) — the notes' "L2 ... avg level to L2" line cannot mean avg 2.0,
  // which would exceed L3/L4/L5's requirements and break the ordering.
  var TOWER_AVG_REQ = [1, 1.25, 1.5, 1.75, 2, 2.3, 2.6, 2.9, 3.2, 3.5, 3.8, 4.3, 5, 5.5, 6.2, 6.8, 7.5, 8, 8.5, 9.8, 11];
  // Card stat scaling per level (notes give no per-level stat table, so this
  // is a documented flat curve): +4% HP and damage per level above 1.
  function lvlScale(lvl) { return Math.pow(1.04, (lvl || 1) - 1); }
  // Upgrade costs (notes p.14, exact): cards + Crystils per step.
  var UPGRADE_COSTS = [
    { cards: 15, crs: 1000 }, { cards: 25, crs: 1250 }, { cards: 50, crs: 1500 },
    { cards: 75, crs: 2000 }, { cards: 100, crs: 2500 }, { cards: 125, crs: 3000 },
    { cards: 140, crs: 3500 }, { cards: 160, crs: 4000 }, { cards: 180, crs: 4500 },
    { cards: 195, crs: 4750 }, { cards: 200, crs: 4900 }, { cards: 220, crs: 5100 },
    { cards: 240, crs: 5500 }, { cards: 260, crs: 6000 }, { cards: 275, crs: 6200 },
    { cards: 290, crs: 6500 }, { cards: 310, crs: 7000 }, { cards: 325, crs: 7500 },
    { cards: 330, crs: 8000 }, { cards: 350, crs: 8500 }
  ];
  var MAX_CARD_LEVEL = 21;
  // Rare pool for chest "Rare Cards" slots (no per-card rarity table exists in
  // the notes, so this is a documented rule): elixir cost 6 or more.
  function isRareCard(c) { return c.elixir >= 6; }
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
    { id: 'no_skill', name: 'No-skill', elixir: 11, type: 'building', hp: 9900, dmg: 45, hitSpeed: 0.9, range: 9, pierceEvery: 3, pierceBonus: 16, count: 1 },
    { id: 'the_tank', name: 'The Tank', elixir: 10, type: 'troop', hp: 8920, dmg: 200, hitSpeed: 1.8, range: 1, speed: 'slow', count: 1 }, // speed CHOSEN (notes: no speed)
    { id: 'dagger_dip', name: 'Dagger Dip', elixir: 4, type: 'spell', radius: 3, poison: 100, poisonTicks: 3 }, // radius CHOSEN (notes: no radius)
    { id: 'run_n_xplode', name: 'Run N Xplode', elixir: 2, type: 'troop', hp: 1600, dmg: 490, hitSpeed: 1, range: 1, speed: 'vfast', count: 2, suicide: true },
    { id: 'overclocker', name: 'Overclocker', elixir: 8, type: 'troop', hp: 4300, dmg: 380, hitSpeed: 1.6, range: 1, speed: 'fast', count: 1, auraRadius: 2.5, haste: 1.6, slowFactor: 1.2 }, // attack range CHOSEN (notes give aura radius only)
    { id: 'popkicker', name: 'Popkicker', elixir: 6, type: 'troop', hp: 3200, dmg: 500, hitSpeed: 1.6, range: 1, speed: 'slow', count: 1, kernelDmg: 170, kernelDelay: 0.6 }, // range CHOSEN ("kick range" = close)
    { id: 'efield', name: 'Efield', elixir: 6, type: 'spell', radius: 4, zoneTime: 6, zoneTick: 1.4, bandDmg: [500, 300, 150, 100] },
    { id: 'drone', name: 'Drone', elixir: 6, type: 'troop', hp: 3000, dmg: 450, hitSpeed: 1, range: 4, speed: 'norm', count: 1, towerDash: true, dashDelayMin: 0.8, dashDelayMax: 1.3 },
    { id: 'katana_kid', name: 'Katana Kid', elixir: 7, type: 'troop', hp: 4800, dmg: 400, hitSpeed: 1.7, range: 1, speed: 'norm', count: 1 } // speed CHOSEN (notes: no speed)
  ];
  var MINI_WAFFLE = { hp: 1000, dmg: 120, hitSpeed: 1.4, range: 1, speed: 'norm' };
  var MINI_EAGLE = { hp: 600, dmg: 60, hitSpeed: 1.0, range: 3, speed: 'fast' };

  function cardById(id) { for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i]; return null; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  var nextId = 1;
  function makeEntity(card, side, x, y, isMini, miniDef, parent, lvl, parentId) {
    var sc = lvlScale(lvl);
    var hp = isMini ? Math.round(miniDef.hp * sc) : (card ? Math.round(card.hp * sc) : TOWER.hp);
    var dmg = isMini ? Math.round(miniDef.dmg * sc) : (card ? (Array.isArray(card.dmg) ? card.dmg.map(function (d) { return Math.round(d * sc); }) : Math.round(card.dmg * sc)) : TOWER.dmg);
    return {
      id: nextId++, cardId: isMini ? ('mini_' + parent) : (card ? card.id : 'tower'),
      name: isMini ? (parent === 'waaflee' ? 'Mini Waffle' : 'Mini Eagle') : (card ? card.name : 'Tower'),
      side: side, x: x, y: y, hp: hp, maxHp: hp, shield: 0, popT: card ? (isMini ? 0.3 : 0.25) : 0,
      atkCd: 0, isBuilding: !!(card && card.type === 'building'), isTower: !card, isKing: false,
      isMini: !!isMini, miniDef: miniDef || null, parent: parent || null, parentId: parentId || null, lvl: lvl || 1,
      dead: false, effects: [], shotCount: 0, spawnT: 0, rollT: card && card.rollEvery ? card.rollEvery : 0,
      rollState: null, history: [], splitDone: false, rewindDone: false,
      shieldedAllies: {}, droneCd: 0, droneState: null,
      dmg: dmg,
      hitSpeed: isMini ? miniDef.hitSpeed : (card ? card.hitSpeed : TOWER.hitSpeed),
      range: isMini ? miniDef.range : (card ? card.range : TOWER.range),
      speed: isMini ? miniDef.speed : (card ? card.speed : null)
    };
  }

  function makeTower(side, x, y, isKing) {
    var t = makeEntity(null, side, x, y, false);
    var stats = TOWER_LEVELS[getTowerLevel() - 1];
    t.isKing = !!isKing;
    t.hp = t.maxHp = stats.hp + (isKing ? KING_HP_BONUS : 0);
    t.dmg = stats.dmg;
    t.hitSpeed = TOWER.hitSpeed;
    t.range = TOWER.range;
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
      hands: {}, decks: { player: playerDeck.slice(), ai: aiDeck.slice() }, kernels: [],
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
      // Tick starts at 1 so the zone deals exactly 2 ticks of 250 over 2s
      // (notes: "+250 dmg for 2 sec"), not a third tick on the removal frame.
      s.zones.push({ x: e.x, y: e.y, r: 1.5 * TILE, t: card.deathFireTime, tick: 1, dmg: Math.round(card.deathFire * lvlScale(e.lvl)), side: e.side, kind: 'fire' });
    }
    if (card && card.splitAt && !e.splitDone && !e.isMini) {
      e.splitDone = true;
      burst(s, e.x, e.y, '#e0a458', 14, 130, 4, 0.6);
      for (var i = 0; i < 2; i++) {
        var m = makeEntity(card, e.side, e.x + (i === 0 ? -18 : 18), e.y, true, MINI_WAFFLE, 'waaflee', e.lvl, e.id);
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
    // Player troops use owned card levels; the AI plays at level 1 (chosen:
    // the notes say nothing about AI levels, and progression should reward
    // the player, not mirror-match them).
    var lvl = side === 'player' ? getCardLevel(card.id) : 1;
    var ls = lvlScale(lvl);
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
            var dmg = f.isTower || f.isBuilding ? Math.round(card.towerDmg * ls) : Math.round(card.dmg * ls);
            applyDamage(s, f, dmg, side);
            if (!f.isTower && !f.isBuilding && !f.dead) addEffect(f, { kind: 'burn', dmg: Math.round(card.burn * ls), t: card.burnTime, tick: 1 });
          }
        }
        s.tracers.push({ x1: x - 20, y1: y - 20, x2: x + 20, y2: y + 20, t: 0.25, color: '#ff7b00' });
        burst(s, x, y, '#ff7b00', 12, 120, 4, 0.5);
        burst(s, x, y, '#ffd34f', 6, 80, 3, 0.4);
        cycleHand(s, side, slot);
        return true;
      }
      if (card.id === 'dagger_dip') {
        // Buffs friendly troops AND towers in radius (notes: "Allies +
        // Towers", not buildings). Each buffed unit's next attack poisons
        // (100 dmg x 3s); the buff is consumed on that attack.
        var friends = friendliesOf(s, side);
        var inRadius = [];
        for (var k = 0; k < friends.length; k++) {
          if (Math.hypot(friends[k].x - x, friends[k].y - y) <= card.radius * TILE) inRadius.push(friends[k]);
        }
        var tws = ownTowers(s, side);
        for (var tw = 0; tw < tws.length; tw++) {
          if (!tws[tw].dead && Math.hypot(tws[tw].x - x, tws[tw].y - y) <= card.radius * TILE) inRadius.push(tws[tw]);
        }
        if (!inRadius.length) { playFailReason = 'targets'; return false; }
        s.elixir[side] -= card.elixir;
        for (var m2 = 0; m2 < inRadius.length; m2++) {
          addEffect(inRadius[m2], { kind: 'dagger', dmg: Math.round(card.poison * ls), t: 9999, tick: 1 });
        }
        burst(s, x, y, '#a78bfa', 10, 70, 3, 0.6);
        cycleHand(s, side, slot);
        return true;
      }
      if (card.id === 'efield') {
        // Persistent damage zone: 6s, ticks every 1.4s, falloff by band.
        s.elixir[side] -= card.elixir;
        s.zones.push({ x: x, y: y, r: card.radius * TILE, t: card.zoneTime, tick: card.zoneTick, zoneTick: card.zoneTick, bandDmg: card.bandDmg.map(function (d) { return Math.round(d * ls); }), side: side, kind: 'efield' });
        burst(s, x, y, '#22d3ee', 12, 100, 3, 0.5);
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
      s.entities.push(makeEntity(card, side, x + ox, y + (m % 2) * 12, false, null, null, lvl));
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
      } else if (card.id === 'efield') {
        var foes2 = friendliesOf(s, 'player');
        var target2 = foes2.length ? nearest(foes2, W / 2, H - 200) : s.towers.player.king;
        playCard(s, 'ai', slot, target2.x, target2.y);
      } else {
        var friends = friendliesOf(s, 'ai');
        if (friends.length) { var f = friends[Math.floor(Math.random() * friends.length)]; playCard(s, 'ai', slot, f.x, f.y); }
      }
    } else {
      playCard(s, 'ai', slot, 60 + Math.random() * (W - 120), 100 + Math.random() * 160);
    }
  }

  // Overclocker aura: allies within 2.5 tiles attack 60% faster (interval
  // / 1.6), enemies within 2.5 tiles attack 20% slower (interval x 1.2).
  // Each effect applies at most once ("up to 60%" does not stack).
  function auraIntervalFactor(s, e) {
    var haste = false, slow = false;
    for (var i = 0; i < s.entities.length; i++) {
      var o = s.entities[i];
      if (o.dead || o.isTower || o === e) continue;
      var oc = cardById(o.cardId);
      if (!oc || !oc.auraRadius) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) > oc.auraRadius * TILE) continue;
      if (o.side === e.side) haste = true; else slow = true;
    }
    return (haste ? 1 / 1.6 : 1) * (slow ? 1.2 : 1);
  }
  // A mini eagle whose parent Eagle Eye is alive fires only when the parent
  // fires (notes: "shoots a spitball when you do"). Orphaned minis attack
  // on their own cycle.
  function syncedMiniParent(s, e) {
    if (!e.isMini || e.cardId !== 'mini_eagle' || !e.parentId) return null;
    for (var i = 0; i < s.entities.length; i++) {
      var o = s.entities[i];
      if (o.id === e.parentId && !o.dead && o.side === e.side) return o;
    }
    return null;
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

    // Popkicker kernels: delayed 170 dmg to the kicked target.
    for (var ki = s.kernels.length - 1; ki >= 0; ki--) {
      var kn = s.kernels[ki];
      kn.t -= dt;
      if (kn.t <= 0) {
        if (kn.target && !kn.target.dead) {
          applyDamage(s, kn.target, kn.dmg, kn.side);
          burst(s, kn.target.x, kn.target.y, '#fbbf24', 8, 80, 3, 0.4);
        }
        s.kernels.splice(ki, 1);
      }
    }
    // Zones (Lazah-Beam fire, Efield)
    for (var zi = s.zones.length - 1; zi >= 0; zi--) {
      var z = s.zones[zi];
      z.t -= dt; z.tick = (z.tick || 0) - dt;
      if (z.tick <= 0) {
        z.tick = z.kind === 'efield' ? z.zoneTick : 1;
        var foes = enemiesOf(s, z.side);
        for (var f = 0; f < foes.length; f++) {
          var dd = Math.hypot(foes[f].x - z.x, foes[f].y - z.y);
          if (dd <= z.r) {
            if (z.kind === 'efield') {
              var band = dd <= TILE ? 0 : (dd <= 2 * TILE ? 1 : (dd <= 3 * TILE ? 2 : 3));
              applyDamage(s, foes[f], z.bandDmg[band], z.side);
            } else {
              applyDamage(s, foes[f], z.dmg, z.side);
            }
          }
        }
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
        for (var w = 0; w < 2; w++) s.entities.push(makeEntity(card, e.side, e.x + (w === 0 ? -18 : 18), e.y, true, MINI_WAFFLE, 'waaflee', e.lvl, e.id));
      }
      // Eagle Eye spawns a mini eagle every 3s
      if (card && card.spawnEvery && !e.isMini) {
        e.spawnT += dt;
        if (e.spawnT >= card.spawnEvery) {
          e.spawnT = 0;
          var minis = 0;
          for (var mi = 0; mi < s.entities.length; mi++) if (s.entities[mi].parent === 'eagle' && s.entities[mi].side === e.side && !s.entities[mi].dead) minis++;
          if (minis < 5) { s.entities.push(makeEntity(card, e.side, e.x + 14, e.y, true, MINI_EAGLE, 'eagle', e.lvl, e.id)); burst(s, e.x + 14, e.y, '#f5f5f4', 6, 60, 3, 0.5); }
        }
      }
      // Guard shield aura
      if (card && card.shieldAura) {
        var allies = friendliesOf(s, e.side);
        for (var ai = 0; ai < allies.length; ai++) {
          var a = allies[ai];
          if (a !== e && !e.shieldedAllies[a.id] && Math.hypot(a.x - e.x, a.y - e.y) <= card.shieldRadius * TILE) {
            e.shieldedAllies[a.id] = true;
            a.shield += Math.round(card.shieldAura * lvlScale(e.lvl));
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
              pushProjectile(s, e.x, e.y, foes[pi].x, foes[pi].y, e.side, 'windblower', 0.25);
            }
          }
        }
        continue;
      }
      // Drone: tower-focused dasher. Marches to the nearest living enemy
      // tower; when one is within 4 tiles, dashes in, hits for 450, dashes
      // back, then waits 0.8-1.3s. It never engages troops.
      if (card && card.towerDash) {
        if (e.droneState) {
          var ds = e.droneState;
          var tx = ds.phase === 'out' ? ds.tower.x : ds.ox, ty = ds.phase === 'out' ? ds.tower.y : ds.oy;
          var ddx = tx - e.x, ddy = ty - e.y, dd = Math.hypot(ddx, ddy);
          var dashSp = 420;
          if (dd <= dashSp * dt) {
            e.x = tx; e.y = ty;
            if (ds.phase === 'out') {
              pushProjectile(s, ds.ox, ds.oy, ds.tower.x, ds.tower.y, e.side, 'drone', 0.15);
              applyDamage(s, ds.tower, Math.round(card.dmg * lvlScale(e.lvl)), e.side);
              burst(s, e.x, e.y, '#facc15', 10, 100, 3, 0.4);
              ds.phase = 'back';
            } else {
              e.droneState = null;
              e.droneCd = card.dashDelayMin + Math.random() * (card.dashDelayMax - card.dashDelayMin);
            }
          } else {
            e.x += ddx / dd * dashSp * dt; e.y += ddy / dd * dashSp * dt;
            if (Math.random() < dt * 30) s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.25, color: '#facc15', size: 2 });
          }
        } else {
          if (e.droneCd > 0) e.droneCd -= dt;
          var tw = nearest(enemyTowers(s, e.side).filter(function (t) { return !t.dead; }), e.x, e.y);
          if (tw && !rooted) {
            if (e.droneCd <= 0 && Math.hypot(tw.x - e.x, tw.y - e.y) <= card.range * TILE) {
              e.droneState = { phase: 'out', tower: tw, ox: e.x, oy: e.y };
            } else if (e.droneCd <= 0) {
              // Out of dash range: march toward the tower. During the
              // post-dash cooldown the drone holds position (the wait).
              var mdx = tw.x - e.x, mdy = tw.y - e.y, md = Math.hypot(mdx, mdy);
              if (md > 0) { var sp = SPEEDS[e.speed] || 65; e.x += mdx / md * sp * dt; e.y += mdy / md * sp * dt; }
            }
          }
        }
        e.x = clamp(e.x, 20, W - 20); e.y = clamp(e.y, 30, H - 30);
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
              applyDamage(s, rf, Math.round(card.rollDmg * lvlScale(e.lvl)), e.side);
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
      if (tgt && e.dmg && (typeof e.dmg === 'number' || Array.isArray(e.dmg)) && e.atkCd <= 0 && !syncedMiniParent(s, e)) {
        e.atkCd = e.hitSpeed * auraIntervalFactor(s, e);
        attack(s, e, tgt, card);
      } else if (!e.isBuilding && !rooted) {
        // March to the nearest LIVING enemy tower (dead towers used to be
        // valid destinations, stranding troops on corpses).
        var dest = nearest(enemyTowers(s, e.side).filter(function (t) { return !t.dead; }), e.x, e.y);
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
        t.atkCd = t.hitSpeed;
        var tg = nearest(inR, t.x, t.y);
        pushProjectile(s, t.x, t.y, tg.x, tg.y, t.side, 'tower', 0.15);
        applyDamage(s, tg, t.dmg, t.side);
        // Dagger Dip: a buffed tower's shot poisons, then consumes the buff.
        var daggerIdx = -1;
        for (var di = 0; di < t.effects.length; di++) if (t.effects[di].kind === 'dagger') { daggerIdx = di; break; }
        if (daggerIdx >= 0) {
          if (!tg.isTower && !tg.isBuilding && !tg.dead) addEffect(tg, { kind: 'poison', dmg: t.effects[daggerIdx].dmg, t: 3, tick: 1 });
          t.effects.splice(daggerIdx, 1);
        }
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
      pushProjectile(s, e.x, e.y, tgt.x, tgt.y, e.side, 'pb_bounce', 0.2);
      applyDamage(s, tgt, e.dmg[0], e.side);
      s.particles.push({ x: tgt.x, y: tgt.y, vx: 0, vy: -20, t: 0, life: 0.4, color: '#c98a4b', size: 7 });
      while (dmgIdx < 2) {
        dmgIdx++;
        // Notes exclude no target type from bounces, so towers can be hit.
        var foes = enemiesOf(s, e.side).filter(function (f) { return hit.indexOf(f) < 0; });
        var nxt = null, bd = card.bounceRange * TILE;
        for (var i = 0; i < foes.length; i++) {
          var d = Math.hypot(foes[i].x - cur.x, foes[i].y - cur.y);
          if (d <= bd) { bd = d; nxt = foes[i]; }
        }
        if (!nxt) break;
        pushProjectile(s, cur.x, cur.y, nxt.x, nxt.y, e.side, 'pb_bounce', 0.2);
        s.particles.push({ x: nxt.x, y: nxt.y, vx: 0, vy: -20, t: 0, life: 0.4, color: '#c98a4b', size: dmgIdx === 1 ? 5 : 3 });
        applyDamage(s, nxt, e.dmg[dmgIdx], e.side);
        hit.push(nxt); cur = nxt;
      }
      return;
    }
    if (card && card.id === 'no_skill') {
      e.shotCount++;
      var isPierce = e.shotCount % card.pierceEvery === 0;
      if (isPierce) {
        var pdx = tgt.x - e.x, pdy = tgt.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
        pushProjectile(s, e.x, e.y, tgt.x + pdx / pd * 70, tgt.y + pdy / pd * 70, e.side, 'no_skill_pierce', 0.2);
      } else {
        pushProjectile(s, e.x, e.y, tgt.x, tgt.y, e.side, 'no_skill', 0.15);
      }
      var pierceDmg = e.dmg + (isPierce ? Math.round(card.pierceBonus * lvlScale(e.lvl)) : 0);
      applyDamage(s, tgt, pierceDmg, e.side);
      if (isPierce) {
        var foes = enemiesOf(s, e.side);
        for (var j = 0; j < foes.length; j++) {
          var f = foes[j];
          if (f !== tgt && !f.isTower && Math.abs(f.x - tgt.x) < 20 && ((f.y - e.y) * (tgt.y - e.y) > 0)) applyDamage(s, f, pierceDmg, e.side);
        }
      }
      return;
    }
    var dmg = typeof e.dmg === 'number' ? e.dmg : 0;
    if (card && card.id === 'eagle_eye') {
      // Mini eagles fire a spitball when Eagle Eye does (notes).
      for (var ei2 = 0; ei2 < s.entities.length; ei2++) {
        var mn = s.entities[ei2];
        if (mn.dead || mn.side !== e.side || mn.cardId !== 'mini_eagle' || mn.parentId !== e.id) continue;
        if (Math.hypot(tgt.x - mn.x, tgt.y - mn.y) <= (mn.range || 3) * TILE) {
          pushProjectile(s, mn.x, mn.y, tgt.x, tgt.y, e.side, 'mini_eagle', 0.12);
          applyDamage(s, tgt, mn.dmg, e.side);
        }
      }
    }
    if (card && card.id === 'popkicker') {
      // A kernel explodes for 170 dmg 0.6s after every kick.
      s.kernels.push({ target: tgt, t: card.kernelDelay, dmg: Math.round(card.kernelDmg * lvlScale(e.lvl)), side: e.side });
    }
    if (card && card.id === 'mustard') {
      var mdx = tgt.x - e.x, mdy = tgt.y - e.y, md = Math.hypot(mdx, mdy) || 1;
      for (var sq = 0; sq < 6; sq++) s.particles.push({ x: e.x + mdx / md * (8 + sq * 4), y: e.y + mdy / md * (8 + sq * 4), vx: mdx / md * 60, vy: mdy / md * 60, t: 0, life: 0.3, color: '#f7c948', size: 3 });
    }
    (function () {
      var pk = projectileKindFor(e, card);
      if (pk === 'melee') {
        // Melee swing: a slash mark at the target, no traveling line.
        s.tracers.push({ x1: tgt.x, y1: tgt.y, x2: tgt.x, y2: tgt.y, t: 0.12, kind: 'melee', side: e.side, w: 3 });
      } else {
        pushProjectile(s, e.x, e.y, tgt.x, tgt.y, e.side, pk, 0.12);
      }
    })();
    applyDamage(s, tgt, dmg, e.side);
    if (card && card.poison && !tgt.isTower && !tgt.isBuilding && !tgt.dead) {
      addEffect(tgt, { kind: 'poison', dmg: Math.round(card.poison * lvlScale(e.lvl)), t: card.poisonTicks, tick: 1 });
    }
    if (card && card.burn && !tgt.isTower && !tgt.isBuilding && !tgt.dead) {
      addEffect(tgt, { kind: 'burn', dmg: Math.round(card.burn * lvlScale(e.lvl)), t: card.burnTime, tick: 1 });
    }
    // Dagger Dip: the buffed unit's next attack poisons, then consumes the buff.
    var daggerIdx = -1;
    for (var di = 0; di < e.effects.length; di++) if (e.effects[di].kind === 'dagger') { daggerIdx = di; break; }
    if (daggerIdx >= 0) {
      if (!tgt.isTower && !tgt.isBuilding && !tgt.dead) {
        addEffect(tgt, { kind: 'poison', dmg: e.effects[daggerIdx].dmg, t: 3, tick: 1 });
      }
      e.effects.splice(daggerIdx, 1);
    }
    // Run N Xplode: suicide runners explode on their first hit.
    if (card && card.suicide && !e.dead) {
      burst(s, e.x, e.y, '#f97316', 14, 140, 4, 0.5);
      killEntity(s, e);
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
    } else if (id === 'the_tank') {
      rr(ctx, -14, -12, 28, 24, 4, '#5b6472');
      rr(ctx, -10, 12, 20, 8, 2, '#3f4756');
      circ(ctx, -8, 18, 4, '#222'); circ(ctx, 8, 18, 4, '#222');
      rr(ctx, -6, -18, 12, 8, 2, '#7c8698');
      line(ctx, 0, -18, 0, -26, '#3f4756', 4);
      eyes(ctx, 0, -4, 4);
    } else if (id === 'dagger_dip') {
      // Dagger dipping into a pot (spell icon).
      rr(ctx, -9, 2, 18, 14, 4, '#6d28d9');
      line(ctx, -6, -14, 6, 2, '#e5e7eb', 3);
      poly(ctx, [[6, 2], [10, -2], [6, -6]], '#e5e7eb');
      circ(ctx, 0, -4, 3, '#a78bfa');
    } else if (id === 'run_n_xplode') {
      rr(ctx, -10, -10, 20, 22, 3, '#dc2626');
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TNT', 0, 1);
      line(ctx, 0, -10, 4, -16, '#7a5b00', 2);
      circ(ctx, 5, -17, 2.5, '#f97316');
      line(ctx, -10, 2, -15, 8, '#7a1f1f', 2); line(ctx, 10, 2, 15, -4, '#7a1f1f', 2);
    } else if (id === 'overclocker') {
      circ(ctx, 0, 0, r + 2, '#f8fafc');
      ctx.strokeStyle = '#ffd34f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.stroke();
      line(ctx, 0, 0, 0, -r * 0.7, '#111827', 2); line(ctx, 0, 0, r * 0.5, 2, '#111827', 2);
      circ(ctx, 0, 0, 2, '#111827');
      // Faint ring showing the 2.5-tile aura radius.
      ctx.strokeStyle = 'rgba(255,211,79,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 2.5 * TILE, 0, Math.PI * 2); ctx.stroke();
    } else if (id === 'popkicker') {
      poly(ctx, [[-10, -12], [10, -12], [7, 12], [-7, 12]], '#ef4444');
      circ(ctx, -4, -14, 4, '#fef3c7'); circ(ctx, 4, -15, 4, '#fef3c7'); circ(ctx, 0, -12, 4, '#fef3c7');
      line(ctx, 10, 0, 16, -6, '#7a1f1f', 2);
      eyes(ctx, 0, 0, 3);
    } else if (id === 'efield') {
      circ(ctx, 0, 0, r, '#164e63');
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      line(ctx, -6, 0, 6, 0, '#22d3ee', 2); line(ctx, 0, -6, 0, 6, '#22d3ee', 2);
    } else if (id === 'drone') {
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      circ(ctx, 0, 0, r * 0.45, '#22d3ee');
      line(ctx, -r - 4, -r * 0.5, -r + 4, -r * 0.5, '#475569', 2);
      line(ctx, r - 4, -r * 0.5, r + 4, -r * 0.5, '#475569', 2);
      eyes(ctx, 0, -1, 3);
    } else if (id === 'katana_kid') {
      circ(ctx, 0, -8, 7, '#f2c79b');
      rr(ctx, -7, 0, 14, 16, 4, '#2563eb');
      line(ctx, 8, -12, 16, -2, '#e5e7eb', 2.5);
      line(ctx, -8, -12, -16, -2, '#e5e7eb', 2.5);
      eyes(ctx, 0, -8, 3);
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
    var hasDagger = e.effects.some(function (x) { return x.kind === 'dagger'; });
    if (hasDagger) {
      poly(ctx, [[e.x, e.y - r - 16], [e.x + 4, e.y - r - 8], [e.x, e.y - r - 10], [e.x - 4, e.y - r - 8]], '#a78bfa');
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
      if (z.kind === 'efield') {
        ctx.fillStyle = 'rgba(34,211,238,0.18)';
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(34,211,238,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
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
    // PR 5: projectile tracers draw per-shooter shapes, always tinted by side
    // via SIDE_PROJECTILE_COLORS. Kind-less tracers (spell effects) keep
    // their original color.
    var tline = function (x1, y1, x2, y2, w) {
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    for (var ti = 0; ti < s.tracers.length; ti++) {
      var tr = s.tracers[ti];
      if (!tr.kind) {
        ctx.strokeStyle = tr.color; ctx.lineWidth = tr.w || 2;
        ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
        continue;
      }
      var col = SIDE_PROJECTILE_COLORS[tr.side] || tr.color || '#ffffff';
      ctx.strokeStyle = col; ctx.fillStyle = col;
      var tdx = tr.x2 - tr.x1, tdy = tr.y2 - tr.y1, tdl = Math.hypot(tdx, tdy) || 1;
      var tux = tdx / tdl, tuy = tdy / tdl;
      if (tr.kind === 'melee') {
        ctx.lineWidth = tr.w || 3;
        ctx.beginPath(); ctx.arc(tr.x2, tr.y2, 10, -0.7, 0.8); ctx.stroke();
      } else if (tr.kind === 'lazah_beam') {
        ctx.globalAlpha = 0.3; tline(tr.x1, tr.y1, tr.x2, tr.y2, (tr.w || 6) + 6); ctx.globalAlpha = 1;
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 6);
      } else if (tr.kind === 'tower') {
        ctx.globalAlpha = 0.3; tline(tr.x1, tr.y1, tr.x2, tr.y2, (tr.w || 3) + 4); ctx.globalAlpha = 1;
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 3);
      } else if (tr.kind === 'radio_tower' || tr.kind === 'windblower') {
        try { ctx.setLineDash(tr.kind === 'radio_tower' ? [6, 4] : [3, 5]); } catch (err) {}
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 2);
        try { ctx.setLineDash([]); } catch (err) {}
      } else if (tr.kind === 'mustard') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 5);
        for (var bi = 1; bi <= 3; bi++) {
          ctx.beginPath(); ctx.arc(tr.x1 + tdx * bi / 3, tr.y1 + tdy * bi / 3, 3, 0, Math.PI * 2); ctx.fill();
        }
      } else if (tr.kind === 'pb_bounce') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 5);
        ctx.beginPath(); ctx.arc(tr.x2, tr.y2, 5, 0, Math.PI * 2); ctx.fill();
      } else if (tr.kind === 'eagle_eye') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 3);
        ctx.beginPath();
        ctx.moveTo(tr.x2, tr.y2);
        ctx.lineTo(tr.x2 - tux * 10 - tuy * 5, tr.y2 - tuy * 10 + tux * 5);
        ctx.lineTo(tr.x2 - tux * 10 + tuy * 5, tr.y2 - tuy * 10 - tux * 5);
        ctx.closePath(); ctx.fill();
      } else if (tr.kind === 'drone') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 3);
        ctx.save(); ctx.translate(tr.x2, tr.y2); ctx.rotate(Math.atan2(tdy, tdx));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -5); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (tr.kind === 'mini_eagle') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 2);
        ctx.beginPath(); ctx.arc(tr.x2, tr.y2, 2, 0, Math.PI * 2); ctx.fill();
      } else if (tr.kind === 'ravirolli') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 4);
        ctx.fillRect(tr.x2 - 3, tr.y2 - 3, 6, 6);
      } else if (tr.kind === 'wolverdog') {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 3);
        ctx.beginPath();
        ctx.moveTo(tr.x2 - tux * 8 - tuy * 4, tr.y2 - tuy * 8 + tux * 4);
        ctx.lineTo(tr.x2 - tux * 3, tr.y2 - tuy * 3);
        ctx.moveTo(tr.x2 - tux * 8 + tuy * 4, tr.y2 - tuy * 8 - tux * 4);
        ctx.lineTo(tr.x2 - tux * 3, tr.y2 - tuy * 3);
        ctx.stroke();
      } else {
        tline(tr.x1, tr.y1, tr.x2, tr.y2, tr.w || 2);
      }
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
  var memStore = {};
  function storeGet(k, fallback) {
    try {
      if (typeof localStorage !== 'undefined') {
        var v = localStorage.getItem(k);
        return v === null ? fallback : JSON.parse(v);
      }
    } catch (err) {}
    return (k in memStore) ? memStore[k] : fallback;
  }
  function storeSet(k, v) {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.setItem(k, JSON.stringify(v)); return; }
    } catch (err) {}
    memStore[k] = v;
  }
  var DEFAULT_DECK = ['mustard', 'plant_spirit', 'guard', 'firelight_ball', 'ravirolli', 'eagle_eye', 'radio_tower', 'lazah_beam'];
  var AI_DECK = ['mustard', 'plant_spirit', 'firelight_ball', 'run_n_xplode', 'drone', 'radio_tower', 'katana_kid', 'wolverdog'];

  // ----- Levels -----
  function getCardLevels() { var lv = storeGet('bb_levels', {}); return (lv && typeof lv === 'object') ? lv : {}; }
  function getCardLevel(id) { var lv = getCardLevels(); return lv[id] || 1; }
  function avgCardLevel() {
    var sum = 0;
    for (var i = 0; i < CARDS.length; i++) sum += getCardLevel(CARDS[i].id);
    return CARDS.length ? sum / CARDS.length : 1;
  }
  function towerLevelComputed() {
    var avg = avgCardLevel(), lvl = 1;
    for (var i = 0; i < TOWER_AVG_REQ.length; i++) if (avg >= TOWER_AVG_REQ[i]) lvl = i + 1;
    return lvl;
  }
  // Tower level never drops once reached (notes: a new card lowers the
  // average but you don't lose the level; only balance changes can drop it).
  function getTowerLevel() {
    var stored = storeGet('bb_tower_level', 1) || 1;
    var computed = towerLevelComputed();
    var lvl = Math.max(stored, computed);
    if (lvl !== stored) storeSet('bb_tower_level', lvl);
    return lvl;
  }
  function wildCap() { return Math.round(15 + (getTowerLevel() - 1) * (105 / 20)); } // 15 at L1 -> 120 at L21
  function getWilds() { return storeGet('bb_wilds', 0) || 0; }
  // Upgrade a card one level. Copies come from the collection first, then
  // wild cards cover any shortfall (1 wild = 1 copy). Returns a result obj.
  function upgradeCard(id) {
    var lvl = getCardLevel(id);
    if (lvl >= MAX_CARD_LEVEL) return { ok: false, reason: 'max' };
    var cost = UPGRADE_COSTS[lvl - 1];
    var col = getCollection(), have = col[id] || 0, wilds = getWilds(), crs = getCrystals();
    var short = Math.max(0, cost.cards - have);
    if (short > wilds) return { ok: false, reason: 'cards', need: cost.cards, have: have, wilds: wilds };
    if (crs < cost.crs) return { ok: false, reason: 'crs', need: cost.crs, have: crs };
    var usedCopies = Math.min(have, cost.cards);
    col[id] = have - usedCopies;
    storeSet('bb_cards', col);
    if (short > 0) storeSet('bb_wilds', wilds - short);
    storeSet('bb_crystals', crs - cost.crs);
    var levels = getCardLevels(); levels[id] = lvl + 1; storeSet('bb_levels', levels);
    getTowerLevel(); // recompute peak (may rise)
    return { ok: true, level: lvl + 1, usedCopies: usedCopies, usedWilds: short };
  }

  // ----- Chests (notes p.14 tiers + p.19 upgrade game) -----
  // Reward split per tier = Crystils% / Cards% / Rare%. Wilds from high-tier
  // chests are chosen (notes give no chest wild rate).
  var CHEST_TIERS = {
    1: { slots: 3, baseCrs: 50, crsPct: 34, cardsPct: 33, rarePct: 33, wilds: 0 },
    2: { slots: 4, baseCrs: 100, crsPct: 30, cardsPct: 30, rarePct: 40, wilds: 0 },
    3: { slots: 5, baseCrs: 200, crsPct: 20, cardsPct: 30, rarePct: 50, wilds: 1 },
    4: { slots: 8, baseCrs: 400, crsPct: 10, cardsPct: 30, rarePct: 60, wilds: 3 }
  };
  // Upgrade-game chances: the starting chest is always tier 1 (p.19
  // "Starting chest 1"); each of the 4 taps rolls the NEXT tier's listed
  // chance (T1->T2 50%, T2->T3 20%, T3->T4 11%).
  var CHEST_UPGRADE_CHANCE = { 1: 0.50, 2: 0.20, 3: 0.11 };
  function randomCardId(rareOnly) {
    var pool = rareOnly ? CARDS.filter(isRareCard) : CARDS;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }
  // Grant one card with the overflow rule: a card already at MAX level
  // converts to 100 Crystils (notes: "overflow cards are worth 100 crs or 1
  // random card" — Crystils chosen for simplicity).
  function grantCard(col, id) {
    if (getCardLevel(id) >= MAX_CARD_LEVEL) return { type: 'crs', amount: 100 };
    col[id] = (col[id] || 0) + 1;
    return { type: 'card', id: id };
  }
  function chestReward(tier) {
    var t = CHEST_TIERS[tier] || CHEST_TIERS[1];
    var col = getCollection();
    var out = { cards: [], rares: [], crs: t.baseCrs, wilds: 0, overflowCrs: 0 };
    for (var i = 0; i < t.slots; i++) {
      var r = Math.random() * 100;
      if (r < t.crsPct) { out.crs += 50; continue; }
      var g;
      if (r < t.crsPct + t.rarePct) {
        g = grantCard(col, randomCardId(true));
        if (g.type === 'card') out.rares.push(g.id); else out.overflowCrs += g.amount;
      } else {
        g = grantCard(col, randomCardId(false));
        if (g.type === 'card') out.cards.push(g.id); else out.overflowCrs += g.amount;
      }
    }
    // Wild cards from high-tier chests, capped (excess wilds -> 100 crs each).
    var cap = wildCap(), have = getWilds();
    var wilds = Math.min(t.wilds, Math.max(0, cap - have));
    out.wilds = wilds;
    out.overflowCrs += (t.wilds - wilds) * 100;
    storeSet('bb_cards', col);
    storeSet('bb_crystals', getCrystals() + out.crs + out.overflowCrs);
    storeSet('bb_wilds', have + wilds);
    return out;
  }
  function chestRewardText(rw, tier) {
    var parts = [];
    if (rw.cards.length) parts.push(rw.cards.map(function (id) { return cardById(id).name; }).join(', '));
    if (rw.rares.length) parts.push('RARE: ' + rw.rares.map(function (id) { return cardById(id).name; }).join(', '));
    var s = 'Opened a Tier ' + tier + ' chest! +' + rw.crs + ' Crystils';
    if (rw.overflowCrs) s += ' (+' + rw.overflowCrs + ' overflow)';
    if (rw.wilds) s += ', +' + rw.wilds + ' wild cards';
    if (parts.length) s += ' and: ' + parts.join('; ');
    return s;
  }

  // ----- Daily wins / streaks (notes p.21) -----
  // Reward tokens: "chest (N)" = N cards; "chest (A, B)" = A groups of B
  // cards; "chest (Rare, N)" = N rare-pool cards; "diamond N" = N Crystils.
  // Each step below is a list of tokens (the 14+ day-4 step has two).
  var DAILY_SEQUENCES = {
    reg: [[['cards', 2]], [['chests', 2, 3]], [['crs', 300]], [['cards', 3]]],
    s3: [[['cards', 3]], [['chests', 2, 5]], [['crs', 500]], [['cards', 3]]],
    s8: [[['cards', 3]], [['cards', 4]], [['cards', 3]], [['crs', 650]]],
    s14: [[['cards', 4]], [['cards', 4]], [['crs', 750]], [['chests', 2, 10], ['rare', 3]]],
    lucky: [[['cards', 5]], [['chests', 2, 15]], [['crs', 800]], [['rare', 5]]]
  };
  function dailyBracket(streak, luckyRoll) {
    if (luckyRoll) return 'lucky';
    if (streak >= 14) return 's14';
    if (streak >= 8) return 's8';
    if (streak >= 3) return 's3';
    return 'reg';
  }
  function describeDailyStep(step) {
    return step.map(function (tok) {
      if (tok[0] === 'crs') return tok[1] + ' Crystils';
      if (tok[0] === 'cards') return tok[1] + ' cards';
      if (tok[0] === 'chests') return tok[1] + ' chests of ' + tok[2] + ' cards';
      if (tok[0] === 'rare') return tok[1] + ' rare cards';
      return '';
    }).join(' + ');
  }
  function getDaily() { return storeGet('bb_daily', { lastDay: '', streak: 0, step: 0, claimedDay: '' }); }
  // Grant one daily step. Takes the stored daily state + date strings so
  // tests can drive it with fake dates.
  function grantDailyStep(daily, todayStr, yesterdayStr) {
    var streak = (daily.lastDay === yesterdayStr) ? (daily.streak || 0) + 1 : 1;
    var lucky = Math.random() < 0.10; // "Lucky!" trigger is not specified in the notes; 10% chosen
    var bracket = dailyBracket(streak, lucky);
    var seq = DAILY_SEQUENCES[bracket];
    var stepIdx = daily.step || 0;
    var step = seq[stepIdx % seq.length];
    var col = getCollection(), crs = 0, names = [];
    step.forEach(function (tok) {
      if (tok[0] === 'crs') { crs += tok[1]; return; }
      var n = tok[0] === 'cards' ? tok[1] : (tok[0] === 'rare' ? tok[1] : tok[1] * tok[2]);
      var rareOnly = (tok[0] === 'rare');
      for (var i = 0; i < n; i++) {
        var g = grantCard(col, randomCardId(rareOnly));
        if (g.type === 'card') names.push(cardById(g.id).name); else crs += g.amount;
      }
    });
    storeSet('bb_cards', col);
    storeSet('bb_crystals', getCrystals() + crs);
    var next = { lastDay: todayStr, streak: streak, step: (stepIdx + 1) % seq.length, claimedDay: todayStr };
    storeSet('bb_daily', next);
    var label = bracket === 'lucky' ? 'Lucky! ' : '';
    return { text: label + 'Daily reward (streak ' + streak + '): ' + describeDailyStep(step) + (names.length ? ' - ' + names.join(', ') : '') + (crs ? ' (+' + crs + ' Crystils)' : ''), state: next };
  }

  // Expose core for headless smoke tests (node).
  if (typeof globalThis !== 'undefined') {
    globalThis.BashBoyale = { CARDS: CARDS, cardById: cardById, createBattle: createBattle, update: update, playCard: playCard, chestReward: chestReward, makeEntity: makeEntity, applyDamage: applyDamage, drawBattle: drawBattle, DEFAULT_DECK: DEFAULT_DECK, AI_DECK: AI_DECK, getPlayFailReason: function () { return playFailReason; },
      SIDE_PROJECTILE_COLORS: SIDE_PROJECTILE_COLORS, PROJECTILE_KINDS: PROJECTILE_KINDS, MINI_WAFFLE: MINI_WAFFLE, MINI_EAGLE: MINI_EAGLE,
      UPGRADE_COSTS: UPGRADE_COSTS, TOWER_LEVELS: TOWER_LEVELS, TOWER_AVG_REQ: TOWER_AVG_REQ, MAX_CARD_LEVEL: MAX_CARD_LEVEL, lvlScale: lvlScale, getCardLevel: getCardLevel, getCardLevels: getCardLevels, avgCardLevel: avgCardLevel, towerLevelComputed: towerLevelComputed, getTowerLevel: getTowerLevel, wildCap: wildCap, getWilds: getWilds, upgradeCard: upgradeCard, grantCard: grantCard, CHEST_TIERS: CHEST_TIERS, CHEST_UPGRADE_CHANCE: CHEST_UPGRADE_CHANCE, chestRewardText: chestRewardText, DAILY_SEQUENCES: DAILY_SEQUENCES, dailyBracket: dailyBracket, describeDailyStep: describeDailyStep, grantDailyStep: grantDailyStep, getDaily: getDaily, getCollection: getCollection, getCrystals: getCrystals, getChests: getChests, storeGet: storeGet, storeSet: storeSet, isRareCard: isRareCard, auraIntervalFactor: auraIntervalFactor, syncedMiniParent: syncedMiniParent };
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
  function getChests() {
    var raw = storeGet('bb_chests', []);
    if (!Array.isArray(raw)) return [];
    return raw.map(function (c) {
      if (typeof c === 'number') return { tier: c, taps: 0 }; // pre-PR4 chest: open directly
      return { tier: c.tier || 1, taps: (c.taps === undefined ? 4 : c.taps) };
    });
  }
  function getCrystals() { return storeGet('bb_crystals', 0); }
  function getCollection() { return storeGet('bb_cards', {}); }

  function refreshHome() {
    var chests = getChests();
    $('chest-count').textContent = chests.length ? '(' + chests.length + ')' : '';
    var col = getCollection(), total = 0;
    Object.keys(col).forEach(function (k) { total += col[k]; });
    $('collection-summary').textContent = 'Collection: ' + total + ' cards · ' + getCrystals() + ' Crystils · ' + getWilds() + ' wild cards';
    $('tower-summary').textContent = 'Tower Lv ' + getTowerLevel() + ' (card avg ' + avgCardLevel().toFixed(1) + ') · Wild cap ' + wildCap();
    var d = getDaily(), today = new Date().toDateString();
    var bracket = dailyBracket(d.streak || 0, false);
    var next = DAILY_SEQUENCES[bracket][(d.step || 0) % 4];
    $('daily-info').textContent = 'Streak: ' + (d.streak || 0) + ' days · Next reward: ' + describeDailyStep(next) + (d.claimedDay === today ? ' · Claimed today!' : ' · Win a battle today to claim!');
  }
  function renderDeckScreen() {
    var deck = getDeck();
    $('deck-slots').innerHTML = deck.map(function (id) {
      var c = cardById(id);
      return '<div class="card in-deck"><canvas class="icon" width="40" height="40" data-icon="' + id + '"></canvas><div class="name">' + c.name + '</div></div>';
    }).join('');
    drawIcons($('deck-slots'));
    $('deck-status').textContent = 'Deck: ' + deck.length + ' / 8' + (deck.length === 8 ? ' — ready' : ' — tap cards below to add/remove');
    $('tower-info').textContent = 'Tower Lv ' + getTowerLevel() + ' (card avg ' + avgCardLevel().toFixed(1) + ') · Wilds: ' + getWilds() + ' / ' + wildCap();
    $('card-grid').innerHTML = CARDS.map(function (c) {
      var n = deck.filter(function (x) { return x === c.id; }).length;
      var lvl = getCardLevel(c.id);
      var upHtml = '';
      if (lvl < MAX_CARD_LEVEL) {
        var cost = UPGRADE_COSTS[lvl - 1];
        var col = getCollection(), have = col[c.id] || 0, wilds = getWilds();
        var short = Math.max(0, cost.cards - have);
        var afford = short <= wilds && getCrystals() >= cost.crs;
        upHtml = '<button class="mini-btn" data-up="' + c.id + '"' + (afford ? '' : ' disabled') + '>Upgrade to Lv ' + (lvl + 1) + ' (' + cost.cards + ' cards + ' + cost.crs + ' crs)</button>';
      } else {
        upHtml = '<div>MAX level</div>';
      }
      return '<div class="card' + (n ? ' in-deck' : '') + '" data-id="' + c.id + '"><canvas class="icon" width="48" height="48" data-icon="' + c.id + '"></canvas><div class="name">' + c.name + '</div><div class="cost">' + c.elixir + ' elixir · ' + c.type + ' · Lv ' + lvl + '</div><div>' + (n ? 'in deck' : 'tap to add') + '</div>' + upHtml + '</div>';
    }).join('');
    drawIcons($('card-grid'));
    var grid = $('card-grid');
    grid.querySelectorAll('[data-up]').forEach(function (btn) {
      btn.onclick = function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var res = upgradeCard(btn.getAttribute('data-up'));
        $('deck-status').textContent = res.ok ? 'Upgraded to Lv ' + res.level + '!' : 'Cannot upgrade: ' + (res.reason === 'max' ? 'already MAX' : (res.reason === 'cards' ? 'need ' + res.need + ' cards (have ' + res.have + ', ' + res.wilds + ' wilds)' : 'need ' + res.need + ' Crystils (have ' + res.have + ')'));
        renderDeckScreen();
      };
    });
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
    $('wild-count').textContent = getWilds() + ' / ' + wildCap();
    var chests = getChests();
    $('chest-list').innerHTML = chests.length ? chests.map(function (c, i) {
      var label = c.taps > 0 ? 'Tier ' + c.tier + ' chest - ' + c.taps + ' upgrade taps left' : 'Tier ' + c.tier + ' chest - tap to open';
      return '<div class="chest" data-i="' + i + '"><div>' + label + '</div><div>' + (c.taps > 0 ? 'tap to try an upgrade' : 'tap to open') + '</div></div>';
    }).join('') : '<p>No chests yet — win a battle to earn one!</p>';
    $('chest-list').querySelectorAll('.chest').forEach(function (el) {
      el.onclick = function () {
        var idx = parseInt(el.getAttribute('data-i'), 10);
        var all = getChests(), c = all[idx];
        if (c.taps > 0) {
          c.taps--;
          var chance = CHEST_UPGRADE_CHANCE[c.tier] || 0;
          var upgraded = c.tier < 4 && Math.random() < chance;
          if (upgraded) c.tier++;
          if (c.tier >= 4) c.taps = 0;
          storeSet('bb_chests', all);
          $('chest-rewards').textContent = upgraded
            ? 'Upgraded! Now a Tier ' + c.tier + ' chest. ' + (c.taps > 0 ? c.taps + ' taps left.' : 'Open it!')
            : 'No upgrade this tap. ' + (c.taps > 0 ? c.taps + ' taps left.' : 'Open it!');
          renderChestScreen();
        } else {
          all.splice(idx, 1);
          storeSet('bb_chests', all);
          var rw = chestReward(c.tier);
          $('chest-rewards').textContent = chestRewardText(rw, c.tier);
          renderChestScreen();
        }
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
    $('ai-king-label').textContent = 'AI King Lv ' + getTowerLevel();
    $('player-king-label').textContent = 'Your King Lv ' + getTowerLevel();
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
      if (chests.length < 4) { chests.push({ tier: 1, taps: 4 }); storeSet('bb_chests', chests); sub += ' · You earned a chest!'; }
      else sub += ' · (chest slots full — open one first!)';
      // Daily win: one claim per calendar day.
      var d = getDaily();
      var today = new Date().toDateString();
      var yesterday = new Date(Date.now() - 864e5).toDateString();
      if (d.claimedDay !== today) {
        var rw = grantDailyStep(d, today, yesterday);
        sub += ' · ' + rw.text;
      }
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
      updateHud: updateHud, startBattle: startBattle, renderChestScreen: renderChestScreen,
      getTowerLevel: getTowerLevel, getCardLevel: getCardLevel, upgradeCard: upgradeCard,
      getWilds: getWilds, getDaily: getDaily, refreshHome: refreshHome,
      getSelectedSlot: function () { return selectedSlot; },
      getBattle: function () { return battle; }
    };
  }
})();
