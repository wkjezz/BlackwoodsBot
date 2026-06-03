import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIME_ZONE = 'Etc/GMT+5';
const TIME_ZONE_LABEL = 'Los Santos Time (EST)';
const DATA_FILE_PATH = fileURLToPath(new URL('../../data/schedule-polls.json', import.meta.url));
const MAX_DAYS = 7;
const MAX_SLOTS_PER_DAY = 20;
const DEFAULT_DAYS = 3;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 17;
const DEFAULT_SLOT_MINUTES = 60;

function getAllowedRoleIds() {
  const keys = ['DESPERADO_ROLE_IDS', 'PROPRIETROR_ROLE_IDS'];
  const ids = [];

  for (const key of keys) {
    const value = process.env[key];
    if (!value) {
      continue;
    }

    ids.push(...value.split(',').map(part => part.trim()).filter(Boolean));
  }

  return ids;
}

function memberHasAllowedRole(interaction) {
  if (!interaction.inGuild() || !interaction.member) {
    return false;
  }

  const allowedRoleIds = getAllowedRoleIds();
  if (allowedRoleIds.length === 0) {
    return false;
  }

  const memberRoles = interaction.member.roles?.cache;
  if (!memberRoles) {
    return false;
  }

  return memberRoles.some(role => allowedRoleIds.includes(role.id));
}

async function readData() {
  try {
    const raw = await readFile(DATA_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.polls && typeof parsed.polls === 'object') {
      return parsed;
    }
  } catch {
    // fall through to the empty structure below
  }

  return { polls: {} };
}

async function writeData(data) {
  await mkdir(dirname(DATA_FILE_PATH), { recursive: true });
  await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getCurrentDateKey(timeZone) {
  return formatDateKey(new Date(), timeZone);
}

function formatDateKey(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatTimeLabel(totalMinutes) {
  const totalDayMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(totalDayMinutes / 60);
  const minutes = totalDayMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;

  if (minutes === 0) {
    return `${displayHour} ${period}`;
  }

  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

function buildDateKeys(startDateKey, days) {
  const date = new Date(`${startDateKey}T12:00:00Z`);
  const keys = [];

  for (let index = 0; index < days; index += 1) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + index);
    keys.push(formatDateKey(copy, TIME_ZONE));
  }

  return keys;
}

function buildSlotDefinitions(startHour, endHour, slotMinutes) {
  const slots = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const wrapsMidnight = endMinutes <= startMinutes;
  const totalRangeMinutes = wrapsMidnight
    ? (24 * 60 - startMinutes) + endMinutes
    : endMinutes - startMinutes;

  for (let offset = 0; offset < totalRangeMinutes; offset += slotMinutes) {
    const current = (startMinutes + offset) % (24 * 60);
    slots.push({
      index: slots.length,
      label: formatTimeLabel(current),
      minutesFromMidnight: current,
    });
  }

  return slots;
}

function validateDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function normalizeDateKey(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!validateDateKey(trimmed)) {
    return null;
  }

  return trimmed;
}

function getPollTitle(interaction) {
  const rawTitle = interaction.options.getString('title')?.trim();
  return rawTitle || 'Scheduling poll';
}

function getScheduleConfig(interaction) {
  const days = interaction.options.getInteger('days') ?? DEFAULT_DAYS;
  const startHour = interaction.options.getInteger('start-hour') ?? DEFAULT_START_HOUR;
  const endHour = interaction.options.getInteger('end-hour') ?? DEFAULT_END_HOUR;
  const slotMinutes = interaction.options.getInteger('slot-minutes') ?? DEFAULT_SLOT_MINUTES;
  const startDateKey = normalizeDateKey(interaction.options.getString('start-date')) ?? getCurrentDateKey(TIME_ZONE);

  if (days < 1 || days > MAX_DAYS) {
    throw new Error(`Days must be between 1 and ${MAX_DAYS}.`);
  }

  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 24) {
    throw new Error('The time window must use valid 24-hour values between 0 and 24.');
  }

  if (startHour === endHour) {
    throw new Error('The time window must cover at least one slot.');
  }

  if (slotMinutes < 15 || slotMinutes > 180 || slotMinutes % 15 !== 0) {
    throw new Error('Slot length must be a multiple of 15 minutes between 15 and 180.');
  }

  const slots = buildSlotDefinitions(startHour, endHour, slotMinutes);
  if (slots.length === 0) {
    throw new Error('That time window does not contain any slots.');
  }

  if (slots.length > MAX_SLOTS_PER_DAY) {
    throw new Error(`Please keep each day to ${MAX_SLOTS_PER_DAY} slots or fewer.`);
  }

  return {
    title: getPollTitle(interaction),
    startDateKey,
    days,
    startHour,
    endHour,
    slotMinutes,
    slots,
    dateKeys: buildDateKeys(startDateKey, days),
    wrapsMidnight: endHour <= startHour,
  };
}

