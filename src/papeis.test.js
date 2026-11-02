import { test } from "node:test";
import assert from "node:assert/strict";
import { PAPEIS, podeVerAba, rotuloPapel, usuarioDaApi } from "./papeis.js";

test("os 5 papéis da API, sem Analista", () => {
  assert.deepEqual(PAPEIS.map((p) => p.valor), ["operador", "tecnico", "especialista", "supervisor", "admin"]);
  assert.equal(rotuloPapel("tecnico"), "Técnico");
  assert.equal(rotuloPapel("desconhecido"), "desconhecido");
});

test("abas de gestão só para supervisor e admin", () => {
  for (const aba of ["dashboard", "logs", "usuarios"]) {
    assert.equal(podeVerAba(aba, "admin"), true, aba);
    assert.equal(podeVerAba(aba, "supervisor"), true, aba);
    for (const papel of ["operador", "tecnico", "especialista"]) assert.equal(podeVerAba(aba, papel), false, `${aba}/${papel}`);
  }
});

test("abas sem restrição para qualquer papel", () => {
  for (const papel of ["operador", "tecnico", "especialista", "supervisor", "admin"]) {
    assert.equal(podeVerAba("dormentes_estoque", papel), true, papel);
  }
});

test("usuarioDaApi traduz os campos", () => {
  const u = usuarioDaApi({ id: "1", name: "Ana", registration: "RL-1", email: "a@b.c", role: "tecnico", active: true });
  assert.deepEqual(u, { id: "1", nome: "Ana", matricula: "RL-1", email: "a@b.c", papel: "tecnico" });
});
