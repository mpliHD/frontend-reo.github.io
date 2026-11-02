// COMPONENTES VISUAIS COMPARTILHADOS
// Cores, fontes e peças de interface usadas por todas as telas (App.jsx e
// src/telas/). Saíram do App.jsx sem mudança de comportamento.
import { AlertTriangle } from "lucide-react";
import { MODO_DEMO } from "./config.js";
import { PAPEIS } from "./papeis.js";

// PALETA DE CORES
// Objeto único com todas as cores do sistema, trocar um valor aqui muda a
// cor (#) em todas as telas de uma vez, sem precisar procurar cada lugar que a
// usa. Vermelho é a cor de marca (CPTM); âmbar/verde/vermelho também são
// usados como "sinal de status" (aviso / sucesso / crítico) nas telas.
// Origem das cores (lidas em cptm.sp.gov.br em 2026-11-02; não achamos manual
// de marca público, então confirme com a CPTM antes de tratar como oficial):
// - red e brandGray: vermelho e cinza do logotipo da CPTM;
// - blue: azul de ação do site da CPTM, que segue o Design System do gov.br;
// - bg, amber/amberTint e text: fundo, aviso e texto do mesmo site.
export const COLOR = {
  bg: "#F5F5F5",
  panel: "#FFFFFF",
  panelAlt: "#F8F8F8",
  line: "#E2E2E2",
  red: "#E2001A",       // vermelho do logo CPTM (marca / crítico)
  redTint: "#FDE5E8",
  redDark: "#B00014",   // tons escuros do vermelho, para o degradê do login
  redDeep: "#78000E",
  brandGray: "#707173", // cinza do logo CPTM
  amber: "#947100",     // aviso (offline, pendências)
  amberTint: "#FFF5C2",
  amberLine: "#EEDC8A",
  green: "#168821",     // ok / sucesso
  greenTint: "#E3F2E5",
  greenLine: "#B9DDBE",
  blue: "#1351B4",      // informativo / ação secundária (azul gov.br)
  blueTint: "#DBE8FB",
  text: "#333333",
  textDim: "#5E6066",
  textFaint: "#888A8E", // mais escuro que antes (#9AA0A8) para ler melhor em fundo branco
};

// Rawline é a fonte do site da CPTM (padrão gov.br); o monoespaçado continua
// IBM Plex Mono, usado em códigos, tags RFID e números.
export const FONT_DISPLAY = "'Rawline', 'Raleway', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";
export const FONT_BODY = "'Rawline', 'Raleway', sans-serif";

// Cores oficiais das linhas da CPTM (variáveis --corLinhaN do site da CPTM).
// Linha que não está aqui aparece em cinza.
export const CORES_LINHA = {
  7: "#A8034F",  // Rubi
  10: "#00829B", // Turquesa
  11: "#F55F1A", // Coral
  12: "#1C146B", // Safira
  13: "#00B052", // Jade
};

// FONTES E ESTILOS GLOBAIS
// Este componente só existe para injetar um bloco <style> com: a importação
// das fontes (Rawline pelo CDN do Design System gov.br e IBM Plex Mono pelo
// Google Fonts), um reset básico, e as @keyframes das
// animações usadas em vários lugares (pulso do indicador de status, entrada
// suave de painéis, giro do ícone de carregamento, etc.). É renderizado uma
// vez em cada tela principal (Login e App). Depois se quisermos deixar mais sofisticado
// podemos mexer aqui
export const FontLoader = () => (
  <style>{`
    @import url('https://cdngovbr-ds.estaleiro.serpro.gov.br/design-system/fonts/rawline/css/rawline.css');
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    * { box-sizing: border-box; }
    html, body, #root { margin: 0; height: 100%; }
    body { background: ${COLOR.bg}; color: ${COLOR.text}; }
    ::selection { background: ${COLOR.red}; color: #fff; }
    /* Texto de exemplo dos campos em cinza claro, para não parecer que já vem preenchido */
    input::placeholder, textarea::placeholder { color: ${COLOR.textFaint}; opacity: 1; }
    table { border-collapse: collapse; width: 100%; }
    .app-shell { min-height: 100vh; }
    @supports (height: 100dvh) { .app-shell { min-height: 100dvh; } }
    /* Layout logado: altura fixa = altura da tela. Assim só a área de conteúdo
       rola, e o menu lateral (com o botão Sair) fica sempre visível, mesmo nas
       abas com tabelas altas. */
    .app-shell-fixo { height: 100vh; }
    @supports (height: 100dvh) { .app-shell-fixo { height: 100dvh; } }
    @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes slide-in { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)} }
    @keyframes fade-in { from{opacity:0} to{opacity:1} }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes rail-sweep { 0%{background-position: 0 0} 100%{background-position: 120px 0} }
    @keyframes drift { 0%,100%{transform: translateY(0)} 50%{transform: translateY(-8px)} }
    .spin { animation: spin 0.9s linear infinite; }
  `}</style>
);

