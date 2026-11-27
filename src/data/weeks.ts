/**
 * The syllabus: each level is divided into 16 weeks. The weekly themes are
 * the same at every level (from the school's scheme of work); each level has
 * its own grammar per week. The A1 grammar follows the school's A1 scheme of
 * work; the other levels are drafts in the same spirit.
 *
 * It normally comes from the `weeks` table in Supabase (see
 * supabase/schema.sql), where it can be edited. This file is the fallback,
 * used when the database is not set up or cannot be reached.
 */
import { DRAFT_GRAMMAR_HELP, type GrammarHelp } from '@/data/grammar-help';
import { LEVELS, type Level } from '@/core/content/levels';

export const WEEKS_PER_LEVEL = 16;

export type Week = {
  level: Level;
  /** 1 to 16. */
  week: number;
  topic: string;
  /** The main grammar point, shown on the grammar card. */
  grammar: string;
  /** Other language points that week, e.g. "Articles · weather"; may be empty. */
  also: string;
  /** Examples and a pattern for the grammar point; null when there are none. */
  help: GrammarHelp | null;
};

/** The school's 16 weekly themes, the same at every level. */
export const WEEKLY_THEMES = [
  "People & Places",
  "You, Yours & Opinions",
  "Everyday Life & Experiences",
  "Loves, Hates & Feelings",
  "Travel & Nature",
  "Eating & Drinking",
  "Extraordinary People",
  "Fact or Fiction & Homes",
  "Buying & Selling",
  "Love & Relationships",
  "Street Life & Technology",
  "The World Around Us",
  "Weekends Away & Free Time",
  "Learning & Studying",
  "Keeping in Touch & Plans",
  "Going Places",
];

