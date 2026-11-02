// Instância única do cliente, usada por todas as telas. Em modo demonstração
// ela existe, mas as telas não a chamam (usam os dados fictícios).
import { API_URL } from "../config.js";
import { criarClienteApi } from "./cliente.js";
import { lerSessao, salvarSessao, limparSessao } from "./sessao.js";

export { ErroApi } from "./cliente.js";

export const api = criarClienteApi({
  baseUrl: API_URL,
  sessao: { ler: lerSessao, salvar: salvarSessao, limpar: limparSessao },
});
