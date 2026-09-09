"use client";

import { ttsProvider, type SpeakHandle, type TtsSegment } from "./tts";

/**
 * Tiny global store for the persistent audio player. The player survives
 * client-side navigation because the layout mounts it once; a module-level
 * store keeps the currently playing episode across page changes without a
 * state library.
 */

export interface PlayerEpisode {
  id: number;
  title: string;
  dateKey: string;
  language: string;
  segments: TtsSegment[];
}

export interface PlayerState {
  episode: PlayerEpisode | null;
  segmentIndex: number;
  status: "idle" | "playing" | "paused";
  rate: number;
}

type Listener = (state: PlayerState) => void;

const RATE_KEY = "td-voice-rate";

let state: PlayerState = { episode: null, segmentIndex: 0, status: "idle", rate: 1 };
let handle: SpeakHandle | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getState(): PlayerState {
  return state;
}

function startFrom(index: number) {
  const episode = state.episode;
  if (!episode) return;
  handle?.stop();
  handle = ttsProvider.speak({
    segments: episode.segments.slice(index),
    rate: state.rate,
    onProgress: (i) => set({ segmentIndex: index + i }),
    onEnd: () => {
      // Distinguish a natural finish from an explicit stop/skip: only reset
      // when the episode is still the active one and we were playing.
      if (state.status === "playing") set({ status: "idle", segmentIndex: 0 });
    },
    onError: () => set({ status: "idle" }),
  });
  if (handle) set({ status: "playing", segmentIndex: index });
}

export function play(episode: PlayerEpisode) {
  const saved = typeof localStorage !== "undefined" ? Number(localStorage.getItem(RATE_KEY)) : 1;
  set({ episode, segmentIndex: 0, rate: [0.75, 1, 1.25, 1.5].includes(saved) ? saved : 1 });
  startFrom(0);
}

export function pause() {
  handle?.pause();
  set({ status: "paused" });
}

export function resume() {
  handle?.resume();
  set({ status: "playing" });
}

export function stop() {
  set({ status: "idle", segmentIndex: 0 }); // before stop() so onEnd sees idle
  handle?.stop();
  handle = null;
}

export function close() {
  stop();
  set({ episode: null });
}

/** Segment-level skip — the browser TTS equivalent of ±15 seconds. */
export function nextSegment() {
  if (!state.episode) return;
  const next = Math.min(state.segmentIndex + 1, state.episode.segments.length - 1);
  set({ status: "paused" });
  startFrom(next);
}

export function previousSegment() {
  if (!state.episode) return;
  const prev = Math.max(state.segmentIndex - 1, 0);
  set({ status: "paused" });
  startFrom(prev);
}

export function setRate(rate: number) {
  localStorage.setItem(RATE_KEY, String(rate));
  const index = state.segmentIndex;
  const wasPlaying = state.status === "playing";
  set({ rate });
  if (wasPlaying) startFrom(index); // restart current segment at the new speed
}
