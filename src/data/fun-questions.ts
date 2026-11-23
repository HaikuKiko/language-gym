/**
 * Speed friending: playful questions for getting to know a partner, with no
 * grammar point. Many use the phone in the student's hand (photos, music,
 * maps). They follow the same 16 themes as the course, in two versions:
 * "easier" for A1–A2 classes and "harder" for B1 and up.
 *
 * This list is built into the app. When the fun_questions table in Supabase
 * has rows, those are used instead, so the questions can be edited there.
 */
import type { Level } from '@/data/questions';

export type FunBand = 'easier' | 'harder';

export type FunQuestion = {
  text: string;
  band: FunBand;
  /** The theme, as the course week (1 to 16) it belongs to. */
  week: number;
};

/** A1 and A2 classes get the easier questions; B1 and up the harder ones. */
export function funBandFor(level: Level): FunBand {
  return level === 'A1' || level === 'A2' ? 'easier' : 'harder';
}

/** The questions for a class: its band, and its theme when one is chosen. */
export function findFunQuestions(
  questions: readonly FunQuestion[],
  level: Level,
  week: number | null | undefined,
): FunQuestion[] {
  const inBand = questions.filter((q) => q.band === funBandFor(level));
  if (week == null) return inBand;
  const forTheme = inBand.filter((q) => q.week === week);
  return forTheme.length > 0 ? forTheme : inBand;
}

const e = (week: number, text: string): FunQuestion => ({ band: 'easier', week, text });
const h = (week: number, text: string): FunQuestion => ({ band: 'harder', week, text });

