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
  .setDescription('Request a stock refill alert for one or more food categories.')
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('How much is needed for each selected category.')
      .setRequired(true),
  );

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount', true);
  const payload = {
    content: `Select one or more categories for a request of up to ${amount} each.`,
    components: [buildCategorySelectRow(amount)],
    ephemeral: true,
  };

  await interaction.reply(payload);
}

export async function handleCategorySelection(interaction) {
  const amount = Number(interaction.customId.split(':')[1]);
  const selectedKeys = interaction.values;

  if (!Number.isInteger(amount) || amount <= 0 || selectedKeys.length === 0) {
    await interaction.reply({ content: 'That stock request could not be processed.', ephemeral: true });
    return;
  }

  const selectedCategories = selectedKeys.map(key => stockCategories[key]).filter(Boolean);
  if (selectedCategories.length === 0) {
    await interaction.reply({ content: 'No valid stock categories were selected.', ephemeral: true });
    return;
  }

  const roleMentions = pingRoleId ? `||<@&${pingRoleId}>||` : '';
  const categoryLabels = formatCategoryList(selectedCategories.map(category => category.label));
  const alertMessage = `Our high priority stock need is ${categoryLabels}`;
  const embed = new EmbedBuilder()
    .setTitle(alertMessage)
    .setDescription(`Need up to ${amount} of each selected category.`)
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

function buildCategorySelectRow(amount) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`stock-categories:${amount}`)
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

function formatCategoryList(categories) {
  if (categories.length === 1) {
    return categories[0];
  }

  const head = categories.slice(0, -1).join(', ');
  return `${head} and ${categories[categories.length - 1]}`;
}

function parseRoleId(value) {
  if (!value) {
    return null;
  }

  return value.trim() || null;
}