import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadCommands } from './lib/load-commands.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required.');
}

const commands = await loadCommands();
const commandData = commands.map(command => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);
const useGuildCommands = guildId && /^\d+$/.test(guildId);

if (useGuildCommands) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
  console.log(`Registered ${commandData.length} guild commands.`);
} else {
  await rest.put(Routes.applicationCommands(clientId), { body: commandData });
  if (guildId) {
    console.log('Ignoring invalid DISCORD_GUILD_ID value and registering global commands instead.');
  }
  console.log(`Registered ${commandData.length} global commands.`);
}
