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


-- ---------------------------------------------------------------------------
-- The teacher sets the writing question; only saved accounts get a record
-- ---------------------------------------------------------------------------
-- Additive only. Safe to run again.
--
-- To set this week's IELTS question: Table Editor -> writing_prompts, tick
-- "assigned" on the question (untick last week's). Students see every
-- assigned question for their course, newest first.

alter table public.writing_prompts
  add column if not exists assigned boolean not null default false,
  add column if not exists assigned_at timestamptz;

create index if not exists writing_prompts_assigned_idx
  on public.writing_prompts (track_id, assigned_at desc) where assigned;

-- Fills in assigned_at when a question is ticked, so the newest comes first.
create or replace function public.stamp_assigned_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.assigned and (tg_op = 'INSERT' or not old.assigned) then
    new.assigned_at := now();
  elsif not new.assigned then
    new.assigned_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists writing_prompts_stamp_assigned on public.writing_prompts;
create trigger writing_prompts_stamp_assigned
  before insert or update of assigned on public.writing_prompts
  for each row execute function public.stamp_assigned_at();

-- Start with question 1 (smartphones) set, so the IELTS screen has one.
update public.writing_prompts set assigned = true
where track_id = 'ielts' and topic = 'Technology' and essay_type = 'opinion'
  and not exists (select 1 from public.writing_prompts where track_id = 'ielts' and assigned);

-- Only saved accounts (with an email, not guests) can create a student
-- record, so everyone enrolled on IELTS or B2 First can sign in anywhere.
drop policy if exists "Students can create their own record" on public.students;
create policy "Students can create their own record"
  on public.students for insert to authenticated
  with check (
    id = (select auth.uid())
    and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
  );

-- ---- 2026-11-19: IELTS calibration marks (supabase/updates/2026-11-19-calibration.sql) ----
create table if not exists public.calibration_marks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  question text not null default '',
  essay text not null,
  word_count integer not null,
  model text,
  ai_tr smallint not null check (ai_tr between 0 and 9),
  ai_cc smallint not null check (ai_cc between 0 and 9),
  ai_lr smallint not null check (ai_lr between 0 and 9),
  ai_gra smallint not null check (ai_gra between 0 and 9),
  ai_overall numeric(3, 1) not null,
  teacher_tr smallint not null check (teacher_tr between 0 and 9),
  teacher_cc smallint not null check (teacher_cc between 0 and 9),
  teacher_lr smallint not null check (teacher_lr between 0 and 9),
  teacher_gra smallint not null check (teacher_gra between 0 and 9),
  teacher_overall numeric(3, 1) not null
);

create index if not exists calibration_marks_created_idx on public.calibration_marks (created_at desc);

alter table public.calibration_marks enable row level security;

-- Prototype: anyone signed in (teachers use the app without an account) can
-- add marks and see everyone's, so the check covers every teacher's marks.
drop policy if exists "Signed-in users can add calibration marks" on public.calibration_marks;
create policy "Signed-in users can add calibration marks"
  on public.calibration_marks for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Signed-in users can read calibration marks" on public.calibration_marks;
create policy "Signed-in users can read calibration marks"
  on public.calibration_marks for select to authenticated
  using (true);

drop policy if exists "Teachers can delete their own calibration marks" on public.calibration_marks;
create policy "Teachers can delete their own calibration marks"
  on public.calibration_marks for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saved results, so sending the same writing (or the same photo) again shows
-- the earlier feedback instead of asking Claude again and using up a check.
-- Only the server function reads and writes it (RLS on, no policies). Rows
-- older than CACHE_DAYS (see assess-writing/index.ts) are ignored and deleted.
create table if not exists public.response_cache (
  key text primary key,          -- a fingerprint of the request, not the writing itself
  kind text not null,            -- feedback, ielts, ielts_teacher or transcribe
  response jsonb not null,       -- the feedback or photo reading that was sent back
  created_at timestamptz not null default now()
);

create index if not exists response_cache_created_idx on public.response_cache (created_at);

alter table public.response_cache enable row level security;

-- Sharing a marked essay with other teachers for calibration. A teacher who
-- has marked an essay makes a link (/calibrate/<code>); other teachers open it,
-- give their own bands without seeing the AI's, and their marks are saved in
-- calibration_marks with the code. Links do not expire; nothing is deleted.

create table if not exists public.shared_essays (
  code text primary key check (code ~ '^[A-Z2-9]{6,12}$'),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  question text not null default '',
  essay text not null,
  word_count integer not null,
  model text,
  ai_tr smallint not null check (ai_tr between 0 and 9),
  ai_cc smallint not null check (ai_cc between 0 and 9),
  ai_lr smallint not null check (ai_lr between 0 and 9),
  ai_gra smallint not null check (ai_gra between 0 and 9),
  ai_overall numeric(3, 1) not null,
  -- Paths in the shared-essay-photos storage bucket, page 1 first.
  photo_paths text[] not null default '{}'
);

alter table public.shared_essays enable row level security;

-- Prototype: anyone signed in (teachers use the app without an account) can
-- share an essay, and anyone with the link can open it.
create policy "Signed-in users can share essays"
  on public.shared_essays for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Signed-in users can open shared essays"
  on public.shared_essays for select to authenticated
  using (true);

-- Which shared essay a calibration mark is for (empty for the teacher's own).
alter table public.calibration_marks
  add column if not exists shared_code text references public.shared_essays (code);

create index if not exists calibration_marks_shared_idx on public.calibration_marks (shared_code);

-- The photos of the pages: a private bucket, readable by signed-in users only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-essay-photos', 'shared-essay-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Signed-in users can upload shared essay photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shared-essay-photos');

create policy "Signed-in users can view shared essay photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'shared-essay-photos');

-- "We found each other!": at the start of each round, students first find
-- their partner. One of them taps the button, which marks their own row with
-- the round number. The host can also mark a pair as found; those ids are
-- kept on the session for the current round. The round's question appears
-- once every pair is found (automatically in automatic mode).
alter table public.participants add column if not exists found_round integer;
alter table public.sessions add column if not exists found_ids jsonb not null default '[]'::jsonb;

-- Sharing results openly (no longer a blind test): the shared essay keeps the
-- AI's full feedback, and the teacher who shared it can link their own marks
-- (saved before sharing) to it, so everyone sees all the marks so far.
alter table public.shared_essays add column if not exists feedback jsonb;

create policy "Teachers can link their own calibration marks"
  on public.calibration_marks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Speed friending: fun get-to-know-you questions with no grammar point, in
-- the course's 16 themes (week 1–16), "easier" for A1–A2 classes and
-- "harder" for B1 and up. The app has the same list built in
-- (src/data/fun-questions.ts); once this table has rows, the app uses the
-- table instead, so questions can be edited in the Supabase dashboard.
-- Generated from src/data/fun-questions.ts.

create table if not exists public.fun_questions (
  id bigint generated by default as identity primary key,
  band text not null check (band in ('easier', 'harder')),
  week integer not null check (week between 1 and 16),
  text text not null check (char_length(text) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists fun_questions_band_week_idx on public.fun_questions (band, week);

alter table public.fun_questions enable row level security;

-- Anyone using the app can read them; they are changed in the dashboard.
create policy "Anyone can read fun questions"
  on public.fun_questions for select to anon, authenticated
  using (true);

insert into public.fun_questions (band, week, text) values
  ('easier', 1, 'Show your partner a photo of your hometown. What is your favourite place there?'),
  ('easier', 1, 'Who is in the last photo of a person on your phone? Tell your partner about them.'),
  ('easier', 1, 'Find a photo of your country on your phone or online. Why do you like it?'),
  ('easier', 1, 'What is the best street food in your hometown? Show a picture if you can.'),
  ('harder', 1, 'Show your partner a photo from your country that a tourist would never see. Why is it special to you?'),
  ('harder', 1, 'Find the oldest photo on your phone. Where were you, and who were you with?'),
  ('harder', 1, 'If your hometown were a person, what would they be like? Show a photo that proves it.'),
  ('harder', 1, 'Which three places in your country should your partner visit? Use your phone''s map to show them.'),
  ('easier', 2, 'Show your partner your phone background. Why did you choose it?'),
  ('easier', 2, 'What is your favourite app? Show your partner how you use it.'),
  ('easier', 2, 'Find a photo that shows something you love. Tell your partner about it.'),
  ('easier', 2, 'Are you a morning person or a night person? Show a photo from your best time of day.'),
  ('harder', 2, 'What does your phone background say about you? Guess what your partner''s says about them.'),
  ('harder', 2, 'Show your partner the last thing you bought online. Was it a good idea?'),
  ('harder', 2, 'What''s an opinion you have that most people disagree with? Try to convince your partner.'),
  ('harder', 2, 'Find the 5th photo in your camera roll. Tell the story behind it.'),
  ('easier', 3, 'Show a photo of something you did this week. What happened?'),
  ('easier', 3, 'What do you eat for breakfast? Find a photo of it.'),
  ('easier', 3, 'How do you get to class? Show it on your map.'),
  ('easier', 3, 'What is the last photo you took? Why did you take it?'),
  ('harder', 3, 'Scroll back exactly one month in your photos. What was happening in your life then?'),
  ('harder', 3, 'Show your partner your screen time. Are you surprised? What''s your most-used app?'),
  ('harder', 3, 'Describe your perfect ordinary day, from waking up to going to sleep. What''s different from your real one?'),
  ('harder', 3, 'What''s the funniest thing that happened to you this year? Show a photo if you have one.'),
  ('easier', 4, 'Play your partner 10 seconds of a song you love. Why do you like it?'),
  ('easier', 4, 'Find a photo that makes you happy. Show your partner.'),
  ('easier', 4, 'What food do you hate? Can your partner guess why?'),
  ('easier', 4, 'Show your favourite emoji. When do you use it?'),
  ('harder', 4, 'Show your partner the song you''ve played the most this year. What does it remind you of?'),
  ('harder', 4, 'Which emoji do you use most? Check your keyboard. Does it describe your personality?'),
  ('harder', 4, 'What is something small that makes you really angry? Does your partner feel the same?'),
  ('harder', 4, 'Show a photo from a moment when you felt really proud. What happened?'),
  ('easier', 5, 'Show your partner a photo from a trip. Where were you?'),
  ('easier', 5, 'Beach or mountains? Find a photo of your favourite one.'),
  ('easier', 5, 'Where do you want to go next? Show it on the map.'),
  ('easier', 5, 'Do you have a photo of an animal on your phone? Tell your partner about it.'),
  ('harder', 5, 'Show your partner the most beautiful place you''ve ever been. Would you go back?'),
  ('harder', 5, 'Plan a weekend trip together: you have 200 dollars and one map. Where do you go?'),
  ('harder', 5, 'What''s the worst travel experience you''ve had? Make your partner laugh.'),
  ('harder', 5, 'Find a photo of nature on your phone. Where was it, and why did you stop to take it?'),
  ('easier', 6, 'Show a photo of food from your country. How do you eat it?'),
  ('easier', 6, 'What did you eat yesterday? Find a photo if you can.'),
  ('easier', 6, 'Coffee or tea? How do you like it?'),
  ('easier', 6, 'What food do you miss from home? Show a picture of it.'),
  ('harder', 6, 'Show your partner a dish from your country and explain how to make it, step by step.'),
  ('harder', 6, 'What''s the strangest thing you''ve ever eaten? Would you eat it again?'),
  ('harder', 6, 'Find your favourite restaurant on the map. Sell it to your partner in 30 seconds.'),
  ('harder', 6, 'If you could only eat one country''s food for the rest of your life, which would it be, and why?'),
  ('easier', 7, 'Who is a famous person from your country? Show their photo.'),
  ('easier', 7, 'Who is your hero? Tell your partner about them.'),
  ('easier', 7, 'Show a photo of a friend or family member. What is special about them?'),
  ('easier', 7, 'Who is your favourite singer or actor? Play or show something by them.'),
  ('harder', 7, 'Show your partner someone famous from your country that they have probably never heard of.'),
  ('harder', 7, 'Who in your family has the most interesting story? Tell it in two minutes.'),
  ('harder', 7, 'If you could have dinner with anyone, alive or dead, who would it be? Find their photo.'),
  ('harder', 7, 'What''s the most unusual talent you have? Can you show your partner?'),
  ('easier', 8, 'Show a photo of your room or home. What do you like about it?'),
  ('easier', 8, 'Tell your partner two true things and one lie about you. Can they guess the lie?'),
  ('easier', 8, 'What is your favourite thing in your home? Show a photo.'),
  ('easier', 8, 'Find a photo of a house you love online. Would you like to live there?'),
  ('harder', 8, 'Show your partner three photos. One has a true story, two have stories you invent. Which is true?'),
  ('harder', 8, 'Describe your dream home. Find a picture online that is close to it.'),
  ('harder', 8, 'What''s an object in your home that has a story? Tell it, and show a photo if you can.'),
  ('harder', 8, 'Tell your partner the strangest true story you know. Can they believe it?'),
  ('easier', 9, 'Show your partner the last thing you bought. Do you like it?'),
  ('easier', 9, 'What is your favourite shop? Show it on the map.'),
  ('easier', 9, 'Do you like shopping online or in shops? Why?'),
  ('easier', 9, 'Find something on your phone you want to buy. Show your partner.'),
  ('harder', 9, 'Sell your phone case to your partner. Make it sound amazing. Will they buy it?'),
  ('harder', 9, 'What''s the best thing you''ve ever bought for under 20 dollars? Show it if you can.'),
  ('harder', 9, 'Show your partner something in your online basket. Should you buy it? Let them decide.'),
  ('harder', 9, 'What''s the worst thing you''ve ever bought? Why did you buy it?'),
  ('easier', 10, 'Show a photo of your best friend. How did you meet?'),
  ('easier', 10, 'Who do you message the most? What do you talk about?'),
  ('easier', 10, 'Do you have a pet? Show a photo, or show the pet you want.'),
  ('easier', 10, 'What makes a good friend? Tell your partner three things.'),
  ('harder', 10, 'Show your partner the last voice message or photo a friend sent you (if it''s OK to share). What''s the story?'),
  ('harder', 10, 'How did your best friendship begin? Was it love at first sight?'),
  ('harder', 10, 'What''s a romantic story from your family? How did your parents or grandparents meet?'),
  ('harder', 10, 'Show a photo of someone who changed your life. What did they do?'),
  ('easier', 11, 'Show your partner a photo of a street you like. Where is it?'),
  ('easier', 11, 'What app do you use every day? Show it to your partner.'),
  ('easier', 11, 'Take a photo of something interesting near you now. Show your partner.'),
  ('easier', 11, 'What is your favourite game on your phone? Show your partner how to play.'),
  ('harder', 11, 'Show your partner an app they don''t have but should. Convince them to download it.'),
  ('harder', 11, 'What would your life be like without a phone for a week? Could you do it?'),
  ('harder', 11, 'Find a photo of street life from your country. What sounds and smells go with it?'),
  ('harder', 11, 'What''s the most useful thing your phone does that people your grandparents'' age wouldn''t believe?'),
  ('easier', 12, 'Show the weather in your hometown today on your phone. Do you like it?'),
  ('easier', 12, 'Find a photo of the sky, the sea or a tree. Why did you take it?'),
  ('easier', 12, 'What is the best season in your country? Show a photo.'),
  ('easier', 12, 'What animal do you like? Find a photo and show your partner.'),
  ('harder', 12, 'Compare the weather in your hometown and here today on your phones. Which do you prefer?'),
  ('harder', 12, 'Show your partner a place in your country that has changed a lot. What happened?'),
  ('harder', 12, 'If you could protect one place in the world, which would it be? Show it.'),
  ('harder', 12, 'What''s something people from your country do that the world could learn from?'),
  ('easier', 13, 'Show a photo from last weekend. What did you do?'),
  ('easier', 13, 'What is your hobby? Show a photo or video of it.'),
  ('easier', 13, 'Do you like sport? Show your favourite team or player.'),
  ('easier', 13, 'Plan a fun day this weekend with your partner. Where will you go?'),
  ('harder', 13, 'Show your partner your best weekend photo ever. Tell the whole story.'),
  ('harder', 13, 'What''s a hobby you started and gave up? Show proof if you have it.'),
  ('harder', 13, 'Plan the perfect weekend for your partner. Ask them three questions first.'),
  ('harder', 13, 'What do you do when you have a free afternoon and no plans? Show a photo of it.'),
  ('easier', 14, 'Show a photo of your school or a place where you study.'),
  ('easier', 14, 'What is your favourite English word? Why?'),
  ('easier', 14, 'What app helps you learn? Show your partner.'),
  ('easier', 14, 'Teach your partner one word in your language.'),
  ('harder', 14, 'Teach your partner a useful phrase in your language. Can they say it correctly?'),
  ('harder', 14, 'Show a photo from your school days. What kind of student were you?'),
  ('harder', 14, 'What''s something you learned from YouTube or TikTok? Show the video.'),
  ('harder', 14, 'If you could learn any skill in one day, what would it be, and why?'),
  ('easier', 15, 'Who did you message today? What did you say?'),
  ('easier', 15, 'Show a photo of your family or friends far away. Where are they?'),
  ('easier', 15, 'What are you doing after class today?'),
  ('easier', 15, 'Make a plan to meet your partner for coffee. When and where?'),
  ('harder', 15, 'Show your partner the funniest group chat name or sticker you have.'),
  ('harder', 15, 'How do you keep in touch with people at home? Show the app you use most for it.'),
  ('harder', 15, 'Where do you see yourself in five years? Find a photo that shows it.'),
  ('harder', 15, 'Make a real plan with your partner for something fun this week. Where, when, and who else comes?'),
  ('easier', 16, 'Where is the last place you went? Show it on the map.'),
  ('easier', 16, 'Show a photo of a bus, train or plane trip. Where were you going?'),
  ('easier', 16, 'What place in this city do you like? Show your partner.'),
  ('easier', 16, 'Where do you want to go one day? Show a photo.'),
  ('harder', 16, 'Show your partner your favourite secret spot in this city. Why do you love it?'),
  ('harder', 16, 'What''s the longest journey you''ve ever made? Show where it started and ended on a map.'),
  ('harder', 16, 'You can go anywhere tomorrow, for free, for one day. Where? Show your partner.'),
  ('harder', 16, 'Find a place on the map you''ve never heard of. Make up a story about it together.');

-- Class sets: a teacher uploads a scan (or photos) of a class's writing, one
-- page per student. Each page is read, given General English feedback, and
-- saved under the student's name, so each student's progress (overall and
-- per area: Content, Organisation, Grammar, Vocabulary) can be charted later.
-- Teachers have no accounts yet, so a class set belongs to the device (the
-- anonymous user) that made it.

create table if not exists public.class_sets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null default '',
  class_name text not null default '',
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  task text not null default '',
  grammar_focus text not null default '',
  file_name text not null default '',
  page_count integer not null default 0
);

create table if not exists public.class_set_pages (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.class_sets (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page_number integer not null,
  -- The student's name as shown, and the same in lower case: the key for progress.
  student_name text not null default '',
  student_key text not null default '',
  photo_path text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'reading', 'marking', 'done', 'error')),
  error text,
  transcript text,
  sheet jsonb,
  feedback jsonb,
  cefr_level text,
  -- The AI's level per area: { "Content": "A2", "Organisation": "A1", ... }.
  area_levels jsonb,
  updated_at timestamptz not null default now(),
  unique (set_id, page_number)
);

create index if not exists class_sets_created_by_idx on public.class_sets (created_by, created_at desc);
create index if not exists class_set_pages_student_idx on public.class_set_pages (created_by, student_key);

alter table public.class_sets enable row level security;
alter table public.class_set_pages enable row level security;

create policy "Teachers manage their own class sets"
  on public.class_sets for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Teachers manage their own class set pages"
  on public.class_set_pages for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- The pages' photos: a private bucket; each teacher's files sit in a folder
-- named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-set-photos', 'class-set-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Teachers upload their own class set photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'class-set-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Teachers view their own class set photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'class-set-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Class writing: the teacher's classes (3A, 3B …) with a target level, and
-- the students in each class. Every class set belongs to a class, and every
-- page is linked to a student, so each student's writing can be followed
-- over time. Like class sets, these belong to the teacher's user (a saved
-- account follows the teacher across devices).

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 40),
  -- The level the class is working towards, e.g. "A2+".
  target_level text not null check (target_level in ('A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'))
);

