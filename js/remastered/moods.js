/* ============================================================
   THE SUNKEN CROWN, REMASTERED — moods
   Which track plays where, and how uneasy the score should be.
   The classic edition keeps the music js/scenes.js gives each
   room; the remastered edition gives the places that keep secrets
   or hold danger a score of their own, and plays no music at all
   outdoors.

   Tension (0..1) is read from the game, never decided here: a
   fight, the dark, a lantern running dry. The score turns it into
   a heartbeat, and past the halfway mark, a shiver.
   ============================================================ */

export const MOODS = {
  yard: 'outside',          // under the open sky: wind and crickets, no music
  porch: 'outside',
  kitchenGarden: 'outside',
  glasshouse: 'outside',    // the sky comes in through the broken panes
  grandmotherRoom: 'intrigue',
  study: 'intrigue',
  vault: 'intrigue',
  gatePassage: 'tension',
  guardroom: 'tension',
  mirrorHall: 'mirrors',
  mirrorSanctum: 'mirrors'
};

/* How uneasy a room is with nothing happening in it. */
const UNEASE = {
  cellar: 0.2,
  tunnel: 0.2,
  wellBottom: 0.2,
  gatePassage: 0.3,
  guardroom: 0.45,
  throne: 0.25,
  tomb: 0.35
};

export function tensionOf(runtime, lantern, roomId) {
  if (runtime.encounter()) return 0.9;
  if (lantern.pitchBlack) return 0.8;
  const base = UNEASE[roomId] || 0;
  return lantern.low ? Math.max(base, 0.55) : base;
}
