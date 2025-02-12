const ytdl = require("@distube/ytdl-core");
const search = require('youtube-search');
const fs = require('fs');
const { YOUTUBE_API_KEY, addMap, normalAds, intro, outro } = require('./config.json');
const { makeAudioFromPrompt } = require('./AIController')
const { setAudioTimer, getTimer, setTimer } = require('./utils')
const { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, ComponentType , StringSelectMenuBuilder} = require('discord.js');


const opts = {
    maxResults: 10,
    key: YOUTUBE_API_KEY
};


let audioPlayer = null;
let channel = null;

var playSomething = true;
var isPlayingSong = false;
let pleaseSkip = false;

//Stuff user can control
var isRadioHost = true;
var playCustomAds = false;
var playNormalAds = false;

const urlQueue = []

let savedNextVideoUrl = null;


//length of AI message
//used as a check to see if audio is done being processed
//because if this not a promise anymore and the actual value
//that means audio is done being made
let AIMessageLength = null;

let skipIntervalCheck = null;


//UTILITY FUNCTIONS
const setaudioPlayer = (player) => {
    audioPlayer = player;
}

const setChannel = (newChannel) => {
    channel = newChannel;
}

const skipMacro = async () => {
    if (skipIntervalCheck) {
        clearInterval(skipIntervalCheck)
        skipIntervalCheck = null;
    }
    if (AIMessageLength) await AIMessageLength

}


//toggles
const toggleRadioHost = (interaction) => {
    isRadioHost = !isRadioHost
    interaction.reply("```Radio host is now " + (isRadioHost) ? "On" : "off" + "```")
}
const toggleRegularAds = (interaction) => {
    playNormalAds = !playNormalAds
    interaction.reply("```Regular ads are now " + (playNormalAds) ? "On" : "off" + "```")
}

const toggleCustomAds = (interaction) => {
    playCustomAds = !playCustomAds
    interaction.reply("```Custom ads are now " + (playCustomAds) ? "On" : "off" + "```")
}



//QUEUE FUNCTIONS
async function getSongQueue(interaction) {
    if (urlQueue.length == 0) {
        return interaction.reply("```Queue is empty```")
    }

    for (let i = 0; i < urlQueue.length; i++) {
        let title = (await ytdl.getBasicInfo(urlQueue[i].url)).videoDetails.title
        interaction.channel.send("" + (i + 1) + " : " + title)
    }
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
    if (!isPlayingSong && playSomething && urlQueue.length != 0) {
        playYoutubeVideo()
    }
    return interaction.reply("```" + interaction.user.displayName + " added to the queue " + info.videoDetails.title + "```" + url)
}

async function searchAndAddToQueue(interaction) {
    const fun = async () => {
        let searchResults = await search(interaction.options.get("query").value, opts)
        const actionRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId("songSelect" + interaction.id).setPlaceholder("Select a song").addOptions(searchResults.results.map((x, i) => {
                return { label: x.title, value: x.link, description: x.channelTitle }
            })).setMinValues(1).setMaxValues(1)
        )
        const reply = await interaction.reply({ content: "```Select a song```", components: [actionRow] })

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect, filer: (i) => {
                return i.user.id === interaction.user.id && i.customId === "songSelect" + interaction.id
            }, time: 60000
        })

        collector.on("collect", async (i) => {
            urlQueue.push({ url: i.values[0], channel: interaction })
            console.log(urlQueue)

            const info = await ytdl.getBasicInfo(i.values[0])
            const title = info.videoDetails.title
            if (!isPlayingSong && playSomething && urlQueue.length != 0) {
                playYoutubeVideo()
            }
            collector.stop()

            i.channel.send("```" + interaction.user.displayName + " added to the queue " + title + "```" + i.values[0])
            i.message.delete()
        })
    }

    fun()
}


//PAUSE PLAY SKIP FUNCTIONALITY
async function pause(interaction) {
    if (!audioPlayer) {
        return interaction.reply("No audio player to do command")
    }
    if (!isPlayingSong) {
        return interaction.reply("Cannot pause something if not playing song")
    }

    playSomething = false;
    if (audioPlayer) {
        audioPlayer.pause()
    }
    if (getTimer()) {
        getTimer().pause()
    }
    interaction.reply("```Paused audio```")
}

async function play(interaction) {
    if (!audioPlayer) {
        return interaction.reply("No audio player to do command")
    }
    if (urlQueue.length === 0) {
        return interaction.reply("No videos in queue to play, please add a video to the queue")
    }
    if(isPlayingSong){
        return interaction.reply("Already playing something")
    }

    playSomething = true;
    isPlayingSong = true;
    if (audioPlayer) {
        audioPlayer.play()
    }
    if (getTimer()) {
        getTimer().resume()
    }
    interaction.reply("```Playing audio now```")

}

