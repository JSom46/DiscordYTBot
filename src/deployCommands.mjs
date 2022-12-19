import { REST, Routes } from 'discord.js'

// and deploy your commands!
export default async function(commands){
    // extract data from commands
    const commandsData = [];

    for(const command of commands.values()){
        commandsData.push(command.data);
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(process.env.TOKEN);

	console.log(`refreshing ${commandsData.length} application (/) command(s)`);

	// The put method is used to fully refresh all commands in the guild with the current set
	const data = await rest.put(
		Routes.applicationCommands(process.env.APP_ID),
		{ body: commandsData }
	);

	console.log(`reloaded ${data.length} application (/) command(s)`);

};
