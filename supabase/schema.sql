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
