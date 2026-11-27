# How the grammar quizzes are written

Claude writes each week's quizzes from the grammar you give for each level (A1 and A2 by default).
These are the rules it follows. To change one, just ask; they live in the quiz maker
(`supabase/functions/make-quiz/index.ts`, the part called `SYSTEM_PROMPT`).

## Kinds of question

- **Choose the answer**: a sentence with a gap ( ___ ) and 4 options (3 only when there aren't 3 good wrong ones). One is right.
- **Right or wrong?**: one sentence; about half are right.
- **Find the mistake**: a sentence with one mistake; tap the wrong part.

Every question has a level label (A1 or A2) and a one-line "Why" in easy English, shown after the answer.

## Distractors (the wrong options)

A quiz only works if a student who hasn't learnt the grammar can pick a wrong answer, so:

1. **Real learner mistakes with this week's grammar.** For example, present simple: *she go / she going / she is go*;
   past simple vs past continuous: *was walk / walked (where "was walking" is needed) / was walked*.
   Typical errors for the level: A1: missing -s, wrong be/do, word order; A2: wrong past forms, mixing the two
   tenses, irregular verbs made regular.
2. **They look like the right answer**: same kind of word, about the same length, from the same verb where possible,
   so nobody can guess the answer from its look or length.
3. **Each one is clearly wrong.** If a teacher could accept it (another tense that also works, an informal form,
   a different meaning that still makes sense), it is replaced.
4. **No joke options**, nothing from a different grammar point, no "all of the above", no spelling mistakes as
   distractors (unless the grammar is about spelling, e.g. -ed / -ing).
5. **Right or wrong?**: the wrong sentences contain one of these typical mistakes, and the right ones sound just as
   natural, so the answer can't be guessed from how odd a sentence looks.
6. **Find the mistake**: the other parts are correct but tempting (a word next to the mistake, another verb).

## Other rules

- Only the grammar you gave for each level; short sentences and common words that suit the level.
- Exactly one right answer a teacher would agree with; nothing that depends on British vs American English.
- Each quiz uses different everyday topics (food, travel, family, school, …), so the quizzes don't repeat.
- The app mixes the order of the options, so the right one isn't always first.
- No real people, brands or upsetting topics; names from many countries.

You always check the questions before playing: ✏️ change, 🔄 new question, or ✕ remove.
