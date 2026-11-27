/**
 * Draft help for each week's main grammar point: what it is for, the
 * pattern, three examples and a sentence starter. Used when the database has
 * no help columns yet; once it does, the `weeks` table is the source.
 *
 * Highlighting: text in [square brackets] is shown in orange and text in
 * {curly brackets} in blue, so the parts of a pattern can be matched to the
 * same parts in the examples.
 */
import type { Level } from '@/core/content/levels';

export type GrammarHelp = {
  /** What the grammar is used for, in a few words. */
  use: string;
  pattern: string;
  examples: string[];
  starter: string;
};

export const DRAFT_GRAMMAR_HELP: Record<Level, GrammarHelp[]> = {
  A1: [
    {
      use: "Talk about people and where they are from",
      pattern: "I [am] · you / we / they [are] · he / she / it [is] · not · [Are] you …?",
      examples: [
        "I[’m] from Morocco. I[’m] Moroccan.",
        "She [isn't] French. She[’s] Italian.",
        "[Are] you a student? Yes, I [am].",
      ],
      starter: "I[’m] from … and my city [is] …",
    },
    {
      use: "Talk about things near and far",
      pattern: "{this} (one, here) · {these} (many, here) · [that] (one, there) · [those] (many, there)",
      examples: [
        "{This} is my phone, and [that] is my bag.",
        "{These} photos are from my holiday.",
        "Are [those] your keys on the table?",
      ],
      starter: "{This} is my favourite … because …",
    },
    {
      use: "Talk about your everyday life",
      pattern: "I / you / we / they + [verb] · {don't} + verb · [Do] you …?",
      examples: [
        "I [get up] at seven every day.",
        "We {don't work} on Sundays.",
        "[Do] you [walk] to school?",
      ],
      starter: "Every morning I [ … ]",
    },
    {
      use: "Talk about what other people love and hate",
      pattern: "he / she / it + verb[-s] · {doesn't} + verb · {Does} she …?",
      examples: [
        "My sister love[s] music.",
        "He {doesn't like} getting up early.",
        "{Does} your friend like football?",
      ],
      starter: "My best friend love[s] … but hate[s] …",
    },
    {
      use: "Talk about what you can do on a trip",
      pattern: "[can] / {can't} + verb · [Can] you …?",
      examples: [
        "I [can] swim in the sea.",
        "We {can't} drive in the desert.",
        "[Can] you ride a camel?",
      ],
      starter: "On holiday I [can] … but I {can't} …",
    },
    {
      use: "Describe food and places to eat",
      pattern: "[There is] + one thing · {There are} + more than one",
      examples: [
        "[There is] a café near my school.",
        "{There are} three restaurants on my street.",
        "Is there any milk in the fridge?",
      ],
      starter: "In my town [there is] a great place to eat. It …",
    },
    {
      use: "Talk about famous people in the past",
      pattern: "I / he / she / it [was] · you / we / they {were}",
      examples: [
        "Ibn Battuta [was] a famous traveller.",
        "His journeys {were} very long.",
        "Where [was] he born?",
      ],
      starter: "A famous person from my country [was] …",
    },
    {
      use: "Ask and answer about stories and the past",
      pattern: "[didn't] + verb · {Did} you …?",
      examples: [
        "I [didn't] believe the story.",
        "{Did} you watch the film last night?",
        "Where {did} you live as a child?",
      ],
      starter: "{Did} you ever …?",
    },
    {
      use: "Compare things you buy",
      pattern: "short adjective + [-er than] · {more} + long adjective + [than]",
      examples: [
        "This shirt is cheap[er than] that one.",
        "Online shops are {more} convenient [than] markets.",
        "Is this phone bett[er than] your old one?",
      ],
      starter: "I think … is bett[er than] …",
    },
    {
      use: "Describe what was happening in a love story",
      pattern: "[was / were] + {verb-ing}",
      examples: [
        "I [was] {waiting} for the bus when I met him.",
        "They [were] {dancing} at a wedding.",
        "What [were] you {doing} when you met?",
      ],
      starter: "When I met my best friend, I [was] {…ing} …",
    },
    {
      use: "Describe what people are doing now",
      pattern: "[am / is / are] + {verb-ing}",
      examples: [
        "She[’s] {wearing} a red jacket.",
        "People [are] {looking} at their phones.",
        "What [are] you {doing} right now?",
      ],
      starter: "Right now, I[’m] {…ing} …",
    },
    {
      use: "Ask about the world",
      pattern: "[What · Where · When · Who · How many · How much] + question",
      examples: [
        "[What] is the biggest country in Africa?",
        "[How many] people live in your city?",
        "[Where] do lions live?",
      ],
      starter: "[What] do you know about …?",
    },
    {
      use: "Talk about weekend plans",
      pattern: "[am / is / are going to] + {verb}",
      examples: [
        "I[’m] [going to] {visit} my cousins.",
        "We[’re] [going to] {have} a picnic.",
        "What are you [going to] {do} this weekend?",
      ],
      starter: "This weekend I[’m] [going to] …",
    },
    {
      use: "Talk about rules at school",
      pattern: "[have to] = necessary · {don't have to} = not necessary",
      examples: [
        "We [have to] arrive at nine.",
        "We {don't have to} wear a uniform.",
        "[Do] you [have to] do homework?",
      ],
      starter: "At my school, we [have to] …",
    },
    {
      use: "Talk about experiences and staying in touch",
      pattern: "[have / has] + past participle · {ever} / never",
      examples: [
        "I[’ve] [called] my mum three times this week.",
        "[Have] you {ever} [written] a letter?",
        "She [has] never [used] a video call.",
      ],
      starter: "I[’ve] never …, but I[’ve] …",
    },
    {
      use: "Give directions and describe journeys",
      pattern: "go [up / down / along / across / past / through] + place",
      examples: [
        "Go [along] this street and turn left.",
        "Walk [past] the bank and [across] the square.",
        "The train goes [through] a long tunnel.",
      ],
      starter: "To get to my house, go [along] …",
    },
  ],
  A2: [
    {
      use: "Ask questions to get to know people",
      pattern: "(question word) + [auxiliary] + subject + {verb}",
      examples: [
        "Where [do] you {live}?",
        "What [are] you {studying}?",
        "How long [have] you {been} here?",
      ],
      starter: "Where [do] you {come} from?",
    },
    {
      use: "Talk about what belongs to whom, and give opinions",
      pattern: "[Whose] … is it? · {mine · yours · his · hers · ours · theirs}",
      examples: [
        "[Whose] jacket is this? It's {mine}.",
        "That idea is {hers}, not {mine}.",
        "I think {yours} is better.",
      ],
      starter: "[Whose] … do you prefer, {mine} or …?",
    },
    {
      use: "Talk about experiences",
      pattern: "[have / has] + past participle · {ever} / {never}",
      examples: [
        "[Have] you {ever} [eaten] snails?",
        "I [have] {never} [been] to Spain.",
        "She [has] [climbed] Toubkal.",
      ],
      starter: "I [have] {never} …",
    },
    {
      use: "Talk about things you love, hate and want",
      pattern: "[enjoy / love / hate / don't mind] + -ing · {want / hope / decide} + to + verb",
      examples: [
        "I [love dancing] at weddings.",
        "She [hates waiting] for the bus.",
        "I {want to learn} the guitar.",
      ],
      starter: "I [really enjoy] …ing, but I {want to} …",
    },
    {
      use: "Make predictions about travel and nature",
      pattern: "[will] / {won't} + verb",
      examples: [
        "It [will] be sunny tomorrow.",
        "I think it {won't} rain.",
        "[Will] the beach be busy?",
      ],
      starter: "I think tomorrow it [will] …",
    },
    {
      use: "Say how much or how many",
      pattern: "[much / a little] + uncountable · {many / a few} + plural",
      examples: [
        "[How much] water do you drink?",
        "I eat {a few} dates every day.",
        "There isn't [much] sugar in my tea.",
      ],
      starter: "I don't eat [much] … but I eat {a lot of} …",
    },
    {
      use: "Tell the story of an extraordinary person",
      pattern: "[was / were + -ing] for the background · {past simple} for the action",
      examples: [
        "She [was working] in a shop when she {won} the lottery.",
        "He [was climbing] when the storm {started}.",
        "What [were] they [doing] when they {became} famous?",
      ],
      starter: "My hero [was …ing] when …",
    },
    {
      use: "Talk about how things used to be",
      pattern: "[used to] + verb · {didn't use to} + verb",
      examples: [
        "We [used to] live in a small flat.",
        "My grandparents {didn't use to} have a TV.",
        "Did you [use to] believe in ghosts?",
      ],
      starter: "When I was a child, I [used to] …",
    },
    {
      use: "Compare things you buy",
      pattern: "[-er than / more … than] · {the -est / the most}",
      examples: [
        "This market is cheap[er than] the mall.",
        "It's {the best} shop in town.",
        "Online shopping is [more] convenient [than] going out.",
      ],
      starter: "{The best} place to shop in my city is …",
    },
    {
      use: "Say how long you have known people",
      pattern: "[have / has] + participle + {for} a period / {since} a point",
      examples: [
        "I [have known] Sara {for} ten years.",
        "They [have been] married {since} 2015.",
        "How long [have] you [had] your best friend?",
      ],
      starter: "I [have known] my best friend {for} …",
    },
    {
      use: "Talk about recent news and technology",
      pattern: "[have / has] + {just / already} + participle · [haven't] … {yet}",
      examples: [
        "I['ve] {just} bought a new phone.",
        "She['s] {already} downloaded the app.",
        "I [haven't] updated it {yet}.",
      ],
      starter: "I['ve] {just} …",
    },
    {
      use: "Talk about the world and how things are made",
      pattern: "[is / are] + {past participle}",
      examples: [
        "Coffee [is] {grown} in Brazil.",
        "Arabic [is] {spoken} in many countries.",
        "Argan oil [is] {made} in Morocco.",
      ],
      starter: "In my country, … [is] {…}",
    },
    {
      use: "Talk about plans and arrangements",
      pattern: "[going to] + verb = plan · {am / is / are + -ing} = arrangement",
      examples: [
        "I'm [going to] relax this weekend.",
        "I{'m meeting} friends on Saturday.",
        "What [are] you {doing} on Sunday?",
      ],
      starter: "This weekend I'm [going to] … and I{'m …ing} …",
    },
    {
      use: "Talk about rules and give advice for studying",
      pattern: "[must / have to] = rule · {should} = advice",
      examples: [
        "You [must] switch off your phone in class.",
        "We [have to] hand in homework on Mondays.",
        "You {should} revise every evening.",
      ],
      starter: "Before an exam, you {should} …",
    },
    {
      use: "Make offers and promises",
      pattern: "I[’ll] + verb",
      examples: [
        "I[’ll] call you tomorrow.",
        "I[’ll] send you the photos.",
        "Don't worry, I[’ll] help you.",
      ],
      starter: "I promise I[’ll] …",
    },
    {
      use: "Talk about possible journeys",
      pattern: "[If + present], {will + verb}",
      examples: [
        "[If we take the train], we {will arrive} early.",
        "[If it rains], we {will stay} at the hotel.",
        "What {will} you do [if you miss the bus]?",
      ],
      starter: "[If I have time this summer], I {will} …",
    },
  ],
  B1: [
    {
      use: "Talk about habits and what's happening now",
      pattern: "habit: [I work] · now: {I'm working} · state verbs: know, like, believe",
      examples: [
        "I [usually work] from home.",
        "This week {I'm working} in the office.",
        "I know exactly what you mean.",
      ],
      starter: "Normally I [ … ], but these days {I'm …ing} …",
    },
    {
      use: "Agree and disagree with opinions",
      pattern: "agree: [So do I / So am I] · agree with a negative: {Neither do I / Neither am I}",
      examples: [
        "‘I love football.’ ‘[So do I].’",
        "‘I'm not a morning person.’ ‘{Neither am I}.’",
        "‘I can't stand rap.’ ‘Really? I can.’",
      ],
      starter: "I think … ‘[So do I]’ or ‘Really? I don't.’",
    },
    {
      use: "Talk about experiences and when they happened",
      pattern: "[have + participle] = experience · {past simple} = a finished time",
      examples: [
        "I [have been] to Istanbul twice.",
        "I {went} there in 2022.",
        "[Have] you ever [lost] your luggage? What {happened}?",
      ],
      starter: "I [have] … , and it {was} …",
    },
    {
      use: "Talk about likes, hates and feelings",
      pattern: "[enjoy / mind / avoid] + -ing · {want / plan / decide} + to + verb",
      examples: [
        "I [enjoy watching] horror films.",
        "I {decided to stop} worrying.",
        "I [can't stand waiting] in queues.",
      ],
      starter: "I [really enjoy] …ing, but I don't {want to} …",
    },
    {
      use: "Tell a travel story",
      pattern: "[past continuous] for the background · {past simple} for the events · had + participle for earlier",
      examples: [
        "We [were driving] to Agadir when the car {broke down}.",
        "It [was raining], so we {stopped} at a café.",
        "I {realised} I had left my passport at home.",
      ],
      starter: "I [was …ing] when suddenly …",
    },
    {
      use: "Describe how food is made and served",
      pattern: "[am / is / are / was / were] + {past participle}",
      examples: [
        "Couscous [is] traditionally {eaten} on Fridays.",
        "This bread [was] {baked} this morning.",
        "Tea [is] {served} with fresh mint.",
      ],
      starter: "In my country, … [is] {made} with …",
    },
    {
      use: "Talk about how long extraordinary people have been doing things",
      pattern: "[have been + -ing] + {for / since}",
      examples: [
        "She [has been climbing] mountains {for} twenty years.",
        "He [has been writing] songs {since} he was ten.",
        "How long [have] you [been learning] English?",
      ],
      starter: "I [have been] …ing {for} …",
    },
    {
      use: "Guess whether a story is fact or fiction",
      pattern: "[must] = I'm sure it's true · {can't} = I'm sure it's not true · might = maybe",
      examples: [
        "That story [must] be true: it was on the news.",
        "A house with forty rooms {can't} be cheap.",
        "It might be a ghost story.",
      ],
      starter: "I think this story {can't} be true because …",
    },
    {
      use: "Compare products and prices in detail",
      pattern: "[as + adjective + as] · {much / far} + comparative",
      examples: [
        "The market is [as good as] the supermarket.",
        "Online prices are {far cheaper} than in shops.",
        "This phone isn't [as fast as] the new one.",
      ],
      starter: "Buying online is {much} … than …",
    },
    {
      use: "Tell someone what another person said",
      pattern: "[said / told me] + tense moves back: is → {was}, will → {would}",
      examples: [
        "She [said] she {was} in love.",
        "He [told me] he {would} call later.",
        "My friend [said] she {had} met someone new.",
      ],
      starter: "My best friend once [told me] that …",
    },
    {
      use: "Say exactly which person or thing",
      pattern: "person: [who] · thing: {which / that}",
      examples: [
        "My cousin is the person [who] fixes my laptop.",
        "A smartphone is a phone {that} connects to the internet.",
        "I need an app {which} helps me sleep.",
      ],
      starter: "I can't live without an app {that} …",
    },
    {
      use: "Talk about results that are always or likely true",
      pattern: "[If + present], {present} = always · [If + present], {will + verb} = likely",
      examples: [
        "[If you heat ice], it {melts}.",
        "[If we recycle more], we{'ll have} less rubbish.",
        "What {will} happen [if the sea gets warmer]?",
      ],
      starter: "[If we …], the world {will} …",
    },
    {
      use: "Talk about predictions, plans and arrangements",
      pattern: "[will] = prediction · {going to} = plan · I'm meeting = arrangement",
      examples: [
        "I think the weekend [will] be relaxing.",
        "I'm {going to} go camping.",
        "I'm meeting my friends on Saturday.",
      ],
      starter: "Next weekend I'm {going to} …",
    },
    {
      use: "Talk about rules and give study advice",
      pattern: "[must / have to] = obligation · {should} = advice · don't have to = no need",
      examples: [
        "Students [must] attend 80% of classes.",
        "You {should} revise a little every day.",
        "We don't have to wear a uniform.",
      ],
      starter: "In my opinion, students {should} …",
    },
    {
      use: "Talk about how you used to stay in touch",
      pattern: "[used to] + verb · {would} + verb (repeated actions)",
      examples: [
        "We [used to] write letters.",
        "Every Sunday we {would} call my grandmother.",
        "Did you [use to] send postcards?",
      ],
      starter: "When I was younger, I [used to] …",
    },
    {
      use: "Talk about imaginary journeys",
      pattern: "[If + past simple], {would + verb}",
      examples: [
        "[If I won] a lot of money, I {would travel} the world.",
        "[If I could] go anywhere, I{'d go} to Japan.",
        "Where {would} you {go} [if you had] a month off?",
      ],
      starter: "[If I could …], I {would} …",
    },
  ],
  B2: [
    {
      use: "Describe typical behaviour",
      pattern: "[tend to] + verb · {will} + verb (habit) · keep + -ing",
      examples: [
        "People here [tend to] be very friendly.",
        "My brother {will} talk for hours about football.",
        "She keeps forgetting her keys.",
      ],
      starter: "People in my city [tend to] …",
    },
    {
      use: "Balance two sides of an argument",
      pattern: "[although] + clause · {despite} + noun or -ing · however, …",
      examples: [
        "[Although] I disagree, I see your point.",
        "{Despite} its benefits, social media worries me.",
        "It's useful. However, it can be addictive.",
      ],
      starter: "[Although] some people think …, I …",
    },
    {
      use: "Talk about results and ongoing activities",
      pattern: "[have + participle] = result · {have been + -ing} = ongoing activity",
      examples: [
        "I [have read] three books this month.",
        "I {have been reading} a lot lately.",
        "How long {have} you {been working} here?",
      ],
      starter: "Recently I {have been} …ing, and I [have] …",
    },
    {
      use: "Use verbs that change meaning",
      pattern: "[remember / stop / try] + -ing vs {+ to + verb}",
      examples: [
        "I [remember feeling] nervous on my first day.",
        "Please {remember to call} your mother.",
        "I [stopped worrying] about small things.",
      ],
      starter: "I'll never forget [feeling] …",
    },
    {
      use: "Show what had been happening before",
      pattern: "[had been + -ing] before a {past simple} event",
      examples: [
        "We [had been hiking] for hours when it {started} to snow.",
        "I [had been waiting] so long that I {fell} asleep.",
        "She {was} tired because she [had been driving] all night.",
      ],
      starter: "We [had been] …ing for … when …",
    },
    {
      use: "Focus on the action or a service",
      pattern: "[be + past participle] in any tense · {have something + participle}",
      examples: [
        "The restaurant [has been renovated].",
        "The menu [will be changed] next month.",
        "We {had the cake made} by a baker.",
      ],
      starter: "Recently, a … [has been] …",
    },
    {
      use: "Talk about how things could have been different",
      pattern: "[If + had + participle], {would have + participle}",
      examples: [
        "[If she hadn't trained so hard], she {wouldn't have won}.",
        "[If he had given up], he {would have missed} his chance.",
        "What {would} you {have done} [if you had been there]?",
      ],
      starter: "[If I had …], I {would have} …",
    },
    {
      use: "Guess what happened",
      pattern: "[must / might / can't] + {have + participle}",
      examples: [
        "The owners [must] {have left} in a hurry.",
        "Someone [might] {have lived} here for years.",
        "It [can't] {have been} a ghost.",
      ],
      starter: "I think they [must] {have} …",
    },
    {
      use: "Add extra information about products",
      pattern: "…, [which / who] …, · short form: {-ing / -ed} phrase",
      examples: [
        "My phone, [which] I bought last year, already feels old.",
        "People {buying} online often spend more.",
        "Clothes {made} cheaply don't last.",
      ],
      starter: "My favourite brand, [which] …, …",
    },
    {
      use: "Talk about regrets in relationships",
      pattern: "[should have / could have] + {past participle}",
      examples: [
        "I [should have] {apologised} sooner.",
        "You [could have] {told} me the truth!",
        "They [shouldn't have] {argued} in public.",
      ],
      starter: "I [should have] … when …",
    },
    {
      use: "Picture life at a point in the future",
      pattern: "[will be + -ing] = in progress · {will have + participle} = finished",
      examples: [
        "In 2040 we [will be using] self-driving cars.",
        "By then, cities {will have changed} completely.",
        "This time next year I [will be working] online.",
      ],
      starter: "In ten years, people [will be] …ing …",
    },
    {
      use: "Talk about changes you wish for",
      pattern: "[wish / if only] + {past} (now) · + {would} (other people)",
      examples: [
        "I [wish] people {recycled} more.",
        "[If only] governments {would} act.",
        "I [wish] I {didn't} use so much plastic.",
      ],
      starter: "I [wish] my city {…}",
    },
    {
      use: "Talk about past habits and getting used to things",
      pattern: "[used to] + verb (past) · {be / get used to} + -ing (familiar)",
      examples: [
        "I [used to] work every weekend.",
        "I'm {used to relaxing} on Sundays now.",
        "It took me a while to {get used to camping}.",
      ],
      starter: "On holiday I couldn't {get used to} …",
    },
    {
      use: "Link past choices to the present",
      pattern: "[If + had + participle] (past), {would + verb} (now)",
      examples: [
        "[If I had studied medicine], I {would be} a doctor now.",
        "[If I hadn't learned English], I {wouldn't have} this job.",
        "Where {would} you be [if you had chosen] another course?",
      ],
      starter: "[If I had studied …], I {would} … now.",
    },
    {
      use: "Report what was said, and how",
      pattern: "[said / told] + clause · {promised / suggested / admitted / reminded}",
      examples: [
        "She [said] she would call me back.",
        "He {promised} to keep in touch.",
        "My friend {suggested} meeting for coffee.",
      ],
      starter: "My friend recently {suggested} …",
    },
    {
      use: "Ask politely and check information",
      pattern: "[Could you tell me] + where it is? · …, {isn't it?}",
      examples: [
        "[Could you tell me] where the station is?",
        "[Do you know] what time the train leaves?",
        "This is the right platform, {isn't it?}",
      ],
      starter: "[Do you know] whether …?",
    },
  ],
  C1: [
    {
      use: "Choose simple, continuous or perfect for meaning",
      pattern: "[continuous] = in progress · {perfect} = up to a point",
      examples: [
        "I [have been living] in Brighton for a year.",
        "By the time I moved, I {had lost} my accent.",
        "I'm [living] in London, but I {have never felt} English.",
      ],
      starter: "Lately I [have been] …",
    },
    {
      use: "Make careful, softened claims",
      pattern: "[seem / appear / tend] + to · {it could be argued that}",
      examples: [
        "Opinions [seem to] be changing.",
        "{It could be argued that} we share too much.",
        "Young people [tend to] trust online reviews.",
      ],
      starter: "{It could be argued that} …",
    },
    {
      use: "Combine ideas concisely",
      pattern: "[-ing] clause (same time) · {Having + participle} (earlier)",
      examples: [
        "[Walking] through my old school, I felt twelve again.",
        "{Having lived} abroad, I see home differently.",
        "[Asked] about her routine, she laughed.",
      ],
      starter: "[Looking] back, I …",
    },
    {
      use: "Add strong emphasis",
      pattern: "[do / did] + verb · {by far / utterly / truly}",
      examples: [
        "I [do] love a quiet Sunday.",
        "That was {by far} the happiest day of my life.",
        "I was {utterly} exhausted.",
      ],
      starter: "I [do] believe that …",
    },
    {
      use: "Write precise, formal descriptions",
      pattern: "[in which / to whom] · {most of which / some of whom}",
      examples: [
        "The village [in which] I stayed had no roads.",
        "I met many travellers, {most of whom} spoke English.",
        "The forest, [through which] we walked, was silent.",
      ],
      starter: "The place [in which] I …",
    },
    {
      use: "Report beliefs and claims impersonally",
      pattern: "[It is said that] … · subject + {is said to} + verb",
      examples: [
        "[It is believed that] olive oil is good for the heart.",
        "This dish {is said to} come from Fes.",
        "Coffee {is thought to have} originated in Ethiopia.",
      ],
      starter: "[It is often said that] …",
    },
    {
      use: "Make strong, formal statements",
      pattern: "[Never / Rarely / Not only] + {auxiliary} + subject",
      examples: [
        "[Never] {had} anyone climbed it before.",
        "[Not only] {did} she win, but she broke the record.",
        "[Rarely] {does} someone so young achieve so much.",
      ],
      starter: "[Rarely] {do} we see …",
    },
    {
      use: "Speculate about what is or was true",
      pattern: "[may / might / could] + verb · {may / might / could} + have + participle",
      examples: [
        "The story [might] be based on real events.",
        "The house {could have been} built on an old site.",
        "The writer [may] be exaggerating.",
      ],
      starter: "Perhaps the story {might have} …",
    },
    {
      use: "Sound formal and analytical",
      pattern: "verb → noun: grow → [growth] · decide → {decision}",
      examples: [
        "The [growth] of online shopping is remarkable.",
        "The {decision} to cut prices worked.",
        "There has been a sharp [increase] in second-hand sales.",
      ],
      starter: "The [rise] of … will …",
    },
    {
      use: "Express regret, urgency and preference",
      pattern: "[wish / it's time] + past · {would rather} + past",
      examples: [
        "I [wish] we spent more time together.",
        "[It's time] we talked honestly.",
        "I'd {rather} you told me the truth.",
      ],
      starter: "[It's high time] we …",
    },
    {
      use: "Structure an argument",
      pattern: "[Furthermore / Moreover] · {Nevertheless / Conversely} · Consequently",
      examples: [
        "Cameras make streets safer. [Moreover], they deter crime.",
        "Apps are free. {Nevertheless}, we pay with our privacy.",
        "Consequently, regulation is needed.",
      ],
      starter: "Technology helps us. [Furthermore], …",
    },
    {
      use: "Emphasise one part of what you say",
      pattern: "[What] … is … · {It is} … that …",
      examples: [
        "[What] worries me is the speed of climate change.",
        "{It is} small changes that make the difference.",
        "[What] we need is cooperation.",
      ],
      starter: "[What] concerns me most about the world is …",
    },
    {
      use: "Avoid repeating words",
      pattern: "[so / not] · {do / one}",
      examples: [
        "Are you going away this weekend? I hope [so].",
        "I wanted to go hiking, but I never {did}.",
        "I prefer the quieter {one}.",
      ],
      starter: "Some people say … I don't think [so], because …",
    },
    {
      use: "Talk about achievements and recognition",
      pattern: "[having + participle] · {to be + participle} · to have + participle",
      examples: [
        "I'm proud of [having passed] my exams.",
        "Every student wants {to be encouraged}.",
        "She seems to have learned very quickly.",
      ],
      starter: "I'm proud of [having] …",
    },
    {
      use: "Talk about imminent and expected events",
      pattern: "[be about to] = very soon · {be due to} = scheduled · be bound to = certain",
      examples: [
        "I'm [about to] start a new job.",
        "My cousin is {due to} arrive on Friday.",
        "We're bound to lose touch if we don't call.",
      ],
      starter: "Soon I'm [about to] …",
    },
    {
      use: "Discuss hypothetical journeys formally",
      pattern: "[Had I known] … · {Were it} … · Should you …",
      examples: [
        "[Had I known] about the strike, I would have flown.",
        "{Were it} cheaper, I would travel by train.",
        "Should you visit Fes, see the tanneries.",
      ],
      starter: "[Had I been] free last summer, I would …",
    },
  ],
  C2: [
    {
      use: "Shift focus by changing word order",
      pattern: "[object or adjective] first + subject + verb · {… as it may seem}",
      examples: [
        "[This city] I will never forget.",
        "[Strange] {as it may seem}, I feel at home abroad.",
        "[Home] is where I'm understood.",
      ],
      starter: "[Odd] {as it may sound}, …",
    },
    {
      use: "Signal exactly how certain you are",
      pattern: "[may well / is likely to] · {arguably / presumably}",
      examples: [
        "This [may well] be the best explanation.",
        "It is, {arguably}, unprovable.",
        "Experts [are likely to] disagree.",
      ],
      starter: "It [may well] be that …",
    },
    {
      use: "Shade meaning through tense",
      pattern: "[was wondering] = tentative · {have come to} = gradual change",
      examples: [
        "I [was wondering] whether routines make us happier.",
        "I {have come to} value quiet mornings.",
        "We [are forever] checking our phones.",
      ],
      starter: "I {have come to} realise that …",
    },
    {
      use: "Interpret and use figurative language",
      pattern: "[metaphor] · {idiom} · words with a positive or negative feel",
      examples: [
        "Grief is [a heavy coat] you learn to wear.",
        "I was {over the moon} when I heard.",
        "Is she ‘determined’ or ‘stubborn’?",
      ],
      starter: "For me, love is [a …] because …",
    },
    {
      use: "Write vivid, compact description",
      pattern: "[-ing / -ed] clause · {verbless}: adjective or noun phrase",
      examples: [
        "[Shrouded in mist], the valley looked untouched.",
        "{Exhausted but happy}, we reached the summit.",
        "[Left alone], nature recovers.",
      ],
      starter: "[Surrounded by] …, I …",
    },
    {
      use: "Pack ideas into precise noun phrases",
      pattern: "[the + noun] + {of / for} + noun phrase",
      examples: [
        "[The globalisation] {of} food has changed our diets.",
        "[The demand] {for} cheap meat harms the planet.",
        "Unequal access {to} fresh food is a concern.",
      ],
      starter: "[The commercialisation] {of} …",
    },
    {
      use: "Describe the past from an earlier point of view",
      pattern: "[was to / would] = what happened later · {to have + participle}",
      examples: [
        "Nobody knew she [was to] become a legend.",
        "He [would] later change medicine forever.",
        "Ibn Battuta is said {to have travelled} 120,000 km.",
      ],
      starter: "At the time, nobody knew that … [would] …",
    },
    {
      use: "Show your attitude to a source",
      pattern: "[allegedly / purportedly] · {claims / concedes / insists}",
      examples: [
        "The house is [allegedly] haunted.",
        "The owner {concedes} the story is exaggerated.",
        "The photo was [purportedly] taken in 1920.",
      ],
      starter: "The article {claims} … , but …",
    },
    {
      use: "Persuade with structure",
      pattern: "[So / Such] … that · {Little did} they know · three-part lists",
      examples: [
        "[So] convincing was the advert that sales doubled.",
        "{Little did} buyers know the price would fall.",
        "Faster, lighter, smarter.",
      ],
      starter: "[Never before] has …",
    },
    {
      use: "Use irony and tone",
      pattern: "[not exactly / a tad] = understatement · {ironic praise}",
      examples: [
        "The first date was [not exactly] a success.",
        "Forgetting her birthday was [a tad] unwise.",
        "‘{Lovely},’ she said, as he arrived an hour late.",
      ],
      starter: "It was [not exactly] …",
    },
    {
      use: "Explore alternatives precisely",
      pattern: "[But for / Were it not for] + noun · {Supposing / Provided that}",
      examples: [
        "[But for] smartphones, we would get lost more.",
        "[Were it not for] cameras, crime might rise.",
        "{Supposing} cars disappeared, how would cities change?",
      ],
      starter: "[Were it not for] technology, …",
    },
    {
      use: "Express demands and recommendations formally",
      pattern: "[insist / recommend / it is essential] that + {base verb}",
      examples: [
        "Scientists [insist that] emissions {be} cut.",
        "[It is vital that] every country {act} now.",
        "They [recommended that] the forest {be} protected.",
      ],
      starter: "[I would propose that] the world {…}",
    },
    {
      use: "Connect a long argument smoothly",
      pattern: "[the former / the latter / this] · {do so / one}",
      examples: [
        "Some rest, others travel; [the latter] return happier.",
        "Many plan a break, but few {do so}.",
        "[This] is why rest matters.",
      ],
      starter: "[The former] … whereas [the latter] …",
    },
    {
      use: "Concede a point formally",
      pattern: "[albeit / notwithstanding] · {much as} + clause",
      examples: [
        "The course was useful, [albeit] demanding.",
        "{Much as} I value exams, they are not everything.",
        "[Notwithstanding] the cost, education pays.",
      ],
      starter: "{Much as} I respect …, …",
    },
    {
      use: "Build complex, precise sentences",
      pattern: "[It is … that] · {whereby / whose}",
      examples: [
        "[It is] small messages [that] keep friendships alive.",
        "We set up a system {whereby} we call every Sunday.",
        "Friends {whose} lives move on still matter.",
      ],
      starter: "[It is not] … [that] …, but …",
    },
    {
      use: "Choose exactly the right word and tone",
      pattern: "[formal] vs {informal} · precise vocabulary",
      examples: [
        "Passengers are requested to [refrain from] smoking.",
        "The trip was {a total nightmare}.",
        "The road meandered through olive groves.",
      ],
      starter: "To my mind, the best journeys are …",
    },
  ],
};
