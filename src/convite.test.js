import { test } from "node:test";
import assert from "node:assert/strict";
import { lerConvite, tokenDoHash } from "./convite.js";

// Monta um JWT de mentira (assinatura não importa: o site não confere).
function jwt(payload) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.assinatura`;
}

test("token só sai de um hash de convite", () => {
  assert.equal(tokenDoHash("#/convite/abc.def.ghi"), "abc.def.ghi");
  assert.equal(tokenDoHash("#/convite/abc.def.ghi?x=1"), "abc.def.ghi");
  assert.equal(tokenDoHash("#/outra"), null);
  assert.equal(tokenDoHash(""), null);
});

test("lê nome com acento, e-mail, papel, matrícula e validade", () => {
  const c = lerConvite(jwt({ sub: "marcos@cptm.sp.gov.br", name: "Marcos Vinícius", role: "tecnico", exp: 1793000000 }));
  assert.equal(c.nome, "Marcos Vinícius");
  assert.equal(c.email, "marcos@cptm.sp.gov.br");
  assert.equal(c.papel, "tecnico");
  assert.equal(c.matricula, null);
  assert.equal(c.expiraEm.toISOString(), new Date(1793000000 * 1000).toISOString());
});

test("token malformado vira null", () => {
  assert.equal(lerConvite("nao-e-jwt"), null);
  assert.equal(lerConvite("a.%%%.c"), null);
});
