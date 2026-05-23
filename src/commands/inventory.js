import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Show combined warehouse and store stock levels');

export async function execute(interaction) {
  try {
    const wh = await import('./warehouse.js');
    const st = await import('./store.js');

    const whEmbed = typeof wh.buildWarehouseListEmbed === 'function' ? await wh.buildWarehouseListEmbed() : null;
    const stEmbed = typeof st.buildStoreListEmbed === 'function' ? await st.buildStoreListEmbed() : null;

    const whDesc = whEmbed?.data?.description ?? 'No warehouse data available.';
    const stDesc = stEmbed?.data?.description ?? 'No store data available.';

    const embed = new EmbedBuilder()
      .setTitle('Inventory — Warehouse & Store')
      .addFields(
        { name: 'Warehouse', value: whDesc, inline: false },
        { name: 'Store', value: stDesc, inline: false },
      )
      .setColor(0x2ecc71)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false, allowedMentions: { parse: [] } });
  } catch (e) {
    console.error('Failed to build inventory', e);
    try { await interaction.reply({ content: `Failed to show inventory: ${e.message}`, ephemeral: true }); } catch {}
  }
}
