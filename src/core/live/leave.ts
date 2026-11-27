import { router } from 'expo-router';

import type { CoreSessionBackend } from '@/core/live/backend';
import type { LiveParticipant, LiveSession } from '@/core/live/session';

/** A student leaves: their row is removed and they go back to the session's join page (never a teacher page). */
export async function leaveSession(backend: CoreSessionBackend, me: LiveParticipant, session: LiveSession) {
  await backend.removeParticipant(me.id).catch(() => {});
  if (backend.demo) return;
  router.replace({ pathname: '/join/[code]', params: { code: session.code } });
}
