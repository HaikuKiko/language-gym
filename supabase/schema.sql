-- Language Gym: database setup for Supabase.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run. It is safe to run again.
--
-- Also turn on guest sign-in: Authentication -> Sign In / Providers ->
-- "Allow anonymous sign-ins".

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  -- Short code students type to join.
  code text not null unique,
  host_id uuid not null default auth.uid(),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),

  -- Settings chosen by the host.
  level text not null,
  categories text[] not null,
  round_minutes integer not null check (round_minutes > 0),
  round_count integer not null check (round_count > 0),
  auto_advance boolean not null default false,

  -- Live state while playing.
  round integer not null default 0,
  stage text not null default 'discussion' check (stage in ('changeover', 'discussion')),
  -- The timer is running when ends_at is set, and paused (showing
  -- remaining_ms) when it is null.
  ends_at timestamptz,
  remaining_ms integer,
  -- Who is taking part in the current round: [{ "id": ..., "name": ... }].
  roster jsonb not null default '[]'::jsonb,
  -- Shuffles the questions differently for every session.
  seed integer not null default 0,

  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 1 and 40),
  joined_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists participants_session_id_idx on public.participants (session_id);

-- Row level security: everyone signed in (guests included) can read; only the
-- host can change a session; students can only add or change themselves.
alter table public.sessions enable row level security;
alter table public.participants enable row level security;

drop policy if exists "Signed-in users can read sessions" on public.sessions;
create policy "Signed-in users can read sessions"
  on public.sessions for select to authenticated
  using (true);

drop policy if exists "Users can create their own sessions" on public.sessions;
create policy "Users can create their own sessions"
  on public.sessions for insert to authenticated
  with check (host_id = auth.uid());

drop policy if exists "Hosts can update their sessions" on public.sessions;
create policy "Hosts can update their sessions"
  on public.sessions for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists "Signed-in users can read participants" on public.participants;
create policy "Signed-in users can read participants"
  on public.participants for select to authenticated
  using (true);

drop policy if exists "Users can join as themselves" on public.participants;
create policy "Users can join as themselves"
  on public.participants for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can rename themselves" on public.participants;
create policy "Users can rename themselves"
  on public.participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can leave and hosts can remove" on public.participants;
create policy "Users can leave and hosts can remove"
  on public.participants for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      where s.id = participants.session_id and s.host_id = auth.uid()
    )
  );

grant select, insert, update on public.sessions to authenticated;
grant select, insert, update, delete on public.participants to authenticated;

-- Live updates: send changes to connected phones as they happen.
alter table public.participants replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------
-- Each question belongs to a level (A1-C2) and a topic. The teacher chooses
-- the level and topics when hosting a session.
--
-- Edit these in the Supabase dashboard: Table Editor -> questions. You can add,
-- change or delete rows there, or import a CSV file with the columns
-- level, week, text. Set "active" to false to hide a question without
-- deleting it. The app reads the list when it opens.

