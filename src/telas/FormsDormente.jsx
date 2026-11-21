// FORMULÁRIOS DE ESCRITA DE DORMENTES (com a API)
// Cadastro, edição, movimentação, inspeção e ocorrência. Quem pode cada um é
// decidido pela API (FIELD_ROLES, INSPECTION_ROLES, SPECIES_ROLES); a tela só
// mostra o botão para os papéis certos (src/papeis.js) e traduz os erros.
// Cada cadastro manda um client_uuid novo: se a pessoa clicar duas vezes ou a
// rede cair no meio, a API devolve o mesmo registro em vez de duplicar.
import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { api } from "../api/index.js";
import { carregarEspecies, carregarLocais } from "../api/catalogos.js";
import { podeAlterarEspecieDormente, podeInspecionar } from "../papeis.js";
import {
  CONSERVACAO, RESULTADO_INSPECAO, STATUS_DORMENTE, TIPO_MOVIMENTO, TIPO_OCORRENCIA, UMIDADE,
  movimentosPossiveis, nomeEspecie, nomeLocal, rotulo, statusManuaisDe,
} from "../rotulos.js";
import { Btn, COLOR, FONT_CODE, Label, Panel, SectionTitle, selectStyle } from "../ui.jsx";

// Erros de escrita: o `code` da API vira uma frase para quem está na tela.
const MENSAGENS = {
  rfid_tag_taken: "Já existe um dormente com essa tag RFID.",
  sleeper_discarded: "Dormente descartado não pode ser movimentado, inspecionado nem mudar de status.",
  sleeper_quarantined: "Dormente em quarentena não pode ser retirado para a via.",
  not_in_stock: "Só dormente em estoque pode ser retirado.",
  already_in_yard: "O dormente já está no pátio: use transferência.",
  not_in_yard: "O dormente está fora do pátio: registre uma entrada.",
  same_location: "O dormente já está nesse local.",
  invalid_status_transition: "Essa mudança de status não é manual: use uma movimentação.",
  location_inactive: "Esse local está desativado.",
  species_inactive: "Essa espécie está desativada no catálogo.",
  location_required: "O dormente está fora do pátio: escolha o local da ocorrência.",
  location_not_found: "Local não encontrado.",
  species_not_found: "Espécie não encontrada.",
  sleeper_not_found: "Dormente não encontrado.",
  future_timestamp: "A data e hora não pode ser no futuro.",
};

export function mensagemEscrita(erro) {
  if (MENSAGENS[erro?.code]) return MENSAGENS[erro.code];
  if (erro?.status === 403) return erro.detail || "Seu papel não pode fazer isso.";
  if (erro?.status === 422 && erro.errors?.length) {
    const campos = [...new Set(erro.errors.map((e) => e.loc?.at(-1)).filter((c) => c && c !== "body"))];
    return campos.length ? `Confira os campos: ${campos.join(", ")}.` : erro.errors[0]?.msg || erro.detail;
  }
  return erro?.detail || "Não foi possível salvar.";
}

// UUID para o client_uuid (crypto.randomUUID existe em HTTPS e no localhost).
function novoUuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (Math.random() * 16) >> (c / 4)).toString(16));
}

// "" → null; "2,80" → 2.8 (vírgula decimal).
const numero = (texto) => {
  const t = String(texto ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
};
const textoOuNulo = (texto) => (String(texto ?? "").trim() === "" ? null : String(texto).trim());
// "2026-11-20T09:30" (datetime-local, fuso do navegador) → ISO UTC, ou null = agora.
const dataHora = (texto) => (texto ? new Date(texto).toISOString() : null);

function Campo({ label, children, largo }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: largo ? "1 / -1" : undefined }}>
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Caixa({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      {label}
    </label>
  );
}

const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 };

