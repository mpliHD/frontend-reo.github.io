// CONFIGURAÇÃO DO BUILD
// Valores que mudam conforme onde o site roda. Vêm das variáveis VITE_* do
// build (ver README). Atenção: tudo que tem prefixo VITE_ vai parar no
// JavaScript público, então aqui só entra endereço, nunca segredo.

// URL do backend. No site publicado fica vazia enquanto a API não tiver
// endereço público; em desenvolvimento o padrão é a API local (porta 4000).
export const API_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "")
).replace(/\/$/, "");

// MODO DEMONSTRAÇÃO
// Sem API configurada, o site continua funcionando com os dados fictícios
// (mock) e mostra uma faixa avisando. VITE_MODO_DEMO=true força o modo
// mesmo com API (útil para apresentar o protótipo sem subir o backend).
export const MODO_DEMO = !API_URL || import.meta.env.VITE_MODO_DEMO === "true";
