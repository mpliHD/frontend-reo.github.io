// Roda depois do `vite build` (veja o script "publicar" no package.json).
// O GitHub Pages abre o index.html da raiz, que carrega o JavaScript compilado
// em dist/assets/. A cada build o Vite gera um arquivo com nome novo
// (index-XXXX.js); este script descobre o nome, apaga os antigos e atualiza o
// index.html da raiz para apontar para o arquivo novo.
import fs from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const indexRaiz = new URL("../index.html", import.meta.url);

const appHtml = fs.readFileSync(new URL("app.html", dist), "utf8");
const novo = appHtml.match(/assets\/(index-[\w-]+\.js)/)?.[1];
if (!novo) throw new Error("Não achei o arquivo JS gerado em dist/app.html. O build falhou?");

for (const arquivo of fs.readdirSync(new URL("assets/", dist))) {
  if (arquivo.startsWith("index-") && arquivo.endsWith(".js") && arquivo !== novo) {
    fs.unlinkSync(new URL(`assets/${arquivo}`, dist));
  }
}

const html = fs.readFileSync(indexRaiz, "utf8");
if (!/\.\/dist\/assets\/index-[\w-]+\.js/.test(html)) {
  throw new Error("O index.html da raiz não tem a referência ./dist/assets/index-XXXX.js para atualizar.");
}
fs.writeFileSync(indexRaiz, html.replace(/\.\/dist\/assets\/index-[\w-]+\.js/, `./dist/assets/${novo}`));
fs.unlinkSync(new URL("app.html", dist)); // a página publicada é o index.html da raiz

console.log(`index.html agora aponta para ./dist/assets/${novo}`);
