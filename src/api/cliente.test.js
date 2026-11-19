// Testes do cliente da API com um fetch falso (sem rede, sem backend).
// Rodam com o test runner do próprio Node: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarClienteApi, ErroApi } from "./cliente.js";

function sessaoFalsa(inicial = null) {
  let s = inicial;
  return { ler: () => s, salvar: (v) => (s = v), limpar: () => (s = null), get atual() { return s; } };
}
function resp(status, corpo) {
  return { status, ok: status >= 200 && status < 300, json: async () => corpo };
}
function fetchRoteiro(passos) {
  const chamadas = [];
  const f = async (url, init) => {
    chamadas.push({ url, ...init });
    const p = passos.shift();
    if (!p) throw new Error("chamada inesperada: " + url);
    if (p === "rede") throw new TypeError("Failed to fetch");
    return typeof p === "function" ? p(url, init) : p;
  };
  f.chamadas = chamadas;
  return f;
}
const tokens = (n) => ({ access_token: `a${n}`, refresh_token: `r${n}`, user: { name: "Ana" } });

test("login salva tokens e não manda Bearer", async () => {
  const s = sessaoFalsa();
  const f = fetchRoteiro([resp(200, tokens(1))]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  const u = await api.entrar("RL-1", "senha");
  assert.equal(u.name, "Ana");
  assert.equal(s.atual.access_token, "a1");
  assert.equal(f.chamadas[0].url, "http://x/auth/login");
  assert.equal(f.chamadas[0].headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(f.chamadas[0].body), { login: "RL-1", password: "senha" });
});

test("aceite de convite salva tokens e só manda matrícula se houver", async () => {
  const s = sessaoFalsa();
  const f = fetchRoteiro([resp(200, tokens(1)), resp(200, tokens(2))]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  await api.aceitarConvite("tok.en.x", "Senha-forte-1", "");
  assert.equal(f.chamadas[0].url, "http://x/auth/convite/aceitar");
  assert.deepEqual(JSON.parse(f.chamadas[0].body), { token: "tok.en.x", password: "Senha-forte-1" });
  assert.equal(f.chamadas[0].headers.Authorization, undefined);
  await api.aceitarConvite("tok.en.x", "Senha-forte-1", "RL-9002");
  assert.deepEqual(JSON.parse(f.chamadas[1].body), { token: "tok.en.x", password: "Senha-forte-1", registration: "RL-9002" });
  assert.equal(s.atual.access_token, "a2");
});

test("login errado vira ErroApi e não perde sessão", async () => {
  const s = sessaoFalsa();
  let perdeu = 0;
  const f = fetchRoteiro([resp(401, { detail: "Login ou senha inválidos.", code: "invalid_credentials" })]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  api.aoPerderSessao(() => perdeu++);
  await assert.rejects(api.entrar("a", "b"), (e) => e instanceof ErroApi && e.code === "invalid_credentials" && e.status === 401);
  assert.equal(perdeu, 0);
});

test("GET manda Bearer e monta filtros sem vazios", async () => {
  const s = sessaoFalsa(tokens(1));
  const f = fetchRoteiro([resp(200, { items: [] })]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  await api.get("/dormentes", { status: "in_stock", q: "", species_id: null, de: new Date("2026-10-01T00:00:00Z") });
  assert.equal(f.chamadas[0].url, "http://x/dormentes?status=in_stock&de=2026-10-01T00%3A00%3A00.000Z");
  assert.equal(f.chamadas[0].headers.Authorization, "Bearer a1");
  assert.equal(f.chamadas[0].body, undefined);
});

test("token_expired renova e repete com o token novo", async () => {
  const s = sessaoFalsa(tokens(1));
  const f = fetchRoteiro([
    resp(401, { detail: "Token expirado.", code: "token_expired" }),
    resp(200, tokens(2)),
    resp(200, { id: 1 }),
  ]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  assert.deepEqual(await api.get("/auth/me"), { id: 1 });
  assert.equal(f.chamadas[1].url, "http://x/auth/refresh");
  assert.deepEqual(JSON.parse(f.chamadas[1].body), { refresh_token: "r1" });
  assert.equal(f.chamadas[1].headers.Authorization, undefined);
  assert.equal(f.chamadas[2].headers.Authorization, "Bearer a2");
  assert.equal(s.atual.refresh_token, "r2");
});

test("chamadas simultâneas expiradas fazem um único refresh", async () => {
  const s = sessaoFalsa(tokens(1));
  const f = fetchRoteiro([
    resp(401, { code: "token_expired", detail: "x" }),
    resp(401, { code: "token_expired", detail: "x" }),
    resp(200, tokens(2)),
    resp(200, "A"),
    resp(200, "B"),
  ]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  const r = await Promise.all([api.get("/a"), api.get("/b")]);
  assert.deepEqual(r.sort(), ["A", "B"]);
  assert.equal(f.chamadas.filter((c) => c.url.endsWith("/auth/refresh")).length, 1);
});

test("refresh vencido limpa sessão e avisa", async () => {
  const s = sessaoFalsa(tokens(1));
  let perdeu = 0;
  const f = fetchRoteiro([
    resp(401, { code: "token_expired", detail: "x" }),
    resp(401, { code: "token_expired", detail: "refresh expirado" }),
  ]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  api.aoPerderSessao(() => perdeu++);
  await assert.rejects(api.get("/a"), (e) => e.code === "token_expired");
  assert.equal(perdeu, 1);
  assert.equal(s.atual, null);
});

test("token inválido limpa sessão; 403 não", async () => {
  const s = sessaoFalsa(tokens(1));
  let perdeu = 0;
  const f = fetchRoteiro([resp(403, { code: "forbidden", detail: "Sem permissão." }), resp(401, { code: "invalid_token", detail: "x" })]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  api.aoPerderSessao(() => perdeu++);
  await assert.rejects(api.get("/logs"), (e) => e.status === 403 && e.detail === "Sem permissão.");
  assert.equal(perdeu, 0);
  await assert.rejects(api.get("/logs"), (e) => e.code === "invalid_token");
  assert.equal(perdeu, 1);
});

test("422 traz errors; rede vira network_error; resposta sem JSON vira http_error", async () => {
  const s = sessaoFalsa(tokens(1));
  const f = fetchRoteiro([
    resp(422, { code: "validation_error", detail: "Dados inválidos.", errors: [{ loc: ["body", "role"] }] }),
    "rede",
    { status: 502, ok: false, json: async () => { throw new SyntaxError("html"); } },
  ]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  await assert.rejects(api.post("/usuarios", {}), (e) => e.errors?.[0].loc[1] === "role");
  await assert.rejects(api.get("/a"), (e) => e.status === 0 && e.code === "network_error");
  await assert.rejects(api.get("/a"), (e) => e.status === 502 && e.code === "http_error");
});

test("listarTudo percorre as páginas", async () => {
  const s = sessaoFalsa(tokens(1));
  const pag = (offset, n, total) => resp(200, { items: Array.from({ length: n }, (_, i) => offset + i), total, limit: 200, offset });
  const f = fetchRoteiro([pag(0, 200, 450), pag(200, 200, 450), pag(400, 50, 450)]);
  const api = criarClienteApi({ baseUrl: "http://x", sessao: s, fetchImpl: f });
  const itens = await api.listarTudo("/dormentes", { status: "in_stock" });
  assert.equal(itens.length, 450);
  assert.equal(itens[449], 449);
  assert.match(f.chamadas[2].url, /status=in_stock&limit=200&offset=400$/);
});