// LOGOTIPO (MARCA)
// SVG desenhado à mão, inspirado em sinalização ferroviária (setas + trilho
// tracejado). NÃO é o logotipo oficial da CPTM (não queremos copyright) que é marca registrada
export function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill={COLOR.red} />
      <path d="M7 20 L14 12 L18 16 L25 8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 8 H25 V13" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="6" y1="24" x2="26" y2="24" stroke="#fff" strokeWidth="1.6" strokeDasharray="2.5 3" />
    </svg>
  );
}

// FUNÇÕES UTILITÁRIAS
// Pequenas funções puras (sem tela) usadas em vários componentes:
// fmtTime / fmtShort: formatam datas no padrão brasileiro (a "curta" só
//  mostra hora:minuto:segundo, usada em listas onde o dia é óbvio).
// uid: gera um código curto e aleatório, usado como identificador de
// registros mockados (não é um UUID de verdade, só serve para o `key` do
//  React e para exibir um "código" plausível na tela).
export function fmtTime(d) {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function fmtShort(d) {
  return d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function uid() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

// COMPONENTES BÁSICOS DE INTERFACE
// Peças pequenas e reaproveitadas em quase toda tela:
// SignalDot: a bolinha pulsante de status (verde=ok, âmbar=aviso,
//  vermelho=crítico). A cor é escolhida por um encadeamento de condições:
//   se(if) status for == "ok" usa verde; senão (else), se for "warn" usa âmbar; para
//   qualquer outro valor (ex.: "erro"), usa vermelho. --PRECISAMOS TESTAR SE A REGRA DA EXCEÇÃO É BOA
// Panel: o "cartão" branco com borda usado para agrupar conteúdo. Se
//   receber `accent`, pinta uma borda colorida mais grossa do lado esquerdo
//   (usado para destacar o estado de um cartão, como erro ou sucesso).
// Label: rótulo pequeno em fonte monoespaçada, usado acima de campos de
//   formulário e em métricas.
export function SignalDot({ status }) {
  const c = status === "ok" ? COLOR.green : status === "warn" ? COLOR.amber : COLOR.red;
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: c, animation: "pulse-dot 1.8s ease-in-out infinite" }} />
    </span>
  );
}

export function Panel({ children, style, accent }) {
  return (
    <div
      style={{
        background: COLOR.panel,
        border: `1px solid ${COLOR.line}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${COLOR.line}`,
        borderRadius: 6,
        padding: 18,
        boxShadow: "0 1px 2px rgba(20,20,30,.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Label({ children, tone }) {
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, color: tone || COLOR.textDim }}>
      {children}
    </span>
  );
}

// COMPONENTES DE FORMULÁRIO
// Field: um par label+input padronizado (usado no login).
// Btn: botão com 3 variantes visuais (primary = vermelho sólido, ghost =
//   contorno, subtle = cinza claro), e um estado `small` para versões
//   compactas usadas dentro de tabelas/listas.
export function Field({ label, value, onChange, placeholder, type = "text", mono }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.textDim, letterSpacing: 0.4 }}>{label.toUpperCase()}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: COLOR.panelAlt, border: `1px solid ${COLOR.line}`, borderRadius: 4,
          padding: "10px 12px", color: COLOR.text, fontSize: 14, fontFamily: mono ? FONT_MONO : FONT_BODY, outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = COLOR.red)}
        onBlur={(e) => (e.target.style.borderColor = COLOR.line)}
      />
    </label>
  );
}

