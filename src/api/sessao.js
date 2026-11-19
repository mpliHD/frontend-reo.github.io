// SESSÃO DE LOGIN (TOKENS)
// Guarda a resposta do login da API (access token, refresh token, validades e
// o usuário) no sessionStorage: sobrevive ao F5, mas some ao fechar a aba.
// Escolhemos isso em vez do localStorage para não deixar o refresh token
// (válido por 7 dias) parado no navegador depois que a pessoa sai.
// Todo acesso fica em try/catch porque o navegador pode bloquear o storage
// (janela anônima, site data bloqueado); nesse caso a sessão vive só até o F5.

const CHAVE = "reo.sessao";
let emMemoria = null;

export function lerSessao() {
  try {
    const texto = sessionStorage.getItem(CHAVE);
    if (texto) return JSON.parse(texto);
  } catch {
    // storage indisponível ou conteúdo corrompido: usa a cópia em memória
  }
  return emMemoria;
}

export function salvarSessao(sessao) {
  emMemoria = sessao;
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // sem storage: fica só em memória
  }
}

export function limparSessao() {
  emMemoria = null;
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // nada a limpar
  }
}
