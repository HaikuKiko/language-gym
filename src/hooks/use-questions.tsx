import { usePathname } from 'expo-router';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { BUILT_IN_FUN_QUESTIONS, type CustomSet, type FunQuestion } from '@/data/fun-questions';
import { BUILT_IN_QUESTIONS, LEVELS, type Level, type Question } from '@/data/questions';
import { WEEK_QUESTIONS } from '@/data/week-questions';
import { BUILT_IN_WEEKS, type Week } from '@/data/weeks';
import { supabase } from '@/core/app/supabase';

/** Give up on the database after this long and use the built-in content. */
const LOAD_TIMEOUT_MS = 6000;
/**
 * Pages that use the questions or the weekly plan, so they wait until those are
 * loaded (every phone in a session must shuffle the same list). Every other page
 * (the join page, the landing page, …) shows straight away.
 */
const PAGES_THAT_WAIT = /^\/(host|session|demo|single|write)(\/|$)/;

type Content = {
  questions: readonly Question[];
  weeks: readonly Week[];
  /** Speed friending's questions. */
  funQuestions: readonly FunQuestion[];
  /** Speed friending's custom question sets. */
  customSets: readonly CustomSet[];
};

const ALL_BUILT_IN_QUESTIONS: readonly Question[] = [...BUILT_IN_QUESTIONS, ...WEEK_QUESTIONS];

const BUILT_IN: Content = {
  questions: ALL_BUILT_IN_QUESTIONS,
  weeks: BUILT_IN_WEEKS,
  funQuestions: BUILT_IN_FUN_QUESTIONS,
  customSets: [],
};

const ContentContext = createContext<Content>(BUILT_IN);

/** The questions the app is using: from the database, or the built-in list. */
export function useQuestions(): readonly Question[] {
  return use(ContentContext).questions;
}

/** The 16-week plan for every level: from the database, or the built-in draft. */
export function useWeeks(): readonly Week[] {
  return use(ContentContext).weeks;
}

/** Speed friending's questions: from the database, or the built-in list. */
export function useFunQuestions(): readonly FunQuestion[] {
  return use(ContentContext).funQuestions;
}

/** Speed friending's custom question sets (from the database; none built in). */
export function useCustomSets(): readonly CustomSet[] {
  return use(ContentContext).customSets;
}

const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

async function loadQuestions(): Promise<Question[] | null> {
  if (!supabase) return null;

  // A fixed order, so every phone shuffles the same list the same way.
  // Supabase returns at most 1,000 rows per request, so read in pages.
  const PAGE = 1000;
  const read = async (columns: string) => {
    const all: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase!
        .from('questions')
        .select(columns)
        .eq('active', true)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) return { data: null, error };
      all.push(...(data ?? []));
      if (!data || data.length < PAGE) return { data: all, error: null };
    }
  };

  let { data, error } = await read('level, topic, text, week');
  // A database set up before weeks were added has no "week" column.
  if (error) ({ data, error } = await read('level, topic, text'));
  if (error || !data) return null;

  const rows = data as unknown as Record<string, unknown>[];
  const questions = rows.flatMap((row): Question[] =>
    isLevel(row.level) && typeof row.text === 'string'
      ? [
          {
            level: row.level,
            text: row.text,
            topic: typeof row.topic === 'string' ? row.topic : '',
            week: typeof row.week === 'number' ? row.week : null,
          },
        ]
      : [],
  );
  return questions.length > 0 ? questions : null;
}

