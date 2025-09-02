import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { stateStore } from "./store.js";

// ---------- Helpers ----------
const COLOR = 0x3498DB;

const sanitize = (s, max = 200) => (s || "").trim().replace(/\s+/g, " ").slice(0, max);

const uid = () => "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const sortProposals = (arr) =>
  [...arr].sort((a, b) => {
    const dv = (b.voters?.size || 0) - (a.voters?.size || 0);
    if (dv !== 0) return dv;
    return a.createdAt - b.createdAt;
  });

const formatLine = (p) => `• ${p.label} — ${p.voters.size} vote(s)`;

// ---------- Date parsing ----------
function parseDateFR(s) {
  // "JJ/MM/AAAA au JJ/MM/AAAA"
  const re = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*au\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/i;
  const m = s.match(re);
  if (!m) return { ok: false, reason: "Format attendu : JJ/MM/AAAA au JJ/MM/AAAA" };
  const [ , d1, m1, y1, d2, m2, y2 ] = m.map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  if (a.getFullYear() !== y1 || a.getMonth() !== m1 - 1 || a.getDate() !== d1)
    return { ok: false, reason: "Date de début invalide." };
  if (b.getFullYear() !== y2 || b.getMonth() !== m2 - 1 || b.getDate() !== d2)
    return { ok: false, reason: "Date de fin invalide." };
  if (a > b) return { ok: false, reason: "La date de début doit être avant la date de fin." };
  const days = Math.round((b - a) / 86400000) + 1;
  if (days > 31) return { ok: false, reason: "La plage doit faire 31 jours maximum." };
  const label = `${String(d1).padStart(2,"0")}/${String(m1).padStart(2,"0")}/${y1} au ${String(d2).padStart(2,"0")}/${String(m2).padStart(2,"0")}/${y2}`;
  return { ok: true, a, b, days, label, meta: { start: a.toISOString(), end: b.toISOString(), days } };
}

// ---------- State constructors ----------
export function newState(kind, title, description) {
  return { kind, title, description, proposals: [], page: 0, perPage: 25 };
}

// ---------- Rendering ----------
export function renderEmbed(state, client) {
  const avatar = client?.user?.displayAvatarURL() || null;
  const sorted = sortProposals(state.proposals);
  const pageCount = Math.max(1, Math.ceil(sorted.length / state.perPage));
  const page = Math.min(state.page, pageCount - 1);
  const start = page * state.perPage;
  const visible = sorted.slice(start, start + state.perPage);

  const desc = visible.length
    ? visible.map(formatLine).join("\n")
    : "Aucune proposition pour le moment.";

  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(state.title)
    .setDescription(`${state.description}\n\n${desc}`)
    .setTimestamp();

  if (avatar) {
    e.setAuthor({ name: state.title, iconURL: avatar });
    e.setThumbnail(avatar);
  }

  if (sorted.length > state.perPage) {
    e.setFooter({ text: `Page ${page + 1}/${pageCount}` });
  }

  return e;
}

