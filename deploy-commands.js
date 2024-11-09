const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join the voice channel"),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave the voice channel"),
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("The song name or URL")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause the currently playing song"),
  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume the paused song"),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the playlist"),
  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip to the next song"),
  new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Show the current music playlist"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN
);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