async function loadWeeks(): Promise<Week[] | null> {
  if (!supabase) return null;

  const read = (columns: string) => supabase!.from('weeks').select(columns);
  let { data, error } = await read(
    'level, week, topic, grammar, also, use, pattern, examples, starter',
  );
  // A database set up before grammar help was added has no help columns: use
  // the built-in help for the same level and week instead.
  const hasHelpColumns = !error;
  if (error) ({ data, error } = await read('level, week, topic, grammar'));
  if (error || !data) return null;

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const rows = data as unknown as Record<string, unknown>[];
  const weeks = rows.flatMap((row): Week[] => {
    if (!isLevel(row.level) || typeof row.week !== 'number' || typeof row.topic !== 'string') {
      return [];
    }
    const help = hasHelpColumns
      ? {
          use: text(row.use),
          pattern: text(row.pattern),
          examples: text(row.examples)
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          starter: text(row.starter),
        }
      : (BUILT_IN_WEEKS.find((w) => w.level === row.level && w.week === row.week)?.help ?? null);
    const empty =
      !help || (!help.use && !help.pattern && help.examples.length === 0 && !help.starter);
    return [
      {
        level: row.level,
        week: row.week,
        topic: row.topic,
        grammar: text(row.grammar),
        also: hasHelpColumns
          ? text(row.also)
          : (BUILT_IN_WEEKS.find((w) => w.level === row.level && w.week === row.week)?.also ?? ''),
        help: empty ? null : help,
      },
    ];
  });
  return weeks.length > 0 ? weeks : null;
}

/** A list of strings from a text[] column (anything else: empty). */
function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

/** Speed friending's questions from the friending_questions table (null if missing or empty). */
async function loadFunQuestions(): Promise<FunQuestion[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('friending_questions')
    .select('level, week, text, follow_ups')
    .eq('active', true)
    // A fixed order, so every phone shuffles the same list the same way.
    .order('id')
    .limit(1000);
  if (error || !data) return null;
  const rows = data as unknown as Record<string, unknown>[];
  const questions = rows.flatMap((row): FunQuestion[] =>
    isLevel(row.level) && typeof row.week === 'number' && typeof row.text === 'string'
      ? [{ level: row.level, week: row.week, text: row.text, followUps: textList(row.follow_ups) }]
      : [],
  );
  return questions.length > 0 ? questions : null;
}

/** The custom question sets with their questions, in a fixed order (so every phone agrees). */
async function loadCustomSets(): Promise<CustomSet[]> {
  if (!supabase) return [];
  const [{ data: sets }, { data: questions }] = await Promise.all([
    supabase.from('custom_question_sets').select('id, name, description').eq('active', true).order('created_at'),
    supabase.from('custom_questions').select('set_id, text, follow_ups').eq('active', true).order('id').limit(5000),
  ]);
  return (sets ?? [])
    .map((s) => {
      const own = (questions ?? []).filter((q) => q.set_id === s.id);
      return {
        id: String(s.id),
        name: String(s.name),
        description: String(s.description ?? ''),
        questions: own.map((q) => String(q.text)),
        followUps: own.map((q) => textList(q.follow_ups)),
      };
    })
    .filter((s) => s.questions.length > 0);
}

async function loadContent(): Promise<Content> {
  const [questions, weeks, funQuestions, customSets] = await Promise.all([
    loadQuestions().catch(() => null),
    loadWeeks().catch(() => null),
    loadFunQuestions().catch(() => null),
    loadCustomSets().catch(() => []),
  ]);
  return {
    questions: questions ?? ALL_BUILT_IN_QUESTIONS,
    weeks: weeks ?? BUILT_IN_WEEKS,
    funQuestions: funQuestions ?? BUILT_IN_FUN_QUESTIONS,
    customSets,
  };
}

/**
 * Loads the questions and the weekly plan once when the app opens and shares
 * them with every screen. The pages that use them (PAGES_THAT_WAIT) show
 * "Loading…" until they are ready, so a session never starts with one list and
 * then switches to another. Other pages show straight away.
 */
export function QuestionsProvider({ children, loading }: { children: ReactNode; loading: ReactNode }) {
  const pathname = usePathname();
  const [content, setContent] = useState<Content | null>(supabase ? null : BUILT_IN);

  useEffect(() => {
    if (!supabase) return;
    let settled = false;
    const settle = (loaded: Content) => {
      if (settled) return;
      settled = true;
      setContent(loaded);
    };

    const timeout = setTimeout(() => settle(BUILT_IN), LOAD_TIMEOUT_MS);
    loadContent().then(settle, () => settle(BUILT_IN));

    return () => {
      settled = true;
      clearTimeout(timeout);
    };
  }, []);

  const waiting = !content && PAGES_THAT_WAIT.test(pathname);
  return <ContentContext value={content ?? BUILT_IN}>{waiting ? loading : children}</ContentContext>;
}
