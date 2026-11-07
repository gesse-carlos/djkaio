import { Readable } from 'node:stream';

export type PcmSource = {
  stream: Readable;
  durationMs: number;
  close?: () => void;
};

export function gainAt(positionMs: number, durationMs: number, overlapMs: number, incoming: boolean): number {
  if (overlapMs <= 0 || durationMs <= overlapMs) return incoming ? 1 : 0;
  const transitionStart = durationMs - overlapMs;
  if (positionMs < transitionStart) return incoming ? 0 : 1;
  const progress = Math.min(1, Math.max(0, (positionMs - transitionStart) / overlapMs));
  return incoming ? progress : 1 - progress;
}

/**
 * Mixes signed 16-bit little-endian stereo PCM. The first stream is read until
 * its transition point, then both streams are mixed for the bounded overlap.
 */
export async function* crossfade(
  outgoing: PcmSource,
  incoming: PcmSource,
  configuredOverlapMs: number,
  sampleRate = 48_000,
  channels = 2,
): AsyncGenerator<Buffer> {
  const overlapMs = Math.max(0, Math.min(configuredOverlapMs, outgoing.durationMs, incoming.durationMs));
  const bytesPerFrame = channels * 2;
  const overlapFrames = Math.floor((overlapMs / 1000) * sampleRate);
  const outgoingFrames = Math.max(0, Math.floor((outgoing.durationMs / 1000) * sampleRate));
  const transitionFrame = Math.max(0, outgoingFrames - overlapFrames);
  let frame = 0;
  let left: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let right: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  const readFrame = async (source: PcmSource, buffer: Buffer<ArrayBufferLike>): Promise<{ frame: Buffer<ArrayBufferLike> | null; rest: Buffer<ArrayBufferLike> }> => {
    while (buffer.length < bytesPerFrame) {
      const chunk = source.stream.read();
      if (chunk) buffer = Buffer.concat([buffer, chunk as Buffer]);
      else if (source.stream.readableEnded) break;
      else await new Promise<void>((resolve) => source.stream.once('readable', resolve));
    }
    if (buffer.length < bytesPerFrame) return { frame: null, rest: buffer };
    return { frame: buffer.subarray(0, bytesPerFrame), rest: buffer.subarray(bytesPerFrame) };
  };

  try {
    while (frame < transitionFrame) {
      const result = await readFrame(outgoing, left);
      left = result.rest;
      if (!result.frame) return;
      yield result.frame;
      frame++;
    }
    for (let i = 0; i < overlapFrames; i++, frame++) {
      const out = await readFrame(outgoing, left);
      left = out.rest;
      const inc = await readFrame(incoming, right);
      right = inc.rest;
      if (!out.frame || !inc.frame) break;
      const outGain = gainAt(frame * 1000 / sampleRate, outgoing.durationMs, overlapMs, false);
      const inGain = gainAt(i * 1000 / sampleRate, overlapMs, overlapMs, true);
      const mixed = Buffer.alloc(bytesPerFrame);
      for (let offset = 0; offset < bytesPerFrame; offset += 2) {
        const sample = Math.round(out.frame.readInt16LE(offset) * outGain + inc.frame.readInt16LE(offset) * inGain);
        mixed.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), offset);
      }
      yield mixed;
    }
    for await (const chunk of incoming.stream) yield chunk as Buffer;
  } finally {
    outgoing.close?.();
    incoming.close?.();
  }
}
