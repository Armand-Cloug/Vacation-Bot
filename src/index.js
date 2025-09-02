import "dotenv/config";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import { log, error } from "./utils/logger.js";
import { stateStore } from "./utils/store.js";
import {
  addProposalFromModal,
  buildModal,
  paginate,
  renderComponents,
  renderEmbed,
  toggleVotes
} from "./utils/board.js";

import * as cmdVac from "./commands/vacance.js";
import * as cmdFr from "./commands/lieux-fr.js";
import * as cmdOut from "./commands/lieux-out.js";
import * as cmdDate from "./commands/date.js";
import * as cmdReboot from "./commands/reboot.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
[cmdVac, cmdFr, cmdOut, cmdDate, cmdReboot].forEach((c) => client.commands.set(c.data.name, c));

client.once(Events.ClientReady, (c) => {
  log(`Connecté en tant que ${c.user.tag}`);
});

// Slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // Buttons & Selects (message components)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const [prefix, action, messageId] = parseCustomId(interaction.customId, interaction.message?.id);
      if (!prefix) return;

      const state = stateStore.get(interaction.message.id);
      if (!state) {
        // Si perdu (ex: reboot), message d’info
        await interaction.reply({ content: "⚠️ État introuvable (le bot a peut-être redémarré).", ephemeral: true });
        return;
      }

      // ADD: ouvrir modal
      if (action === "add") {
        const modal = buildModal(state.kind, interaction.message.id);
        await interaction.showModal(modal);
        return;
      }

      // VOTE: toggle votes, update embed
      if (action === "vote" && interaction.isStringSelectMenu()) {
        const userId = interaction.user.id;
        const ids = (interaction.values || []).filter(v => v !== "none"); // <--- ignore "none"
        if (ids.length > 0) {
          toggleVotes(state, userId, ids);
        }
        await interaction.deferUpdate();
        await interaction.followUp({ content: "✅ Pris en compte", ephemeral: true });
        await interaction.message.edit({
          embeds: [renderEmbed(state, interaction.client)],
          components: renderComponents(state, interaction.message.id)
        });
        return;
      }

      // Pagination
      if ((action === "prev" || action === "next") && interaction.isButton()) {
        paginate(state, action);
        await interaction.deferUpdate();
        await interaction.message.edit({
          embeds: [renderEmbed(state, interaction.client)],
          components: renderComponents(state, interaction.message.id)
        });
        return;
      }
    }

    // Modal submit
    if (interaction.isModalSubmit()) {
      const [prefix, action, messageId] = parseCustomId(interaction.customId);
      if (!prefix || action !== "modal" || !messageId) return;
      const state = stateStore.get(messageId);
      if (!state) {
        await interaction.reply({ content: "⚠️ État introuvable (le bot a peut-être redémarré).", ephemeral: true });
        return;
      }

      try {
        const proposal = addProposalFromModal(state.kind, interaction.fields);
        // Ajout
        state.proposals.push({
          id: "p_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36),
          label: proposal.label,
          meta: proposal.meta || {},
          voters: new Set(),
          createdAt: Date.now()
        });

        await interaction.reply({ content: "✅ Pris en compte", ephemeral: true });

        // Rafraîchir le message
        const msg = await interaction.channel.messages.fetch(messageId);
        await msg.edit({
          embeds: [renderEmbed(state, interaction.client)],
          components: renderComponents(state, messageId)
        });
      } catch (e) {
        await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
      }
      return;
    }
  } catch (e) {
    error(e);
  }
});

client.login(TOKEN);

// ---------- Utils ----------
function parseCustomId(customId, fallbackMsgId) {
  // Exemples: "vac:add|123", "fr:vote|456", "date:modal|789", "out:prev|321"
  const [head, tail] = customId.split("|");
  const [prefix, action] = head.split(":");
  return [prefix, action, tail || fallbackMsgId || null];
}
