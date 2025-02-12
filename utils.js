
const { createAudioResource } = require('@discordjs/voice')

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
            pause()
        };

        this.resume();
    }
}
 const messageSplitter  = (sentence, interaction, reply=true)=>{
    if(sentence.length < 2000 && reply){
        interaction.reply(sentence)
        return
    }
    for (let i = 0; i < Math.ceil(sentence.length / 2000); i++) {
        if(i === 0 && reply){
            interaction.reply(sentence.substring(i * 2000, Math.min((i + 1) * 2000, sentence.length)))
        }
        else{
            interaction.channel.send(sentence.substring(i * 2000, Math.min((i + 1) * 2000, sentence.length)))
        }
    }
}

let timer = null

const setAudioTimer = async (time, audioPlayer, fileLocation) => {
    audioPlayer.play(createAudioResource(fileLocation))
    const result = await new Promise((resolve, reject) => {
        try{
            timer = new Timer(() => {
                resolve();
                
            }, time * 1000);
        }
        catch(e){
            reject(e)
        }
    });
    timer = null
    return result
}

 const getTimer = () => {
    return timer;
}

const setTimer = (newTimer) => {
    timer = newTimer;
}

module.exports = { messageSplitter, setAudioTimer, getTimer, setTimer }