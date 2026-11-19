// PAINEL DE MONITORAMENTO — com a API
// GET /indicadores (supervisor e admin): `sleepers_by_*` são o retrato de
// agora; movimentações, inspeções e ocorrências respeitam o período escolhido.
// GET /monitoramento/status (sem login): saúde da API e do banco, no lugar
// dos "serviços" simulados do modo demonstração.
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, ClipboardList, Clock, LayoutDashboard, Loader2, Server, Timer, Warehouse, XCircle } from "lucide-react";
import { api } from "../api/index.js";
import { STATUS_DORMENTE, TIPO_OCORRENCIA, duracao, rotulo } from "../rotulos.js";
import { COLOR, EmptyState, FONT_DISPLAY, FONT_MONO, Panel, SectionTitle, SignalDot, selectStyle } from "../ui.jsx";
import { mensagemErro } from "./TabelaApi.jsx";

const PERIODOS = [
  { dias: 7, rotulo: "Últimos 7 dias" },
  { dias: 30, rotulo: "Últimos 30 dias" },
  { dias: 90, rotulo: "Últimos 90 dias" },
];

const fmt = (n, casas = 0) => (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

// "2026-10-21" → "21/10" (o dia vem da API como data, sem hora).
const diaCurto = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

function Grafico({ dados, barras, altura = 220, vertical = false, chave = "nome" }) {
  if (!dados.length) return <EmptyState text="Sem dados no período." />;
  return (
    <div style={{ width: "100%", height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={COLOR.line} strokeDasharray="3 3" horizontal={!vertical} vertical={vertical} />
          {vertical ? (
            <>
              <XAxis type="number" allowDecimals={false} stroke={COLOR.textFaint} fontSize={11} tickLine={false} axisLine={{ stroke: COLOR.line }} />
              <YAxis type="category" dataKey={chave} width={150} stroke={COLOR.textFaint} fontSize={11} tickLine={false} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={chave} stroke={COLOR.textFaint} fontSize={11} tickLine={false} axisLine={{ stroke: COLOR.line }} />
              <YAxis allowDecimals={false} stroke={COLOR.textFaint} fontSize={11} tickLine={false} axisLine={false} width={32} />
            </>
          )}
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: `1px solid ${COLOR.line}` }} />
          {barras.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {barras.map((b) => (
            <Bar key={b.chave} dataKey={b.chave} name={b.nome} fill={b.cor} stackId={b.pilha} radius={b.pilha ? 0 : [2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SaudeApi() {
  const [saude, setSaude] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api.get("/monitoramento/status").then(setSaude, (e) => setErro(e.detail));
  }, []);

  // Condição: com resposta, mostra API/banco/e-mail; se a chamada falhar (API
  // fora do ar, ou 503 com o banco caído), mostra só a linha da API em vermelho.
  const linhas = saude
    ? [
        { label: "Back-end / API", status: saude.status === "ok" ? "ok" : "warn", detail: `versão ${saude.version} · ${saude.environment}` },
        { label: "Banco de dados (PostgreSQL)", status: saude.database === "ok" ? "ok" : "erro", detail: saude.database === "ok" ? "respondendo" : "indisponível" },
        { label: "E-mail de convite", status: saude.email_configured ? "ok" : "warn", detail: saude.email_configured ? "configurado" : "não configurado (o site abre o e-mail do usuário)" },
      ]
    : [{ label: "Back-end / API", status: erro ? "erro" : "warn", detail: erro || "consultando…" }];

  return (
    <Panel>
      <SectionTitle icon={Server} title="Saúde do sistema" sub="GET /monitoramento/status" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {linhas.map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SignalDot status={l.status} />
            <div>
              <div style={{ fontSize: 12.5 }}>{l.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.textFaint }}>{l.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PainelApi() {
  const [dias, setDias] = useState(7);
  const [ind, setInd] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    const ate = new Date();
    const de = new Date(ate.getTime() - dias * 86400000);
    api.get("/indicadores", { de, ate })
      .then((r) => ativo && setInd(r), (e) => ativo && setErro(mensagemErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [dias]);

  const porStatus = Object.fromEntries((ind?.sleepers_by_status ?? []).map((s) => [s.status, s.count]));
  const kpis = ind
    ? [
        { label: "Dormentes cadastrados", valor: fmt(ind.sleepers_total), icone: Warehouse, cor: COLOR.blue },
        { label: "Em estoque", valor: fmt(porStatus.in_stock), icone: Warehouse, cor: COLOR.green },
        { label: "Em quarentena", valor: fmt(porStatus.quarantine), icone: AlertTriangle, cor: porStatus.quarantine ? COLOR.amber : COLOR.textFaint },
        { label: "Inspeções no período", valor: fmt(ind.inspections_total), icone: ClipboardList, cor: COLOR.blue },
        { label: "Tempo médio de inspeção", valor: duracao(ind.average_inspection_seconds) || "—", icone: Timer, cor: COLOR.textFaint },
        { label: "Reprovação nas inspeções", valor: ind.rejection_rate == null ? "—" : `${fmt(ind.rejection_rate * 100, 1)}%`, icone: XCircle, cor: ind.rejection_rate ? COLOR.amber : COLOR.textFaint },
        { label: "Perdas no período", valor: fmt(ind.losses), icone: AlertTriangle, cor: ind.losses ? COLOR.red : COLOR.textFaint },
      ]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <SectionTitle icon={LayoutDashboard} title="Painel de monitoramento" sub="Retrato atual dos dormentes e atividade no período" style={{ marginBottom: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {carregando && <Loader2 size={14} className="spin" color={COLOR.textFaint} />}
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} style={selectStyle} title="Período">
            {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.rotulo}</option>)}
          </select>
        </div>
      </div>

      {erro && <Panel accent={COLOR.red}><div role="alert" style={{ color: COLOR.red, fontSize: 12.5 }}>{erro}</div></Panel>}

      {ind && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {kpis.map((k) => {
              const Icone = k.icone;
              return (
                <Panel key={k.label} accent={k.cor}>
                  <Icone size={16} color={k.cor} />
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, marginTop: 10 }}>{k.valor}</div>
                  <div style={{ fontSize: 11.5, color: COLOR.textDim, marginTop: 2 }}>{k.label}</div>
                </Panel>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
            <Panel>
              <SectionTitle icon={Activity} title="Movimentações por dia" sub={PERIODOS.find((p) => p.dias === dias)?.rotulo} />
              <Grafico
                dados={ind.movements_per_day.map((d) => ({ ...d, nome: diaCurto(d.day) }))}
                barras={[
                  { chave: "entry", nome: "Entrada", cor: COLOR.green, pilha: "m" },
                  { chave: "withdrawal", nome: "Retirada", cor: COLOR.blue, pilha: "m" },
                  { chave: "transfer", nome: "Transferência", cor: COLOR.amber, pilha: "m" },
                ]}
              />
            </Panel>
            <Panel>
              <SectionTitle icon={ClipboardList} title="Inspeções por dia" sub="Aprovadas e reprovadas" />
              <Grafico
                dados={ind.inspections_per_day.map((d) => ({ ...d, nome: diaCurto(d.day) }))}
                barras={[
                  { chave: "approved", nome: "Aprovadas", cor: COLOR.green, pilha: "i" },
                  { chave: "rejected", nome: "Reprovadas", cor: COLOR.red, pilha: "i" },
                ]}
              />
            </Panel>
            <Panel>
              <SectionTitle icon={Warehouse} title="Dormentes por status" sub="Retrato atual" />
              <Grafico
                vertical
                altura={200}
                dados={ind.sleepers_by_status.map((s) => ({ nome: rotulo(STATUS_DORMENTE, s.status), total: s.count }))}
                barras={[{ chave: "total", nome: "Dormentes", cor: COLOR.blue }]}
              />
            </Panel>
            <Panel>
              <SectionTitle icon={Warehouse} title="Dormentes por espécie" sub="As 10 mais frequentes" />
              <Grafico
                vertical
                altura={260}
                dados={ind.sleepers_by_species.slice(0, 10).map((s) => ({ nome: s.code ? `${s.code} · ${s.name}` : s.name, total: s.count }))}
                barras={[{ chave: "total", nome: "Dormentes", cor: COLOR.green }]}
              />
            </Panel>
            <Panel>
              <SectionTitle icon={Warehouse} title="Dormentes por local" sub="Retrato atual" />
              <Grafico
                vertical
                altura={Math.max(120, ind.sleepers_by_location.length * 32)}
                dados={ind.sleepers_by_location.map((l) => ({ nome: l.name, total: l.count }))}
                barras={[{ chave: "total", nome: "Dormentes", cor: COLOR.textDim }]}
              />
            </Panel>
            <Panel>
              <SectionTitle icon={AlertTriangle} title="Ocorrências por tipo" sub="No período" />
              <Grafico
                vertical
                altura={180}
                dados={ind.occurrences_by_kind.map((o) => ({ nome: rotulo(TIPO_OCORRENCIA, o.kind), total: o.count }))}
                barras={[{ chave: "total", nome: "Ocorrências", cor: COLOR.amber }]}
              />
            </Panel>
            <SaudeApi />
            <Panel>
              <SectionTitle icon={Clock} title="Período consultado" />
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLOR.textDim, lineHeight: 1.8 }}>
                de {new Date(ind.period.start).toLocaleString("pt-BR")}<br />
                até {new Date(ind.period.end).toLocaleString("pt-BR")}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
