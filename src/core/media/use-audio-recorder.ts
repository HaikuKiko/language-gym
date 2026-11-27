import { useEffect, useRef, useState } from 'react';

/**
 * Media kit: recording sound with the phone's microphone (in the browser, with
 * MediaRecorder; works in current Chrome, Safari and Firefox). Stops by itself
 * after `maxSeconds`.
 */

export type Recording = { blob: Blob; uri: string; contentType: string; seconds: number };

export type RecorderState = 'idle' | 'asking' | 'recording' | 'unsupported';

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

export function canRecordAudio(): boolean {
  return typeof globalThis.MediaRecorder !== 'undefined' && Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

export function useAudioRecorder(maxSeconds: number) {
  const [state, setState] = useState<RecorderState>(() => (canRecordAudio() ? 'idle' : 'unsupported'));
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const done = useRef<((r: Recording | null) => void) | null>(null);

  // Never leave the microphone on when the screen goes away.
  useEffect(() => () => stopTracks(), []);

  function stopTracks() {
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }

  /** Starts recording; the promise gives the recording once it stops (null if it failed). */
  async function start(): Promise<Recording | null> {
    if (!canRecordAudio()) {
      setState('unsupported');
      return null;
    }
    setProblem(null);
    setState('asking');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('idle');
      setProblem('Allow the microphone in your browser settings to record.');
      return null;
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.current = rec;
    const chunks: Blob[] = [];
    const began = Date.now();
    setSeconds(0);
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setSeconds(s);
      if (s >= maxSeconds && rec.state === 'recording') rec.stop();
    }, 250);
    return new Promise((resolve) => {
      done.current = resolve;
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        clearInterval(tick);
        stopTracks();
        setState('idle');
        const contentType = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: contentType });
        resolve(
          blob.size > 0
            ? { blob, uri: URL.createObjectURL(blob), contentType, seconds: Math.round((Date.now() - began) / 1000) }
            : null,
        );
      };
      rec.start();
      setState('recording');
    });
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  return { state, seconds, problem, start, stop };
}
