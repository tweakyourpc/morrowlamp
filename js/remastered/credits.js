/* ============================================================
   THE SUNKEN CROWN, REMASTERED — credits
   The one source for the game's credits. The "About & credits" card on
   the title screen rolls them, and `node tools/credits.mjs` writes the
   same roll as marketing/credits.txt; test/remastered-manifest.js fails
   if that file falls behind this one.

   Every voice the voice builder casts (tools/voice/voices.json) has an
   entry in VOICES with its data, licence and source, checked by the
   same test, so a new voice cannot ship uncredited. Licences are as each
   model's card on the rhasspy/piper-voices repository gives them (read
   2026-11-07).
   ============================================================ */

export const AUTHOR = {
  name: 'Christopher Davis',
  github: 'https://github.com/tweakyourpc',
  linkedin: 'https://www.linkedin.com/in/srqhelpdesk/'
};

/* Shown once, above the roll. */
export const AUTHOR_LINKS = [['GitHub', AUTHOR.github], ['LinkedIn', AUTHOR.linkedin]];

/* Keyed by the voice id in voices.json (narrators and cast). Every one
   is public domain, so the game can be given away or sold. `credit` is
   what the roll prints under the model; the rest is for the curious
   (the card links each model) and for the test. */
export const VOICES = {
  cori: {
    role: 'Southern English woman (narrator)',
    model: 'Piper voice "cori" by Bryce Beattie',
    credit: ['LibriVox recordings, public domain'],
    data: 'About 24 hours of LibriVox recordings; trained from scratch',
    licence: 'Public domain',
    link: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/cori/high'
  },
  norman: {
    role: 'American man (narrator)',
    model: 'Piper voice "norman"',
    credit: ['LibriVox recordings, public domain'],
    data: 'About 15.5 hours of LibriVox recordings; trained from scratch',
    licence: 'Public domain',
    link: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/norman/medium'
  },
  kristin: {
    role: 'American woman (narrator)',
    model: 'Piper voice "kristin"',
    credit: ['LibriVox recordings, public domain'],
    data: 'About 11.5 hours of LibriVox recordings; trained from scratch',
    licence: 'Public domain',
    link: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/kristin/medium'
  },
  ljspeech: {
    role: 'Your grandmother\'s note',
    model: 'Piper voice "ljspeech"',
    credit: ['The LJ Speech Dataset, Keith Ito and Linda Johnson', 'LibriVox recordings, public domain'],
    data: 'The LJ Speech Dataset, from LibriVox recordings; trained from scratch',
    licence: 'Public domain',
    link: 'https://keithito.com/LJ-Speech-Dataset/'
  },
  john: {
    role: 'The chroniclers\' books',
    model: 'Piper voice "john"',
    credit: ['LibriVox recordings, public domain'],
    data: 'About 12.5 hours of LibriVox recordings; fine-tuned from the public-domain "kristin" voice',
    licence: 'Public domain',
    link: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/john/medium'
  }
};

/* The roll, top to bottom. A block has a heading and lines ('' is a
   breath between groups), or prose paragraphs; the Voices block lists
   VOICES between its lines and its `after`. The first block is the
   title, the last the sign-off. */
