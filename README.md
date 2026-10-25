# Bash Boyale

A browser-first Clash Royale-style card battler with food-themed troops,
from Anthony's handwritten design notes. Open `index.html` in a browser to
play — no build step. GitHub Pages-ready from `main`.

## PR 4 — what's in (this PR)

### Part A: ability audit (all 15 original cards checked against the notes)

| Card | Notes ability | Status |
|---|---|---|
| Mustard | 1250 HP, 300 / 1.7s, 1-tile squirt, slow | Verified, no change |
| Plant Spirit | 680 HP, 130 dmg, pounces + roots 1s | Verified (hitSpeed 1.1 CHOSEN, notes give no rate) |
| Guard | 1200 HP, no dmg, +1000 shield to close allies | Verified (aura radius 2.5 CHOSEN; shield granted once per ally) |
| Firelight Ball | 650 dmg (300 towers), burn 100 x 3s | Verified (radius 2 CHOSEN) |
| Ravirolli | x3, 1900 HP, 180 / 1.6s, burn 40 / 2s, rolls 2 tiles / 5s (130 + knockup) | Verified (knockup rendered as a 0.5s stun) |
| Eagle Eye | 1200 HP, 111 / 1s, mini eagle every 3s (600 HP, 60 / 1s) | FIXED: minis now fire a spitball when Eagle Eye does (notes' wording); orphaned minis (parent dead) attack on their own cycle. Cap 5 kept. |
| Lazah-Beam | 5500 HP, 1850 / 5.8s charge, death fire zone +250 for 2s | FIXED: zone now deals exactly 2 ticks of 250 (was up to 3 on the removal frame) |
| Radio Tower | 3000 HP, 500 / 1.9s, 4 tiles, no spec | Verified, no change |
| Portn-Shield | 40% reduction 7s (one troop), 10% (others), radius 4 | Verified ("+1 troops" read as all other troops in radius) |
| Wolverdog | 6200 HP, 350 / 1.1s + 55 x 3 poison | Verified (poison applies to troops only, by convention) |
| PB n' Bounce | 6000 HP, balls 410-300-150, 2 tiles a bounce | FIXED: bounce chain can now hit towers (notes exclude no target type). Initial range 6 + hitSpeed 1.6 CHOSEN. |
| Waaflee | 9400 HP, 980 / 2.6s, split at 25% into 2 minis (1000 HP, 120 / 1.4s) | Verified (death-split kept as cover for one-shot kills) |
| Windblower | 1400 HP, push 1 tile / 1.2s, decaying HP | Verified (decay 70 HP/s + range 3 CHOSEN) |
| Back To Begin | 4720 HP, 783 / 1.9s, at 20% HP teleport to 4s-ago position, HP kept | Verified, no change |
| No-skill | 9900 HP, 45 / 0.9s, 9 tiles, every 3rd shot pierces +16 to all hit | Verified, no change |

Also fixed (found during the audit, affects all cards): troops no longer
march toward dead towers — movement now targets the nearest LIVING enemy
tower (previously a dead side tower could strand troops on its corpse).

### Part B: leveling (notes tables, exact where given)

- **Card levels 1-21 (MAX 21).** Upgrade costs are the notes' table
  exactly: L1->2 = 15 cards + 1000 crs, 2->3 = 25 + 1250, 3->4 = 50 +
  1500, 4->5 = 75 + 2000, 5->6 = 100 + 2500, 6->7 = 125 + 3000, 7->8 =
  140 + 3500, 8->9 = 160 + 4000, 9->10 = 180 + 4500, 10->11 = 195 +
  4750, 11->12 = 200 + 4900, 12->13 = 220 + 5100, 13->14 = 240 + 5500,
  14->15 = 260 + 6000, 15->16 = 275 + 6200, 16->17 = 290 + 6500,
  17->18 = 310 + 7000, 18->19 = 325 + 7500, 19->20 = 330 + 8000,
  20->21 = 350 + 8500.
- **Stat scaling:** the notes give no per-level stat table, so levels scale
  HP and damage (including burn/poison ticks, bounce steps, minis, death
  fire, and Guard's shield) by x1.04 per level above 1 (L21 = about 2.19x).
  Ranges, speeds, durations, and damage-reduction do not scale. Upgrade in
  the deck builder: costs spend collection copies first, then wild cards
  (1 wild = 1 copy). Battles use your levels for your side; the AI plays
  at level 1 (notes say nothing about AI levels).
- **Tower levels 1-21** use the notes' HP / DMG table (hit speed 1.5s):
  L1 1800/100, L2 1950/125, L3 2100/140, L4 2300/180, L5 2450/220, L6
  2500/250, L7 2700/300, L8 2950/340, L9 3200/360, L10 3400/375, L11
  3500/395, L12 3650/410, L13 3720/420, L14 3900/425, L15 4100/430, L16
  4400/435, L17 4550/445, L18 4800/450, L19 5250/470, L20 5500/485, L21
  5600/500.
- **Tower level from average card level** (average over all 23 cards, since
  every card starts unlocked): L1 free, L2 = 1.25 (interpolated — see
  below), L3 = 1.5, L4 = 1.75, L5 = 2, L6 = 2.3, L7 = 2.6, L8 = 2.9, L9 =
  3.2, L10 = 3.5, L11 = 3.8, L12 = 4.3, L13 = 5, L14 = 5.5, L15 = 6.2,
  L16 = 6.8, L17 = 7.5, L18 = 8, L19 = 8.5, L20 = 9.8, L21 = 11. Tower
  level never drops once reached, even if a new card lowers the average
  (notes: only balance changes can drop it).
- **Readings documented:** (1) L2's requirement is interpolated at 1.25
  between L1 (1.0) and L3 (1.5) — the notes' "L2 ... avg level to L2" line
  cannot mean avg 2.0, which would exceed L3/L4/L5's requirements and
  break the ordering. (2) "MAIN Mortar DS +2000 HP every lvl" is read as
  the king (main) tower getting +2000 HP over the table value at every
  level (side towers use the table as-is); the per-level reading (+2000
  times level) would dwarf the whole table and is not used.

### Part C: 8 new cards (deck pool grows 15 -> 23, deck stays pick-8)

| Card | Elixir | Notes mechanic |
|---|---|---|
| The Tank | 10 | 8920 HP, 200 / 1.8s, short range, no spec (speed slow CHOSEN) |
| Dagger Dip | 4 | Spell: friendly troops + towers in radius gain a buff; their next attack poisons (100 x 3s). Buildings excluded per notes. Radius 3 CHOSEN. |
| Run N Xplode | 2 | x2, 1600 HP, 490 dmg, very fast suicide runners (explode on first hit) |
| Overclocker | 8 | 4300 HP, 380 / 1.6s, aura radius 2.5: allies +60% hit speed, enemies 20% slower (each effect once, no stacking) |
| Popkicker | 6 | 3200 HP, 500 / 1.6s, kernel explodes for 170 dmg 0.6s after every kick |
| Efield | 6 | Spell zone: 6s, ticks every 1.4s, falloff 500 -> 300 -> 150 -> 100 by distance band, radius 4 |
| Drone | 6 | 3000 HP, tower-focused dasher: within 4 tiles of a tower it dashes in, hits for 450, dashes back, waits 0.8-1.3s. Never engages troops. |
| Katana Kid | 7 | 4800 HP, 400 / 1.7s, sword close range, no spec (speed norm CHOSEN) |

All 8 have drawn canvas art + signature animations, no emojis. The AI deck
now includes Run N Xplode, Drone, and Katana Kid so the new cards appear
in battles (AI still plays at level 1).

### Part D: other systems

- **Chest tiers + upgrade game (notes p.14 + p.19).** Won chests always
  start at Tier 1 ("Starting chest 1"). Opening one is a 4-tap upgrade
  game: each tap rolls the next tier's chance (T1->T2 50%, T2->T3 20%,
  T3->T4 11%). Rewards roll from the final tier's split (Crystils% /
  Cards% / Rare%): T1 34/33/33, T2 30/30/40, T3 20/30/50, T4 10/30/60,
  with 3/4/5/8 slots and 50/100/200/400 base Crystils. "Rare Cards" =
  elixir cost 6+ (no per-card rarity table exists in the notes).
