// RETIRADAS (RM) — com a API
// Substitui "Dormentes em Pedido" do modo demonstração: a API não tem
// requisições com prazo/prioridade, só o número da RM gravado em cada
// retirada (GET /estoque/movimentacoes?kind=withdrawal).
// A rota devolve só ids; os nomes são resolvidos aqui (decisão de 2026-11-02):
// - local: catálogo /locais (uma chamada por sessão);
// - tag e espécie: GET /dormentes/{id} de cada dormente da página, com cache;
// - responsável: GET /usuarios, que só supervisor e admin podem chamar; para
//   os outros papéis a coluna fica vazia.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, X } from "lucide-react";
import { carregarDormentes, carregarLocais, carregarUsuarios } from "../api/catalogos.js";
import { podeVerAba } from "../papeis.js";
import { data, nomeEspecie, nomeLocal } from "../rotulos.js";
import { Btn, COLOR, FONT_DISPLAY, Label, Panel, SectionTitle, selectStyle } from "../ui.jsx";
import { TabelaApi } from "./TabelaApi.jsx";

// "2026-10-21" (input type=date, dia local) → início desse dia em UTC ISO.
function inicioDoDia(texto, somarDias = 0) {
  if (!texto) return "";
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d + somarDias).toISOString();
}

function colunas(mostrarResponsavel) {
  return [
    { key: "data", label: "Data", valor: (l) => data(l.occurred_at), formato: "dataHora", largura: 18 },
    { key: "rm", label: "RM", valor: (l) => l.requisition_number, mono: true, largura: 16 },
    { key: "tag", label: "Tag RFID", valor: (l) => l.dormente?.rfid_tag ?? null, mono: true, largura: 26 },
    { key: "especie", label: "Espécie", valor: (l) => nomeEspecie(l.dormente?.species), largura: 30, larguraTela: 220 },
    { key: "origem", label: "Saiu de", valor: (l) => l.origem, largura: 28 },
    ...(mostrarResponsavel ? [{ key: "responsavel", label: "Responsável", valor: (l) => l.responsavel, largura: 24 }] : []),
    { key: "obs", label: "Observação", valor: (l) => l.notes, largura: 40, larguraTela: 260, dica: (l) => l.notes || undefined },
  ];
}

export function RetiradasApi({ usuario, onLog }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [total, setTotal] = useState(null);
  const mostrarResponsavel = podeVerAba("usuarios", usuario?.papel);

  // `ate` é inclusivo na tela (o dia inteiro) e exclusivo na API: soma 1 dia.
  const periodoInvalido = de && ate && ate < de;
  const consulta = useMemo(
    () => ({ kind: "withdrawal", de: periodoInvalido ? "" : inicioDoDia(de), ate: periodoInvalido ? "" : inicioDoDia(ate, 1) }),
    [de, ate, periodoInvalido],
  );

  const enriquecer = useCallback(
    async (itens) => {
      const [locais, dormentes, usuarios] = await Promise.all([
        carregarLocais().catch(() => new Map()),
        carregarDormentes(itens.map((m) => m.sleeper_id)),
        mostrarResponsavel ? carregarUsuarios().catch(() => new Map()) : new Map(),
      ]);
      return itens.map((m) => ({
        ...m,
        dormente: dormentes.get(m.sleeper_id) ?? null,
        origem: nomeLocal(locais.get(m.from_location_id), locais),
        responsavel: usuarios.get(m.user_id)?.name ?? "",
      }));
    },
    [mostrarResponsavel],
  );

  const cols = useMemo(() => colunas(mostrarResponsavel), [mostrarResponsavel]);

  // Limpa o total ao trocar o período, para não mostrar o número antigo.
  useEffect(() => setTotal(null), [consulta]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={ClipboardCheck} title="Retiradas (RM)" sub="Dormentes retirados do pátio para a via, com o número da requisição de material" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Panel accent={COLOR.blue}>
          <ClipboardCheck size={16} color={COLOR.blue} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, marginTop: 10 }}>
            {total === null ? "…" : total.toLocaleString("pt-BR")}
          </div>
          <div style={{ fontSize: 11.5, color: COLOR.textDim, marginTop: 2 }}>
            {de || ate ? "Retiradas no período" : "Retiradas registradas"}
          </div>
        </Panel>
      </div>

      <TabelaApi
        caminho="/estoque/movimentacoes"
        consulta={consulta}
        colunas={cols}
        enriquecer={enriquecer}
        aoCarregar={setTotal}
        vazio="Nenhuma retirada registrada nesse período."
        nomeArquivo="retiradas_rm"
        nomeAba="Retiradas (RM)"
        onLog={onLog}
        filtros={
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Label>DE</Label>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={selectStyle} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Label>ATÉ</Label>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={selectStyle} />
            </label>
            {(de || ate) && (
              <Btn variant="subtle" small onClick={() => { setDe(""); setAte(""); }}>
                <X size={13} /> Limpar
              </Btn>
            )}
            {periodoInvalido && <span style={{ color: COLOR.red, fontSize: 12 }}>A data final precisa ser depois da inicial.</span>}
          </>
        }
      />
    </div>
  );
}