export function Btn({ children, onClick, full, variant = "primary", type = "button", small }) {
  const styles = {
    primary: { background: COLOR.red, color: "#fff", border: `1px solid ${COLOR.red}` },
    ghost: { background: "transparent", color: COLOR.text, border: `1px solid ${COLOR.line}` },
    subtle: { background: COLOR.panelAlt, color: COLOR.textDim, border: `1px solid ${COLOR.line}` },
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        ...styles, width: full ? "100%" : "auto", display: "inline-flex", alignItems: "center",
        justifyContent: "center", gap: 6, padding: small ? "7px 12px" : "10px 16px",
        borderRadius: 4, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: small ? 12.5 : 13.5,
        cursor: "pointer", transition: "opacity .15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.85)}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}
    >
      {children}
    </button>
  );
}

// FAIXA DO MODO DEMONSTRAÇÃO
// Aparece só quando MODO_DEMO é verdadeiro (site publicado sem API, ver
// src/config.js), para ninguém confundir os dados fictícios com dados reais.
export function FaixaDemo({ style }) {
  if (!MODO_DEMO) return null;
  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", flexShrink: 0,
      background: COLOR.amberTint, borderBottom: `1px solid ${COLOR.amberLine}`, color: COLOR.amber,
      fontSize: 12, lineHeight: 1.4, ...style,
    }}>
      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
      <span>
        <b>Modo demonstração:</b> todos os dados são fictícios e nada é lido da API.
      </span>
    </div>
  );
}

export function Selo({ texto, tom }) {
  const cores = {
    ok: { bg: COLOR.greenTint, fg: COLOR.green },
    info: { bg: COLOR.blueTint, fg: COLOR.blue },
    warn: { bg: COLOR.amberTint, fg: COLOR.amber },
    danger: { bg: COLOR.redTint, fg: COLOR.red },
    neutro: { bg: COLOR.panelAlt, fg: COLOR.textDim },
  }[tom] || { bg: COLOR.panelAlt, fg: COLOR.textDim };
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, padding: "2px 8px", borderRadius: 99, background: cores.bg, color: cores.fg, whiteSpace: "nowrap" }}>
      {texto}
    </span>
  );
}

// Nome da linha ("Linha 12-Safira") com a bolinha na cor oficial da linha.
// Condição: o número é tirado do próprio texto; linha sem cor conhecida fica cinza.
export function SeloLinha({ texto }) {
  const numero = String(texto ?? "").match(/\d+/)?.[0];
  const cor = CORES_LINHA[numero] ?? COLOR.textFaint;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 99, background: cor, flexShrink: 0 }} />
      {texto}
    </span>
  );
}

// COMPONENTES AUXILIARES REUTILIZÁVEIS
// Usados em quase todas as abas a partir daqui: `selectStyle` é o estilo
// compartilhado de inputs/selects/textareas; SectionTitle é o
// título com ícone que abre cada bloco dentro de um Panel; EmptyState é a
// mensagem cinza mostrada quando uma lista/tabela ainda não tem nada.
export const selectStyle = {
  background: COLOR.panelAlt, border: `1px solid ${COLOR.line}`, borderRadius: 4,
  padding: "8px 10px", color: COLOR.text, fontSize: 13, outline: "none",
};

export function SectionTitle({ icon: Icon, title, sub, style }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={15} color={COLOR.red} />
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13.5 }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 11.5, color: COLOR.textFaint, marginTop: 3, marginLeft: 23 }}>{sub}</div>}
    </div>
  );
}

export function EmptyState({ text }) {
  return <div style={{ fontSize: 12.5, color: COLOR.textFaint, padding: "18px 4px" }}>{text}</div>;
}

export function DataTable({ cols, rows, empty }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: "left", fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.textDim, padding: "6px 10px", borderBottom: `1px solid ${COLOR.line}`, whiteSpace: "nowrap" }}>{c.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 ? COLOR.panelAlt : "transparent" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "7px 10px", fontSize: 12.5, borderBottom: `1px solid ${COLOR.line}`, whiteSpace: "nowrap" }}>{String(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function roleColor(papel) {
  if (papel === "admin") return { bg: COLOR.redTint, fg: COLOR.red };
  if (papel === "supervisor") return { bg: COLOR.blueTint, fg: COLOR.blue };
  if (papel === "especialista") return { bg: COLOR.amberTint, fg: COLOR.amber };
  if (papel === "tecnico") return { bg: COLOR.greenTint, fg: COLOR.green };
  return { bg: COLOR.panelAlt, fg: COLOR.textDim };
}

export const OPCOES_PAPEL = PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>);
