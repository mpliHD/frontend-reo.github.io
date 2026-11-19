// INSPEÇÕES — com a API
// GET /inspecoes: o checklist digital de cada inspeção (conservação, trincas,
// ataque biológico, umidade, vida útil, espécie confirmada) e o resultado.
// Inspeção reprovada põe o dormente em quarentena (regra da API).
// A rota traz só sleeper_id e inspector_id: tag/espécie vêm de /dormentes/{id}
// e o nome do inspetor de /usuarios (só supervisor e admin), como em Retiradas.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Timer, X, XCircle } from "lucide-react";
import { api } from "../api/index.js";
import { carregarDormentes, carregarUsuarios } from "../api/catalogos.js";
import { podeVerAba } from "../papeis.js";
import { CONSERVACAO, RESULTADO_INSPECAO, UMIDADE, data, duracao, inicioDoDia, nomeEspecie, rotulo, simNao } from "../rotulos.js";
import { Btn, COLOR, FONT_DISPLAY, Label, Panel, SectionTitle, selectStyle } from "../ui.jsx";
import { DetalheDormente } from "./DetalheDormente.jsx";
import { TabelaApi } from "./TabelaApi.jsx";

function colunas(mostrarInspetor) {
  return [
    { key: "data", label: "Data", valor: (l) => data(l.inspected_at), formato: "dataHora", largura: 18 },
    { key: "tag", label: "Tag RFID", valor: (l) => l.dormente?.rfid_tag ?? null, mono: true, largura: 26 },
    { key: "especie", label: "Espécie", valor: (l) => nomeEspecie(l.dormente?.species), largura: 30, larguraTela: 200 },
    { key: "resultado", label: "Resultado", valor: (l) => rotulo(RESULTADO_INSPECAO, l.result), formato: "selo", tom: (l) => RESULTADO_INSPECAO[l.result]?.tom, largura: 12 },
    { key: "conservacao", label: "Conservação", valor: (l) => rotulo(CONSERVACAO, l.conservation), largura: 12 },
    { key: "trincas", label: "Trincas", valor: (l) => simNao(l.has_cracks), largura: 9 },
    { key: "ataque", label: "Ataque biológico", valor: (l) => simNao(l.biological_attack), largura: 14 },
    { key: "umidade", label: "Umidade", valor: (l) => rotulo(UMIDADE, l.moisture), largura: 10 },
    { key: "vida", label: "Vida útil (anos)", valor: (l) => l.estimated_life_years, formato: "numero", largura: 12 },
    { key: "confirmada", label: "Espécie confirmada", valor: (l) => simNao(l.species_confirmed), largura: 14 },
    { key: "duracao", label: "Duração", valor: (l) => duracao(l.duration_seconds), largura: 10 },
    { key: "duracaoSeg", label: "Duração (s)", valor: (l) => l.duration_seconds, formato: "numero", soExcel: true, largura: 10 },
    ...(mostrarInspetor ? [{ key: "inspetor", label: "Inspetor", valor: (l) => l.inspetor, largura: 24 }] : []),
    { key: "obs", label: "Observação", valor: (l) => l.notes, largura: 40, larguraTela: 220, dica: (l) => l.notes || undefined },
  ];
}

export function InspecoesApi({ usuario, onLog }) {
  const [resultado, setResultado] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [contagem, setContagem] = useState({});
  const mostrarInspetor = podeVerAba("usuarios", usuario?.papel);

  const periodoInvalido = de && ate && ate < de;
  const periodo = useMemo(
    () => ({ de: periodoInvalido ? "" : inicioDoDia(de), ate: periodoInvalido ? "" : inicioDoDia(ate, 1) }),
    [de, ate, periodoInvalido],
  );
  const consulta = useMemo(() => ({ ...periodo, result: resultado }), [periodo, resultado]);

  // Totais do período por resultado (limit=1: só o `total` interessa).
  useEffect(() => {
    let ativo = true;
    Promise.all(
      ["approved", "rejected"].map((r) => api.get("/inspecoes", { ...periodo, result: r, limit: 1 }).then((p) => [r, p.total])),
    ).then((pares) => ativo && setContagem(Object.fromEntries(pares)), () => {});
    return () => { ativo = false; };
  }, [periodo]);

  const enriquecer = useCallback(
    async (itens) => {
      const [dormentes, usuarios] = await Promise.all([
        carregarDormentes(itens.map((i) => i.sleeper_id)),
        mostrarInspetor ? carregarUsuarios().catch(() => new Map()) : new Map(),
      ]);
      return itens.map((i) => ({ ...i, dormente: dormentes.get(i.sleeper_id) ?? null, inspetor: usuarios.get(i.inspector_id)?.name ?? "" }));
    },
    [mostrarInspetor],
  );
  const cols = useMemo(() => colunas(mostrarInspetor), [mostrarInspetor]);

  const total = (contagem.approved ?? 0) + (contagem.rejected ?? 0);
  const kpis = [
    { label: de || ate ? "Inspeções no período" : "Inspeções registradas", valor: contagem.approved === undefined ? "…" : total.toLocaleString("pt-BR"), icone: ClipboardList, cor: COLOR.blue },
    { label: "Aprovadas", valor: contagem.approved?.toLocaleString("pt-BR") ?? "…", icone: CheckCircle2, cor: COLOR.green },
    { label: "Reprovadas (quarentena)", valor: contagem.rejected?.toLocaleString("pt-BR") ?? "…", icone: XCircle, cor: contagem.rejected ? COLOR.red : COLOR.textFaint },
    { label: "Taxa de reprovação", valor: total ? `${((contagem.rejected / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—", icone: Timer, cor: COLOR.textFaint },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={ClipboardList} title="Inspeções" sub="Checklist digital de cada inspeção; clique numa linha para ver o histórico do dormente" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {kpis.map((k) => {
          const Icone = k.icone;
          return (
            <Panel key={k.label} accent={k.cor}>
              <Icone size={16} color={k.cor} />
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, marginTop: 10 }}>{k.valor}</div>
              <div style={{ fontSize: 11.5, color: COLOR.textDim, marginTop: 2 }}>{k.label}</div>
            </Panel>
          );
        })}
      </div>

      <TabelaApi
        caminho="/inspecoes"
        consulta={consulta}
        colunas={cols}
        enriquecer={enriquecer}
        onLinhaClick={(l) => setDetalhe(l.sleeper_id)}
        vazio="Nenhuma inspeção com esses filtros."
        nomeArquivo="inspecoes"
        nomeAba="Inspeções"
        onLog={onLog}
        filtros={
          <>
            <select value={resultado} onChange={(e) => setResultado(e.target.value)} style={{ ...selectStyle, flex: "0 1 170px" }} title="Resultado">
              <option value="">Resultado: todos</option>
              {Object.entries(RESULTADO_INSPECAO).map(([v, r]) => <option key={v} value={v}>{r.rotulo}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Label>DE</Label>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={selectStyle} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Label>ATÉ</Label>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={selectStyle} />
            </label>
            {(resultado || de || ate) && (
              <Btn variant="subtle" small onClick={() => { setResultado(""); setDe(""); setAte(""); }}>
                <X size={13} /> Limpar
              </Btn>
            )}
            {periodoInvalido && <span style={{ color: COLOR.red, fontSize: 12 }}>A data final precisa ser depois da inicial.</span>}
          </>
        }
      />
      {detalhe && <DetalheDormente id={detalhe} usuario={usuario} onClose={() => setDetalhe(null)} />}
    </div>
  );
}
