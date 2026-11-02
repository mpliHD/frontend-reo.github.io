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

// Abas que exigem papel de gestão. Espelha o require_roles das rotas que cada
// aba usa (/indicadores, /logs e GET /usuarios aceitam só supervisor e admin).
// Aba que não está aqui é liberada para todos os papéis logados.
const ABAS_RESTRITAS = {
  dashboard: ["supervisor"],
  logs: ["supervisor"],
  usuarios: ["supervisor"],
};

// Condição: admin vê tudo (na API ele passa em qualquer require_roles).
export function podeVerAba(aba, papel) {
  if (papel === "admin") return true;
  const permitidos = ABAS_RESTRITAS[aba];
  return !permitidos || permitidos.includes(papel);
}

// Converte o usuário da API ({name, registration, role, ...}) para os nomes
// usados nas telas do site.
export function usuarioDaApi(u) {
  return { id: u.id, nome: u.name, matricula: u.registration, email: u.email, papel: u.role };
}
