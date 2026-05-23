import { ActionRowBuilder, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';

const stockCategories = {
  fruit: {
    label: 'Fruit',
    emoji: '🍓',
    imageUrl: process.env.STOCK_FRUIT_IMAGE_URL,
  },
  alcohol: {
    label: 'Alcohol',
    emoji: '🍺',
    imageUrl: process.env.STOCK_ALCOHOL_IMAGE_URL,
  },
  dairy: {
    label: 'Dairy',
    emoji: '🧀',
    imageUrl: process.env.STOCK_DAIRY_IMAGE_URL,
  },
  grains: {
    label: 'Grains',
    emoji: '🌾',
    imageUrl: process.env.STOCK_GRAINS_IMAGE_URL,
  },
  protein: {
    label: 'Protein',
    emoji: '🥩',
    imageUrl: process.env.STOCK_PROTEIN_IMAGE_URL,
  },
  fish: {
    label: 'Fish',
    emoji: '🐟',
    imageUrl: process.env.STOCK_FISH_IMAGE_URL,
  },
  speciality: {
    label: 'Speciality',
    emoji: '✨',
    imageUrl: process.env.STOCK_SPECIALITY_IMAGE_URL,
  },
  vegetables: {
    label: 'Vegetables',
    emoji: '🥦',
    imageUrl: process.env.STOCK_VEGETABLES_IMAGE_URL,
  },
};

const pingRoleId = parseRoleId(process.env.FARMER_ROLE_IDS ?? process.env.FAMER_ROLE_IDS ?? process.env.Famer_Role_Ids);

export const data = new SlashCommandBuilder()
  .setName('stock')
  .setDescription('Request a stock refill alert for one or more food categories.');

export async function execute(interaction) {
  const payload = {
    content: 'Select one or more categories for the stock request.',
    components: [buildCategorySelectRow()],
    ephemeral: true,
  };

  await interaction.reply(payload);
}

export async function handleCategorySelection(interaction) {
  const selectedKeys = interaction.values;

  if (selectedKeys.length === 0) {
    await interaction.reply({ content: 'That stock request could not be processed.', ephemeral: true });
    return;
  }

  const selectedCategories = selectedKeys.map(key => stockCategories[key]).filter(Boolean);
  if (selectedCategories.length === 0) {
    await interaction.reply({ content: 'No valid stock categories were selected.', ephemeral: true });
    return;
  }

  const roleMentions = pingRoleId ? `||<@&${pingRoleId}>||` : '';
  const categoryLabels = selectedCategories.map(category => `${category.emoji} ${category.label}`);
  const alertMessage = 'Our high priority stock need is:';
  const embed = new EmbedBuilder()
    .setTitle(alertMessage)
    .setDescription(formatCategoryBullets(categoryLabels))
    .setColor(0xc9a227);

  if (selectedCategories.length === 1 && selectedCategories[0].imageUrl) {
    embed.setImage(selectedCategories[0].imageUrl);
  }

  const payload = {
    content: roleMentions || undefined,
    embeds: [embed],
    allowedMentions: pingRoleId ? { roles: [pingRoleId] } : { parse: [] },
  };

  await interaction.reply(payload);
}

function buildCategorySelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('stock-categories')
    .setPlaceholder('Choose one or more categories')
    .setMinValues(1)
    .setMaxValues(Object.keys(stockCategories).length)
    .addOptions(
      Object.entries(stockCategories).map(([key, category]) => ({
        label: category.label,
        value: key,
        emoji: category.emoji,
      })),
    );

  return new ActionRowBuilder().addComponents(menu);
}

function formatCategoryBullets(categories) {
  return categories.map(category => `- ${category}`).join('\n');
}

function parseRoleId(value) {
  if (!value) {
    return null;
  }

  return value.trim() || null;
}