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

-- Starting plan, added only if the table is empty: the school's 16 weekly
-- themes (the same at every level) and each level's main grammar point.
insert into public.weeks (level, week, topic, grammar)
select * from (values
  ('A1', 1, 'People & Places', 'be: am / is / are'),
  ('A1', 2, 'You, Yours & Opinions', 'this / that / these / those'),
  ('A1', 3, 'Everyday Life & Experiences', 'Present simple: I / you / we / they'),
  ('A1', 4, 'Loves, Hates & Feelings', 'Present simple: he / she / it'),
  ('A1', 5, 'Travel & Nature', 'can / can’t'),
  ('A1', 6, 'Eating & Drinking', 'there is / there are'),
  ('A1', 7, 'Extraordinary People', 'Past simple: was / were'),
  ('A1', 8, 'Fact or Fiction & Homes', 'Past simple: negatives and questions'),
  ('A1', 9, 'Buying & Selling', 'Comparative adjectives'),
  ('A1', 10, 'Love & Relationships', 'Past continuous'),
  ('A1', 11, 'Street Life & Technology', 'Present continuous'),
  ('A1', 12, 'The World Around Us', 'Question words'),
  ('A1', 13, 'Weekends Away & Free Time', 'going to'),
  ('A1', 14, 'Learning & Studying', 'have to / don’t have to'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Present perfect'),
  ('A1', 16, 'Going Places', 'Prepositions of movement'),
  ('A2', 1, 'People & Places', 'Question forms'),
  ('A2', 2, 'You, Yours & Opinions', 'Possessive pronouns and whose'),
  ('A2', 3, 'Everyday Life & Experiences', 'Present perfect with ever / never'),
  ('A2', 4, 'Loves, Hates & Feelings', 'Verb + -ing or to + infinitive'),
  ('A2', 5, 'Travel & Nature', 'will / won''t for predictions'),
  ('A2', 6, 'Eating & Drinking', 'much / many / a few / a little'),
  ('A2', 7, 'Extraordinary People', 'Past simple and past continuous'),
  ('A2', 8, 'Fact or Fiction & Homes', 'used to'),
  ('A2', 9, 'Buying & Selling', 'Comparatives and superlatives'),
  ('A2', 10, 'Love & Relationships', 'Present perfect with for / since'),
  ('A2', 11, 'Street Life & Technology', 'Present perfect with just / already / yet'),
  ('A2', 12, 'The World Around Us', 'Present simple passive'),
  ('A2', 13, 'Weekends Away & Free Time', 'going to and present continuous for plans'),
  ('A2', 14, 'Learning & Studying', 'must / have to / should'),
  ('A2', 15, 'Keeping in Touch & Plans', 'will for offers, promises and decisions'),
  ('A2', 16, 'Going Places', 'First conditional'),
  ('B1', 1, 'People & Places', 'Present simple and continuous, state verbs'),
  ('B1', 2, 'You, Yours & Opinions', 'So do I / Neither do I'),
  ('B1', 3, 'Everyday Life & Experiences', 'Present perfect and past simple'),
  ('B1', 4, 'Loves, Hates & Feelings', 'Gerunds and infinitives'),
  ('B1', 5, 'Travel & Nature', 'Narrative tenses'),
  ('B1', 6, 'Eating & Drinking', 'Passive: present and past'),
  ('B1', 7, 'Extraordinary People', 'Present perfect continuous'),
  ('B1', 8, 'Fact or Fiction & Homes', 'Modals of deduction: must / might / can''t'),
  ('B1', 9, 'Buying & Selling', 'as … as · much / far + comparative'),
  ('B1', 10, 'Love & Relationships', 'Reported speech: statements'),
  ('B1', 11, 'Street Life & Technology', 'Defining relative clauses'),
  ('B1', 12, 'The World Around Us', 'Zero and first conditionals'),
  ('B1', 13, 'Weekends Away & Free Time', 'Future forms'),
  ('B1', 14, 'Learning & Studying', 'Modals of obligation and advice'),
  ('B1', 15, 'Keeping in Touch & Plans', 'used to / would'),
  ('B1', 16, 'Going Places', 'Second conditional'),
  ('B2', 1, 'People & Places', 'Present habits: tend to, will, keep + -ing'),
  ('B2', 2, 'You, Yours & Opinions', 'Contrast and concession'),
  ('B2', 3, 'Everyday Life & Experiences', 'Present perfect simple and continuous'),
  ('B2', 4, 'Loves, Hates & Feelings', 'Verbs that change meaning: -ing or to'),
  ('B2', 5, 'Travel & Nature', 'Narrative tenses including past perfect continuous'),
  ('B2', 6, 'Eating & Drinking', 'Passive in all tenses, have something done'),
  ('B2', 7, 'Extraordinary People', 'Third conditional'),
  ('B2', 8, 'Fact or Fiction & Homes', 'Past modals of deduction'),
  ('B2', 9, 'Buying & Selling', 'Non-defining and reduced relative clauses'),
  ('B2', 10, 'Love & Relationships', 'Past modals: should have / could have'),
  ('B2', 11, 'Street Life & Technology', 'Future continuous and future perfect'),
  ('B2', 12, 'The World Around Us', 'wish / if only'),
  ('B2', 13, 'Weekends Away & Free Time', 'used to / be used to / get used to'),
  ('B2', 14, 'Learning & Studying', 'Mixed conditionals'),
  ('B2', 15, 'Keeping in Touch & Plans', 'Reported speech and reporting verbs'),
  ('B2', 16, 'Going Places', 'Indirect questions and question tags'),
  ('C1', 1, 'People & Places', 'Aspect: perfect and continuous forms'),
  ('C1', 2, 'You, Yours & Opinions', 'Hedging and distancing'),
  ('C1', 3, 'Everyday Life & Experiences', 'Participle clauses'),
  ('C1', 4, 'Loves, Hates & Feelings', 'Emphasis: do / did, intensifiers'),
  ('C1', 5, 'Travel & Nature', 'Relative clauses with prepositions and quantifiers'),
  ('C1', 6, 'Eating & Drinking', 'Passive reporting: is said to'),
  ('C1', 7, 'Extraordinary People', 'Inversion after negative adverbials'),
  ('C1', 8, 'Fact or Fiction & Homes', 'Modals of speculation, present and past'),
  ('C1', 9, 'Buying & Selling', 'Nominalisation'),
  ('C1', 10, 'Love & Relationships', 'Unreal past: wish, it''s time, would rather'),
  ('C1', 11, 'Street Life & Technology', 'Formal discourse markers'),
  ('C1', 12, 'The World Around Us', 'Cleft sentences'),
  ('C1', 13, 'Weekends Away & Free Time', 'Ellipsis and substitution'),
  ('C1', 14, 'Learning & Studying', 'Perfect and passive gerunds and infinitives'),
  ('C1', 15, 'Keeping in Touch & Plans', 'Future forms: be about to, be due to, be bound to'),
  ('C1', 16, 'Going Places', 'Mixed and inverted conditionals'),
  ('C2', 1, 'People & Places', 'Fronting and marked word order'),
  ('C2', 2, 'You, Yours & Opinions', 'Epistemic modality and hedging'),
  ('C2', 3, 'Everyday Life & Experiences', 'Nuanced tense and aspect'),
  ('C2', 4, 'Loves, Hates & Feelings', 'Metaphor, idiom and connotation'),
  ('C2', 5, 'Travel & Nature', 'Participle and verbless clauses'),
  ('C2', 6, 'Eating & Drinking', 'Dense noun phrases'),
  ('C2', 7, 'Extraordinary People', 'Future in the past, perfect infinitives'),
  ('C2', 8, 'Fact or Fiction & Homes', 'Reporting with stance'),
  ('C2', 9, 'Buying & Selling', 'Rhetorical devices for persuasion'),
  ('C2', 10, 'Love & Relationships', 'Understatement and register'),
  ('C2', 11, 'Street Life & Technology', 'Advanced conditionals: but for, supposing'),
  ('C2', 12, 'The World Around Us', 'Subjunctive and mandative structures'),
  ('C2', 13, 'Weekends Away & Free Time', 'Ellipsis, substitution and cohesion'),
  ('C2', 14, 'Learning & Studying', 'Concession: albeit, much as'),
  ('C2', 15, 'Keeping in Touch & Plans', 'Complex relative and cleft structures'),
  ('C2', 16, 'Going Places', 'Style, register and precision')
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
-- also:     other language points that week, e.g. "Articles · weather"
-- use:      what the main grammar point is for, in a few words
-- pattern:  the form, e.g. "[If + past simple], {would + verb}"
-- examples: example sentences, one per line
-- starter:  a sentence starter, e.g. "[If I …], I {would} …"
-- Text in [square brackets] is highlighted in orange and text in
-- {curly brackets} in blue, so the parts of the pattern can be matched to the
-- same parts in the examples. Edit these cells in Table Editor -> weeks.

alter table public.weeks add column if not exists also text not null default '';
alter table public.weeks add column if not exists use text not null default '';
alter table public.weeks add column if not exists pattern text not null default '';
alter table public.weeks add column if not exists examples text not null default '';
alter table public.weeks add column if not exists starter text not null default '';

-- Starting help, filled in only for weeks that have none yet.
update public.weeks w
set also = d.also, use = d.use, pattern = d.pattern, examples = d.examples, starter = d.starter
from (values
  ('A1', 1, 'Nationalities · too much / too many · superlatives', 'Talk about people and where they are from', 'I [am] · you / we / they [are] · he / she / it [is] · not · [Are] you …?', 'I[’m] from Morocco. I[’m] Moroccan.
She [isn''t] French. She[’s] Italian.
[Are] you a student? Yes, I [am].', 'I[’m] from … and my city [is] …'),
  ('A1', 2, 'have got · possessive ’s · will / won’t for promises · verb patterns with adjectives', 'Talk about things near and far', '{this} (one, here) · {these} (many, here) · [that] (one, there) · [those] (many, there)', '{This} is my phone, and [that] is my bag.
{These} photos are from my holiday.
Are [those] your keys on the table?', '{This} is my favourite … because …'),
  ('A1', 3, 'Present perfect for experiences · telling the time · me too / me neither', 'Talk about your everyday life', 'I / you / we / they + [verb] · {don''t} + verb · [Do] you …?', 'I [get up] at seven every day.
We {don''t work} on Sundays.
[Do] you [walk] to school?', 'Every morning I [ … ]'),
  ('A1', 4, 'Adverbs of frequency · should / shouldn’t · present perfect for results', 'Talk about what other people love and hate', 'he / she / it + verb[-s] · {doesn''t} + verb · {Does} she …?', 'My sister love[s] music.
He {doesn''t like} getting up early.
{Does} your friend like football?', 'My best friend love[s] … but hate[s] …'),
  ('A1', 5, 'Articles · might / going to · present and past simple passive', 'Talk about what you can do on a trip', '[can] / {can''t} + verb · [Can] you …?', 'I [can] swim in the sea.
We {can''t} drive in the desert.
[Can] you ride a camel?', 'On holiday I [can] … but I {can''t} …'),
  ('A1', 6, 'Countable and uncountable nouns · some / any / a lot of / much / many', 'Describe food and places to eat', '[There is] + one thing · {There are} + more than one', '[There is] a café near my school.
{There are} three restaurants on my street.
Is there any milk in the fridge?', 'In my town [there is] a great place to eat. It …'),
  ('A1', 7, 'Past simple regular and irregular verbs · auxiliary verbs · have to / don’t have to', 'Talk about famous people in the past', 'I / he / she / it [was] · you / we / they {were}', 'Ibn Battuta [was] a famous traveller.
His journeys {were} very long.
Where [was] he born?', 'A famous person from my country [was] …'),
  ('A1', 8, 'Prepositions of place · possessive pronouns · can / can’t', 'Ask and answer about stories and the past', '[didn''t] + verb · {Did} you …?', 'I [didn''t] believe the story.
{Did} you watch the film last night?
Where {did} you live as a child?', '{Did} you ever …?'),
  ('A1', 9, 'Superlative adjectives · this / that / these / those · present continuous', 'Compare things you buy', 'short adjective + [-er than] · {more} + long adjective + [than]', 'This shirt is cheap[er than] that one.
Online shops are {more} convenient [than] markets.
Is this phone bett[er than] your old one?', 'I think … is bett[er than] …'),
  ('A1', 10, 'will / won’t for promises · quite / very / really · have got · present perfect for how long', 'Describe what was happening in a love story', '[was / were] + {verb-ing}', 'I [was] {waiting} for the bus when I met him.
They [were] {dancing} at a wedding.
What [were] you {doing} when you met?', 'When I met my best friend, I [was] {…ing} …'),
  ('A1', 11, 'Present simple or continuous · be thinking of + -ing · adverbs of manner', 'Describe what people are doing now', '[am / is / are] + {verb-ing}', 'She[’s] {wearing} a red jacket.
People [are] {looking} at their phones.
What [are] you {doing} right now?', 'Right now, I[’m] {…ing} …'),
  ('A1', 12, 'Quantifiers · be · there is / there are · present simple questions and negatives', 'Ask about the world', '[What · Where · When · Who · How many · How much] + question', '[What] is the biggest country in Africa?
[How many] people live in your city?
[Where] do lions live?', '[What] do you know about …?'),
  ('A1', 13, 'would like to / want to · like / love + -ing · adverbs of frequency', 'Talk about weekend plans', '[am / is / are going to] + {verb}', 'I[’m] [going to] {visit} my cousins.
We[’re] [going to] {have} a picnic.
What are you [going to] {do} this weekend?', 'This weekend I[’m] [going to] …'),
  ('A1', 14, 'might and will · very / really / quite / a little · comparatives', 'Talk about rules at school', '[have to] = necessary · {don''t have to} = not necessary', 'We [have to] arrive at nine.
We {don''t have to} wear a uniform.
[Do] you [have to] do homework?', 'At my school, we [have to] …'),
  ('A1', 15, 'be going to · making suggestions · would like to', 'Talk about experiences and staying in touch', '[have / has] + past participle · {ever} / never', 'I[’ve] [called] my mum three times this week.
[Have] you {ever} [written] a letter?
She [has] never [used] a video call.', 'I[’ve] never …, but I[’ve] …'),
  ('A1', 16, 'Comparatives and superlatives · have got · take and get · past simple', 'Give directions and describe journeys', 'go [up / down / along / across / past / through] + place', 'Go [along] this street and turn left.
Walk [past] the bank and [across] the square.
The train goes [through] a long tunnel.', 'To get to my house, go [along] …'),
  ('A2', 1, 'Present simple and continuous', 'Ask questions to get to know people', '(question word) + [auxiliary] + subject + {verb}', 'Where [do] you {live}?
What [are] you {studying}?
How long [have] you {been} here?', 'Where [do] you {come} from?'),
  ('A2', 2, 'Giving opinions: I think / I don''t think', 'Talk about what belongs to whom, and give opinions', '[Whose] … is it? · {mine · yours · his · hers · ours · theirs}', '[Whose] jacket is this? It''s {mine}.
That idea is {hers}, not {mine}.
I think {yours} is better.', '[Whose] … do you prefer, {mine} or …?'),
  ('A2', 3, 'Past simple for finished time', 'Talk about experiences', '[have / has] + past participle · {ever} / {never}', '[Have] you {ever} [eaten] snails?
I [have] {never} [been] to Spain.
She [has] [climbed] Toubkal.', 'I [have] {never} …'),
  ('A2', 4, 'like / love / hate · feelings adjectives', 'Talk about things you love, hate and want', '[enjoy / love / hate / don''t mind] + -ing · {want / hope / decide} + to + verb', 'I [love dancing] at weddings.
She [hates waiting] for the bus.
I {want to learn} the guitar.', 'I [really enjoy] …ing, but I {want to} …'),
  ('A2', 5, 'Weather vocabulary', 'Make predictions about travel and nature', '[will] / {won''t} + verb', 'It [will] be sunny tomorrow.
I think it {won''t} rain.
[Will] the beach be busy?', 'I think tomorrow it [will] …'),
  ('A2', 6, 'Countable and uncountable nouns · a lot of', 'Say how much or how many', '[much / a little] + uncountable · {many / a few} + plural', '[How much] water do you drink?
I eat {a few} dates every day.
There isn''t [much] sugar in my tea.', 'I don''t eat [much] … but I eat {a lot of} …'),
  ('A2', 7, 'Irregular verbs · when / while', 'Tell the story of an extraordinary person', '[was / were + -ing] for the background · {past simple} for the action', 'She [was working] in a shop when she {won} the lottery.
He [was climbing] when the storm {started}.
What [were] they [doing] when they {became} famous?', 'My hero [was …ing] when …'),
  ('A2', 8, 'Describing homes · there was / there were', 'Talk about how things used to be', '[used to] + verb · {didn''t use to} + verb', 'We [used to] live in a small flat.
My grandparents {didn''t use to} have a TV.
Did you [use to] believe in ghosts?', 'When I was a child, I [used to] …'),
  ('A2', 9, 'Shopping language · too / enough', 'Compare things you buy', '[-er than / more … than] · {the -est / the most}', 'This market is cheap[er than] the mall.
It''s {the best} shop in town.
Online shopping is [more] convenient [than] going out.', '{The best} place to shop in my city is …'),
  ('A2', 10, 'Relationships vocabulary', 'Say how long you have known people', '[have / has] + participle + {for} a period / {since} a point', 'I [have known] Sara {for} ten years.
They [have been] married {since} 2015.
How long [have] you [had] your best friend?', 'I [have known] my best friend {for} …'),
  ('A2', 11, 'Technology vocabulary', 'Talk about recent news and technology', '[have / has] + {just / already} + participle · [haven''t] … {yet}', 'I[''ve] {just} bought a new phone.
She[''s] {already} downloaded the app.
I [haven''t] updated it {yet}.', 'I[''ve] {just} …'),
  ('A2', 12, 'Articles · geography vocabulary', 'Talk about the world and how things are made', '[is / are] + {past participle}', 'Coffee [is] {grown} in Brazil.
Arabic [is] {spoken} in many countries.
Argan oil [is] {made} in Morocco.', 'In my country, … [is] {…}'),
  ('A2', 13, 'Free-time activities · suggestions', 'Talk about plans and arrangements', '[going to] + verb = plan · {am / is / are + -ing} = arrangement', 'I''m [going to] relax this weekend.
I{''m meeting} friends on Saturday.
What [are] you {doing} on Sunday?', 'This weekend I''m [going to] … and I{''m …ing} …'),
  ('A2', 14, 'School and study vocabulary', 'Talk about rules and give advice for studying', '[must / have to] = rule · {should} = advice', 'You [must] switch off your phone in class.
We [have to] hand in homework on Mondays.
You {should} revise every evening.', 'Before an exam, you {should} …'),
  ('A2', 15, 'Making plans · keeping in touch', 'Make offers and promises', 'I[’ll] + verb', 'I[’ll] call you tomorrow.
I[’ll] send you the photos.
Don''t worry, I[’ll] help you.', 'I promise I[’ll] …'),
  ('A2', 16, 'Travel vocabulary · directions', 'Talk about possible journeys', '[If + present], {will + verb}', '[If we take the train], we {will arrive} early.
[If it rains], we {will stay} at the hotel.
What {will} you do [if you miss the bus]?', '[If I have time this summer], I {will} …'),
  ('B1', 1, 'Question forms', 'Talk about habits and what''s happening now', 'habit: [I work] · now: {I''m working} · state verbs: know, like, believe', 'I [usually work] from home.
This week {I''m working} in the office.
I know exactly what you mean.', 'Normally I [ … ], but these days {I''m …ing} …'),
  ('B1', 2, 'Giving and asking for opinions', 'Agree and disagree with opinions', 'agree: [So do I / So am I] · agree with a negative: {Neither do I / Neither am I}', '‘I love football.’ ‘[So do I].’
‘I''m not a morning person.’ ‘{Neither am I}.’
‘I can''t stand rap.’ ‘Really? I can.’', 'I think … ‘[So do I]’ or ‘Really? I don''t.’'),
  ('B1', 3, 'Time expressions: ever, never, ago, last', 'Talk about experiences and when they happened', '[have + participle] = experience · {past simple} = a finished time', 'I [have been] to Istanbul twice.
I {went} there in 2022.
[Have] you ever [lost] your luggage? What {happened}?', 'I [have] … , and it {was} …'),
  ('B1', 4, 'Adjectives for feelings', 'Talk about likes, hates and feelings', '[enjoy / mind / avoid] + -ing · {want / plan / decide} + to + verb', 'I [enjoy watching] horror films.
I {decided to stop} worrying.
I [can''t stand waiting] in queues.', 'I [really enjoy] …ing, but I don''t {want to} …'),
  ('B1', 5, 'Travel and nature vocabulary', 'Tell a travel story', '[past continuous] for the background · {past simple} for the events · had + participle for earlier', 'We [were driving] to Agadir when the car {broke down}.
It [was raining], so we {stopped} at a café.
I {realised} I had left my passport at home.', 'I [was …ing] when suddenly …'),
  ('B1', 6, 'Food and cooking vocabulary', 'Describe how food is made and served', '[am / is / are / was / were] + {past participle}', 'Couscous [is] traditionally {eaten} on Fridays.
This bread [was] {baked} this morning.
Tea [is] {served} with fresh mint.', 'In my country, … [is] {made} with …'),
  ('B1', 7, 'for / since · describing people', 'Talk about how long extraordinary people have been doing things', '[have been + -ing] + {for / since}', 'She [has been climbing] mountains {for} twenty years.
He [has been writing] songs {since} he was ten.
How long [have] you [been learning] English?', 'I [have been] …ing {for} …'),
  ('B1', 8, 'Story and home vocabulary', 'Guess whether a story is fact or fiction', '[must] = I''m sure it''s true · {can''t} = I''m sure it''s not true · might = maybe', 'That story [must] be true: it was on the news.
A house with forty rooms {can''t} be cheap.
It might be a ghost story.', 'I think this story {can''t} be true because …'),
  ('B1', 9, 'Shopping and money vocabulary', 'Compare products and prices in detail', '[as + adjective + as] · {much / far} + comparative', 'The market is [as good as] the supermarket.
Online prices are {far cheaper} than in shops.
This phone isn''t [as fast as] the new one.', 'Buying online is {much} … than …'),
  ('B1', 10, 'Relationships vocabulary', 'Tell someone what another person said', '[said / told me] + tense moves back: is → {was}, will → {would}', 'She [said] she {was} in love.
He [told me] he {would} call later.
My friend [said] she {had} met someone new.', 'My best friend once [told me] that …'),
  ('B1', 11, 'Technology vocabulary', 'Say exactly which person or thing', 'person: [who] · thing: {which / that}', 'My cousin is the person [who] fixes my laptop.
A smartphone is a phone {that} connects to the internet.
I need an app {which} helps me sleep.', 'I can''t live without an app {that} …'),
  ('B1', 12, 'Environment vocabulary', 'Talk about results that are always or likely true', '[If + present], {present} = always · [If + present], {will + verb} = likely', '[If you heat ice], it {melts}.
[If we recycle more], we{''ll have} less rubbish.
What {will} happen [if the sea gets warmer]?', '[If we …], the world {will} …'),
  ('B1', 13, 'Free-time and holiday vocabulary', 'Talk about predictions, plans and arrangements', '[will] = prediction · {going to} = plan · I''m meeting = arrangement', 'I think the weekend [will] be relaxing.
I''m {going to} go camping.
I''m meeting my friends on Saturday.', 'Next weekend I''m {going to} …'),
  ('B1', 14, 'Education vocabulary', 'Talk about rules and give study advice', '[must / have to] = obligation · {should} = advice · don''t have to = no need', 'Students [must] attend 80% of classes.
You {should} revise a little every day.
We don''t have to wear a uniform.', 'In my opinion, students {should} …'),
  ('B1', 15, 'Ways of keeping in touch', 'Talk about how you used to stay in touch', '[used to] + verb · {would} + verb (repeated actions)', 'We [used to] write letters.
Every Sunday we {would} call my grandmother.
Did you [use to] send postcards?', 'When I was younger, I [used to] …'),
  ('B1', 16, 'Travel and transport vocabulary', 'Talk about imaginary journeys', '[If + past simple], {would + verb}', '[If I won] a lot of money, I {would travel} the world.
[If I could] go anywhere, I{''d go} to Japan.
Where {would} you {go} [if you had] a month off?', '[If I could …], I {would} …'),
  ('B2', 1, 'Describing people and places', 'Describe typical behaviour', '[tend to] + verb · {will} + verb (habit) · keep + -ing', 'People here [tend to] be very friendly.
My brother {will} talk for hours about football.
She keeps forgetting her keys.', 'People in my city [tend to] …'),
  ('B2', 2, 'Opinion language', 'Balance two sides of an argument', '[although] + clause · {despite} + noun or -ing · however, …', '[Although] I disagree, I see your point.
{Despite} its benefits, social media worries me.
It''s useful. However, it can be addictive.', '[Although] some people think …, I …'),
  ('B2', 3, 'Experiences and routines', 'Talk about results and ongoing activities', '[have + participle] = result · {have been + -ing} = ongoing activity', 'I [have read] three books this month.
I {have been reading} a lot lately.
How long {have} you {been working} here?', 'Recently I {have been} …ing, and I [have] …'),
  ('B2', 4, 'Feelings and emotions', 'Use verbs that change meaning', '[remember / stop / try] + -ing vs {+ to + verb}', 'I [remember feeling] nervous on my first day.
Please {remember to call} your mother.
I [stopped worrying] about small things.', 'I''ll never forget [feeling] …'),
  ('B2', 5, 'Travel and nature vocabulary', 'Show what had been happening before', '[had been + -ing] before a {past simple} event', 'We [had been hiking] for hours when it {started} to snow.
I [had been waiting] so long that I {fell} asleep.
She {was} tired because she [had been driving] all night.', 'We [had been] …ing for … when …'),
  ('B2', 6, 'Food and restaurants', 'Focus on the action or a service', '[be + past participle] in any tense · {have something + participle}', 'The restaurant [has been renovated].
The menu [will be changed] next month.
We {had the cake made} by a baker.', 'Recently, a … [has been] …'),
  ('B2', 7, 'Achievements and life events', 'Talk about how things could have been different', '[If + had + participle], {would have + participle}', '[If she hadn''t trained so hard], she {wouldn''t have won}.
[If he had given up], he {would have missed} his chance.
What {would} you {have done} [if you had been there]?', '[If I had …], I {would have} …'),
  ('B2', 8, 'Mysteries and homes', 'Guess what happened', '[must / might / can''t] + {have + participle}', 'The owners [must] {have left} in a hurry.
Someone [might] {have lived} here for years.
It [can''t] {have been} a ghost.', 'I think they [must] {have} …'),
  ('B2', 9, 'Consumer vocabulary', 'Add extra information about products', '…, [which / who] …, · short form: {-ing / -ed} phrase', 'My phone, [which] I bought last year, already feels old.
People {buying} online often spend more.
Clothes {made} cheaply don''t last.', 'My favourite brand, [which] …, …'),
  ('B2', 10, 'Relationship problems', 'Talk about regrets in relationships', '[should have / could have] + {past participle}', 'I [should have] {apologised} sooner.
You [could have] {told} me the truth!
They [shouldn''t have] {argued} in public.', 'I [should have] … when …'),
  ('B2', 11, 'Technology and city life', 'Picture life at a point in the future', '[will be + -ing] = in progress · {will have + participle} = finished', 'In 2040 we [will be using] self-driving cars.
By then, cities {will have changed} completely.
This time next year I [will be working] online.', 'In ten years, people [will be] …ing …'),
  ('B2', 12, 'Environment vocabulary', 'Talk about changes you wish for', '[wish / if only] + {past} (now) · + {would} (other people)', 'I [wish] people {recycled} more.
[If only] governments {would} act.
I [wish] I {didn''t} use so much plastic.', 'I [wish] my city {…}'),
  ('B2', 13, 'Holidays and free time', 'Talk about past habits and getting used to things', '[used to] + verb (past) · {be / get used to} + -ing (familiar)', 'I [used to] work every weekend.
I''m {used to relaxing} on Sundays now.
It took me a while to {get used to camping}.', 'On holiday I couldn''t {get used to} …'),
  ('B2', 14, 'Education and careers', 'Link past choices to the present', '[If + had + participle] (past), {would + verb} (now)', '[If I had studied medicine], I {would be} a doctor now.
[If I hadn''t learned English], I {wouldn''t have} this job.
Where {would} you be [if you had chosen] another course?', '[If I had studied …], I {would} … now.'),
  ('B2', 15, 'Communication vocabulary', 'Report what was said, and how', '[said / told] + clause · {promised / suggested / admitted / reminded}', 'She [said] she would call me back.
He {promised} to keep in touch.
My friend {suggested} meeting for coffee.', 'My friend recently {suggested} …'),
  ('B2', 16, 'Travel situations', 'Ask politely and check information', '[Could you tell me] + where it is? · …, {isn''t it?}', '[Could you tell me] where the station is?
[Do you know] what time the train leaves?
This is the right platform, {isn''t it?}', '[Do you know] whether …?'),
  ('C1', 1, 'Identity and place vocabulary', 'Choose simple, continuous or perfect for meaning', '[continuous] = in progress · {perfect} = up to a point', 'I [have been living] in Brighton for a year.
By the time I moved, I {had lost} my accent.
I''m [living] in London, but I {have never felt} English.', 'Lately I [have been] …'),
  ('C1', 2, 'Expressing opinions', 'Make careful, softened claims', '[seem / appear / tend] + to · {it could be argued that}', 'Opinions [seem to] be changing.
{It could be argued that} we share too much.
Young people [tend to] trust online reviews.', '{It could be argued that} …'),
  ('C1', 3, 'Everyday life and experiences', 'Combine ideas concisely', '[-ing] clause (same time) · {Having + participle} (earlier)', '[Walking] through my old school, I felt twelve again.
{Having lived} abroad, I see home differently.
[Asked] about her routine, she laughed.', '[Looking] back, I …'),
  ('C1', 4, 'Feelings vocabulary', 'Add strong emphasis', '[do / did] + verb · {by far / utterly / truly}', 'I [do] love a quiet Sunday.
That was {by far} the happiest day of my life.
I was {utterly} exhausted.', 'I [do] believe that …'),
  ('C1', 5, 'Travel and nature', 'Write precise, formal descriptions', '[in which / to whom] · {most of which / some of whom}', 'The village [in which] I stayed had no roads.
I met many travellers, {most of whom} spoke English.
The forest, [through which] we walked, was silent.', 'The place [in which] I …'),
  ('C1', 6, 'Food trends', 'Report beliefs and claims impersonally', '[It is said that] … · subject + {is said to} + verb', '[It is believed that] olive oil is good for the heart.
This dish {is said to} come from Fes.
Coffee {is thought to have} originated in Ethiopia.', '[It is often said that] …'),
  ('C1', 7, 'Achievements and character', 'Make strong, formal statements', '[Never / Rarely / Not only] + {auxiliary} + subject', '[Never] {had} anyone climbed it before.
[Not only] {did} she win, but she broke the record.
[Rarely] {does} someone so young achieve so much.', '[Rarely] {do} we see …'),
  ('C1', 8, 'Mysteries and stories', 'Speculate about what is or was true', '[may / might / could] + verb · {may / might / could} + have + participle', 'The story [might] be based on real events.
The house {could have been} built on an old site.
The writer [may] be exaggerating.', 'Perhaps the story {might have} …'),
  ('C1', 9, 'Business and consumer vocabulary', 'Sound formal and analytical', 'verb → noun: grow → [growth] · decide → {decision}', 'The [growth] of online shopping is remarkable.
The {decision} to cut prices worked.
There has been a sharp [increase] in second-hand sales.', 'The [rise] of … will …'),
  ('C1', 10, 'Relationships', 'Express regret, urgency and preference', '[wish / it''s time] + past · {would rather} + past', 'I [wish] we spent more time together.
[It''s time] we talked honestly.
I''d {rather} you told me the truth.', '[It''s high time] we …'),
  ('C1', 11, 'Technology and society', 'Structure an argument', '[Furthermore / Moreover] · {Nevertheless / Conversely} · Consequently', 'Cameras make streets safer. [Moreover], they deter crime.
Apps are free. {Nevertheless}, we pay with our privacy.
Consequently, regulation is needed.', 'Technology helps us. [Furthermore], …'),
  ('C1', 12, 'Global issues', 'Emphasise one part of what you say', '[What] … is … · {It is} … that …', '[What] worries me is the speed of climate change.
{It is} small changes that make the difference.
[What] we need is cooperation.', '[What] concerns me most about the world is …'),
  ('C1', 13, 'Leisure activities', 'Avoid repeating words', '[so / not] · {do / one}', 'Are you going away this weekend? I hope [so].
I wanted to go hiking, but I never {did}.
I prefer the quieter {one}.', 'Some people say … I don''t think [so], because …'),
  ('C1', 14, 'Learning and achievement', 'Talk about achievements and recognition', '[having + participle] · {to be + participle} · to have + participle', 'I''m proud of [having passed] my exams.
Every student wants {to be encouraged}.
She seems to have learned very quickly.', 'I''m proud of [having] …'),
  ('C1', 15, 'Plans and communication', 'Talk about imminent and expected events', '[be about to] = very soon · {be due to} = scheduled · be bound to = certain', 'I''m [about to] start a new job.
My cousin is {due to} arrive on Friday.
We''re bound to lose touch if we don''t call.', 'Soon I''m [about to] …'),
  ('C1', 16, 'Travel and journeys', 'Discuss hypothetical journeys formally', '[Had I known] … · {Were it} … · Should you …', '[Had I known] about the strike, I would have flown.
{Were it} cheaper, I would travel by train.
Should you visit Fes, see the tanneries.', '[Had I been] free last summer, I would …'),
  ('C2', 1, 'Identity and belonging', 'Shift focus by changing word order', '[object or adjective] first + subject + verb · {… as it may seem}', '[This city] I will never forget.
[Strange] {as it may seem}, I feel at home abroad.
[Home] is where I''m understood.', '[Odd] {as it may sound}, …'),
  ('C2', 2, 'Truth and opinion', 'Signal exactly how certain you are', '[may well / is likely to] · {arguably / presumably}', 'This [may well] be the best explanation.
It is, {arguably}, unprovable.
Experts [are likely to] disagree.', 'It [may well] be that …'),
  ('C2', 3, 'Daily life and change', 'Shade meaning through tense', '[was wondering] = tentative · {have come to} = gradual change', 'I [was wondering] whether routines make us happier.
I {have come to} value quiet mornings.
We [are forever] checking our phones.', 'I {have come to} realise that …'),
  ('C2', 4, 'Emotions and attitudes', 'Interpret and use figurative language', '[metaphor] · {idiom} · words with a positive or negative feel', 'Grief is [a heavy coat] you learn to wear.
I was {over the moon} when I heard.
Is she ‘determined’ or ‘stubborn’?', 'For me, love is [a …] because …'),
  ('C2', 5, 'Landscapes and nature', 'Write vivid, compact description', '[-ing / -ed] clause · {verbless}: adjective or noun phrase', '[Shrouded in mist], the valley looked untouched.
{Exhausted but happy}, we reached the summit.
[Left alone], nature recovers.', '[Surrounded by] …, I …'),
  ('C2', 6, 'Food culture and industry', 'Pack ideas into precise noun phrases', '[the + noun] + {of / for} + noun phrase', '[The globalisation] {of} food has changed our diets.
[The demand] {for} cheap meat harms the planet.
Unequal access {to} fresh food is a concern.', '[The commercialisation] {of} …'),
  ('C2', 7, 'Biography and legacy', 'Describe the past from an earlier point of view', '[was to / would] = what happened later · {to have + participle}', 'Nobody knew she [was to] become a legend.
He [would] later change medicine forever.
Ibn Battuta is said {to have travelled} 120,000 km.', 'At the time, nobody knew that … [would] …'),
  ('C2', 8, 'News, rumour and the home', 'Show your attitude to a source', '[allegedly / purportedly] · {claims / concedes / insists}', 'The house is [allegedly] haunted.
The owner {concedes} the story is exaggerated.
The photo was [purportedly] taken in 1920.', 'The article {claims} … , but …'),
  ('C2', 9, 'Advertising and sales', 'Persuade with structure', '[So / Such] … that · {Little did} they know · three-part lists', '[So] convincing was the advert that sales doubled.
{Little did} buyers know the price would fall.
Faster, lighter, smarter.', '[Never before] has …'),
  ('C2', 10, 'Relationships and tone', 'Use irony and tone', '[not exactly / a tad] = understatement · {ironic praise}', 'The first date was [not exactly] a success.
Forgetting her birthday was [a tad] unwise.
‘{Lovely},’ she said, as he arrived an hour late.', 'It was [not exactly] …'),
  ('C2', 11, 'Technology and urban life', 'Explore alternatives precisely', '[But for / Were it not for] + noun · {Supposing / Provided that}', '[But for] smartphones, we would get lost more.
[Were it not for] cameras, crime might rise.
{Supposing} cars disappeared, how would cities change?', '[Were it not for] technology, …'),
  ('C2', 12, 'Global responsibility', 'Express demands and recommendations formally', '[insist / recommend / it is essential] that + {base verb}', 'Scientists [insist that] emissions {be} cut.
[It is vital that] every country {act} now.
They [recommended that] the forest {be} protected.', '[I would propose that] the world {…}'),
  ('C2', 13, 'Leisure and lifestyle', 'Connect a long argument smoothly', '[the former / the latter / this] · {do so / one}', 'Some rest, others travel; [the latter] return happier.
Many plan a break, but few {do so}.
[This] is why rest matters.', '[The former] … whereas [the latter] …'),
  ('C2', 14, 'Learning and knowledge', 'Concede a point formally', '[albeit / notwithstanding] · {much as} + clause', 'The course was useful, [albeit] demanding.
{Much as} I value exams, they are not everything.
[Notwithstanding] the cost, education pays.', '{Much as} I respect …, …'),
  ('C2', 15, 'Communication and plans', 'Build complex, precise sentences', '[It is … that] · {whereby / whose}', '[It is] small messages [that] keep friendships alive.
We set up a system {whereby} we call every Sunday.
Friends {whose} lives move on still matter.', '[It is not] … [that] …, but …'),
  ('C2', 16, 'Journeys and travel writing', 'Choose exactly the right word and tone', '[formal] vs {informal} · precise vocabulary', 'Passengers are requested to [refrain from] smoking.
The trip was {a total nightmare}.
The road meandered through olive groves.', 'To my mind, the best journeys are …')
) as d (level, week, also, use, pattern, examples, starter)
where w.level = d.level and w.week = d.week
  and w.also = '' and w.use = '' and w.pattern = '' and w.examples = '' and w.starter = '';


-- ---------------------------------------------------------------------------
-- Weekly questions
-- ---------------------------------------------------------------------------
-- Five discussion questions per week at each level, on the week's theme and
-- built to practise its grammar. Added only if no question has a week yet.
-- A week with questions of its own uses them; the questions with no week are
-- used for "Any week" and for weeks that have none.

insert into public.questions (level, week, topic, text)
select * from (values
  ('A1', 1, 'People & Places', 'Where are you from? Is your city big or small?'),
  ('A1', 1, 'People & Places', 'Who is your best friend? Where is he or she from?'),
  ('A1', 1, 'People & Places', 'What is your favourite place in your city? Why?'),
  ('A1', 1, 'People & Places', 'Are you a student or do you work? What is your job?'),
  ('A1', 1, 'People & Places', 'Is your family big or small? Who is in your family?'),
  ('A1', 2, 'You, Yours & Opinions', 'What is this in your bag? Show your partner three things and say what they are.'),
  ('A1', 2, 'You, Yours & Opinions', 'Look around the room. What is that near the window? What are those on the wall?'),
  ('A1', 2, 'You, Yours & Opinions', 'Have you got a photo on your phone? Who is this? Who are these people?'),
  ('A1', 2, 'You, Yours & Opinions', 'Is this your favourite phone, bag or watch? Why?'),
  ('A1', 2, 'You, Yours & Opinions', 'What are these things on your desk? Are they yours or your friend''s?'),
  ('A1', 3, 'Everyday Life & Experiences', 'What time do you get up? What do you do in the morning?'),
  ('A1', 3, 'Everyday Life & Experiences', 'Do you work or study in the afternoon?'),
  ('A1', 3, 'Everyday Life & Experiences', 'What do you and your family do in the evening?'),
  ('A1', 3, 'Everyday Life & Experiences', 'Do you eat breakfast? What do you eat?'),
  ('A1', 3, 'Everyday Life & Experiences', 'What do you do on Sundays? What don''t you do?'),
  ('A1', 4, 'Loves, Hates & Feelings', 'What does your best friend love? What does he or she hate?'),
  ('A1', 4, 'Loves, Hates & Feelings', 'What does your mother or father do in the evening?'),
  ('A1', 4, 'Loves, Hates & Feelings', 'Does your brother or sister like sport? What does he or she play?'),
  ('A1', 4, 'Loves, Hates & Feelings', 'What does your favourite singer do? Does he or she sing in English?'),
  ('A1', 4, 'Loves, Hates & Feelings', 'What makes your friend happy? What makes him or her angry?'),
  ('A1', 5, 'Travel & Nature', 'Can you swim? Can you ride a bike? Can you drive?'),
  ('A1', 5, 'Travel & Nature', 'What can you do on holiday in your country?'),
  ('A1', 5, 'Travel & Nature', 'Can you cook food from your country? What can you cook?'),
  ('A1', 5, 'Travel & Nature', 'What animals can you see near your city?'),
  ('A1', 5, 'Travel & Nature', 'Can you speak three languages? Which languages can you speak?'),
  ('A1', 6, 'Eating & Drinking', 'Is there a good restaurant near your home? What food is there?'),
  ('A1', 6, 'Eating & Drinking', 'What is there in your fridge today?'),
  ('A1', 6, 'Eating & Drinking', 'Are there many cafés in your town? Which one is your favourite?'),
  ('A1', 6, 'Eating & Drinking', 'Is there a market near your house? What is there?'),
  ('A1', 6, 'Eating & Drinking', 'What is there on the table at a family dinner in your country?'),
  ('A1', 7, 'Extraordinary People', 'Who was a famous person in your country in the past? Why was he or she famous?'),
  ('A1', 7, 'Extraordinary People', 'Who was your favourite teacher? What was he or she like?'),
  ('A1', 7, 'Extraordinary People', 'Where were you born? Where was your family from?'),
  ('A1', 7, 'Extraordinary People', 'Who was your hero when you were a child?'),
  ('A1', 7, 'Extraordinary People', 'Were your grandparents born in a city or a village? Where?'),
  ('A1', 8, 'Fact or Fiction & Homes', 'Did you watch a film last weekend? Did you like it?'),
  ('A1', 8, 'Fact or Fiction & Homes', 'Where did you live when you were a child? Did you have a garden?'),
  ('A1', 8, 'Fact or Fiction & Homes', 'Did you read stories when you were young? What was your favourite?'),
  ('A1', 8, 'Fact or Fiction & Homes', 'What did you do yesterday evening? What didn''t you do?'),
  ('A1', 8, 'Fact or Fiction & Homes', 'Did you believe in ghosts or magic as a child?'),
  ('A1', 9, 'Buying & Selling', 'Which is cheaper, a market or a supermarket?'),
  ('A1', 9, 'Buying & Selling', 'Is shopping online better than shopping in a shop? Why?'),
  ('A1', 9, 'Buying & Selling', 'Which is more expensive in your country, food or clothes?'),
  ('A1', 9, 'Buying & Selling', 'Is your phone newer or older than your partner''s phone?'),
  ('A1', 9, 'Buying & Selling', 'Which shop in your town is bigger, better or more interesting?'),
  ('A1', 10, 'Love & Relationships', 'What were you doing when you met your best friend?'),
  ('A1', 10, 'Love & Relationships', 'What was your family doing last night at eight o''clock?'),
  ('A1', 10, 'Love & Relationships', 'Think of a wedding. What were the people doing?'),
  ('A1', 10, 'Love & Relationships', 'What were you wearing on your first day at this school?'),
  ('A1', 10, 'Love & Relationships', 'Where were you living when you were ten? What were you doing at weekends?'),
  ('A1', 11, 'Street Life & Technology', 'Look around. What are people doing right now?'),
  ('A1', 11, 'Street Life & Technology', 'What is your family doing at this moment, do you think?'),
  ('A1', 11, 'Street Life & Technology', 'What are you wearing today? What is your partner wearing?'),
  ('A1', 11, 'Street Life & Technology', 'What are you learning at the moment?'),
  ('A1', 11, 'Street Life & Technology', 'What app are you using a lot this week?'),
  ('A1', 12, 'The World Around Us', 'What do you know about Africa? Which countries are there?'),
  ('A1', 12, 'The World Around Us', 'How many people live in your city?'),
  ('A1', 12, 'The World Around Us', 'Where do lions, camels and penguins live?'),
  ('A1', 12, 'The World Around Us', 'What is the biggest city in your country? Why do people go there?'),
  ('A1', 12, 'The World Around Us', 'When is the best time to visit your country? Why?'),
  ('A1', 13, 'Weekends Away & Free Time', 'What are you going to do this weekend?'),
  ('A1', 13, 'Weekends Away & Free Time', 'Where are you going to go on your next holiday?'),
  ('A1', 13, 'Weekends Away & Free Time', 'What are you going to eat tonight?'),
  ('A1', 13, 'Weekends Away & Free Time', 'Who are you going to see this week?'),
  ('A1', 13, 'Weekends Away & Free Time', 'What would you like to do on a perfect weekend? What do you want to do next weekend?'),
  ('A1', 14, 'Learning & Studying', 'What do you have to do at this school? What don''t you have to do?'),
  ('A1', 14, 'Learning & Studying', 'Do you have to wear a uniform at school or at work?'),
  ('A1', 14, 'Learning & Studying', 'What time do you have to get up on Monday?'),
  ('A1', 14, 'Learning & Studying', 'Do students in your country have to do a lot of homework?'),
  ('A1', 14, 'Learning & Studying', 'What do you have to do to learn English well?'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Have you ever written a letter? Who to?'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Have you called your family this week? How many times?'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Have you ever met a famous person?'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Have you ever made a friend online?'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Which countries have you visited?'),
  ('A1', 16, 'Going Places', 'How do you get from your home to school? Go along, past, through …'),
  ('A1', 16, 'Going Places', 'Give your partner directions to your favourite café.'),
  ('A1', 16, 'Going Places', 'Describe a journey you know. Do you go over a bridge or through a tunnel?'),
  ('A1', 16, 'Going Places', 'How do you get from the airport to the city centre in your country?'),
  ('A1', 16, 'Going Places', 'Is it easy to walk around your town? Where do you go?'),
  ('A2', 1, 'People & Places', 'Where do you live and what do you do?'),
  ('A2', 1, 'People & Places', 'What are you studying at the moment? Why?'),
  ('A2', 1, 'People & Places', 'How long have you been in this city?'),
  ('A2', 1, 'People & Places', 'What do you usually do on Friday evenings?'),
  ('A2', 1, 'People & Places', 'Who do you talk to most in your family?'),
  ('A2', 2, 'You, Yours & Opinions', 'Whose phone is newer, yours or your partner''s?'),
  ('A2', 2, 'You, Yours & Opinions', 'In your family, whose cooking is the best? Is it yours?'),
  ('A2', 2, 'You, Yours & Opinions', 'Whose opinions do you listen to most? Why?'),
  ('A2', 2, 'You, Yours & Opinions', 'I think … is the best film this year. What do you think?'),
  ('A2', 2, 'You, Yours & Opinions', 'Whose job would you like to have? Why theirs?'),
  ('A2', 3, 'Everyday Life & Experiences', 'Have you ever eaten something very strange? What was it?'),
  ('A2', 3, 'Everyday Life & Experiences', 'Have you ever been on a plane? Where did you go?'),
  ('A2', 3, 'Everyday Life & Experiences', 'What is something you have never done but want to do?'),
  ('A2', 3, 'Everyday Life & Experiences', 'Have you ever lost something important? What happened?'),
  ('A2', 3, 'Everyday Life & Experiences', 'Have you ever met someone famous? Where?'),
  ('A2', 4, 'Loves, Hates & Feelings', 'What do you love doing at the weekend?'),
  ('A2', 4, 'Loves, Hates & Feelings', 'What do you hate doing at home?'),
  ('A2', 4, 'Loves, Hates & Feelings', 'What do you want to learn this year?'),
  ('A2', 4, 'Loves, Hates & Feelings', 'Is there something you don''t mind doing that other people hate?'),
  ('A2', 4, 'Loves, Hates & Feelings', 'What do you hope to do in the next five years?'),
  ('A2', 5, 'Travel & Nature', 'What will the weather be like tomorrow, do you think?'),
  ('A2', 5, 'Travel & Nature', 'Will your country be hotter in twenty years?'),
  ('A2', 5, 'Travel & Nature', 'Do you think people will travel more or less in the future?'),
  ('A2', 5, 'Travel & Nature', 'Where will you go on your next holiday?'),
  ('A2', 5, 'Travel & Nature', 'Will we see more wild animals in cities in the future?'),
  ('A2', 6, 'Eating & Drinking', 'How much water do you drink every day?'),
  ('A2', 6, 'Eating & Drinking', 'How many meals do you eat a day?'),
  ('A2', 6, 'Eating & Drinking', 'Do you eat a lot of sugar? How much bread do you eat?'),
  ('A2', 6, 'Eating & Drinking', 'Do you have a few favourite dishes? What are they?'),
  ('A2', 6, 'Eating & Drinking', 'How many cafés are there near your home?'),
  ('A2', 7, 'Extraordinary People', 'Think of a famous person. What were they doing when they became famous?'),
  ('A2', 7, 'Extraordinary People', 'What were you doing when you heard some very good news?'),
  ('A2', 7, 'Extraordinary People', 'Tell a story about someone you admire. What happened?'),
  ('A2', 7, 'Extraordinary People', 'What was your grandparent doing when they were your age?'),
  ('A2', 7, 'Extraordinary People', 'What were you doing when something surprising happened to you?'),
  ('A2', 8, 'Fact or Fiction & Homes', 'Where did you use to live? What was your home like?'),
  ('A2', 8, 'Fact or Fiction & Homes', 'What did you use to believe as a child?'),
  ('A2', 8, 'Fact or Fiction & Homes', 'What games did you use to play?'),
  ('A2', 8, 'Fact or Fiction & Homes', 'What didn''t you use to like that you like now?'),
  ('A2', 8, 'Fact or Fiction & Homes', 'How did people use to live in your grandparents'' time?'),
  ('A2', 9, 'Buying & Selling', 'What is the best shop in your town? Why?'),
  ('A2', 9, 'Buying & Selling', 'Is online shopping cheaper than shopping in town?'),
  ('A2', 9, 'Buying & Selling', 'What is the most expensive thing you have bought?'),
  ('A2', 9, 'Buying & Selling', 'Which is more useful, a phone or a laptop?'),
  ('A2', 9, 'Buying & Selling', 'Where is the cheapest place to buy clothes?'),
  ('A2', 10, 'Love & Relationships', 'How long have you known your best friend?'),
  ('A2', 10, 'Love & Relationships', 'How long have your parents been married?'),
  ('A2', 10, 'Love & Relationships', 'Who have you known since you were a child?'),
  ('A2', 10, 'Love & Relationships', 'How long have you had your phone?'),
  ('A2', 10, 'Love & Relationships', 'How long have you lived in your home?'),
  ('A2', 11, 'Street Life & Technology', 'What have you just bought or downloaded?'),
  ('A2', 11, 'Street Life & Technology', 'Have you finished your homework yet?'),
  ('A2', 11, 'Street Life & Technology', 'What new app have you already tried this month?'),
  ('A2', 11, 'Street Life & Technology', 'What technology haven''t you used yet but want to?'),
  ('A2', 11, 'Street Life & Technology', 'What have you just read or watched online?'),
  ('A2', 12, 'The World Around Us', 'What is made or grown in your country?'),
  ('A2', 12, 'The World Around Us', 'What languages are spoken in your country?'),
  ('A2', 12, 'The World Around Us', 'Where are the best oranges grown?'),
  ('A2', 12, 'The World Around Us', 'What is your country known for?'),
  ('A2', 12, 'The World Around Us', 'What is your favourite food made with?'),
  ('A2', 13, 'Weekends Away & Free Time', 'What are you going to do after class today?'),
  ('A2', 13, 'Weekends Away & Free Time', 'Are you meeting anyone this week? Who?'),
  ('A2', 13, 'Weekends Away & Free Time', 'What are you doing on Saturday evening?'),
  ('A2', 13, 'Weekends Away & Free Time', 'Where are you going to go on your next day trip?'),
  ('A2', 13, 'Weekends Away & Free Time', 'What are you going to do on your next day off?'),
  ('A2', 14, 'Learning & Studying', 'What must students do at this school?'),
  ('A2', 14, 'Learning & Studying', 'What do you have to do before an exam?'),
  ('A2', 14, 'Learning & Studying', 'What should a new student do on the first day?'),
  ('A2', 14, 'Learning & Studying', 'What shouldn''t you do in class?'),
  ('A2', 14, 'Learning & Studying', 'What advice should a teacher give a nervous student?'),
  ('A2', 15, 'Keeping in Touch & Plans', 'Will you call a friend this week? Who will you call?'),
  ('A2', 15, 'Keeping in Touch & Plans', 'What will you do for a friend''s birthday?'),
  ('A2', 15, 'Keeping in Touch & Plans', 'What do you promise yourself for this year?'),
  ('A2', 15, 'Keeping in Touch & Plans', 'Make an offer to your partner: ‘I''ll help you with …’'),
  ('A2', 15, 'Keeping in Touch & Plans', 'I''ll send you a message later. What will you say?'),
  ('A2', 16, 'Going Places', 'If you go on holiday this year, where will you go?'),
  ('A2', 16, 'Going Places', 'If it rains this weekend, what will you do?'),
  ('A2', 16, 'Going Places', 'If you miss your bus, what will you do?'),
  ('A2', 16, 'Going Places', 'If you visit my country, what will you see?'),
  ('A2', 16, 'Going Places', 'If you travel by train, what will you take with you?'),
  ('B1', 1, 'People & Places', 'What do you usually do on weekdays? What are you doing differently this month?'),
  ('B1', 1, 'People & Places', 'Do you know your neighbours well? What are they like?'),
  ('B1', 1, 'People & Places', 'What are you working on or studying at the moment?'),
  ('B1', 1, 'People & Places', 'Where do people in your city usually meet friends?'),
  ('B1', 1, 'People & Places', 'What do you believe makes a city a good place to live?'),
  ('B1', 2, 'You, Yours & Opinions', '‘I love football.’ Do you? Tell your partner three things you love and listen to their reply.'),
  ('B1', 2, 'You, Yours & Opinions', '‘I''m not a morning person.’ Are you? What about your partner?'),
  ('B1', 2, 'You, Yours & Opinions', 'Share an opinion about social media. Does your partner agree?'),
  ('B1', 2, 'You, Yours & Opinions', '‘I can''t stand reality TV.’ Can you? Why or why not?'),
  ('B1', 2, 'You, Yours & Opinions', 'Find three things you and your partner agree about and one you don''t.'),
  ('B1', 3, 'Everyday Life & Experiences', 'Have you ever had a really bad day? What happened?'),
  ('B1', 3, 'Everyday Life & Experiences', 'What is the most interesting place you have been to? When did you go?'),
  ('B1', 3, 'Everyday Life & Experiences', 'Have you ever met someone who changed your life? When did you meet them?'),
  ('B1', 3, 'Everyday Life & Experiences', 'Have you ever tried a dangerous sport? What did you do?'),
  ('B1', 3, 'Everyday Life & Experiences', 'What have you learned this year? When did you learn it?'),
  ('B1', 4, 'Loves, Hates & Feelings', 'What do you enjoy doing when you feel stressed?'),
  ('B1', 4, 'Loves, Hates & Feelings', 'What do you avoid doing because it makes you nervous?'),
  ('B1', 4, 'Loves, Hates & Feelings', 'What have you decided to stop doing this year?'),
  ('B1', 4, 'Loves, Hates & Feelings', 'What can''t you stand waiting for?'),
  ('B1', 4, 'Loves, Hates & Feelings', 'What do you want to try for the first time?'),
  ('B1', 5, 'Travel & Nature', 'Tell your partner about a journey when something went wrong.'),
  ('B1', 5, 'Travel & Nature', 'What were you doing when you saw something amazing in nature?'),
  ('B1', 5, 'Travel & Nature', 'Describe a trip: where were you going and what happened?'),
  ('B1', 5, 'Travel & Nature', 'Have you ever got lost? What were you doing when you realised?'),
  ('B1', 5, 'Travel & Nature', 'Tell a story about bad weather on a trip.'),
  ('B1', 6, 'Eating & Drinking', 'How is your favourite dish made?'),
  ('B1', 6, 'Eating & Drinking', 'What is traditionally eaten at celebrations in your country?'),
  ('B1', 6, 'Eating & Drinking', 'Where was the best meal you ever had cooked or served?'),
  ('B1', 6, 'Eating & Drinking', 'What food is grown or produced near your home?'),
  ('B1', 6, 'Eating & Drinking', 'How is tea or coffee served in your country?'),
  ('B1', 7, 'Extraordinary People', 'Who is someone you admire? What have they been doing recently?'),
  ('B1', 7, 'Extraordinary People', 'What have you been doing to improve your English?'),
  ('B1', 7, 'Extraordinary People', 'How long have you been learning English?'),
  ('B1', 7, 'Extraordinary People', 'Think of a famous person who has been working for years. What have they been doing?'),
  ('B1', 7, 'Extraordinary People', 'What hobby have you been doing for a long time?'),
  ('B1', 8, 'Fact or Fiction & Homes', 'Tell your partner a strange story. Is it true? It must be, it might be, it can''t be …'),
  ('B1', 8, 'Fact or Fiction & Homes', 'Someone has a house with forty rooms. What job must they have?'),
  ('B1', 8, 'Fact or Fiction & Homes', 'A neighbour is never at home. Where might they be?'),
  ('B1', 8, 'Fact or Fiction & Homes', 'Do you know a ghost story? Can it be true?'),
  ('B1', 8, 'Fact or Fiction & Homes', 'A famous story about your country: must it be true or can''t it be true?'),
  ('B1', 9, 'Buying & Selling', 'Is the market as cheap as the supermarket in your town?'),
  ('B1', 9, 'Buying & Selling', 'Is online shopping much more convenient than going to shops?'),
  ('B1', 9, 'Buying & Selling', 'Which is far more expensive, a car or a house in your country?'),
  ('B1', 9, 'Buying & Selling', 'Are second-hand clothes as good as new clothes?'),
  ('B1', 9, 'Buying & Selling', 'Is your phone as good as your friend''s?'),
  ('B1', 10, 'Love & Relationships', 'What did a friend tell you recently?'),
  ('B1', 10, 'Love & Relationships', 'What did your parents say about love when you were young?'),
  ('B1', 10, 'Love & Relationships', 'Think of a romantic film. What did the characters say?'),
  ('B1', 10, 'Love & Relationships', 'Tell your partner something a friend told you that surprised you.'),
  ('B1', 10, 'Love & Relationships', 'What did your best friend say when you first met?'),
  ('B1', 11, 'Street Life & Technology', 'What is an app that you couldn''t live without?'),
  ('B1', 11, 'Street Life & Technology', 'Describe a person who helps you with technology.'),
  ('B1', 11, 'Street Life & Technology', 'What is a gadget which you want to buy?'),
  ('B1', 11, 'Street Life & Technology', 'Describe a street in your city that you love.'),
  ('B1', 11, 'Street Life & Technology', 'Who is someone that is always on their phone?'),
  ('B1', 12, 'The World Around Us', 'If we recycle more, what will happen?'),
  ('B1', 12, 'The World Around Us', 'What happens if you leave food outside in summer?'),
  ('B1', 12, 'The World Around Us', 'If people use cars less, how will cities change?'),
  ('B1', 12, 'The World Around Us', 'What will happen if the sea gets warmer?'),
  ('B1', 12, 'The World Around Us', 'If you see rubbish on the beach, what do you do?'),
  ('B1', 13, 'Weekends Away & Free Time', 'What are you going to do to relax this weekend, and why?'),
  ('B1', 13, 'Weekends Away & Free Time', 'Are you meeting anyone this week? What are you doing?'),
  ('B1', 13, 'Weekends Away & Free Time', 'What do you think the weather will be like this weekend?'),
  ('B1', 13, 'Weekends Away & Free Time', 'Where do you think you''ll go on holiday next year, and what are you going to do there?'),
  ('B1', 13, 'Weekends Away & Free Time', 'Will you do anything new this month?'),
  ('B1', 14, 'Learning & Studying', 'What must students do at your school?'),
  ('B1', 14, 'Learning & Studying', 'What should a student do the night before an exam?'),
  ('B1', 14, 'Learning & Studying', 'What don''t you have to do here that you had to do before?'),
  ('B1', 14, 'Learning & Studying', 'What should teachers do to help students?'),
  ('B1', 14, 'Learning & Studying', 'What advice should you give a new student?'),
  ('B1', 15, 'Keeping in Touch & Plans', 'How did you use to keep in touch with friends when you were younger?'),
  ('B1', 15, 'Keeping in Touch & Plans', 'Did you use to write letters or send postcards?'),
  ('B1', 15, 'Keeping in Touch & Plans', 'What would your family do on Sundays when you were a child?'),
  ('B1', 15, 'Keeping in Touch & Plans', 'Who did you use to call every week?'),
  ('B1', 15, 'Keeping in Touch & Plans', 'How did people use to stay in touch before mobile phones?'),
  ('B1', 16, 'Going Places', 'If you could go anywhere in the world, where would you go?'),
  ('B1', 16, 'Going Places', 'If you had a month off, what would you do?'),
  ('B1', 16, 'Going Places', 'If you could live in another country, which would you choose?'),
  ('B1', 16, 'Going Places', 'If you won a free trip, who would you take with you?'),
  ('B1', 16, 'Going Places', 'Where would you go if you had no money worries?'),
  ('B2', 1, 'People & Places', 'What do people in your city tend to do at the weekend?'),
  ('B2', 1, 'People & Places', 'Is there someone you know who will talk for hours about one topic?'),
  ('B2', 1, 'People & Places', 'What do you keep forgetting to do?'),
  ('B2', 1, 'People & Places', 'How do people in your country tend to greet each other?'),
  ('B2', 1, 'People & Places', 'What does your family tend to do when there''s a celebration?'),
  ('B2', 2, 'You, Yours & Opinions', 'Although social media is useful, what problems does it cause?'),
  ('B2', 2, 'You, Yours & Opinions', 'Despite its benefits, why do some people dislike technology?'),
  ('B2', 2, 'You, Yours & Opinions', 'Tell your partner an opinion you hold. Although some disagree, why do you believe it?'),
  ('B2', 2, 'You, Yours & Opinions', 'Despite the cost, is travel worth it?'),
  ('B2', 2, 'You, Yours & Opinions', 'Is there something you like, although you know it''s bad for you?'),
  ('B2', 3, 'Everyday Life & Experiences', 'What have you been doing lately to relax?'),
  ('B2', 3, 'Everyday Life & Experiences', 'How many books have you read this year? What have you been reading?'),
  ('B2', 3, 'Everyday Life & Experiences', 'What have you been working on recently?'),
  ('B2', 3, 'Everyday Life & Experiences', 'What has changed in your routine this year?'),
  ('B2', 3, 'Everyday Life & Experiences', 'How long have you been living in your current home?'),
  ('B2', 4, 'Loves, Hates & Feelings', 'Do you remember feeling nervous on your first day somewhere new?'),
  ('B2', 4, 'Loves, Hates & Feelings', 'What have you stopped doing that made you unhappy?'),
  ('B2', 4, 'Loves, Hates & Feelings', 'Have you ever tried doing something to feel calmer? Did it work?'),
  ('B2', 4, 'Loves, Hates & Feelings', 'What do you always remember to do before you go to sleep?'),
  ('B2', 4, 'Loves, Hates & Feelings', 'What did you stop to look at last time you were out walking?'),
  ('B2', 5, 'Travel & Nature', 'Tell a story about a trip when you had been travelling for hours.'),
  ('B2', 5, 'Travel & Nature', 'Describe a time you had been waiting for a long time. What happened?'),
  ('B2', 5, 'Travel & Nature', 'What had you been doing before you arrived here today?'),
  ('B2', 5, 'Travel & Nature', 'Tell a story about a time nature surprised you.'),
  ('B2', 5, 'Travel & Nature', 'Have you ever been so tired after a journey that you fell asleep immediately?'),
  ('B2', 6, 'Eating & Drinking', 'Has your favourite restaurant been changed or renovated?'),
  ('B2', 6, 'Eating & Drinking', 'Have you ever had a cake made for a celebration?'),
  ('B2', 6, 'Eating & Drinking', 'How is food prepared in your favourite restaurant?'),
  ('B2', 6, 'Eating & Drinking', 'What food will be eaten more in the future?'),
  ('B2', 6, 'Eating & Drinking', 'Where do you have your food delivered from?'),
  ('B2', 7, 'Extraordinary People', 'If you had been born in another country, how would your life have been different?'),
  ('B2', 7, 'Extraordinary People', 'Think of a famous person. What would have happened if they had given up?'),
  ('B2', 7, 'Extraordinary People', 'If you had studied something different, what would you have done?'),
  ('B2', 7, 'Extraordinary People', 'What would have happened if you hadn''t come to this school?'),
  ('B2', 7, 'Extraordinary People', 'Think of a lucky moment. What would have happened if it hadn''t happened?'),
  ('B2', 8, 'Fact or Fiction & Homes', 'A house has been empty for years. What might have happened?'),
  ('B2', 8, 'Fact or Fiction & Homes', 'Someone left a party early. Why might they have left?'),
  ('B2', 8, 'Fact or Fiction & Homes', 'Think of a famous mystery. What must have happened?'),
  ('B2', 8, 'Fact or Fiction & Homes', 'Your friend didn''t answer your messages. What could have happened?'),
  ('B2', 8, 'Fact or Fiction & Homes', 'The lights went out at night. What must have caused it?'),
  ('B2', 9, 'Buying & Selling', 'Describe something you bought online, which you later regretted.'),
  ('B2', 9, 'Buying & Selling', 'Talk about your favourite brand, which you have used for years. Why do you trust it?'),
  ('B2', 9, 'Buying & Selling', 'Do people buying things online spend more?'),
  ('B2', 9, 'Buying & Selling', 'Are clothes made cheaply worth buying?'),
  ('B2', 9, 'Buying & Selling', 'Describe a shop, which you love, in your town.'),
  ('B2', 10, 'Love & Relationships', 'Have you ever done something you should have apologised for?'),
  ('B2', 10, 'Love & Relationships', 'Tell your partner about a time someone could have told you the truth.'),
  ('B2', 10, 'Love & Relationships', 'What should couples have done differently in a famous film?'),
  ('B2', 10, 'Love & Relationships', 'What could you have done better in a past friendship?'),
  ('B2', 10, 'Love & Relationships', 'What advice should you have given a friend?'),
  ('B2', 11, 'Street Life & Technology', 'What will you be doing this time next year?'),
  ('B2', 11, 'Street Life & Technology', 'How will cities have changed by 2050?'),
  ('B2', 11, 'Street Life & Technology', 'What technology will we be using in ten years?'),
  ('B2', 11, 'Street Life & Technology', 'By the end of this course, what will you have learned?'),
  ('B2', 11, 'Street Life & Technology', 'What will people be doing on their phones in the future?'),
  ('B2', 12, 'The World Around Us', 'What do you wish people would do for the environment?'),
  ('B2', 12, 'The World Around Us', 'If only one thing could change in the world, what would it be?'),
  ('B2', 12, 'The World Around Us', 'Do you wish your city was greener?'),
  ('B2', 12, 'The World Around Us', 'What do you wish you did less often?'),
  ('B2', 12, 'The World Around Us', 'What do you wish governments would do now?'),
  ('B2', 13, 'Weekends Away & Free Time', 'What did you use to do at weekends that you don''t do now?'),
  ('B2', 13, 'Weekends Away & Free Time', 'Is there something you''re not used to doing here?'),
  ('B2', 13, 'Weekends Away & Free Time', 'What was hard to get used to when you moved somewhere new?'),
  ('B2', 13, 'Weekends Away & Free Time', 'Are you used to getting up early?'),
  ('B2', 13, 'Weekends Away & Free Time', 'What do you think you''ll never get used to?'),
  ('B2', 14, 'Learning & Studying', 'If you had studied something different, what would you be doing now?'),
  ('B2', 14, 'Learning & Studying', 'If you hadn''t learned English, would you be here today?'),
  ('B2', 14, 'Learning & Studying', 'Where would you be now if you had chosen a different school?'),
  ('B2', 14, 'Learning & Studying', 'If you had started learning English earlier, how would your life be different?'),
  ('B2', 14, 'Learning & Studying', 'If you had taken a gap year, what would you be doing now?'),
  ('B2', 15, 'Keeping in Touch & Plans', 'What did a friend promise you recently?'),
  ('B2', 15, 'Keeping in Touch & Plans', 'Has anyone suggested a plan to you this week?'),
  ('B2', 15, 'Keeping in Touch & Plans', 'Tell your partner about a time someone admitted a mistake.'),
  ('B2', 15, 'Keeping in Touch & Plans', 'What did your family remind you to do before you came here?'),
  ('B2', 15, 'Keeping in Touch & Plans', 'Report a conversation you had recently.'),
  ('B2', 16, 'Going Places', 'Ask your partner politely: ‘Could you tell me …?’ about a place they know.'),
  ('B2', 16, 'Going Places', 'Do you know where the best place to visit in your country is?'),
  ('B2', 16, 'Going Places', 'This is a beautiful city, isn''t it? Discuss.'),
  ('B2', 16, 'Going Places', 'Do you know how long it takes to get to the airport?'),
  ('B2', 16, 'Going Places', 'Could you tell me what you liked most about your last trip?'),
  ('C1', 1, 'People & Places', 'How have you been feeling about the place you''re living in lately?'),
  ('C1', 1, 'People & Places', 'By the time you finished school, how had your ideas about home changed?'),
  ('C1', 1, 'People & Places', 'How long have you been living where you are, and has it started to feel like home?'),
  ('C1', 1, 'People & Places', 'Have you ever felt you belonged somewhere you weren''t from?'),
  ('C1', 1, 'People & Places', 'What had you expected before you came here, and how has reality been different?'),
  ('C1', 2, 'You, Yours & Opinions', 'Do opinions about social media seem to be changing?'),
  ('C1', 2, 'You, Yours & Opinions', 'It could be argued that we share too much online. Do you agree?'),
  ('C1', 2, 'You, Yours & Opinions', 'Do people tend to trust experts less than before?'),
  ('C1', 2, 'You, Yours & Opinions', 'Is there an opinion you seem to have changed over time?'),
  ('C1', 2, 'You, Yours & Opinions', 'It could be argued that everyone''s opinion is equally valid. Is that true?'),
  ('C1', 3, 'Everyday Life & Experiences', 'Looking back, what experience has shaped you most?'),
  ('C1', 3, 'Everyday Life & Experiences', 'Having lived somewhere new, what do you see differently about home?'),
  ('C1', 3, 'Everyday Life & Experiences', 'Describe a routine, explaining why you do it.'),
  ('C1', 3, 'Everyday Life & Experiences', 'Asked about your childhood, what would you remember first?'),
  ('C1', 3, 'Everyday Life & Experiences', 'Having tried something new recently, how did you feel?'),
  ('C1', 4, 'Loves, Hates & Feelings', 'What do you really love, and why?'),
  ('C1', 4, 'Loves, Hates & Feelings', 'What was by far the happiest moment of your year?'),
  ('C1', 4, 'Loves, Hates & Feelings', 'Is there something you do find hard to forgive?'),
  ('C1', 4, 'Loves, Hates & Feelings', 'What is utterly unbearable for you?'),
  ('C1', 4, 'Loves, Hates & Feelings', 'What do you truly believe makes people happy?'),
  ('C1', 5, 'Travel & Nature', 'Describe a place in which you felt completely free.'),
  ('C1', 5, 'Travel & Nature', 'Think of travellers you''ve met, most of whom you never saw again. Who do you remember?'),
  ('C1', 5, 'Travel & Nature', 'Describe a landscape through which you would love to travel.'),
  ('C1', 5, 'Travel & Nature', 'Is there a city to which you''d never return? Why?'),
  ('C1', 5, 'Travel & Nature', 'Describe a trip, during which something changed your view of nature.'),
  ('C1', 6, 'Eating & Drinking', 'What foods are said to be good for your health? Do you believe it?'),
  ('C1', 6, 'Eating & Drinking', 'It is often said that breakfast is the most important meal. Is it?'),
  ('C1', 6, 'Eating & Drinking', 'Which dish is believed to come from your region?'),
  ('C1', 6, 'Eating & Drinking', 'What is coffee or tea thought to do to the body?'),
  ('C1', 6, 'Eating & Drinking', 'Which food trend is said to be harmful?'),
  ('C1', 7, 'Extraordinary People', 'Who is an extraordinary person we rarely hear about? Why are they remarkable?'),
  ('C1', 7, 'Extraordinary People', 'Never have so many people become famous so fast. Why?'),
  ('C1', 7, 'Extraordinary People', 'Not only did they …, but they also … Describe someone whose achievement impressed you.'),
  ('C1', 7, 'Extraordinary People', 'Rarely does someone so young achieve so much. Do you know an example?'),
  ('C1', 7, 'Extraordinary People', 'Seldom do people change the world alone. Do you agree?'),
  ('C1', 8, 'Fact or Fiction & Homes', 'A story goes viral. Might it be fake? How could you know?'),
  ('C1', 8, 'Fact or Fiction & Homes', 'Could a famous historical story have been exaggerated?'),
  ('C1', 8, 'Fact or Fiction & Homes', 'Why might people believe a story that isn''t true?'),
  ('C1', 8, 'Fact or Fiction & Homes', 'A house is empty for years. What might have happened there?'),
  ('C1', 8, 'Fact or Fiction & Homes', 'Could a story you believed as a child have been invented?'),
  ('C1', 9, 'Buying & Selling', 'What has driven the growth of online shopping?'),
  ('C1', 9, 'Buying & Selling', 'What led to the decision to stop using cash in some places?'),
  ('C1', 9, 'Buying & Selling', 'Has there been an increase in second-hand buying where you live?'),
  ('C1', 9, 'Buying & Selling', 'What is behind the rise of influencer marketing?'),
  ('C1', 9, 'Buying & Selling', 'What is the effect of the reduction in prices during sales?'),
  ('C1', 10, 'Love & Relationships', 'Is there anything you wish you''d done differently in a relationship?'),
  ('C1', 10, 'Love & Relationships', 'It''s time we talked about … What topic do couples avoid?'),
  ('C1', 10, 'Love & Relationships', 'Would you rather people told you the truth, even if it hurts?'),
  ('C1', 10, 'Love & Relationships', 'What do you wish people understood about friendship?'),
  ('C1', 10, 'Love & Relationships', 'It''s high time society changed its view on … Discuss.'),
  ('C1', 11, 'Street Life & Technology', 'Technology connects us. Furthermore, how else does it help?'),
  ('C1', 11, 'Street Life & Technology', 'Cameras make streets safer. Nevertheless, what are the risks?'),
  ('C1', 11, 'Street Life & Technology', 'Online shopping is convenient. Nevertheless, what are the consequences for high streets?'),
  ('C1', 11, 'Street Life & Technology', 'Should cities ban cars? Give one argument, then add another with ‘Furthermore, …’.'),
  ('C1', 11, 'Street Life & Technology', 'Social media spreads news fast. Conversely, what problems does it cause?'),
  ('C1', 12, 'The World Around Us', 'What worries you most about the world today?'),
  ('C1', 12, 'The World Around Us', 'It is young people who will solve climate change. Do you agree?'),
  ('C1', 12, 'The World Around Us', 'What we need most right now is … Complete and discuss.'),
  ('C1', 12, 'The World Around Us', 'What surprises you most about other cultures?'),
  ('C1', 12, 'The World Around Us', 'It was … that changed the world most in the last century. Discuss.'),
  ('C1', 13, 'Weekends Away & Free Time', 'Are you going away this weekend? I hope so / I don''t think so. Why?'),
  ('C1', 13, 'Weekends Away & Free Time', 'Would you like to try hiking? If not, why not?'),
  ('C1', 13, 'Weekends Away & Free Time', 'Do you prefer the quiet holiday or the busy one?'),
  ('C1', 13, 'Weekends Away & Free Time', 'I wanted to relax this weekend but didn''t. Have you ever done that?'),
  ('C1', 13, 'Weekends Away & Free Time', 'Do you think free time is more important than money? I think so / I don''t. Why?'),
  ('C1', 14, 'Learning & Studying', 'What are you proud of having achieved?'),
  ('C1', 14, 'Learning & Studying', 'Do students want to be encouraged or challenged?'),
  ('C1', 14, 'Learning & Studying', 'What would you like to have learned by the end of this course?'),
  ('C1', 14, 'Learning & Studying', 'Is it better to be praised or to be criticised honestly?'),
  ('C1', 14, 'Learning & Studying', 'What do you regret not having studied?'),
  ('C1', 15, 'Keeping in Touch & Plans', 'What are you about to start in your life?'),
  ('C1', 15, 'Keeping in Touch & Plans', 'Is anything due to happen soon that you''re excited about?'),
  ('C1', 15, 'Keeping in Touch & Plans', 'Are people bound to lose touch after school or university?'),
  ('C1', 15, 'Keeping in Touch & Plans', 'What plans are you about to make?'),
  ('C1', 15, 'Keeping in Touch & Plans', 'What is bound to change in how we communicate?'),
  ('C1', 16, 'Going Places', 'Had you known what you know now, would you have chosen this school?'),
  ('C1', 16, 'Going Places', 'Were it cheaper, where would you travel?'),
  ('C1', 16, 'Going Places', 'Should you visit my country, what would you want to see?'),
  ('C1', 16, 'Going Places', 'Had you been born in another time, where would you have travelled?'),
  ('C1', 16, 'Going Places', 'Were there no borders, how would travel be different?'),
  ('C2', 1, 'People & Places', 'Strange as it may seem, where do you feel most at home?'),
  ('C2', 1, 'People & Places', 'What place will you never forget, and why?'),
  ('C2', 1, 'People & Places', 'Home is where … Complete and discuss.'),
  ('C2', 1, 'People & Places', 'Odd as it may sound, what do you miss about somewhere you left?'),
  ('C2', 1, 'People & Places', 'Rarely do people choose where they belong. Is that true?'),
  ('C2', 2, 'You, Yours & Opinions', 'Is there an opinion you hold that may well be wrong?'),
  ('C2', 2, 'You, Yours & Opinions', 'Arguably, what is the most misunderstood idea today?'),
  ('C2', 2, 'You, Yours & Opinions', 'Are experts likely to agree on anything important?'),
  ('C2', 2, 'You, Yours & Opinions', 'How certain can we be about anything we read online?'),
  ('C2', 2, 'You, Yours & Opinions', 'Presumably, everyone has a bias. How do you manage yours?'),
  ('C2', 3, 'Everyday Life & Experiences', 'I''ve come to value … What have you come to appreciate?'),
  ('C2', 3, 'Everyday Life & Experiences', 'Are we forever checking our phones, and does it matter?'),
  ('C2', 3, 'Everyday Life & Experiences', 'I was wondering whether routines make us happier. What do you think?'),
  ('C2', 3, 'Everyday Life & Experiences', 'How has your idea of a good life changed over time?'),
  ('C2', 3, 'Everyday Life & Experiences', 'What have you come to realise about everyday life?'),
  ('C2', 4, 'Loves, Hates & Feelings', 'If love were an object, what would it be?'),
  ('C2', 4, 'Loves, Hates & Feelings', 'Describe a feeling using a metaphor.'),
  ('C2', 4, 'Loves, Hates & Feelings', 'When were you last over the moon?'),
  ('C2', 4, 'Loves, Hates & Feelings', 'Is someone ‘determined’ or ‘stubborn’? Discuss words with different feelings.'),
  ('C2', 4, 'Loves, Hates & Feelings', 'What idioms about emotions exist in your language?'),
  ('C2', 5, 'Travel & Nature', 'Describe a landscape, shrouded in mist or bathed in light, that you remember.'),
  ('C2', 5, 'Travel & Nature', 'Exhausted but happy: when did you last feel this way outdoors?'),
  ('C2', 5, 'Travel & Nature', 'Left alone, does nature always recover? Discuss.'),
  ('C2', 5, 'Travel & Nature', 'Surrounded by nature, how do you feel?'),
  ('C2', 5, 'Travel & Nature', 'Describe a journey in vivid, compact sentences.'),
  ('C2', 6, 'Eating & Drinking', 'What has the globalisation of food done to local cuisines?'),
  ('C2', 6, 'Eating & Drinking', 'Is the demand for cheap meat sustainable?'),
  ('C2', 6, 'Eating & Drinking', 'Discuss unequal access to fresh food in cities.'),
  ('C2', 6, 'Eating & Drinking', 'What is the impact of the commercialisation of traditional dishes?'),
  ('C2', 6, 'Eating & Drinking', 'Is the obsession with food photography harmful?'),
  ('C2', 7, 'Extraordinary People', 'Nobody knew he or she was to become famous. Tell the story of someone like this.'),
  ('C2', 7, 'Extraordinary People', 'Who is said to have changed your country''s history?'),
  ('C2', 7, 'Extraordinary People', 'At the time, nobody knew … Describe a surprising turn in someone''s life.'),
  ('C2', 7, 'Extraordinary People', 'Which historical figure would later be seen differently?'),
  ('C2', 7, 'Extraordinary People', 'Ibn Battuta is said to have travelled 120,000 km. What legacy did he leave?'),
  ('C2', 8, 'Fact or Fiction & Homes', 'The house is allegedly haunted. Do you believe stories like this?'),
  ('C2', 8, 'Fact or Fiction & Homes', 'A newspaper concedes it made a mistake. Does that make you trust it more or less?'),
  ('C2', 8, 'Fact or Fiction & Homes', 'How can you tell when a story is purportedly true but isn''t?'),
  ('C2', 8, 'Fact or Fiction & Homes', 'Is there a famous story in your country that many claim is true?'),
  ('C2', 8, 'Fact or Fiction & Homes', 'Can a home really have a history that affects the people living there?'),
  ('C2', 9, 'Buying & Selling', 'So convincing was an advert that I bought the product. Has that happened to you?'),
  ('C2', 9, 'Buying & Selling', 'Little did I know … Tell a story about a purchase you regret.'),
  ('C2', 9, 'Buying & Selling', 'Never before has shopping been so easy. Is that a good thing?'),
  ('C2', 9, 'Buying & Selling', 'Faster, cheaper, better: which matters most to you?'),
  ('C2', 9, 'Buying & Selling', 'Such is the power of advertising that … Complete and discuss.'),
  ('C2', 10, 'Love & Relationships', 'Was your first date not exactly a success? Tell the story.'),
  ('C2', 10, 'Love & Relationships', 'Describe a time someone said ‘lovely’ when they meant the opposite.'),
  ('C2', 10, 'Love & Relationships', 'How do you use understatement or irony in your language?'),
  ('C2', 10, 'Love & Relationships', 'When is irony unkind in a relationship?'),
  ('C2', 10, 'Love & Relationships', 'Is it a tad unwise to fall in love quickly?'),
  ('C2', 11, 'Street Life & Technology', 'Were it not for smartphones, how would daily life be different?'),
  ('C2', 11, 'Street Life & Technology', 'Supposing cars disappeared, how would cities change?'),
  ('C2', 11, 'Street Life & Technology', 'But for technology, what would you be doing right now?'),
  ('C2', 11, 'Street Life & Technology', 'Provided that it''s safe, should cities use more cameras?'),
  ('C2', 11, 'Street Life & Technology', 'Supposing we went back to life before the internet, what would you miss?'),
  ('C2', 12, 'The World Around Us', 'Should it be essential that every country act on climate change now?'),
  ('C2', 12, 'The World Around Us', 'If you could, what would you insist that governments do?'),
  ('C2', 12, 'The World Around Us', 'Recommend that the world change one thing. What would it be?'),
  ('C2', 12, 'The World Around Us', 'Is it vital that rich countries help poorer ones?'),
  ('C2', 12, 'The World Around Us', 'What do you propose that we do about plastic?'),
  ('C2', 13, 'Weekends Away & Free Time', 'Some rest, others travel. Which do you prefer, the former or the latter?'),
  ('C2', 13, 'Weekends Away & Free Time', 'Many plan a break, but few do so. Why?'),
  ('C2', 13, 'Weekends Away & Free Time', 'What is your ideal weekend, and why is this so important?'),
  ('C2', 13, 'Weekends Away & Free Time', 'Do you prefer a city break or a beach one?'),
  ('C2', 13, 'Weekends Away & Free Time', 'Compare two kinds of holiday. The former … whereas the latter …'),
  ('C2', 14, 'Learning & Studying', 'Much as I value exams, … Do exams really measure learning?'),
  ('C2', 14, 'Learning & Studying', 'Notwithstanding the cost, is university worth it?'),
  ('C2', 14, 'Learning & Studying', 'The course was useful, albeit demanding. Describe a class like that.'),
  ('C2', 14, 'Learning & Studying', 'Much as we criticise schools, what do they do well?'),
  ('C2', 14, 'Learning & Studying', 'Is self-taught knowledge as valuable, albeit less recognised?'),
  ('C2', 15, 'Keeping in Touch & Plans', 'It is small messages that keep friendships alive. Do you agree?'),
  ('C2', 15, 'Keeping in Touch & Plans', 'Describe a system whereby you stay in touch with family.'),
  ('C2', 15, 'Keeping in Touch & Plans', 'Friends whose lives move on: do you keep in touch?'),
  ('C2', 15, 'Keeping in Touch & Plans', 'It is not distance that ends friendships, but … Complete.'),
  ('C2', 15, 'Keeping in Touch & Plans', 'What is it that makes some people better at keeping in touch?'),
  ('C2', 16, 'Going Places', 'Describe a journey formally, then informally. What changes?'),
  ('C2', 16, 'Going Places', 'What makes a great piece of travel writing?'),
  ('C2', 16, 'Going Places', 'Choose one precise word to describe your last journey. Why that word?'),
  ('C2', 16, 'Going Places', 'Is a ‘journey’ different from a ‘trip’ or a ‘voyage’?'),
  ('C2', 16, 'Going Places', 'To my mind, the best journeys are … Complete and discuss.')
) as q (level, week, topic, text)
where not exists (select 1 from public.questions where week is not null);

-- ---------------------------------------------------------------------------
-- Writing feedback
-- ---------------------------------------------------------------------------
-- One row per piece of writing a student sent for feedback, written by the
-- assess-writing edge function. Used for the daily limit and to see usage and
-- cost. The writing itself and the feedback are not stored.

create table if not exists public.writing_submissions (
  id bigint generated by default as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  level text not null,
  week integer check (week between 1 and 16),
  word_count integer not null,
  cefr_level text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0
);

create index if not exists writing_submissions_user_day_idx
  on public.writing_submissions (user_id, created_at);

-- Only the edge function (service role) writes; students can see their own.
alter table public.writing_submissions enable row level security;

drop policy if exists "Users can read their own submissions" on public.writing_submissions;
create policy "Users can read their own submissions"
  on public.writing_submissions for select to authenticated
  using (user_id = auth.uid());

grant select on public.writing_submissions to authenticated;

-- Photo readings (handwriting turned into text) are recorded too, with their
-- own daily limit; they have no level estimate.
alter table public.writing_submissions add column if not exists kind text not null default 'feedback'
  check (kind in ('feedback', 'transcribe'));
alter table public.writing_submissions alter column cefr_level drop not null;
drop index if exists writing_submissions_user_day_idx;
create index if not exists writing_submissions_user_kind_day_idx
  on public.writing_submissions (user_id, kind, created_at);


-- ---------------------------------------------------------------------------
-- Tracks: General English, IELTS and Cambridge B2 First on one engine
-- ---------------------------------------------------------------------------
-- Additive only: nothing is dropped or renamed, and existing writing
-- submissions become General English. Safe to run again.
--
-- To enrol a student: find them in Table Editor -> students (by name or
-- student code), then Table Editor -> enrolments -> Insert row, with their
-- id as user_id, the track (e.g. ielts) and their target (e.g. 6.5).

-- The courses. level_scale says how results are reported.
create table if not exists public.tracks (
  id text primary key check (id ~ '^[a-z0-9_]{1,30}$'),
  name text not null check (char_length(name) between 1 and 60),
  level_scale text not null check (level_scale in ('cefr', 'ielts_band', 'cambridge_scale')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;
revoke all on public.tracks from anon, authenticated;
grant select on public.tracks to anon, authenticated;

drop policy if exists "Anyone can read tracks" on public.tracks;
create policy "Anyone can read tracks"
  on public.tracks for select to anon, authenticated
  using (true);

insert into public.tracks (id, name, level_scale, active) values
  ('general', 'General English', 'cefr', true),
  ('ielts', 'IELTS', 'ielts_band', true),
  ('b2_first', 'Cambridge B2 First', 'cambridge_scale', false)
on conflict (id) do nothing;

-- Student records: one row per student who has registered, keyed by their
-- sign-in id, so their work and enrolments follow them. The short code
-- (e.g. K7Q2MX) is what a student reads out so the teacher can find them.
-- Guests who only try the app have no row. Students can create and rename
-- their own row; everything else is managed in the dashboard.
create or replace function public.new_student_code() returns text
language sql volatile set search_path = '' as $$
  -- 6 characters with no 0/O or 1/I/L, so codes are easy to read aloud.
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

create table if not exists public.students (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  student_code text not null unique default public.new_student_code(),
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;
grant select, insert on public.students to authenticated;
grant update (display_name) on public.students to authenticated;

drop policy if exists "Students can read their own record" on public.students;
create policy "Students can read their own record"
  on public.students for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Students can create their own record" on public.students;
create policy "Students can create their own record"
  on public.students for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Students can rename themselves" on public.students;
create policy "Students can rename themselves"
  on public.students for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Which students are on which track, with their target (e.g. '6.5' for
-- IELTS). Only registered students (with a students row) can be enrolled.
-- Students can read their own rows; only the teacher adds them, in the
-- dashboard. Everyone can use General English without a row here.
create table if not exists public.enrolments (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.students (id) on delete cascade,
  track_id text not null references public.tracks (id),
  target text check (char_length(target) <= 20),
  created_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index if not exists enrolments_track_id_idx on public.enrolments (track_id);

alter table public.enrolments enable row level security;
revoke all on public.enrolments from anon, authenticated;
grant select on public.enrolments to authenticated;

drop policy if exists "Students can read their own enrolments" on public.enrolments;
create policy "Students can read their own enrolments"
  on public.enrolments for select to authenticated
  using (user_id = (select auth.uid()));

-- Writing questions for each track. Edit in Table Editor -> writing_prompts;
-- set "active" to false to hide one without deleting it.
create table if not exists public.writing_prompts (
  id bigint generated by default as identity primary key,
  track_id text not null references public.tracks (id),
  task_type text not null check (char_length(task_type) between 1 and 30),
  essay_type text check (char_length(essay_type) <= 40),
  topic text not null check (char_length(topic) between 1 and 60),
  prompt text not null check (char_length(prompt) between 1 and 1000),
  min_words integer not null default 250 check (min_words between 0 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists writing_prompts_track_task_idx on public.writing_prompts (track_id, task_type);

alter table public.writing_prompts enable row level security;
revoke all on public.writing_prompts from anon, authenticated;
grant select on public.writing_prompts to anon, authenticated;

drop policy if exists "Anyone can read active writing prompts" on public.writing_prompts;
create policy "Anyone can read active writing prompts"
  on public.writing_prompts for select to anon, authenticated
  using (active);

-- Submissions now record the track, the task and question, and the band.
-- Existing rows become General English.
alter table public.writing_submissions
  add column if not exists track_id text not null default 'general' references public.tracks (id),
  add column if not exists task_type text check (char_length(task_type) <= 30),
  add column if not exists prompt_id bigint references public.writing_prompts (id) on delete set null,
  add column if not exists band numeric(2, 1) check (band between 0 and 9 and band * 2 = floor(band * 2));

-- Starter IELTS Writing Task 2 questions (written for this app, not past
-- papers), added only if there are none yet.
insert into public.writing_prompts (track_id, task_type, essay_type, topic, prompt)
select 'ielts', 'task2', essay_type, topic, prompt from (values
  ('opinion', 'Technology', 'Some people think that children under the age of twelve should not be allowed to own a smartphone.

To what extent do you agree or disagree?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('opinion', 'Work', 'A four-day working week would benefit both employees and employers.

To what extent do you agree or disagree?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('opinion', 'Environment', 'Governments should make short flights much more expensive so that people choose to travel by train instead.

To what extent do you agree or disagree?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('opinion', 'Culture', 'Cities should spend public money on public art, such as sculptures and murals, even when other services need funding.

To what extent do you agree or disagree?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('opinion', 'Health', 'Shops should not be allowed to place sweets and snacks next to the checkout.

To what extent do you agree or disagree?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('discussion', 'Education', 'Some people believe that schools should spend more time teaching practical skills, such as cooking and managing money. Others think that academic subjects should remain the priority.

Discuss both these views and give your own opinion.

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('discussion', 'Work', 'Some people think that older people should be encouraged to keep working after the usual retirement age. Others believe they should retire to make room for younger workers.

Discuss both these views and give your own opinion.

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('discussion', 'Media', 'Some people believe that news should be free for everyone to read online. Others think people should pay for good-quality journalism.

Discuss both these views and give your own opinion.

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('discussion', 'Cities', 'Some people think that private cars should be banned from city centres. Others feel that this would harm local shops and businesses.

Discuss both these views and give your own opinion.

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('discussion', 'Technology', 'Some people say that artificial intelligence will create more jobs than it replaces. Others believe it will lead to high unemployment.

Discuss both these views and give your own opinion.

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('advantages_disadvantages', 'Work', 'More and more people now work from home for companies based in other countries.

Do the advantages of this outweigh the disadvantages?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('advantages_disadvantages', 'Family', 'In many countries, young adults now live with their parents until their late twenties or even longer.

Do the advantages of this outweigh the disadvantages?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('advantages_disadvantages', 'Education', 'Some schools are replacing printed textbooks with tablets and online materials.

What are the advantages and disadvantages of this change?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('advantages_disadvantages', 'Housing', 'Many growing cities are building tall apartment towers instead of houses with gardens.

Do the advantages of this outweigh the disadvantages?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('advantages_disadvantages', 'Shopping', 'An increasing number of people buy second-hand clothes instead of new ones.

What are the advantages and disadvantages of this trend?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('problem_solution', 'Lifestyle', 'In many places, children spend much less time playing outdoors than children did in the past.

What are the causes of this? What can be done to encourage children to spend more time outside?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('problem_solution', 'Tourism', 'Many popular tourist destinations are becoming overcrowded.

What problems does this cause for local people and for visitors? What can be done to solve them?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('problem_solution', 'Food', 'Every day, a large amount of food is thrown away by households, shops and restaurants.

Why does this happen? What can be done to reduce food waste?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('problem_solution', 'Education', 'In many countries, fewer young people are choosing to train as teachers.

What are the reasons for this? What could be done to attract more people to teaching?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('problem_solution', 'Cities', 'Noise levels in many cities are rising.

What problems does this cause? What measures could be taken to reduce noise?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('two_part', 'Media', 'Many people now get most of their news and information from social media.

Why is this the case? Is this a positive or a negative development?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('two_part', 'Work', 'People today often change careers several times during their working lives.

Why does this happen? Is it a good thing for individuals and for society?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('two_part', 'Learning', 'Some people prefer to learn new skills from online videos rather than from a teacher.

What are the reasons for this? Which way of learning do you think is more effective?

Give reasons for your answer and include relevant examples from your own knowledge or experience.'),
  ('two_part', 'Society', 'In some countries, more and more people are choosing to live alone.

What are the reasons for this trend? What effects does it have on society?

Give reasons for your answer and include relevant examples from your own knowledge or experience.')
) as starter (essay_type, topic, prompt)
where not exists (select 1 from public.writing_prompts where track_id = 'ielts');
