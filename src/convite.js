// LINK DE CONVITE
// A API gera links no formato <INVITE_BASE_URL>/convite/<token>. Como o site
// é estático (GitHub Pages, sem rota no servidor), a base termina em "#":
// https://mplihd.github.io/frontend-reo.github.io/#/convite/<token>.
// O token é um JWT assinado pela API. Aqui só LEMOS o conteúdo para mostrar
// nome, e-mail e papel na tela; quem confere a assinatura e a validade é a
// API, em POST /auth/convite/aceitar.

// "#/convite/abc.def.ghi" → "abc.def.ghi" (ou null se não for um convite).
export function tokenDoHash(hash) {
  const m = /^#\/convite\/([^/?#]+)/.exec(hash || "");
  return m ? decodeURIComponent(m[1]) : null;
}

// Conteúdo do convite para exibir, ou null se o token estiver malformado.
export function lerConvite(token) {
  try {
    const parte = token.split(".")[1];
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
    // atob devolve bytes; TextDecoder recupera os acentos (UTF-8) do nome.
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    return {
      email: p.sub ?? "",
      nome: p.name ?? "",
      papel: p.role ?? "",
      matricula: p.registration ?? null,
      expiraEm: p.exp ? new Date(p.exp * 1000) : null,
    };
  } catch {
    return null;
  }
}
