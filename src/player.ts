import {
  AudioPlayerStatus, AudioPlayer, AudioResource,
  StreamType,
  NoSubscriberBehavior, VoiceConnection, createAudioPlayer, createAudioResource,
} from '@discordjs/voice';
import { Readable } from 'node:stream';
import { crossfade, type PcmSource } from './audio/crossfade.js';
import { resolveAudio } from './audio/source.js';
import type { Track } from './types.js';

export class GuildPlayer {
  readonly queue: Track[] = [];
  readonly audio: AudioPlayer;
  private current?: Track;
  private stopped = false;
  private transition?: Promise<void>;

  constructor(private readonly connection: VoiceConnection, private readonly crossfadeMs: number) {
    this.audio = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    connection.subscribe(this.audio);
    this.audio.on(AudioPlayerStatus.Idle, () => { void this.advance(); });
    this.audio.on('error', (error) => console.error('Audio playback error:', error.message));
  }

  add(tracks: Track[]): void {
    this.queue.push(...tracks);
    if (this.audio.state.status === AudioPlayerStatus.Idle) void this.advance();
  }

  pause(): void { this.audio.pause(true); }
  resume(): void { this.audio.unpause(); }
  stop(): void { this.stopped = true; this.queue.length = 0; this.audio.stop(true); }
  skip(): void { this.audio.stop(true); }
  disconnect(): void { this.stop(); this.connection.destroy(); }
  get nowPlaying(): Track | undefined { return this.current; }

  private async advance(): Promise<void> {
    if (this.transition || this.stopped || this.queue.length === 0) return;
    this.transition = this.playNext().finally(() => { this.transition = undefined; });
    await this.transition;
  }

  private async playNext(): Promise<void> {
    const current = this.queue.shift();
    if (!current) return;
    this.current = current;
    let currentSource: PcmSource | undefined;
    try {
      currentSource = await resolveAudio(current);
      const next = this.queue[0];
      if (!next || this.crossfadeMs <= 0) {
        this.audio.play(createAudioResource(currentSource.stream, { inputType: StreamType.Raw }));
        return;
      }

      const nextSource = await resolveAudio(next);
      this.queue.shift();
      this.audio.play(this.createCrossfadeResource(
        currentSource.stream,
        nextSource.stream,
        current.durationMs,
        next.durationMs,
      ));
    } catch (error) {
      console.error(`Unable to load the next audio source:`, error instanceof Error ? error.message : error);
      if (currentSource) {
        this.audio.play(createAudioResource(currentSource.stream, { inputType: StreamType.Raw }));
      } else {
        void this.advance();
      }
    }
  }

  // Kept as the integration point for the PCM mixer once the active resource
  // is switched from a single stream to crossfade(source, nextSource).
  protected createCrossfadeResource(current: Readable, next: Readable, currentDurationMs: number, nextDurationMs: number): AudioResource<null> {
    const mixed = crossfade(
      { stream: current, durationMs: currentDurationMs },
      { stream: next, durationMs: nextDurationMs },
      this.crossfadeMs,
    );
    return createAudioResource(Readable.from(mixed), { inputType: StreamType.Raw });
  }
}