export function renderComponents(state, messageId) {
  const prefix = state.kind;
  const sorted = sortProposals(state.proposals);
  const pageCount = Math.max(1, Math.ceil(sorted.length / state.perPage));
  const page = Math.min(state.page, pageCount - 1);
  const start = page * state.perPage;
  const visible = sorted.slice(start, start + state.perPage);

  // Bouton "Ajouter"
  const addBtn = new ButtonBuilder()
    .setCustomId(`${prefix}:add|${messageId}`)
    .setLabel("➕ Ajouter une proposition")
    .setStyle(ButtonStyle.Primary);
  const rowBtns = new ActionRowBuilder().addComponents(addBtn);

  // Pagination si besoin
  if (sorted.length > state.perPage) {
    const prev = new ButtonBuilder()
      .setCustomId(`${prefix}:prev|${messageId}`)
      .setLabel("⬅️")
      .setStyle(ButtonStyle.Secondary);
    const next = new ButtonBuilder()
      .setCustomId(`${prefix}:next|${messageId}`)
      .setLabel("➡️")
      .setStyle(ButtonStyle.Secondary);
    rowBtns.addComponents(prev, next);
  }

  // Select de vote
  let select = new StringSelectMenuBuilder()
    .setCustomId(`${prefix}:vote|${messageId}`)
    .setPlaceholder("Sélectionne une ou plusieurs propositions à voter");

  if (visible.length === 0) {
    // Aucun item : select désactivé avec une option factice
    select
      .setMinValues(1)            // Discord veut max ≥ 1 → mettons min/max = 1
      .setMaxValues(1)
      .addOptions([{ label: "Aucune proposition", value: "none" }])
      .setDisabled(true);
  } else {
    select
      .setMinValues(0)            // on autorise 0 → permet de ne rien (dé)sélectionner
      .setMaxValues(Math.min(visible.length, 25))
      .addOptions(
        visible.map((p) => ({
          label: optionLabel(state.kind, p),
          value: p.id
        }))
      );
  }

  const rowSelect = new ActionRowBuilder().addComponents(select);

  return [rowBtns, rowSelect];
}


function optionLabel(kind, p) {
  if (kind === "fr") return `${p.meta.lieu} (${p.meta.type})`;
  if (kind === "out") return `${p.meta.lieu} (${p.meta.transport})`;
  if (kind === "date") return p.label;
  return p.label; // vac
}

// ---------- Modals ----------
export function buildModal(kind, messageId) {
  const modal = new ModalBuilder().setCustomId(`${kind}:modal|${messageId}`);

  if (kind === "vac") {
    modal.setTitle("Ajouter une proposition (Vacances)");
    const t = new TextInputBuilder()
      .setCustomId("vac_text")
      .setLabel("Texte")
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(1)
      .setMaxLength(200)
      .setPlaceholder("Ex: On part dans le sud en juin et à l’étranger en mai.")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(t));
    return modal;
  }

  if (kind === "fr") {
    modal.setTitle("Ajouter un lieu (France)");
    const lieu = new TextInputBuilder().setCustomId("fr_lieu").setLabel("Lieu (ville/région)").setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(100).setRequired(true);
    const dist = new TextInputBuilder().setCustomId("fr_distance").setLabel("Distance depuis Niort (km)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("ex: 320");
    const type = new TextInputBuilder().setCustomId("fr_type").setLabel("Type (Mer|Océan|Montagne|Rien)").setStyle(TextInputStyle.Short).setRequired(true);
    const prix = new TextInputBuilder().setCustomId("fr_prix").setLabel("Prix (ex: €€ ou 500–800€)").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(lieu),
      new ActionRowBuilder().addComponents(dist),
      new ActionRowBuilder().addComponents(type),
      new ActionRowBuilder().addComponents(prix),
    );
    return modal;
  }

  if (kind === "out") {
    modal.setTitle("Ajouter un lieu (Étranger)");
    const lieu = new TextInputBuilder().setCustomId("out_lieu").setLabel("Lieu (pays/ville/région)").setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(100).setRequired(true);
    const trp = new TextInputBuilder().setCustomId("out_transport").setLabel("Transport (Avion|Voiture)").setStyle(TextInputStyle.Short).setRequired(true);
    const type = new TextInputBuilder().setCustomId("out_type").setLabel("Type (Mer|Océan|Montagne|Rien)").setStyle(TextInputStyle.Short).setRequired(true);
    const prix = new TextInputBuilder().setCustomId("out_prix").setLabel("Prix (ex: €€ ou 500–800€)").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(lieu),
      new ActionRowBuilder().addComponents(trp),
      new ActionRowBuilder().addComponents(type),
      new ActionRowBuilder().addComponents(prix),
    );
    return modal;
  }

  if (kind === "date") {
    modal.setTitle("Ajouter une plage de dates");
    const r = new TextInputBuilder()
      .setCustomId("date_range")
      .setLabel("JJ/MM/AAAA au JJ/MM/AAAA")
      .setStyle(TextInputStyle.Short)
      .setMinLength(10)
      .setMaxLength(50)
      .setValue("07/09/2025 au 13/09/2025")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(r));
    return modal;
  }

  return modal;
}

