import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

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

const pingRoleId = parseRoleId(process.env.FAMER_ROLE_IDS ?? process.env.Famer_Role_Ids);

export const data = new SlashCommandBuilder()
  .setName('stock')
  .setDescription('Request a stock refill alert for a food category.')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Choose the stock category to request.')
      .setRequired(true)
      .addChoices(
        { name: '🍓 Fruit', value: 'fruit' },
        { name: '🍺 Alcohol', value: 'alcohol' },
        { name: '🧀 Dairy', value: 'dairy' },
        { name: '🌾 Grains', value: 'grains' },
        { name: '🥩 Protein', value: 'protein' },
        { name: '🐟 Fish', value: 'fish' },
        { name: '✨ Speciality', value: 'speciality' },
        { name: '🥦 Vegetables', value: 'vegetables' },
      ),
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('How many are needed.')
      .setRequired(true),
  );

export async function execute(interaction) {
  const categoryKey = interaction.options.getString('category', true);
  const amount = interaction.options.getInteger('amount', true);
  const category = stockCategories[categoryKey];
  const alertMessage = `Our target is to product ${amount} amount of ${category.label}`;
  const roleMentions = pingRoleId ? `||<@&${pingRoleId}>||` : '';
  const embed = new EmbedBuilder()
    .setTitle(alertMessage)
    .setColor(0xc9a227);

  if (category.imageUrl) {
    embed.setImage(category.imageUrl);
  }

  const payload = {
    content: roleMentions || undefined,
    embeds: [embed],
    allowedMentions: pingRoleId ? { roles: [pingRoleId] } : { parse: [] },
  };

  await interaction.reply(payload);
}

function parseRoleId(value) {
  if (!value) {
    return null;
  }

  return value.trim() || null;
}