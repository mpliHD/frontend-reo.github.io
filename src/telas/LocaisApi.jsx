// LOCAIS — com a API
// Hierarquia pátio/armazém → rua (GET /locais). Supervisor e admin criam e
// editam (POST/PATCH /locais). Regras da API: rua precisa de um pátio como
// pai; pátio não tem pai; o nome é único entre irmãos. Local não é apagado,
// é desativado (local inativo não recebe movimentação).
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Power, Search, X } from "lucide-react";
import { api } from "../api/index.js";
import { carregarLocais, esquecerCatalogo } from "../api/catalogos.js";
import { podeEditarLocais } from "../papeis.js";
import { TIPO_LOCAL, data, nomeLocal, rotulo, simNao } from "../rotulos.js";
import { Btn, COLOR, Label, Panel, SectionTitle, selectStyle } from "../ui.jsx";
import { TabelaApi, useAtrasado } from "./TabelaApi.jsx";

function mensagemEscrita(erro) {
  if (erro.code === "location_name_taken") return "Já existe um local com esse nome nesse pátio.";
  if (erro.status === 403) return "Só supervisor e admin alteram locais.";
  return erro.detail;
}

// "" → null; "−23,5" ou "-23.5" → número. Vírgula decimal é o comum no Brasil.
function numeroOuNulo(texto) {
  const t = String(texto ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
}

const VAZIO = { id: null, name: "", kind: "street", parent_id: "", latitude: "", longitude: "" };

function FormLocal({ inicial, patios, aoSalvar, aoCancelar, onLog }) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(form.id);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function salvar() {
    setErro("");
    const latitude = numeroOuNulo(form.latitude);
    const longitude = numeroOuNulo(form.longitude);
    if (!form.name.trim()) return setErro("Informe o nome do local.");
    if (!editando && form.kind === "street" && !form.parent_id) return setErro("Escolha o pátio desta rua.");
    if (Number.isNaN(latitude) || (latitude !== null && Math.abs(latitude) > 90)) return setErro("Latitude inválida (entre -90 e 90).");
    if (Number.isNaN(longitude) || (longitude !== null && Math.abs(longitude) > 180)) return setErro("Longitude inválida (entre -180 e 180).");
    setSalvando(true);
    try {
      const corpo = { name: form.name.trim(), latitude, longitude };
      const l = editando
        ? await api.patch(`/locais/${form.id}`, corpo)
        : await api.post("/locais", { ...corpo, kind: form.kind, parent_id: form.kind === "street" ? form.parent_id : null });
      onLog?.(`Local ${editando ? "alterado" : "criado"}: ${l.name}`);
      aoSalvar();
    } catch (e) {
      setErro(mensagemEscrita(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel accent={COLOR.blue}>
      <SectionTitle icon={editando ? Pencil : Plus} title={editando ? `Editar ${form.name || "local"}` : "Novo local"} sub="Pátio/armazém ou rua dentro de um pátio; coordenadas são opcionais" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>NOME</Label>
          <input value={form.name} onChange={mudar("name")} placeholder="Rua 10" style={selectStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>TIPO</Label>
          <select value={form.kind} onChange={mudar("kind")} disabled={editando} style={{ ...selectStyle, opacity: editando ? 0.6 : 1 }}>
            {Object.entries(TIPO_LOCAL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        {form.kind === "street" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label>PÁTIO</Label>
            <select value={form.parent_id} onChange={mudar("parent_id")} disabled={editando} style={{ ...selectStyle, opacity: editando ? 0.6 : 1 }}>
              <option value="">Escolha…</option>
              {patios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>LATITUDE</Label>
          <input value={form.latitude} onChange={mudar("latitude")} placeholder="-23,5275" style={selectStyle} inputMode="decimal" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>LONGITUDE</Label>
          <input value={form.longitude} onChange={mudar("longitude")} placeholder="-46,6650" style={selectStyle} inputMode="decimal" />
        </label>
      </div>
      {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={salvar}>{salvando && <Loader2 size={14} className="spin" />} {editando ? "Salvar alterações" : "Adicionar local"}</Btn>
        {editando && <Btn variant="ghost" onClick={aoCancelar}><X size={14} /> Cancelar</Btn>}
      </div>
    </Panel>
  );
}

export function LocaisApi({ usuario, onLog }) {
  const podeEditar = podeEditarLocais(usuario?.papel);
  const [busca, setBusca] = useState("");
  const q = useAtrasado(busca.trim());
  const [tipo, setTipo] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(null);
  const [erroLinha, setErroLinha] = useState("");
  const [locais, setLocais] = useState(new Map());
  const consulta = useMemo(() => ({ q, kind: tipo }), [q, tipo]);

  // Catálogo completo: nomes dos pátios na tabela e lista de pátios no formulário.
  useEffect(() => {
    carregarLocais().then(setLocais).catch(() => {});
  }, [recarga]);
  const patios = useMemo(() => [...locais.values()].filter((l) => l.kind === "warehouse" && l.active), [locais]);

  function atualizou() {
    esquecerCatalogo("locais");
    setEditando(null);
    setRecarga((n) => n + 1);
  }

  async function alternarAtivo(l) {
    setErroLinha("");
    try {
      await api.patch(`/locais/${l.id}`, { active: !l.active });
      onLog?.(`Local ${l.name} ${l.active ? "desativado" : "reativado"}`);
      atualizou();
    } catch (erro) {
      setErroLinha(mensagemEscrita(erro));
    }
  }

  const coord = (v) => (v === null || v === undefined ? null : v);
  const botaoLinha = { background: "none", border: `1px solid ${COLOR.line}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", color: COLOR.textDim, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 };
  const colunas = [
    { key: "nome", label: "Local", valor: (l) => nomeLocal(l, locais), largura: 32 },
    { key: "tipo", label: "Tipo", valor: (l) => rotulo(TIPO_LOCAL, l.kind), largura: 16 },
    { key: "lat", label: "Latitude", valor: (l) => coord(l.latitude), formato: "numero", casas: 5, largura: 12 },
    { key: "lon", label: "Longitude", valor: (l) => coord(l.longitude), formato: "numero", casas: 5, largura: 12 },
    { key: "ativo", label: "Ativo", valor: (l) => simNao(l.active), largura: 8 },
    { key: "atualizado", label: "Atualizado em", valor: (l) => data(l.updated_at), formato: "dataHora", largura: 18 },
    ...(podeEditar
      ? [{
          key: "acoes", label: "Ações", valor: () => "", soTela: true,
          render: (l) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                style={botaoLinha}
                onClick={() => setEditando({
                  id: l.id, name: l.name, kind: l.kind, parent_id: l.parent_id ?? "",
                  latitude: l.latitude == null ? "" : String(l.latitude).replace(".", ","),
                  longitude: l.longitude == null ? "" : String(l.longitude).replace(".", ","),
                })}
              >
                <Pencil size={11} /> Editar
              </button>
              <button style={botaoLinha} onClick={() => alternarAtivo(l)}>
                <Power size={11} /> {l.active ? "Desativar" : "Reativar"}
              </button>
            </span>
          ),
        }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle
        icon={MapPin}
        title="Locais"
        sub={podeEditar ? "Pátios/armazéns e as ruas dentro deles" : "Pátios/armazéns e as ruas dentro deles (só supervisor e admin alteram)"}
      />
      {podeEditar && (
        <FormLocal key={editando?.id ?? "novo"} inicial={editando ?? VAZIO} patios={patios} aoSalvar={atualizou} aoCancelar={() => setEditando(null)} onLog={onLog} />
      )}
      {erroLinha && <div role="alert" style={{ color: COLOR.red, fontSize: 12 }}>{erroLinha}</div>}
      <TabelaApi
        caminho="/locais"
        consulta={consulta}
        colunas={colunas}
        recarga={recarga}
        vazio="Nenhum local com esses filtros."
        nomeArquivo="locais"
        nomeAba="Locais"
        onLog={onLog}
        filtros={
          <>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
              <Search size={14} color={COLOR.textFaint} style={{ position: "absolute", left: 10, top: 10 }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" style={{ ...selectStyle, width: "100%", paddingLeft: 30 }} />
            </div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...selectStyle, flex: "0 1 170px" }} title="Tipo">
              <option value="">Tipo: todos</option>
              {Object.entries(TIPO_LOCAL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </>
        }
      />
    </div>
  );
}