// ---------- Mutators ----------
export function createBoardMessageState(messageId, kind, title, description) {
  const s = newState(kind, title, description);
  stateStore.set(messageId, s);
  return s;
}

export function addProposalFromModal(kind, fields) {
  if (kind === "vac") {
    const text = sanitize(fields.getTextInputValue("vac_text"), 200);
    if (!text) throw new Error("Texte invalide.");
    return { label: text, meta: {} };
  }

  if (kind === "fr") {
    const lieu = sanitize(fields.getTextInputValue("fr_lieu"), 100);
    const distRaw = (fields.getTextInputValue("fr_distance") || "").trim();
    const type = sanitize(fields.getTextInputValue("fr_type"), 20);
    const prix = sanitize(fields.getTextInputValue("fr_prix"), 30);

    const dist = Number(distRaw);
    if (!lieu) throw new Error("Lieu invalide.");
    if (!Number.isFinite(dist) || dist < 0 || dist > 10000) throw new Error("Distance invalide (0–10000 km).");
    const okType = ["mer", "océan", "ocean", "montagne", "rien"].includes(type.toLowerCase());
    if (!okType) throw new Error("Type doit être Mer, Océan, Montagne ou Rien.");
    const normType = type.toLowerCase() === "ocean" ? "Océan" : type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

    return {
      label: `${lieu} — ${dist} km — ${normType} — ${prix}`,
      meta: { lieu, distance: dist, type: normType, prix }
    };
  }

  if (kind === "out") {
    const lieu = sanitize(fields.getTextInputValue("out_lieu"), 100);
    const trp = sanitize(fields.getTextInputValue("out_transport"), 10);
    const type = sanitize(fields.getTextInputValue("out_type"), 20);
    const prix = sanitize(fields.getTextInputValue("out_prix"), 30);

    const okTrp = ["avion", "voiture"].includes(trp.toLowerCase());
    if (!okTrp) throw new Error("Transport doit être Avion ou Voiture.");
    const okType = ["mer", "océan", "ocean", "montagne", "rien"].includes(type.toLowerCase());
    if (!okType) throw new Error("Type doit être Mer, Océan, Montagne ou Rien.");

    const normTrp = trp.charAt(0).toUpperCase() + trp.slice(1).toLowerCase();
    const normType = type.toLowerCase() === "ocean" ? "Océan" : type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

    return {
      label: `${lieu} — ${normTrp} — ${normType} — ${prix}`,
      meta: { lieu, transport: normTrp, type: normType, prix }
    };
  }

  if (kind === "date") {
    const raw = sanitize(fields.getTextInputValue("date_range"), 50);
    const p = parseDateFR(raw);
    if (!p.ok) throw new Error(p.reason);
    return { label: p.label, meta: p.meta };
  }

  throw new Error("Type inconnu.");
}

export function pushProposal(state, proposal) {
  state.proposals.push({
    id: uid(),
    label: proposal.label,
    meta: proposal.meta || {},
    voters: new Set(),
    createdAt: Date.now()
  });
}

export function toggleVotes(state, userId, proposalIds) {
  // toggle pour chaque proposition sélectionnée
  for (const pid of proposalIds) {
    const p = state.proposals.find(x => x.id === pid);
    if (!p) continue;
    if (p.voters.has(userId)) p.voters.delete(userId);
    else p.voters.add(userId);
  }
}

export function paginate(state, dir) {
  const total = Math.max(1, Math.ceil(state.proposals.length / state.perPage));
  if (total <= 1) return;
  if (dir === "prev") state.page = (state.page - 1 + total) % total;
  else state.page = (state.page + 1) % total;
}
