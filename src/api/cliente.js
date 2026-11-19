// CLIENTE DA API REO
// Único ponto do site que faz `fetch` para o backend. Cuida de:
// - montar a URL (baseUrl + caminho + ?filtros), sem prefixo, como no contrato;
// - mandar o `Authorization: Bearer <access_token>` da sessão;
// - quando a API responde 401 com code "token_expired", renovar os tokens em
//   POST /auth/refresh e repetir a chamada UMA vez (o access vale 15 min);
// - transformar qualquer erro no formato da API {detail, code} em ErroApi,
//   para as telas decidirem pelo `code` (estável) e mostrarem o `detail`.
// Não depende do Vite nem do React, por isso dá para testar com Node puro.

// Erro de qualquer chamada. `status` 0 = não chegou resposta (rede/CORS);
// nesse caso o `code` é "network_error", que é só do site (a API não usa).
export class ErroApi extends Error {
  constructor(status, code, detail, errors = null) {
    super(detail);
    this.name = "ErroApi";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors; // no 422: [{loc, msg, type}] com os campos inválidos
  }
}

// Códigos de 401 que significam "esta sessão não serve mais": limpa os tokens
// e avisa o app para voltar ao login. "invalid_credentials" fica de fora
// porque é o login errado, não uma sessão perdida.
const SESSAO_INVALIDA = new Set(["unauthorized", "invalid_token", "token_expired", "inactive_user"]);

// Limite da API para `limit` nas listagens paginadas.
const LIMITE_MAXIMO = 200;

function montarUrl(baseUrl, caminho, consulta) {
  const url = `${baseUrl}${caminho}`;
  if (!consulta) return url;
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(consulta)) {
    // Filtro vazio não vai na URL (a API trataria "" como valor inválido).
    if (valor === undefined || valor === null || valor === "") continue;
    params.append(chave, valor instanceof Date ? valor.toISOString() : String(valor));
  }
  const texto = params.toString();
  return texto ? `${url}?${texto}` : url;
}

// sessao: { ler, salvar, limpar } — ver api/sessao.js.
// fetchImpl: injetável para testes; no navegador é o fetch global.
export function criarClienteApi({ baseUrl, sessao, fetchImpl = (...a) => fetch(...a) }) {
  const ouvintesSessaoPerdida = new Set();
  let renovacaoEmAndamento = null;

  function perderSessao() {
    sessao.limpar();
    for (const fn of ouvintesSessaoPerdida) fn();
  }

  async function enviar(metodo, caminho, { corpo, consulta, autenticar = true } = {}) {
    const headers = { Accept: "application/json" };
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    const atual = autenticar ? sessao.ler() : null;
    if (atual?.access_token) headers.Authorization = `Bearer ${atual.access_token}`;

    let resposta;
    try {
      resposta = await fetchImpl(montarUrl(baseUrl, caminho, consulta), {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroApi(0, "network_error", "Não foi possível falar com a API. Verifique a conexão.");
    }

    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);
    // Condição: fetch NÃO lança erro em 4xx/5xx, então é aqui que um 401/422
    // vira exceção (antes o site tratava qualquer resposta como sucesso).
    if (!resposta.ok) {
      throw new ErroApi(
        resposta.status,
        dados?.code || "http_error",
        dados?.detail || `A API respondeu com erro ${resposta.status}.`,
        dados?.errors || null,
      );
    }
    return dados;
  }

  // Várias chamadas podem expirar juntas; todas esperam a MESMA renovação,
  // senão cada uma gastaria o refresh token e as outras falhariam.
  function renovarTokens() {
    if (!renovacaoEmAndamento) {
      const refresh = sessao.ler()?.refresh_token;
      renovacaoEmAndamento = (refresh
        ? enviar("POST", "/auth/refresh", { corpo: { refresh_token: refresh }, autenticar: false })
        : Promise.reject(new ErroApi(401, "unauthorized", "Sessão encerrada. Entre novamente."))
      )
        .then((tokens) => {
          sessao.salvar(tokens);
          return tokens;
        })
        .finally(() => {
          renovacaoEmAndamento = null;
        });
    }
    return renovacaoEmAndamento;
  }

  async function requisitar(metodo, caminho, opcoes = {}) {
    try {
      return await enviar(metodo, caminho, opcoes);
    } catch (erro) {
      const autenticada = opcoes.autenticar !== false;
      if (!(erro instanceof ErroApi) || erro.status !== 401 || !autenticada) throw erro;
      if (erro.code === "token_expired") {
        try {
          await renovarTokens();
        } catch {
          perderSessao(); // o refresh também venceu: volta para o login
          throw erro;
        }
        return enviar(metodo, caminho, opcoes);
      }
      if (SESSAO_INVALIDA.has(erro.code)) perderSessao();
      throw erro;
    }
  }

  return {
    get: (caminho, consulta) => requisitar("GET", caminho, { consulta }),
    post: (caminho, corpo) => requisitar("POST", caminho, { corpo }),
    patch: (caminho, corpo) => requisitar("PATCH", caminho, { corpo }),

    // Login com matrícula OU e-mail. Guarda os tokens e devolve o usuário.
    async entrar(login, senha) {
      const tokens = await enviar("POST", "/auth/login", {
        corpo: { login, password: senha },
        autenticar: false,
      });
      sessao.salvar(tokens);
      return tokens.user;
    },

    // Aceite do convite: cria a conta e já devolve os tokens (entra direto).
    // `matricula` só é enviada quando o convite não trouxe uma.
    async aceitarConvite(token, senha, matricula) {
      const tokens = await enviar("POST", "/auth/convite/aceitar", {
        corpo: { token, password: senha, ...(matricula ? { registration: matricula } : {}) },
        autenticar: false,
      });
      sessao.salvar(tokens);
      return tokens.user;
    },

    // A API não tem rota de logout: os tokens expiram sozinhos, basta esquecê-los.
    sair() {
      sessao.limpar();
    },

    estaLogado: () => Boolean(sessao.ler()?.access_token),

    // Percorre todas as páginas de uma listagem ({items, total, limit, offset})
    // e devolve um array único. Usado onde a tela precisa de tudo de uma vez,
    // como na exportação para Excel. `maximo` é uma trava contra baixar demais.
    async listarTudo(caminho, consulta = {}, { maximo = 10000 } = {}) {
      const itens = [];
      for (let offset = 0; offset < maximo; offset += LIMITE_MAXIMO) {
        const pagina = await requisitar("GET", caminho, {
          consulta: { ...consulta, limit: LIMITE_MAXIMO, offset },
        });
        itens.push(...pagina.items);
        if (itens.length >= pagina.total || pagina.items.length === 0) break;
      }
      return itens.slice(0, maximo);
    },

    // Avisa quando a sessão cai (token inválido ou refresh vencido), para o app
    // voltar à tela de login. Devolve a função que cancela o aviso.
    aoPerderSessao(fn) {
      ouvintesSessaoPerdida.add(fn);
      return () => ouvintesSessaoPerdida.delete(fn);
    },
  };
}