create unique index if not exists classes_name_idx on public.classes (created_by, lower(name));

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  student_key text not null,
  unique (class_id, student_key)
);

alter table public.class_sets add column if not exists class_id uuid references public.classes (id) on delete set null;
alter table public.class_set_pages add column if not exists student_id uuid references public.class_students (id) on delete set null;

create index if not exists class_sets_class_idx on public.class_sets (class_id, created_at desc);
create index if not exists class_set_pages_student_id_idx on public.class_set_pages (student_id);

alter table public.classes enable row level security;
alter table public.class_students enable row level security;

create policy "Teachers manage their own classes"
  on public.classes for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Teachers manage their own students"
  on public.class_students for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- Teacher logins: a teacher signs in with a username and password (a made-up
-- login email username@teachers.language-gym.invalid, so no email is sent).
-- The first teacher account is created by the owner; after that only
-- teachers can add teachers (the teacher-account edge function).
-- Class writing (classes, students, marked writing, page photos) is for
-- teachers only: restrictive policies add "and is a teacher" to the existing
-- "only your own" policies.

create table if not exists public.teachers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;

-- Teachers can see the list of teachers; changes go through the edge function.
-- True when the signed-in user is a teacher.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

-- How many teachers there are (the app offers "create the first teacher" only when 0).
create or replace function public.teacher_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.teachers;
$$;

grant execute on function public.is_teacher() to anon, authenticated;
grant execute on function public.teacher_count() to anon, authenticated;

-- Teachers can see the list of teachers; changes go through the edge function.
create policy "Teachers can see the teachers"
  on public.teachers for select to authenticated
  using ((select public.is_teacher()));

create policy "Only teachers: classes"
  on public.classes as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "Only teachers: class students"
  on public.class_students as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "Only teachers: class sets"
  on public.class_sets as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "Only teachers: class set pages"
  on public.class_set_pages as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

-- The class writing photos, too (other buckets are not affected).
create policy "Only teachers: class set photos"
  on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'class-set-photos' or (select public.is_teacher()))
  with check (bucket_id <> 'class-set-photos' or (select public.is_teacher()));

-- Speed friending: new questions for every level (A1 to C2) in eight of the
-- more fun themes (weeks 4, 5, 6, 7, 8, 10, 13, 16), ten each. Each student
-- gets their own question to ask their partner. Replaces fun_questions (kept,
-- no longer used by the app).

