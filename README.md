# Bash Boyale

A browser-first Clash Royale-style card battler with food-themed troops,
from Anthony's handwritten design notes. Open `index.html` in a browser to
play — no build step. GitHub Pages-ready from `main`.

## PR 2 — what's in (this PR)

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

## PR 1 cards (15)

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
| PB n' Bounce | 6 | Building, bouncing balls 410 → 300 → 150 |
| Waaflee | 9 | At 25% HP spawns 2 mini waffles |
| Windblower | 9 | Building, pushes enemies back 1 tile / 1.2s, HP decays |
| Back To Begin | 10 | At 20% HP teleports back to where it was 4s ago |
| No-skill | 11 | Building, every 3rd shot pierces for +16 dmg |

## Later PRs (not in this one)

The other 35 cards, the notes' full chest odds + upgrade tables, tower
leveling by average card level, passes, streaks, and ranked play.
