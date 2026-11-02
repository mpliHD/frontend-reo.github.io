// LOGS E AUDITORIA — com a API
// GET /logs (supervisor e admin): toda escrita relevante gravada pela API, com
// quem fez, o quê, em qual entidade e o antes/depois (JSON).
import { useMemo, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { ACAO_LOG, ENTIDADE_LOG, data, rotulo } from "../rotulos.js";
import { Btn, Label, SectionTitle, selectStyle } from "../ui.jsx";
import { TabelaApi } from "./TabelaApi.jsx";

// Antes/depois em uma linha só ("role: operador · active: true"), para caber na tabela.
function resumoJson(obj) {
  if (!obj) return "";
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : v}`)
    .join(" · ");
}

const COLUNAS = [
  { key: "data", label: "Quando", valor: (l) => data(l.created_at), formato: "dataHora", largura: 18 },
  { key: "quem", label: "Quem", valor: (l) => (l.user ? `${l.user.name} (${l.user.registration})` : "sistema"), largura: 28 },
  { key: "acao", label: "Ação", valor: (l) => rotulo(ACAO_LOG, l.action), largura: 18 },
  { key: "entidade", label: "Entidade", valor: (l) => rotulo(ENTIDADE_LOG, l.entity), largura: 16 },
  { key: "id", label: "ID da entidade", valor: (l) => l.entity_id, mono: true, largura: 38, larguraTela: 110, dica: (l) => l.entity_id || undefined },
  { key: "antes", label: "Antes", valor: (l) => resumoJson(l.before), largura: 40, larguraTela: 220, dica: (l) => resumoJson(l.before) || undefined },
  { key: "depois", label: "Depois", valor: (l) => resumoJson(l.after), largura: 40, larguraTela: 220, dica: (l) => resumoJson(l.after) || undefined },
];

export function LogsApi({ onLog }) {
  const [entidade, setEntidade] = useState("");
  const [acao, setAcao] = useState("");
  const [de, setDe] = useState("");
  const consulta = useMemo(
    () => ({ entity: entidade, action: acao, de: de ? new Date(`${de}T00:00:00`).toISOString() : "" }),
    [entidade, acao, de],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={ClipboardList} title="Logs e auditoria" sub="Registros gravados pela API, mais recentes primeiro" />
      <TabelaApi
        caminho="/logs"
        consulta={consulta}
        colunas={COLUNAS}
        vazio="Nenhum registro de auditoria com esses filtros."
        nomeArquivo="logs_auditoria"
        nomeAba="Logs"
        onLog={onLog}
        filtros={
          <>
            <select value={entidade} onChange={(e) => setEntidade(e.target.value)} style={{ ...selectStyle, flex: "0 1 190px" }} title="Entidade">
              <option value="">Entidade: todas</option>
              {Object.entries(ENTIDADE_LOG).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <select value={acao} onChange={(e) => setAcao(e.target.value)} style={{ ...selectStyle, flex: "0 1 190px" }} title="Ação">
              <option value="">Ação: todas</option>
              {Object.entries(ACAO_LOG).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Label>DESDE</Label>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={selectStyle} />
            </label>
            {(entidade || acao || de) && (
              <Btn variant="subtle" small onClick={() => { setEntidade(""); setAcao(""); setDe(""); }}>
                <X size={13} /> Limpar
              </Btn>
            )}
          </>
        }
      />
    </div>
  );
}
