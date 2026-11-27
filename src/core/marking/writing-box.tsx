import type { ReactNode } from 'react';

import { MarkedTextInput } from '@/core/marking/marked-text-input';
import { PhotoNote } from '@/core/marking/photo-note';
import { PhotoPages } from '@/core/marking/photo-pages';
import { ThemedText } from '@/core/ui/themed-text';
import type { WritingDraft } from '@/core/marking/use-writing-draft';

/**
 * The writing part of every writing screen: add photos of the pages, check
 * the photo reading, and write or edit in the box (pink = guessed from a
 * photo, orange = mistakes from the last feedback). One copy for General
 * English, IELTS and teacher marking.
 */
export function WritingBox({
  draft,
  disabled,
  placeholder,
  label,
  children,
}: {
  draft: WritingDraft;
  /** No new photos while something else is busy. */
  disabled?: boolean;
  placeholder: string;
  /** Read out by screen readers, e.g. "Your essay". */
  label: string;
  /** Shown under the box, e.g. a word count. */
  children?: ReactNode;
}) {
  return (
    <>
      <PhotoPages disabled={disabled} reading={draft.reading} onRead={draft.readPages} onError={draft.onError} />
      {draft.photo && <PhotoNote photo={draft.photo} />}
      <MarkedTextInput
        value={draft.text}
        onChangeText={draft.setText}
        placeholder={placeholder}
        accessibilityLabel={label}
        anchors={draft.marks?.anchors ?? []}
        originalLength={draft.marks?.length ?? draft.text.length}
        guesses={draft.guesses}
      />
      {children}
      {draft.marks && draft.marks.anchors.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Orange lines show the mistakes from your last feedback. They go away when you change those words.
        </ThemedText>
      )}
    </>
  );
}
