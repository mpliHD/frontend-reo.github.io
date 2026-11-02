// DETALHE DO DORMENTE (com a API)
// Janela com os dados da plaqueta e a linha do tempo do dormente:
// GET /dormentes/{id}/historico devolve movimentações, inspeções e ocorrências
// já em ordem. Os ids (locais, usuários, espécie corrigida) viram nomes pelos
// catálogos; o nome de quem fez só aparece para supervisor e admin.
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRightLeft, ClipboardList, Loader2, X } from "lucide-react";
import { api } from "../api/index.js";
import { carregarEspecies, carregarLocais, carregarUsuarios } from "../api/catalogos.js";
import { podeVerAba } from "../papeis.js";
import {
  CONSERVACAO, RESULTADO_INSPECAO, STATUS_DORMENTE, TIPO_MOVIMENTO, TIPO_OCORRENCIA, UMIDADE,
  duracao, nomeEspecie, nomeLocal, rotulo, tomStatus,
} from "../rotulos.js";
import { COLOR, FONT_DISPLAY, FONT_MONO, Label, Selo } from "../ui.jsx";
import { mensagemErro } from "./TabelaApi.jsx";

const ICONE = { movement: ArrowRightLeft, inspection: ClipboardList, occurrence: AlertTriangle };

function Dado({ rotulo: r, valor }) {
  return (
    <div>
      <Label>{r.toUpperCase()}</Label>
      <div style={{ fontSize: 13, marginTop: 3, color: valor ? COLOR.text : COLOR.textFaint }}>{valor || "—"}</div>
    </div>
  );
}

// Uma entrada da linha do tempo em texto: título + detalhes.
function descrever(item, nomes) {
  const quem = nomes.usuarios.get(item[item.type]?.user_id ?? item[item.type]?.inspector_id)?.name;
  if (item.type === "movement") {
    const m = item.movement;
    const de = nomeLocal(nomes.locais.get(m.from_location_id), nomes.locais);
    const para = nomeLocal(nomes.locais.get(m.to_location_id), nomes.locais);
    return {
      titulo: rotulo(TIPO_MOVIMENTO, m.kind),
      detalhes: [de && para ? `${de} → ${para}` : de ? `saiu de ${de}` : para ? `entrou em ${para}` : "", m.requisition_number && `RM ${m.requisition_number}`, m.notes, quem]
        .filter(Boolean),
    };
  }
  if (item.type === "inspection") {
    const i = item.inspection;
    const corrigida = i.species_corrected_id ? nomeEspecie(nomes.especies.get(i.species_corrected_id)) : "";
    return {
      titulo: `Inspeção ${rotulo(RESULTADO_INSPECAO, i.result).toLowerCase()}`,
      selo: { texto: rotulo(RESULTADO_INSPECAO, i.result), tom: RESULTADO_INSPECAO[i.result]?.tom },
      detalhes: [
        `conservação ${rotulo(CONSERVACAO, i.conservation).toLowerCase()}`,
        `umidade ${rotulo(UMIDADE, i.moisture).toLowerCase()}`,
        i.has_cracks && "com trincas",
        i.biological_attack && "ataque biológico",
        i.estimated_life_years != null && `vida útil estimada ${i.estimated_life_years} anos`,
        i.species_confirmed === false && `espécie corrigida${corrigida ? ` para ${corrigida}` : ""}`,
        i.duration_seconds != null && `duração ${duracao(i.duration_seconds)}`,
        i.notes,
        quem,
      ].filter(Boolean),
    };
  }
  const o = item.occurrence;
  return {
    titulo: `Ocorrência: ${rotulo(TIPO_OCORRENCIA, o.kind).toLowerCase()}`,
    detalhes: [nomeLocal(nomes.locais.get(o.location_id), nomes.locais), o.description, quem].filter(Boolean),
  };
}

export function DetalheDormente({ id, usuario, onClose }) {
  const [hist, setHist] = useState(null);
  const [nomes, setNomes] = useState({ locais: new Map(), usuarios: new Map(), especies: new Map() });
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    Promise.all([
      api.get(`/dormentes/${id}/historico`),
      carregarLocais().catch(() => new Map()),
      podeVerAba("usuarios", usuario?.papel) ? carregarUsuarios().catch(() => new Map()) : new Map(),
      carregarEspecies().catch(() => new Map()),
    ]).then(
      ([h, locais, usuarios, especies]) => { if (ativo) { setHist(h); setNomes({ locais, usuarios, especies }); } },
      (e) => ativo && setErro(mensagemErro(e)),
    );
    return () => { ativo = false; };
  }, [id, usuario?.papel]);

  // Esc fecha a janela.
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);

  const d = hist?.sleeper;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,15,20,.45)", zIndex: 80, display: "flex", justifyContent: "flex-end" }}>
      <div
        role="dialog"
        aria-label="Detalhe do dormente"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", height: "100%", background: COLOR.panel, overflowY: "auto", padding: 22, animation: "slide-in .2s ease", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <Label>DORMENTE</Label>
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600, marginTop: 4, wordBreak: "break-all" }}>{d?.rfid_tag ?? "…"}</div>
            {d && <div style={{ marginTop: 8 }}><Selo texto={rotulo(STATUS_DORMENTE, d.status)} tom={tomStatus(d.status)} /></div>}
          </div>
          <button onClick={onClose} title="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: COLOR.textDim, display: "flex", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12.5 }}>{erro}</div>}
        {!hist && !erro && <div style={{ display: "flex", gap: 8, alignItems: "center", color: COLOR.textDim, fontSize: 12.5 }}><Loader2 size={14} className="spin" /> Carregando histórico…</div>}

        {d && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}>
              <Dado rotulo="Ata de registro" valor={d.registration_record} />
              <Dado rotulo="Espécie" valor={nomeEspecie(d.species)} />
              <Dado rotulo="Classe" valor={d.wood_class} />
              <Dado rotulo="Comprimento" valor={d.length_m != null ? `${Number(d.length_m).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m` : ""} />
              <Dado rotulo="Tratamento" valor={d.treatment} />
              <Dado rotulo="Fornecedor" valor={d.supplier} />
              <Dado rotulo="Empresa inspetora" valor={d.inspection_company} />
              <Dado rotulo="Ano de fabricação" valor={d.manufacture_year} />
              <Dado rotulo="Local atual" valor={nomeLocal(d.current_location, nomes.locais)} />
              <Dado rotulo="Cadastrado em" valor={new Date(d.created_at).toLocaleString("pt-BR")} />
            </div>

            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>Histórico ({hist.items.length})</div>
            {hist.items.length === 0 && <div style={{ fontSize: 12.5, color: COLOR.textFaint }}>Nenhum registro ainda.</div>}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {hist.items.map((item, i) => {
                const Icone = ICONE[item.type] ?? ClipboardList;
                const t = descrever(item, nomes);
                return (
                  <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 14, position: "relative" }}>
                    {/* trilho vertical ligando os eventos */}
                    {i < hist.items.length - 1 && <div style={{ position: "absolute", left: 13, top: 28, bottom: 0, width: 1, background: COLOR.line }} />}
                    <div style={{ width: 27, height: 27, borderRadius: 99, background: COLOR.panelAlt, border: `1px solid ${COLOR.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icone size={13} color={COLOR.textDim} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.titulo}</span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.textFaint }}>{new Date(item.occurred_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div style={{ fontSize: 12, color: COLOR.textDim, marginTop: 3, lineHeight: 1.5 }}>{t.detalhes.join(" · ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
