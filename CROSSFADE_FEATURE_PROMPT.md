# Feature Prompt: Discord Playlist Bot with Spotify-Style Crossfade

## Title

Create the Discord playlist bot first, then add configurable crossfade transitions between songs played from Spotify playlists.

## Description

The primary deliverable is a functional Discord music bot that can join a voice channel, accept a Spotify playlist URL, resolve the playlist tracks, queue them in playlist order, resolve playable audio sources, and provide normal playback controls. Crossfade is a feature built on that bot foundation: when the current track approaches its end, the next track must begin at a reduced volume while the current track fades out. The two tracks should overlap for the configured crossfade duration, producing a smooth transition instead of silence or an abrupt stop.

The bot must support the baseline playback path before crossfade is enabled. Crossfade must be optional, and disabling it must preserve ordinary non-overlapping playback.

## Primary Bot Scope

The initial bot implementation must include:

- Discord bot startup and environment-based configuration for tokens and provider credentials.
- Slash-command registration and user-facing help through Discord command descriptions.
- Voice-channel join and leave behavior with appropriate Discord permissions.
- Spotify playlist URL validation, metadata retrieval, pagination, and track ordering.
- A per-guild queue and current-track state.
- Audio-source resolution for Spotify tracks without exposing credentials in logs or messages.
- Basic playback controls: play/queue, skip, pause, resume, stop, and queue inspection.
- Explicit error reporting when a playlist, track, or audio source cannot be loaded.
- Cleanup of audio resources and voice connections on stop, disconnect, and playback failure.

Spotify is the metadata and playlist-order provider; it does not itself supply the Discord audio stream. The implementation may use a separate audio-source resolver, such as YouTube search, while keeping that provider-specific logic separate from Spotify metadata handling and Discord voice output.

## Crossfade Scope

After the baseline bot playback path is working, add the crossfade behavior described below. Crossfade must operate in the audio playback/mixing layer rather than by modifying the Spotify playlist or its metadata.

The feature must work when the bot advances automatically through a playlist and must preserve normal playback behavior when crossfade is disabled. Crossfade processing should be performed by the audio playback/mixing layer rather than by changing the Spotify playlist itself. Spotify track metadata and playlist order should remain unchanged.

The implementation should:

- Add a configurable crossfade duration, with a safe default and a clearly documented maximum.
- Start preparing or resolving the next track early enough that network or source-loading latency does not create a gap.
- Apply complementary volume curves: the outgoing track fades down while the incoming track fades up.
- Ensure that the incoming track does not begin before the configured transition point.
- Handle short tracks safely by limiting the transition to the available audio duration.
- Keep queue order, skip, pause, resume, stop, disconnect, and repeat/shuffle behavior consistent with the existing bot.
- Prevent multiple transition workers from mixing the same tracks or advancing the queue more than once.
- Make failures explicit: if the next track cannot be loaded, finish the current track and report the existing playback error instead of silently dropping the track.
- Keep secrets, Spotify credentials, and Discord tokens out of logs and test fixtures.

If the current playback stack cannot mix two streams directly, introduce the smallest suitable audio-mixing/processing abstraction and keep provider-specific Spotify logic separate from Discord voice-channel output. The bot must remain usable with crossfade disabled if the audio stack cannot support mixing yet.

## Acceptance Criteria

### Baseline Discord Bot

- [ ] The bot starts from documented environment configuration and fails clearly when required credentials or configuration values are missing or invalid.
- [ ] The bot registers documented slash commands and responds with actionable user-facing errors.
- [ ] `/play` accepts a validated Spotify playlist URL, retrieves all available playlist pages, preserves playlist order, and queues the resolved tracks for the requesting guild.
- [ ] The bot joins the requester's voice channel when playback begins and leaves/releases its connection and audio resources on stop, disconnect, or unrecoverable playback failure.
- [ ] The bot resolves playable audio independently from Spotify metadata and starts ordinary non-overlapping playback before crossfade is enabled.
- [ ] `/skip`, `/pause`, `/resume`, `/stop`, and `/queue` work against the guild's current player and queue without affecting other guilds.
- [ ] Playlist, track, audio-source, and voice-connection failures are reported through the bot's existing user-facing error path; credentials and access tokens never appear in messages or logs.

### Crossfade Playback

