const {spawn} = require('child_process');

const makeImage = async (prompt , interaction) =>{
    try{
        // Spawn the Python script
        interaction.reply({content: "Generating image, please wait...", ephemeral: true});

        const pythonProcess = spawn("python3", ["src/AI/test.py", prompt], {
            shell: true, // Use shell to execute the command
            stdio: 'pipe' // Use pipe to capture output
        });

        // Handle the output from the Python script
        pythonProcess.stdout.on('data', (data) => {
            console.log(`Output: ${data}`);
        });

        // Handle any errors from the Python script
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error: ${data}`);
        });




        // Handle the exit event of the Python script
        pythonProcess.on('exit', (code) => {
            console.log(`Python script exited with code ${code}`);
            let imageURL = "./output.png"; // Adjust this path as needed
            //
            interaction.channel.send({
                content: "Prompt By - " + interaction.user.username + " \n" + prompt,
                files: [imageURL]
            });

        });

    }catch(e){
        console.error("Error in making image: ", e);
        await interaction.reply({content: "An error occurred while generating the image.", ephemeral: true});
    }
    
}

exports.makeImage = makeImage;