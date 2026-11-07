import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { config } from './config.js';
import { commands, handleCommand } from './commands.js';
import { GuildPlayer } from './player.js';
import { SpotifyPlaylistResolver } from './spotify.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const resolver = new SpotifyPlaylistResolver(config.spotifyClientId, config.spotifyClientSecret);
const players = new Map<string, GuildPlayer>();

client.once(Events.ClientReady, async (ready) => {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);
  await rest.put(route, { body: commands });
  console.log(`Logged in as ${ready.user.tag}; crossfade=${config.crossfadeSeconds}s`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction, resolver, players, (channel) => {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });
      const player = new GuildPlayer(connection, config.crossfadeSeconds * 1000);
      players.set(channel.guild.id, player);
      return player;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected playback error.';
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: message, ephemeral: true });
    else await interaction.reply({ content: message, ephemeral: true });
  }
});

client.login(config.discordToken);
