import { SlashCommandBuilder } from "discord.js";
import { createBoardMessageState, renderComponents, renderEmbed } from "../utils/board.js";

export const data = new SlashCommandBuilder()
  .setName("lieux-out")
  .setDescription("Proposer des lieux de vacances à l'étranger !");

export async function execute(interaction) {
  const title = "Lieux de vacances à l'étranger !";
  const description = "Proposer des pays, villes ou régions où partir à l'étranger !";

  await interaction.reply({ content: "\u200B" });
  const msg = await interaction.fetchReply();

  const state = createBoardMessageState(msg.id, "out", title, description);
  await msg.edit({
    embeds: [renderEmbed(state, interaction.client)],
    components: renderComponents(state, msg.id)
  });
}
