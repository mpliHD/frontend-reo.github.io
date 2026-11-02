// CATÁLOGOS EM CACHE
// Locais, espécies e usuários mudam pouco e várias telas precisam deles (filtros e
// nomes). Cada um é buscado uma vez por sessão e reaproveitado; a promessa
// fica guardada, então duas telas pedindo ao mesmo tempo fazem uma só chamada.
import { api } from "./index.js";

const cache = new Map();

function lembrar(chave, buscar) {
  if (!cache.has(chave)) {
    const promessa = buscar().catch((erro) => {
      cache.delete(chave); // falhou: a próxima tela tenta de novo
      throw erro;
    });
    cache.set(chave, promessa);
  }
  return cache.get(chave);
}

// Map id → local (inclui inativos, para nomear registros antigos).
export function carregarLocais() {
  return lembrar("locais", async () => new Map((await api.listarTudo("/locais")).map((l) => [l.id, l])));
}

export function carregarEspecies() {
  return lembrar("especies", async () => new Map((await api.listarTudo("/especies")).map((e) => [e.id, e])));
}

// Só supervisor e admin podem listar usuários; para os outros papéis a
// promessa rejeita com 403 e a tela simplesmente não mostra o nome.
export function carregarUsuarios() {
  return lembrar("usuarios", async () => new Map((await api.listarTudo("/usuarios")).map((u) => [u.id, u])));
}

// Dormentes por id, buscados sob demanda (a listagem de movimentações só
// traz o sleeper_id). Muitos ids de uma vez (ex.: exportar tudo): carrega a
// lista inteira de uma vez em vez de uma chamada por dormente.
const dormentes = new Map();

export async function carregarDormentes(ids) {
  const faltando = [...new Set(ids)].filter((id) => id && !dormentes.has(id));
  if (faltando.length > 100) {
    for (const d of await api.listarTudo("/dormentes")) dormentes.set(d.id, d);
  } else {
    await Promise.all(
      faltando.map((id) =>
        api.get(`/dormentes/${id}`).then(
          (d) => dormentes.set(id, d),
          () => dormentes.set(id, null), // apagado ou sem acesso: mostra "—"
        ),
      ),
    );
  }
  return dormentes;
}

// Ao sair, outro usuário pode entrar com outro papel: esquece tudo.
export function limparCatalogos() {
  cache.clear();
  dormentes.clear();
}
