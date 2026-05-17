import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('russ')
  .setDescription('Send a playful Ticke Tickle message.');

export async function execute(interaction) {
  await interaction.reply({
    content: 'Tickle Tickle ✨🫶😄',
    ephemeral: false,
  });
}
