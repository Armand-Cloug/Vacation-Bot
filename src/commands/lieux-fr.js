import { SlashCommandBuilder } from "discord.js";
import { createBoardMessageState, renderComponents, renderEmbed } from "../utils/board.js";

export const data = new SlashCommandBuilder()
  .setName("lieux-fr")
  .setDescription("Proposer des lieux de vacances en France !");

export async function execute(interaction) {
  const title = "Lieux de vacances en France !";
  const description = "Proposer des villes ou régions où partir en vacances !";

  await interaction.reply({ content: "\u200B" });
  const msg = await interaction.fetchReply();

  const state = createBoardMessageState(msg.id, "fr", title, description);
  await msg.edit({
    embeds: [renderEmbed(state, interaction.client)],
    components: renderComponents(state, msg.id)
  });
}