// Locais ativos e espécies ativas, para as listas dos formulários.
function useCatalogos() {
  const [locais, setLocais] = useState(new Map());
  const [especies, setEspecies] = useState(new Map());
  useEffect(() => {
    carregarLocais().then(setLocais).catch(() => {});
    carregarEspecies().then(setEspecies).catch(() => {});
  }, []);
  const opcoesLocal = useMemo(
    () => [...locais.values()].filter((l) => l.active).map((l) => ({ id: l.id, nome: nomeLocal(l, locais) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [locais],
  );
  const opcoesEspecie = useMemo(
    () => [...especies.values()].filter((e) => e.active).sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })),
    [especies],
  );
  return { locais, opcoesLocal, opcoesEspecie };
}

// Moldura comum: título, conteúdo, erro e botões Salvar / Cancelar.
function Moldura({ icone, titulo, sub, erro, salvando, rotuloSalvar, onSalvar, onCancelar, children }) {
  return (
    <Panel accent={COLOR.blue} style={{ marginBottom: 16 }}>
      <SectionTitle icon={icone} title={titulo} sub={sub} />
      {children}
      {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12.5, marginBottom: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={onSalvar}>{salvando && <Loader2 size={14} className="spin" />} {rotuloSalvar}</Btn>
        <Btn variant="ghost" onClick={onCancelar}><X size={14} /> Cancelar</Btn>
      </div>
    </Panel>
  );
}

// Envia uma escrita e cuida de "salvando" e do erro. `acao` devolve a promessa da API.
function useEnvio(onSalvo) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function enviar(acao) {
    if (salvando) return; // evita dois envios com duplo clique
    setErro("");
    setSalvando(true);
    try {
      const r = await acao();
      onSalvo(r);
    } catch (e) {
      setErro(mensagemEscrita(e));
      setSalvando(false);
    }
  }
  return { erro, setErro, salvando, enviar };
}

// Campos da plaqueta, comuns ao cadastro e à edição.
function CamposPlaqueta({ form, mudar }) {
  return (
    <>
      <Campo label="Ata de registro"><input value={form.registration_record} onChange={mudar("registration_record")} placeholder="AR00224-02" style={selectStyle} /></Campo>
      <Campo label="Classe"><input value={form.wood_class} onChange={mudar("wood_class")} placeholder="1a" style={selectStyle} /></Campo>
      <Campo label="Comprimento (m)"><input value={form.length_m} onChange={mudar("length_m")} placeholder="2,80" inputMode="decimal" style={selectStyle} /></Campo>
      <Campo label="Tratamento"><input value={form.treatment} onChange={mudar("treatment")} placeholder="CCA" style={selectStyle} /></Campo>
      <Campo label="Fornecedor"><input value={form.supplier} onChange={mudar("supplier")} placeholder="Granoski" style={selectStyle} /></Campo>
      <Campo label="Empresa inspetora"><input value={form.inspection_company} onChange={mudar("inspection_company")} style={selectStyle} /></Campo>
      <Campo label="Ano de fabricação"><input value={form.manufacture_year} onChange={mudar("manufacture_year")} placeholder="2024" inputMode="numeric" style={selectStyle} /></Campo>
    </>
  );
}

const plaquetaParaApi = (form) => ({
  registration_record: textoOuNulo(form.registration_record),
  wood_class: textoOuNulo(form.wood_class),
  length_m: numero(form.length_m),
  treatment: textoOuNulo(form.treatment),
  supplier: textoOuNulo(form.supplier),
  inspection_company: textoOuNulo(form.inspection_company),
  manufacture_year: numero(form.manufacture_year),
});

function validarPlaqueta(form) {
  const c = numero(form.length_m);
  if (c !== null && (Number.isNaN(c) || c <= 0 || c >= 100)) return "Comprimento inválido (em metros, ex.: 2,80).";
  const a = numero(form.manufacture_year);
  if (a !== null && (!Number.isInteger(a) || a < 1900 || a > 2100)) return "Ano de fabricação inválido.";
  return "";
}

