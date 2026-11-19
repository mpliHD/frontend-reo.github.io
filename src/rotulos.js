// RÓTULOS DOS ENUMS DA API
// A API manda valores estáveis em inglês (ex.: "in_stock"); a tela mostra o
// texto em português e o tom do selo. Valor desconhecido aparece cru, para
// não sumir com um dado novo que a API passe a mandar.

export const STATUS_DORMENTE = {
  in_stock: { rotulo: "Em estoque", tom: "ok" },
  withdrawn: { rotulo: "Retirado", tom: "info" },
  in_track: { rotulo: "Na via", tom: "neutro" },
  quarantine: { rotulo: "Quarentena", tom: "warn" },
  discarded: { rotulo: "Descartado", tom: "danger" },
};

export const TIPO_MOVIMENTO = {
  entry: "Entrada",
  withdrawal: "Retirada",
  transfer: "Transferência",
};

export const TIPO_OCORRENCIA = {
  damage: "Dano",
  loss: "Perda",
  misplaced: "Fora do lugar",
  other: "Outra",
};

export const RESULTADO_INSPECAO = {
  approved: { rotulo: "Aprovada", tom: "ok" },
  rejected: { rotulo: "Reprovada", tom: "danger" },
};

export const CONSERVACAO = { good: "Bom", fair: "Regular", poor: "Ruim" };
export const UMIDADE = { dry: "Seco", moist: "Úmido", wet: "Molhado" };
export const TIPO_LOCAL = { warehouse: "Pátio / armazém", street: "Rua" };

// Entidades que aparecem em /logs (campo `entity`).
export const ENTIDADE_LOG = {
  sleeper: "Dormente",
  movement: "Movimentação",
  inspection: "Inspeção",
  occurrence: "Ocorrência",
  inventory_count: "Inventário",
  location: "Local",
  wood_species: "Espécie",
  user: "Usuário",
  sync_batch: "Sincronização",
};

export const ACAO_LOG = {
  create: "Criação",
  update: "Alteração",
  change_role: "Troca de papel",
  invite: "Convite",
  invite_accept: "Aceite de convite",
  inspection: "Inspeção",
  sync: "Sincronização",
};

export function rotulo(mapa, valor) {
  const item = mapa[valor];
  if (item === undefined) return valor ?? "";
  return typeof item === "string" ? item : item.rotulo;
}

export function tomStatus(valor) {
  return STATUS_DORMENTE[valor]?.tom ?? "neutro";
}

// true/false/null → "Sim"/"Não"/"" (null = não informado).
export function simNao(v) {
  if (v === null || v === undefined) return "";
  return v ? "Sim" : "Não";
}

// 92 → "1 min 32s" (tempo de inspeção).
export function duracao(segundos) {
  if (segundos === null || segundos === undefined) return "";
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return m ? `${m} min ${s}s` : `${s}s`;
}

// Nome de exibição de uma espécie (resumo da API): nome popular, senão o científico.
export function nomeEspecie(especie) {
  if (!especie) return "";
  const nome = especie.common_name || especie.scientific_name || "";
  return especie.code ? `${especie.code} · ${nome}` : nome;
}

// Nome de um local com o pátio na frente quando é rua ("TG – Três Guri › Rua 08").
// `porId` é um Map id → local, usado para achar o pai.
export function nomeLocal(local, porId) {
  if (!local) return "";
  const pai = local.parent_id ? porId?.get(local.parent_id) : null;
  return pai ? `${pai.name} › ${local.name}` : local.name;
}

// "2026-10-21T18:30:00Z" → Date (ou null). Datas da API sempre vêm em UTC;
// o navegador converte para o fuso local na hora de mostrar.
export function data(iso) {
  return iso ? new Date(iso) : null;
}

// "2026-10-21" (input type=date, dia no fuso do navegador) → início desse dia
// em ISO/UTC, para os filtros ?de=&ate= da API. `somarDias` = 1 transforma o
// "até" inclusivo da tela no `ate` exclusivo da API.
export function inicioDoDia(texto, somarDias = 0) {
  if (!texto) return "";
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d + somarDias).toISOString();
}
