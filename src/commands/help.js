import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List the bot commands that are currently available.');

export async function execute(interaction) {
  const commands = [...interaction.client.commands.values()]
    .map(command => `/${command.data.name} - ${command.data.description}`)
    .sort((left, right) => left.localeCompare(right));

  await interaction.reply({
    content: commands.length > 0 ? `Available commands:\n${commands.join('\n')}` : 'No commands are registered yet.',
    ephemeral: true,
  });
}
