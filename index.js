
const { REST, Client, IntentsBitField, Routes, Activity, ActivityType, italic, VoiceChannel, StringSelectMenuBuilder } = require('discord.js')
const { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, ComponentType } = require('discord.js');

var { createCompletion, loadModel, CompletionResult } = require('gpt4all')

const { CLIENT_ID, token, SERVER_ID, YOUTUBE_API_KEY, prompt, addMap, normalAds, intro, outro } = require('./config.json');

//add map is for custom ads you want to play in the form
// { name: "name of ad", fileLocation: "location of file", length: "length of ad in seconds" }

//normal ads is for normal ads you want to play in the form
// { name: "name of ad", fileLocation: "location of file", length: "length of ad in seconds" }

const { joinVoiceChannel, createAudioPlayer, createAudioResource, PlayerSubscription, VoiceConnection } = require('@discordjs/voice')

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.GuildVoiceStates] });

const { spawn, fork } = require("child_process");
const { error, time } = require('console');

const fs = require('fs');
const ytdl = require("@distube/ytdl-core");
var search = require('youtube-search');


//todo test
var model = null;
var chat = null;
const rest = new REST({ version: '10' }).setToken(token);

var AI_WORKING = false;
var AI_ON = false;
var inChat = false;
var currentlyDoingSomethingPleaseDontCrash = false;

var playSomething = true;
var isRadioHost = true;
var isPlayingSong = false;
var playCustomAds = true;
var playNormalAds = true;


client.login(token);


var opts = {
    maxResults: 10,
    key: YOUTUBE_API_KEY
};

const urlQueue = []

class Timer {
    constructor(callback, delay) {
        var timerId, start, remaining = delay;

        this.pause = function () {
            clearTimeout(timerId);
            timerId = null;
            remaining -= Date.now() - start;
        };

        this.resume = function () {
            if (timerId) {
                return;
            }

            start = Date.now();
            timerId = setTimeout(callback, remaining);
        };

        this.getRemaining = function () {
            return remaining;
        };

        this.forceCallback = function () {
            if (callback) {
                callback();
            }
            pause();
        };

        this.resume();
    }
}



async function startUpChat() {

    console.log("in here")
    model = await loadModel('Nous-Hermes-2-Mistral-7B-DPO.Q4_0.gguf', {
        verbose: true,
        device: 'gpu',
        modelConfigFile: "./models3.json",
        nCtx: 8192,
    });
    createChatSession(prompt)
    AI_WORKING = true;
    AI_ON = true
}

//todo need to seperate discord listening to multiple users, make async, make sure that bot can only listen to one person at a time or queue them
async function createChatSession(chatSessionPrompt) {
    chat = await model.createChatSession({
        temperature: 1,
        systemPrompt: `<|im_start|>system \n${chatSessionPrompt}<|im_end|>`,
    });
}


async function sendBotMessage(message) {
    if (message == null) {
        return null;
    }
    return (await createCompletion(chat, message)).choices[0].message;

}

const makeAudioFromMessage = async (message, lengthCalculator) => {
    return await new Promise((resolve) => sendBotMessage(message).then((value) => {
        length = value.content.length
        if (inChat && !currentlyDoingSomethingPleaseDontCrash) {
            currentlyDoingSomethingPleaseDontCrash = true;

            var childPython = spawn('edge-tts', ['--text', value.content, "--write-media", "output.mp3", "--voice", "en-US-SteffanNeural"]);
            setTimeout(() => {
                childPython.kill()
                currentlyDoingSomethingPleaseDontCrash = false;
                resolve(length)
            }, lengthCalculator(length));
        }
    }))
}



client.on('ready', (c) => {
    startUpChat();
    console.log("Bot is online")
});