async function skip(interaction) {
    if (!audioPlayer) {
        return interaction.reply("No audio player to do command")
    }
    if (!isPlayingSong) {
        return interaction.reply("Cannot skip something if not playing song")
    }
    pleaseSkip = true;
    interaction.reply("```Skipping song```")
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



//YOUTUBE FUNCTIONALITY
const downloadYotubeVideo = async (info, channel) => {
    try {
        const format = ytdl.chooseFormat(info.formats, { quality: "18" })
        if (!format) {
            console.log("Error downloading video")
            channel.send("Error downloading video, aborting").then(() => {
                throw Error("Failed to download video")
            })
        }

        return await new Promise((resolve) => { // wait
            const videoCheckTimeout = setTimeout(() => {
                channel.send("Error downloading video, aborting").then(() => {
                    resolve(Error("Failed to download video"))
                })
            }, 30000)

            ytdl.downloadFromInfo(info, { format: format }).pipe(fs.createWriteStream("video.mp4")).on("close", async () => {
                clearTimeout(videoCheckTimeout)
                resolve(true)
            })
        })
    }

    catch (e) {
        console.log(e)
        return e
    }
}

const handleAds = async () => {
    try {
        let numberOfAdsToPlay = Math.min(Math.floor(Math.random() * 3) + 1, addMap.length);

        console.log("playing " + numberOfAdsToPlay + " ads")
        const playedList = [];

        if (pleaseSkip) {
            skipMacro()
            return false;
        }

        if (intro) {
            await setAudioTimer(intro.length * 1000, audioPlayer, intro.fileLocation)
        }

        if (pleaseSkip) {
            skipMacro()
            return false;
        }

        if (playNormalAds && normalAds.length !== 0) {
            let fakeOut = normalAds[Math.floor(Math.random() * (normalAds.length))]
            await setAudioTimer((fakeOut.length + 2) * 1000, audioPlayer, fakeOut.fileLocation)
        }


        if (pleaseSkip) {
            skipMacro()
            return false;
        }

        if (playCustomAds && addMap.length !== 0) {
            while (playedList.length != numberOfAdsToPlay) {
                if (pleaseSkip) {
                    skipMacro()
                    return false;
                }

                let indexOfAd = Math.floor(Math.random() * addMap.length);
                while (playedList.includes(indexOfAd)) {
                    indexOfAd = (indexOfAd + 1) % addMap.length
                }

                playedList.push(indexOfAd)
                console.log("Playing " + addMap[indexOfAd].name + " ad")

                await setAudioTimer((addMap[indexOfAd].length + 2) * 1000, audioPlayer, addMap[indexOfAd].fileLocation)
            }
        }

        if (pleaseSkip) {
            skipMacro()
            return false;
        }

        if (outro && !pleaseSkip) {
            await setAudioTimer(outro.length * 1000, audioPlayer, outro.fileLocation)
        }

        return true
    }
    catch (e) {
        console.log(e)
        return e;
    }
}

/**
 * 
 * @param {String} nextSongUrl 
 * @returns {Promise<Number>} Length of AI text response
 */
const makeIntroForSong = async (nextSongUrl) => {
    if (savedNextVideoUrl == nextSongUrl) {
        return AIMessageLength;
    }
    const info = await ytdl.getInfo(nextSongUrl);
    const title = info.videoDetails.title;
    const channelTitle = info.videoDetails.author.name;

    const promptLength = await makeAudioFromPrompt("Pretend you are a radio host and introduce the next song " + title + " by " + channelTitle, "output.mp3")

    savedNextVideoUrl = nextSongUrl;
    return promptLength
}


async function playYoutubeVideo() {
    if (!audioPlayer) {
        return channel.send("Cannot play anything, not in voice channel")
    }
    while (urlQueue.length != 0) {
        pleaseSkip = false;

        if(skipIntervalCheck) clearInterval(skipIntervalCheck)

        
        skipIntervalCheck = setInterval(() => {
            if (pleaseSkip) {
                if (getTimer()) {
                    getTimer().forceCallback()
                }
                audioPlayer.pause()
                clearInterval(a)
            }
        }, 1000)

        //make sure prev intro creation is done
        await AIMessageLength

        const choice = urlQueue.shift();
        const info = await ytdl.getInfo(choice.url);
        const channel = choice.channel.channel


        //going to be promise if radiohost, will force it to wait until intro is complete
        let introComplete=  null;
        
        //always need to do this so dont need to put it into if statement
        let downloadComplete = downloadYotubeVideo(info, channel)


        if (isRadioHost) {
            AIMessageLength = await makeIntroForSong(choice.url)
            audioPlayer.unpause()
            introComplete= setAudioTimer(Math.floor(AIMessageLength / 15), audioPlayer, "output.mp3")
        }

        if (pleaseSkip) {
            skipMacro()
            continue;
        }

        await downloadComplete
        await introComplete

        if (downloadComplete instanceof Error) {
            channel.send("Error downloading video, aborting")
            continue;
        }
        if (pleaseSkip) {
            skipMacro()
            continue;
        }

        channel.send("```Now playing " + info.videoDetails.title + " by " + info.videoDetails.author.name + "```\n " + info.videoDetails.video_url)
        let playVideo = setAudioTimer(1000 * (Number(info.videoDetails.lengthSeconds) + 2), audioPlayer, "video.mp4")

        if (urlQueue.length != 0 && isRadioHost) {
            let nextSong = urlQueue[0];
            AIMessageLength = makeIntroForSong(nextSong.url)
        }

        await playVideo;

        if (pleaseSkip) {
            skipMacro()
            continue;
        }

        console.log("checking now about ads")

        if (Math.floor(Math.random() * 6) == 1 &&
            ((playCustomAds && addMap.length !== 0) || (playNormalAds && normalAds.length !== 0))) {
            await handleAds()
        }

    }
    if (urlQueue.length == 0) channel.send("Queue is now empty")

    if(skipIntervalCheck){
        clearInterval(skipIntervalCheck)
        skipIntervalCheck = null;
    }

    isPlayingSong = false;
    pleaseSkip = false;
}

module.exports = {
    setaudioPlayer, setChannel, play, pause, skip, addToQueue, searchAndAddToQueue, skipNext, getSongQueue, toggleRadioHost, toggleRegularAds, toggleCustomAds
}
