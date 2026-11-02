// DORMENTES (com a API)
// Um dormente por linha, identificado pela tag RFID, como no modelo da API
// (GET /dormentes). Substitui a visão por lotes do modo demonstração.
// Indicadores do topo: contagem por status, feita com GET /dormentes?status=X&limit=1
// (só o `total` interessa). Assim funciona para qualquer papel; /indicadores
// seria uma chamada só, mas é restrito a supervisor e admin.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Search, Truck, Warehouse, X } from "lucide-react";
import { api } from "../api/index.js";
import { carregarEspecies, carregarLocais } from "../api/catalogos.js";
import { STATUS_DORMENTE, data, nomeEspecie, nomeLocal, rotulo, tomStatus } from "../rotulos.js";
import { Btn, COLOR, FONT_DISPLAY, Panel, SectionTitle, selectStyle } from "../ui.jsx";
import { TabelaApi, useAtrasado } from "./TabelaApi.jsx";

const INDICADORES = [
  { status: "in_stock", icone: Warehouse, cor: COLOR.green },
  { status: "quarantine", icone: AlertTriangle, cor: COLOR.amber },
  { status: "withdrawn", icone: Truck, cor: COLOR.blue },
  { status: "discarded", icone: Ban, cor: COLOR.red },
];

// `locais` é o Map do catálogo, usado para mostrar o pátio junto da rua.
function colunas(locais) {
  return [
    { key: "tag", label: "Tag RFID", valor: (d) => d.rfid_tag, mono: true, largura: 26 },
    { key: "ata", label: "Ata de registro", valor: (d) => d.registration_record, largura: 16 },
    { key: "especie", label: "Espécie", valor: (d) => nomeEspecie(d.species), largura: 30, larguraTela: 220 },
    { key: "classe", label: "Classe", valor: (d) => d.wood_class, largura: 8 },
    { key: "comprimento", label: "Comprimento (m)", valor: (d) => (d.length_m == null ? null : Number(d.length_m)), formato: "numero", casas: 2, largura: 14 },
    { key: "tratamento", label: "Tratamento", valor: (d) => d.treatment, largura: 14 },
    { key: "fornecedor", label: "Fornecedor", valor: (d) => d.supplier, largura: 22 },
    { key: "inspetora", label: "Empresa inspetora", valor: (d) => d.inspection_company, largura: 22 },
    { key: "ano", label: "Ano de fabricação", valor: (d) => d.manufacture_year, largura: 12 },
    { key: "local", label: "Local atual", valor: (d) => nomeLocal(d.current_location, locais), largura: 28 },
    { key: "status", label: "Status", valor: (d) => rotulo(STATUS_DORMENTE, d.status), formato: "selo", tom: (d) => tomStatus(d.status), largura: 14 },
    { key: "atualizado", label: "Atualizado em", valor: (d) => data(d.updated_at), formato: "dataHora", largura: 18 },
  ];
}

export function EstoqueApi({ onLog }) {
  const [status, setStatus] = useState("in_stock"); // a aba é "em estoque": abre filtrada
  const [especie, setEspecie] = useState("");
  const [local, setLocal] = useState("");
  const [busca, setBusca] = useState("");
  const q = useAtrasado(busca.trim());
  const [especies, setEspecies] = useState(new Map());
  const [locais, setLocais] = useState(new Map());
  const [contagens, setContagens] = useState({});

  useEffect(() => {
    carregarEspecies().then(setEspecies).catch(() => {});
    carregarLocais().then(setLocais).catch(() => {});
  }, []);

  // Contagem por status respeitando espécie e local escolhidos.
  useEffect(() => {
    let ativo = true;
    Promise.all(
      INDICADORES.map((k) =>
        api.get("/dormentes", { status: k.status, species_id: especie, location_id: local, limit: 1 }).then((r) => [k.status, r.total]),
      ),
    ).then((pares) => ativo && setContagens(Object.fromEntries(pares)), () => {});
    return () => { ativo = false; };
  }, [especie, local]);

  const consulta = useMemo(() => ({ status, species_id: especie, location_id: local, q }), [status, especie, local, q]);
  const cols = useMemo(() => colunas(locais), [locais]);
  const opcoesLocal = useMemo(
    () => [...locais.values()].map((l) => ({ id: l.id, nome: nomeLocal(l, locais) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [locais],
  );
  const filtrosAtivos = status !== "in_stock" || especie || local || busca;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={Warehouse} title="Dormentes" sub="Um dormente por tag RFID, com os dados da plaqueta e o local atual" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {INDICADORES.map((k) => {
          const Icone = k.icone;
          return (
            <Panel key={k.status} accent={k.cor}>
              <Icone size={16} color={k.cor} />
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, marginTop: 10 }}>
                {contagens[k.status] === undefined ? "…" : contagens[k.status].toLocaleString("pt-BR")}
              </div>
              <div style={{ fontSize: 11.5, color: COLOR.textDim, marginTop: 2 }}>{rotulo(STATUS_DORMENTE, k.status)}</div>
            </Panel>
          );
        })}
      </div>

      <TabelaApi
        caminho="/dormentes"
        consulta={consulta}
        colunas={cols}
        vazio="Nenhum dormente encontrado com esses filtros."
        nomeArquivo="dormentes"
        nomeAba="Dormentes"
        onLog={onLog}
        filtros={
          <>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
              <Search size={14} color={COLOR.textFaint} style={{ position: "absolute", left: 10, top: 10 }} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por tag ou ata"
                style={{ ...selectStyle, width: "100%", paddingLeft: 30 }}
              />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...selectStyle, flex: "0 1 170px" }} title="Status">
              <option value="">Status: todos</option>
              {Object.entries(STATUS_DORMENTE).map(([v, s]) => <option key={v} value={v}>{s.rotulo}</option>)}
            </select>
            <select value={especie} onChange={(e) => setEspecie(e.target.value)} style={{ ...selectStyle, flex: "0 1 220px" }} title="Espécie">
              <option value="">Espécie: todas</option>
              {[...especies.values()].sort((a, b) => a.code.localeCompare(b.code)).map((e) => (
                <option key={e.id} value={e.id}>{nomeEspecie(e)}</option>
              ))}
            </select>
            <select value={local} onChange={(e) => setLocal(e.target.value)} style={{ ...selectStyle, flex: "0 1 220px" }} title="Local (o pátio inclui as ruas)">
              <option value="">Local: todos</option>
              {opcoesLocal.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            {filtrosAtivos && (
              <Btn variant="subtle" small onClick={() => { setStatus("in_stock"); setEspecie(""); setLocal(""); setBusca(""); }}>
                <X size={13} /> Limpar
              </Btn>
            )}
          </>
        }
      />
    </div>
  );
}