process.on("SIGTERM", () => {
    if (model) {
        console.log("CLOSING UP SHOP")
        model.dispose()
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

        if (!AI_WORKING || !AI_ON) { return interaction.reply('Bot is currently not avaliable '.concat(message)); }
        var botmessage;

        sendBotMessage(message).then((value) => {
            let sentence = interaction.user.displayName + " : " + message + "\n" + value.content;
            for (let i = 0; i < Math.ceil(sentence.length / 2000); i++) {
                let functionToCall = (i===0) ? interaction.reply : interaction.channel.send
                functionToCall(sentence.slice(2000 * (i), ((2000) * (i + 1))))
            }
            if (inChat && !currentlyDoingSomethingPleaseDontCrash && !isPlayingSong && audioplayer) {
                makeAudioFromMessage(sentence, (x) => 10 * x + 500).then(() => {
                    if (audioplayer) {
                        audioplayer.play(createAudioResource("output.mp3"))
                    }
                })
            }
        });

        return true;
    }

    if (interaction.commandName == "chaton") {
        if (AI_ON == true) {
            return interaction.channel.send("bot is already on")
        }
        startUpChat()
        AI_ON = true;
        return interaction.channel.send("bot is now on")

    }
    if (interaction.commandName == "chatoff") {
        if (model == null) {
            AI_ON = false;
            return interaction.channel.send("bot is already off")
        }
        model.dispose();
        AI_ON = false;
        return interaction.channel.send("bot is now off")

    }

    if (interaction.commandName == "join-voice-channel") {
        voiceConnection = joinVoiceChannel({ selfDeaf: false, selfMute: false, channelId: interaction.options.getChannel("channel").id, guildId: interaction.guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
        audioplayer = createAudioPlayer();
        inChat = true;
        voiceConnection.subscribe(audioplayer);
        return interaction.reply("Joined Voice channel " + interaction.options.getChannel("channel").name);
    }
    if (interaction.commandName == "disconnect") {
        //todo fix this
        voiceConnection.disconnect();
        voiceConnection.destroy();
        audioplayer.stop();
        interaction.reply("Disconnected from voice channel");
    }
    if (interaction.commandName == "play-audio") {
        if (!audioplayer) {
            return interaction.reply("No audio player to do command")
        }
        if (urlQueue.length === 0) {
            return interaction.reply("No videos in queue to play, please add a video to the queue")
        }
        playSomething = true;
        isPlayingSong = true;
        interaction.reply("```Playing audio now```")
        play()

    }

    if (interaction.commandName == "pause-audio") {
        if (!audioplayer) {
            return interaction.reply("No audio player to do command")
        }
        pause()
        playSomething = false;
        interaction.reply("```Paused audio```")
    }


    if (interaction.commandName == "add-to-queue") {
        addToQueue(interaction).then(() => {
            if (!isPlayingSong && playSomething && urlQueue.length != 0) {
                playYoutubeVideo2()
            }
        })
    }

    if (interaction.commandName == "skip-next") {
        if (!audioplayer) {
            return interaction.reply("No audio player to do command")
        }
        skipNext(interaction)
    }
    if (interaction.commandName == "toggle-radio-host") {
        isRadioHost = !isRadioHost
    }

    if (interaction.commandName == "get-song-queue") {
        interaction.reply("getting video queue");
        getSongQueue(interaction)
    }
    if (interaction.commandName == "skip") {
        skip(interaction)
    }

    if (interaction.commandName == "search") {

        const fun = async () => {
            let searchResults = await search(interaction.options.get("query").value, opts)
            const actionRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId("songSelect" + interaction.id).setPlaceholder("Select a song").addOptions(searchResults.results.map((x, i) => {
                    return { label: x.title, value: x.link, description: x.channelTitle }
                })).setMinValues(1).setMaxValues(1)
            )
            const reply = await interaction.reply({ content: "```Select a song```", components: [actionRow] })

            const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, filer:(i) =>{
                return i.user.id === interaction.user.id && i.customId === "songSelect" + interaction.id
            }, time: 60000 })
            
            collector.on("collect", async (i) => { 
                urlQueue.push({ url: i.values[0], channel: interaction })
                console.log(urlQueue)

                const info = await ytdl.getBasicInfo(i.values[0])
                const title = info.videoDetails.title
                if (!isPlayingSong && playSomething && urlQueue.length != 0) {
                    playYoutubeVideo2()
                }
                collector.stop()
                
                i.channel.send("```" + interaction.user.displayName + " added to the queue " +  title + "```" +  i.values[0])
                i.message.delete()
            })
        }

        fun()


    }

    if (interaction.commandName == "toggle-radio-host") {
        isRadioHost = !isRadioHost
        interaction.reply("```Radio host is now " + (isRadioHost) ? "On" : "off" + "```")
    }

    if (interaction.commandName == "toggle-regular-ads") {
        playNormalAds = !playNormalAds
        interaction.reply("```Regular ads are now " + (playNormalAds) ? "On" : "off" + "```")
    }

    if (interaction.commandName == "toggle-custom-ads") {
        playCustomAds = !playCustomAds
        interaction.reply("```Custom ads are now " + (playCustomAds) ? "On" : "off" + "```")
    }




});


