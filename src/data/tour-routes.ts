/**
 * Ready-made tours (trial data). Places are approximate: a teacher should walk the
 * route once and fix any stop with "Add a stop where I'm standing" (coming with the
 * route builder). Codes are words the teacher chooses and writes on the sheet or
 * finds on a sign; in the demo they are shown.
 */
import { DEFAULT_RADIUS_M } from '@/core/place/geo';
import type { Tour } from '@/lib/tours';

export const BRIGHTON_TOUR: Tour = {
  id: 'brighton-north-laine',
  title: 'Brighton: The Level to the sea',
  description: 'Parks, North Laine and the seafront. Choose your own places; visit at least 4.',
  level: 'B1',
  meetingPoint: { name: 'The Level (by the café)', lat: 50.8293, lng: -0.1357 },
  aim: 4,
  stops: [
    {
      id: 'level',
      name: 'The Level',
      area: 'Parks',
      at: { lat: 50.8294, lng: -0.1359 },
      radiusM: 60,
      clue: 'The big park where you started. Find the playground or the skate park.',
      backupCode: 'skate',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Take a photo that shows how people use this park.' },
        { id: 'write', kind: 'write', prompt: 'Who is here, and what are they doing? Write 3 or 4 sentences.', wordTarget: 40 },
      ],
    },
    {
      id: 'st-peters',
      name: "St Peter's Church",
      area: 'Parks',
      at: { lat: 50.8279, lng: -0.1349 },
      radiusM: DEFAULT_RADIUS_M,
      clue: 'Walk south from The Level. Look for a tall grey church on an island between the roads.',
      backupCode: 'tower',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Find something very old on or near the church. Take a photo.' },
        { id: 'write', kind: 'write', prompt: "Describe the church. Use 'It looks…' and 'It has…'.", wordTarget: 30 },
        { id: 'audio', kind: 'audio', prompt: 'What does it sound like here? Record 20 seconds.' },
      ],
    },
    {
      id: 'kensington-gardens',
      name: 'Kensington Gardens',
      area: 'North Laine',
      at: { lat: 50.8262, lng: -0.1385 },
      radiusM: DEFAULT_RADIUS_M,
      clue: 'A narrow street of small, colourful shops in North Laine (not The Lanes!).',
      backupCode: 'vintage',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Find the most colourful shop front. Take a photo.' },
        { id: 'write', kind: 'write', prompt: 'Would you buy something here? What, and why (or why not)?', wordTarget: 40 },
        { id: 'talk', kind: 'talk', prompt: 'Ask a shopkeeper: How long has this shop been here? What do people buy most?' },
      ],
    },
    {
      id: 'gardner-street',
      name: 'Gardner Street',
      area: 'North Laine',
      at: { lat: 50.825, lng: -0.1389 },
      radiusM: DEFAULT_RADIUS_M,
      clue: 'Cafés and shops, and on Saturdays the street is closed to cars.',
      backupCode: 'cafe',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Find street art or a funny sign. Take a photo.' },
        { id: 'write', kind: 'write', prompt: 'Write a short review of a café or shop here: ★ to ★★★★★ and 3 sentences.', wordTarget: 40 },
      ],
    },
    {
      id: 'jubilee-library',
      name: 'Jubilee Library',
      area: 'North Laine',
      at: { lat: 50.8244, lng: -0.1396 },
      radiusM: DEFAULT_RADIUS_M,
      clue: 'A modern building with a big glass front, on a square.',
      backupCode: 'books',
      tasks: [
        { id: 'write', kind: 'write', prompt: 'Find 5 things you can see in the square. Write one sentence about each.', wordTarget: 50 },
        { id: 'video', kind: 'video', prompt: 'Be a tour guide: film a 30-second introduction to the square (no faces of strangers).' },
      ],
    },
    {
      id: 'pavilion-gardens',
      name: 'Pavilion Gardens',
      area: 'Pavilion and seafront',
      at: { lat: 50.8221, lng: -0.1381 },
      radiusM: 50,
      clue: 'A garden next to a palace that looks like it belongs in India. Stand on the south side.',
      backupCode: 'palace',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Take a photo of the Royal Pavilion from the gardens.' },
        { id: 'write', kind: 'write', prompt: 'The Pavilion was built for a king. What do you think it looks like inside?', wordTarget: 40 },
        { id: 'talk', kind: 'talk', prompt: 'Ask a visitor: Where are you from? What do you like about Brighton?' },
      ],
    },
    {
      id: 'old-steine',
      name: 'Victoria Fountain, Old Steine',
      area: 'Pavilion and seafront',
      at: { lat: 50.8208, lng: -0.137 },
      radiusM: DEFAULT_RADIUS_M,
      clue: 'A big fountain in a garden between busy roads, on the way to the sea.',
      backupCode: 'water',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Find the animals on the fountain. Take a photo.' },
        { id: 'write', kind: 'write', prompt: 'What animals did you find? What else can you see from here?', wordTarget: 30 },
      ],
    },
    {
      id: 'beach',
      name: 'The beach by the Palace Pier',
      area: 'Pavilion and seafront',
      at: { lat: 50.8187, lng: -0.1374 },
      radiusM: 60,
      clue: 'Follow the road down to the sea. Stand on the stones near the pier.',
      backupCode: 'pebbles',
      tasks: [
        { id: 'photo', kind: 'photo', prompt: 'Take a photo of the pier.' },
        { id: 'audio', kind: 'audio', prompt: 'What does the beach sound like? Record 20 seconds of the waves and the gulls.' },
        { id: 'write', kind: 'write', prompt: 'Write a postcard to a friend about your day in Brighton.', wordTarget: 50 },
      ],
    },
  ],
};

export const TOURS: Tour[] = [BRIGHTON_TOUR];
