import { useCallback, useEffect, useState } from 'react';

import type { LiveSession } from '@/core/live/session';
import { useSessionBackend } from '@/lib/session-backend';
import { TEAM_NAME_REFRESH_MS, teamNames } from '@/lib/word-game';

/**
 * Word games: the teams' names ("round:group" → name), checked every few
 * seconds while the game is on. `reload` shows a name just saved straight away.
 */
export function useTeamNames(session: LiveSession) {
  const backend = useSessionBackend();
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    const events = await backend.fetchEvents(session.id).catch(() => null);
    if (events) setNames(teamNames(events));
  }, [backend, session.id]);

  useEffect(() => {
    reload();
    if (session.status !== 'playing') return;
    const timer = setInterval(reload, TEAM_NAME_REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload, session.status]);

  return { names, reload };
}
