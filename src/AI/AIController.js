const { createCompletion, loadModel, CompletionResult } = require('gpt4all')
const { spawn } = require("child_process");

const {modelName, modelSettings, chatSessionSettings, prompt, aiInitalResponse, moderationPrompt} = require("../../config.json")




var AI_ON = false;
var model = null;
var chat = null;

var moderationChat = null

async function startUpChat() {

    console.log("in here")
    model = await loadModel(modelName, modelSettings);
    await createChatSession();
    AI_ON = true
}

async function createChatSession() {

    let systemPromptFormat = model.config.promptTemplate

    let systemPrompt = systemPromptFormat.replace("%1", prompt);
    systemPrompt = systemPrompt.replace("%2", aiInitalResponse);

    chatSessionSettings.systemPrompt = systemPrompt;

    chat = await model.createChatSession(chatSessionSettings);
    console.log(chat)
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

const getModerationChat= async () => {
    if (!moderationChat) {
        if(!model){
            await startUpChat();
        }
        let systemPromptFormat = model.config.promptTemplate

        let systemPrompt = systemPromptFormat.replace("%1", moderationPrompt + "respond only using a json object of {safe , reason} where safe is a boolean of whether or not the message is safe and reason is the reason why it is safe or unsafe." );
        systemPrompt = systemPrompt.replace("%2", "ok");

        moderationChat = await model.createChatSession({
            systemPrompt: systemPrompt,
            temperature: 0,
            maxTokens: 100
        });
    }
    return moderationChat;

    
}

const checkMessage = ( messageContent) =>{
    return new Promise(async (resolve, reject) => {
        try {
            let moderationChat = await getModerationChat();
            let output = await createCompletion(moderationChat, messageContent);
            resolve(JSON.parse(output.choices[0].message.content));
        } catch (error) {
            console.error(error);
            reject(error);
        }
    });
    
}

const shutdownAi = () => {
    if (model) {
        console.log("CLOSING UP SHOP")
        model.dispose()
    }
    AI_ON = false;
}

module.exports = { startUpChat, makeMessageFromPrompt, convertMessageToAudio, makeAudioFromPrompt, getModel, getChat, checkMessage,shutdownAi, createChatSession, shutdownAi }