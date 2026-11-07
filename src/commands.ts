import {
  ChatInputCommandInteraction, GuildMember, SlashCommandBuilder,
} from 'discord.js';
import type { SpotifyPlaylistResolver } from './spotify.js';
import type { GuildPlayer } from './player.js';

export const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Queue a Spotify playlist').addStringOption((option) =>
    option.setName('playlist').setDescription('Spotify playlist URL').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
].map((command) => command.toJSON());

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  resolver: SpotifyPlaylistResolver,
  players: Map<string, GuildPlayer>,
  createPlayer: (channel: NonNullable<GuildMember['voice']['channel']>) => GuildPlayer,
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;
  const existing = players.get(interaction.guildId);
  const name = interaction.commandName;
  if (name === 'play') {
    const member = interaction.member as GuildMember;
    const channel = member.voice.channel;
    if (!channel) { await interaction.reply('Join a voice channel first.'); return; }
    const player = existing ?? createPlayer(channel);
    const tracks = await resolver.resolvePlaylist(interaction.options.getString('playlist', true));
    player.add(tracks);
    await interaction.reply(`Queued ${tracks.length} track(s).`);
    return;
  }
  if (!existing) { await interaction.reply('Nothing is playing.'); return; }
  if (name === 'skip') existing.skip();
  if (name === 'pause') existing.pause();
  if (name === 'resume') existing.resume();
  if (name === 'stop') existing.stop();
  if (name === 'queue') await interaction.reply(existing.queue.slice(0, 10).map((track, i) => `${i + 1}. ${track.artist} - ${track.title}`).join('\n') || 'The queue is empty.');
  else if (name !== 'queue') await interaction.reply(`/${name} applied.`);
}