// CADASTRO DE DORMENTE NOVO (POST /dormentes): já registra a entrada no local.
export function FormCadastroDormente({ icone, onCriado, onCancelar }) {
  const { opcoesLocal, opcoesEspecie } = useCatalogos();
  const [form, setForm] = useState({
    rfid_tag: "", location_id: "", species_id: "", registration_record: "", wood_class: "", length_m: "",
    treatment: "", supplier: "", inspection_company: "", manufacture_year: "", occurred_at: "",
  });
  const [clientUuid] = useState(novoUuid);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const { erro, setErro, salvando, enviar } = useEnvio(onCriado);

  function salvar() {
    if (!form.rfid_tag.trim()) return setErro("Informe a tag RFID.");
    if (/\s/.test(form.rfid_tag.trim())) return setErro("A tag RFID não pode ter espaços.");
    if (!form.location_id) return setErro("Escolha o local de entrada.");
    const problema = validarPlaqueta(form);
    if (problema) return setErro(problema);
    enviar(() => api.post("/dormentes", {
      rfid_tag: form.rfid_tag.trim(),
      location_id: form.location_id,
      species_id: form.species_id || null,
      ...plaquetaParaApi(form),
      occurred_at: dataHora(form.occurred_at),
      client_uuid: clientUuid,
    }));
  }

  return (
    <Moldura icone={icone} titulo="Cadastrar dormente" sub="Dados da plaqueta; o cadastro já registra a entrada no local escolhido"
      erro={erro} salvando={salvando} rotuloSalvar="Cadastrar" onSalvar={salvar} onCancelar={onCancelar}>
      <div style={grade}>
        <Campo label="Tag RFID *"><input value={form.rfid_tag} onChange={mudar("rfid_tag")} placeholder="E2801160600002084E5A1B21" style={{ ...selectStyle, fontFamily: FONT_CODE }} autoCapitalize="characters" /></Campo>
        <Campo label="Local de entrada *">
          <select value={form.location_id} onChange={mudar("location_id")} style={selectStyle}>
            <option value="">Escolha…</option>
            {opcoesLocal.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Espécie">
          <select value={form.species_id} onChange={mudar("species_id")} style={selectStyle}>
            <option value="">Não identificada</option>
            {opcoesEspecie.map((e) => <option key={e.id} value={e.id}>{nomeEspecie(e)}</option>)}
          </select>
        </Campo>
        <CamposPlaqueta form={form} mudar={mudar} />
        <Campo label="Data e hora da entrada (vazio = agora)"><input type="datetime-local" value={form.occurred_at} onChange={mudar("occurred_at")} style={selectStyle} /></Campo>
      </div>
    </Moldura>
  );
}

// EDIÇÃO (PATCH /dormentes/{id}): manda só o que mudou. Espécie: especialista e
// admin; status manual: técnico, especialista e admin (a API confere de novo).
export function FormEditarDormente({ icone, dormente, usuario, onSalvo, onCancelar }) {
  const { opcoesEspecie } = useCatalogos();
  const inicial = {
    rfid_tag: dormente.rfid_tag ?? "",
    species_id: dormente.species?.id ?? "",
    status: dormente.status,
    registration_record: dormente.registration_record ?? "",
    wood_class: dormente.wood_class ?? "",
    length_m: dormente.length_m == null ? "" : String(Number(dormente.length_m)).replace(".", ","),
    treatment: dormente.treatment ?? "",
    supplier: dormente.supplier ?? "",
    inspection_company: dormente.inspection_company ?? "",
    manufacture_year: dormente.manufacture_year ?? "",
  };
  const [form, setForm] = useState(inicial);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const { erro, setErro, salvando, enviar } = useEnvio(onSalvo);
  const trocaEspecie = podeAlterarEspecieDormente(usuario?.papel);
  const trocaStatus = podeInspecionar(usuario?.papel);
  const statusPossiveis = statusManuaisDe(dormente.status);

  function salvar() {
    if (!form.rfid_tag.trim() || /\s/.test(form.rfid_tag.trim())) return setErro("Tag RFID inválida (sem espaços).");
    const problema = validarPlaqueta(form);
    if (problema) return setErro(problema);
    const novo = { rfid_tag: form.rfid_tag.trim(), ...plaquetaParaApi(form) };
    const antigo = { rfid_tag: inicial.rfid_tag, ...plaquetaParaApi(inicial) };
    const mudancas = Object.fromEntries(Object.entries(novo).filter(([k, v]) => v !== antigo[k]));
    if (trocaEspecie && form.species_id !== inicial.species_id) mudancas.species_id = form.species_id || null;
    if (trocaStatus && form.status !== inicial.status) mudancas.status = form.status;
    if (Object.keys(mudancas).length === 0) return setErro("Nada mudou.");
    enviar(() => api.patch(`/dormentes/${dormente.id}`, mudancas));
  }

  return (
    <Moldura icone={icone} titulo="Editar dormente" sub="Só os campos alterados são enviados"
      erro={erro} salvando={salvando} rotuloSalvar="Salvar alterações" onSalvar={salvar} onCancelar={onCancelar}>
      <div style={grade}>
        <Campo label="Tag RFID"><input value={form.rfid_tag} onChange={mudar("rfid_tag")} style={{ ...selectStyle, fontFamily: FONT_CODE }} /></Campo>
        <Campo label={trocaEspecie ? "Espécie" : "Espécie (só especialista e admin)"}>
          <select value={form.species_id} onChange={mudar("species_id")} disabled={!trocaEspecie} style={{ ...selectStyle, opacity: trocaEspecie ? 1 : 0.6 }}>
            <option value="">Não identificada</option>
            {opcoesEspecie.map((e) => <option key={e.id} value={e.id}>{nomeEspecie(e)}</option>)}
            {/* espécie atual desativada continua aparecendo para não sumir da tela */}
            {dormente.species && !opcoesEspecie.some((e) => e.id === dormente.species.id) && (
              <option value={dormente.species.id}>{nomeEspecie(dormente.species)}</option>
            )}
          </select>
        </Campo>
        <Campo label={trocaStatus ? "Status" : "Status (técnico ou acima)"}>
          <select value={form.status} onChange={mudar("status")} disabled={!trocaStatus || statusPossiveis.length === 0} style={{ ...selectStyle, opacity: trocaStatus ? 1 : 0.6 }}>
            <option value={dormente.status}>{rotulo(STATUS_DORMENTE, dormente.status)} (atual)</option>
            {statusPossiveis.map((s) => <option key={s} value={s}>{rotulo(STATUS_DORMENTE, s)}</option>)}
          </select>
        </Campo>
        <CamposPlaqueta form={form} mudar={mudar} />
      </div>
    </Moldura>
  );
}

// MOVIMENTAÇÃO (POST /estoque/movimentacao): entrada, transferência ou retirada (com RM).
export function FormMovimento({ icone, dormente, onSalvo, onCancelar }) {
  const { opcoesLocal } = useCatalogos();
  const tipos = movimentosPossiveis(dormente);
  const [form, setForm] = useState({ kind: tipos[0] ?? "", to_location_id: "", requisition_number: "", notes: "", occurred_at: "" });
  const [clientUuid] = useState(novoUuid);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const { erro, setErro, salvando, enviar } = useEnvio(onSalvo);
  const retirada = form.kind === "withdrawal";
  const destinos = opcoesLocal.filter((l) => l.id !== dormente.current_location?.id);

  function salvar() {
    if (!form.kind) return setErro("Este dormente não pode ser movimentado.");
    if (retirada && !form.requisition_number.trim()) return setErro("Informe o número da RM.");
    if (!retirada && !form.to_location_id) return setErro("Escolha o destino.");
    enviar(() => api.post("/estoque/movimentacao", {
      sleeper_id: dormente.id,
      kind: form.kind,
      to_location_id: retirada ? null : form.to_location_id,
      requisition_number: retirada ? form.requisition_number.trim() : null,
      notes: textoOuNulo(form.notes),
      occurred_at: dataHora(form.occurred_at),
      client_uuid: clientUuid,
    }));
  }

  return (
    <Moldura icone={icone} titulo="Movimentar dormente" sub={`Hoje: ${rotulo(STATUS_DORMENTE, dormente.status)}${dormente.current_location ? ` em ${dormente.current_location.name}` : ", fora do pátio"}`}
      erro={erro} salvando={salvando} rotuloSalvar="Registrar movimentação" onSalvar={salvar} onCancelar={onCancelar}>
      <div style={grade}>
        <Campo label="Tipo">
          <select value={form.kind} onChange={mudar("kind")} style={selectStyle}>
            {tipos.map((k) => <option key={k} value={k}>{rotulo(TIPO_MOVIMENTO, k)}</option>)}
          </select>
        </Campo>
        {retirada ? (
          <Campo label="Número da RM *"><input value={form.requisition_number} onChange={mudar("requisition_number")} placeholder="RM-26-1450" style={{ ...selectStyle, fontFamily: FONT_CODE }} /></Campo>
        ) : (
          <Campo label="Destino *">
            <select value={form.to_location_id} onChange={mudar("to_location_id")} style={selectStyle}>
              <option value="">Escolha…</option>
              {destinos.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Data e hora (vazio = agora)"><input type="datetime-local" value={form.occurred_at} onChange={mudar("occurred_at")} style={selectStyle} /></Campo>
        <Campo label="Observação" largo><input value={form.notes} onChange={mudar("notes")} placeholder="Opcional" style={selectStyle} /></Campo>
      </div>
    </Moldura>
  );
}

// INSPEÇÃO (POST /inspecoes): checklist digital. Reprovada põe em quarentena.
export function FormInspecao({ icone, dormente, onSalvo, onCancelar }) {
  const { opcoesEspecie } = useCatalogos();
  const [form, setForm] = useState({
    conservation: "good", moisture: "dry", has_cracks: false, biological_attack: false, estimated_life_years: "",
    species_confirmed: "", species_corrected_id: "", result: "approved", duracao_min: "", notes: "", inspected_at: "",
  });
  const [clientUuid] = useState(novoUuid);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const marcar = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }));
  const { erro, setErro, salvando, enviar } = useEnvio(onSalvo);

  function salvar() {
    const vida = numero(form.estimated_life_years);
    if (vida !== null && (!Number.isInteger(vida) || vida < 0 || vida > 100)) return setErro("Vida útil: número inteiro de 0 a 100 anos.");
    const minutos = numero(form.duracao_min);
    if (minutos !== null && (Number.isNaN(minutos) || minutos < 0 || minutos > 1440)) return setErro("Duração inválida (em minutos).");
    const confirmada = form.species_confirmed === "" ? null : form.species_confirmed === "sim";
    enviar(() => api.post("/inspecoes", {
      sleeper_id: dormente.id,
      conservation: form.conservation,
      moisture: form.moisture,
      has_cracks: form.has_cracks,
      biological_attack: form.biological_attack,
      estimated_life_years: vida,
      species_confirmed: confirmada,
      // a espécie corrigida só vai quando a pessoa disse que a espécie NÃO confere
      species_corrected_id: confirmada === false && form.species_corrected_id ? form.species_corrected_id : null,
      result: form.result,
      duration_seconds: minutos === null ? null : Math.round(minutos * 60),
      notes: textoOuNulo(form.notes),
      inspected_at: dataHora(form.inspected_at),
      client_uuid: clientUuid,
    }));
  }

  return (
    <Moldura icone={icone} titulo="Registrar inspeção" sub="Inspeção reprovada coloca o dormente em quarentena"
      erro={erro} salvando={salvando} rotuloSalvar="Registrar inspeção" onSalvar={salvar} onCancelar={onCancelar}>
      <div style={grade}>
        <Campo label="Conservação">
          <select value={form.conservation} onChange={mudar("conservation")} style={selectStyle}>
            {Object.entries(CONSERVACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo label="Umidade">
          <select value={form.moisture} onChange={mudar("moisture")} style={selectStyle}>
            {Object.entries(UMIDADE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo label="Vida útil estimada (anos)"><input value={form.estimated_life_years} onChange={mudar("estimated_life_years")} inputMode="numeric" placeholder="Opcional" style={selectStyle} /></Campo>
        <Campo label="Duração da inspeção (min)"><input value={form.duracao_min} onChange={mudar("duracao_min")} inputMode="decimal" placeholder="Opcional" style={selectStyle} /></Campo>
        <Campo label={`Espécie confere? (cadastro: ${nomeEspecie(dormente.species) || "não identificada"})`}>
          <select value={form.species_confirmed} onChange={mudar("species_confirmed")} style={selectStyle}>
            <option value="">Não avaliado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </Campo>
        {form.species_confirmed === "nao" && (
          <Campo label="Espécie correta">
            <select value={form.species_corrected_id} onChange={mudar("species_corrected_id")} style={selectStyle}>
              <option value="">Não sei</option>
              {opcoesEspecie.map((e) => <option key={e.id} value={e.id}>{nomeEspecie(e)}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Resultado">
          <select value={form.result} onChange={mudar("result")} style={selectStyle}>
            {Object.entries(RESULTADO_INSPECAO).map(([v, r]) => <option key={v} value={v}>{r.rotulo}</option>)}
          </select>
        </Campo>
        <Campo label="Data e hora (vazio = agora)"><input type="datetime-local" value={form.inspected_at} onChange={mudar("inspected_at")} style={selectStyle} /></Campo>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", gridColumn: "1 / -1" }}>
          <Caixa label="Tem trincas" checked={form.has_cracks} onChange={marcar("has_cracks")} />
          <Caixa label="Ataque biológico (fungo, cupim)" checked={form.biological_attack} onChange={marcar("biological_attack")} />
        </div>
        <Campo label="Observação" largo><input value={form.notes} onChange={mudar("notes")} placeholder="Opcional" style={selectStyle} /></Campo>
      </div>
    </Moldura>
  );
}

// OCORRÊNCIA (POST /estoque/ocorrencias): dano, perda, fora do lugar ou outra.
// O local é o atual do dormente; fora do pátio, a pessoa escolhe.
export function FormOcorrencia({ icone, dormente, onSalvo, onCancelar }) {
  const { opcoesLocal } = useCatalogos();
  const [form, setForm] = useState({ kind: "damage", description: "", location_id: dormente.current_location?.id ?? "", occurred_at: "" });
  const [clientUuid] = useState(novoUuid);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const { erro, setErro, salvando, enviar } = useEnvio(onSalvo);

  function salvar() {
    if (form.description.trim().length < 3) return setErro("Descreva a ocorrência (pelo menos 3 letras).");
    if (!dormente.current_location && !form.location_id) return setErro("Escolha o local da ocorrência.");
    enviar(() => api.post("/estoque/ocorrencias", {
      sleeper_id: dormente.id,
      kind: form.kind,
      description: form.description.trim(),
      location_id: form.location_id || null,
      occurred_at: dataHora(form.occurred_at),
      client_uuid: clientUuid,
    }));
  }

  return (
    <Moldura icone={icone} titulo="Registrar ocorrência" sub="Dano, perda ou dormente fora do lugar"
      erro={erro} salvando={salvando} rotuloSalvar="Registrar ocorrência" onSalvar={salvar} onCancelar={onCancelar}>
      <div style={grade}>
        <Campo label="Tipo">
          <select value={form.kind} onChange={mudar("kind")} style={selectStyle}>
            {Object.entries(TIPO_OCORRENCIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo label={dormente.current_location ? "Local" : "Local *"}>
          <select value={form.location_id} onChange={mudar("location_id")} style={selectStyle}>
            <option value="">{dormente.current_location ? "Local atual do dormente" : "Escolha…"}</option>
            {opcoesLocal.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Data e hora (vazio = agora)"><input type="datetime-local" value={form.occurred_at} onChange={mudar("occurred_at")} style={selectStyle} /></Campo>
        <Campo label="Descrição *" largo>
          <textarea value={form.description} onChange={mudar("description")} rows={3} placeholder="O que aconteceu?" style={{ ...selectStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Campo>
      </div>
    </Moldura>
  );
}
