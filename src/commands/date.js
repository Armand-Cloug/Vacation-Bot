import { SlashCommandBuilder } from "discord.js";
import { createBoardMessageState, renderComponents, renderEmbed } from "../utils/board.js";

export const data = new SlashCommandBuilder()
  .setName("date")
  .setDescription("Proposer des dates pour partir en vacances (hors vacances scolaires de préférence) !");

export async function execute(interaction) {
  const title = "Date de vacances !";
  const description = "Proposer des dates pour partir en vacances, de préférence en dehors des vacances scolaires !";

  await interaction.reply({ content: "\u200B" });
  const msg = await interaction.fetchReply();

  const state = createBoardMessageState(msg.id, "date", title, description);
  await msg.edit({
    embeds: [renderEmbed(state, interaction.client)],
    components: renderComponents(state, msg.id)
  });
}
