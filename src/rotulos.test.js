import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_DORMENTE, data, nomeEspecie, nomeLocal, rotulo, tomStatus } from "./rotulos.js";

test("rótulo e tom de status, com valor desconhecido cru", () => {
  assert.equal(rotulo(STATUS_DORMENTE, "quarantine"), "Quarentena");
  assert.equal(tomStatus("discarded"), "danger");
  assert.equal(rotulo(STATUS_DORMENTE, "novo_status"), "novo_status");
  assert.equal(tomStatus("novo_status"), "neutro");
});

test("nome da espécie: código + popular, senão científico", () => {
  assert.equal(nomeEspecie({ code: "13", scientific_name: "Hymenaea courbaril", common_name: null }), "13 · Hymenaea courbaril");
  assert.equal(nomeEspecie({ code: "19", scientific_name: null, common_name: "Angelim Vermelho" }), "19 · Angelim Vermelho");
  assert.equal(nomeEspecie(null), "");
});

test("nome do local com o pátio na frente", () => {
  const patio = { id: "p", name: "TG – Três Guri", parent_id: null };
  const rua = { id: "r", name: "Rua 08", parent_id: "p" };
  const porId = new Map([[patio.id, patio], [rua.id, rua]]);
  assert.equal(nomeLocal(rua, porId), "TG – Três Guri › Rua 08");
  assert.equal(nomeLocal(patio, porId), "TG – Três Guri");
  assert.equal(nomeLocal(rua, new Map()), "Rua 08");
});

test("data ISO vira Date; vazio vira null", () => {
  assert.equal(data("2026-10-21T18:30:00Z").toISOString(), "2026-10-21T18:30:00.000Z");
  assert.equal(data(null), null);
});
