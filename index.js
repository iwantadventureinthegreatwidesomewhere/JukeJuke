const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");
const ytSearch = require("yt-search");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const musicPlaylist = [];
let currentPlayer = null;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "join") {
    const channel = interaction.member.voice.channel;
    if (channel) {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
      await interaction.reply("Poof! A wild *JukeJuke* has appeared! 🌟");
    } else {
      await interaction.reply({
        content: "You are not connected to a voice channel.",
        ephemeral: true,
      });
    }
  }

  if (commandName === "leave") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      await interaction.reply("*JukeJuke* left the voice channel.");
    } else {
      await interaction.reply({
        content: "*JukeJuke* is not in a voice channel.",
        ephemeral: true,
      });
    }
  }

  if (commandName === "play") {
    const song = interaction.options.getString("song");
    const channel = interaction.member.voice.channel;

    if (!channel) {
      return await interaction.reply({
        content: "You are not connected to a voice channel.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    let connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
    }

    if (
      currentPlayer &&
      currentPlayer.state.status === AudioPlayerStatus.Playing
    ) {
      const songInfo = await getSongInfo(song);
      musicPlaylist.push(songInfo);
      await interaction.followUp(
        `*JukeJuke* added **${songInfo.title}** to the playlist.`
      );
    } else {
      playMusic(song, interaction, connection, true);
    }
  }

  if (commandName === "pause") {
    if (
      currentPlayer &&
      currentPlayer.state.status === AudioPlayerStatus.Playing
    ) {
      currentPlayer.pause();
      await interaction.reply("*JukeJuke* paused the song.");
    } else {
      await interaction.reply({
        content: "No song is currently playing.",
        ephemeral: true,
      });
    }
  }

  if (commandName === "resume") {
    if (
      currentPlayer &&
      currentPlayer.state.status === AudioPlayerStatus.Paused
    ) {
      currentPlayer.unpause();
      await interaction.reply("*JukeJuke* resumed the song.");
    } else {
      await interaction.reply({
        content: "The song is not paused.",
        ephemeral: true,
      });
    }
  }

  if (commandName === "stop") {
    if (
      currentPlayer &&
      currentPlayer.state.status === AudioPlayerStatus.Playing
    ) {
      musicPlaylist.length = 0;
      currentPlayer.stop();
      await interaction.reply(
        "*JukeJuke* stopped the music and cleared the playlist."
      );
    } else {
      await interaction.reply({
        content: "No song is currently playing.",
        ephemeral: true,
      });
    }
  }

  if (commandName === "skip") {
    if (
      currentPlayer &&
      currentPlayer.state.status === AudioPlayerStatus.Playing
    ) {
      currentPlayer.stop();
      await interaction.reply("*JukeJuke* skipped to the next song.");
    } else {
      await interaction.reply({
        content: "No song is currently playing.",
        ephemeral: true,
      });
    }
  }

  if (commandName === "playlist") {
    if (musicPlaylist.length > 0) {
      const playlistText = musicPlaylist
        .map((track, index) => `${index + 1}. ${track.title}`)
        .join("\n");
      await interaction.reply(
        `*JukeJuke's* current playlist:\n${playlistText}`
      );
    } else {
      await interaction.reply({
        content: "The playlist is currently empty.",
        ephemeral: true,
      });
    }
  }
});

async function playMusic(song, interaction, connection, notify = false) {
  try {
    const songInfo = await getSongInfo(song);

    const stream = await ytdl(songInfo.url, {
      filter: "audioonly",
      fmt: "mp3",
      highWaterMark: 1 << 30,
      liveBuffer: 20000,
      dlChunkSize: 4096,
      bitrate: 128,
      quality: "lowestaudio",
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36",
        },
      },
    });

    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);
    currentPlayer = player;

    player.on(AudioPlayerStatus.Idle, () => {
      if (musicPlaylist.length > 0) {
        const nextTrack = musicPlaylist.shift();
        playMusic(nextTrack.url, interaction, connection);
      }
    });

    if (notify) {
      await interaction.followUp(
        `*JukeJuke* is now playing **${songInfo.title}**.`
      );
    }
  } catch (error) {
    console.error("Error playing music:", error);
    await interaction.followUp("There was an error playing the song.");
  }
}

async function getSongInfo(query) {
  const searchResults = await ytSearch(query);
  const firstResult = searchResults.all[0];
  return firstResult
    ? { url: firstResult.url, title: firstResult.title }
    : null;
}

client.login(process.env.DISCORD_BOT_TOKEN);
