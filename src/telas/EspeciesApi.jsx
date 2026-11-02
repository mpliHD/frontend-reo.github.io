// CATÁLOGO DE ESPÉCIES DE MADEIRA — com a API
// GET /especies para todos; POST/PATCH só especialista e admin (classificar a
// madeira é papel do especialista). Espécie não é apagada: é desativada, para
// não perder o histórico dos dormentes que já a usam.
import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Power, Search, TreeDeciduous, X } from "lucide-react";
import { api } from "../api/index.js";
import { esquecerCatalogo } from "../api/catalogos.js";
import { podeEditarEspecies } from "../papeis.js";
import { data, simNao } from "../rotulos.js";
import { Btn, COLOR, Label, Panel, SectionTitle, selectStyle } from "../ui.jsx";
import { TabelaApi, useAtrasado } from "./TabelaApi.jsx";

function mensagemEscrita(erro) {
  if (erro.code === "species_code_taken") return "Já existe uma espécie com esse código.";
  if (erro.status === 403) return "Só especialista e admin alteram o catálogo.";
  if (erro.status === 422) return "Confira o código (sem espaços) e informe ao menos um nome.";
  return erro.detail;
}

function Campo({ label, ...props }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label>{label}</Label>
      <input {...props} style={{ ...selectStyle, opacity: props.disabled ? 0.6 : 1 }} />
    </label>
  );
}

const VAZIO = { id: null, code: "", scientific_name: "", common_name: "" };

// Formulário de criar (sem id) ou editar (com id; o código não muda).
function FormEspecie({ inicial, aoSalvar, aoCancelar, onLog }) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(form.id);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function salvar() {
    setErro("");
    const nomes = { scientific_name: form.scientific_name.trim() || null, common_name: form.common_name.trim() || null };
    if (!editando && !/^\S+$/.test(form.code.trim())) return setErro("Informe o código, sem espaços (ex.: 23).");
    if (!nomes.scientific_name && !nomes.common_name) return setErro("Informe o nome científico ou o popular.");
    setSalvando(true);
    try {
      const e = editando
        ? await api.patch(`/especies/${form.id}`, nomes)
        : await api.post("/especies", { code: form.code.trim(), ...nomes });
      onLog?.(`Espécie ${editando ? "alterada" : "criada"}: ${e.code}`);
      aoSalvar();
    } catch (e) {
      setErro(mensagemEscrita(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel accent={COLOR.green}>
      <SectionTitle icon={editando ? Pencil : Plus} title={editando ? `Editar espécie ${form.code}` : "Nova espécie"} sub="Código da ficha de dormentes e ao menos um nome" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Campo label="CÓDIGO" value={form.code} onChange={mudar("code")} placeholder="23" disabled={editando} />
        <Campo label="NOME CIENTÍFICO" value={form.scientific_name} onChange={mudar("scientific_name")} placeholder="Hymenaea courbaril" />
        <Campo label="NOME POPULAR" value={form.common_name} onChange={mudar("common_name")} placeholder="Jatobá" />
      </div>
      {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={salvar}>{salvando && <Loader2 size={14} className="spin" />} {editando ? "Salvar alterações" : "Adicionar espécie"}</Btn>
        {editando && <Btn variant="ghost" onClick={aoCancelar}><X size={14} /> Cancelar</Btn>}
      </div>
    </Panel>
  );
}

export function EspeciesApi({ usuario, onLog }) {
  const podeEditar = podeEditarEspecies(usuario?.papel);
  const [busca, setBusca] = useState("");
  const q = useAtrasado(busca.trim());
  const [ativa, setAtiva] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(null);
  const [erroLinha, setErroLinha] = useState("");
  const consulta = useMemo(() => ({ q, active: ativa }), [q, ativa]);

  function atualizou() {
    esquecerCatalogo("especies"); // filtros das outras telas passam a ver a mudança
    setEditando(null);
    setRecarga((n) => n + 1);
  }

  async function alternarAtiva(e) {
    setErroLinha("");
    try {
      await api.patch(`/especies/${e.id}`, { active: !e.active });
      onLog?.(`Espécie ${e.code} ${e.active ? "desativada" : "reativada"}`);
      atualizou();
    } catch (erro) {
      setErroLinha(mensagemEscrita(erro));
    }
  }

  const botaoLinha = { background: "none", border: `1px solid ${COLOR.line}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", color: COLOR.textDim, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 };
  const colunas = [
    { key: "codigo", label: "Código", valor: (e) => e.code, mono: true, largura: 8 },
    { key: "cientifico", label: "Nome científico", valor: (e) => e.scientific_name, largura: 40 },
    { key: "popular", label: "Nome popular", valor: (e) => e.common_name, largura: 28 },
    { key: "ativa", label: "Ativa", valor: (e) => simNao(e.active), largura: 8 },
    { key: "atualizada", label: "Atualizada em", valor: (e) => data(e.updated_at), formato: "dataHora", largura: 18 },
    ...(podeEditar
      ? [{
          key: "acoes", label: "Ações", valor: () => "", soTela: true,
          render: (e) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button style={botaoLinha} onClick={() => setEditando({ id: e.id, code: e.code, scientific_name: e.scientific_name ?? "", common_name: e.common_name ?? "" })}>
                <Pencil size={11} /> Editar
              </button>
              <button style={botaoLinha} onClick={() => alternarAtiva(e)}>
                <Power size={11} /> {e.active ? "Desativar" : "Reativar"}
              </button>
            </span>
          ),
        }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle
        icon={TreeDeciduous}
        title="Espécies de madeira"
        sub={podeEditar ? "Catálogo usado na classificação dos dormentes" : "Catálogo usado na classificação dos dormentes (só especialista e admin alteram)"}
      />
      {podeEditar && (
        <FormEspecie key={editando?.id ?? "nova"} inicial={editando ?? VAZIO} aoSalvar={atualizou} aoCancelar={() => setEditando(null)} onLog={onLog} />
      )}
      {erroLinha && <div role="alert" style={{ color: COLOR.red, fontSize: 12 }}>{erroLinha}</div>}
      <TabelaApi
        caminho="/especies"
        consulta={consulta}
        colunas={colunas}
        recarga={recarga}
        vazio="Nenhuma espécie com esses filtros."
        nomeArquivo="especies_madeira"
        nomeAba="Espécies"
        onLog={onLog}
        filtros={
          <>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
              <Search size={14} color={COLOR.textFaint} style={{ position: "absolute", left: 10, top: 10 }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código ou nome" style={{ ...selectStyle, width: "100%", paddingLeft: 30 }} />
            </div>
            <select value={ativa} onChange={(e) => setAtiva(e.target.value)} style={{ ...selectStyle, flex: "0 1 160px" }} title="Situação">
              <option value="">Ativas e inativas</option>
              <option value="true">Só ativas</option>
              <option value="false">Só inativas</option>
            </select>
          </>
        }
      />
    </div>
  );
}
