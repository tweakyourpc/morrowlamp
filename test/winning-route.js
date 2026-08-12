/* ============================================================
   THE SUNKEN CROWN — the canonical winning route
   Kept as plain data in one place so every engine that claims to
   run this game can be driven down the same path: the original
   engine, the Morrowlamp Machine, and the compiled artifact.
   ============================================================ */
'use strict';

module.exports = [
  'read note',
  'n', 'n',
  'open clock', 'take brass key', 'take music sheet', 'read music sheet',
  'w', 'take lyre', 'read book',
  'e', 'e', 'take curtain',
  'w', 'unlock hatch with brass key', 'open hatch', 'd',
  'take shovel', 'take pitch pot', 'dig',
  's', 's',
  'say echo',
  's', 'w', 'push mirror', 'w', 'take idol',
  'e', 'e', 's',
  'play lyre', 'take vault key',
  'unlock vault door with vault key', 'open vault door', 'w', 'take scepter',
  'e', 's', 'take crown',
  'd', 'open sarcophagus', 'take ring',
  'u', 'n', 'n', 'n',
  'w', 'fix boat', 'w', 'take chalice',
  'e', 'e', 'n', 'u', 'u',
  's', 's', 'climb well', 'take sunstone',
  'u', 'n', 'n',
  'put crown in cabinet', 'put scepter in cabinet', 'put chalice in cabinet',
  'put idol in cabinet', 'put ring in cabinet', 'put sunstone in cabinet'
];
