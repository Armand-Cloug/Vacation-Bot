import { SlashCommandBuilder } from "discord.js";
import { createBoardMessageState, renderComponents, renderEmbed } from "../utils/board.js";

export const data = new SlashCommandBuilder()
  .setName("vacance")
  .setDescription("Proposer des organisations pour les vacances !");

export async function execute(interaction) {
  const title = "Vacances !";
  const description = "Proposer des organisations pour les vacances !";

  // 1) envoyer un message non-vide
  await interaction.reply({ content: "\u200B" });   // plus de fetchReply ici
  // 2) récupérer le message
  const msg = await interaction.fetchReply();

  // 3) créer l'état et éditer
  const state = createBoardMessageState(msg.id, "vac", title, description);
  await msg.edit({
    embeds: [renderEmbed(state, interaction.client)],
    components: renderComponents(state, msg.id)
  });
}