create table if not exists public.friending_questions (
  id bigint generated by default as identity primary key,
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  week integer not null check (week between 1 and 16),
  text text not null check (char_length(text) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists friending_questions_level_week_idx on public.friending_questions (level, week);

alter table public.friending_questions enable row level security;

-- Anyone using the app can read them; they are changed in the dashboard.
create policy "Anyone can read friending questions"
  on public.friending_questions for select to anon, authenticated
  using (true);

insert into public.friending_questions (level, week, text) values
  ('A1', 4, 'What food do you love?'),
  ('A1', 4, 'What food do you hate?'),
  ('A1', 4, 'What is your favourite colour? Why?'),
  ('A1', 4, 'What makes you happy?'),
  ('A1', 4, 'Do you like cats or dogs?'),
  ('A1', 4, 'What is your favourite song?'),
  ('A1', 4, 'What do you do when you are sad?'),
  ('A1', 4, 'Do you like the rain?'),
  ('A1', 4, 'What is your favourite day of the week?'),
  ('A1', 4, 'What animal do you not like?'),
  ('A2', 4, 'What is something you really love doing at the weekend?'),
  ('A2', 4, 'What housework do you hate the most?'),
  ('A2', 4, 'What made you laugh last week?'),
  ('A2', 4, 'What song do you always sing along to?'),
  ('A2', 4, 'What were you afraid of when you were a child?'),
  ('A2', 4, 'What is the best present you ever got?'),
  ('A2', 4, 'What makes you angry when you are on the bus or train?'),
  ('A2', 4, 'Which smell do you love?'),
  ('A2', 4, 'What is your favourite season, and why?'),
  ('A2', 4, 'What makes you feel relaxed?'),
  ('B1', 4, 'What is something most people love that you just don’t understand?'),
  ('B1', 4, 'What is a small thing that always puts you in a good mood?'),
  ('B1', 4, 'When was the last time you felt really proud of yourself?'),
  ('B1', 4, 'What is a habit other people have that drives you crazy?'),
  ('B1', 4, 'Which song brings back a strong memory for you?'),
  ('B1', 4, 'What is something you hated as a child but love now?'),
  ('B1', 4, 'What do you do when you feel stressed?'),
  ('B1', 4, 'What is the most embarrassing thing that has happened to you?'),
  ('B1', 4, 'What is a sound you can’t stand?'),
  ('B1', 4, 'What is something you get really excited about?'),
  ('B2', 4, 'What is an unpopular opinion you have about food or music?'),
  ('B2', 4, 'Which do you find harder to hide: being bored or being annoyed?'),
  ('B2', 4, 'What is something that you used to hate but have grown to love?'),
  ('B2', 4, 'If you could get rid of one everyday annoyance forever, what would it be?'),
  ('B2', 4, 'What is the most nervous you’ve ever been, and how did it turn out?'),
  ('B2', 4, 'What is a guilty pleasure you’re slightly embarrassed to admit?'),
  ('B2', 4, 'Do you think it’s better to show your feelings or keep them to yourself?'),
  ('B2', 4, 'What is something that never fails to cheer you up after a bad day?'),
  ('B2', 4, 'Is there a film or book that made you cry? What was it about?'),
  ('B2', 4, 'What would your perfect lazy Sunday look like?'),
  ('C1', 4, 'What is a pet hate of yours that other people seem not to notice at all?'),
  ('C1', 4, 'Which of your tastes has changed the most over the years, and why do you think it changed?'),
  ('C1', 4, 'Is nostalgia a pleasant feeling for you, or does it make you a bit sad?'),
  ('C1', 4, 'What is something you’re irrationally attached to?'),
  ('C1', 4, 'Are you someone who wears your heart on your sleeve, or are you hard to read?'),
  ('C1', 4, 'What is the most overrated thing everyone else seems to love?'),
  ('C1', 4, 'What kind of humour do you find funniest, and what falls flat for you?'),
  ('C1', 4, 'When did you last change your mind about something you felt strongly about?'),
  ('C1', 4, 'What small luxury would you find it hardest to give up?'),
  ('C1', 4, 'Which emotion do you find hardest to deal with, and how do you handle it?'),
  ('C2', 4, 'What is something you love that you find surprisingly hard to put into words?'),
  ('C2', 4, 'Is there a pleasure you enjoy more for the anticipation than the thing itself?'),
  ('C2', 4, 'Which of your pet peeves says the most about your personality?'),
  ('C2', 4, 'Do you think we choose what we love, or does it choose us?'),
  ('C2', 4, 'What is a feeling that your first language has a word for but English doesn’t?'),
  ('C2', 4, 'What is the most unexpected thing that has ever moved you to tears or laughter?'),
  ('C2', 4, 'Would you rather be loved by many people or deeply understood by a few?'),
  ('C2', 4, 'Which do you trust more: your first impressions or your second thoughts?'),
  ('C2', 4, 'What is a taste you acquired that you’re now oddly proud of?'),
  ('C2', 4, 'If your mood today were a type of weather, what would it be, and why?'),
  ('A1', 5, 'Do you like the beach or the mountains?'),
  ('A1', 5, 'What country do you want to visit?'),
  ('A1', 5, 'Do you like hot or cold weather?'),
  ('A1', 5, 'What is your favourite animal?'),
  ('A1', 5, 'Do you like walking in the park?'),
  ('A1', 5, 'Where is a beautiful place in your country?'),
  ('A1', 5, 'Do you like trains or planes?'),
  ('A1', 5, 'Do you have a garden?'),
  ('A1', 5, 'What is the weather like in your country now?'),
  ('A1', 5, 'Do you like swimming in the sea?'),
  ('A2', 5, 'Where did you go on your last holiday?'),
  ('A2', 5, 'What is the most beautiful place you have ever visited?'),
  ('A2', 5, 'Do you prefer holidays in a city or in the countryside?'),
  ('A2', 5, 'What do you always pack in your bag when you travel?'),
  ('A2', 5, 'Have you ever camped outside? What was it like?'),
  ('A2', 5, 'Which animal would you like to see in the wild?'),
  ('A2', 5, 'What is the longest journey you have made?'),
  ('A2', 5, 'Do you like travelling alone or with friends?'),
  ('A2', 5, 'What was the weather like on your best holiday?'),
  ('A2', 5, 'Where would you like to go next year?'),
  ('B1', 5, 'What is the best trip you have ever been on? What made it so good?'),
  ('B1', 5, 'Have you ever got lost while travelling? What happened?'),
  ('B1', 5, 'Would you rather visit a famous city or a quiet island? Why?'),
  ('B1', 5, 'What is something you always do when you arrive in a new place?'),
  ('B1', 5, 'What is a place in nature where you feel really calm?'),
  ('B1', 5, 'Have you ever seen a wild animal up close?'),
  ('B1', 5, 'What is the worst weather you have experienced on holiday?'),
  ('B1', 5, 'Do you plan your trips carefully or just see what happens?'),
  ('B1', 5, 'Which country’s landscape would you most like to see?'),
  ('B1', 5, 'What souvenir have you kept the longest?'),
  ('B2', 5, 'What’s the most adventurous thing you’ve ever done while travelling?'),
  ('B2', 5, 'If you could spend a month anywhere in the world for free, where would you go?'),
  ('B2', 5, 'Have you ever had a travel experience that completely changed how you saw a place?'),
  ('B2', 5, 'Would you rather go somewhere you know you’ll love, or somewhere totally unknown?'),
  ('B2', 5, 'What is something tourists in your country usually get wrong?'),
  ('B2', 5, 'Have you ever been somewhere so beautiful it didn’t feel real?'),
  ('B2', 5, 'What’s the strangest food or custom you’ve come across abroad?'),
  ('B2', 5, 'Do you think travelling makes people more open-minded? Why, or why not?'),
  ('B2', 5, 'What would your ideal day in nature involve?'),
  ('B2', 5, 'What’s a place you’d love to show a foreign friend, and why?'),
  ('C1', 5, 'Is there a place you’ve travelled to that you’d genuinely consider moving to?'),
  ('C1', 5, 'What’s the difference between being a traveller and being a tourist, in your view?'),
  ('C1', 5, 'Have you ever experienced real culture shock? How did you get through it?'),
  ('C1', 5, 'What journey, rather than destination, has stayed with you the most?'),
  ('C1', 5, 'Do you think it’s possible to really know a place after only a week there?'),
  ('C1', 5, 'Which natural landscape would you choose to wake up to every morning?'),
  ('C1', 5, 'What travel mistake taught you the most?'),
  ('C1', 5, 'How has the way you travel changed as you’ve got older?'),
  ('C1', 5, 'Is there anywhere you’d never want to go back to, however beautiful?'),
  ('C1', 5, 'What does a perfect holiday say about the person who chooses it?'),
  ('C2', 5, 'Have you ever felt more at home somewhere foreign than in your own country?'),
  ('C2', 5, 'Is the urge to travel about discovering places or escaping your own routine?'),
  ('C2', 5, 'Which place has a reputation that, in your experience, it doesn’t quite live up to?'),
  ('C2', 5, 'What landscape best captures how you feel about your childhood?'),
  ('C2', 5, 'Should some of the world’s most beautiful places be closed to tourists altogether?'),
  ('C2', 5, 'What’s the most unexpected kindness you’ve received from a stranger while travelling?'),
  ('C2', 5, 'If you could relive one journey exactly as it happened, which would it be?'),
  ('C2', 5, 'Does seeing a place on a screen first spoil the experience of visiting it?'),
  ('C2', 5, 'What does nature give you that cities never can, or the other way round?'),
  ('C2', 5, 'Where would you go to be completely alone for a week, and why?'),
  ('A1', 6, 'What do you eat for breakfast?'),
  ('A1', 6, 'Do you like coffee or tea?'),
  ('A1', 6, 'What is your favourite fruit?'),
  ('A1', 6, 'Do you like cooking?'),
  ('A1', 6, 'What food is famous in your country?'),
  ('A1', 6, 'Do you like pizza?'),
  ('A1', 6, 'What do you drink every day?'),
  ('A1', 6, 'Do you like sweet food?'),
  ('A1', 6, 'What is your favourite restaurant?'),
  ('A1', 6, 'Do you eat meat or fish?'),
  ('A2', 6, 'What did you eat for dinner yesterday?'),
  ('A2', 6, 'What food from your country do you miss?'),
  ('A2', 6, 'Can you cook? What can you make?'),
  ('A2', 6, 'What is the strangest food you have eaten?'),
  ('A2', 6, 'Do you prefer eating at home or in a restaurant?'),
  ('A2', 6, 'What did you eat when you were a child that you don’t eat now?'),
  ('A2', 6, 'What is a typical breakfast in your country?'),
  ('A2', 6, 'What is your favourite snack?'),
  ('A2', 6, 'Have you tried any British food? Did you like it?'),
  ('A2', 6, 'What food do you eat on special days in your country?'),
  ('B1', 6, 'What is the best meal you have ever had? Where were you?'),
  ('B1', 6, 'If you could only eat one dish for a week, what would it be?'),
  ('B1', 6, 'What food from your country would you recommend to a visitor?'),
  ('B1', 6, 'Have you ever cooked something that went really wrong?'),
  ('B1', 6, 'What is a food you hated as a child but like now?'),
  ('B1', 6, 'Do you think food in this country is better or worse than at home?'),
  ('B1', 6, 'What is your favourite thing to order at a café?'),
  ('B1', 6, 'Who is the best cook in your family?'),
  ('B1', 6, 'What food do you eat when you feel sad?'),
  ('B1', 6, 'What is the most expensive meal you have ever had? Was it worth it?'),
  ('B2', 6, 'What’s a dish you could eat every day without getting bored?'),
  ('B2', 6, 'Is there a food you were afraid to try but ended up loving?'),
  ('B2', 6, 'What does a typical family meal look like in your home?'),
  ('B2', 6, 'Would you rather give up chocolate or coffee for a year?'),
  ('B2', 6, 'What’s a food combination you love that most people find weird?'),
  ('B2', 6, 'Have you ever had a memorable meal with complete strangers?'),
  ('B2', 6, 'What do you think people from your country eat too much of?'),
  ('B2', 6, 'If you opened a restaurant, what kind of food would you serve?'),
  ('B2', 6, 'What’s the best street food you’ve ever had?'),
  ('B2', 6, 'Are you an adventurous eater, or do you stick to what you know?'),
  ('C1', 6, 'What food instantly takes you back to a particular moment in your life?'),
  ('C1', 6, 'How do eating habits in your country differ from here, and which do you prefer?'),
  ('C1', 6, 'Is cooking something you find relaxing or a chore you’d rather avoid?'),
  ('C1', 6, 'Which dish from your culture do you think is most misunderstood abroad?'),
  ('C1', 6, 'What would be on the menu at your perfect dinner party, and who would you invite?'),
  ('C1', 6, 'Have your eating habits changed since you moved here?'),
  ('C1', 6, 'Do you think the way a family eats together says something about the family?'),
  ('C1', 6, 'What’s the most memorable thing you’ve eaten while travelling?'),
  ('C1', 6, 'Are there any food rules in your culture that you’ve stopped following?'),
  ('C1', 6, 'What’s a recipe you’d want to pass on to the next generation?'),
  ('C2', 6, 'Is there a meal that you associate so strongly with someone that you can’t eat it without thinking of them?'),
  ('C2', 6, 'Do you think good food has to be complicated, or is simplicity the real test?'),
  ('C2', 6, 'What does your country’s food reveal about its history?'),
  ('C2', 6, 'Have you ever eaten something purely out of politeness that you’d never choose again?'),
  ('C2', 6, 'Is a shared meal still the best way to get to know someone?'),
  ('C2', 6, 'What’s a taste you think you’ll never be able to describe properly to someone who hasn’t tried it?'),
  ('C2', 6, 'Would you rather have the world’s best chef cook for you once, or a good cook every day?'),
  ('C2', 6, 'Which food trend do you think will look ridiculous in twenty years?'),
  ('C2', 6, 'What’s a culinary rule from your culture that you secretly think is nonsense?'),
  ('C2', 6, 'If your personality were a dish, what would it be, and why?'),
  ('A1', 7, 'Who is your hero?'),
  ('A1', 7, 'Who is a famous person from your country?'),
  ('A1', 7, 'Who is your favourite singer?'),
  ('A1', 7, 'Who is your best friend?'),
  ('A1', 7, 'Who is your favourite actor?'),
  ('A1', 7, 'Who is the funniest person you know?'),
  ('A1', 7, 'Is there a famous sports player you like?'),
  ('A1', 7, 'Who do you talk to every day?'),
  ('A1', 7, 'Who is the oldest person in your family?'),
  ('A1', 7, 'Who is a kind person in your life?'),
  ('A2', 7, 'Who is someone you admire? Why?'),
  ('A2', 7, 'Have you ever met a famous person?'),
  ('A2', 7, 'Who was your favourite teacher at school?'),
  ('A2', 7, 'Who in your family is very good at something?'),
  ('A2', 7, 'Which famous person would you like to have dinner with?'),
  ('A2', 7, 'Who helped you a lot when you were young?'),
  ('A2', 7, 'Who is the most interesting person you have met here?'),
  ('A2', 7, 'Which singer or band did you love as a teenager?'),
  ('A2', 7, 'Who is the bravest person you know?'),
  ('A2', 7, 'What famous person from history would you like to meet?'),
  ('B1', 7, 'Who is someone from your country that everyone should know about?'),
  ('B1', 7, 'Who has had the biggest influence on your life so far?'),
  ('B1', 7, 'If you could spend a day with any famous person, who would it be and what would you do?'),
  ('B1', 7, 'Who is the most talented person you know personally?'),
  ('B1', 7, 'Have you ever met someone who completely surprised you?'),
  ('B1', 7, 'What famous person do you think is overrated?'),
  ('B1', 7, 'Who is a good role model for young people today?'),
  ('B1', 7, 'Which person in your family has the most interesting life story?'),
  ('B1', 7, 'What would you ask your hero if you met them?'),
  ('B1', 7, 'Who do you go to for advice? Why them?'),
  ('B2', 7, 'Who is an ordinary person you know who does something extraordinary?'),
  ('B2', 7, 'If someone wrote a book about your life, who would you want to write it?'),
  ('B2', 7, 'Which historical figure do you think was misunderstood?'),
  ('B2', 7, 'Have you ever met someone who changed the way you think?'),
  ('B2', 7, 'Who would you swap lives with for a week, and why?'),
  ('B2', 7, 'Is there a celebrity whose life you definitely wouldn’t want? Why not?'),
  ('B2', 7, 'What makes someone a true hero, in your opinion?'),
  ('B2', 7, 'Who is the most interesting stranger you’ve ever had a conversation with?'),
  ('B2', 7, 'Which person from your country’s history should be more famous abroad?'),
  ('B2', 7, 'Who would play you in a film about your life?'),
  ('C1', 7, 'Who is someone whose life story genuinely inspires you, and why that story in particular?'),
  ('C1', 7, 'Do you think extraordinary people are born that way, or made by their circumstances?'),
  ('C1', 7, 'Is there a public figure you used to admire but have changed your mind about?'),
  ('C1', 7, 'Who in your life has taught you something without ever meaning to?'),
  ('C1', 7, 'Which living person do you think will be remembered in a hundred years?'),
  ('C1', 7, 'Have you ever met someone famous and found them completely different from their image?'),
  ('C1', 7, 'What quality do you most admire in other people, and do you have it yourself?'),
  ('C1', 7, 'Who is the most unusual person you’ve ever met?'),
  ('C1', 7, 'If you could ask one question to anyone in history, who and what would it be?'),
  ('C1', 7, 'Who do you think is quietly making the world better without getting any credit?'),
  ('C2', 7, 'Whose approach to life do you secretly envy, even if you’d never admit it to them?'),
  ('C2', 7, 'Is it possible to admire someone’s work while disliking them as a person?'),
  ('C2', 7, 'Who has shaped your sense of humour the most?'),
  ('C2', 7, 'Which famous person’s fall from grace surprised you the most, and why?'),
  ('C2', 7, 'Do we need heroes, or are they a convenient myth?'),
  ('C2', 7, 'Who is the most quietly remarkable person you’ve ever known?'),
  ('C2', 7, 'If your life were narrated by someone famous, whose voice would you choose?'),
  ('C2', 7, 'What would people who know you well say is your most extraordinary quality?'),
  ('C2', 7, 'Which person from your family history would you most like to have a conversation with?'),
  ('C2', 7, 'Is genius more about talent or obsession?'),
  ('A1', 8, 'Do you live in a house or a flat?'),
  ('A1', 8, 'How many rooms are in your home?'),
  ('A1', 8, 'What is your favourite room?'),
  ('A1', 8, 'Tell me two true things and one false thing about you. Can I guess the false one?'),
  ('A1', 8, 'What colour is your bedroom?'),
  ('A1', 8, 'Do you live with your family?'),
  ('A1', 8, 'What is in your kitchen?'),
  ('A1', 8, 'Do you have a big window?'),
  ('A1', 8, 'What is near your home?'),
  ('A1', 8, 'Do you like your home? Why?'),
  ('A2', 8, 'What is your favourite thing in your home?'),
  ('A2', 8, 'Describe the house where you lived as a child.'),
  ('A2', 8, 'Tell me three facts about you. One is not true. Guess which!'),
  ('A2', 8, 'What would you change about your room?'),
  ('A2', 8, 'Do you prefer living in a city or a small town?'),
  ('A2', 8, 'Who do you live with now? Is it easy?'),
  ('A2', 8, 'What is your dream house like?'),
  ('A2', 8, 'Have you ever lived in another country before?'),
  ('A2', 8, 'What do you do at home on a rainy day?'),
  ('A2', 8, 'Do you keep your room tidy or messy?'),
  ('B1', 8, 'Tell me a true story that sounds made up. Can I believe it?'),
  ('B1', 8, 'What is the strangest place you have ever slept?'),
  ('B1', 8, 'Describe your dream home in as much detail as you can.'),
  ('B1', 8, 'What is one thing you always have in your bedroom?'),
  ('B1', 8, 'Would you rather live in a castle or a treehouse? Why?'),
  ('B1', 8, 'Have you ever lived with someone who was difficult to live with?'),
  ('B1', 8, 'What do you miss most about your home in your country?'),
  ('B1', 8, 'Do you believe in ghosts? Have you ever heard a ghost story you believed?'),
  ('B1', 8, 'What makes a place feel like home to you?'),
  ('B1', 8, 'Tell me two stories about your childhood: one true, one invented. Which is real?'),
  ('B2', 8, 'What’s the most unbelievable thing that has ever happened to you, which is completely true?'),
  ('B2', 8, 'If money were no object, where and how would you live?'),
  ('B2', 8, 'What’s a rumour or myth you believed for years?'),
  ('B2', 8, 'What does your choice of home say about your personality?'),
  ('B2', 8, 'Have you ever had a flatmate horror story?'),
  ('B2', 8, 'Tell me three things about your family; I’ll guess which one you made up.'),
  ('B2', 8, 'Would you rather live somewhere with an amazing view or an amazing location?'),
  ('B2', 8, 'Do you think the place you grew up shaped who you are?'),
  ('B2', 8, 'What’s an urban legend from your country?'),
  ('B2', 8, 'If your home could have one magical feature, what would it be?'),
  ('C1', 8, 'What’s a story from your life that people never believe, even though it’s true?'),
  ('C1', 8, 'Is “home” a place, a group of people, or a feeling, for you?'),
  ('C1', 8, 'Which conspiracy theory do you find the most entertaining, even if you don’t believe it?'),
  ('C1', 8, 'How would you describe the house you grew up in to someone who will never see it?'),
  ('C1', 8, 'Have you ever lived somewhere that never felt like home? Why not?'),
  ('C1', 8, 'What’s an object you’d save first if you had to leave your home in a hurry?'),
  ('C1', 8, 'Tell me about your family history: one detail should be invented. Can I spot it?'),
  ('C1', 8, 'Do you think people put too much importance on owning their own home?'),
  ('C1', 8, 'What’s the most convincing lie you’ve ever been told?'),
  ('C1', 8, 'If the walls of your childhood home could talk, what would they say about you?'),
  ('C2', 8, 'Is there a family story that’s probably been exaggerated over the years? What’s the “official” version?'),
  ('C2', 8, 'At what point did you start thinking of a new place as home?'),
  ('C2', 8, 'Which piece of misinformation do you think has done the most harm in your lifetime?'),
  ('C2', 8, 'Can a hotel room ever feel like home, or is that a contradiction?'),
  ('C2', 8, 'Tell me a story so improbable that I have to decide whether you’re joking.'),
  ('C2', 8, 'What does the way someone decorates their home tell you about them?'),
  ('C2', 8, 'Is a good story worth more than an accurate one?'),
  ('C2', 8, 'What would your ideal home look like if comfort mattered more than appearance?'),
  ('C2', 8, 'Have you ever been completely convinced of something that turned out to be fiction?'),
  ('C2', 8, 'Do we become attached to places, or to the people we were in them?'),
  ('A1', 10, 'Who is in your family?'),
  ('A1', 10, 'Do you have brothers or sisters?'),
  ('A1', 10, 'Who is your best friend?'),
  ('A1', 10, 'What do you do with your friends?'),
  ('A1', 10, 'Do you have a pet?'),
  ('A1', 10, 'Who do you call on the phone?'),
  ('A1', 10, 'Where did you meet your best friend?'),
  ('A1', 10, 'What do you like about your friends?'),
  ('A1', 10, 'Who do you eat dinner with?'),
  ('A1', 10, 'Do you like big or small families?'),
  ('A2', 10, 'How did you meet your best friend?'),
  ('A2', 10, 'What do you like doing with your family?'),
  ('A2', 10, 'What is a good friend like?'),
  ('A2', 10, 'Who do you look like in your family?'),
  ('A2', 10, 'Who do you miss from your country?'),
  ('A2', 10, 'Have you made new friends here?'),
  ('A2', 10, 'What did you do with your friends when you were a child?'),
  ('A2', 10, 'Do you like going out in big groups or small groups?'),
  ('A2', 10, 'What is the nicest thing a friend did for you?'),
  ('A2', 10, 'Who was your first friend at school?'),
  ('B1', 10, 'What is the most important thing in a friendship?'),
  ('B1', 10, 'How do you usually make new friends?'),
  ('B1', 10, 'Who in your family are you closest to? Why?'),
  ('B1', 10, 'What is the kindest thing someone has done for you?'),
  ('B1', 10, 'Do you think it’s possible to stay best friends for your whole life?'),
  ('B1', 10, 'How do you keep in touch with friends far away?'),
  ('B1', 10, 'What is something your parents taught you about relationships?'),
  ('B1', 10, 'Have you ever had an argument with a friend? How did you fix it?'),
  ('B1', 10, 'What is the best way to spend a day with someone you love?'),
  ('B1', 10, 'Do you believe in love at first sight?'),
  ('B2', 10, 'What’s the best piece of relationship advice you’ve ever heard?'),
  ('B2', 10, 'Do you think opposites really attract?'),
  ('B2', 10, 'What’s something small that makes you feel really cared for?'),
  ('B2', 10, 'How have your friendships changed since you were a teenager?'),
  ('B2', 10, 'Is it easier to make friends as a child or as an adult? Why?'),
  ('B2', 10, 'What’s a quality you can’t stand in a friend?'),
  ('B2', 10, 'Would you rather have one best friend or a big group of good friends?'),
  ('B2', 10, 'What’s the funniest thing that ever happened on a first meeting with someone?'),
  ('B2', 10, 'Do you think online friendships can be as real as face-to-face ones?'),
  ('B2', 10, 'How do people in your country usually show that they care about someone?'),
  ('C1', 10, 'What do you think is the secret to a friendship that lasts decades?'),
  ('C1', 10, 'Is it possible to be good friends with an ex? Why, or why not?'),
  ('C1', 10, 'How do you know when a friendship has run its course?'),
  ('C1', 10, 'What’s a relationship lesson you had to learn the hard way?'),
  ('C1', 10, 'Do you think social media brings people closer or pushes them apart?'),
  ('C1', 10, 'How do cultural differences show up in friendships, in your experience?'),
  ('C1', 10, 'What does loyalty mean to you, and where are its limits?'),
  ('C1', 10, 'Who has shown you love in a way you only appreciated later?'),
  ('C1', 10, 'How do you make new friends in a city where you don’t know anyone?'),
  ('C1', 10, 'Is honesty always the best policy between friends?'),
  ('C2', 10, 'Can you be truly close to someone who disagrees with you on almost everything?'),
  ('C2', 10, 'Is love something you feel, or something you decide to do every day?'),
  ('C2', 10, 'What do you think your oldest friend knows about you that nobody else does?'),
  ('C2', 10, 'Have you ever drifted apart from someone without either of you meaning to?'),
  ('C2', 10, 'How has living abroad changed the way you form relationships?'),
  ('C2', 10, 'What do you think makes some people instantly easy to talk to?'),
  ('C2', 10, 'Is jealousy ever a healthy emotion?'),
  ('C2', 10, 'Which friendship in fiction do you find most convincing, and why?'),
  ('C2', 10, 'Do we choose our friends, or do circumstances choose them for us?'),
  ('C2', 10, 'What’s the most meaningful thing someone has said to you without realising it?'),
  ('A1', 13, 'What do you do at the weekend?'),
  ('A1', 13, 'Do you like sport?'),
  ('A1', 13, 'What is your hobby?'),
  ('A1', 13, 'Do you like watching films?'),
  ('A1', 13, 'What do you do in the evening?'),
  ('A1', 13, 'Do you play a musical instrument?'),
  ('A1', 13, 'Do you like reading?'),
  ('A1', 13, 'What do you do on Sunday?'),
  ('A1', 13, 'Do you like going to the cinema?'),
  ('A1', 13, 'What games do you like?'),
  ('A2', 13, 'What did you do last weekend?'),
  ('A2', 13, 'What is your perfect Saturday?'),
  ('A2', 13, 'What hobby did you have as a child?'),
  ('A2', 13, 'What sport do you like watching?'),
  ('A2', 13, 'What is the best film you have seen this year?'),
  ('A2', 13, 'Do you like going out at night or staying at home?'),
  ('A2', 13, 'What do you want to do this weekend?'),
  ('A2', 13, 'Have you been on a weekend trip from here? Where?'),
  ('A2', 13, 'What new hobby would you like to try?'),
  ('A2', 13, 'What do you do to relax?'),
  ('B1', 13, 'What is the best weekend away you have ever had?'),
  ('B1', 13, 'If you had a free day tomorrow, how would you spend it?'),
  ('B1', 13, 'What hobby have you started and then stopped?'),
  ('B1', 13, 'What is something you have always wanted to learn to do?'),
  ('B1', 13, 'Do you prefer active weekends or lazy weekends? Why?'),
  ('B1', 13, 'What is the best concert or show you have been to?'),
  ('B1', 13, 'What do you usually do on a rainy weekend?'),
  ('B1', 13, 'Is there a TV series you can’t stop watching?'),
  ('B1', 13, 'Where would you go for a weekend away from here?'),
  ('B1', 13, 'How do people in your country usually spend their Sundays?'),
  ('B2', 13, 'What hobby do you think says the most about your personality?'),
  ('B2', 13, 'If you could become an expert in any hobby overnight, which would you choose?'),
  ('B2', 13, 'What’s the most spontaneous weekend you’ve ever had?'),
  ('B2', 13, 'Do you think people today have less free time than their parents did?'),
  ('B2', 13, 'What’s a hobby you’d be embarrassed to admit you enjoy?'),
  ('B2', 13, 'How would your ideal weekend change if money weren’t an issue?'),
  ('B2', 13, 'Have you ever turned a hobby into a way of making money?'),
  ('B2', 13, 'What’s the best way to switch off from studying or work?'),
  ('B2', 13, 'Is there a free-time activity from your country that people here should try?'),
  ('B2', 13, 'What’s a weekend plan that went completely wrong?'),
  ('C1', 13, 'Do you find it easy to do nothing, or do you always need a plan?'),
  ('C1', 13, 'Which of your hobbies has taught you the most about yourself?'),
  ('C1', 13, 'What’s the most memorable weekend you’ve had since moving here?'),
  ('C1', 13, 'Is there a pastime you think is underrated?'),
  ('C1', 13, 'How has the way you spend your free time changed over the last five years?'),
  ('C1', 13, 'Do you think hobbies should be about relaxing or about getting better at something?'),
  ('C1', 13, 'What would you do with an extra hour every day?'),
  ('C1', 13, 'What’s a skill you’ve picked up purely for fun?'),
  ('C1', 13, 'Are you more of a planner or a “see what happens” person at weekends?'),
  ('C1', 13, 'What’s something you do in your free time that your friends would never guess?'),
  ('C2', 13, 'Is boredom something to avoid or something to embrace?'),
  ('C2', 13, 'What pastime do you think you’ll still be doing when you’re eighty?'),
  ('C2', 13, 'Have you ever let a hobby take over your life a little too much?'),
  ('C2', 13, 'Do you think we’ve turned leisure into another kind of work?'),
  ('C2', 13, 'What does a truly restful weekend look like for you, and how often do you get one?'),
  ('C2', 13, 'Which hobby from your childhood would you love to rediscover?'),
  ('C2', 13, 'Is there an activity that makes you lose all track of time?'),
  ('C2', 13, 'Would you rather master one hobby or dabble in many?'),
  ('C2', 13, 'What weekend tradition from your past do you miss the most?'),
  ('C2', 13, 'How do you think free time will be spent fifty years from now?'),
  ('A1', 16, 'How do you come to school?'),
  ('A1', 16, 'Where do you go on Saturday?'),
  ('A1', 16, 'Do you like the bus?'),
  ('A1', 16, 'What is your favourite place in this city?'),
  ('A1', 16, 'Do you have a bike?'),
  ('A1', 16, 'Where do you want to go today?'),
  ('A1', 16, 'Do you like walking?'),
  ('A1', 16, 'What is a good café near here?'),
  ('A1', 16, 'Do you like big cities?'),
  ('A1', 16, 'Where do you go with your friends?'),
  ('A2', 16, 'What is the best place you have visited in this city?'),
  ('A2', 16, 'How did you travel here from your country?'),
  ('A2', 16, 'Where would you take a friend in this city?'),
  ('A2', 16, 'What is a good place for shopping here?'),
  ('A2', 16, 'Have you been to another city in this country?'),
  ('A2', 16, 'What is your favourite way to travel?'),
  ('A2', 16, 'Where did you go last Sunday?'),
  ('A2', 16, 'Which place in your hometown do you miss?'),
  ('A2', 16, 'Is it easy to get around this city?'),
  ('A2', 16, 'Where do you want to go before you leave this country?'),
  ('B1', 16, 'What is your favourite secret place in this city?'),
  ('B1', 16, 'What is the most interesting journey you have ever made?'),
  ('B1', 16, 'What place here surprised you the most when you arrived?'),
  ('B1', 16, 'If you could live in any city in the world, which would it be?'),
  ('B1', 16, 'What is the worst journey you have ever had?'),
  ('B1', 16, 'Where would you go if you had a free train ticket for one day?'),
  ('B1', 16, 'How is transport here different from your country?'),
  ('B1', 16, 'What is a place everyone should visit in your country?'),
  ('B1', 16, 'Do you prefer exploring a place alone or with a guide?'),
  ('B1', 16, 'Where do you go when you want to be alone?'),
  ('B2', 16, 'What’s a place here that you think tourists don’t know about but should?'),
  ('B2', 16, 'If you could teleport anywhere right now, where would you go?'),
  ('B2', 16, 'What’s the most memorable thing that’s happened to you on public transport?'),
  ('B2', 16, 'Which city has the best atmosphere you’ve ever experienced?'),
  ('B2', 16, 'Would you rather live in the centre of a busy city or somewhere quiet outside it?'),
  ('B2', 16, 'What’s a place that completely changed your mood?'),
  ('B2', 16, 'Have you ever arrived somewhere and immediately wanted to leave?'),
  ('B2', 16, 'What’s the best way to discover a new city: maps, guides, or getting lost?'),
  ('B2', 16, 'Where would you take someone to show them the real version of your hometown?'),
  ('B2', 16, 'Which place do you think you’ll go back to again and again?'),
  ('C1', 16, 'Which city do you think has the strongest personality, and how would you describe it?'),
  ('C1', 16, 'What’s a place that’s special to you for reasons nobody else would understand?'),
  ('C1', 16, 'How do you get to know a new place: by walking, eating, or talking to people?'),
  ('C1', 16, 'Has a journey ever been more important than where you were going?'),
  ('C1', 16, 'What place have you visited that changed your idea of what “normal” is?'),
  ('C1', 16, 'Do you think cities are getting more and more alike? Is that a problem?'),
  ('C1', 16, 'Where do you feel most like yourself?'),
  ('C1', 16, 'What’s the most unusual way you’ve ever travelled somewhere?'),
  ('C1', 16, 'If you could design the perfect neighbourhood, what would it have?'),
  ('C1', 16, 'Which place would you love to see before it changes forever?'),
  ('C2', 16, 'Is there a place you’ve never been to that you nevertheless feel nostalgic about?'),
  ('C2', 16, 'What does the way people move around a city tell you about its culture?'),
  ('C2', 16, 'Which place has lived up to its legend for you, and which hasn’t?'),
  ('C2', 16, 'Do you think you can belong to more than one place at once?'),
  ('C2', 16, 'Where would you go to start your life again from scratch?'),
  ('C2', 16, 'What’s a journey you made that you’d rather not repeat, but wouldn’t undo?'),
  ('C2', 16, 'Is getting lost one of the best ways to travel?'),
  ('C2', 16, 'Which city would you most like to have lived in at a different moment in history?'),
  ('C2', 16, 'What place do you return to in your mind when you need to calm down?'),
  ('C2', 16, 'If you had to describe your hometown using only three sounds, what would they be?');

-- Deleting a class set: its pages go with it (on delete cascade); teachers may
-- also delete their own scanned page photos.
create policy "Teachers delete their own class set photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'class-set-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Class sets: a student's writing can run over several pages. A page without
-- the printed sheet header continues the student before it.
alter table public.class_set_pages add column if not exists continues_page integer;
comment on column public.class_set_pages.continues_page is 'For a student''s second (third…) page: the page number of their first page. Null on first pages.';

-- Class sets: the teacher checks each student's reading (guessed words in
-- yellow) before marking, and can correct it.
alter table public.class_set_pages add column if not exists edited_text text;
alter table public.class_set_pages add column if not exists reading_checked boolean not null default false;
comment on column public.class_set_pages.edited_text is 'On a student''s first page: the whole writing as corrected by the teacher (null = as read from the pages).';
comment on column public.class_set_pages.reading_checked is 'On a student''s first page: the teacher has checked the reading against the paper.';

-- Speed friending: custom question sets (a name, a line about what it's for,
-- and the questions; the same questions at every level). Made by the owner
-- with Claude for now; teachers may add their own later.
create table if not exists public.custom_question_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.custom_questions (
  id bigint generated by default as identity primary key,
  set_id uuid not null references public.custom_question_sets(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists custom_questions_set_idx on public.custom_questions (set_id);
alter table public.custom_question_sets enable row level security;
alter table public.custom_questions enable row level security;
create policy "Anyone can read custom question sets" on public.custom_question_sets for select to anon, authenticated using (true);
create policy "Anyone can read custom questions" on public.custom_questions for select to anon, authenticated using (true);

-- Privacy: only the host and the students in a session can read it and its
-- names (before, any signed-in user could read every session's names).
-- Restrictive policies narrow the older "Signed-in users can read ..." ones.
create or replace function public.can_see_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from sessions s where s.id = p_session_id and s.host_id = auth.uid())
      or exists (select 1 from participants p where p.session_id = p_session_id and p.user_id = auth.uid());
$$;
revoke all on function public.can_see_session(uuid) from public;
grant execute on function public.can_see_session(uuid) to authenticated;

-- (host_id / user_id checked directly too: a row being inserted is not yet
-- visible to the function, e.g. when a host creates a session.)
create policy "Only the host and its students: sessions"
  on public.sessions as restrictive for select to authenticated
  using (host_id = auth.uid() or public.can_see_session(id));
create policy "Only the host and its students: participants"
  on public.participants as restrictive for select to authenticated
  using (user_id = auth.uid() or public.can_see_session(session_id));

-- Joining: find a session by its code (before being in it).
create or replace function public.session_by_code(p_code text)
returns setof public.sessions
language sql
stable
security definer
set search_path = public
as $$
  select * from sessions where code = p_code limit 1;
$$;
revoke all on function public.session_by_code(text) from public;
grant execute on function public.session_by_code(text) to authenticated;

-- Sessions (and, with them, their students' names) are deleted after 30 days
-- (RETENTION_DAYS in src/constants/product.ts; change both together).
create extension if not exists pg_cron;

create or replace function public.delete_old_sessions(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from sessions where created_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.delete_old_sessions(integer) from public, anon, authenticated;

-- Every night at 03:17 (UTC).
select cron.schedule('delete-old-sessions', '17 3 * * *', $$select public.delete_old_sessions(30)$$);

-- "Keep me posted": anyone can leave an email and a message; only teachers
-- can read them (shown on the dashboard).
create table if not exists public.contact_messages (
  id bigint generated by default as identity primary key,
  email text not null check (char_length(email) between 3 and 200 and email like '%@%'),
  message text not null default '' check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create policy "Anyone can leave a message" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "Teachers can read messages" on public.contact_messages for select to authenticated using (public.is_teacher());

-- IELTS class sets: a class is General English or IELTS Writing Task 2.
-- An IELTS class has a target band (its target_level is not used and is
-- left at 'B2'); its class sets are marked with IELTS bands, and each
-- student's overall band is kept on their first page.

alter table public.classes
  add column if not exists course text not null default 'general' check (course in ('general', 'ielts')),
  add column if not exists target_band numeric(2,1) check (target_band between 0 and 9);

alter table public.class_sets
  add column if not exists course text not null default 'general' check (course in ('general', 'ielts'));

alter table public.class_set_pages
  add column if not exists band numeric(2,1) check (band between 0 and 9);

-- Follow-up questions: each speed-friending and custom question can have its
-- own follow-ups (3 each), shown to the asker in "Take turns". Questions with
-- none keep the app's general follow-ups.
alter table public.friending_questions
  add column if not exists follow_ups text[] not null default '{}';
alter table public.custom_questions
  add column if not exists follow_ups text[] not null default '{}';

-- Follow-ups for every speed-friending and custom question (3 each).
-- One line per question: id|follow-up 1|follow-up 2|follow-up 3

update public.friending_questions t
set follow_ups = (string_to_array(d.line, '|'))[2:4]
from unnest(string_to_array($fu$1|Who makes it?|When do you eat it?|Can you cook it?
2|Why?|Did you eat it as a child?|Does your family like it?
3|What do you have in that colour?|Is it in your room?|What colour do you not like?
4|When did you last feel happy?|Who makes you happy?|Does it cost money?
5|Why?|Do you have a pet?|What is its name?
6|Who sings it?|When do you listen to it?|Can you sing it?
7|Who do you talk to?|Does it help?|What makes you sad?
8|Why?|What do you do on rainy days?|What is your favourite weather?
9|Why?|What do you do on that day?|What day do you not like?
10|Why?|Are you scared of it?|What animal do you love?
61|Why?|When did you last go there?|Who do you go with?
62|Why?|What do you want to see there?|Who do you want to go with?
63|Why?|What do you wear in hot weather?|What is the weather like today?
64|Why?|Did you see one in real life?|Is it big or small?
65|Who do you walk with?|Is there a park near your home?|What do you see there?
66|What is its name?|Did you go there?|What can you do there?
67|Why?|Where did you go by train or plane?|Are you scared of planes?
68|What is in it?|Do you like flowers?|Who looks after it?
69|Do you like it?|What do you wear today?|What is the best month there?
70|Why?|Can you swim well?|Is the water cold?
121|What time do you eat it?|Who makes it?|What did you eat today?
122|Why?|How many cups a day?|Do you put sugar in it?
123|Why?|Do you eat it every day?|What fruit do you not like?
124|What can you cook?|Who cooks in your family?|What do you want to learn to cook?
125|Do you like it?|Can you make it?|Where can I eat it?
126|What is your favourite pizza?|Where do you eat pizza?|Can you make pizza?
127|Why?|How much do you drink?|What do you drink in the morning?
128|What sweet food do you like?|When do you eat it?|Is it good for you?
129|Why?|What do you eat there?|Who do you go with?
130|Why?|What is your favourite meat or fish?|Do you have a vegetarian friend?
181|Why?|What does he or she do?|Do you want to be like them?
182|Why are they famous?|Do you like them?|Did you see them in real life?
183|What is your favourite song by them?|Why do you like them?|Did you see them in concert?
184|Why?|What do you do together?|How old are they?
185|What is your favourite film with them?|Why do you like them?|Is there an actor you don't like?
186|Why are they funny?|Where do they live?|Are you funny too?
187|What sport do they play?|Why do you like them?|Do you play that sport?
188|Why?|What do you talk about?|Do you talk in person or on the phone?
189|How old are they?|Where do they live?|Do you see them often?
190|Why are they kind?|How do you know them?|Are you kind to them too?
241|Do you like it?|Is it big or small?|Where do you want to live?
242|What is your favourite room?|Do you have your own room?|Is it a big home?
243|Why?|What is in it?|What do you do there?
244|Was it easy to guess?|Which one was the most fun?|Can you guess my false one?
245|Do you like the colour?|What is in your bedroom?|What colour do you want?
246|Who do you live with?|Do you like it?|Where do you want to live?
247|What is your favourite thing in it?|Is it big or small?|Who cooks there?
248|What can you see from it?|Is it in your bedroom?|Do you like the view?
249|Do you go there often?|Is there a shop?|Is it quiet or noisy?
250|What is your favourite thing about it?|What do you want to change?|Is it near your school?
301|How many people?|Who do you talk to most?|Who is the funniest?
302|How old are they?|What are their names?|Do you play together?
303|Why?|What do you do together?|Where do they live?
304|Where do you go?|When do you see them?|What did you do last time?
305|What is its name?|What pet do you want?|Who looks after it?
306|Why?|How long do you talk?|Do you like phone calls?
307|When?|How old were you?|What did you do?
308|Why?|Are they like you?|What do they like about you?
309|What time do you eat?|What do you talk about?|Who cooks?
310|Why?|Is your family big or small?|How many children do you want?
361|Who with?|What did you do last weekend?|What do you want to do this weekend?
362|What sport do you like?|Do you play or watch?|Who is your favourite player?
363|When did you start?|How often do you do it?|Is it expensive?
364|What is your favourite film?|Who do you watch with?|Do you like funny or scary films?
365|What time do you go to bed?|Do you watch TV?|What did you do last night?
366|Which one?|Who taught you?|Do you want to learn one?
367|What do you read?|When do you read?|What is your favourite book?
368|Why?|Do you get up late?|Who do you see on Sunday?
369|Who do you go with?|What did you see last time?|Do you eat popcorn?
370|Why?|Who do you play with?|Do you play on your phone?
421|How long does it take?|Do you like it?|Who comes with you?
422|Why?|Who do you go with?|What do you do there?
423|Why?|Is it cheap?|How often do you take it?
424|Why?|How often do you go there?|Can I go there too?
425|What colour is it?|Where do you ride it?|Is it new or old?
426|Why?|Who with?|How do you get there?
427|Where do you walk?|Who do you walk with?|How long do you walk?
428|What do you drink there?|Is it cheap?|Who do you go with?
429|Why?|What is your favourite big city?|Do you live in a big city?
430|Why?|What do you do there?|When did you last go?
11|Who do you do it with?|How long have you done it?|Did you do it last weekend?
12|Why do you hate it?|Who does it in your home?|What housework do you not mind?
13|Who were you with?|Do you laugh a lot?|Who makes you laugh the most?
14|Where do you sing it?|Who sings it?|Do you know all the words?
15|Why were you afraid?|Are you still afraid of it?|What are you afraid of now?
16|Who gave it to you?|How old were you?|Do you still have it?
17|What do you do when it happens?|Does it happen every day?|What makes the journey nicer?
18|Why do you like it?|Where do you smell it?|What smell do you hate?
19|What do you do in that season?|What do you wear then?|Which season do you like the least?
20|How often do you do it?|Where do you do it?|What makes you stressed?
71|Who did you go with?|What did you do there?|Would you go there again?
72|When did you go there?|What did you do there?|Did you take photos?
73|Why?|What was your best city holiday?|What do you do in the countryside?
74|Why?|Have you ever forgotten something important?|Do you pack a big or small bag?
75|Where did you camp?|Did you sleep well?|Would you do it again?
76|Why?|Where does it live?|Have you seen it in a zoo?
77|Where did you go?|How did you travel?|What did you do on the journey?
78|Why?|Where did you go with friends?|Would you like to travel alone?
79|Was it hot or cold?|Where was it?|Did the weather change your plans?
80|Why there?|Who would you go with?|What would you do there?
131|Who cooked it?|Was it good?|What will you eat tonight?
132|When did you last eat it?|Can you buy it here?|Who makes it best?
133|Who taught you?|What is your best dish?|What would you like to learn to cook?
134|Where did you eat it?|Did you like it?|Would you eat it again?
135|Why?|How often do you eat out?|What is your favourite restaurant?
136|Why don't you eat it now?|Who made it for you?|Do you miss it?
137|Do you eat it every day?|What time do people eat it?|Is it healthy?
138|When do you eat it?|Is it healthy?|How often do you eat it?
139|What did you try?|Where did you eat it?|Would you eat it again?
140|Which special days?|Who cooks it?|What is your favourite?
191|How do you know about them?|What do you want to learn from them?|Have you met them?
192|Who was it?|Where did you meet them?|What did you say?
193|Why?|What did they teach?|Do you remember a lesson with them?
194|What are they good at?|How did they learn it?|Are you good at it too?
195|Why?|What would you ask them?|What would you eat together?
196|How did they help you?|Do you still see them?|Did you say thank you?
197|Why are they interesting?|Where did you meet them?|What do they do?
198|What was your favourite song?|Did you see them in concert?|Do you still listen to them?
199|Why are they brave?|What did they do?|Are you brave too?
200|Why?|What would you ask them?|What did they do?
251|Why?|Where did you get it?|How long have you had it?
252|Where was it?|What was your favourite room?|Do you miss it?
253|Was it easy to guess?|Which fact was the most surprising?|Do you want to guess my facts?
254|Why?|How much would it cost?|What do you like about it now?
255|Why?|Where do you live now?|What is good about small towns?
256|Why or why not?|Do you share jobs at home?|Who would you like to live with?
257|Where is it?|How many rooms does it have?|What is the best part?
258|Where?|How long did you live there?|What was different?
259|Who are you with?|Do you watch TV?|Do you like rainy days?
260|Why?|Who tidies it?|Is it tidy now?
311|How old were you?|Where were you?|What did you do together?
312|How often do you do it?|What did you do last time?|Who in your family is the most fun?
313|Why?|Are you a good friend?|Do you have a friend like that?
314|What do you have the same?|Do people say you look like them?|Are you like them in other ways?
315|Why?|How often do you talk to them?|When will you see them?
316|Where did you meet them?|What do you do together?|Is it easy to make friends here?
317|Where did you play?|What games did you play?|Do you still see them?
318|Why?|Where do you go?|How many people is too many?
319|When was it?|How did you feel?|Did you do something nice for them?
320|What was their name?|What did you do together?|Are you still friends?
371|Who were you with?|Did you have fun?|Was it a normal weekend for you?
372|What time do you get up?|Who is with you?|What do you eat?
373|Why did you stop?|Do you still do it?|Who did it with you?
374|Why?|Do you watch it on TV or live?|Which team do you like?
375|What was it about?|Who did you watch it with?|Would you watch it again?
376|Why?|What do you do at night?|What did you do last Friday?
377|Who with?|Where will you go?|Do you need to work too?
378|Who did you go with?|How did you get there?|Would you go again?
379|Why?|Where can you learn it?|Is it expensive?
380|How often do you do it?|Does it always work?|When do you need to relax?
431|Why?|What did you do there?|Who did you go with?
432|How long did it take?|Was it a good journey?|What did you do on the way?
433|Why there?|What would you do there?|Is it cheap or expensive?
434|What do you buy there?|Is it expensive?|How often do you go?
435|Which city?|What did you do there?|Did you like it more than here?
436|Why?|Where did you go that way?|What way do you not like?
437|Who with?|What did you do?|Was it fun?
438|Why?|What did you do there?|When did you last go there?
439|Why or why not?|How do you get around?|Is it easy in your hometown?
440|Why?|Who will you go with?|How will you get there?
21|Why do you think people love it?|Have you ever tried to like it?|Do your friends disagree with you?
22|When did it last happen?|Does it work for everyone?|What puts you in a bad mood?
23|What did you do?|Did anyone else know?|How did you celebrate?
24|Who does it?|Have you ever told them?|Do you have a habit like that?
25|What is the memory?|When did you last hear it?|Does it make you happy or sad?
26|What changed?|How old were you when you started to like it?|Is there anything you still hate?
27|Does it always help?|What makes you stressed?|What advice would you give a stressed friend?
28|How old were you?|Who saw it?|Can you laugh about it now?
29|Why does it bother you?|Where do you hear it?|What sound do you love?
30|Why does it excite you?|When did you last feel like that?|Do your friends feel the same?
81|Who were you with?|What was the best moment?|Would you go back?
82|Where were you?|How did you find your way?|Were you scared?
83|Which famous city?|What would you do on the island?|Which have you been to?
84|Why?|Where did you do it last?|Do your friends do the same?
85|How often do you go there?|What do you do there?|Do you go alone?
86|What animal was it?|Where were you?|How did you feel?
87|What did you do?|Did it ruin the holiday?|Would you go there again?
88|Why?|Has a plan ever gone wrong?|What was your best surprise on a trip?
89|Why?|What would you do there?|How would you get there?
90|Where is it from?|Why have you kept it?|Where do you keep it?
141|Who were you with?|What did it taste like?|Could you cook it yourself?
142|Why that one?|Would you get bored?|Who would cook it?
143|What does it taste like?|Where can they find the best one?|Can you make it?
144|What happened?|Did anyone eat it?|Have you cooked it again?
145|What changed?|How do you eat it now?|Is there a food you still hate?
146|Why?|What food do you miss from home?|What is the best food here?
147|Why?|How often do you go to cafés?|Which café is your favourite?
148|What do they cook best?|Did they teach you anything?|Who is the worst cook?
149|Why that food?|Does it help?|Who do you eat it with?
150|Where was it?|What was the occasion?|Would you pay that much again?
201|What did they do?|Why aren't they famous everywhere?|How did you learn about them?
202|How did they influence you?|Do they know?|Who else has influenced you?
203|Why them?|What would you ask them?|Where would you go?
204|What are they good at?|How did they learn it?|Are they famous?
205|What surprised you?|How did you meet them?|Are you still in touch?
206|Why do you think so?|Why do other people like them?|Who deserves more attention?
207|Why?|What do they do?|Who was your role model?
208|What happened to them?|Have they told you the whole story?|Would it make a good film?
209|Why that question?|What do you think they would say?|Who is your hero?
210|Why them?|What was the best advice they gave you?|Do people come to you for advice?
261|When did it happen?|Who was with you?|Do people usually believe it?
262|Why did you sleep there?|Did you sleep well?|Would you do it again?
263|Where is it?|Who lives there with you?|What is your favourite room?
264|Why?|How long have you had it?|What would you never have in your bedroom?
265|Why?|What would you have inside it?|Who would you invite?
266|What did they do?|How did you deal with it?|Are you easy to live with?
267|Why?|When will you go back?|Do you have something from home with you?
268|Why or why not?|Who told you the story?|Would you sleep in a haunted house?
269|Is your home here like that?|Is it the people or the things?|Where did you feel most at home?
270|Which was easier to tell?|Where did the true story happen?|How did you invent the other one?
321|Why?|Do your friends have it?|Have you lost a friend because of it?
322|Is it easy for you?|Where did you meet your last new friend?|Is it harder as an adult?
323|What do you do together?|Has it always been like that?|Who are you least close to?
324|When was it?|How did you thank them?|Have you done something similar for someone?
325|Why or why not?|Do you have a friend from childhood?|What can break a friendship?
326|How often do you talk?|Is it hard?|Who do you miss most?
327|Do you agree with it?|Who taught you more, your mum or your dad?|What will you teach your children?
328|What was it about?|Who said sorry first?|Are you still friends?
329|What would you do?|Where would you go?|When did you last have a day like that?
330|Why or why not?|Has it happened to you?|Do you know a couple who met like that?
381|Where did you go?|Who were you with?|What made it so good?
382|What time would you get up?|Who would you spend it with?|How often do you get free days?
383|Why did you stop?|Would you start again?|How long did you do it?
384|Why?|What stops you?|Who could teach you?
385|Why?|What did you do last weekend?|What is your perfect weekend?
386|Who did you see?|Who were you with?|Would you see them again?
387|Do you like rainy weekends?|Who are you with?|What did you do last time?
388|What is it about?|How many episodes do you watch at once?|Would you recommend it?
389|Why there?|Who would you go with?|How would you get there?
390|Do you do the same?|What is different here?|What did you do last Sunday?
441|How did you find it?|What do you do there?|Will you tell me where it is?
442|Where did you go?|What happened?|Would you do it again?
443|Why?|Was it a good or bad surprise?|Do you go there often now?
444|Why?|Have you been there?|What would you do there?
445|What went wrong?|How long did it take?|Can you laugh about it now?
446|Why there?|Who would you take?|What would you do there?
447|Which is better?|What do you miss?|What is the most surprising difference?
448|Why?|When is the best time to go?|What should they do there?
449|Why?|Have you ever had a great guide?|What is the best way to see a new city?
450|How often do you go there?|What do you do there?|Does anyone know about it?
31|Why do you think most people disagree?|Have you ever argued about it?|Has anyone changed your mind?
32|How do people usually notice?|When did it last happen?|Has it ever got you into trouble?
33|What changed your mind?|How long did it take?|Is there anything you still can't stand?
34|How often does it happen to you?|How do you deal with it now?|Would anyone miss it?
35|How did you calm down?|Would you do it again?|What advice would you give someone in that situation?
36|Who knows about it?|How often do you give in to it?|Why do you think it's embarrassing?
37|Is that true in your family?|Can you think of a time it went wrong?|Does it depend on who you're with?
38|When did it last work?|Does it work for other people too?|What do you do if it isn't possible?
39|Which moment hit you hardest?|Did you watch or read it alone?|Would you recommend it?
40|Who would you spend it with?|How often do you actually get one?|What would ruin it?
91|Were you scared at the time?|Who talked you into it?|Would you do it again?
92|Why there?|What would you do with all that time?|Who would you take with you?
93|What did you expect before you went?|What changed your view?|Would you go back?
94|Which do you usually choose?|What was your biggest surprise on a trip?|Has a favourite place ever disappointed you?
95|Why do you think they get it wrong?|Have you ever corrected a tourist?|What should they do instead?
96|Where was it?|Did your photos do it justice?|Would you go back, or keep the memory?
97|How did you react?|Did you try it yourself?|Would people here find it strange?
98|Has travelling changed you?|Can it make people less open-minded?|What else makes people more open-minded?
99|Who would be with you?|How often do you get days like that?|Where is the nearest place you could do it?
100|What would you do there?|What would surprise them most?|When did you last go there?
151|When did you first try it?|Can you make it yourself?|Has anyone tried to change your mind about it?
152|Why were you afraid of it?|Who persuaded you to try it?|Is there a food you're still afraid of?
153|Who cooks?|What do you talk about at the table?|Is it different on special days?
154|Why?|How much do you have now?|What would be hardest about it?
155|How did you discover it?|Has anyone else tried it?|What's the weirdest one you've heard of?
156|How did it happen?|What did you talk about?|Are you still in touch?
157|Why do you think that is?|Do you eat too much of it too?|What should they eat more of?
158|Why that kind of food?|What would you call it?|Where would you open it?
159|Where was it?|What made it so good?|Can you get it here?
160|What's the most adventurous thing you've eaten?|Has it ever gone badly?|Would you like to be more adventurous?
211|How did they start?|Do they get any recognition for it?|What could others learn from them?
212|Why them?|What would the title be?|Which chapter would be the most interesting?
213|What do people get wrong about them?|How did you learn about them?|Who do you think is overrated?
214|How did they change it?|How did you meet them?|Have you ever changed someone's mind?
215|What would you do first?|What would be the hardest part?|Would you want to swap back?
216|What would be the worst part?|Do you think they're happy?|Would you like to be famous at all?
217|Do you know anyone like that?|Can a hero have big flaws?|Are there real heroes today?
218|Where did you meet them?|What did you talk about?|Do you wish you'd kept in touch?
219|What did they do?|Why aren't they better known?|How would you introduce them to a foreigner?
220|Why that actor?|What kind of film would it be?|Who would play your best friend?
271|When did it happen?|Who else was there?|Do people believe you when you tell it?
272|What would a normal day look like?|Who would live with you?|Would you get bored?
273|Who told you?|When did you find out the truth?|Do people still believe it?
274|Does your home really match you?|What would change if you lived alone?|What does a messy room say about someone?
275|What did they do?|How did it end?|Were you ever the difficult flatmate?
276|Was the made-up one hard to invent?|Which true fact surprises people most?|Did I guess right?
277|Why?|Which do you have now?|What would your ideal view be?
278|In what ways?|Would you be different if you grew up somewhere else?|Where would you like your children to grow up?
279|Who told it to you?|Do people believe it?|Does it teach a lesson?
280|How would you use it?|Would it cause any problems?|What would your friends want it to have?
331|Who gave it to you?|Have you followed it?|What advice would you add?
332|Do you know a couple like that?|Are you attracted to opposites?|What do you need in common with someone?
333|Who does it for you?|Do you do it for others?|Why do small things matter so much?
334|Why do you think they changed?|Do you still have friends from then?|Are friendships better now?
335|What makes it harder?|Where do adults make friends?|Who was your last new friend?
336|Why does it bother you so much?|Have you ever told a friend?|Do you have any bad qualities as a friend?
337|Which do you have now?|What are the pros of each?|Has that changed over time?
338|How did it start?|Did you become friends?|Do you still laugh about it?
339|Have you had an online friend?|Have you met them in person?|What's missing online?
340|How do you show it?|Is it different here?|Is it different for men and women?
391|What does yours say about you?|What hobby would surprise people who know you?|Do you judge people by their hobbies?
392|Why that one?|What would you do with the skill?|Would you lose interest once it was easy?
393|How did it start?|Who were you with?|Would you do it again?
394|Why do you think so?|How much free time do you have?|What do you do with it?
395|Who knows about it?|How did you get into it?|Why do you think it's embarrassing?
396|Where would you go?|Who would you take?|What wouldn't change at all?
397|How did it happen?|Did it stop being fun?|Would you like to?
398|What works for you?|How long does it take you to relax?|What doesn't work?
399|What is it?|What would people here think of it?|Could you teach it?
400|What went wrong?|Did you save the day?|Can you laugh about it now?
451|How did you find it?|Why don't tourists know about it?|Should it stay a secret?
452|Why there?|What would you do first?|How long would you stay?
453|Where were you going?|Who was involved?|Do you prefer public transport or driving?
454|What made it special?|When were you there?|How does this city compare?
455|Why?|Where do you live now?|Would your answer change when you're older?
456|How did it change your mood?|When were you there?|Have you been back?
457|What was wrong with it?|Did you leave?|Did it get better?
458|Which do you usually do?|What's the best thing you've found by getting lost?|Do you use your phone a lot when exploring?
459|What would they see there?|What would surprise them?|Where wouldn't you take them?
460|Why?|How many times have you been?|What do you do every time you go?
41|Why do you think nobody else notices?|Have you ever said anything about it?|Are you guilty of it yourself?
42|Was the change gradual or sudden?|Did someone influence you?|Which taste hasn't changed at all?
43|What makes you feel nostalgic?|Do you ever go looking for that feeling?|Is the past really as good as we remember?
44|How long have you had it?|What would happen if you lost it?|Do your friends tease you about it?
45|Has it ever caused problems?|Do people misread you?|Would you like to be more or less open?
46|Why do you think people love it so much?|Have you ever given it a fair chance?|What deserves more love instead?
47|Who makes you laugh like that?|Has a joke ever gone badly wrong for you?|Does humour translate across languages?
48|What made you change it?|Was it hard to admit?|Did anyone notice?
49|Why that one?|How much do you spend on it?|What would you replace it with?
50|Where do you think that comes from?|Does your way of handling it work?|Who do you talk to about it?
101|What draws you to it?|What would you miss from home?|What's stopping you?
102|Which are you?|Is one better than the other?|Can you be both on the same trip?
103|What shocked you most?|How long did it last?|Did you experience reverse culture shock when you got home?
104|What made it so memorable?|Who were you with?|Would you do it again the same way?
105|What can you learn in a week?|What would you miss?|How long does it really take?
106|Why that one?|Is there somewhere like that you've been?|Would you get used to it?
107|What happened?|What do you do differently now?|Could it have been worse?
108|What changed it?|Do you miss the old way?|What will travel look like for you in twenty years?
109|Why?|What happened there?|Is there anything that would make you go back?
110|What does yours say about you?|Do people judge others by their holidays?|Have you ever pretended to enjoy a holiday?
161|What was the moment?|Do you seek it out or avoid it?|Can anyone else make it the way you remember?
162|What surprised you most here?|Have you adopted any habits from here?|What do you miss most?
163|Has that always been true?|Who did you learn from?|What would make it more enjoyable?
164|How is it usually done abroad?|Where can you get the real thing?|What would you tell a chef who got it wrong?
165|Why those guests?|Who would cook?|What would you talk about?
166|In what ways?|Is it for better or worse?|What's the hardest thing to find here?
167|What does your family's way say about you?|Do families eat together less now?|Will you do it the same way?
168|Where were you?|Would you eat it again?|Has anything you ate abroad made you ill?
169|Why did you stop?|How does your family feel about it?|Which rules do you still follow?
170|Who taught it to you?|What makes it special?|Is it written down anywhere?
221|How did you first hear it?|What part speaks to you most?|Has it changed anything you've done?
222|Can you think of an example either way?|What about you?|Can circumstances ruin a talent too?
223|What changed your mind?|Was it them or you that changed?|Do you feel let down?
224|What did they teach you?|Do they know?|Have you taught anyone that way?
225|Why?|What will they be remembered for?|Who will be forgotten?
226|Who was it?|In what way were they different?|Did it change how you see them?
227|Who has it?|Can that quality be learned?|What quality do you find hardest to admire?
228|What made them unusual?|Where did you meet them?|Did they influence you?
229|Why that question?|What do you think they'd say?|Would you trust their answer?
230|What are they doing?|Why don't they get credit?|Do they want it?
281|Why don't people believe it?|Do you have proof?|Do you tell it often?
282|Where is home for you now?|Has your answer changed?|Can you have more than one home?
283|What makes it so entertaining?|Do you know anyone who believes it?|Why do you think people believe these things?
284|What would you start with?|What did it smell like?|Does it still exist?
285|What was missing?|How long did you stay?|What helps a place feel like home?
286|Why that object?|Is it valuable or sentimental?|What would you leave behind without regret?
287|Which detail is the most surprising true one?|How much do you know about your family's past?|Who in your family knows the most?
288|Is it important to you?|Is it different in your country?|Would you rather rent forever?
289|Who told it?|When did you find out?|Have you ever told one that good?
290|Would you agree with them?|What secrets would they tell?|Would you want to hear it?
341|Do you have a friendship like that?|What can kill a long friendship?|Is it easier with old friends than new ones?
342|Have you tried?|What would make it work?|What do your friends think?
343|Has it happened to you?|Did you end it or let it fade?|Do you ever regret it?
344|What happened?|Would you do anything differently?|Do you share the lesson with others?
345|In your own life, which is it?|Would you give it up?|How did people keep in touch before?
346|Can you give an example?|Has a misunderstanding ever caused problems?|What have you learned from it?
347|Has your loyalty ever been tested?|Can you be too loyal?|Who are you most loyal to?
348|What did they do?|Why didn't you notice at the time?|Have you told them?
349|Have you done it?|What worked best?|What's the hardest part?
350|When might it not be?|Has honesty ever cost you a friendship?|Would you want a friend to tell you everything?
401|Why do you think that is?|When did you last do nothing?|Would you like to change?
402|What did it teach you?|Did you expect that?|Would you recommend it to others?
403|What made it memorable?|Who were you with?|Have you tried to repeat it?
404|Why do you think people overlook it?|How did you discover it?|Who would you recommend it to?
405|What caused the change?|Is it better now?|What do you want it to look like in five years?
406|Which is it for you?|Can a hobby become stressful?|Has a hobby ever turned into a chore?
407|Would you really use it well?|Where would you put the hour?|What do you never have time for now?
408|How did you get into it?|How good are you?|Has it ever come in useful?
409|Does that match your personality in general?|Has it ever caused arguments?|Which kind of person do you get on with better?
410|How did you start?|Why haven't you told them?|What would they say?
461|Have you been there?|How does it compare to your hometown?|Would you want to live there?
462|Why is it special?|Have you taken anyone there?|Has it changed?
463|Which works best for you?|What's the best thing you've found that way?|Do you research before you go?
464|Where were you going?|What happened on the way?|Is it the same for life in general?
465|What was different?|How did it change your view?|What do visitors find strange about where you're from?
466|Can you give an example?|What do we lose?|Are there any benefits?
467|Why there?|How often do you get there?|Where do you feel least like yourself?
468|Why did you travel that way?|Would you do it again?|What's the most unusual way you'd like to try?
469|What would it not have?|Would you be able to afford it?|How close is your neighbourhood now?
470|Why?|What's changing there?|Is change always a loss?
51|What do you usually end up saying?|Is the difficulty part of why you love it?|Who comes closest to understanding it?
52|Why do you think that is?|Has the real thing ever disappointed you?|Can you have too much anticipation?
53|What does it reveal?|Would your friends agree?|Has it ever worked in your favour?
54|Can you think of something you grew to love on purpose?|What about people?|Is there anything you wish you didn't love?
55|What does it mean?|When do you need it most?|Is there an English word you wish your language had?
56|Why do you think it affected you?|Were you alone?|Has it happened again since?
57|Why?|Who understands you deeply now?|Can you really have both?
58|Can you give an example?|Has a first impression ever been badly wrong?|Do you think others judge you quickly?
59|How did you acquire it?|What do others think of it?|Is there a taste you've tried and failed to acquire?
60|What caused it?|What would the forecast be for tomorrow?|What weather are you usually?
111|Why do you think that happened?|What did it have that home didn't?|Did it last?
112|Which is it for you?|Can you escape your routine without leaving home?|Does it matter which?
113|What did you expect?|Who gave it the reputation?|Which place exceeded its reputation?
114|Why that landscape?|Is it a real place?|What would capture your adult life?
115|Who would decide?|Would you accept being shut out yourself?|Is there a middle way?
116|What did they do?|Could you repay them?|Has it changed how you treat strangers?
117|What would you want to feel again?|Who was with you?|Would it be the same the second time?
118|Has it happened to you?|Is anywhere better than its photos?|Do you take many photos when you travel?
119|Which do you need more?|Could you live without either?|Where do you go to get it?
120|What would you do all week?|Would you enjoy it, or find it hard?|Have you ever been completely alone for that long?
171|Whose meal is it?|Is it a happy or painful association?|Have you tried to cook it yourself?
172|What's your best simple dish?|Is complicated food sometimes showing off?|Who is the best cook you know?
173|Can you give an example?|Which influences are most visible?|What will future food say about today?
174|What was it?|How did you hide your reaction?|Would you do it again for politeness?
175|Why or why not?|What's the alternative?|What's the best meal you've shared with a new person?
176|What's the closest comparison?|Where can people try it?|Is taste memory stronger than other memories?
177|Why?|Who's the good cook in your life?|What would you ask the chef to make?
178|Why that one?|Have you followed it yourself?|Which current food trend will last?
179|What's the rule?|Do you still follow it?|What would happen if you broke it at home?
180|What ingredients would you include?|What dish would your best friend be?|Would it be an acquired taste?
231|What do you envy about it?|Why wouldn't you admit it?|Could you adopt some of it?
232|Can you give an example?|Should we separate the art from the artist?|Has it ever changed your opinion of their work?
233|In what way?|Is your humour like your family's?|Has it changed since you moved here?
234|What did you think of them before?|Do you think they deserved it?|Can someone recover from that?
235|Who are your heroes?|What happens when a hero lets us down?|Do children need heroes more than adults?
236|What made them remarkable?|Did others notice?|What did you learn from them?
237|Why that voice?|What tone would they take?|Which scene would they enjoy narrating most?
238|Do you agree?|Has it ever got you into trouble?|What quality would you like to develop?
239|What would you ask them?|What do you know about them already?|What would they think of you?
240|Which do you think matters more?|Can you name an example?|Is there a cost to obsession?
291|Who tells it?|What do you think really happened?|Does it matter?
292|What was the moment?|Is it a decision or something that happens to you?|Is there a place you've stopped calling home?
293|Why that one?|How should people protect themselves?|Have you ever fallen for any yourself?
294|Have you ever felt at home in one?|What would it take?|What makes a place feel temporary?
295|Is any of it true?|Who else knows the real version?|Would you tell it to a stranger?
296|What does yours say about you?|Have you ever judged someone by their home?|Do you decorate for yourself or for guests?
297|When is accuracy more important?|Do you exaggerate stories yourself?|What's the best story you've heard that wasn't true?
298|How different is it from your home now?|Who would be shocked by it?|Why do we care so much about appearance?
299|What was it?|How did you find out?|Did it change how you check things?
300|Which is it for you?|Have you gone back to a place and felt nothing?|Can a place change who you are?
351|Do you have someone like that?|What makes it possible?|Where do you draw the line?
352|Which do you believe?|Has your view changed over time?|Can a feeling last without the decision?
353|How did they find out?|Do they still remember?|What do you know about them?
354|What happened?|Would you like to reconnect?|Is drifting apart always a loss?
355|In what ways?|Are your friends here different from those at home?|Is it harder or easier?
356|Are you one of them?|Can it be learned?|Who's the easiest person you've ever talked to?
357|When might it be?|Have you ever been jealous in a useful way?|What's the difference between jealousy and envy?
358|What makes it convincing?|Is it like any of your own friendships?|Which fictional friendship is completely unrealistic?
359|How did you meet your closest friends?|Would they still be your friends if you met today?|Can you make friends deliberately?
360|What did they say?|Did you ever tell them?|Have you ever done the same for someone else?
411|When were you last truly bored?|What came out of it?|Do children get bored enough these days?
412|Why that one?|Has it already lasted a long time?|What do you think you'll give up?
413|What happened?|Who noticed first?|Did you get the balance back?
414|Can you give an example?|Are you guilty of it?|What's a hobby that feels like pure play?
415|What gets in the way?|Who is with you?|What's the first thing you'd cut from a busy weekend?
416|Why did you stop?|What would it take to start again?|Would it be the same now?
417|When did it last happen?|Why do you think it does that?|Is that kind of focus good for you?
418|Which describes you now?|What's the downside of each?|Is there a hobby you'd like to go deep on?
419|Who was part of it?|Why did it stop?|Could you bring it back?
420|What will change most?|Will we have more or less of it?|What won't change?
471|Why do you think that is?|Where does the feeling come from?|Would you be afraid to visit and be disappointed?
472|Can you give an example?|What does your hometown's say about it?|Which city moves in a way you love?
473|What made the difference?|Did your expectations play a part?|Where would you send someone to be impressed?
474|Where do you belong?|Does belonging to two places ever feel like belonging to none?|What makes you feel you belong?
475|Why there?|What would you do differently?|Would you go alone?
476|What made it so hard?|What did it give you?|Would you recommend it to anyone?
477|When has it worked for you?|When has it gone badly?|Is it possible to get lost with a smartphone?
478|Why that moment?|Who would you want to meet there?|What would you miss from today?
479|What's it like?|Is it a real place?|Have you been back recently?
480|Why those sounds?|Which one do you miss most?|What sounds would describe this city?$fu$, E'\n')) as d(line)
where t.id = split_part(d.line, '|', 1)::bigint;

update public.custom_questions t
set follow_ups = (string_to_array(d.line, '|'))[2:4]
from unnest(string_to_array($fu$1|Where did you learn that?|What would you like to try?|What surprises you about it?
2|When is it?|Who comes?|What is your favourite part?
3|Which do you prefer?|Have you celebrated Christmas here?|What would you add from your festival?
4|Who cooks it?|What is your favourite dish?|Can you find it here?
5|What was the best present you got?|Do children get the most?|Do you like giving or getting more?
6|Where did you see them?|Which were the best?|Are they too much?
7|Who does the decorating?|What colours do people use?|Do you decorate your home here?
8|How old were you?|Who was there?|What made it special?
9|Who comes?|Where do you meet?|What do you eat?
10|What do people do?|Have you done it?|Do people do it here too?
11|How long does it take?|Who does the most work?|What is your job?
12|What did you wear last time?|Who buys them?|What colour is special?
13|Why or why not?|What would you bring?|Have you ever been invited?
14|Why?|What do you think it means?|Would you try it?
15|What happens at it?|When is it?|What should they try?
16|What do children do?|What did you do as a child?|Who has more fun?
17|What does it mean?|Who do you say it to?|Can you teach me to say it?
18|What do you miss most?|Who do you celebrate with here?|How do you call home?
19|When do they start?|Do you like it?|When is too early?
20|What would you call it?|When would it be?|What would people eat?
21|Who were you with?|Did you have fun?|Will you do the same this year?
22|What do people do then?|Which one is more important?|Do you celebrate both?
23|What is your favourite part?|Is it the same in every family?|How is it different here?
24|Why that food?|Who makes it?|Do you like it?
25|What did you do last year?|Who would you invite?|What is the best party you've been to?
26|What was it?|How long did you keep it?|Will you make one this year?
27|Why?|How will you start?|Who could help you?
28|When did it happen?|Who was with you?|How did you feel?
29|What do people do?|Do you do it?|Does it work?
30|How much?|Who gives it?|What do children buy with it?
31|What does it mean?|When do you say it?|Can you teach me?
32|Who were you with?|What time did they start?|Do you like loud fireworks?
33|Who are you with?|Do you make a wish?|What did you do at midnight last year?
34|Why?|What happens there?|Who would you go with?
35|Why?|What do you buy?|Do you do it here too?
36|How old were you?|Who was there?|What did you eat?
37|What would you like to change?|Did you change something last year?|Is any day a good day to change?
38|Why that advice?|Will you follow it?|What advice did you need this year?
39|Why?|What is the most important festival?|How do you feel about it?
40|Why?|What would you do at midnight?|Who would you go with?$fu$, E'\n')) as d(line)
where t.id = split_part(d.line, '|', 1)::bigint;

-- Word games (Hot Seat, Explain It): each student's "Got it" / "Skip" taps,
-- as card numbers within their group. Students update their own row.
alter table public.participants add column if not exists got_cards integer[] not null default '{}';
alter table public.participants add column if not exists skipped_cards integer[] not null default '{}';

-- Things that happen in a live session, one row each, for awards and results
-- afterwards (word games: words guessed/skipped, hints; later Talk Rounds
-- follow-up questions). Shared by every live game. Deleted with the session.
create table if not exists public.session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  -- Who did it (null: the host, or nobody in particular).
  participant_id uuid references public.participants (id) on delete set null,
  -- e.g. 'game_started', 'card_done', 'hint', 'follow_up_asked'.
  kind text not null check (char_length(kind) between 1 and 40),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists session_events_session_id_idx on public.session_events (session_id, created_at);
alter table public.session_events enable row level security;
grant select, insert on public.session_events to authenticated;

drop policy if exists "Host and students read their session's events" on public.session_events;
create policy "Host and students read their session's events"
  on public.session_events for select to authenticated
  using (public.can_see_session(session_id));

-- A student adds events as themselves; the host adds events with no student
-- or for any student in the session (e.g. marking for a student without a phone).
drop policy if exists "Host and students add events" on public.session_events;
create policy "Host and students add events"
  on public.session_events for insert to authenticated
  with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.host_id = auth.uid())
    or (
      participant_id is not null
      and exists (
        select 1 from public.participants p
        where p.id = participant_id and p.session_id = session_events.session_id and p.user_id = auth.uid()
      )
    )
  );
-- Take turns: the follow-up questions each student tapped as asked
-- ("round.turn.number" keys), for a leaderboard later. Students update their own row.
alter table public.participants add column if not exists asked_follow_ups text[] not null default '{}';

-- Saved student names (27 Nov 2026): each teacher's students' names (e.g.
-- "Mai T."), so a student types two letters on the join page and taps their
-- name. A name is saved when a student joins, and deleted after 60 days
-- without use (SAVED_NAME_DAYS in src/core/live/saved-names.ts; change both).
create table if not exists public.saved_names (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  last_used_at timestamptz not null default now(),
  unique (host_id, name)
);
alter table public.saved_names enable row level security;
create policy "Teachers read their own saved names"
  on public.saved_names for select to authenticated using (host_id = auth.uid());
create policy "Teachers delete their own saved names"
  on public.saved_names for delete to authenticated using (host_id = auth.uid());

-- Joining (or renaming) saves the name for the session's teacher.
create or replace function public.save_participant_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name !~ '^Guest [0-9]+$' then
    insert into saved_names (host_id, name)
    select s.host_id, new.name from sessions s where s.id = new.session_id
    on conflict (host_id, name) do update set last_used_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists save_participant_name on public.participants;
create trigger save_participant_name
  after insert or update of name on public.participants
  for each row execute function public.save_participant_name();

-- The join page: names saved by this session's teacher that start with the
-- letters typed (at least 2).
create or replace function public.saved_names_for_code(p_code text, p_prefix text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select n.name
  from saved_names n
  join sessions s on s.host_id = n.host_id
  where s.code = p_code
    and s.status <> 'finished'
    and char_length(trim(p_prefix)) >= 2
    and lower(n.name) like replace(replace(replace(lower(trim(p_prefix)), '\', ''), '%', ''), '_', '\_') || '%'
  order by n.name
  limit 8;
$$;
revoke all on function public.saved_names_for_code(text, text) from public;
grant execute on function public.saved_names_for_code(text, text) to authenticated;

-- Every night: names not used for 60 days are deleted.
create or replace function public.delete_old_saved_names(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from saved_names where last_used_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.delete_old_saved_names(integer) from public, anon, authenticated;
select cron.schedule('delete-old-saved-names', '27 3 * * *', $$select public.delete_old_saved_names(60)$$);

-- GPS tours, live (27 Nov 2026).
-- Under-18 groups share their NEWEST place with the supervising adults during a
-- tour: one value per phone, overwritten (no trail), cleared when the tour ends.
alter table public.participants add column if not exists live_place jsonb;
-- The teacher's own newest place (for the "within sight of an adult" rule).
alter table public.sessions add column if not exists host_place jsonb;

-- The host ends a tour: everyone's place is cleared.
create or replace function public.clear_tour_places(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update participants set live_place = null
   where session_id = p_session_id
     and exists (select 1 from sessions s where s.id = p_session_id and s.host_id = auth.uid());
  update sessions set host_place = null where id = p_session_id and host_id = auth.uid();
$$;
revoke all on function public.clear_tour_places(uuid) from public;
grant execute on function public.clear_tour_places(uuid) to authenticated;

-- Photos and recordings from a tour, private. Paths: <session id>/<who>/<file>.
-- Only the session's host and students can add or see them.
insert into storage.buckets (id, name, public, file_size_limit)
values ('tour-media', 'tour-media', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "Tour media: session members add" on storage.objects;
create policy "Tour media: session members add"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tour-media' and public.can_see_session(((storage.foldername(name))[1])::uuid));

drop policy if exists "Tour media: session members read" on storage.objects;
create policy "Tour media: session members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'tour-media' and public.can_see_session(((storage.foldername(name))[1])::uuid));
