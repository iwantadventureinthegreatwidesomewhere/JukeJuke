import asyncio
import discord
from discord import app_commands
from discord.ext import commands
import os
from yt_dlp import YoutubeDL

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

ytdl_format_options = {
    "format": "bestaudio/best",
    "outtmpl": "%(extractor)s-%(id)s-%(title)s.%(ext)s",
    "restrictfilenames": True,
    "noplaylist": True,
    "nocheckcertificate": True,
    "ignoreerrors": False,
    "logtostderr": False,
    "quiet": True,
    "no_warnings": True,
    "default_search": "auto",
    "source_address": "0.0.0.0",
}

ffmpeg_options = {"options": "-vn"}

ytdl = YoutubeDL(ytdl_format_options)

music_playlist = []


class YTDLSource(discord.PCMVolumeTransformer):

    def __init__(self, source, *, data, volume=0.5):
        super().__init__(source, volume)
        self.data = data
        self.title = data.get('title')
        self.url = data.get('url')

    @classmethod
    async def from_url(cls, url, *, loop=None, stream=True):
        loop = loop or asyncio.get_event_loop()
        data = await loop.run_in_executor(
            None, lambda: ytdl.extract_info(url, download=not stream))

        if 'entries' in data:
            data = data['entries'][0]

        filename = data['url'] if stream else ytdl.prepare_filename(data)
        return cls(discord.FFmpegPCMAudio(filename, **ffmpeg_options),
                   data=data)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}!")
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"Failed to sync commands: {e}")


@bot.tree.command(name="join", description="JukeJuke joins the voice channel")
async def join(interaction: discord.Interaction):
    await _join(interaction, False)


async def _join(interaction: discord.Interaction, and_play: bool):
    if interaction.user.voice:
        channel = interaction.user.voice.channel
        await channel.connect()

        if not and_play:
            await interaction.response.send_message(
                "Poof! A wild *JukeJuke* has appeared! 🌟")
    else:
        await interaction.response.send_message(
            "You are not connected to a voice channel.", ephemeral=True)


@bot.tree.command(name="leave",
                  description="JukeJuke leaves the voice channel")
async def leave(interaction: discord.Interaction):
    if interaction.guild.voice_client:
        await interaction.guild.voice_client.disconnect()
        await interaction.response.send_message(
            "*JukeJuke* left the voice channel.")
    else:
        await interaction.response.send_message(
            "*JukeJuke* is not in a voice channel.", ephemeral=True)


@bot.tree.command(name="play",
                  description="JukeJuke plays a song from YouTube")
@app_commands.describe(song="The song name")
async def play(interaction: discord.Interaction, song: str):
    await interaction.response.defer()

    voice_client = interaction.guild.voice_client

    if not voice_client:
        await _join(interaction, True)
        voice_client = interaction.guild.voice_client

    player = await YTDLSource.from_url(song, loop=bot.loop, stream=True)
    music_playlist.append(player)

    if not voice_client.is_playing():
        await play_next(interaction)

    await interaction.followup.send(f"*JukeJuke* added **{player.title}**.")


async def play_next(interaction):
    if music_playlist:
        voice_client = interaction.guild.voice_client
        player = music_playlist.pop(0)
        voice_client.play(player,
                          after=lambda e: asyncio.run_coroutine_threadsafe(
                              play_next(interaction), bot.loop))


@bot.tree.command(name="pause",
                  description="JukeJuke pauses the currently playing song")
async def pause(interaction: discord.Interaction):
    voice_client = interaction.guild.voice_client
    if voice_client and voice_client.is_playing():
        voice_client.pause()
        await interaction.response.send_message("*JukeJuke* paused the song.")
    else:
        await interaction.response.send_message(
            "No song is currently playing.", ephemeral=True)


@bot.tree.command(name="resume",
                  description="**JukeJuke** resumes the paused song")
async def resume(interaction: discord.Interaction):
    voice_client = interaction.guild.voice_client
    if voice_client and voice_client.is_paused():
        voice_client.resume()
        await interaction.response.send_message("*JukeJuke* resumed the song.")
    else:
        await interaction.response.send_message("The song is not paused.",
                                                ephemeral=True)


@bot.tree.command(
    name="stop",
    description="JukeJuke stops the music and clears the playlist")
async def stop(interaction: discord.Interaction):
    voice_client = interaction.guild.voice_client
    music_playlist.clear()
    if voice_client and voice_client.is_playing():
        voice_client.stop()
        await interaction.response.send_message(
            "*JukeJuke* stopped the music and cleared the playlist.")
    else:
        await interaction.response.send_message(
            "No song is currently playing.", ephemeral=True)


@bot.tree.command(
    name="skip", description="JukeJuke skips to the next song in the playlist")
async def skip(interaction: discord.Interaction):
    voice_client = interaction.guild.voice_client
    if voice_client and voice_client.is_playing():
        voice_client.stop()
        await interaction.response.send_message(
            "*JukeJuke* skipped to the next song.")
    else:
        await interaction.response.send_message(
            "No song is currently playing.", ephemeral=True)


@bot.tree.command(name="playlist",
                  description="JukeJuke displays the current music playlist")
async def playlist(interaction: discord.Interaction):
    if music_playlist:
        playlist_text = "\n".join([
            f"{i + 1}. {player.title}"
            for i, player in enumerate(music_playlist)
        ])
        await interaction.response.send_message(
            f"*JukeJuke's* current playlist:\n{playlist_text}")
    else:
        await interaction.response.send_message(
            "The playlist is currently empty.", ephemeral=True)


bot.run(os.getenv("DISCORD_BOT_TOKEN"))
