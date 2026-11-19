// TABELA PAGINADA PELA API
// Versão "servidor" da tabela de VisaoDormentes: filtros e paginação são
// feitos pela API (limit/offset), não no navegador. Por isso não há ordenação
// por coluna nem busca em qualquer coluna (a API não oferece); a busca de
// texto, quando existe, é o filtro `q` da própria rota.
// - consulta: filtros da rota (ex.: { status: "in_stock" }). Mudou → volta à página 1.
// - enriquecer: opcional, recebe os itens da página e devolve as linhas da
//   tabela (ex.: trocar ids por nomes). Também é usado na exportação.
// - Excel: baixa TODAS as páginas com o filtro atual (api.listarTudo).
// - recarga: número que, ao mudar, busca a página de novo (ex.: depois de editar).
// - Coluna com `render(linha)` desenha a célula na tela (ex.: um select); o
//   Excel continua usando `valor`.
// - onLinhaClick: opcional; com ele a linha fica clicável (ex.: abrir o detalhe).
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { api } from "../api/index.js";
import { baixarExcel, formatarValor } from "../excel.js";
import { Btn, COLOR, EmptyState, FONT_BODY, FONT_MONO, Panel, Selo } from "../ui.jsx";

const POR_PAGINA = 50;

// Texto do erro para a tela. 403 aqui quer dizer que o menu mostrou uma aba
// que o papel não pode abrir: avisamos em vez de mostrar a mensagem crua.
export function mensagemErro(erro) {
  if (erro?.status === 403) return "Seu papel não tem acesso a estes dados.";
  return erro?.detail || "Não foi possível carregar os dados.";
}

// Atrasa um valor (ex.: texto digitado na busca) para não chamar a API a cada tecla.
export function useAtrasado(valor, ms = 350) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

const semEnriquecer = async (itens) => itens;

export function TabelaApi({ caminho, consulta, colunas, enriquecer = semEnriquecer, filtros, vazio, nomeArquivo, nomeAba, onLog, aoCarregar, recarga = 0, onLinhaClick }) {
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState({ linhas: [], total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState(false);
  const chaveConsulta = JSON.stringify(consulta);

  // Filtro mudou: volta para a primeira página.
  useEffect(() => setOffset(0), [chaveConsulta]);

  useEffect(() => {
    let ativo = true; // descarta a resposta se o filtro mudar antes dela chegar
    setCarregando(true);
    setErro("");
    api.get(caminho, { ...consulta, limit: POR_PAGINA, offset })
      .then(async (resp) => {
        const linhas = await enriquecer(resp.items);
        if (!ativo) return;
        setPagina({ linhas, total: resp.total });
        aoCarregar?.(resp.total);
      })
      .catch((e) => ativo && setErro(mensagemErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
    // A consulta entra pela chave serializada: um objeto novo com os mesmos
    // filtros não dispara outra chamada.
  }, [caminho, chaveConsulta, offset, recarga]);

  async function exportar() {
    setExportando(true);
    setErro("");
    try {
      const linhas = await enriquecer(await api.listarTudo(caminho, consulta));
      await baixarExcel({ nomeArquivo, abas: [{ nome: nomeAba, colunas, linhas }] });
      onLog?.(`Exportação para Excel: ${nomeAba} (${linhas.length} linhas)`);
    } catch (e) {
      setErro(e?.detail ? mensagemErro(e) : "Não foi possível gerar o arquivo do Excel. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }

  const colunasTela = colunas.filter((c) => !c.soExcel);
  const fim = Math.min(offset + POR_PAGINA, pagina.total);

  return (
    <Panel>
      {filtros && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>{filtros}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLOR.textDim, display: "flex", alignItems: "center", gap: 6 }}>
          {carregando && <Loader2 size={12} className="spin" />}
          {pagina.total ? `${offset + 1}–${fim} de ${pagina.total.toLocaleString("pt-BR")} registros` : "0 registros"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="subtle" small onClick={() => setOffset((o) => Math.max(0, o - POR_PAGINA))}>
            <ChevronLeft size={13} /> Anterior
          </Btn>
          <Btn variant="subtle" small onClick={() => setOffset((o) => (o + POR_PAGINA < pagina.total ? o + POR_PAGINA : o))}>
            Próxima <ChevronRight size={13} />
          </Btn>
          <Btn small onClick={exportar}>
            {exportando ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {exportando ? "Gerando…" : `Exportar para Excel (${pagina.total.toLocaleString("pt-BR")})`}
          </Btn>
        </div>
      </div>
      {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12, marginBottom: 10 }}>{erro}</div>}

      {!carregando && !erro && pagina.linhas.length === 0 ? (
        <EmptyState text={vazio} />
      ) : (
        <div style={{ overflow: "auto", maxHeight: "60vh", border: `1px solid ${COLOR.line}`, borderRadius: 4, opacity: carregando ? 0.6 : 1 }}>
          <table>
            <thead>
              <tr>
                {colunasTela.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      position: "sticky", top: 0, zIndex: 1, background: COLOR.panelAlt,
                      textAlign: c.formato === "numero" ? "right" : "left", fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.textDim,
                      padding: "8px 10px", borderBottom: `1px solid ${COLOR.line}`, whiteSpace: "nowrap",
                    }}
                  >
                    {c.label.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagina.linhas.map((linha, i) => (
                <tr
                  key={linha.id ?? i}
                  onClick={onLinhaClick ? () => onLinhaClick(linha) : undefined}
                  style={{ background: i % 2 ? COLOR.panelAlt : "transparent", cursor: onLinhaClick ? "pointer" : undefined }}
                >
                  {colunasTela.map((c) => {
                    const v = c.valor(linha);
                    return (
                      <td
                        key={c.key}
                        title={c.dica ? c.dica(linha) : undefined}
                        style={{
                          padding: "7px 10px", fontSize: 12.5, borderBottom: `1px solid ${COLOR.line}`, whiteSpace: "nowrap",
                          textAlign: c.formato === "numero" ? "right" : "left", fontFamily: c.mono ? FONT_MONO : FONT_BODY,
                          color: v === "" || v === null || v === undefined ? COLOR.textFaint : COLOR.text,
                          maxWidth: c.larguraTela, overflow: "hidden", textOverflow: "ellipsis",
                        }}
                      >
                        {c.render ? c.render(linha) : c.formato === "selo" ? <Selo texto={v} tom={c.tom(linha)} /> : formatarValor(c, v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