async function getSongQueue(interaction) {
    for (let i = 0; i < urlQueue.length; i++) {
        let title = (await ytdl.getBasicInfo(urlQueue[i].url)).videoDetails.title
        interaction.channel.send("" + (i + 1) + " : " + title)
    }
}

async function skipNext(interaction) {
    if (!isPlayingSong) {
        return interaction.reply("Cannot skip something if not playing song")
    }
    if (urlQueue.length == 0) {
        interaction.reply("```No next song to skip``")
        return
    }
    const nextSong = urlQueue.shift()
    interaction.reply("```Skipping next song```" + nextSong.url)
}




async function addToQueue(interaction) {

    const url = interaction.options.get("url").value;
    if (!url) {
        return interaction.reply("cannot add song if you dont provide url")
    }

    let info = null
    try {
        info = await ytdl.getBasicInfo(url)
    } catch (error) {
        console.log(error)
        console.log(url)
        return interaction.reply("Url " + url + " dosent exist")
    }

    urlQueue.push({ url: url, channel: interaction })
    console.log(urlQueue)
    return interaction.reply("```" + interaction.user.displayName + " added to the queue " + info.videoDetails.title + "```" + url)


}



let introTimer = null;
let adTimer = null;
let videoTimer = null;
let pleaseSkip = true;


async function skip(interaction) {
    pleaseSkip = true;
    interaction.reply("```Skipping song```")
}

async function pause() {
    if (audioplayer) {
        audioplayer.pause()
    }
    if (introTimer) {
        introTimer.pause()
    }
    if (adTimer) {
        adTimer.pause()
    }
    if (videoTimer) {
        videoTimer.pause()
    }
}


async function play() {
    if (audioplayer) {
        audioplayer.play()
    }
    if (introTimer) {
        introTimer.resume()
    }
    if (adTimer) {
        adTimer.resume()
    }
    if (videoTimer) {
        videoTimer.resume()
    }
}


