// Stockage en mémoire par messageId
export const stateStore = new Map();
/*
state[messageId] = {
  kind: "vac" | "fr" | "out" | "date",
  title: string,
  description: string,
  proposals: [
    { id, label, meta, voters: Set<userId>, createdAt }
  ],
  page: 0,
  perPage: 25
}
*/