- [ ] A configured crossfade duration is validated at startup or configuration load time; negative, non-numeric, and above-maximum values are rejected with a clear error.
- [ ] Crossfade is optional; when disabled, the baseline bot retains non-overlapping playback behavior.
- [ ] With crossfade enabled, the next queued track begins before the current track ends, and the overlap lasts for the configured duration within the audio system's measurable tolerance.
- [ ] During a transition, the outgoing track's volume decreases monotonically and the incoming track's volume increases monotonically.
- [ ] The transition does not produce an audible or measurable silent gap when both tracks are available.
- [ ] A track that is shorter than the configured crossfade duration uses a bounded overlap and does not cause negative timing, crashes, or queue corruption.
- [ ] The next track is loaded/prepared before the transition starts, and a loading failure is surfaced through the bot's existing error-reporting path.
- [ ] Tracks are advanced exactly once; the same track is not played twice and no queued track is skipped because of the transition.
- [ ] `skip` immediately ends the current transition and advances according to existing skip semantics.
- [ ] `pause` and `resume` preserve the current transition state without resetting the queue or restarting tracks unexpectedly.
- [ ] `stop` and voice-channel disconnect cancel active transition work and release both audio streams/resources.
- [ ] Crossfade can be disabled. With it disabled, playback retains the previous non-overlapping behavior.
- [ ] Existing playlist ordering, repeat mode, shuffle mode, Spotify metadata handling, and Discord permissions remain unchanged.
- [ ] The configured duration and user-facing behavior are documented in the project configuration or help output.
- [ ] Automated tests cover normal transitions, configuration validation, short tracks, loading failures, and playback-control commands.

## Test Plan

### Unit Tests

Add unit tests for the crossfade/mixer and configuration components:

1. A valid duration is accepted and the default is applied when no value is configured.
2. Negative, non-numeric, zero-if-zero-is-not-supported, and above-maximum durations are rejected with actionable messages.
3. A normal pair of tracks produces the expected overlap duration.
4. The outgoing gain decreases monotonically from its normal level to silence, while the incoming gain increases monotonically from silence to its normal level.
5. A track shorter than the configured duration is clamped safely and never produces negative offsets or invalid gain values.
6. Crossfade-disabled mode never opens or mixes the next stream early.
7. A failed next-track load leaves the current track and queue in a valid state and emits the expected error.
8. Repeated transition callbacks/events are idempotent and cannot advance the queue twice.
9. Cancellation releases the outgoing and incoming stream resources.

### Integration Tests

Use mocked Spotify responses/audio sources and a fake Discord voice connection:

1. Queue at least three tracks and verify that each track is requested and played in playlist order.
2. Verify that the second track is requested before the first track finishes and that the mixer receives both streams during the configured overlap.
3. Verify that a failed request for the next track reports an error and does not prevent later queue behavior from following the existing policy.
4. Exercise `skip`, `pause`, `resume`, `stop`, repeat, and shuffle while a crossfade is active; verify no duplicate advancement, leaked stream, or stale transition remains.
5. Run the same playback scenario with crossfade disabled and compare it with the existing non-overlapping behavior.

### Audio/Timing Verification

When the project has an audio fixture or deterministic PCM test utility:

1. Render two fixture tracks through the mixer.
2. Measure that both tracks contain non-silent samples during the overlap window.
3. Confirm that the outgoing amplitude trends downward and the incoming amplitude trends upward.
4. Confirm that the rendered output contains no unintended silence between the tracks.

If deterministic audio rendering is not available, use mocked clock/timer tests for exact scheduling and document a manual verification procedure using two clearly identifiable test tracks.

### Manual Discord Verification

In a test Discord voice channel with test Spotify credentials:

1. Configure a short crossfade duration, queue several tracks, and confirm the audible transition.
2. Confirm that the bot announces or logs the correct currently playing track during the overlap.
3. Test skip, pause/resume, stop, disconnect, and reconnect during a transition.
4. Repeat the test with crossfade disabled and confirm the previous playback behavior.
5. Verify that credentials and access tokens do not appear in bot messages or logs.

## Implementation Notes for the Coding Agent

Implement in two layers: first establish the runnable Discord bot, playlist resolver, queue, audio player, voice connection lifecycle, commands, configuration, logging, and baseline tests; then add crossfade to the audio playback/mixing layer. Inspect the existing queue, track resolver, audio player, voice connection, configuration, command handlers, logging, and test structure before changing code. Reuse existing abstractions and error-reporting conventions. Keep Spotify metadata logic separate from audio mixing and Discord output, add or update configuration and command documentation, and run the project's formatter, type checker, linter, and targeted test suite after implementation.
