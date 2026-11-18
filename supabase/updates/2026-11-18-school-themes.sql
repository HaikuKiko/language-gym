-- One-off update: replace the first draft plan with the school's 16 weekly
-- themes, each level's grammar per week, and the grammar help.
--
-- Run it once, after supabase/schema.sql, on a database set up before
-- 18 November 2026. It OVERWRITES the topic, grammar and help of all 96
-- weeks, so do not run it after editing weeks by hand.

alter table public.weeks add column if not exists also text not null default '';
alter table public.weeks add column if not exists use text not null default '';
alter table public.weeks add column if not exists pattern text not null default '';
alter table public.weeks add column if not exists examples text not null default '';
alter table public.weeks add column if not exists starter text not null default '';

insert into public.weeks as w (level, week, topic, grammar, also, use, pattern, examples, starter)
select * from (values
  ('A1', 1, 'People & Places', 'be: am / is / are', 'Nationalities · too much / too many · superlatives', 'Talk about people and where they are from', 'I [am] · you / we / they [are] · he / she / it [is] · not · [Are] you …?', 'I[’m] from Morocco. I[’m] Moroccan.
She [isn''t] French. She[’s] Italian.
[Are] you a student? Yes, I [am].', 'I[’m] from … and my city [is] …'),
  ('A1', 2, 'You, Yours & Opinions', 'this / that / these / those', 'have got · possessive ’s · will / won’t for promises · verb patterns with adjectives', 'Talk about things near and far', '{this} (one, here) · {these} (many, here) · [that] (one, there) · [those] (many, there)', '{This} is my phone, and [that] is my bag.
{These} photos are from my holiday.
Are [those] your keys on the table?', '{This} is my favourite … because …'),
  ('A1', 3, 'Everyday Life & Experiences', 'Present simple: I / you / we / they', 'Present perfect for experiences · telling the time · me too / me neither', 'Talk about your everyday life', 'I / you / we / they + [verb] · {don''t} + verb · [Do] you …?', 'I [get up] at seven every day.
We {don''t work} on Sundays.
[Do] you [walk] to school?', 'Every morning I [ … ]'),
  ('A1', 4, 'Loves, Hates & Feelings', 'Present simple: he / she / it', 'Adverbs of frequency · should / shouldn’t · present perfect for results', 'Talk about what other people love and hate', 'he / she / it + verb[-s] · {doesn''t} + verb · {Does} she …?', 'My sister love[s] music.
He {doesn''t like} getting up early.
{Does} your friend like football?', 'My best friend love[s] … but hate[s] …'),
  ('A1', 5, 'Travel & Nature', 'can / can’t', 'Articles · might / going to · present and past simple passive', 'Talk about what you can do on a trip', '[can] / {can''t} + verb · [Can] you …?', 'I [can] swim in the sea.
We {can''t} drive in the desert.
[Can] you ride a camel?', 'On holiday I [can] … but I {can''t} …'),
  ('A1', 6, 'Eating & Drinking', 'there is / there are', 'Countable and uncountable nouns · some / any / a lot of / much / many', 'Describe food and places to eat', '[There is] + one thing · {There are} + more than one', '[There is] a café near my school.
{There are} three restaurants on my street.
Is there any milk in the fridge?', 'In my town [there is] a great place to eat. It …'),
  ('A1', 7, 'Extraordinary People', 'Past simple: was / were', 'Past simple regular and irregular verbs · auxiliary verbs · have to / don’t have to', 'Talk about famous people in the past', 'I / he / she / it [was] · you / we / they {were}', 'Ibn Battuta [was] a famous traveller.
His journeys {were} very long.
Where [was] he born?', 'A famous person from my country [was] …'),
  ('A1', 8, 'Fact or Fiction & Homes', 'Past simple: negatives and questions', 'Prepositions of place · possessive pronouns · can / can’t', 'Ask and answer about stories and the past', '[didn''t] + verb · {Did} you …?', 'I [didn''t] believe the story.
{Did} you watch the film last night?
Where {did} you live as a child?', '{Did} you ever …?'),
  ('A1', 9, 'Buying & Selling', 'Comparative adjectives', 'Superlative adjectives · this / that / these / those · present continuous', 'Compare things you buy', 'short adjective + [-er than] · {more} + long adjective + [than]', 'This shirt is cheap[er than] that one.
Online shops are {more} convenient [than] markets.
Is this phone bett[er than] your old one?', 'I think … is bett[er than] …'),
  ('A1', 10, 'Love & Relationships', 'Past continuous', 'will / won’t for promises · quite / very / really · have got · present perfect for how long', 'Describe what was happening in a love story', '[was / were] + {verb-ing}', 'I [was] {waiting} for the bus when I met him.
They [were] {dancing} at a wedding.
What [were] you {doing} when you met?', 'When I met my best friend, I [was] {…ing} …'),
  ('A1', 11, 'Street Life & Technology', 'Present continuous', 'Present simple or continuous · be thinking of + -ing · adverbs of manner', 'Describe what people are doing now', '[am / is / are] + {verb-ing}', 'She[’s] {wearing} a red jacket.
People [are] {looking} at their phones.
What [are] you {doing} right now?', 'Right now, I[’m] {…ing} …'),
  ('A1', 12, 'The World Around Us', 'Question words', 'Quantifiers · be · there is / there are · present simple questions and negatives', 'Ask about the world', '[What · Where · When · Who · How many · How much] + question', '[What] is the biggest country in Africa?
[How many] people live in your city?
[Where] do lions live?', '[What] do you know about …?'),
  ('A1', 13, 'Weekends Away & Free Time', 'going to', 'would like to / want to · like / love + -ing · adverbs of frequency', 'Talk about weekend plans', '[am / is / are going to] + {verb}', 'I[’m] [going to] {visit} my cousins.
We[’re] [going to] {have} a picnic.
What are you [going to] {do} this weekend?', 'This weekend I[’m] [going to] …'),
  ('A1', 14, 'Learning & Studying', 'have to / don’t have to', 'might and will · very / really / quite / a little · comparatives', 'Talk about rules at school', '[have to] = necessary · {don''t have to} = not necessary', 'We [have to] arrive at nine.
We {don''t have to} wear a uniform.
[Do] you [have to] do homework?', 'At my school, we [have to] …'),
  ('A1', 15, 'Keeping in Touch & Plans', 'Present perfect', 'be going to · making suggestions · would like to', 'Talk about experiences and staying in touch', '[have / has] + past participle · {ever} / never', 'I[’ve] [called] my mum three times this week.
[Have] you {ever} [written] a letter?
She [has] never [used] a video call.', 'I[’ve] never …, but I[’ve] …'),
  ('A1', 16, 'Going Places', 'Prepositions of movement', 'Comparatives and superlatives · have got · take and get · past simple', 'Give directions and describe journeys', 'go [up / down / along / across / past / through] + place', 'Go [along] this street and turn left.
Walk [past] the bank and [across] the square.
The train goes [through] a long tunnel.', 'To get to my house, go [along] …'),
  ('A2', 1, 'People & Places', 'Question forms', 'Present simple and continuous', 'Ask questions to get to know people', '(question word) + [auxiliary] + subject + {verb}', 'Where [do] you {live}?
What [are] you {studying}?
How long [have] you {been} here?', 'Where [do] you {come} from?'),
  ('A2', 2, 'You, Yours & Opinions', 'Possessive pronouns and whose', 'Giving opinions: I think / I don''t think', 'Talk about what belongs to whom, and give opinions', '[Whose] … is it? · {mine · yours · his · hers · ours · theirs}', '[Whose] jacket is this? It''s {mine}.
That idea is {hers}, not {mine}.
I think {yours} is better.', '[Whose] … do you prefer, {mine} or …?'),
  ('A2', 3, 'Everyday Life & Experiences', 'Present perfect with ever / never', 'Past simple for finished time', 'Talk about experiences', '[have / has] + past participle · {ever} / {never}', '[Have] you {ever} [eaten] snails?
I [have] {never} [been] to Spain.
She [has] [climbed] Toubkal.', 'I [have] {never} …'),
  ('A2', 4, 'Loves, Hates & Feelings', 'Verb + -ing or to + infinitive', 'like / love / hate · feelings adjectives', 'Talk about things you love, hate and want', '[enjoy / love / hate / don''t mind] + -ing · {want / hope / decide} + to + verb', 'I [love dancing] at weddings.
She [hates waiting] for the bus.
I {want to learn} the guitar.', 'I [really enjoy] …ing, but I {want to} …'),
  ('A2', 5, 'Travel & Nature', 'will / won''t for predictions', 'Weather vocabulary', 'Make predictions about travel and nature', '[will] / {won''t} + verb', 'It [will] be sunny tomorrow.
I think it {won''t} rain.
[Will] the beach be busy?', 'I think tomorrow it [will] …'),
  ('A2', 6, 'Eating & Drinking', 'much / many / a few / a little', 'Countable and uncountable nouns · a lot of', 'Say how much or how many', '[much / a little] + uncountable · {many / a few} + plural', '[How much] water do you drink?
I eat {a few} dates every day.
There isn''t [much] sugar in my tea.', 'I don''t eat [much] … but I eat {a lot of} …'),
  ('A2', 7, 'Extraordinary People', 'Past simple and past continuous', 'Irregular verbs · when / while', 'Tell the story of an extraordinary person', '[was / were + -ing] for the background · {past simple} for the action', 'She [was working] in a shop when she {won} the lottery.
He [was climbing] when the storm {started}.
What [were] they [doing] when they {became} famous?', 'My hero [was …ing] when …'),
  ('A2', 8, 'Fact or Fiction & Homes', 'used to', 'Describing homes · there was / there were', 'Talk about how things used to be', '[used to] + verb · {didn''t use to} + verb', 'We [used to] live in a small flat.
My grandparents {didn''t use to} have a TV.
Did you [use to] believe in ghosts?', 'When I was a child, I [used to] …'),
  ('A2', 9, 'Buying & Selling', 'Comparatives and superlatives', 'Shopping language · too / enough', 'Compare things you buy', '[-er than / more … than] · {the -est / the most}', 'This market is cheap[er than] the mall.
It''s {the best} shop in town.
Online shopping is [more] convenient [than] going out.', '{The best} place to shop in my city is …'),
  ('A2', 10, 'Love & Relationships', 'Present perfect with for / since', 'Relationships vocabulary', 'Say how long you have known people', '[have / has] + participle + {for} a period / {since} a point', 'I [have known] Sara {for} ten years.
They [have been] married {since} 2015.
How long [have] you [had] your best friend?', 'I [have known] my best friend {for} …'),
  ('A2', 11, 'Street Life & Technology', 'Present perfect with just / already / yet', 'Technology vocabulary', 'Talk about recent news and technology', '[have / has] + {just / already} + participle · [haven''t] … {yet}', 'I[''ve] {just} bought a new phone.
She[''s] {already} downloaded the app.
I [haven''t] updated it {yet}.', 'I[''ve] {just} …'),
  ('A2', 12, 'The World Around Us', 'Present simple passive', 'Articles · geography vocabulary', 'Talk about the world and how things are made', '[is / are] + {past participle}', 'Coffee [is] {grown} in Brazil.
Arabic [is] {spoken} in many countries.
Argan oil [is] {made} in Morocco.', 'In my country, … [is] {…}'),
  ('A2', 13, 'Weekends Away & Free Time', 'going to and present continuous for plans', 'Free-time activities · suggestions', 'Talk about plans and arrangements', '[going to] + verb = plan · {am / is / are + -ing} = arrangement', 'I''m [going to] relax this weekend.
I{''m meeting} friends on Saturday.
What [are] you {doing} on Sunday?', 'This weekend I''m [going to] … and I{''m …ing} …'),
  ('A2', 14, 'Learning & Studying', 'must / have to / should', 'School and study vocabulary', 'Talk about rules and give advice for studying', '[must / have to] = rule · {should} = advice', 'You [must] switch off your phone in class.
We [have to] hand in homework on Mondays.
You {should} revise every evening.', 'Before an exam, you {should} …'),
  ('A2', 15, 'Keeping in Touch & Plans', 'will for offers, promises and decisions', 'Making plans · keeping in touch', 'Make offers and promises', 'I[’ll] + verb', 'I[’ll] call you tomorrow.
I[’ll] send you the photos.
Don''t worry, I[’ll] help you.', 'I promise I[’ll] …'),
  ('A2', 16, 'Going Places', 'First conditional', 'Travel vocabulary · directions', 'Talk about possible journeys', '[If + present], {will + verb}', '[If we take the train], we {will arrive} early.
[If it rains], we {will stay} at the hotel.
What {will} you do [if you miss the bus]?', '[If I have time this summer], I {will} …'),
  ('B1', 1, 'People & Places', 'Present simple and continuous, state verbs', 'Question forms', 'Talk about habits and what''s happening now', 'habit: [I work] · now: {I''m working} · state verbs: know, like, believe', 'I [usually work] from home.
This week {I''m working} in the office.
I know exactly what you mean.', 'Normally I [ … ], but these days {I''m …ing} …'),
  ('B1', 2, 'You, Yours & Opinions', 'So do I / Neither do I', 'Giving and asking for opinions', 'Agree and disagree with opinions', 'agree: [So do I / So am I] · agree with a negative: {Neither do I / Neither am I}', '‘I love football.’ ‘[So do I].’
‘I''m not a morning person.’ ‘{Neither am I}.’
‘I can''t stand rap.’ ‘Really? I can.’', 'I think … ‘[So do I]’ or ‘Really? I don''t.’'),
  ('B1', 3, 'Everyday Life & Experiences', 'Present perfect and past simple', 'Time expressions: ever, never, ago, last', 'Talk about experiences and when they happened', '[have + participle] = experience · {past simple} = a finished time', 'I [have been] to Istanbul twice.
I {went} there in 2022.
[Have] you ever [lost] your luggage? What {happened}?', 'I [have] … , and it {was} …'),
  ('B1', 4, 'Loves, Hates & Feelings', 'Gerunds and infinitives', 'Adjectives for feelings', 'Talk about likes, hates and feelings', '[enjoy / mind / avoid] + -ing · {want / plan / decide} + to + verb', 'I [enjoy watching] horror films.
I {decided to stop} worrying.
I [can''t stand waiting] in queues.', 'I [really enjoy] …ing, but I don''t {want to} …'),
  ('B1', 5, 'Travel & Nature', 'Narrative tenses', 'Travel and nature vocabulary', 'Tell a travel story', '[past continuous] for the background · {past simple} for the events · had + participle for earlier', 'We [were driving] to Agadir when the car {broke down}.
It [was raining], so we {stopped} at a café.
I {realised} I had left my passport at home.', 'I [was …ing] when suddenly …'),
  ('B1', 6, 'Eating & Drinking', 'Passive: present and past', 'Food and cooking vocabulary', 'Describe how food is made and served', '[am / is / are / was / were] + {past participle}', 'Couscous [is] traditionally {eaten} on Fridays.
This bread [was] {baked} this morning.
Tea [is] {served} with fresh mint.', 'In my country, … [is] {made} with …'),
  ('B1', 7, 'Extraordinary People', 'Present perfect continuous', 'for / since · describing people', 'Talk about how long extraordinary people have been doing things', '[have been + -ing] + {for / since}', 'She [has been climbing] mountains {for} twenty years.
He [has been writing] songs {since} he was ten.
How long [have] you [been learning] English?', 'I [have been] …ing {for} …'),
  ('B1', 8, 'Fact or Fiction & Homes', 'Modals of deduction: must / might / can''t', 'Story and home vocabulary', 'Guess whether a story is fact or fiction', '[must] = I''m sure it''s true · {can''t} = I''m sure it''s not true · might = maybe', 'That story [must] be true: it was on the news.
A house with forty rooms {can''t} be cheap.
It might be a ghost story.', 'I think this story {can''t} be true because …'),
  ('B1', 9, 'Buying & Selling', 'as … as · much / far + comparative', 'Shopping and money vocabulary', 'Compare products and prices in detail', '[as + adjective + as] · {much / far} + comparative', 'The market is [as good as] the supermarket.
Online prices are {far cheaper} than in shops.
This phone isn''t [as fast as] the new one.', 'Buying online is {much} … than …'),
  ('B1', 10, 'Love & Relationships', 'Reported speech: statements', 'Relationships vocabulary', 'Tell someone what another person said', '[said / told me] + tense moves back: is → {was}, will → {would}', 'She [said] she {was} in love.
He [told me] he {would} call later.
My friend [said] she {had} met someone new.', 'My best friend once [told me] that …'),
  ('B1', 11, 'Street Life & Technology', 'Defining relative clauses', 'Technology vocabulary', 'Say exactly which person or thing', 'person: [who] · thing: {which / that}', 'My cousin is the person [who] fixes my laptop.
A smartphone is a phone {that} connects to the internet.
I need an app {which} helps me sleep.', 'I can''t live without an app {that} …'),
  ('B1', 12, 'The World Around Us', 'Zero and first conditionals', 'Environment vocabulary', 'Talk about results that are always or likely true', '[If + present], {present} = always · [If + present], {will + verb} = likely', '[If you heat ice], it {melts}.
[If we recycle more], we{''ll have} less rubbish.
What {will} happen [if the sea gets warmer]?', '[If we …], the world {will} …'),
  ('B1', 13, 'Weekends Away & Free Time', 'Future forms', 'Free-time and holiday vocabulary', 'Talk about predictions, plans and arrangements', '[will] = prediction · {going to} = plan · I''m meeting = arrangement', 'I think the weekend [will] be relaxing.
I''m {going to} go camping.
I''m meeting my friends on Saturday.', 'Next weekend I''m {going to} …'),
  ('B1', 14, 'Learning & Studying', 'Modals of obligation and advice', 'Education vocabulary', 'Talk about rules and give study advice', '[must / have to] = obligation · {should} = advice · don''t have to = no need', 'Students [must] attend 80% of classes.
You {should} revise a little every day.
We don''t have to wear a uniform.', 'In my opinion, students {should} …'),
  ('B1', 15, 'Keeping in Touch & Plans', 'used to / would', 'Ways of keeping in touch', 'Talk about how you used to stay in touch', '[used to] + verb · {would} + verb (repeated actions)', 'We [used to] write letters.
Every Sunday we {would} call my grandmother.
Did you [use to] send postcards?', 'When I was younger, I [used to] …'),
  ('B1', 16, 'Going Places', 'Second conditional', 'Travel and transport vocabulary', 'Talk about imaginary journeys', '[If + past simple], {would + verb}', '[If I won] a lot of money, I {would travel} the world.
[If I could] go anywhere, I{''d go} to Japan.
Where {would} you {go} [if you had] a month off?', '[If I could …], I {would} …'),
  ('B2', 1, 'People & Places', 'Present habits: tend to, will, keep + -ing', 'Describing people and places', 'Describe typical behaviour', '[tend to] + verb · {will} + verb (habit) · keep + -ing', 'People here [tend to] be very friendly.
My brother {will} talk for hours about football.
She keeps forgetting her keys.', 'People in my city [tend to] …'),
  ('B2', 2, 'You, Yours & Opinions', 'Contrast and concession', 'Opinion language', 'Balance two sides of an argument', '[although] + clause · {despite} + noun or -ing · however, …', '[Although] I disagree, I see your point.
{Despite} its benefits, social media worries me.
It''s useful. However, it can be addictive.', '[Although] some people think …, I …'),
  ('B2', 3, 'Everyday Life & Experiences', 'Present perfect simple and continuous', 'Experiences and routines', 'Talk about results and ongoing activities', '[have + participle] = result · {have been + -ing} = ongoing activity', 'I [have read] three books this month.
I {have been reading} a lot lately.
How long {have} you {been working} here?', 'Recently I {have been} …ing, and I [have] …'),
  ('B2', 4, 'Loves, Hates & Feelings', 'Verbs that change meaning: -ing or to', 'Feelings and emotions', 'Use verbs that change meaning', '[remember / stop / try] + -ing vs {+ to + verb}', 'I [remember feeling] nervous on my first day.
Please {remember to call} your mother.
I [stopped worrying] about small things.', 'I''ll never forget [feeling] …'),
  ('B2', 5, 'Travel & Nature', 'Narrative tenses including past perfect continuous', 'Travel and nature vocabulary', 'Show what had been happening before', '[had been + -ing] before a {past simple} event', 'We [had been hiking] for hours when it {started} to snow.
I [had been waiting] so long that I {fell} asleep.
She {was} tired because she [had been driving] all night.', 'We [had been] …ing for … when …'),
  ('B2', 6, 'Eating & Drinking', 'Passive in all tenses, have something done', 'Food and restaurants', 'Focus on the action or a service', '[be + past participle] in any tense · {have something + participle}', 'The restaurant [has been renovated].
The menu [will be changed] next month.
We {had the cake made} by a baker.', 'Recently, a … [has been] …'),
  ('B2', 7, 'Extraordinary People', 'Third conditional', 'Achievements and life events', 'Talk about how things could have been different', '[If + had + participle], {would have + participle}', '[If she hadn''t trained so hard], she {wouldn''t have won}.
[If he had given up], he {would have missed} his chance.
What {would} you {have done} [if you had been there]?', '[If I had …], I {would have} …'),
  ('B2', 8, 'Fact or Fiction & Homes', 'Past modals of deduction', 'Mysteries and homes', 'Guess what happened', '[must / might / can''t] + {have + participle}', 'The owners [must] {have left} in a hurry.
Someone [might] {have lived} here for years.
It [can''t] {have been} a ghost.', 'I think they [must] {have} …'),
  ('B2', 9, 'Buying & Selling', 'Non-defining and reduced relative clauses', 'Consumer vocabulary', 'Add extra information about products', '…, [which / who] …, · short form: {-ing / -ed} phrase', 'My phone, [which] I bought last year, already feels old.
People {buying} online often spend more.
Clothes {made} cheaply don''t last.', 'My favourite brand, [which] …, …'),
  ('B2', 10, 'Love & Relationships', 'Past modals: should have / could have', 'Relationship problems', 'Talk about regrets in relationships', '[should have / could have] + {past participle}', 'I [should have] {apologised} sooner.
You [could have] {told} me the truth!
They [shouldn''t have] {argued} in public.', 'I [should have] … when …'),
  ('B2', 11, 'Street Life & Technology', 'Future continuous and future perfect', 'Technology and city life', 'Picture life at a point in the future', '[will be + -ing] = in progress · {will have + participle} = finished', 'In 2040 we [will be using] self-driving cars.
By then, cities {will have changed} completely.
This time next year I [will be working] online.', 'In ten years, people [will be] …ing …'),
  ('B2', 12, 'The World Around Us', 'wish / if only', 'Environment vocabulary', 'Talk about changes you wish for', '[wish / if only] + {past} (now) · + {would} (other people)', 'I [wish] people {recycled} more.
[If only] governments {would} act.
I [wish] I {didn''t} use so much plastic.', 'I [wish] my city {…}'),
  ('B2', 13, 'Weekends Away & Free Time', 'used to / be used to / get used to', 'Holidays and free time', 'Talk about past habits and getting used to things', '[used to] + verb (past) · {be / get used to} + -ing (familiar)', 'I [used to] work every weekend.
I''m {used to relaxing} on Sundays now.
It took me a while to {get used to camping}.', 'On holiday I couldn''t {get used to} …'),
  ('B2', 14, 'Learning & Studying', 'Mixed conditionals', 'Education and careers', 'Link past choices to the present', '[If + had + participle] (past), {would + verb} (now)', '[If I had studied medicine], I {would be} a doctor now.
[If I hadn''t learned English], I {wouldn''t have} this job.
Where {would} you be [if you had chosen] another course?', '[If I had studied …], I {would} … now.'),
  ('B2', 15, 'Keeping in Touch & Plans', 'Reported speech and reporting verbs', 'Communication vocabulary', 'Report what was said, and how', '[said / told] + clause · {promised / suggested / admitted / reminded}', 'She [said] she would call me back.
He {promised} to keep in touch.
My friend {suggested} meeting for coffee.', 'My friend recently {suggested} …'),
  ('B2', 16, 'Going Places', 'Indirect questions and question tags', 'Travel situations', 'Ask politely and check information', '[Could you tell me] + where it is? · …, {isn''t it?}', '[Could you tell me] where the station is?
[Do you know] what time the train leaves?
This is the right platform, {isn''t it?}', '[Do you know] whether …?'),
  ('C1', 1, 'People & Places', 'Aspect: perfect and continuous forms', 'Identity and place vocabulary', 'Choose simple, continuous or perfect for meaning', '[continuous] = in progress · {perfect} = up to a point', 'I [have been living] in Brighton for a year.
By the time I moved, I {had lost} my accent.
I''m [living] in London, but I {have never felt} English.', 'Lately I [have been] …'),
  ('C1', 2, 'You, Yours & Opinions', 'Hedging and distancing', 'Expressing opinions', 'Make careful, softened claims', '[seem / appear / tend] + to · {it could be argued that}', 'Opinions [seem to] be changing.
{It could be argued that} we share too much.
Young people [tend to] trust online reviews.', '{It could be argued that} …'),
  ('C1', 3, 'Everyday Life & Experiences', 'Participle clauses', 'Everyday life and experiences', 'Combine ideas concisely', '[-ing] clause (same time) · {Having + participle} (earlier)', '[Walking] through my old school, I felt twelve again.
{Having lived} abroad, I see home differently.
[Asked] about her routine, she laughed.', '[Looking] back, I …'),
  ('C1', 4, 'Loves, Hates & Feelings', 'Emphasis: do / did, intensifiers', 'Feelings vocabulary', 'Add strong emphasis', '[do / did] + verb · {by far / utterly / truly}', 'I [do] love a quiet Sunday.
That was {by far} the happiest day of my life.
I was {utterly} exhausted.', 'I [do] believe that …'),
  ('C1', 5, 'Travel & Nature', 'Relative clauses with prepositions and quantifiers', 'Travel and nature', 'Write precise, formal descriptions', '[in which / to whom] · {most of which / some of whom}', 'The village [in which] I stayed had no roads.
I met many travellers, {most of whom} spoke English.
The forest, [through which] we walked, was silent.', 'The place [in which] I …'),
  ('C1', 6, 'Eating & Drinking', 'Passive reporting: is said to', 'Food trends', 'Report beliefs and claims impersonally', '[It is said that] … · subject + {is said to} + verb', '[It is believed that] olive oil is good for the heart.
This dish {is said to} come from Fes.
Coffee {is thought to have} originated in Ethiopia.', '[It is often said that] …'),
  ('C1', 7, 'Extraordinary People', 'Inversion after negative adverbials', 'Achievements and character', 'Make strong, formal statements', '[Never / Rarely / Not only] + {auxiliary} + subject', '[Never] {had} anyone climbed it before.
[Not only] {did} she win, but she broke the record.
[Rarely] {does} someone so young achieve so much.', '[Rarely] {do} we see …'),
  ('C1', 8, 'Fact or Fiction & Homes', 'Modals of speculation, present and past', 'Mysteries and stories', 'Speculate about what is or was true', '[may / might / could] + verb · {may / might / could} + have + participle', 'The story [might] be based on real events.
The house {could have been} built on an old site.
The writer [may] be exaggerating.', 'Perhaps the story {might have} …'),
  ('C1', 9, 'Buying & Selling', 'Nominalisation', 'Business and consumer vocabulary', 'Sound formal and analytical', 'verb → noun: grow → [growth] · decide → {decision}', 'The [growth] of online shopping is remarkable.
The {decision} to cut prices worked.
There has been a sharp [increase] in second-hand sales.', 'The [rise] of … will …'),
  ('C1', 10, 'Love & Relationships', 'Unreal past: wish, it''s time, would rather', 'Relationships', 'Express regret, urgency and preference', '[wish / it''s time] + past · {would rather} + past', 'I [wish] we spent more time together.
[It''s time] we talked honestly.
I''d {rather} you told me the truth.', '[It''s high time] we …'),
  ('C1', 11, 'Street Life & Technology', 'Formal discourse markers', 'Technology and society', 'Structure an argument', '[Furthermore / Moreover] · {Nevertheless / Conversely} · Consequently', 'Cameras make streets safer. [Moreover], they deter crime.
Apps are free. {Nevertheless}, we pay with our privacy.
Consequently, regulation is needed.', 'Technology helps us. [Furthermore], …'),
  ('C1', 12, 'The World Around Us', 'Cleft sentences', 'Global issues', 'Emphasise one part of what you say', '[What] … is … · {It is} … that …', '[What] worries me is the speed of climate change.
{It is} small changes that make the difference.
[What] we need is cooperation.', '[What] concerns me most about the world is …'),
  ('C1', 13, 'Weekends Away & Free Time', 'Ellipsis and substitution', 'Leisure activities', 'Avoid repeating words', '[so / not] · {do / one}', 'Are you going away this weekend? I hope [so].
I wanted to go hiking, but I never {did}.
I prefer the quieter {one}.', 'Some people say … I don''t think [so], because …'),
  ('C1', 14, 'Learning & Studying', 'Perfect and passive gerunds and infinitives', 'Learning and achievement', 'Talk about achievements and recognition', '[having + participle] · {to be + participle} · to have + participle', 'I''m proud of [having passed] my exams.
Every student wants {to be encouraged}.
She seems to have learned very quickly.', 'I''m proud of [having] …'),
  ('C1', 15, 'Keeping in Touch & Plans', 'Future forms: be about to, be due to, be bound to', 'Plans and communication', 'Talk about imminent and expected events', '[be about to] = very soon · {be due to} = scheduled · be bound to = certain', 'I''m [about to] start a new job.
My cousin is {due to} arrive on Friday.
We''re bound to lose touch if we don''t call.', 'Soon I''m [about to] …'),
  ('C1', 16, 'Going Places', 'Mixed and inverted conditionals', 'Travel and journeys', 'Discuss hypothetical journeys formally', '[Had I known] … · {Were it} … · Should you …', '[Had I known] about the strike, I would have flown.
{Were it} cheaper, I would travel by train.
Should you visit Fes, see the tanneries.', '[Had I been] free last summer, I would …'),
  ('C2', 1, 'People & Places', 'Fronting and marked word order', 'Identity and belonging', 'Shift focus by changing word order', '[object or adjective] first + subject + verb · {… as it may seem}', '[This city] I will never forget.
[Strange] {as it may seem}, I feel at home abroad.
[Home] is where I''m understood.', '[Odd] {as it may sound}, …'),
  ('C2', 2, 'You, Yours & Opinions', 'Epistemic modality and hedging', 'Truth and opinion', 'Signal exactly how certain you are', '[may well / is likely to] · {arguably / presumably}', 'This [may well] be the best explanation.
It is, {arguably}, unprovable.
Experts [are likely to] disagree.', 'It [may well] be that …'),
  ('C2', 3, 'Everyday Life & Experiences', 'Nuanced tense and aspect', 'Daily life and change', 'Shade meaning through tense', '[was wondering] = tentative · {have come to} = gradual change', 'I [was wondering] whether routines make us happier.
I {have come to} value quiet mornings.
We [are forever] checking our phones.', 'I {have come to} realise that …'),
  ('C2', 4, 'Loves, Hates & Feelings', 'Metaphor, idiom and connotation', 'Emotions and attitudes', 'Interpret and use figurative language', '[metaphor] · {idiom} · words with a positive or negative feel', 'Grief is [a heavy coat] you learn to wear.
I was {over the moon} when I heard.
Is she ‘determined’ or ‘stubborn’?', 'For me, love is [a …] because …'),
  ('C2', 5, 'Travel & Nature', 'Participle and verbless clauses', 'Landscapes and nature', 'Write vivid, compact description', '[-ing / -ed] clause · {verbless}: adjective or noun phrase', '[Shrouded in mist], the valley looked untouched.
{Exhausted but happy}, we reached the summit.
[Left alone], nature recovers.', '[Surrounded by] …, I …'),
  ('C2', 6, 'Eating & Drinking', 'Dense noun phrases', 'Food culture and industry', 'Pack ideas into precise noun phrases', '[the + noun] + {of / for} + noun phrase', '[The globalisation] {of} food has changed our diets.
[The demand] {for} cheap meat harms the planet.
Unequal access {to} fresh food is a concern.', '[The commercialisation] {of} …'),
  ('C2', 7, 'Extraordinary People', 'Future in the past, perfect infinitives', 'Biography and legacy', 'Describe the past from an earlier point of view', '[was to / would] = what happened later · {to have + participle}', 'Nobody knew she [was to] become a legend.
He [would] later change medicine forever.
Ibn Battuta is said {to have travelled} 120,000 km.', 'At the time, nobody knew that … [would] …'),
  ('C2', 8, 'Fact or Fiction & Homes', 'Reporting with stance', 'News, rumour and the home', 'Show your attitude to a source', '[allegedly / purportedly] · {claims / concedes / insists}', 'The house is [allegedly] haunted.
The owner {concedes} the story is exaggerated.
The photo was [purportedly] taken in 1920.', 'The article {claims} … , but …'),
  ('C2', 9, 'Buying & Selling', 'Rhetorical devices for persuasion', 'Advertising and sales', 'Persuade with structure', '[So / Such] … that · {Little did} they know · three-part lists', '[So] convincing was the advert that sales doubled.
{Little did} buyers know the price would fall.
Faster, lighter, smarter.', '[Never before] has …'),
  ('C2', 10, 'Love & Relationships', 'Understatement and register', 'Relationships and tone', 'Use irony and tone', '[not exactly / a tad] = understatement · {ironic praise}', 'The first date was [not exactly] a success.
Forgetting her birthday was [a tad] unwise.
‘{Lovely},’ she said, as he arrived an hour late.', 'It was [not exactly] …'),
  ('C2', 11, 'Street Life & Technology', 'Advanced conditionals: but for, supposing', 'Technology and urban life', 'Explore alternatives precisely', '[But for / Were it not for] + noun · {Supposing / Provided that}', '[But for] smartphones, we would get lost more.
[Were it not for] cameras, crime might rise.
{Supposing} cars disappeared, how would cities change?', '[Were it not for] technology, …'),
  ('C2', 12, 'The World Around Us', 'Subjunctive and mandative structures', 'Global responsibility', 'Express demands and recommendations formally', '[insist / recommend / it is essential] that + {base verb}', 'Scientists [insist that] emissions {be} cut.
[It is vital that] every country {act} now.
They [recommended that] the forest {be} protected.', '[I would propose that] the world {…}'),
  ('C2', 13, 'Weekends Away & Free Time', 'Ellipsis, substitution and cohesion', 'Leisure and lifestyle', 'Connect a long argument smoothly', '[the former / the latter / this] · {do so / one}', 'Some rest, others travel; [the latter] return happier.
Many plan a break, but few {do so}.
[This] is why rest matters.', '[The former] … whereas [the latter] …'),
  ('C2', 14, 'Learning & Studying', 'Concession: albeit, much as', 'Learning and knowledge', 'Concede a point formally', '[albeit / notwithstanding] · {much as} + clause', 'The course was useful, [albeit] demanding.
{Much as} I value exams, they are not everything.
[Notwithstanding] the cost, education pays.', '{Much as} I respect …, …'),
  ('C2', 15, 'Keeping in Touch & Plans', 'Complex relative and cleft structures', 'Communication and plans', 'Build complex, precise sentences', '[It is … that] · {whereby / whose}', '[It is] small messages [that] keep friendships alive.
We set up a system {whereby} we call every Sunday.
Friends {whose} lives move on still matter.', '[It is not] … [that] …, but …'),
  ('C2', 16, 'Going Places', 'Style, register and precision', 'Journeys and travel writing', 'Choose exactly the right word and tone', '[formal] vs {informal} · precise vocabulary', 'Passengers are requested to [refrain from] smoking.
The trip was {a total nightmare}.
The road meandered through olive groves.', 'To my mind, the best journeys are …')
) as d (level, week, topic, grammar, also, use, pattern, examples, starter)
on conflict (level, week) do update
set topic = excluded.topic, grammar = excluded.grammar, also = excluded.also,
    use = excluded.use, pattern = excluded.pattern, examples = excluded.examples,
    starter = excluded.starter;
