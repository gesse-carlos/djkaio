# djkaio

Discord playlist bot with Spotify playlist metadata, YouTube audio resolution, and configurable crossfade support.

## Requirements

- Node.js 20+
- FFmpeg available on `PATH`
- A Discord application and bot token
- Spotify Web API client credentials

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `SPOTIFY_CLIENT_ID`, and `SPOTIFY_CLIENT_SECRET`.
3. Give the bot the `bot` and `applications.commands` scopes with Connect, Speak, and Use Voice Activity permissions.
4. Install and start:

```text
npm install
npm run dev
```

Set `DISCORD_GUILD_ID` while developing to register slash commands immediately in one guild. Omit it to register globally.

## Commands

- `/play playlist:<Spotify playlist URL>` queues every playable track in the playlist.
- `/skip`, `/pause`, `/resume`, `/stop`, and `/queue` control playback.

`CROSSFADE_SECONDS` defaults to 5 and accepts values from 0 through 30. A value of `0` disables overlap. Spotify supplies metadata only; audio is resolved from YouTube search results.

The PCM mixer is isolated in `src/audio/crossfade.ts`; playback resource wiring can use it when two prepared sources are available. Credentials and tokens are loaded only from `.env` and are never logged.
