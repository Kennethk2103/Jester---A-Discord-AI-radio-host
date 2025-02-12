//Dear programmer,
//When I wrote this code, only God and I understood what I was doing
//Now, only God knows
//So if you are done trying to 'optimize' this routine (and failed),
//please increment the following counter as a warning to the next guy:
//total_hours_wasted_here = 0

const { REST, Client, IntentsBitField, Routes, Activity, ActivityType, italic, VoiceChannel, StringSelectMenuBuilder } = require('discord.js')
const { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, ComponentType } = require('discord.js');

const { messageSplitter } = require('./utils')
const { startUpChat, makeMessageFromPrompt, convertMessageToAudio, makeAudioFromPrompt, getModel, getChat } = require('./AIController')

const { play, skip, pause, addToQueue, skipNext, getSongQueue, setaudioPlayer, toggleCustomAds, toggleRadioHost, toggleRegularAds, searchAndAddToQueue, setChannel } = require('./YoutubeController')

const { CLIENT_ID, token, SERVER_ID } = require('./config.json');

//add map is for custom ads you want to play in the form
// { name: "name of ad", fileLocation: "location of file", length: "length of ad in seconds" }

//normal ads is for normal ads you want to play in the form
// { name: "name of ad", fileLocation: "location of file", length: "length of ad in seconds" }

const { joinVoiceChannel, createAudioPlayer, createAudioResource, PlayerSubscription, VoiceConnection } = require('@discordjs/voice')

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.GuildVoiceStates] });

const rest = new REST({ version: '10' }).setToken(token);


var inChat = false;



client.login(token);


client.on('ready', (c) => {
    startUpChat();
    console.log("Bot is online")
});


process.on("SIGTERM", () => {
    if (model) {
        console.log("CLOSING UP SHOP")
        getModel().close()
    }
    process.exit()
})


client.on('messageCreate', (message) => {
    //console.log(message);

});

var voiceConnection = null;
var audioplayer = null;

client.on('interactionCreate', (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    //if interaction is slash commad

    if (interaction.commandName == 'ping') {
        return interaction.reply("Pong!");
    }
    if (interaction.commandName == "chat") {

        var message = interaction.options.get('message').value;

        const createMessageAndSend = async (message) => {
            try {
                let response = await makeMessageFromPrompt(message)
                messageSplitter(response, interaction)
                if (audioplayer) {
                    const audioResponse = await makeAudioFromPrompt(response, "output.mp3")
                    audioplayer.play(createAudioResource("output.mp3"))
                }
                return true
            } catch (e) {
                console.log(e)
                return false
            }
        }
        return createMessageAndSend(message)
    }

    if (interaction.commandName == "join-voice-channel") {
        voiceConnection = joinVoiceChannel({ selfDeaf: false, selfMute: false, channelId: interaction.options.getChannel("channel").id, guildId: interaction.guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
        audioplayer = createAudioPlayer();
        setaudioPlayer(audioplayer);
        setChannel(interaction.channel);
        inChat = true;
        voiceConnection.subscribe(audioplayer);
        return interaction.reply("Joined Voice channel " + interaction.options.getChannel("channel").name);
    }
    if (interaction.commandName == "disconnect") {
        //todo fix this
        voiceConnection.disconnect();
        voiceConnection.destroy();
        audioplayer.stop();
        audioplayer = null;
        interaction.reply("Disconnected from voice channel");
    }

    if (interaction.commandName == "play-audio") {
        play(interaction)
    }

    if (interaction.commandName == "pause-audio") {
        pause(interaction)
    }

    if (interaction.commandName == "add-to-queue") {
        addToQueue(interaction)
    }

    if (interaction.commandName == "skip-next") {
        skipNext(interaction)
    }

    if (interaction.commandName == "get-song-queue") {
        return getSongQueue(interaction)
    }
    if (interaction.commandName == "skip") {
        return skip(interaction)
    }

    if (interaction.commandName == "search") {
        return searchAndAddToQueue(interaction)
    }

    if (interaction.commandName == "toggle-radio-host") {
        return toggleRadioHost(interaction)
    }

    if (interaction.commandName == "toggle-regular-ads") {
        return toggleRegularAds(interaction)
    }

    if (interaction.commandName == "toggle-custom-ads") {
        return toggleCustomAds(interaction)
    }

});





