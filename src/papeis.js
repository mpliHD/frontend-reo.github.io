// PAPÉIS DE ACESSO (RBAC)
// Os mesmos 5 papéis da API, com o valor que trafega no JSON (`role`) e o
// rótulo mostrado na tela. A API é quem decide o que cada papel pode fazer;
// aqui só usamos isso para não mostrar abas que dariam 403.

export const PAPEIS = [
  { valor: "operador", rotulo: "Operador" },
  { valor: "tecnico", rotulo: "Técnico" },
  { valor: "especialista", rotulo: "Especialista" },
  { valor: "supervisor", rotulo: "Supervisor" },
  { valor: "admin", rotulo: "Admin" },
];

export function rotuloPapel(valor) {
  return PAPEIS.find((p) => p.valor === valor)?.rotulo ?? valor;
}

// Abas restritas: papéis que podem abrir cada uma, além do admin. Espelha o
// require_roles das rotas que a aba usa (/indicadores e GET /usuarios aceitam
// supervisor e admin; /logs, só admin). Aba fora daqui: todos os papéis logados.
const ABAS_RESTRITAS = {
  dashboard: ["supervisor"],
  logs: [], // auditoria: só admin (decisão de 2026-11-20)
  usuarios: ["supervisor"],
};

// Condição: admin vê tudo (na API ele passa em qualquer require_roles).
export function podeVerAba(aba, papel) {
  if (papel === "admin") return true;
  const permitidos = ABAS_RESTRITAS[aba];
  return !permitidos || permitidos.includes(papel);
}

// Quem pode escrever em cada catálogo (o resto só consulta). Espelha
// SPECIES_ROLES e MANAGEMENT_ROLES de app/core/permissions.py da API.
export const podeEditarEspecies = (papel) => papel === "admin" || papel === "especialista";
export const podeEditarLocais = (papel) => papel === "admin" || papel === "supervisor";

// Registro de dados de campo (cadastrar dormente, movimentar, ocorrência):
// FIELD_ROLES da API. Supervisor só lê. Inspeção e mudança manual de status:
// INSPECTION_ROLES. Trocar a espécie de um dormente: SPECIES_ROLES.
export const podeRegistrarCampo = (papel) => ["admin", "operador", "tecnico", "especialista"].includes(papel);
export const podeInspecionar = (papel) => ["admin", "tecnico", "especialista"].includes(papel);
export const podeAlterarEspecieDormente = podeEditarEspecies;

// Converte o usuário da API ({name, registration, role, ...}) para os nomes
// usados nas telas do site.
export function usuarioDaApi(u) {
  return { id: u.id, nome: u.name, matricula: u.registration, email: u.email, papel: u.role };
}