function createCountMap(poll, dateKey) {
  const counts = new Array(poll.slots.length).fill(0);
  for (const userResponses of Object.values(poll.responses || {})) {
    const selected = userResponses?.[dateKey];
    if (!Array.isArray(selected)) {
      continue;
    }

    for (const slotIndex of selected) {
      if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < counts.length) {
        counts[slotIndex] += 1;
      }
    }
  }

  return counts;
}

function countLabel(count) {
  if (count === 0) {
    return '0';
  }

  return `${count}`;
}

function buttonStyleForCount(count, maxCount) {
  if (count === 0) {
    return ButtonStyle.Secondary;
  }

  if (count === maxCount) {
    return ButtonStyle.Success;
  }

  return ButtonStyle.Primary;
}

function buildPollEmbed(poll) {
  const currentPageIndex = Math.max(0, Math.min(poll.currentPageIndex ?? 0, poll.dateKeys.length - 1));
  const currentDateKey = poll.dateKeys[currentPageIndex];
  const currentCounts = createCountMap(poll, currentDateKey);
  const maxCurrentCount = Math.max(...currentCounts, 0);
  const currentDateLabel = formatDateLabel(currentDateKey);
  const currentSlotLines = poll.slots.map((slot, index) => {
    const count = currentCounts[index];
    const marker = count === 0 ? '⬛' : count === maxCurrentCount ? '🟩' : '🟨';
    return `${marker} **${slot.label}** - ${countLabel(count)} vote${count === 1 ? '' : 's'}`;
  });

  const bestSlots = [];
  for (const dateKey of poll.dateKeys) {
    const counts = createCountMap(poll, dateKey);
    counts.forEach((count, index) => {
      if (count <= 0) {
        return;
      }

      bestSlots.push({
        dateKey,
        slotIndex: index,
        count,
      });
    });
  }

  bestSlots.sort((left, right) => right.count - left.count || left.dateKey.localeCompare(right.dateKey) || left.slotIndex - right.slotIndex);
  const bestMatches = bestSlots.slice(0, 5);

  return new EmbedBuilder()
    .setTitle(poll.title)
    .setColor(maxCurrentCount > 0 ? 0x2ecc71 : 0x3498db)
    .setDescription(
      [
        'Pick the days you can make it, then click the time buttons that work for you.',
        `All times are shown in ${poll.timeZoneLabel}.`,
        'Green marks the strongest overlap on the current day.',
        poll.closed ? 'This poll is closed and locked.' : 'This poll is still open.',
        poll.wrapsMidnight ? 'Overnight window enabled: the end hour wraps into the next day.' : null,
        `Page ${currentPageIndex + 1} of ${poll.dateKeys.length} • ${currentDateLabel}`,
      ].filter(Boolean).join('\n'),
    )
    .addFields(
      {
        name: `Availability for ${currentDateLabel}`,
        value: currentSlotLines.join('\n'),
      },
      {
        name: 'Best overlaps',
        value: bestMatches.length > 0
          ? bestMatches.map(match => `${formatDateLabel(match.dateKey)} - ${poll.slots[match.slotIndex].label} (${match.count})`).join('\n')
          : 'No responses yet.',
      },
    )
    .setFooter({ text: 'Use Previous day and Next day to move through the schedule.' })
    .setTimestamp();
}

