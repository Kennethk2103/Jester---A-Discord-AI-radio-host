
const { REST, Client, IntentsBitField, Routes, Activity, ActivityType, italic, VoiceChannel, StringSelectMenuBuilder, time } = require('discord.js')

const { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, ComponentType } = require('discord.js');

const { messageSplitter } = require('./utils')
const { startUpChat, makeMessageFromPrompt, convertMessageToAudio, makeAudioFromPrompt, getModel, getChat, checkMessage, shutdownAi } = require('./AI/AIController')

const { play, skip, pause, addToQueue, skipNext, getSongQueue, setaudioPlayer, toggleCustomAds, toggleRadioHost, toggleRegularAds, searchAndAddToQueue, setChannel } = require('./radio/YoutubeController')

const { CLIENT_ID, token_discord, SERVER_ID , moderationMode} = require('../config.json');

//add map is for custom ads you want to play in the form
// { name: "name of ad", fileLocation: "location of file", length: "length of ad in seconds" }

//normal ads is for normal ads you want to play in the form
// { name: "name of ad", fileLocation: "location of file", length: "length of ad in seconds" }

const { joinVoiceChannel, createAudioPlayer, createAudioResource, PlayerSubscription, VoiceConnection } = require('@discordjs/voice')

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.GuildVoiceStates, IntentsBitField.Flags.GuildModeration] });

const rest = new REST({ version: '10' }).setToken(token_discord);

const { makeImage } = require('./AI/AiImagehandler');

var inChat = false;

var talk = true;

client.login(token_discord);


client.on('ready', (c) => {
    startUpChat();
    console.log("Bot is online")
});





client.on('messageCreate', async (message) => {
    
    if(moderationMode){
        if (message.author.id == CLIENT_ID) {
            return
        }
        if (message.author.bot) {
            return
        }
        if (message.content == null) {
            return
        }
        let output = await  checkMessage(message.content)
        if(!output?.safe){
            console.log("Message is not safe")
            console.log("Username " + message.author.username + " ID " + message.author.id)
            console.log("Content " + message.content  + " ID " + message.id)
            console.log("Reason " + output?.reason)
        }
        else{
            console.log("Message is safe")
        }

    }
});

var voiceConnection = null;
var audioplayer = null;

process.on("SIGINT", () => {
    shutdownAi()
    if (voiceConnection) {
        voiceConnection.disconnect();
        voiceConnection.destroy();
        voiceConnection = null;
    }
    if (audioplayer) {
        audioplayer.stop();
        audioplayer = null;
    }
    

    process.exit()
})

client.on('interactionCreate', (interaction) => {
    console.log("Interaction received: " + interaction)
    if (!interaction.isChatInputCommand()) return;
    //if interaction is slash commad

    if (interaction.commandName == 'ping') {
        return interaction.reply("Pong!");
    }
    if (interaction.commandName == "chat") {

        var message = interaction.options.get('message').value;

        const createMessageAndSend = async (message) => {
            try {
                let sentEmpheral = false;
                //this only exists to make sure user dosent get "application didnt reply in time" error for weaker hardware
                const messageNotSentTimeOut = setTimeout(() =>{
                    interaction.reply({content : "Bot is currently working on your message", ephemeral: true })
                    sentEmpheral = true;
                }, 2500)

                const response = await makeMessageFromPrompt(message)
                clearInterval(messageNotSentTimeOut)
                let returnMessage = interaction.user.username + ": " + message + "\n" + response


                messageSplitter(returnMessage, interaction, !sentEmpheral)
                clearInterval(messageNotSentTimeOut)

                if (audioplayer && talk) {
                    const audioResponse = await convertMessageToAudio(response)
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

    if(interaction.commandName == "toggle-ai-readout"){
        talk = !talk;
        return interaction.reply("Toggled AI readout to " + talk)
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

    if( interaction.commandName == "make-image") {
        const prompt = interaction.options.get("prompt")?.value;

        if (!prompt) {
            return interaction.reply({content: "Please provide a prompt for the image generation.", ephemeral: true});
        }
        return makeImage(prompt, interaction);
    }

});






