import 'dotenv/config';

const MAX_CROSSFADE_SECONDS = 30;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function crossfadeSeconds(): number {
  const raw = process.env.CROSSFADE_SECONDS ?? '5';
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > MAX_CROSSFADE_SECONDS) {
    throw new Error(
      `CROSSFADE_SECONDS must be a number from 0 to ${MAX_CROSSFADE_SECONDS}. Received: ${raw}`,
    );
  }
  return value;
}

export const config = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID?.trim(),
  spotifyClientId: required('SPOTIFY_CLIENT_ID'),
  spotifyClientSecret: required('SPOTIFY_CLIENT_SECRET'),
  crossfadeSeconds: crossfadeSeconds(),
};

export { MAX_CROSSFADE_SECONDS };