export const BUILT_IN_FUN_QUESTIONS: FunQuestion[] = [
  // 1 · People & Places
  e(1, 'Show your partner a photo of your hometown. What is your favourite place there?'),
  e(1, 'Who is in the last photo of a person on your phone? Tell your partner about them.'),
  e(1, 'Find a photo of your country on your phone or online. Why do you like it?'),
  e(1, 'What is the best street food in your hometown? Show a picture if you can.'),
  h(1, 'Show your partner a photo from your country that a tourist would never see. Why is it special to you?'),
  h(1, 'Find the oldest photo on your phone. Where were you, and who were you with?'),
  h(1, 'If your hometown were a person, what would they be like? Show a photo that proves it.'),
  h(1, "Which three places in your country should your partner visit? Use your phone's map to show them."),

  // 2 · You, Yours & Opinions
  e(2, 'Show your partner your phone background. Why did you choose it?'),
  e(2, 'What is your favourite app? Show your partner how you use it.'),
  e(2, 'Find a photo that shows something you love. Tell your partner about it.'),
  e(2, 'Are you a morning person or a night person? Show a photo from your best time of day.'),
  h(2, 'What does your phone background say about you? Guess what your partner\'s says about them.'),
  h(2, 'Show your partner the last thing you bought online. Was it a good idea?'),
  h(2, "What's an opinion you have that most people disagree with? Try to convince your partner."),
  h(2, 'Find the 5th photo in your camera roll. Tell the story behind it.'),

  // 3 · Everyday Life & Experiences
  e(3, 'Show a photo of something you did this week. What happened?'),
  e(3, 'What do you eat for breakfast? Find a photo of it.'),
  e(3, 'How do you get to class? Show it on your map.'),
  e(3, 'What is the last photo you took? Why did you take it?'),
  h(3, 'Scroll back exactly one month in your photos. What was happening in your life then?'),
  h(3, "Show your partner your screen time. Are you surprised? What's your most-used app?"),
  h(3, "Describe your perfect ordinary day, from waking up to going to sleep. What's different from your real one?"),
  h(3, "What's the funniest thing that happened to you this year? Show a photo if you have one."),

  // 4 · Loves, Hates & Feelings
  e(4, 'Play your partner 10 seconds of a song you love. Why do you like it?'),
  e(4, 'Find a photo that makes you happy. Show your partner.'),
  e(4, 'What food do you hate? Can your partner guess why?'),
  e(4, 'Show your favourite emoji. When do you use it?'),
  h(4, "Show your partner the song you've played the most this year. What does it remind you of?"),
  h(4, "Which emoji do you use most? Check your keyboard. Does it describe your personality?"),
  h(4, 'What is something small that makes you really angry? Does your partner feel the same?'),
  h(4, 'Show a photo from a moment when you felt really proud. What happened?'),

  // 5 · Travel & Nature
  e(5, 'Show your partner a photo from a trip. Where were you?'),
  e(5, 'Beach or mountains? Find a photo of your favourite one.'),
  e(5, 'Where do you want to go next? Show it on the map.'),
  e(5, 'Do you have a photo of an animal on your phone? Tell your partner about it.'),
  h(5, "Show your partner the most beautiful place you've ever been. Would you go back?"),
  h(5, 'Plan a weekend trip together: you have 200 dollars and one map. Where do you go?'),
  h(5, "What's the worst travel experience you've had? Make your partner laugh."),
  h(5, 'Find a photo of nature on your phone. Where was it, and why did you stop to take it?'),

  // 6 · Eating & Drinking
  e(6, 'Show a photo of food from your country. How do you eat it?'),
  e(6, 'What did you eat yesterday? Find a photo if you can.'),
  e(6, 'Coffee or tea? How do you like it?'),
  e(6, 'What food do you miss from home? Show a picture of it.'),
  h(6, "Show your partner a dish from your country and explain how to make it, step by step."),
  h(6, "What's the strangest thing you've ever eaten? Would you eat it again?"),
  h(6, "Find your favourite restaurant on the map. Sell it to your partner in 30 seconds."),
  h(6, 'If you could only eat one country\'s food for the rest of your life, which would it be, and why?'),

  // 7 · Extraordinary People
  e(7, 'Who is a famous person from your country? Show their photo.'),
  e(7, 'Who is your hero? Tell your partner about them.'),
  e(7, 'Show a photo of a friend or family member. What is special about them?'),
  e(7, 'Who is your favourite singer or actor? Play or show something by them.'),
  h(7, 'Show your partner someone famous from your country that they have probably never heard of.'),
  h(7, "Who in your family has the most interesting story? Tell it in two minutes."),
  h(7, 'If you could have dinner with anyone, alive or dead, who would it be? Find their photo.'),
  h(7, "What's the most unusual talent you have? Can you show your partner?"),

  // 8 · Fact or Fiction & Homes
  e(8, 'Show a photo of your room or home. What do you like about it?'),
  e(8, 'Tell your partner two true things and one lie about you. Can they guess the lie?'),
  e(8, 'What is your favourite thing in your home? Show a photo.'),
  e(8, 'Find a photo of a house you love online. Would you like to live there?'),
  h(8, 'Show your partner three photos. One has a true story, two have stories you invent. Which is true?'),
  h(8, 'Describe your dream home. Find a picture online that is close to it.'),
  h(8, "What's an object in your home that has a story? Tell it, and show a photo if you can."),
  h(8, 'Tell your partner the strangest true story you know. Can they believe it?'),

  // 9 · Buying & Selling
  e(9, 'Show your partner the last thing you bought. Do you like it?'),
  e(9, 'What is your favourite shop? Show it on the map.'),
  e(9, 'Do you like shopping online or in shops? Why?'),
  e(9, 'Find something on your phone you want to buy. Show your partner.'),
  h(9, "Sell your phone case to your partner. Make it sound amazing. Will they buy it?"),
  h(9, "What's the best thing you've ever bought for under 20 dollars? Show it if you can."),
  h(9, "Show your partner something in your online basket. Should you buy it? Let them decide."),
  h(9, "What's the worst thing you've ever bought? Why did you buy it?"),

  // 10 · Love & Relationships
  e(10, 'Show a photo of your best friend. How did you meet?'),
  e(10, 'Who do you message the most? What do you talk about?'),
  e(10, 'Do you have a pet? Show a photo, or show the pet you want.'),
  e(10, 'What makes a good friend? Tell your partner three things.'),
  h(10, "Show your partner the last voice message or photo a friend sent you (if it's OK to share). What's the story?"),
  h(10, 'How did your best friendship begin? Was it love at first sight?'),
  h(10, "What's a romantic story from your family? How did your parents or grandparents meet?"),
  h(10, 'Show a photo of someone who changed your life. What did they do?'),

  // 11 · Street Life & Technology
  e(11, 'Show your partner a photo of a street you like. Where is it?'),
  e(11, 'What app do you use every day? Show it to your partner.'),
  e(11, 'Take a photo of something interesting near you now. Show your partner.'),
  e(11, 'What is your favourite game on your phone? Show your partner how to play.'),
  h(11, "Show your partner an app they don't have but should. Convince them to download it."),
  h(11, "What would your life be like without a phone for a week? Could you do it?"),
  h(11, 'Find a photo of street life from your country. What sounds and smells go with it?'),
  h(11, "What's the most useful thing your phone does that people your grandparents' age wouldn't believe?"),

  // 12 · The World Around Us
  e(12, 'Show the weather in your hometown today on your phone. Do you like it?'),
  e(12, 'Find a photo of the sky, the sea or a tree. Why did you take it?'),
  e(12, 'What is the best season in your country? Show a photo.'),
  e(12, 'What animal do you like? Find a photo and show your partner.'),
  h(12, 'Compare the weather in your hometown and here today on your phones. Which do you prefer?'),
  h(12, "Show your partner a place in your country that has changed a lot. What happened?"),
  h(12, 'If you could protect one place in the world, which would it be? Show it.'),
  h(12, "What's something people from your country do that the world could learn from?"),

  // 13 · Weekends Away & Free Time
  e(13, 'Show a photo from last weekend. What did you do?'),
  e(13, 'What is your hobby? Show a photo or video of it.'),
  e(13, 'Do you like sport? Show your favourite team or player.'),
  e(13, 'Plan a fun day this weekend with your partner. Where will you go?'),
  h(13, 'Show your partner your best weekend photo ever. Tell the whole story.'),
  h(13, "What's a hobby you started and gave up? Show proof if you have it."),
  h(13, 'Plan the perfect weekend for your partner. Ask them three questions first.'),
  h(13, "What do you do when you have a free afternoon and no plans? Show a photo of it."),

  // 14 · Learning & Studying
  e(14, 'Show a photo of your school or a place where you study.'),
  e(14, 'What is your favourite English word? Why?'),
  e(14, 'What app helps you learn? Show your partner.'),
  e(14, 'Teach your partner one word in your language.'),
  h(14, "Teach your partner a useful phrase in your language. Can they say it correctly?"),
  h(14, 'Show a photo from your school days. What kind of student were you?'),
  h(14, "What's something you learned from YouTube or TikTok? Show the video."),
  h(14, 'If you could learn any skill in one day, what would it be, and why?'),

  // 15 · Keeping in Touch & Plans
  e(15, 'Who did you message today? What did you say?'),
  e(15, 'Show a photo of your family or friends far away. Where are they?'),
  e(15, 'What are you doing after class today?'),
  e(15, 'Make a plan to meet your partner for coffee. When and where?'),
  h(15, 'Show your partner the funniest group chat name or sticker you have.'),
  h(15, 'How do you keep in touch with people at home? Show the app you use most for it.'),
  h(15, "Where do you see yourself in five years? Find a photo that shows it."),
  h(15, 'Make a real plan with your partner for something fun this week. Where, when, and who else comes?'),

  // 16 · Going Places
  e(16, 'Where is the last place you went? Show it on the map.'),
  e(16, 'Show a photo of a bus, train or plane trip. Where were you going?'),
  e(16, 'What place in this city do you like? Show your partner.'),
  e(16, 'Where do you want to go one day? Show a photo.'),
  h(16, "Show your partner your favourite secret spot in this city. Why do you love it?"),
  h(16, "What's the longest journey you've ever made? Show where it started and ended on a map."),
  h(16, 'You can go anywhere tomorrow, for free, for one day. Where? Show your partner.'),
  h(16, "Find a place on the map you've never heard of. Make up a story about it together."),
];
