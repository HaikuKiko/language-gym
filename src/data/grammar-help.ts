/**
 * Draft help for each week's grammar point: what it is for, the pattern,
 * three examples and a sentence starter. Used when the database has no help
 * columns yet; once it does, the `weeks` table is the source.
 *
 * Highlighting: text in [square brackets] is shown in orange and text in
 * {curly brackets} in blue, so the parts of a pattern can be matched to the
 * same parts in the examples.
 */
import type { Level } from '@/data/questions';

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
      use: "Talk about who you are",
      pattern: "I [am] · you / we / they [are] · he / she / it [is]",
      examples: [
        "I [am] a student.",
        "She [is] my teacher.",
        "We [are] in class 3.",
      ],
      starter: "Hi, I [am] … and I [am] from …",
    },
    {
      use: "Ask and answer about people and places",
      pattern: "[Are] you …? · I [am not] …",
      examples: [
        "[Are] you from Morocco?",
        "[Is] she a teacher? No, she [isn't].",
        "I [am not] from Paris.",
      ],
      starter: "[Are] you from …?",
    },
    {
      use: "Say who people and things belong to",
      pattern: "[my · your · his · her · our · their] + noun · name + {'s}",
      examples: [
        "This is [my] brother.",
        "[Her] name is Sara.",
        "Tom{'s} sister is a doctor.",
      ],
      starter: "[My] family is …",
    },
    {
      use: "Name things near and far",
      pattern: "[a] book · [an] apple · {this / these} here · {that / those} there",
      examples: [
        "{This} is [a] pen.",
        "{Those} are my keys.",
        "Is {that} [an] umbrella?",
      ],
      starter: "{This} is [a] …",
    },
    {
      use: "Talk about your routine",
      pattern: "I / you / we / they + [verb]",
      examples: [
        "I [get up] at seven.",
        "We [have] lunch at one.",
        "They [don't work] on Sundays.",
      ],
      starter: "Every morning I [ … ]",
    },
    {
      use: "Talk about other people's habits",
      pattern: "he / she / it + verb{-s}",
      examples: [
        "She play{s} tennis on Saturdays.",
        "My brother watch{es} films every night.",
        "He [doesn't like] football.",
      ],
      starter: "My friend like{s} …",
    },
    {
      use: "Talk about food you have or need",
      pattern: "[some] in positive sentences · {any} in questions and negatives",
      examples: [
        "I have [some] eggs.",
        "Is there {any} milk?",
        "We don't have {any} bread.",
      ],
      starter: "In my fridge there is [some] …",
    },
    {
      use: "Describe a place",
      pattern: "[There is] + one thing · {There are} + two or more",
      examples: [
        "[There is] a sofa in my living room.",
        "{There are} two bedrooms.",
        "[Is there] a garden?",
      ],
      starter: "In my home [there is] …",
    },
    {
      use: "Say where things are",
      pattern: "[in] · [on] · [next to] · [between] · [opposite]",
      examples: [
        "The bank is [next to] the café.",
        "The keys are [on] the table.",
        "The school is [opposite] the park.",
      ],
      starter: "My house is [near] …",
    },
    {
      use: "Say when things happen",
      pattern: "[at] + time · [on] + day · [in] + month or year",
      examples: [
        "Class starts [at] nine o'clock.",
        "My birthday is [in] May.",
        "I see my friends [on] Fridays.",
      ],
      starter: "[On] Saturdays I …",
    },
    {
      use: "Talk about what you can do",
      pattern: "[can] / {can't} + verb",
      examples: [
        "I [can] swim.",
        "She {can't} drive.",
        "[Can] you cook?",
      ],
      starter: "I [can] … but I {can't} …",
    },
    {
      use: "Talk about likes and dislikes",
      pattern: "[like / love / hate] + {verb-ing}",
      examples: [
        "I [love] {reading} books.",
        "He [hates] {getting up} early.",
        "Do you [like] {cooking}?",
      ],
      starter: "I [love] {…ing} because …",
    },
    {
      use: "Describe what is happening now",
      pattern: "[am / is / are] + {verb-ing}",
      examples: [
        "I [am] {wearing} a blue jacket.",
        "She [is] {buying} new shoes.",
        "What [are] you {doing}?",
      ],
      starter: "Right now I [am] {…ing} …",
    },
    {
      use: "Say how often you do things",
      pattern: "[always · usually · often · sometimes · never] + verb",
      examples: [
        "It [often] rains in November.",
        "I [never] go to the beach in winter.",
        "Do you [usually] take an umbrella?",
      ],
      starter: "In summer I [usually] …",
    },
    {
      use: "Talk about yesterday",
      pattern: "I / he / she / it [was] · you / we / they {were}",
      examples: [
        "I [was] at home yesterday.",
        "We {were} tired after work.",
        "Where {were} you on Sunday?",
      ],
      starter: "Yesterday I [was] …",
    },
    {
      use: "Say what you did",
      pattern: "verb + [-ed]",
      examples: [
        "I play[ed] football on Saturday.",
        "We visit[ed] my uncle.",
        "She stay[ed] at home and cook[ed].",
      ],
      starter: "Last weekend I …[ed] …",
    },
  ],
  A2: [
    {
      use: "Tell your life story",
      pattern: "regular: [worked, lived] · irregular: {went, had, met}",
      examples: [
        "I [lived] in Fes for ten years.",
        "I {went} to school in Rabat.",
        "My parents {met} in 1995.",
      ],
      starter: "When I was a child, I [lived] …",
    },
    {
      use: "Ask and talk about trips",
      pattern: "[Did] + you + verb? · I {didn't} + verb",
      examples: [
        "[Did] you take the train?",
        "We {didn't} have a car.",
        "How long [did] the journey take?",
      ],
      starter: "[Did] you ever travel by …?",
    },
    {
      use: "Set the scene in the past",
      pattern: "[was / were] + {verb-ing}",
      examples: [
        "I [was] {playing} outside when it started to rain.",
        "We [were] {living} in a small flat.",
        "What [were] you {doing} at eight o'clock?",
      ],
      starter: "When I was ten, I [was] {…ing} …",
    },
    {
      use: "Say how much or how many",
      pattern: "[much] + uncountable · {many} + plural",
      examples: [
        "[How much] water do you drink?",
        "{How many} cafés are near your home?",
        "There aren't {many} cheap restaurants here.",
      ],
      starter: "I don't eat [much] …",
    },
    {
      use: "Compare two things",
      pattern: "short adjective + [-er than] · {more} + long adjective + [than]",
      examples: [
        "This shop is cheap[er than] that one.",
        "Online shopping is {more} convenient [than] going out.",
        "Is it bett[er than] the old one?",
      ],
      starter: "I think … is bett[er than] …",
    },
    {
      use: "Say which is the most",
      pattern: "[the] + adjective{-est} · [the most] + long adjective",
      examples: [
        "Casablanca is [the] bigg{est} city in Morocco.",
        "Chefchaouen is [the most] beautiful town I know.",
        "What's [the] b{est} city to visit?",
      ],
      starter: "[The most] interesting place I know is …",
    },
    {
      use: "Talk about your plans",
      pattern: "[am / is / are going to] + {verb}",
      examples: [
        "I'm [going to] {visit} my cousins.",
        "We're [going to] {have} a picnic.",
        "What are you [going to] {do} on Saturday?",
      ],
      starter: "This weekend I'm [going to] …",
    },
    {
      use: "Make predictions",
      pattern: "[will] / {won't} + verb",
      examples: [
        "It [will] be sunny tomorrow.",
        "I think it {won't} rain.",
        "[Will] you need a coat?",
      ],
      starter: "I think tomorrow it [will] …",
    },
    {
      use: "Talk about experiences",
      pattern: "[have / has] + past participle · {ever} / {never}",
      examples: [
        "[Have] you {ever} eaten snails?",
        "I [have] {never} been to Spain.",
        "She [has] climbed Toubkal.",
      ],
      starter: "I [have] {never} …",
    },
    {
      use: "Give advice",
      pattern: "[should] / {shouldn't} + verb",
      examples: [
        "You [should] drink more water.",
        "You {shouldn't} stay up so late.",
        "What [should] I do for a headache?",
      ],
      starter: "If you feel tired, you [should] …",
    },
    {
      use: "Talk about rules",
      pattern: "[have to / must] = necessary · {don't have to} = not necessary",
      examples: [
        "We [have to] wear a uniform.",
        "You [must] switch off your phone in class.",
        "I {don't have to} work on Fridays.",
      ],
      starter: "At my school we [have to] …",
    },
    {
      use: "Talk about recent news",
      pattern: "[have / has] + {just / already} + participle · [haven't] … {yet}",
      examples: [
        "I['ve] {just} bought a new phone.",
        "She['s] {already} downloaded the app.",
        "I [haven't] updated it {yet}.",
      ],
      starter: "I['ve] {just} …",
    },
    {
      use: "Talk about work you enjoy or want",
      pattern: "[enjoy / finish] + -ing · {want / hope / decide} + to + verb",
      examples: [
        "I [enjoy working] with people.",
        "She {wants to become} a nurse.",
        "I {hope to find} a better job.",
      ],
      starter: "In the future I {want to} …",
    },
    {
      use: "Describe how things are done",
      pattern: "adjective: a [good] singer · adverb: sings {well}",
      examples: [
        "She is a [careful] driver. She drives {carefully}.",
        "The film was [slow] but {beautifully} filmed.",
        "He speaks English {fluently}.",
      ],
      starter: "My favourite series is [exciting] because …",
    },
    {
      use: "Talk about real possibilities",
      pattern: "[If + present], {will + verb}",
      examples: [
        "[If it's sunny tomorrow], we {will go} to the park.",
        "[If we cut down the forests], animals {will lose} their homes.",
        "What {will} you do [if it rains]?",
      ],
      starter: "[If the weather is nice this weekend], I {will} …",
    },
    {
      use: "Talk about fixed plans",
      pattern: "[am / is / are] + {verb-ing} + a time",
      examples: [
        "I'm {meeting} Sara on Friday.",
        "We're {having} a party on Saturday.",
        "[Are] you {doing} anything tonight?",
      ],
      starter: "On Saturday I'm {…ing} …",
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
      use: "Tell a story about the past",
      pattern: "[past continuous] for the background · {past simple} for the events",
      examples: [
        "We [were driving] to Agadir when the car {broke down}.",
        "It [was raining], so we {stopped} at a café.",
        "I {realised} I had left my passport at home.",
      ],
      starter: "I [was …ing] when suddenly …",
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
      use: "Say how long something has been going on",
      pattern: "[have been + -ing] + {for / since}",
      examples: [
        "I [have been working] here {for} three years.",
        "She [has been studying] medicine {since} 2023.",
        "How long [have] you [been learning] English?",
      ],
      starter: "I [have been] …ing {for} …",
    },
    {
      use: "Talk about predictions, plans and arrangements",
      pattern: "[will] = prediction · {going to} = plan · I'm meeting = arrangement",
      examples: [
        "I think I [will] change jobs one day.",
        "I'm {going to} start a course next month.",
        "I'm meeting my teacher on Tuesday.",
      ],
      starter: "Next year I'm {going to} …",
    },
    {
      use: "Talk about rules and give advice",
      pattern: "[must / have to] = obligation · {should} = advice · don't have to = no need",
      examples: [
        "Students [must] attend 80% of classes.",
        "You {should} revise a little every day.",
        "We don't have to wear a uniform.",
      ],
      starter: "In my opinion, students {should} …",
    },
    {
      use: "Talk about results that are always or likely true",
      pattern: "[If + present], {present} = always · [If + present], {will + verb} = likely",
      examples: [
        "[If you don't sleep], you {feel} tired.",
        "[If I join a gym], I{'ll get} fitter.",
        "What {will} you do [if you get ill]?",
      ],
      starter: "[If I …], I{'ll} …",
    },
    {
      use: "Talk about imaginary or unlikely situations",
      pattern: "[If + past simple], {would + verb}",
      examples: [
        "[If I won] a lot of money, I {would buy} a house by the sea.",
        "[If I had] more time, I{'d travel} more.",
        "What {would} you {do} [if you lost] your phone?",
      ],
      starter: "[If I …], I {would} …",
    },
    {
      use: "Say what is done, not who does it",
      pattern: "[am / is / are / was / were] + {past participle}",
      examples: [
        "The news [is] {watched} by millions.",
        "This article [was] {written} by a student.",
        "Most news [is] {read} on phones now.",
      ],
      starter: "In my country, most news [is] {…}",
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
      use: "Say how sure you are about the future",
      pattern: "[will] = sure · {may / might} = possible",
      examples: [
        "Sea levels [will] rise.",
        "We {might} have hotter summers.",
        "Cars {may} use less petrol in the future.",
      ],
      starter: "In twenty years, cities {might} …",
    },
    {
      use: "Talk about past habits",
      pattern: "[used to] + verb · {would} + verb (repeated actions)",
      examples: [
        "I [used to] live in the countryside.",
        "Every summer we {would} visit my grandparents.",
        "Did you [use to] like school?",
      ],
      starter: "When I was a child, I [used to] …",
    },
    {
      use: "Tell someone what another person said",
      pattern: "[said / told me] + tense moves back: is → {was}, will → {would}",
      examples: [
        "She [said] she {was} tired.",
        "He [told me] he {would} call later.",
        "My friend [said] she {had} met someone new.",
      ],
      starter: "My best friend once [told me] that …",
    },
    {
      use: "Compare in more detail",
      pattern: "[as + adjective + as] · {much / far} + comparative",
      examples: [
        "Moroccan bread is [as good as] French bread.",
        "Street food is {far cheaper} than restaurant food.",
        "Cooking at home isn't [as quick as] ordering.",
      ],
      starter: "Home cooking is {much} … than …",
    },
    {
      use: "Guess what is true",
      pattern: "[must] = I'm sure it's true · {can't} = I'm sure it's not true · might = maybe",
      examples: [
        "He [must] be the thief: he was there.",
        "She {can't} be guilty: she was abroad.",
        "Someone might have a key.",
      ],
      starter: "The person {can't} be … because …",
    },
    {
      use: "Talk about free time and preferences",
      pattern: "[enjoy / mind / avoid] + -ing · {want / plan / decide} + to + verb",
      examples: [
        "I [enjoy watching] horror films.",
        "We {decided to see} a concert.",
        "I [don't mind waiting] for tickets.",
      ],
      starter: "I [really enjoy] …ing, but I don't {want to} …",
    },
  ],
  B2: [
    {
      use: "Describe typical behaviour",
      pattern: "[tend to] + verb · {will} + verb (habit) · keep + -ing",
      examples: [
        "I [tend to] get nervous before exams.",
        "My brother {will} talk for hours about football.",
        "She keeps forgetting her keys.",
      ],
      starter: "I [tend to] … when …",
    },
    {
      use: "Show what had been happening before",
      pattern: "[had been + -ing] before a {past simple} event",
      examples: [
        "We [had been travelling] for twelve hours when we {arrived}.",
        "I [had been waiting] so long that I {fell} asleep.",
        "She {was} tired because she [had been driving] all night.",
      ],
      starter: "We [had been] …ing for … when …",
    },
    {
      use: "Picture your life at a point in the future",
      pattern: "[will be + -ing] = in progress · {will have + participle} = finished",
      examples: [
        "This time next year I [will be working] abroad.",
        "By 2030 I {will have paid} off my loan.",
        "At 9 p.m. I [will be relaxing] at home.",
      ],
      starter: "In five years I {will have} … and I [will be] …ing …",
    },
    {
      use: "Focus on the action or a service",
      pattern: "[be + past participle] in any tense · {have something + participle}",
      examples: [
        "A new vaccine [has been developed].",
        "The results [will be published] next month.",
        "I {had my eyes tested} last week.",
      ],
      starter: "Recently, a … [has been] …",
    },
    {
      use: "Talk about past regrets",
      pattern: "[If + had + participle], {would have + participle}",
      examples: [
        "[If I had studied harder], I {would have passed}.",
        "[If we had left earlier], we {wouldn't have missed} the flight.",
        "What {would} you {have done} [if you had known]?",
      ],
      starter: "[If I had …], I {would have} …",
    },
    {
      use: "Link the past and the present in imaginary situations",
      pattern: "[If + had + participle] (past), {would + verb} (now)",
      examples: [
        "[If I had learned Chinese], I {would be} working in Shanghai now.",
        "[If I hadn't moved], I {would} still {live} with my parents.",
        "Where {would} you live [if you had been born] elsewhere?",
      ],
      starter: "[If I had …], I {would} … now.",
    },
    {
      use: "Report what was said, and how",
      pattern: "[said / told] + clause · {claimed / denied / admitted / promised}",
      examples: [
        "The minister [said] that prices would fall.",
        "He {denied} lying to the press.",
        "The paper {claimed} the story was true.",
      ],
      starter: "A journalist recently {claimed} that …",
    },
    {
      use: "Add extra information",
      pattern: ", [which / who] …, · short form: {-ing / -ed} phrase",
      examples: [
        "My phone, [which] I bought last year, already feels old.",
        "People {buying} online often spend more.",
        "Clothes {made} cheaply don't last.",
      ],
      starter: "My favourite brand, [which] …, …",
    },
    {
      use: "Criticise or regret the past",
      pattern: "[should have / could have] + {past participle}",
      examples: [
        "I [should have] {seen} a doctor sooner.",
        "You [could have] {told} me you were ill!",
        "They [shouldn't have] {ignored} the symptoms.",
      ],
      starter: "I [should have] … when …",
    },
    {
      use: "Guess what happened",
      pattern: "[must / might / can't] + {have + participle}",
      examples: [
        "They [must] {have left} in a hurry.",
        "The ship [might] {have hit} a rock.",
        "He [can't] {have known} about it.",
      ],
      starter: "I think they [must] {have} …",
    },
    {
      use: "Talk about changes you wish for",
      pattern: "[wish / if only] + {past} (now) · + {would} (other people)",
      examples: [
        "I [wish] people {recycled} more.",
        "[If only] the government {would} act.",
        "I [wish] I {didn't} use so much plastic.",
      ],
      starter: "I [wish] my city {…}",
    },
    {
      use: "Talk about places in general and specific terms",
      pattern: "[a / the / no article] · {few / a few / little / a little}",
      examples: [
        "[The] rent in [the] city centre is high.",
        "There are {few} parks near me.",
        "{A little} more green space would help.",
      ],
      starter: "What my city needs is {a few} more …",
    },
    {
      use: "Use verbs that change meaning",
      pattern: "[remember / stop / try] + -ing vs {+ to + verb}",
      examples: [
        "I [remember seeing] that painting as a child.",
        "Please {remember to buy} the tickets.",
        "We [stopped talking] when the music started.",
      ],
      starter: "I'll never forget [seeing] …",
    },
    {
      use: "Balance two sides of an argument",
      pattern: "[although] + clause · {despite} + noun or -ing · however, …",
      examples: [
        "[Although] phones connect us, they can isolate us.",
        "{Despite} its benefits, AI worries many people.",
        "Social media is useful. However, it can be addictive.",
      ],
      starter: "[Although] technology …, …",
    },
    {
      use: "Talk about past habits and getting used to things",
      pattern: "[used to] + verb (past) · {be / get used to} + -ing (familiar)",
      examples: [
        "I [used to] hate studying.",
        "I'm {used to working} late now.",
        "It took me a year to {get used to studying} online.",
      ],
      starter: "When I started …, I couldn't {get used to} …",
    },
    {
      use: "Ask politely and check information",
      pattern: "[Could you tell me] + where it is? · …, {isn't it?}",
      examples: [
        "[Could you tell me] where the station is?",
        "[Do you know] what time it starts?",
        "It's rude to be late, {isn't it?}",
      ],
      starter: "[Do you know] whether …?",
    },
  ],
  C1: [
    {
      use: "Choose simple, continuous or perfect for meaning",
      pattern: "[continuous] = in progress · {perfect} = up to a point",
      examples: [
        "I [have been thinking] about my accent lately.",
        "By the time I moved, I {had lost} my local dialect.",
        "I'm [living] in London, but I {have never felt} English.",
      ],
      starter: "Lately I [have been] …",
    },
    {
      use: "Talk about imminent and expected events",
      pattern: "[be about to] = very soon · {be due to} = scheduled · be bound to = certain",
      examples: [
        "I'm [about to] start a new role.",
        "The report is {due to} be published in May.",
        "With her talent, she's bound to succeed.",
      ],
      starter: "In my field, things are bound to …",
    },
    {
      use: "Discuss hypotheticals formally",
      pattern: "[Had I known] … · {Were it} … · Should you …",
      examples: [
        "[Had I known] the truth, I would have refused.",
        "{Were it} legal, would you do it?",
        "Should you find a wallet, what would you do?",
      ],
      starter: "[Had I been] in that situation, I would …",
    },
    {
      use: "Report beliefs and claims impersonally",
      pattern: "[It is said that] … · subject + {is said to} + verb",
      examples: [
        "[It is believed that] influencers shape opinions.",
        "The app {is said to} track users.",
        "The CEO {is thought to have} resigned.",
      ],
      starter: "[It is often said that] the media …",
    },
    {
      use: "Emphasise one part of what you say",
      pattern: "[What] … is … · {It was} … that …",
      examples: [
        "[What] worries me is the speed of change.",
        "{It was} vaccines that changed everything.",
        "[What] we need is more funding.",
      ],
      starter: "[What] fascinates me about science is …",
    },
    {
      use: "Combine ideas concisely",
      pattern: "[-ing] clause (same time) · {Having + participle} (earlier)",
      examples: [
        "[Walking] through my old school, I felt twelve again.",
        "{Having left} home young, I remember little.",
        "[Asked] about her childhood, she smiled.",
      ],
      starter: "[Looking] back, I …",
    },
    {
      use: "Make strong, formal statements",
      pattern: "[Never / Rarely / Not only] + {auxiliary} + subject",
      examples: [
        "[Never] {have} politicians been so distrusted.",
        "[Not only] {did} they lie, but they also hid evidence.",
        "[Rarely] {does} a leader admit a mistake.",
      ],
      starter: "[Rarely] {do} we see …",
    },
    {
      use: "Make careful, softened claims",
      pattern: "[seem / appear / tend] + to · {it could be argued that}",
      examples: [
        "Inequality [appears to] be growing.",
        "{It could be argued that} taxes are too low.",
        "The wealthy [tend to] save more.",
      ],
      starter: "{It could be argued that} money …",
    },
    {
      use: "Speculate about behaviour",
      pattern: "[may / might / could] + verb · {may / might / could} + have + participle",
      examples: [
        "He [might] be anxious rather than rude.",
        "She {could have} misunderstood.",
        "People [may] act differently online.",
      ],
      starter: "Perhaps they {might have} …",
    },
    {
      use: "Express regret, urgency and preference",
      pattern: "[wish / it's time] + past · {would rather} + past",
      examples: [
        "[It's time] we took climate change seriously.",
        "I [wish] we consumed less.",
        "I'd {rather} governments acted now.",
      ],
      starter: "[It's high time] we …",
    },
    {
      use: "Write precise, formal descriptions",
      pattern: "[in which / to whom] · {most of which / some of whom}",
      examples: [
        "The culture [in which] I grew up valued family.",
        "I met many travellers, {most of whom} spoke English.",
        "The festival, [to which] thousands come, is famous.",
      ],
      starter: "The tradition [in which] I …",
    },
    {
      use: "Avoid repeating words",
      pattern: "[so / not] · {do / one}",
      examples: [
        "Can art be taught? I think [so].",
        "I wanted to paint, but I never {did}.",
        "I prefer the darker {one}.",
      ],
      starter: "Some people say … I don't think [so], because …",
    },
    {
      use: "Structure an argument",
      pattern: "[Furthermore / Moreover] · {Nevertheless / Conversely} · Consequently",
      examples: [
        "Data is valuable. [Moreover], it is easy to steal.",
        "Apps are free. {Nevertheless}, we pay with our privacy.",
        "Consequently, regulation is needed.",
      ],
      starter: "Privacy matters. [Furthermore], …",
    },
    {
      use: "Talk about achievements and recognition",
      pattern: "[having + participle] · {to be + participle} · to have + participle",
      examples: [
        "I'm proud of [having passed] my exams.",
        "Everyone wants {to be appreciated}.",
        "She seems to have succeeded early.",
      ],
      starter: "I'm proud of [having] …",
    },
    {
      use: "Add strong emphasis",
      pattern: "[do / did] + verb · {by far / utterly / truly}",
      examples: [
        "I [do] try to sleep eight hours.",
        "That was {by far} the hardest year.",
        "It's {truly} vital to rest.",
      ],
      starter: "I [do] believe that …",
    },
    {
      use: "Sound formal and analytical",
      pattern: "verb → noun: grow → [growth] · decide → {decision}",
      examples: [
        "The [growth] of cities brings challenges.",
        "The {decision} to automate cost jobs.",
        "There has been a sharp [increase] in remote work.",
      ],
      starter: "The [rise] of … will …",
    },
  ],
  C2: [
    {
      use: "Shade meaning through tense",
      pattern: "[was wondering] = tentative · {have come to} = gradual change",
      examples: [
        "I [was wondering] whether language shapes thought.",
        "I {have come to} believe it does.",
        "We [are forever] translating our thoughts.",
      ],
      starter: "I {have come to} realise that …",
    },
    {
      use: "Signal exactly how certain you are",
      pattern: "[may well / is likely to] · {arguably / presumably}",
      examples: [
        "This [may well] be the best explanation.",
        "It is, {arguably}, unprovable.",
        "Scientists [are likely to] disagree.",
      ],
      starter: "It [may well] be that …",
    },
    {
      use: "Express demands and recommendations formally",
      pattern: "[insist / recommend / it is essential] that + {base verb}",
      examples: [
        "The judge [insisted that] he {be} released.",
        "[It is vital that] every citizen {have} a lawyer.",
        "They [recommended that] the law {be} changed.",
      ],
      starter: "[I would propose that] the law {be} …",
    },
    {
      use: "Persuade with structure",
      pattern: "[So / Such] … that · {Little did} they know · three-part lists",
      examples: [
        "[So] powerful was the speech that people wept.",
        "{Little did} voters know what was coming.",
        "We will listen, we will learn, we will act.",
      ],
      starter: "[Never before] has …",
    },
    {
      use: "Explore alternatives precisely",
      pattern: "[But for / Were it not for] + noun · {Supposing / Provided that}",
      examples: [
        "[But for] the internet, AI couldn't exist.",
        "[Were it not for] regulation, data would be sold.",
        "{Supposing} machines became conscious, what then?",
      ],
      starter: "[Were it not for] technology, …",
    },
    {
      use: "Shift focus by changing word order",
      pattern: "[object or adjective] first + subject + verb · {… as it may seem}",
      examples: [
        "[This feeling] I have never lost.",
        "[Strange] {as it may seem}, I feel at home abroad.",
        "[Home] is where I'm understood.",
      ],
      starter: "[Odd] {as it may sound}, …",
    },
    {
      use: "Pack ideas into precise noun phrases",
      pattern: "[the + noun] + {of / for} + noun phrase",
      examples: [
        "[The undervaluation] {of} care work is striking.",
        "[The pursuit] {of} profit at all costs harms trust.",
        "Unequal access {to} housing is a growing concern.",
      ],
      starter: "[The commodification] {of} …",
    },
    {
      use: "Interpret and use figurative language",
      pattern: "[metaphor] · {idiom} · words with a positive or negative feel",
      examples: [
        "Art is [a mirror] held up to society.",
        "The critics {tore the play to shreds}.",
        "Is it 'bold' or 'reckless'?",
      ],
      starter: "For me, art is [a …] because …",
    },
    {
      use: "Describe the past from an earlier point of view",
      pattern: "[was to / would] = what happened later · {to have + participle}",
      examples: [
        "Nobody knew the war [was to] last six years.",
        "The empire [would] soon collapse.",
        "The city is said {to have been} founded in 789.",
      ],
      starter: "At the time, nobody knew that … [would] …",
    },
    {
      use: "Concede a point formally",
      pattern: "[albeit / notwithstanding] · {much as} + clause",
      examples: [
        "The results were promising, [albeit] limited.",
        "{Much as} I respect the data, I doubt the method.",
        "[Notwithstanding] the risks, research continues.",
      ],
      starter: "{Much as} I trust science, …",
    },
    {
      use: "Show your attitude to a source",
      pattern: "[allegedly / purportedly] · {claims / concedes / insists}",
      examples: [
        "The leak [allegedly] came from inside.",
        "The paper {concedes} it made errors.",
        "The images were [purportedly] taken in March.",
      ],
      starter: "The article {claims} … , but …",
    },
    {
      use: "Use understatement and tone",
      pattern: "[not exactly / a tad] = understatement · {ironic praise}",
      examples: [
        "The meeting was [not exactly] a success.",
        "Losing my luggage was [a tad] inconvenient.",
        "'{Brilliant},' she said, as it began to pour.",
      ],
      starter: "It was [not exactly] …",
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
      use: "Connect a long argument smoothly",
      pattern: "[the former / the latter / this] · {do so / one}",
      examples: [
        "Some work for money, others for meaning; [the latter] are happier.",
        "Many want to quit, but few {do so}.",
        "[This] is why purpose matters.",
      ],
      starter: "[The former] … whereas [the latter] …",
    },
    {
      use: "Build complex, precise sentences",
      pattern: "[It is … that] · {whereby / whose}",
      examples: [
        "[It is] local culture [that] suffers most.",
        "Global brands create a system {whereby} traditions fade.",
        "Cities {whose} identity is fading need protection.",
      ],
      starter: "[It is not] … [that] …, but …",
    },
    {
      use: "Choose exactly the right word and tone",
      pattern: "[formal] vs {informal} · precise vocabulary",
      examples: [
        "We must [endeavour] to understand one another.",
        "Life's {a rollercoaster}, isn't it?",
        "Happiness is less a destination than a practice.",
      ],
      starter: "To my mind, the human condition is …",
    },
  ],
};