/** Each level's main grammar point per week, and the other points that week. */
const DRAFT_GRAMMAR: Record<Level, [grammar: string, also: string][]> = {
  A1: [
    ["be: am / is / are", "Nationalities · too much / too many · superlatives"],
    ["this / that / these / those", "have got · possessive ’s · will / won’t for promises · verb patterns with adjectives"],
    ["Present simple: I / you / we / they", "Present perfect for experiences · telling the time · me too / me neither"],
    ["Present simple: he / she / it", "Adverbs of frequency · should / shouldn’t · present perfect for results"],
    ["can / can’t", "Articles · might / going to · present and past simple passive"],
    ["there is / there are", "Countable and uncountable nouns · some / any / a lot of / much / many"],
    ["Past simple: was / were", "Past simple regular and irregular verbs · auxiliary verbs · have to / don’t have to"],
    ["Past simple: negatives and questions", "Prepositions of place · possessive pronouns · can / can’t"],
    ["Comparative adjectives", "Superlative adjectives · this / that / these / those · present continuous"],
    ["Past continuous", "will / won’t for promises · quite / very / really · have got · present perfect for how long"],
    ["Present continuous", "Present simple or continuous · be thinking of + -ing · adverbs of manner"],
    ["Question words", "Quantifiers · be · there is / there are · present simple questions and negatives"],
    ["going to", "would like to / want to · like / love + -ing · adverbs of frequency"],
    ["have to / don’t have to", "might and will · very / really / quite / a little · comparatives"],
    ["Present perfect", "be going to · making suggestions · would like to"],
    ["Prepositions of movement", "Comparatives and superlatives · have got · take and get · past simple"],
  ],
  A2: [
    ["Question forms", "Present simple and continuous"],
    ["Possessive pronouns and whose", "Giving opinions: I think / I don't think"],
    ["Present perfect with ever / never", "Past simple for finished time"],
    ["Verb + -ing or to + infinitive", "like / love / hate · feelings adjectives"],
    ["will / won't for predictions", "Weather vocabulary"],
    ["much / many / a few / a little", "Countable and uncountable nouns · a lot of"],
    ["Past simple and past continuous", "Irregular verbs · when / while"],
    ["used to", "Describing homes · there was / there were"],
    ["Comparatives and superlatives", "Shopping language · too / enough"],
    ["Present perfect with for / since", "Relationships vocabulary"],
    ["Present perfect with just / already / yet", "Technology vocabulary"],
    ["Present simple passive", "Articles · geography vocabulary"],
    ["going to and present continuous for plans", "Free-time activities · suggestions"],
    ["must / have to / should", "School and study vocabulary"],
    ["will for offers, promises and decisions", "Making plans · keeping in touch"],
    ["First conditional", "Travel vocabulary · directions"],
  ],
  B1: [
    ["Present simple and continuous, state verbs", "Question forms"],
    ["So do I / Neither do I", "Giving and asking for opinions"],
    ["Present perfect and past simple", "Time expressions: ever, never, ago, last"],
    ["Gerunds and infinitives", "Adjectives for feelings"],
    ["Narrative tenses", "Travel and nature vocabulary"],
    ["Passive: present and past", "Food and cooking vocabulary"],
    ["Present perfect continuous", "for / since · describing people"],
    ["Modals of deduction: must / might / can't", "Story and home vocabulary"],
    ["as … as · much / far + comparative", "Shopping and money vocabulary"],
    ["Reported speech: statements", "Relationships vocabulary"],
    ["Defining relative clauses", "Technology vocabulary"],
    ["Zero and first conditionals", "Environment vocabulary"],
    ["Future forms", "Free-time and holiday vocabulary"],
    ["Modals of obligation and advice", "Education vocabulary"],
    ["used to / would", "Ways of keeping in touch"],
    ["Second conditional", "Travel and transport vocabulary"],
  ],
  B2: [
    ["Present habits: tend to, will, keep + -ing", "Describing people and places"],
    ["Contrast and concession", "Opinion language"],
    ["Present perfect simple and continuous", "Experiences and routines"],
    ["Verbs that change meaning: -ing or to", "Feelings and emotions"],
    ["Narrative tenses including past perfect continuous", "Travel and nature vocabulary"],
    ["Passive in all tenses, have something done", "Food and restaurants"],
    ["Third conditional", "Achievements and life events"],
    ["Past modals of deduction", "Mysteries and homes"],
    ["Non-defining and reduced relative clauses", "Consumer vocabulary"],
    ["Past modals: should have / could have", "Relationship problems"],
    ["Future continuous and future perfect", "Technology and city life"],
    ["wish / if only", "Environment vocabulary"],
    ["used to / be used to / get used to", "Holidays and free time"],
    ["Mixed conditionals", "Education and careers"],
    ["Reported speech and reporting verbs", "Communication vocabulary"],
    ["Indirect questions and question tags", "Travel situations"],
  ],
  C1: [
    ["Aspect: perfect and continuous forms", "Identity and place vocabulary"],
    ["Hedging and distancing", "Expressing opinions"],
    ["Participle clauses", "Everyday life and experiences"],
    ["Emphasis: do / did, intensifiers", "Feelings vocabulary"],
    ["Relative clauses with prepositions and quantifiers", "Travel and nature"],
    ["Passive reporting: is said to", "Food trends"],
    ["Inversion after negative adverbials", "Achievements and character"],
    ["Modals of speculation, present and past", "Mysteries and stories"],
    ["Nominalisation", "Business and consumer vocabulary"],
    ["Unreal past: wish, it's time, would rather", "Relationships"],
    ["Formal discourse markers", "Technology and society"],
    ["Cleft sentences", "Global issues"],
    ["Ellipsis and substitution", "Leisure activities"],
    ["Perfect and passive gerunds and infinitives", "Learning and achievement"],
    ["Future forms: be about to, be due to, be bound to", "Plans and communication"],
    ["Mixed and inverted conditionals", "Travel and journeys"],
  ],
  C2: [
    ["Fronting and marked word order", "Identity and belonging"],
    ["Epistemic modality and hedging", "Truth and opinion"],
    ["Nuanced tense and aspect", "Daily life and change"],
    ["Metaphor, idiom and connotation", "Emotions and attitudes"],
    ["Participle and verbless clauses", "Landscapes and nature"],
    ["Dense noun phrases", "Food culture and industry"],
    ["Future in the past, perfect infinitives", "Biography and legacy"],
    ["Reporting with stance", "News, rumour and the home"],
    ["Rhetorical devices for persuasion", "Advertising and sales"],
    ["Understatement and register", "Relationships and tone"],
    ["Advanced conditionals: but for, supposing", "Technology and urban life"],
    ["Subjunctive and mandative structures", "Global responsibility"],
    ["Ellipsis, substitution and cohesion", "Leisure and lifestyle"],
    ["Concession: albeit, much as", "Learning and knowledge"],
    ["Complex relative and cleft structures", "Communication and plans"],
    ["Style, register and precision", "Journeys and travel writing"],
  ],
};

export const BUILT_IN_WEEKS: Week[] = LEVELS.flatMap((level) =>
  DRAFT_GRAMMAR[level].map(([grammar, also], index) => ({
    level,
    week: index + 1,
    topic: WEEKLY_THEMES[index],
    grammar,
    also,
    help: DRAFT_GRAMMAR_HELP[level][index] ?? null,
  })),
);

export function findWeek(
  weeks: readonly Week[],
  level: Level,
  week: number | null | undefined,
): Week | null {
  if (week == null) return null;
  return weeks.find((w) => w.level === level && w.week === week) ?? null;
}
