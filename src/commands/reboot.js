import { SlashCommandBuilder } from "discord.js";
import { exec } from "node:child_process";

const STAFF_ROLE = (process.env.STAFF_ROLE || "").trim();
const PM2_NAME = (process.env.PM2_PROCESS_NAME || "").trim();

function hasStaffRole(interaction) {
  if (!interaction.inGuild()) return false;
  const memberRoles = interaction.member?.roles;
  if (!memberRoles) return false;

  // Essai par ID direct
  if (STAFF_ROLE && memberRoles.cache?.has(STAFF_ROLE)) return true;

  // Essai par nom exact si STAFF_ROLE est un nom
  const byName = interaction.guild.roles.cache.find(r => r.name === STAFF_ROLE);
  return byName ? memberRoles.cache?.has(byName.id) : false;
}

export const data = new SlashCommandBuilder()
  .setName("reboot")
  .setDescription("Redémarre le bot via PM2 (réservé au staff)");

export async function execute(interaction) {
  if (!STAFF_ROLE) return interaction.reply({ content: "⚠️ `STAFF_ROLE` manquant dans .env.", ephemeral: true });
  if (!PM2_NAME) return interaction.reply({ content: "⚠️ `PM2_PROCESS_NAME` manquant dans .env.", ephemeral: true });
  if (!hasStaffRole(interaction)) {
    return interaction.reply({ content: "⛔ Tu n'as pas le rôle requis.", ephemeral: true });
  }

  await interaction.reply({ content: `♻️ Redémarrage du process PM2 \`${PM2_NAME}\`…`, ephemeral: true });
  setTimeout(() => {
    exec(`pm2 restart ${PM2_NAME}`, () => {});
  }, 800);
}
