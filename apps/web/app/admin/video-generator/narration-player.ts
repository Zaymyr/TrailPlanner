export type NarrationClip = {
  beatId: string;
  /** Narration text the audio was generated from; the clip is stale once the text changes. */
  text: string;
  audioBase64: string;
  durationMs: number;
};

export type NarrationCue = { beatId: string; startMs: number };

export type NarrationPlayer = {
  load: (clips: NarrationClip[]) => Promise<void>;
  /** Plays every cue from a timeline position, as the animation starts or seeks while playing. */
  play: (cues: NarrationCue[], fromMs: number) => void;
  stop: () => void;
  destroy: () => void;
};

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

/**
 * Web Audio scheduling: every clip starts at an exact offset of the shared timeline, so seeking or
 * restarting keeps the voice in sync with the camera. The same cues will drive the export mix.
 */
export const createNarrationPlayer = (): NarrationPlayer => {
  let context: AudioContext | null = null;
  const buffers = new Map<string, AudioBuffer>();
  let sources: AudioBufferSourceNode[] = [];
  let loadVersion = 0;

  const getContext = () => {
    context ??= new AudioContext();
    return context;
  };

  const stop = () => {
    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
    });
    sources = [];
  };

  return {
    load: async (clips) => {
      loadVersion += 1;
      const version = loadVersion;
      const decoded = await Promise.all(clips.map(async (clip) => {
        try {
          return [clip.beatId, await getContext().decodeAudioData(decodeBase64(clip.audioBase64))] as const;
        } catch {
          return null;
        }
      }));
      if (version !== loadVersion) return;
      buffers.clear();
      decoded.forEach((entry) => {
        if (entry) buffers.set(entry[0], entry[1]);
      });
    },
    play: (cues, fromMs) => {
      stop();
      if (buffers.size === 0) return;
      const audio = getContext();
      void audio.resume();
      const now = audio.currentTime + 0.05;
      cues.forEach((cue) => {
        const buffer = buffers.get(cue.beatId);
        if (!buffer) return;
        const offsetSeconds = (fromMs - cue.startMs) / 1_000;
        if (offsetSeconds >= buffer.duration) return;
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        if (offsetSeconds >= 0) source.start(now, offsetSeconds);
        else source.start(now - offsetSeconds);
        sources.push(source);
      });
    },
    stop,
    destroy: () => {
      stop();
      buffers.clear();
      void context?.close();
      context = null;
    },
  };
};
