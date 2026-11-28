/**
 * Media kit: turns slides into a video file (web only), e.g. for a school
 * website. The slides are drawn on a hidden canvas and recorded in real time
 * with the recordings' sound, so a video takes as long to make as to watch.
 */
import type { Slide } from '@/core/media/slideshow';

// ===========================================================================
// Settings
// ===========================================================================

/** How long a slide without a recording stays in the video. */
export const VIDEO_SLIDE_SECONDS = 8;
/** The opening card with the title. */
export const VIDEO_TITLE_SECONDS = 3;
/** After a recording ends, the slide stays this long. */
const VIDEO_AFTER_SOUND_SECONDS = 1.5;
const WIDTH = 1280;
const HEIGHT = 720;
const FRAMES_PER_SECOND = 30;

// ===========================================================================

const COLOURS = { page: '#0B1220', text: '#F3F6FB', soft: '#7FB4F5', bar: '#3D8BEF', track: '#22304D' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function canMakeVideo(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype
  );
}

/** The best video type this browser can record: MP4 where it can (plays everywhere), else WebM. */
function videoType(): { mime: string; ext: string } {
  const options = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? { mime: '', ext: 'webm' };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches a picture as a bitmap (so the canvas can still be recorded). */
async function loadPicture(uri: string): Promise<ImageBitmap | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

type Frame = { kicker: string; title: string; texts: string[]; picture: ImageBitmap | null; big?: boolean };

function draw(ctx: CanvasRenderingContext2D, f: Frame, progress: number) {
  ctx.fillStyle = COLOURS.page;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const pad = 56;
  let textX = pad;
  let textWidth = WIDTH - pad * 2;
  if (f.picture) {
    const boxW = WIDTH * 0.52;
    const boxH = HEIGHT - pad * 2 - 20;
    const scale = Math.min(boxW / f.picture.width, boxH / f.picture.height);
    const w = f.picture.width * scale;
    const h = f.picture.height * scale;
    ctx.drawImage(f.picture, pad + (boxW - w) / 2, pad + (boxH - h) / 2, w, h);
    textX = pad + boxW + 40;
    textWidth = WIDTH - textX - pad;
  }
  let y = f.big ? HEIGHT / 2 - 60 : pad + 30;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOURS.soft;
  ctx.font = `24px ${FONT}`;
  for (const line of wrap(ctx, f.kicker, textWidth)) {
    ctx.fillText(line, textX, y);
    y += 32;
  }
  y += 36;
  ctx.fillStyle = COLOURS.text;
  ctx.font = `800 ${f.big ? 64 : 48}px ${FONT}`;
  for (const line of wrap(ctx, f.title, textWidth)) {
    ctx.fillText(line, textX, y);
    y += f.big ? 74 : 58;
  }
  y += 10;
  ctx.font = `28px ${FONT}`;
  for (const t of f.texts) {
    for (const line of wrap(ctx, t, textWidth)) {
      if (y > HEIGHT - 50) break;
      ctx.fillText(line, textX, y);
      y += 40;
    }
    y += 14;
  }
  // A thin progress line, which also keeps frames coming.
  ctx.fillStyle = COLOURS.track;
  ctx.fillRect(0, HEIGHT - 6, WIDTH, 6);
  ctx.fillStyle = COLOURS.bar;
  ctx.fillRect(0, HEIGHT - 6, WIDTH * progress, 6);
}

/**
 * Makes the video. `title` and `subtitle` go on the opening card. Calls
 * `onProgress` (0 to 1) as it goes. Returns the file and its extension.
 */
export async function makeSlideVideo(args: {
  title: string;
  subtitle?: string;
  slides: Slide[];
  includeSound?: boolean;
  onProgress?: (share: number) => void;
}): Promise<{ blob: Blob; ext: string }> {
  const { title, subtitle = '', slides, includeSound = true, onProgress } = args;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser can't make videos. Try Chrome or Edge on a computer.");

  const pictures = await Promise.all(slides.map((s) => (s.imageUri ? loadPicture(s.imageUri) : Promise.resolve(null))));
  const audio = new AudioContext();
  const soundOut = audio.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(FRAMES_PER_SECOND).getVideoTracks(), ...soundOut.stream.getAudioTracks()]);
  const type = videoType();
  const recorder = new MediaRecorder(stream, type.mime ? { mimeType: type.mime, videoBitsPerSecond: 2_500_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

  let frame: Frame = { kicker: subtitle, title, texts: [], picture: null, big: true };
  let progress = 0;
  const painter = setInterval(() => draw(ctx, frame, progress), 1000 / FRAMES_PER_SECOND);
  draw(ctx, frame, 0);
  recorder.start(1000);
  try {
    await wait(VIDEO_TITLE_SECONDS * 1000);
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      progress = (i + 1) / slides.length;
      onProgress?.(i / slides.length);
      frame = { kicker: s.kicker ?? '', title: s.title, texts: s.texts, picture: pictures[i] };
      const sounds = includeSound ? (s.sounds ?? []) : [];
      if (sounds.length === 0) {
        await wait(VIDEO_SLIDE_SECONDS * 1000);
        continue;
      }
      await wait(1000);
      for (const sound of sounds) await playInto(audio, soundOut, sound.uri);
      await wait(VIDEO_AFTER_SOUND_SECONDS * 1000);
    }
  } finally {
    recorder.stop();
    await stopped;
    clearInterval(painter);
    audio.close().catch(() => {});
    pictures.forEach((p) => p?.close());
  }
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] || 'video/webm' }), ext: type.ext };
}

/** Plays one recording into the video's sound and waits until it ends. */
async function playInto(audio: AudioContext, out: MediaStreamAudioDestinationNode, uri: string): Promise<void> {
  try {
    const bytes = await (await fetch(uri)).arrayBuffer();
    const buffer = await audio.decodeAudioData(bytes);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(out);
    await new Promise<void>((r) => {
      source.onended = () => r();
      source.start();
    });
  } catch {
    // A recording that can't be read is left out; the slide still shows.
  }
}

/** Saves a file to the computer (web). */
export function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
