export type VersusIntroOptions = {
  onceKey?: string;
  sound?: boolean;
  volume?: number;
  autoPlay?: boolean;
};
export declare function mountVersusIntro(host: HTMLElement, options?: VersusIntroOptions): {
  play(options?: { force?: boolean }): boolean;
  destroy(): void;
};
export declare function scheduleVersusSound(context: AudioContext | OfflineAudioContext, volume?: number): () => void;