create table if not exists public.questions (
  id bigint generated by default as identity primary key,
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic text not null check (char_length(topic) between 1 and 60),
  text text not null check (char_length(text) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists questions_level_topic_idx on public.questions (level, topic);

-- Anyone using the app can read questions; they can only be changed from the
-- Supabase dashboard.
alter table public.questions enable row level security;

drop policy if exists "Anyone can read questions" on public.questions;
create policy "Anyone can read questions"
  on public.questions for select to anon, authenticated
  using (true);

grant select on public.questions to anon, authenticated;

-- Starter questions, added only if the table is empty.
insert into public.questions (level, topic, text)
select * from (values
  ('A1', 'Daily life', 'What do you usually eat for breakfast?'),
  ('A1', 'Daily life', 'Who is in your family?'),
  ('A1', 'Travel', 'Which city or town are you from? What is it like?'),
  ('A1', 'Travel', 'How do you get to class?'),
  ('A1', 'Work & study', 'What is your job, or what do you study?'),
  ('A1', 'Work & study', 'What time do you start work or school?'),
  ('A1', 'Opinions', 'What is your favourite food? Why do you like it?'),
  ('A1', 'Opinions', 'Do you like cats or dogs more?'),
  ('A2', 'Daily life', 'What did you do last weekend?'),
  ('A2', 'Daily life', 'Describe your typical day from morning to night.'),
  ('A2', 'Travel', 'Tell your partner about a trip you enjoyed.'),
  ('A2', 'Travel', 'What do you always take with you when you travel?'),
  ('A2', 'Work & study', 'What was your favourite subject at school? Why?'),
  ('A2', 'Work & study', 'What are you going to do after this class?'),
  ('A2', 'Opinions', 'Is it better to live in a city or in the countryside?'),
  ('A2', 'Opinions', 'What makes a good friend?'),
  ('B1', 'Daily life', 'How has your daily routine changed in the last five years?'),
  ('B1', 'Daily life', 'What do you do to relax after a stressful day?'),
  ('B1', 'Travel', 'If you could visit any country next month, where would you go and why?'),
  ('B1', 'Travel', 'Describe a time when something went wrong on a journey.'),
  ('B1', 'Work & study', 'What would your ideal job be like?'),
  ('B1', 'Work & study', 'What is the most useful thing you have ever learned?'),
  ('B1', 'Opinions', 'Do people spend too much time on their phones?'),
  ('B1', 'Opinions', 'Should children have homework every day?'),
  ('B2', 'Daily life', 'Which habit would you most like to change, and what has stopped you so far?'),
  ('B2', 'Daily life', 'How do you balance what you have to do with what you want to do?'),
  ('B2', 'Travel', 'Does tourism do more good or more harm to the places people visit?'),
  ('B2', 'Travel', 'Would you rather travel alone or with others? What are the trade-offs?'),
  ('B2', 'Work & study', 'Is working from home better for employees, for employers, or for neither?'),
  ('B2', 'Work & study', 'What skills will matter most at work in ten years?'),
  ('B2', 'Opinions', 'Should voting be compulsory?'),
  ('B2', 'Opinions', 'Is it ever acceptable to tell a lie?'),
  ('C1', 'Daily life', 'To what extent do the things we own shape who we are?'),
  ('C1', 'Daily life', 'How has the meaning of "community" changed in your lifetime?'),
  ('C1', 'Travel', 'Can you really understand a culture without speaking its language?'),
  ('C1', 'Travel', 'Is the idea of "authentic" travel a myth?'),
  ('C1', 'Work & study', 'Should universities prepare people for jobs or teach them how to think?'),
  ('C1', 'Work & study', 'What are the hidden costs of a culture that glorifies being busy?'),
  ('C1', 'Opinions', 'Where should the line be drawn between free speech and causing harm?'),
  ('C1', 'Opinions', 'Is economic growth compatible with protecting the environment?'),
  ('C2', 'Daily life', 'Is convenience eroding our capacity for patience, and does it matter if it is?'),
  ('C2', 'Daily life', 'In what ways do everyday rituals quietly hold a society together?'),
  ('C2', 'Travel', 'Does ease of travel homogenise the world or deepen our appreciation of difference?'),
  ('C2', 'Travel', 'Is there an ethical obligation to stay away from fragile destinations?'),
  ('C2', 'Work & study', 'If machines could do all necessary work, what would give human effort its value?'),
  ('C2', 'Work & study', 'Is meritocracy an achievable ideal or a comforting fiction?'),
  ('C2', 'Opinions', 'Can moral progress be measured, and if so, by whose standards?'),
  ('C2', 'Opinions', 'Are we responsible for the unintended consequences of our good intentions?')
) as starter (level, topic, text)
where not exists (select 1 from public.questions);

-- ---------------------------------------------------------------------------
-- Syllabus: 16 weeks per level
-- ---------------------------------------------------------------------------
-- Each level is divided into 16 weeks, and each week has a topic and a
-- grammar focus. The teacher picks the level and week when hosting.
--
-- Edit these in the Supabase dashboard: Table Editor -> weeks. Change the
-- "topic" and "grammar" cells for any level and week.

create table if not exists public.weeks (
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  week integer not null check (week between 1 and 16),
  topic text not null check (char_length(topic) between 1 and 80),
  grammar text not null default '' check (char_length(grammar) <= 200),
  primary key (level, week)
);

alter table public.weeks enable row level security;

drop policy if exists "Anyone can read weeks" on public.weeks;
create policy "Anyone can read weeks"
  on public.weeks for select to anon, authenticated
  using (true);

grant select on public.weeks to anon, authenticated;

-- Draft plan, added only if the table is empty.
insert into public.weeks (level, week, topic, grammar)
select * from (values
  ('A1', 1, 'Greetings and introductions', 'be: am / is / are'),
  ('A1', 2, 'Countries and nationalities', 'be: questions and negatives'),
  ('A1', 3, 'Family', 'Possessive adjectives and ''s'),
  ('A1', 4, 'Everyday objects', 'a / an, plurals, this / that / these / those'),
  ('A1', 5, 'Daily routines', 'Present simple: I / you / we / they'),
  ('A1', 6, 'Free time', 'Present simple: he / she / it'),
  ('A1', 7, 'Food and drink', 'Countable and uncountable nouns, some / any'),
  ('A1', 8, 'Home', 'there is / there are'),
  ('A1', 9, 'Places in town', 'Prepositions of place'),
  ('A1', 10, 'Times and dates', 'Prepositions of time: in / on / at'),
  ('A1', 11, 'Abilities and hobbies', 'can / can''t'),
  ('A1', 12, 'Likes and dislikes', 'like / love / hate + -ing'),
  ('A1', 13, 'Clothes and shopping', 'Present continuous'),
  ('A1', 14, 'Weather and seasons', 'Adverbs of frequency'),
  ('A1', 15, 'Yesterday', 'was / were'),
  ('A1', 16, 'Weekends and holidays', 'Past simple: regular verbs'),
  ('A2', 1, 'Life stories', 'Past simple: regular and irregular verbs'),
  ('A2', 2, 'Travel and transport', 'Past simple: questions and negatives'),
  ('A2', 3, 'Childhood memories', 'Past continuous'),
  ('A2', 4, 'Food and restaurants', 'Quantifiers: much / many / a lot of'),
  ('A2', 5, 'Shopping', 'Comparative adjectives'),
  ('A2', 6, 'Cities and countries', 'Superlative adjectives'),
  ('A2', 7, 'Plans and weekends', 'be going to'),
  ('A2', 8, 'Predictions and weather', 'will / won''t'),
  ('A2', 9, 'Experiences', 'Present perfect with ever / never'),
  ('A2', 10, 'Health and the body', 'should / shouldn''t'),
  ('A2', 11, 'Rules at work and school', 'have to / don''t have to / must'),
  ('A2', 12, 'Technology and gadgets', 'Present perfect with just / already / yet'),
  ('A2', 13, 'Jobs', 'Verb + -ing or to + infinitive'),
  ('A2', 14, 'Entertainment and media', 'Adjectives and adverbs of manner'),
  ('A2', 15, 'Nature and animals', 'First conditional'),
  ('A2', 16, 'Invitations and arrangements', 'Present continuous for future arrangements'),
  ('B1', 1, 'Getting to know you', 'Present simple and continuous, state verbs'),
  ('B1', 2, 'Travel stories', 'Narrative tenses: past simple, past continuous, past perfect'),
  ('B1', 3, 'Life experiences', 'Present perfect and past simple'),
  ('B1', 4, 'Work and careers', 'Present perfect continuous with for / since'),
  ('B1', 5, 'Future plans', 'will, be going to, present continuous'),
  ('B1', 6, 'Education', 'Modals of obligation and advice'),
  ('B1', 7, 'Health and lifestyle', 'Zero and first conditionals'),
  ('B1', 8, 'Money', 'Second conditional'),
  ('B1', 9, 'Media and news', 'Passive: present and past'),
  ('B1', 10, 'Technology', 'Defining relative clauses'),
  ('B1', 11, 'The environment', 'will / may / might for predictions'),
  ('B1', 12, 'Childhood and change', 'used to / would'),
  ('B1', 13, 'Relationships', 'Reported speech: statements'),
  ('B1', 14, 'Food culture', 'Comparisons: as ... as, much / far + comparative'),
  ('B1', 15, 'Crime and rules', 'Modals of deduction: must / might / can''t'),
  ('B1', 16, 'Entertainment', 'Gerunds and infinitives'),
  ('B2', 1, 'Identity and personality', 'Present habits: tend to, will, keep + -ing'),
  ('B2', 2, 'Memorable journeys', 'Narrative tenses including past perfect continuous'),
  ('B2', 3, 'Work-life balance', 'Future continuous and future perfect'),
  ('B2', 4, 'Science and discovery', 'Passive in all tenses, have something done'),
  ('B2', 5, 'Regrets and decisions', 'Third conditional'),
  ('B2', 6, 'What if?', 'Mixed conditionals'),
  ('B2', 7, 'Media and truth', 'Reported speech and reporting verbs'),
  ('B2', 8, 'Consumerism', 'Non-defining and reduced relative clauses'),
  ('B2', 9, 'Health and medicine', 'Past modals: should have / could have'),
  ('B2', 10, 'Mysteries', 'Past modals of deduction'),
  ('B2', 11, 'Sustainability', 'wish / if only'),
  ('B2', 12, 'Cities and housing', 'Articles and quantifiers'),
  ('B2', 13, 'Arts and culture', 'Gerund or infinitive with a change of meaning'),
  ('B2', 14, 'Technology and society', 'Contrast and concession: although, despite, however'),
  ('B2', 15, 'Education and learning', 'used to / be used to / get used to'),
  ('B2', 16, 'Communication and manners', 'Indirect questions and question tags'),
  ('C1', 1, 'Language and identity', 'Aspect: perfect and continuous forms'),
  ('C1', 2, 'Work and ambition', 'Future forms: be about to, be due to, be bound to'),
  ('C1', 3, 'Ethics and dilemmas', 'Mixed and inverted conditionals'),
  ('C1', 4, 'Media and influence', 'Passive reporting: is said to, is believed to'),
  ('C1', 5, 'Science and progress', 'Cleft sentences: What ..., It is ... that'),
  ('C1', 6, 'Memory and the past', 'Participle clauses'),
  ('C1', 7, 'Politics and power', 'Inversion after negative adverbials'),
  ('C1', 8, 'Money and inequality', 'Hedging and distancing: seem, appear, tend'),
  ('C1', 9, 'Psychology and behaviour', 'Modals of speculation, present and past'),
  ('C1', 10, 'Environment and responsibility', 'Unreal past: wish, it''s time, would rather'),
  ('C1', 11, 'Culture and globalisation', 'Relative clauses with prepositions and quantifiers'),
  ('C1', 12, 'Art and creativity', 'Ellipsis and substitution'),
  ('C1', 13, 'Technology and privacy', 'Formal discourse markers'),
  ('C1', 14, 'Education and success', 'Perfect and passive gerunds and infinitives'),
  ('C1', 15, 'Health and well-being', 'Emphasis: do / did, intensifiers'),
  ('C1', 16, 'The future of society', 'Nominalisation'),
  ('C2', 1, 'Language and thought', 'Nuanced tense and aspect choices'),
  ('C2', 2, 'Truth and knowledge', 'Epistemic modality and hedging'),
  ('C2', 3, 'Justice and law', 'Subjunctive and formal mandative structures'),
  ('C2', 4, 'Power and persuasion', 'Rhetorical devices and emphatic inversion'),
  ('C2', 5, 'Ethics of technology', 'Advanced conditionals: but for, were it not for, supposing'),
  ('C2', 6, 'Identity and belonging', 'Fronting and marked word order'),
  ('C2', 7, 'Economics and value', 'Nominalisation and dense noun phrases'),
  ('C2', 8, 'Art and interpretation', 'Metaphor, idiom and connotation'),
  ('C2', 9, 'History and memory', 'Future in the past, perfect infinitives'),
  ('C2', 10, 'Science and uncertainty', 'Concession: albeit, notwithstanding, much as'),
  ('C2', 11, 'Media and manipulation', 'Reporting with stance and distancing'),
  ('C2', 12, 'Humour and irony', 'Understatement and register shifts'),
  ('C2', 13, 'Nature and humanity', 'Participle and verbless clauses'),
  ('C2', 14, 'Work and meaning', 'Ellipsis, substitution and cohesion'),
  ('C2', 15, 'Globalisation and culture', 'Complex relative and cleft structures'),
  ('C2', 16, 'The human condition', 'Style, register and precision')
) as draft (level, week, topic, grammar)
where not exists (select 1 from public.weeks);

-- Questions can belong to a week. Questions with no week are general
-- questions for the level, used when a week has none of its own yet. The
-- "topic" column on questions is now optional; the week carries the topic.
alter table public.questions add column if not exists week integer check (week between 1 and 16);
alter table public.questions alter column topic set default 'General';
create index if not exists questions_level_week_idx on public.questions (level, week);

-- The week the teacher chose for a session (empty means any week).
alter table public.sessions add column if not exists week integer check (week between 1 and 16);


-- ---------------------------------------------------------------------------
-- Grammar help for each week (shown on the students' screens)
-- ---------------------------------------------------------------------------
-- use:      what the grammar is for, in a few words
-- pattern:  the form, e.g. "[If + past simple], {would + verb}"
-- examples: example sentences, one per line
-- starter:  a sentence starter, e.g. "[If I …], I {would} …"
-- Text in [square brackets] is highlighted in orange and text in
-- {curly brackets} in blue, so the parts of the pattern can be matched to the
-- same parts in the examples. Edit these cells in Table Editor -> weeks.

alter table public.weeks add column if not exists use text not null default '';
alter table public.weeks add column if not exists pattern text not null default '';
alter table public.weeks add column if not exists examples text not null default '';
alter table public.weeks add column if not exists starter text not null default '';

-- Draft help, filled in only for weeks that have none yet.
update public.weeks w
set use = d.use, pattern = d.pattern, examples = d.examples, starter = d.starter
from (values
  ('A1', 1, 'Talk about who you are', 'I [am] · you / we / they [are] · he / she / it [is]', 'I [am] a student.
She [is] my teacher.
We [are] in class 3.', 'Hi, I [am] … and I [am] from …'),
  ('A1', 2, 'Ask and answer about people and places', '[Are] you …? · I [am not] …', '[Are] you from Morocco?
[Is] she a teacher? No, she [isn''t].
I [am not] from Paris.', '[Are] you from …?'),
  ('A1', 3, 'Say who people and things belong to', '[my · your · his · her · our · their] + noun · name + {''s}', 'This is [my] brother.
[Her] name is Sara.
Tom{''s} sister is a doctor.', '[My] family is …'),
  ('A1', 4, 'Name things near and far', '[a] book · [an] apple · {this / these} here · {that / those} there', '{This} is [a] pen.
{Those} are my keys.
Is {that} [an] umbrella?', '{This} is [a] …'),
  ('A1', 5, 'Talk about your routine', 'I / you / we / they + [verb]', 'I [get up] at seven.
We [have] lunch at one.
They [don''t work] on Sundays.', 'Every morning I [ … ]'),
  ('A1', 6, 'Talk about other people''s habits', 'he / she / it + verb{-s}', 'She play{s} tennis on Saturdays.
My brother watch{es} films every night.
He [doesn''t like] football.', 'My friend like{s} …'),
  ('A1', 7, 'Talk about food you have or need', '[some] in positive sentences · {any} in questions and negatives', 'I have [some] eggs.
Is there {any} milk?
We don''t have {any} bread.', 'In my fridge there is [some] …'),
  ('A1', 8, 'Describe a place', '[There is] + one thing · {There are} + two or more', '[There is] a sofa in my living room.
{There are} two bedrooms.
[Is there] a garden?', 'In my home [there is] …'),
  ('A1', 9, 'Say where things are', '[in] · [on] · [next to] · [between] · [opposite]', 'The bank is [next to] the café.
The keys are [on] the table.
The school is [opposite] the park.', 'My house is [near] …'),
  ('A1', 10, 'Say when things happen', '[at] + time · [on] + day · [in] + month or year', 'Class starts [at] nine o''clock.
My birthday is [in] May.
I see my friends [on] Fridays.', '[On] Saturdays I …'),
  ('A1', 11, 'Talk about what you can do', '[can] / {can''t} + verb', 'I [can] swim.
She {can''t} drive.
[Can] you cook?', 'I [can] … but I {can''t} …'),
  ('A1', 12, 'Talk about likes and dislikes', '[like / love / hate] + {verb-ing}', 'I [love] {reading} books.
He [hates] {getting up} early.
Do you [like] {cooking}?', 'I [love] {…ing} because …'),
  ('A1', 13, 'Describe what is happening now', '[am / is / are] + {verb-ing}', 'I [am] {wearing} a blue jacket.
She [is] {buying} new shoes.
What [are] you {doing}?', 'Right now I [am] {…ing} …'),
  ('A1', 14, 'Say how often you do things', '[always · usually · often · sometimes · never] + verb', 'It [often] rains in November.
I [never] go to the beach in winter.
Do you [usually] take an umbrella?', 'In summer I [usually] …'),
  ('A1', 15, 'Talk about yesterday', 'I / he / she / it [was] · you / we / they {were}', 'I [was] at home yesterday.
We {were} tired after work.
Where {were} you on Sunday?', 'Yesterday I [was] …'),
  ('A1', 16, 'Say what you did', 'verb + [-ed]', 'I play[ed] football on Saturday.
We visit[ed] my uncle.
She stay[ed] at home and cook[ed].', 'Last weekend I …[ed] …'),
  ('A2', 1, 'Tell your life story', 'regular: [worked, lived] · irregular: {went, had, met}', 'I [lived] in Fes for ten years.
I {went} to school in Rabat.
My parents {met} in 1995.', 'When I was a child, I [lived] …'),
  ('A2', 2, 'Ask and talk about trips', '[Did] + you + verb? · I {didn''t} + verb', '[Did] you take the train?
We {didn''t} have a car.
How long [did] the journey take?', '[Did] you ever travel by …?'),
  ('A2', 3, 'Set the scene in the past', '[was / were] + {verb-ing}', 'I [was] {playing} outside when it started to rain.
We [were] {living} in a small flat.
What [were] you {doing} at eight o''clock?', 'When I was ten, I [was] {…ing} …'),
  ('A2', 4, 'Say how much or how many', '[much] + uncountable · {many} + plural', '[How much] water do you drink?
{How many} cafés are near your home?
There aren''t {many} cheap restaurants here.', 'I don''t eat [much] …'),
  ('A2', 5, 'Compare two things', 'short adjective + [-er than] · {more} + long adjective + [than]', 'This shop is cheap[er than] that one.
Online shopping is {more} convenient [than] going out.
Is it bett[er than] the old one?', 'I think … is bett[er than] …'),
  ('A2', 6, 'Say which is the most', '[the] + adjective{-est} · [the most] + long adjective', 'Casablanca is [the] bigg{est} city in Morocco.
Chefchaouen is [the most] beautiful town I know.
What''s [the] b{est} city to visit?', '[The most] interesting place I know is …'),
  ('A2', 7, 'Talk about your plans', '[am / is / are going to] + {verb}', 'I''m [going to] {visit} my cousins.
We''re [going to] {have} a picnic.
What are you [going to] {do} on Saturday?', 'This weekend I''m [going to] …'),
  ('A2', 8, 'Make predictions', '[will] / {won''t} + verb', 'It [will] be sunny tomorrow.
I think it {won''t} rain.
[Will] you need a coat?', 'I think tomorrow it [will] …'),
  ('A2', 9, 'Talk about experiences', '[have / has] + past participle · {ever} / {never}', '[Have] you {ever} eaten snails?
I [have] {never} been to Spain.
She [has] climbed Toubkal.', 'I [have] {never} …'),
  ('A2', 10, 'Give advice', '[should] / {shouldn''t} + verb', 'You [should] drink more water.
You {shouldn''t} stay up so late.
What [should] I do for a headache?', 'If you feel tired, you [should] …'),
  ('A2', 11, 'Talk about rules', '[have to / must] = necessary · {don''t have to} = not necessary', 'We [have to] wear a uniform.
You [must] switch off your phone in class.
I {don''t have to} work on Fridays.', 'At my school we [have to] …'),
  ('A2', 12, 'Talk about recent news', '[have / has] + {just / already} + participle · [haven''t] … {yet}', 'I[''ve] {just} bought a new phone.
She[''s] {already} downloaded the app.
I [haven''t] updated it {yet}.', 'I[''ve] {just} …'),
  ('A2', 13, 'Talk about work you enjoy or want', '[enjoy / finish] + -ing · {want / hope / decide} + to + verb', 'I [enjoy working] with people.
She {wants to become} a nurse.
I {hope to find} a better job.', 'In the future I {want to} …'),
  ('A2', 14, 'Describe how things are done', 'adjective: a [good] singer · adverb: sings {well}', 'She is a [careful] driver. She drives {carefully}.
The film was [slow] but {beautifully} filmed.
He speaks English {fluently}.', 'My favourite series is [exciting] because …'),
  ('A2', 15, 'Talk about real possibilities', '[If + present], {will + verb}', '[If it''s sunny tomorrow], we {will go} to the park.
[If we cut down the forests], animals {will lose} their homes.
What {will} you do [if it rains]?', '[If the weather is nice this weekend], I {will} …'),
  ('A2', 16, 'Talk about fixed plans', '[am / is / are] + {verb-ing} + a time', 'I''m {meeting} Sara on Friday.
We''re {having} a party on Saturday.
[Are] you {doing} anything tonight?', 'On Saturday I''m {…ing} …'),
  ('B1', 1, 'Talk about habits and what''s happening now', 'habit: [I work] · now: {I''m working} · state verbs: know, like, believe', 'I [usually work] from home.
This week {I''m working} in the office.
I know exactly what you mean.', 'Normally I [ … ], but these days {I''m …ing} …'),
  ('B1', 2, 'Tell a story about the past', '[past continuous] for the background · {past simple} for the events', 'We [were driving] to Agadir when the car {broke down}.
It [was raining], so we {stopped} at a café.
I {realised} I had left my passport at home.', 'I [was …ing] when suddenly …'),
  ('B1', 3, 'Talk about experiences and when they happened', '[have + participle] = experience · {past simple} = a finished time', 'I [have been] to Istanbul twice.
I {went} there in 2022.
[Have] you ever [lost] your luggage? What {happened}?', 'I [have] … , and it {was} …'),
  ('B1', 4, 'Say how long something has been going on', '[have been + -ing] + {for / since}', 'I [have been working] here {for} three years.
She [has been studying] medicine {since} 2023.
How long [have] you [been learning] English?', 'I [have been] …ing {for} …'),
  ('B1', 5, 'Talk about predictions, plans and arrangements', '[will] = prediction · {going to} = plan · I''m meeting = arrangement', 'I think I [will] change jobs one day.
I''m {going to} start a course next month.
I''m meeting my teacher on Tuesday.', 'Next year I''m {going to} …'),
  ('B1', 6, 'Talk about rules and give advice', '[must / have to] = obligation · {should} = advice · don''t have to = no need', 'Students [must] attend 80% of classes.
You {should} revise a little every day.
We don''t have to wear a uniform.', 'In my opinion, students {should} …'),
  ('B1', 7, 'Talk about results that are always or likely true', '[If + present], {present} = always · [If + present], {will + verb} = likely', '[If you don''t sleep], you {feel} tired.
[If I join a gym], I{''ll get} fitter.
What {will} you do [if you get ill]?', '[If I …], I{''ll} …'),
  ('B1', 8, 'Talk about imaginary or unlikely situations', '[If + past simple], {would + verb}', '[If I won] a lot of money, I {would buy} a house by the sea.
[If I had] more time, I{''d travel} more.
What {would} you {do} [if you lost] your phone?', '[If I …], I {would} …'),
  ('B1', 9, 'Say what is done, not who does it', '[am / is / are / was / were] + {past participle}', 'The news [is] {watched} by millions.
This article [was] {written} by a student.
Most news [is] {read} on phones now.', 'In my country, most news [is] {…}'),
  ('B1', 10, 'Say exactly which person or thing', 'person: [who] · thing: {which / that}', 'My cousin is the person [who] fixes my laptop.
A smartphone is a phone {that} connects to the internet.
I need an app {which} helps me sleep.', 'I can''t live without an app {that} …'),
  ('B1', 11, 'Say how sure you are about the future', '[will] = sure · {may / might} = possible', 'Sea levels [will] rise.
We {might} have hotter summers.
Cars {may} use less petrol in the future.', 'In twenty years, cities {might} …'),
  ('B1', 12, 'Talk about past habits', '[used to] + verb · {would} + verb (repeated actions)', 'I [used to] live in the countryside.
Every summer we {would} visit my grandparents.
Did you [use to] like school?', 'When I was a child, I [used to] …'),
  ('B1', 13, 'Tell someone what another person said', '[said / told me] + tense moves back: is → {was}, will → {would}', 'She [said] she {was} tired.
He [told me] he {would} call later.
My friend [said] she {had} met someone new.', 'My best friend once [told me] that …'),
  ('B1', 14, 'Compare in more detail', '[as + adjective + as] · {much / far} + comparative', 'Moroccan bread is [as good as] French bread.
Street food is {far cheaper} than restaurant food.
Cooking at home isn''t [as quick as] ordering.', 'Home cooking is {much} … than …'),
  ('B1', 15, 'Guess what is true', '[must] = I''m sure it''s true · {can''t} = I''m sure it''s not true · might = maybe', 'He [must] be the thief: he was there.
She {can''t} be guilty: she was abroad.
Someone might have a key.', 'The person {can''t} be … because …'),
  ('B1', 16, 'Talk about free time and preferences', '[enjoy / mind / avoid] + -ing · {want / plan / decide} + to + verb', 'I [enjoy watching] horror films.
We {decided to see} a concert.
I [don''t mind waiting] for tickets.', 'I [really enjoy] …ing, but I don''t {want to} …'),
  ('B2', 1, 'Describe typical behaviour', '[tend to] + verb · {will} + verb (habit) · keep + -ing', 'I [tend to] get nervous before exams.
My brother {will} talk for hours about football.
She keeps forgetting her keys.', 'I [tend to] … when …'),
  ('B2', 2, 'Show what had been happening before', '[had been + -ing] before a {past simple} event', 'We [had been travelling] for twelve hours when we {arrived}.
I [had been waiting] so long that I {fell} asleep.
She {was} tired because she [had been driving] all night.', 'We [had been] …ing for … when …'),
  ('B2', 3, 'Picture your life at a point in the future', '[will be + -ing] = in progress · {will have + participle} = finished', 'This time next year I [will be working] abroad.
By 2030 I {will have paid} off my loan.
At 9 p.m. I [will be relaxing] at home.', 'In five years I {will have} … and I [will be] …ing …'),
  ('B2', 4, 'Focus on the action or a service', '[be + past participle] in any tense · {have something + participle}', 'A new vaccine [has been developed].
The results [will be published] next month.
I {had my eyes tested} last week.', 'Recently, a … [has been] …'),
  ('B2', 5, 'Talk about past regrets', '[If + had + participle], {would have + participle}', '[If I had studied harder], I {would have passed}.
[If we had left earlier], we {wouldn''t have missed} the flight.
What {would} you {have done} [if you had known]?', '[If I had …], I {would have} …'),
  ('B2', 6, 'Link the past and the present in imaginary situations', '[If + had + participle] (past), {would + verb} (now)', '[If I had learned Chinese], I {would be} working in Shanghai now.
[If I hadn''t moved], I {would} still {live} with my parents.
Where {would} you live [if you had been born] elsewhere?', '[If I had …], I {would} … now.'),
  ('B2', 7, 'Report what was said, and how', '[said / told] + clause · {claimed / denied / admitted / promised}', 'The minister [said] that prices would fall.
He {denied} lying to the press.
The paper {claimed} the story was true.', 'A journalist recently {claimed} that …'),
  ('B2', 8, 'Add extra information', ', [which / who] …, · short form: {-ing / -ed} phrase', 'My phone, [which] I bought last year, already feels old.
People {buying} online often spend more.
Clothes {made} cheaply don''t last.', 'My favourite brand, [which] …, …'),
  ('B2', 9, 'Criticise or regret the past', '[should have / could have] + {past participle}', 'I [should have] {seen} a doctor sooner.
You [could have] {told} me you were ill!
They [shouldn''t have] {ignored} the symptoms.', 'I [should have] … when …'),
  ('B2', 10, 'Guess what happened', '[must / might / can''t] + {have + participle}', 'They [must] {have left} in a hurry.
The ship [might] {have hit} a rock.
He [can''t] {have known} about it.', 'I think they [must] {have} …'),
  ('B2', 11, 'Talk about changes you wish for', '[wish / if only] + {past} (now) · + {would} (other people)', 'I [wish] people {recycled} more.
[If only] the government {would} act.
I [wish] I {didn''t} use so much plastic.', 'I [wish] my city {…}'),
  ('B2', 12, 'Talk about places in general and specific terms', '[a / the / no article] · {few / a few / little / a little}', '[The] rent in [the] city centre is high.
There are {few} parks near me.
{A little} more green space would help.', 'What my city needs is {a few} more …'),
  ('B2', 13, 'Use verbs that change meaning', '[remember / stop / try] + -ing vs {+ to + verb}', 'I [remember seeing] that painting as a child.
Please {remember to buy} the tickets.
We [stopped talking] when the music started.', 'I''ll never forget [seeing] …'),
  ('B2', 14, 'Balance two sides of an argument', '[although] + clause · {despite} + noun or -ing · however, …', '[Although] phones connect us, they can isolate us.
{Despite} its benefits, AI worries many people.
Social media is useful. However, it can be addictive.', '[Although] technology …, …'),
  ('B2', 15, 'Talk about past habits and getting used to things', '[used to] + verb (past) · {be / get used to} + -ing (familiar)', 'I [used to] hate studying.
I''m {used to working} late now.
It took me a year to {get used to studying} online.', 'When I started …, I couldn''t {get used to} …'),
  ('B2', 16, 'Ask politely and check information', '[Could you tell me] + where it is? · …, {isn''t it?}', '[Could you tell me] where the station is?
[Do you know] what time it starts?
It''s rude to be late, {isn''t it?}', '[Do you know] whether …?'),
  ('C1', 1, 'Choose simple, continuous or perfect for meaning', '[continuous] = in progress · {perfect} = up to a point', 'I [have been thinking] about my accent lately.
By the time I moved, I {had lost} my local dialect.
I''m [living] in London, but I {have never felt} English.', 'Lately I [have been] …'),
  ('C1', 2, 'Talk about imminent and expected events', '[be about to] = very soon · {be due to} = scheduled · be bound to = certain', 'I''m [about to] start a new role.
The report is {due to} be published in May.
With her talent, she''s bound to succeed.', 'In my field, things are bound to …'),
  ('C1', 3, 'Discuss hypotheticals formally', '[Had I known] … · {Were it} … · Should you …', '[Had I known] the truth, I would have refused.
{Were it} legal, would you do it?
Should you find a wallet, what would you do?', '[Had I been] in that situation, I would …'),
  ('C1', 4, 'Report beliefs and claims impersonally', '[It is said that] … · subject + {is said to} + verb', '[It is believed that] influencers shape opinions.
The app {is said to} track users.
The CEO {is thought to have} resigned.', '[It is often said that] the media …'),
  ('C1', 5, 'Emphasise one part of what you say', '[What] … is … · {It was} … that …', '[What] worries me is the speed of change.
{It was} vaccines that changed everything.
[What] we need is more funding.', '[What] fascinates me about science is …'),
  ('C1', 6, 'Combine ideas concisely', '[-ing] clause (same time) · {Having + participle} (earlier)', '[Walking] through my old school, I felt twelve again.
{Having left} home young, I remember little.
[Asked] about her childhood, she smiled.', '[Looking] back, I …'),
  ('C1', 7, 'Make strong, formal statements', '[Never / Rarely / Not only] + {auxiliary} + subject', '[Never] {have} politicians been so distrusted.
[Not only] {did} they lie, but they also hid evidence.
[Rarely] {does} a leader admit a mistake.', '[Rarely] {do} we see …'),
  ('C1', 8, 'Make careful, softened claims', '[seem / appear / tend] + to · {it could be argued that}', 'Inequality [appears to] be growing.
{It could be argued that} taxes are too low.
The wealthy [tend to] save more.', '{It could be argued that} money …'),
  ('C1', 9, 'Speculate about behaviour', '[may / might / could] + verb · {may / might / could} + have + participle', 'He [might] be anxious rather than rude.
She {could have} misunderstood.
People [may] act differently online.', 'Perhaps they {might have} …'),
  ('C1', 10, 'Express regret, urgency and preference', '[wish / it''s time] + past · {would rather} + past', '[It''s time] we took climate change seriously.
I [wish] we consumed less.
I''d {rather} governments acted now.', '[It''s high time] we …'),
  ('C1', 11, 'Write precise, formal descriptions', '[in which / to whom] · {most of which / some of whom}', 'The culture [in which] I grew up valued family.
I met many travellers, {most of whom} spoke English.
The festival, [to which] thousands come, is famous.', 'The tradition [in which] I …'),
  ('C1', 12, 'Avoid repeating words', '[so / not] · {do / one}', 'Can art be taught? I think [so].
I wanted to paint, but I never {did}.
I prefer the darker {one}.', 'Some people say … I don''t think [so], because …'),
  ('C1', 13, 'Structure an argument', '[Furthermore / Moreover] · {Nevertheless / Conversely} · Consequently', 'Data is valuable. [Moreover], it is easy to steal.
Apps are free. {Nevertheless}, we pay with our privacy.
Consequently, regulation is needed.', 'Privacy matters. [Furthermore], …'),
  ('C1', 14, 'Talk about achievements and recognition', '[having + participle] · {to be + participle} · to have + participle', 'I''m proud of [having passed] my exams.
Everyone wants {to be appreciated}.
She seems to have succeeded early.', 'I''m proud of [having] …'),
  ('C1', 15, 'Add strong emphasis', '[do / did] + verb · {by far / utterly / truly}', 'I [do] try to sleep eight hours.
That was {by far} the hardest year.
It''s {truly} vital to rest.', 'I [do] believe that …'),
  ('C1', 16, 'Sound formal and analytical', 'verb → noun: grow → [growth] · decide → {decision}', 'The [growth] of cities brings challenges.
The {decision} to automate cost jobs.
There has been a sharp [increase] in remote work.', 'The [rise] of … will …'),
  ('C2', 1, 'Shade meaning through tense', '[was wondering] = tentative · {have come to} = gradual change', 'I [was wondering] whether language shapes thought.
I {have come to} believe it does.
We [are forever] translating our thoughts.', 'I {have come to} realise that …'),
  ('C2', 2, 'Signal exactly how certain you are', '[may well / is likely to] · {arguably / presumably}', 'This [may well] be the best explanation.
It is, {arguably}, unprovable.
Scientists [are likely to] disagree.', 'It [may well] be that …'),
  ('C2', 3, 'Express demands and recommendations formally', '[insist / recommend / it is essential] that + {base verb}', 'The judge [insisted that] he {be} released.
[It is vital that] every citizen {have} a lawyer.
They [recommended that] the law {be} changed.', '[I would propose that] the law {be} …'),
  ('C2', 4, 'Persuade with structure', '[So / Such] … that · {Little did} they know · three-part lists', '[So] powerful was the speech that people wept.
{Little did} voters know what was coming.
We will listen, we will learn, we will act.', '[Never before] has …'),
  ('C2', 5, 'Explore alternatives precisely', '[But for / Were it not for] + noun · {Supposing / Provided that}', '[But for] the internet, AI couldn''t exist.
[Were it not for] regulation, data would be sold.
{Supposing} machines became conscious, what then?', '[Were it not for] technology, …'),
  ('C2', 6, 'Shift focus by changing word order', '[object or adjective] first + subject + verb · {… as it may seem}', '[This feeling] I have never lost.
[Strange] {as it may seem}, I feel at home abroad.
[Home] is where I''m understood.', '[Odd] {as it may sound}, …'),
  ('C2', 7, 'Pack ideas into precise noun phrases', '[the + noun] + {of / for} + noun phrase', '[The undervaluation] {of} care work is striking.
[The pursuit] {of} profit at all costs harms trust.
Unequal access {to} housing is a growing concern.', '[The commodification] {of} …'),
  ('C2', 8, 'Interpret and use figurative language', '[metaphor] · {idiom} · words with a positive or negative feel', 'Art is [a mirror] held up to society.
The critics {tore the play to shreds}.
Is it ''bold'' or ''reckless''?', 'For me, art is [a …] because …'),
  ('C2', 9, 'Describe the past from an earlier point of view', '[was to / would] = what happened later · {to have + participle}', 'Nobody knew the war [was to] last six years.
The empire [would] soon collapse.
The city is said {to have been} founded in 789.', 'At the time, nobody knew that … [would] …'),
  ('C2', 10, 'Concede a point formally', '[albeit / notwithstanding] · {much as} + clause', 'The results were promising, [albeit] limited.
{Much as} I respect the data, I doubt the method.
[Notwithstanding] the risks, research continues.', '{Much as} I trust science, …'),
  ('C2', 11, 'Show your attitude to a source', '[allegedly / purportedly] · {claims / concedes / insists}', 'The leak [allegedly] came from inside.
The paper {concedes} it made errors.
The images were [purportedly] taken in March.', 'The article {claims} … , but …'),
  ('C2', 12, 'Use understatement and tone', '[not exactly / a tad] = understatement · {ironic praise}', 'The meeting was [not exactly] a success.
Losing my luggage was [a tad] inconvenient.
''{Brilliant},'' she said, as it began to pour.', 'It was [not exactly] …'),
  ('C2', 13, 'Write vivid, compact description', '[-ing / -ed] clause · {verbless}: adjective or noun phrase', '[Shrouded in mist], the valley looked untouched.
{Exhausted but happy}, we reached the summit.
[Left alone], nature recovers.', '[Surrounded by] …, I …'),
  ('C2', 14, 'Connect a long argument smoothly', '[the former / the latter / this] · {do so / one}', 'Some work for money, others for meaning; [the latter] are happier.
Many want to quit, but few {do so}.
[This] is why purpose matters.', '[The former] … whereas [the latter] …'),
  ('C2', 15, 'Build complex, precise sentences', '[It is … that] · {whereby / whose}', '[It is] local culture [that] suffers most.
Global brands create a system {whereby} traditions fade.
Cities {whose} identity is fading need protection.', '[It is not] … [that] …, but …'),
  ('C2', 16, 'Choose exactly the right word and tone', '[formal] vs {informal} · precise vocabulary', 'We must [endeavour] to understand one another.
Life''s {a rollercoaster}, isn''t it?
Happiness is less a destination than a practice.', 'To my mind, the human condition is …')
) as d (level, week, use, pattern, examples, starter)
where w.level = d.level and w.week = d.week
  and w.pattern = '' and w.examples = '' and w.starter = '' and w.use = '';