let videoID = null
async function playYoutubeVideo2() {


    isPlayingSong = true
    let length = null;
    let cleared = false;

    while (urlQueue.length != 0) {
        cleared = false;
        introTimer = null;
        adTimer = null;
        videoTimer = null;
        var gotVideo = false;
        pleaseSkip = false;
        let a = setInterval(() => {
            if (pleaseSkip) {

                console.log("Closing")
                console.log(introTimer);
                console.log(adTimer)
                console.log(videoTimer)
                if (introTimer) {
                    introTimer.forceCallback()
                }
                if (adTimer) {
                    adTimer.forceCallback()
                }
                if (videoTimer) {
                    console.log("CLOSING VIDEO")
                    videoTimer.forceCallback()
                }
                audioplayer.pause()
                clearInterval(a)
                cleared = true;
            }
            else if (cleared) {
                console.log("Cleared but still here")
            }

        }, 1000)


        const choice = urlQueue.shift();
        console.log(choice)
        const channel = choice.channel.channel
        const info = await ytdl.getInfo(choice.url);
        const url = choice.url;

        if (isRadioHost) {
            if (videoID != info.videoDetails.video_url) {
                length = await makeAudioFromMessage("If you were a radio host, what would you say before playing " + info.videoDetails.title + "by " + info.videoDetails.author.name + " . keep it under 50 words.", (x) => 10 * x + 500)

            }
            audioplayer.unpause()

            audioplayer.play(createAudioResource("output.mp3"))
        }

        const currentTime = Date.now()

        console.log("Got to down here")


        const format = ytdl.chooseFormat(info.formats, { quality: "18" })
        await new Promise((resolve) => { // wait

            ytdl.downloadFromInfo(info, { format: format }).pipe(fs.createWriteStream("video.mp4")).on("close", () => {
                gotVideo = true;
                setTimeout(() => {
                    audioplayer.play(createAudioResource("./video.mp4"))
                    channel.send("```Currently Playing : " + info.videoDetails.title + "```" + url)
                    resolve();
                }, (isRadioHost) ? currentTime + 85 * length - Date.now() : 0)

            })
            setTimeout(() => {
                if (gotVideo) {
                    return
                }
                console.log("Still in here, aborting")
                channel.send("Error downloading video, aborting").then(() => {
                    throw Error("Failed to download video")
                })

            }, 30000)
        })



        if (urlQueue.length != 0 && isRadioHost) {
            let nextSong = urlQueue[0];
            let info2 = await ytdl.getInfo(nextSong.url);
            length = makeAudioFromMessage("If you were a radio host, what would you say before playing " + info2.videoDetails.title + "by " + info2.videoDetails.author.name + ". keep it under 50 words.", (x) => 10 * x + 3000)
            videoID = info2.videoDetails.video_url
        }

        console.log("after generated next")


        if (pleaseSkip) {
            clearInterval(a)
            pleaseSkip = false;

            if (length) {
                await length
            }
            if (urlQueue.length == 0) {
                channel.send("Queue is now empty")
            }
            continue;
        }

        await new Promise((resolve) => {
            console.log("In promise rn")
            videoTimer = new Timer(() => { console.log("CLOSING VIDEO"); resolve() }, (Number(info.videoDetails.lengthSeconds) + 2) * 1000)
        })

        if (pleaseSkip) {

            a = null;
            console.log(a)
            if (length) {
                await length
            }
            if (urlQueue.length == 0) {
                channel.send("Queue is now empty")
            }
            console.log("continueing now")
            continue
        }

        videoTimer = null;

        console.log("checking now about ads")


        let randomNumber = Math.floor(Math.random() * 6);
        if (randomNumber == 1 && ((playCustomAds && addMap.length !== 0) || (playNormalAds && normalAds.length !== 0))) {
            let numberOfAdsToPlay = Math.min(Math.floor(Math.random() * 3) + 1, addMap.length);
            console.log("playing " + numberOfAdsToPlay + " ads")
            const playedList = [];

            if(intro){
                await new Promise((resolve) => {
                    audioplayer.play(createAudioResource(intro.fileLocation))
                    setTimeout(() => {
                        resolve()
                    }, intro.length * 1000)
                })
            }

            if (playNormalAds && normalAds.length !== 0) {
                let fakeOut = normalAds[Math.floor(Math.random() * (normalAds.length))]

                console.log(fakeOut.fileLocation)
                await new Promise((resolve) => {
                    audioplayer.play(createAudioResource(fakeOut.fileLocation))
                    setTimeout(() => {
                        resolve()
                    }, fakeOut.length * 1000)
                })
            }


            if (playCustomAds && addMap.length !== 0) {
                while (playedList.length != numberOfAdsToPlay) {
                    if (pleaseSkip) {
                        if (length) {
                            await length
                        }
                        break;
                    }
                    let indexOfAd = Math.floor(Math.random() * addMap.length);
                    while (playedList.includes(indexOfAd)) {
                        indexOfAd = (indexOfAd + 1) % addMap.length
                    }
                    const adToPlay = addMap[indexOfAd]
                    playedList.push(indexOfAd)
                    console.log("Playing " + adToPlay.name + " ad")
                    audioplayer.play(createAudioResource(adToPlay.fileLocation))
                    await new Promise((resolve) => {
                        adTimer = new Timer(() => resolve(), (adToPlay.length + 2) * 1000)
                    })
                    adTimer = null;
                }
            }

            if(outro){
                await new Promise((resolve) => {
                    audioplayer.play(createAudioResource(outro.fileLocation))
                    setTimeout(() => {
                        resolve()
                    }, outro.length * 1000)
                })
            }

        }
        console.log("Done with loop doing it again")
        if (urlQueue.length == 0) {
            channel.send("Queue is now empty")
        }

        clearInterval(a)
        a = null;

    }
    isPlayingSong = false;

}

