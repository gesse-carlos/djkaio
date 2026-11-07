import { spawn } from 'node:child_process';
import play from 'play-dl';
import type { Track } from '../types.js';
import type { PcmSource } from './crossfade.js';

export async function resolveAudio(track: Track): Promise<PcmSource> {
  const results = await play.search(track.searchQuery, { limit: 1, source: { youtube: 'video' } });
  const video = results[0];
  if (!video?.url) throw new Error(`Could not find audio for "${track.title}" by ${track.artist}.`);
  const stream = await play.stream(video.url, { quality: 2, discordPlayerCompatibility: true });
  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
    '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
  ], { stdio: ['pipe', 'pipe', 'inherit'] });
  stream.stream.pipe(ffmpeg.stdin);
  return {
    stream: ffmpeg.stdout,
    durationMs: track.durationMs,
    close: () => { stream.stream.destroy(); ffmpeg.kill(); },
  };
}
