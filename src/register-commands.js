
const {CLIENT_ID, SERVER_ID, token_discord} = require('../config.json');


const { REST, Routes, ApplicationCommandOptionType, Options, ChannelType, PermissionFlagsBits } = require('discord.js');

const commands = [
  {

    name: 'chat',
    description: 'allows you to chat with Kevin',
    options: [
        {
            name: 'message',
            description:"write your message",
            type:ApplicationCommandOptionType.String,
            required:true
        }
    ],
  },
  {
    name: 'ping',
    description: 'Pong!',
    permissionsRequired:[8]
  },
  {
    name:"join-voice-channel",
    description:'join voice channel',
    options: [
      {
          name: 'channel',
          description:"put id of channel",
          ChannelType:(ChannelType.GuildVoice),
          type:ApplicationCommandOptionType.Channel,
          required:true
      }
      
  ],
  },
  {
    name: 'disconnect',
    description: 'turns talk off',
    permissionsRequired:[8],
  },
  {
    name:"play-audio",
    description:"Play audio"
  },
  {
    name:"pause-audio",
    description:'pause audio'
  },
  {
    name:"add-to-queue",
    description:"add url to queue",
    options:[{
      name:"url",
      description:"the youtube url",
      type:ApplicationCommandOptionType.String,
      required:true
    }]
  },
  {
    name:"skip-next",
    description:"skip the current song"
  },
  {
    name:"toggle-radio-host",
    description:"toggle radio host on and off"
  }, 
  {
    name:"get-song-queue",
    description:"Get queue for songs"
  },
  {
    name:"skip",
    description:"Skip next song"
  },
  {
    name:"search",
    description:"search for a song",
    options:[{
      name:"query",
      description:"the query",
      type:ApplicationCommandOptionType.String,
      required:true
    }]
  },
  {
    name:"toggle-regular-ads",
    description:"toggle regular ads on and off"
  },
  {
    name:"toggle-custom-ads",
    description:"toggle custom ads on and off"
  },
  {
    name:"toggle-ai-readout",
    description:"toggle talk on and off"
  },
  {
    name:"make-image",
    description:"make an image from a prompt",
    options: [
      {
        name: "prompt", 
        description: "The prompt for the image generation",
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  }

];

const rest = new REST({ version: '10' }).setToken(token_discord);

(async () => {
  try {
    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        SERVER_ID
      ),
      { body: commands }
    );

    console.log('Slash commands were registered successfully!');
  } catch (error) {
    console.log(`There was an error: ${error}`);
  }
})();