const { createCompletion, loadModel, CompletionResult } = require('gpt4all')
const { spawn } = require("child_process");
const { prompt } = require('./config.json');

var AI_ON = false;
var model = null;
var chat = null;

async function startUpChat() {

    console.log("in here")
    model = await loadModel('Nous-Hermes-2-Mistral-7B-DPO.Q4_0.gguf', {
        verbose: true,
        device: 'gpu',
        modelConfigFile: "./models3.json",
    });
    await createChatSession(prompt)
    AI_ON = true
}

async function createChatSession(chatSessionPrompt) {
    chat = await model.createChatSession({
        temperature: 1,
        systemPrompt: `<|im_start|>system \n${chatSessionPrompt}<|im_end|>`,
    });
}

const makeMessageFromPrompt = async (text) => {
    if (text == null) {
        return null;
    }
    if (!AI_ON) {
        return new Error("AI not working")
    }
    return (await createCompletion(chat, text)).choices[0].message.content;
}


const convertMessageToAudio = async (message, output = "output.mp3") => {
    return await new Promise((resolve, reject) => {
        var childPython = spawn('edge-tts', ['--text', message, "--write-media", output, "--voice", "en-US-SteffanNeural"]);
        childPython.on('exit', function (code, signal) {
            if (code == 0) {
                resolve(message.length);
            } else {
                reject(new Error("Error in converting message to audio"));
            }
        });
        childPython.on('error', function (err) {
            reject(err);
        });
    });
}

const makeAudioFromPrompt = async (text, output = "output.mp3") => {
    return await convertMessageToAudio(await makeMessageFromPrompt(text), output);
}

const getModel = () => {
    return model;
}

const getChat = () => {
    return chat;
}

module.exports = { startUpChat, makeMessageFromPrompt, convertMessageToAudio, makeAudioFromPrompt, getModel, getChat }