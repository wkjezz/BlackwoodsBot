import { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function getAdminRoleIds() {
  const keys = ['WRANGLER_ROLE_IDS', 'RANGER_ROLE_IDS', 'DESPERADO_ROLE_IDS', 'PROPRIETROR_ROLE_IDS'];
  const ids = [];
  for (const k of keys) {
    const v = process.env[k];
    if (!v) continue;
    ids.push(...v.split(',').map(s => s.trim()).filter(Boolean));
  }
  return ids;
}

function memberHasAdminRole(interaction) {
  const allowed = getAdminRoleIds();
  if (!allowed.length) return true; // no restriction configured
  if (!interaction.inGuild() || !interaction.member) return false;
  const cache = interaction.member.roles?.cache;
  if (!cache) return false;
  return cache.some(r => allowed.includes(r.id));
}

const dataFilePath = fileURLToPath(new URL('../../data/store.json', import.meta.url));

const storeCategories = {
  fruit: { label: 'Fruit', emoji: '🍓', imageUrl: process.env.STORE_FRUIT_IMAGE_URL },
  alcohol: { label: 'Alcohol', emoji: '🍺', imageUrl: process.env.STORE_ALCOHOL_IMAGE_URL },
  dairy: { label: 'Dairy', emoji: '🧀', imageUrl: process.env.STORE_DAIRY_IMAGE_URL },
  grains: { label: 'Grains', emoji: '🌾', imageUrl: process.env.STORE_GRAINS_IMAGE_URL },
  protein: { label: 'Protein', emoji: '🥩', imageUrl: process.env.STORE_PROTEIN_IMAGE_URL },
  fish: { label: 'Fish', emoji: '🐟', imageUrl: process.env.STORE_FISH_IMAGE_URL },
  speciality: { label: 'Speciality', emoji: '✨', imageUrl: process.env.STORE_SPECIALITY_IMAGE_URL },
  vegetables: { label: 'Vegetables', emoji: '🥦', imageUrl: process.env.STORE_VEGETABLES_IMAGE_URL },
};

async function readData() {
  try {
    const raw = await readFile(dataFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const initial = { categories: {} };
    for (const key of Object.keys(storeCategories)) {
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

function buildStoreListLines(dataObj) {
  return Object.keys(storeCategories).map(k => {
    const info = dataObj.categories[k] || { amount: 0 };
    return `${storeCategories[k].emoji} **${storeCategories[k].label}** — ${info.amount} units`;
  });
}

export async function buildStoreListEmbed() {
  const dataObj = await readData();
  return new EmbedBuilder()
    .setTitle('Store stock levels')
    .setDescription(buildStoreListLines(dataObj).join('\n'))
    .setColor(0x3498db)
    .setImage('https://i.ibb.co/sDkVr1x/restaurant.png')
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName('store')
  .setDescription('Record store stock levels')
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Set the stock amount for a category')
      .addStringOption(opt =>
        opt
          .setName('category')
          .setDescription('Category to set')
          .setRequired(true)
          .addChoices(...Object.keys(storeCategories).map(k => ({ name: `${storeCategories[k].emoji} ${storeCategories[k].label}`, value: k }))),
      )
      .addIntegerOption(opt => opt.setName('amount').setDescription('New amount').setRequired(true)),
  )
  .addSubcommand(sub => sub.setName('bulk').setDescription('Enter counts for all categories in one modal'))
  .addSubcommand(sub => sub.setName('list').setDescription('Post a public list of all stock levels'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'bulk') {
    if (!memberHasAdminRole(interaction)) {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      return;
    }
    const keys = Object.keys(storeCategories);
    const first = keys[0];
    const modal = new ModalBuilder().setCustomId(`store-bulk-${first}`).setTitle(`Count: ${storeCategories[first].label}`);

    const input = new TextInputBuilder()
      .setCustomId('count')
      .setLabel(`${storeCategories[first].label} count`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('enter number or skip')
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
    return;
  }

  const categoryKey = interaction.options.getString('category');
  const dataObj = await readData();

  if (sub === 'set') {
    if (!memberHasAdminRole(interaction)) {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      return;
    }
    const amount = interaction.options.getInteger('amount', true);
    dataObj.categories[categoryKey] = { amount, updatedBy: interaction.user.id, updatedAt: new Date().toISOString() };
    await writeData(dataObj);

    const embed = new EmbedBuilder()
      .setTitle(`Set ${storeCategories[categoryKey].label} stock`)
      .setDescription(`${storeCategories[categoryKey].emoji} Now at **${amount}** units`)
      .setColor(0x2ecc71)
      .setTimestamp();

    if (storeCategories[categoryKey].imageUrl) embed.setImage(storeCategories[categoryKey].imageUrl);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === 'list') {
    const embed = await buildStoreListEmbed();

    await interaction.reply({ embeds: [embed], ephemeral: false });
    return;
  }
}

export async function handleBulkModal(interaction) {
  try {
    const custom = interaction.customId;
    const parts = custom.split('-');
    const key = parts.slice(2).join('-');
    if (!key || !storeCategories[key]) {
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

    const keys = Object.keys(storeCategories);
    const idx = keys.indexOf(key);
    const next = keys[idx + 1];
    if (next) {
      const { ActionRowBuilder: ARB, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const row = new ARB().addComponents(
        new ButtonBuilder().setCustomId(`store-bulk-next-${next}`).setLabel(`Next: ${storeCategories[next].label}`).setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({ content: `Saved ${storeCategories[key].label}. Click Next to continue.`, components: [row], ephemeral: true });
      return;
    }

    const linesOut = Object.keys(storeCategories).map(k => {
      const info = dataObj.categories[k] || { amount: 0 };
      return `${storeCategories[k].emoji} **${storeCategories[k].label}** — ${info.amount} units`;
    });
    const embed = new EmbedBuilder().setTitle('Updated store levels').setDescription(linesOut.join('\n')).setColor(0x2ecc71).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error('Error processing store bulk modal', e);
    try {
      await interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
    } catch (err) {
      console.error('Failed to send error reply', err);
    }
  }
}

export async function showBulkModal(interaction, key) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  if (!key || !storeCategories[key]) {
    try { await interaction.reply({ content: 'Invalid category for modal.', ephemeral: true }); } catch {}
    return;
  }

  const modal = new ModalBuilder().setCustomId(`store-bulk-${key}`).setTitle(`Count: ${storeCategories[key].label}`);
  const input = new TextInputBuilder()
    .setCustomId('count')
    .setLabel(`${storeCategories[key].label} count`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('enter number or skip')
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  try {
    await interaction.showModal(modal);
  } catch (e) {
    console.error('Failed to show modal from button/command interaction', e);
    try { await interaction.reply({ content: `Could not open modal: ${e.message}`, ephemeral: true }); } catch {}
  }
}