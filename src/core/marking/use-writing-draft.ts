import { useState } from 'react';

import { useSavedState } from '@/core/app/use-saved-state';
import type { PreparedPhoto } from '@/core/media/photo';
import { errorMessage } from '@/core/app/supabase';
import { anchorsFrom, guessAnchorsFrom, markCorrections, type Correction } from '@/core/marking/marks';
import { readPhoto, type PhotoReading, type TextMarks } from '@/core/marking/photo-reading';

/**
 * The piece of writing on a writing screen (General English, IELTS, teacher
 * marking): the text, the last photo reading, the pink guessed words and
 * the orange mistakes from the last feedback. Shared so a fix here reaches
 * every screen. Everything is kept through a refresh (see useSavedState).
 */
export function useWritingDraft(
  /** Names the saved values, e.g. "write". */
  screen: string,
  options: {
    /** Teacher marking: photo readings count against the teacher's cap. */
    teacher?: boolean;
    /** Teachers: read photos line by line, as on the paper. */
    lineByLine?: boolean;
    /** Shows (or with null, clears) a message on the screen. */
    onError: (message: string | null) => void;
    /** Called whenever the text changes, e.g. to keep a draft. */
    onTextChange?: (text: string) => void;
    /** Called after every photo reading, e.g. for the teacher's usage notice. */
    onRead?: (reading: PhotoReading) => void;
  },
) {
  const [text, setSavedText] = useSavedState(`${screen}:text`, '');
  const [photo, setPhoto] = useSavedState<PhotoReading | null>(`${screen}:photo`, null);
  const [guesses, setGuesses] = useSavedState<TextMarks | null>(`${screen}:guesses`, null);
  const [marks, setMarks] = useSavedState<TextMarks | null>(`${screen}:marks`, null);
  const [reading, setReading] = useState(false);
  // The photos of the last pages read, e.g. to share the essay for
  // calibration. Kept in memory only: they are too big to keep through a refresh.
  const [pagePhotos, setPagePhotos] = useState<PreparedPhoto[]>([]);

  function setText(next: string) {
    setSavedText(next);
    options.onTextChange?.(next);
  }

  /** Reads photos of the pages into the box. True when it worked. */
  async function readPages(pages: PreparedPhoto[]): Promise<boolean> {
    options.onError(null);
    setReading(true);
    let ok = false;
    try {
      const read = await readPhoto(pages, { teacher: options.teacher, lineByLine: options.lineByLine });
      options.onRead?.(read);
      if (!read.containsWriting || !read.transcript.trim()) {
        options.onError(
          pages.length > 1
            ? 'We could not find any writing in those photos. Please try other ones.'
            : 'We could not find any writing in that photo. Please try another one.',
        );
      } else {
        setText(read.transcript);
        setPhoto(read);
        setPagePhotos(pages);
        setGuesses({ anchors: guessAnchorsFrom(read.transcript, read.guessedWords), length: read.transcript.length });
        // Underlines from earlier feedback belong to the old text.
        setMarks(null);
        ok = true;
      }
    } catch (e) {
      options.onError(errorMessage(e));
    }
    setReading(false);
    return ok;
  }

  /** Underlines the mistakes from new feedback in the text. */
  function showMistakes(corrections: Correction[]) {
    setMarks({ anchors: anchorsFrom(markCorrections(text, corrections)), length: text.length });
  }

  /** Starts again with an empty box. */
  function clear() {
    setText('');
    setPhoto(null);
    setGuesses(null);
    setMarks(null);
    setPagePhotos([]);
  }

  return {
    text,
    setText,
    photo,
    pagePhotos,
    guesses,
    marks,
    setMarks,
    reading,
    readPages,
    showMistakes,
    clear,
    onError: options.onError,
  };
}

export type WritingDraft = ReturnType<typeof useWritingDraft>;