function buildPollComponents(poll) {
  const currentPageIndex = Math.max(0, Math.min(poll.currentPageIndex ?? 0, poll.dateKeys.length - 1));
  const currentDateKey = poll.dateKeys[currentPageIndex];
  const currentCounts = createCountMap(poll, currentDateKey);
  const maxCurrentCount = Math.max(...currentCounts, 0);
  const locked = Boolean(poll.closed);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`schedpoll:${poll.id}:page:${currentPageIndex}:nav:prev`)
      .setLabel('Previous day')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPageIndex === 0 || locked),
    new ButtonBuilder()
      .setCustomId(`schedpoll:${poll.id}:page:${currentPageIndex}:nav:next`)
      .setLabel('Next day')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPageIndex >= poll.dateKeys.length - 1 || locked),
    new ButtonBuilder()
      .setCustomId(`schedpoll:${poll.id}:page:${currentPageIndex}:close:close`)
      .setLabel(locked ? 'Closed' : 'Close poll')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(locked),
  );

  const slotRows = [];
  for (let index = 0; index < poll.slots.length; index += 5) {
    const row = new ActionRowBuilder();
    const rowSlots = poll.slots.slice(index, index + 5);

    for (const slot of rowSlots) {
      const count = currentCounts[slot.index];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`schedpoll:${poll.id}:page:${currentPageIndex}:slot:${slot.index}`)
          .setLabel(`${slot.label} (${count})`)
          .setStyle(buttonStyleForCount(count, maxCurrentCount)),
      );
    }

    if (locked) {
      row.components.forEach(component => component.setDisabled(true));
    }

    slotRows.push(row);
  }

  return [navRow, ...slotRows];
}

async function savePoll(poll) {
  const data = await readData();
  data.polls[poll.id] = poll;
  await writeData(data);
}

async function getPoll(pollId) {
  const data = await readData();
  return data.polls?.[pollId] ?? null;
}

async function updatePoll(poll) {
  const data = await readData();
  data.polls[poll.id] = poll;
  await writeData(data);
}

function parseScheduleButtonCustomId(customId) {
  const parts = customId.split(':');
  if (parts.length !== 6 || parts[0] !== 'schedpoll' || parts[2] !== 'page') {
    return null;
  }

  const pageIndex = Number(parts[3]);
  const action = parts[4];
  const target = parts[5];

  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return null;
  }

  if (action !== 'nav' && action !== 'slot' && action !== 'close') {
    return null;
  }

  if (action === 'nav' && target !== 'prev' && target !== 'next') {
    return null;
  }

  if (action === 'close' && target !== 'close') {
    return null;
  }

  const slotIndex = action === 'slot' ? Number(target) : null;
  if (action === 'slot' && (!Number.isInteger(slotIndex) || slotIndex < 0)) {
    return null;
  }

  return { pollId: parts[1], pageIndex, action, target, slotIndex };
}

export const allowedRoleEnv = ['DESPERADO_ROLE_IDS', 'PROPRIETROR_ROLE_IDS'];

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Create a shared availability poll in Eastern time.')
  .addStringOption(option => option.setName('title').setDescription('Poll title').setRequired(false))
  .addStringOption(option => option.setName('start-date').setDescription('Start date in YYYY-MM-DD').setRequired(false))
  .addIntegerOption(option => option.setName('days').setDescription(`Number of days to include, up to ${MAX_DAYS}`).setMinValue(1).setMaxValue(MAX_DAYS).setRequired(false))
  .addIntegerOption(option => option.setName('start-hour').setDescription('Start hour in 24-hour time').setMinValue(0).setMaxValue(23).setRequired(false))
  .addIntegerOption(option => option.setName('end-hour').setDescription('End hour in 24-hour time').setMinValue(1).setMaxValue(24).setRequired(false))
  .addIntegerOption(option => option.setName('slot-minutes').setDescription('Size of each availability slot in minutes').setMinValue(15).setMaxValue(180).setRequired(false));