- **Wild cards.** Cap scales with tower level: 15 at L1 -> 120 at L21
  (cap = round(15 + 5.25 x (towerLv - 1))). Wilds come from high-tier
  chests (T3: 1, T4: 3; rate CHOSEN, notes give none) and spend as generic
  upgrade copies (1 wild = 1 copy). Excess wilds over the cap convert to
  100 Crystils each.
- **Overflow rule.** A chest/daily card granted for a card already at MAX
  level (21) converts to 100 Crystils (notes: "overflow cards are worth
  100 crs or 1 random card" — Crystils chosen).
- **Daily wins / streaks (notes p.21).** One claim per calendar day, on
  winning a battle. Streak = consecutive win days; brackets Reg (1-2),
  3-7, 8-14, 14+, plus "Lucky!" on a 10% roll (trigger CHOSEN, notes don't
  say how Lucky! triggers). Sequences: Reg = 2 cards -> 2 chests of 3 ->
  300 crs -> 3 cards; 3-7 = 3 cards -> 2 chests of 5 -> 500 crs -> 3
  cards; 8-14 = 3 cards -> 4 cards -> 3 cards -> 650 crs; 14+ = 4 cards
  -> 4 cards -> 750 crs -> 2 chests of 10 + 3 rare cards; Lucky! = 5
  cards -> 2 chests of 15 -> 800 crs -> 5 rare cards. ("chest (N)" read
  as N cards; "chest (A, B)" as A groups of B cards.)

### Simplifications (with reasons)

- Passes (Monthly / Pass+) stay deferred, as ordered.
- Elixir rules, match timer, and 3-tower rules unchanged from PR 2.
- No-emoji rule from PR 3 continues (verified by scan).
- "Up to 60%" Overclocker haste does not stack across multiple Overclockers.
- Daily reward chests grant instantly (they do not occupy the 4 chest slots).
- AI towers use the player's tower level (symmetric battles).


## PR 3 — what's in (this PR)

- **No emojis anywhere** — every button, card, tower, and message is plain
  text or canvas-drawn art. Hand and deck-grid cards show a small canvas
  portrait of the character, drawn with the same routine as the arena.
- **Every card drawn as a proper little character** from the notebook
  doodles — Mustard the squirting bottle, the leafy Plant Spirit, the
  pentagon Guard, the robot Lazah-Beam, the peanut-butter jar, the waffle
  Waaflee, the swordsman Back To Begin, and the rest. Towers are stone
  structures now (crenellated side towers, crowned king tower), not icons.
- **Signature animations** — walk wobble on troops, Mustard squirt
  particles, Lazah-Beam charge glow + ground flames on death, Waaflee burst
  split, Back To Begin ghost-trail rewind, Guard shield bubbles, Windblower
  gusts + visible decay shrink, No-skill thick piercing tracers, PB bounce
  balls sized by damage step, poison drips, shield shimmer, fire trails and
  burn flames, Plant Spirit pounce arcs + root vines, Ravirolli roll dust,
  Eagle Eye feather bursts, spawn pop-ins. No stats, costs, or rules
  changed — only the visuals got richer.
- **Cheese Monster note** — the overhaul brief listed a Cheese Monster
  split animation, but Cheese Monster is not one of the 15 in-game cards,
  and PR 3 adds no new cards, so it has no animation here. It arrives with
  the other 35 cards in a later PR.

## PR 2 — what's in

- **Bug fixes from the PR 1 playtest** — the hand no longer re-renders every
  animation frame, so tapping a card actually selects it (previously the card
  node was destroyed mid-tap and the player could never play anything). The
  deck builder now keeps partial decks, so removing/adding cards sticks, and a
  full deck shows "Deck full — remove a card first" instead of silently
  refusing. Mini Waffles / Mini Eagles get their own unit IDs, so they can no
  longer split or spawn more minis (previously an unbounded entity flood).
- **Minors** — AI elixir is now shown in the HUD; spells only spend elixir and
  cycle the hand when they actually affect a target ("No targets there!"
  otherwise); tapping the arena with no card picked says "Pick a card first!";
  `touch-action: manipulation` on taps; the battle screen fits a phone
  viewport (arena capped so it can't scroll mid-battle).
- **Three towers per side, Clash Royale-style** — two side towers + one king
  tower each side (all L1 notes stats: 1800 HP, 100 dmg / 1.5s). Units march
  toward the nearest enemy tower. Win conditions: destroying the enemy king
  tower wins instantly; at the 2:00 timer, the side with more towers destroyed
  wins; tied tower counts fall back to total tower HP %; fully tied = draw.
  Troops/buildings can't be placed on top of an own tower.
- **Arena Forge UI port** — dark gradient background, purple + gold accents,
  chunky rounded card frames with gold selection glow, bolder bordered HP
  bars, chunky buttons with a press effect. Same small stylesheet, new look.

## PR 1 — what's in

- **Home screen** — Play, Deck Builder, Chests.
- **Arena** — bridged, mirrored sides, one tower each side (L1: 1800 HP,
  100 dmg / 1.5s), elixir meter (max 10, 1 per 2.8s), 4-card hand, 2:00 timer.
  Win by destroying the enemy tower, or by having more tower HP when time runs out.
  (PR 2 replaces this with three towers per side — see above.)
- **AI opponent** — plays from a fixed 8-card deck on a timer. Not smart, but it plays.
- **Deck builder** — pick any 8 of the 15 PR 1 cards. Saved in your browser.
- **Chests** — win a battle to earn a chest (up to 4 slots). Open it for
  random cards + Crystils. Basic PR 1 version: no timers, and the notes' full
  4-tier odds table is simplified to a weighted tier roll.

## Cards (23)

Stats are faithful to the handwritten notes. Where a note leaves a number out
(attack speed, a range, a decay rate), the game picks a sensible value — those
spots are marked `CHOSEN` in `game.js`.

| Card | Elixir | Notes mechanic |
|---|---|---|
| Mustard | 1 | 1250 HP, 300 dmg / 1.7s, 1-tile squirt, slow |
| Plant Spirit | 1 | 680 HP, 130 dmg, pounces and roots 1s |
| Guard | 1 | 1200 HP, no damage, +1000 shield to nearby allies |
| Firelight Ball | 3 | Spell: 650 dmg (300 towers), burn 100/s for 3s |
| Ravirolli | 4 | ×3, burn 40/2s, rolls 2 tiles every 5s (130 dmg + knockup) |
| Eagle Eye | 4 | Spawns a mini eagle every 3s (max 5) |
| Lazah-Beam | 4 | Charged beam 1850 / 5.8s, death leaves a 250-dmg fire zone for 2s |
| Radio Tower | 4 | Building, 500 dmg / 1.9s, 4 tiles |
| Portn-Shield | 5 | Spell: 40% damage reduction 7s (target), 10% (others in radius) |
| Wolverdog | 6 | Poison bites: 55 dmg × 3 ticks |
| PB n' Bounce | 6 | Building, bouncing balls 410 to 300 to 150 |
| Waaflee | 9 | At 25% HP spawns 2 mini waffles |
| Windblower | 9 | Building, pushes enemies back 1 tile / 1.2s, HP decays |
| Back To Begin | 10 | At 20% HP teleports back to where it was 4s ago |
| No-skill | 11 | Building, every 3rd shot pierces for +16 dmg |
| The Tank | 10 | 8920 HP, 200 / 1.8s, short range, no spec |
| Dagger Dip | 4 | Spell: next attack poisons (100 x 3s) for troops + towers in radius |
| Run N Xplode | 2 | x2, 1600 HP, 490 dmg, very fast suicide runners |
| Overclocker | 8 | 4300 HP, 380 / 1.6s, aura: allies +60% hit speed, enemies 20% slower |
| Popkicker | 6 | 3200 HP, 500 / 1.6s, kernel explodes 170 dmg 0.6s after each kick |
| Efield | 6 | Spell zone: falloff 500 -> 300 -> 150 -> 100, radius 4, 6s |
| Drone | 6 | 3000 HP, dashes to towers, hits 450, dashes back |
| Katana Kid | 7 | 4800 HP, 400 / 1.7s, sword close range, no spec |

## Later PRs (not in this one)

The other 27 cards, passes (Monthly / Pass+), and ranked play.
