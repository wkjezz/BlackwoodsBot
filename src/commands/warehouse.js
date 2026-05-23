import { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataFilePath = fileURLToPath(new URL('../../data/stock.json', import.meta.url));

const stockCategories = {
  fruit: { label: 'Fruit', emoji: '🍓', imageUrl: process.env.STOCK_FRUIT_IMAGE_URL },
  alcohol: { label: 'Alcohol', emoji: '🍺', imageUrl: process.env.STOCK_ALCOHOL_IMAGE_URL },
  dairy: { label: 'Dairy', emoji: '🧀', imageUrl: process.env.STOCK_DAIRY_IMAGE_URL },
  grains: { label: 'Grains', emoji: '🌾', imageUrl: process.env.STOCK_GRAINS_IMAGE_URL },
  protein: { label: 'Protein', emoji: '🥩', imageUrl: process.env.STOCK_PROTEIN_IMAGE_URL },
  fish: { label: 'Fish', emoji: '🐟', imageUrl: process.env.STOCK_FISH_IMAGE_URL },
  speciality: { label: 'Speciality', emoji: '✨', imageUrl: process.env.STOCK_SPECIALITY_IMAGE_URL },
  vegetables: { label: 'Vegetables', emoji: '🥦', imageUrl: process.env.STOCK_VEGETABLES_IMAGE_URL },
};

async function readData() {
  try {
    const raw = await readFile(dataFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const initial = { categories: {} };
    for (const key of Object.keys(stockCategories)) {
      initial.categories[key] = { amount: 0, updatedBy: null, updatedAt: null };
    }
    return initial;
  }
}

async function writeData(data) {
  const dir = dirname(dataFilePath);
  await mkdir(dir, { recursive: true });
  await writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

function buildWarehouseListLines(dataObj) {
  return Object.keys(stockCategories).map(k => {
    const info = dataObj.categories[k] || { amount: 0 };
    return `${stockCategories[k].emoji} **${stockCategories[k].label}** — ${info.amount} units`;
  });
}

export async function buildWarehouseListEmbed() {
  const dataObj = await readData();
  return new EmbedBuilder()
    .setTitle('Warehouse stock levels')
    .setDescription(buildWarehouseListLines(dataObj).join('\n'))
    .setColor(0x3498db)
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName('warehouse')
  .setDescription('Record or view warehouse stock levels')
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Set the stock amount for a category')
      .addStringOption(opt =>
        opt
          .setName('category')
          .setDescription('Category to set')
          .setRequired(true)
          .addChoices(...Object.keys(stockCategories).map(k => ({ name: `${stockCategories[k].emoji} ${stockCategories[k].label}`, value: k }))),
      )
      .addIntegerOption(opt => opt.setName('amount').setDescription('New amount').setRequired(true)),
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View current stock levels')
      .addStringOption(opt =>
        opt
          .setName('category')
          .setDescription('Specific category to view')
          .setRequired(false)
          .addChoices(...Object.keys(stockCategories).map(k => ({ name: `${stockCategories[k].emoji} ${stockCategories[k].label}`, value: k }))),
      ),
  )
  .addSubcommand(sub => sub.setName('bulk').setDescription('Enter counts for all categories in one modal'))
  .addSubcommand(sub => sub.setName('list').setDescription('Post a public list of all stock levels'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'bulk') {
    // start sequential modal flow at first category
    const keys = Object.keys(stockCategories);
    const first = keys[0];
    const modal = new ModalBuilder().setCustomId(`warehouse-bulk-${first}`).setTitle(`Count: ${stockCategories[first].label}`);

    const input = new TextInputBuilder()
      .setCustomId('count')
      .setLabel(`${stockCategories[first].label} count`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('enter number or skip')
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    // show first modal directly (command interaction can show modal)
    await interaction.showModal(modal);
    return;
  }

  const categoryKey = interaction.options.getString('category');
  const dataObj = await readData();

  if (sub === 'set') {
    const amount = interaction.options.getInteger('amount', true);
    dataObj.categories[categoryKey] = { amount, updatedBy: interaction.user.id, updatedAt: new Date().toISOString() };
    await writeData(dataObj);

    const embed = new EmbedBuilder()
      .setTitle(`Set ${stockCategories[categoryKey].label} stock`)
      .setDescription(`${stockCategories[categoryKey].emoji} Now at **${amount}** units`)
      .setColor(0x2ecc71)
      .setTimestamp();

    if (stockCategories[categoryKey].imageUrl) embed.setImage(stockCategories[categoryKey].imageUrl);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === 'view') {
    if (categoryKey) {
      const info = dataObj.categories[categoryKey] || { amount: 0 };
      const embed = new EmbedBuilder()
        .setTitle(`${stockCategories[categoryKey].label} stock`)
        .setDescription(`${stockCategories[categoryKey].emoji} **${info.amount}** units`)
        .setTimestamp(info.updatedAt ? new Date(info.updatedAt) : undefined)
        .setColor(0x3498db);

      if (stockCategories[categoryKey].imageUrl) embed.setImage(stockCategories[categoryKey].imageUrl);

      await interaction.reply({ embeds: [embed], ephemeral: false });
      return;
    }
    const embed = await buildWarehouseListEmbed();

    await interaction.reply({ embeds: [embed], ephemeral: false });
    return;
  }
}

export async function handleBulkModal(interaction) {
  try {
    const custom = interaction.customId; // e.g. 'warehouse-bulk-fruit'
    const parts = custom.split('-');
    const key = parts.slice(2).join('-');
    if (!key || !stockCategories[key]) {
      await interaction.reply({ content: 'Invalid bulk modal identifier.', ephemeral: true });
      return;
    }

    const raw = interaction.fields.getTextInputValue('count').trim();
    const parsedNum = parseInt(raw.replace(/[^0-9-]/g, ''), 10);

    const dataObj = await readData();
    if (!Number.isNaN(parsedNum)) {
      dataObj.categories[key] = { amount: parsedNum, updatedBy: interaction.user.id, updatedAt: new Date().toISOString() };
      await writeData(dataObj);
    }

    // determine next category
    const keys = Object.keys(stockCategories);
    const idx = keys.indexOf(key);
    const next = keys[idx + 1];
    if (next) {
      // reply with ephemeral Next button; the button handler will show the next modal
      const { ActionRowBuilder: ARB, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const row = new ARB().addComponents(
        new ButtonBuilder().setCustomId(`warehouse-bulk-next-${next}`).setLabel(`Next: ${stockCategories[next].label}`).setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({ content: `Saved ${stockCategories[key].label}. Click Next to continue.`, components: [row], ephemeral: true });
      return;
    }

    // finished, reply with summary
    const linesOut = Object.keys(stockCategories).map(k => {
      const info = dataObj.categories[k] || { amount: 0 };
      return `${stockCategories[k].emoji} **${stockCategories[k].label}** — ${info.amount} units`;
    });
    const embed = new EmbedBuilder().setTitle('Updated stock levels').setDescription(linesOut.join('\n')).setColor(0x2ecc71).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error('Error processing warehouse bulk modal', e);
    try {
      await interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
    } catch (err) {
      console.error('Failed to send error reply', err);
    }
  }
}

export async function showBulkModal(interaction, key) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  if (!key || !stockCategories[key]) {
    try { await interaction.reply({ content: 'Invalid category for modal.', ephemeral: true }); } catch {}
    return;
  }

  const modal = new ModalBuilder().setCustomId(`warehouse-bulk-${key}`).setTitle(`Count: ${stockCategories[key].label}`);
  const input = new TextInputBuilder()
    .setCustomId('count')
    .setLabel(`${stockCategories[key].label} count`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('enter number or skip')
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  // ButtonInteraction and ChatInputCommandInteraction support showModal
  try {
    await interaction.showModal(modal);
  } catch (e) {
    console.error('Failed to show modal from button/command interaction', e);
    try { await interaction.reply({ content: `Could not open modal: ${e.message}`, ephemeral: true }); } catch {}
  }
}