export async function execute(interaction) {
  if (!memberHasAllowedRole(interaction)) {
    await interaction.reply({ content: 'You do not have permission to create scheduling polls.', ephemeral: true });
    return;
  }

  let config;
  try {
    config = getScheduleConfig(interaction);
  } catch (error) {
    await interaction.reply({ content: error.message, ephemeral: true });
    return;
  }

  const poll = {
    id: randomUUID(),
    title: config.title,
    createdBy: interaction.user.id,
    createdAt: new Date().toISOString(),
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: null,
    timeZone: TIME_ZONE,
    timeZoneLabel: TIME_ZONE_LABEL,
    startDateKey: config.startDateKey,
    days: config.days,
    startHour: config.startHour,
    endHour: config.endHour,
    slotMinutes: config.slotMinutes,
    slots: config.slots,
    dateKeys: config.dateKeys,
    currentPageIndex: 0,
    wrapsMidnight: config.wrapsMidnight,
    responses: {},
  };

  const message = await interaction.reply({ embeds: [buildPollEmbed(poll)], components: buildPollComponents(poll), fetchReply: true });
  poll.messageId = message.id;
  await savePoll(poll);
}

export async function handleButtonInteraction(interaction) {
  const parsed = parseScheduleButtonCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const poll = await getPoll(parsed.pollId);
  if (!poll) {
    await interaction.reply({ content: 'That scheduling poll is no longer available.', ephemeral: true });
    return true;
  }

  if (interaction.message?.id && poll.messageId && interaction.message.id !== poll.messageId) {
    await interaction.reply({ content: 'That scheduling poll is stale. Please use the latest message.', ephemeral: true });
    return true;
  }

  if (poll.closed && parsed.action !== 'close') {
    await interaction.reply({ content: 'That scheduling poll is closed.', ephemeral: true });
    return true;
  }

  const pageIndex = Math.max(0, Math.min(parsed.pageIndex, poll.dateKeys.length - 1));
  poll.currentPageIndex = pageIndex;

  const dateKey = poll.dateKeys[pageIndex];
  if (!dateKey) {
    await interaction.reply({ content: 'That scheduling poll page is no longer valid.', ephemeral: true });
    return true;
  }

  if (!poll.responses[interaction.user.id]) {
    poll.responses[interaction.user.id] = {};
  }

  if (parsed.action === 'nav') {
    poll.currentPageIndex = parsed.target === 'prev' ? Math.max(0, pageIndex - 1) : Math.min(poll.dateKeys.length - 1, pageIndex + 1);
    await updatePoll(poll);
    await interaction.update({ embeds: [buildPollEmbed(poll)], components: buildPollComponents(poll) });
    return true;
  }

  if (parsed.action === 'close') {
    if (interaction.user.id !== poll.createdBy && !memberHasAllowedRole(interaction)) {
      await interaction.reply({ content: 'Only the creator or an allowed role can close this poll.', ephemeral: true });
      return true;
    }

    poll.closed = true;
    await updatePoll(poll);
    await interaction.update({ embeds: [buildPollEmbed(poll)], components: buildPollComponents(poll) });
    return true;
  }

  const slotIndex = parsed.slotIndex;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= poll.slots.length) {
    await interaction.reply({ content: 'That availability slot is no longer valid.', ephemeral: true });
    return true;
  }

  const currentSelections = Array.isArray(poll.responses[interaction.user.id][dateKey])
    ? [...poll.responses[interaction.user.id][dateKey]]
    : [];

  const selectionIndex = currentSelections.indexOf(slotIndex);
  let actionMessage;
  if (selectionIndex >= 0) {
    currentSelections.splice(selectionIndex, 1);
    actionMessage = `Removed ${poll.slots[slotIndex].label} for ${formatDateLabel(dateKey)}.`;
  } else {
    currentSelections.push(slotIndex);
    actionMessage = `Added ${poll.slots[slotIndex].label} for ${formatDateLabel(dateKey)}.`;
  }

  currentSelections.sort((left, right) => left - right);
  poll.responses[interaction.user.id][dateKey] = currentSelections;

  await updatePoll(poll);
  await interaction.update({ embeds: [buildPollEmbed(poll)], components: buildPollComponents(poll) });
  await interaction.followUp({ content: actionMessage, ephemeral: true }).catch(() => {});
  return true;
}