export const ROLL = [
  { title: ['The Sunken Crown', 'Remastered'], lines: ['A Morrowlamp Software production'] },

  { heading: 'Created, directed and produced by', lines: [AUTHOR.name] },

  {
    heading: 'About the game',
    paragraphs: [
      'The Sunken Crown began as a tribute to the Infocom text adventures of the late 1970s and early \'80s: interactive fiction driven by a natural-language parser, where the only graphics were the ones the prose put in your head.',
      'The goal was a port to modern hardware that kept the parser at its heart and added what those machines never could: spoken narration and modern graphics, with a nod to the EGA look of the 1980s computer role-playing games.',
      'The text port came first. Its engine, the Morrowlamp Machine, then drove a graphical front end in the point-and-click tradition, and every feature since has been a modular layer on that same core: mouse control, a typed command line with scrollback history, fully voiced narration with a choice of narrators, a synthesized score, and pre-rendered 3D rooms.',
      'Then the signature trick. Every room starts out in period 16-colour EGA, and the first time you act in it, whether you pick something up or open a door, it remasters itself in front of you. The house fills in as you play, and becomes your map.'
    ]
  },

  {
    heading: 'Open source, start to finish',
    lines: ['The Sunken Crown is free and open-source software,', 'released under the MIT licence.', '',
      'Its engine, art pipeline, score, voices and films', 'were built with free and open-source software:',
      'no commercial game engine, no paid art package,', 'no stock assets. Every tool is credited below', 'with its licence.', '',
      'Two closed-source tools were used in production,', 'and neither ships with the game:',
      'NVIDIA\'s OptiX and GPU driver, to speed up the renders,', 'and Claude Code, the AI assistant used in development.']
  },

  { heading: 'Story and game writing', lines: ['Generated and revised with AI assistance', 'under the direction of ' + AUTHOR.name] },

  {
    heading: 'The Morrowlamp Machine',
    lines: ['The game engine: parser, rules, combat,', 'validator and walkthrough prover', 'Original to Morrowlamp · MIT licence', '',
      'The classic edition', 'HTML5 Canvas, drawn in CGA, EGA and VGA palettes', 'by Morrowlamp\'s own scene painters']
  },

  {
    heading: 'The remastered edition',
    lines: ['three.js r180 · MIT licence', 'WebGL, for the live hero and the lantern\'s light',
      'glTF 2.0, the Khronos open standard, for the hero\'s model and animation', 'WebP, the open image format, for the rendered rooms']
  },

  {
    heading: 'Rooms, hero, epilogue and trailer',
    lines: ['Blender 5.3 · GNU GPL', 'Cycles path tracer · Apache 2.0', 'Intel Open Image Denoise · Apache 2.0', 'AgX colour management', '',
      'Every room, prop and creature built in Python', 'by Morrowlamp\'s own scripts.', 'No stock models, textures or photographs.']
  },

  {
    heading: 'Music',
    lines: ['An original score, composed as code', 'for Morrowlamp\'s own sequencer,', 'played on the remastered score engine',
      'through the Web Audio API.', 'Every note and every sound is synthesized', 'while you play. No recordings, no samples.', '',
      'The trailer\'s score is written the same way.']
  },

  {
    heading: 'Voices',
    lines: ['Narration synthesized with Piper text-to-speech · GNU GPL 3.0', 'Michael Hansen and the Open Home Foundation'],
    voices: true,
    after: ['With thanks to the LibriVox volunteers,', 'who give their readings to the public domain', '',
      'Every sentence voiced in several takes,', 'and the clearest chosen by machine listening:',
      'faster-whisper (SYSTRAN) on CTranslate2 · MIT licence,', 'with OpenAI\'s Whisper speech model · MIT licence', '',
      'Narration delivered as Opus audio in WebM · BSD licence', 'Device voice by the Web Speech API']
  },

  {
    heading: 'Trailer and film production',
    lines: ['FFmpeg · GNU LGPL and GPL', 'x264, for H.264 video · GNU GPL', 'Loudness to EBU R128', '',
      'Playwright · Apache 2.0', 'and headless Chromium · BSD licence,', 'for the title cards and the offline score']
  },

  { heading: 'Typefaces', lines: ['Cormorant Garamond', 'EB Garamond', 'SIL Open Font License 1.1'] },

  {
    heading: 'Built with',
    lines: ['Node.js · MIT licence', 'Python · PSF licence', 'Pillow · MIT-CMU licence', 'NumPy · BSD licence',
      'Bash and rsync · GNU GPL', 'OpenSSH · BSD licence', 'systemd · GNU LGPL', 'git · GNU GPL 2.0', 'Ubuntu, on the Linux kernel · GNU GPL', '',
      'The Showrig render worker']
  },

  {
    heading: 'AI development',
    lines: ['Claude Code, by Anthropic', 'Software, procedural art, writing,', 'voice and render pipelines, and testing,',
      'under human direction']
  },

  { heading: 'Special thanks', lines: ['Grandmother, for the note', 'The cavern, for the echo', 'The Sentinel, now off duty'] },

  {
    lines: ['The Sentinel appears courtesy of the Sunken Halls.', 'No kings were woken in the making of this game.', '',
      'Arcade veterans, take note:', 'one famous Konami cheat still works in these halls.',
      'We won\'t tell you the sequence. Your thumbs may remember it.', '',
      '© 2026 ' + AUTHOR.name, 'Morrowlamp Software']
  }
];
