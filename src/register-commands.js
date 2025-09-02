import "dotenv/config";
import { REST, Routes } from "discord.js";
import { log, error } from "./utils/logger.js";

import { data as cVac } from "./commands/vacance.js";
import { data as cFr } from "./commands/lieux-fr.js";
import { data as cOut } from "./commands/lieux-out.js";
import { data as cDate } from "./commands/date.js";
import { data as cReboot } from "./commands/reboot.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optionnel : en dev, c'est instantané

if (!TOKEN || !CLIENT_ID) {
  error("DISCORD_TOKEN ou CLIENT_ID manquant dans .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(TOKEN);
const commands = [cVac, cFr, cOut, cDate, cReboot].map(c => c.toJSON());

try {
  if (GUILD_ID) {
    log(`Enregistrement des commandes (guild ${GUILD_ID})…`);
    const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    log(`Commandes guild enregistrées (${data.length}) ✅`);
  } else {
    log("Enregistrement des commandes globales…");
    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    log(`Commandes globales enregistrées (${data.length}) ✅`);
  }
} catch (e) {
  error("Echec d'enregistrement des commandes:", e);
  process.exit(1);
}
