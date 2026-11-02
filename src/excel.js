// Gera arquivos .xlsx dentro do navegador (usado nos botões "Exportar para Excel").
// A versão "universal" não depende de Web Worker, então funciona no GitHub Pages sem configuração extra.
import writeXlsxFile from "write-excel-file/universal";
import { COLOR } from "./ui.jsx";

// EXPORTAÇÃO PARA EXCEL
// Gera um arquivo .xlsx de verdade (não CSV) dentro do próprio navegador,
// sem enviar nada a servidor nenhum. Cada "aba" do arquivo é uma tabela.
// - formatarValor: texto exibido na tela (e usado na busca) para cada tipo de dado.
// - celulaExcel: converte o dado cru em célula do Excel com o tipo certo
//   (número como número, data como data, moeda com "R$"), para que o Excel
//   consiga somar, filtrar e montar tabela dinâmica sem precisar converter nada.
//   Condição: valor vazio vira célula vazia, nunca o texto "—" usado na tela.
// - baixarExcel: monta as abas (cabeçalho vermelho CPTM com texto branco e
//   primeira linha congelada), cria o arquivo e dispara o download.
export function formatarValor(coluna, v) {
  if (v === null || v === undefined || v === "") return "—";
  switch (coluna.formato) {
    case "numero":
      return v.toLocaleString("pt-BR", { minimumFractionDigits: coluna.casas ?? 0, maximumFractionDigits: coluna.casas ?? 0 });
    case "moeda":
      return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "data":
      return v.toLocaleDateString("pt-BR");
    case "dataHora": // datas da API (UTC) mostradas no fuso do navegador
      return v.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    default:
      return String(v);
  }
}

export function celulaExcel(coluna, linha) {
  const v = coluna.valor(linha);
  if (v === null || v === undefined || v === "") return null;
  switch (coluna.formato) {
    case "numero": {
      const casas = coluna.casas ?? 0;
      return { value: v, type: Number, format: casas ? `#,##0.${"0".repeat(casas)}` : "#,##0" };
    }
    case "moeda":
      return { value: v, type: Number, format: '"R$" #,##0.00' };
    case "data":
      return { value: v, type: Date, format: "dd/mm/yyyy" };
    case "dataHora":
      return { value: v, type: Date, format: "dd/mm/yyyy hh:mm" };
    default:
      return { value: String(v), type: String };
  }
}

export async function baixarExcel({ nomeArquivo, abas }) {
  const planilhas = abas.map((aba) => {
    const colunas = aba.colunas.filter((c) => !c.soTela);
    return {
      sheet: aba.nome.slice(0, 31), // o Excel limita o nome da aba a 31 caracteres
      data: [
        colunas.map((c) => ({ value: c.label, fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: COLOR.red })),
        ...aba.linhas.map((linha) => colunas.map((c) => celulaExcel(c, linha))),
      ],
      columns: colunas.map((c) => ({ width: c.largura || 16 })),
      stickyRowsCount: 1,
    };
  });

  const blob = await writeXlsxFile(planilhas).toBlob();
  const hoje = new Date();
  const dataArquivo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}_${dataArquivo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
