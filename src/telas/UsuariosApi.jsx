// USUÁRIOS & PERMISSÕES — com a API
// - Supervisor: só consulta (GET /usuarios).
// - Admin: também cria (POST /usuarios), troca papel (PATCH /usuarios/{id}/papel)
//   e convida (POST /usuarios/convite).
// O convite: a API gera o token e o link (a base vem de INVITE_BASE_URL no
// .env da API) e NÃO envia e-mail; o site abre o e-mail do usuário com esse
// link. TODO(decidir): provedor de e-mail real (CONTEXTO.md).
import { useMemo, useState } from "react";
import { Link2, Loader2, Mail, Plus, Search, Send, ShieldAlert, Users, X } from "lucide-react";
import { api } from "../api/index.js";
import { PAPEIS, rotuloPapel } from "../papeis.js";
import { data } from "../rotulos.js";
import { Btn, COLOR, FONT_MONO, Label, OPCOES_PAPEL, Panel, SectionTitle, fmtShort, roleColor, selectStyle } from "../ui.jsx";
import { TabelaApi, useAtrasado } from "./TabelaApi.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Erros de escrita: os `code` da API viram texto; 422 lista os campos inválidos.
function mensagemEscrita(erro) {
  if (erro.code === "email_taken") return "Já existe um usuário com esse e-mail.";
  if (erro.code === "registration_taken") return "Já existe um usuário com essa matrícula.";
  if (erro.code === "last_admin") return "Não dá para rebaixar o último admin ativo.";
  if (erro.status === 403) return "Só o admin pode fazer isso.";
  if (erro.status === 422 && erro.errors?.length) {
    const campos = [...new Set(erro.errors.map((e) => e.loc?.at(-1)).filter(Boolean))];
    return `Confira os campos: ${campos.join(", ")}.`;
  }
  return erro.detail;
}

function Campo({ label, ...props }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label>{label}</Label>
      <input {...props} style={selectStyle} />
    </label>
  );
}

function NovoUsuario({ aoCriar, onLog }) {
  const vazio = { name: "", email: "", registration: "", password: "", role: "operador" };
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function criar() {
    setErro("");
    // Validação rápida antes de ir à API (a API valida de novo).
    if (form.name.trim().length < 2) return setErro("Informe o nome.");
    if (!EMAIL_RE.test(form.email.trim())) return setErro("Informe um e-mail válido.");
    if (form.registration.trim().length < 2) return setErro("Informe a matrícula.");
    if (form.password.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    setEnviando(true);
    try {
      const u = await api.post("/usuarios", { ...form, name: form.name.trim(), email: form.email.trim(), registration: form.registration.trim() });
      onLog?.(`Usuário criado: ${u.name} (${rotuloPapel(u.role)})`);
      setForm(vazio);
      aoCriar();
    } catch (e) {
      setErro(mensagemEscrita(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel accent={COLOR.red}>
      <SectionTitle icon={Users} title="Adicionar usuário" sub="Cria a conta já com senha e papel (POST /usuarios)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Campo label="NOME" value={form.name} onChange={mudar("name")} placeholder="Nome completo" />
        <Campo label="E-MAIL" value={form.email} onChange={mudar("email")} placeholder="nome@cptm.sp.gov.br" type="email" />
        <Campo label="MATRÍCULA" value={form.registration} onChange={mudar("registration")} placeholder="RL-8842" />
        <Campo label="SENHA INICIAL" value={form.password} onChange={mudar("password")} placeholder="mínimo 8 caracteres" type="password" autoComplete="new-password" />
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>PAPEL</Label>
          <select value={form.role} onChange={mudar("role")} style={selectStyle}>{OPCOES_PAPEL}</select>
        </label>
      </div>
      {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
      <Btn onClick={criar}>{enviando ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Adicionar usuário</Btn>
    </Panel>
  );
}

function Convite({ onLog }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("operador");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [convites, setConvites] = useState([]);
  const [copiado, setCopiado] = useState(null);

  async function convidar() {
    setErro("");
    if (nome.trim().length < 2) return setErro("Informe o nome da pessoa convidada.");
    if (!EMAIL_RE.test(email.trim())) return setErro("Informe um e-mail válido.");
    setEnviando(true);
    try {
      // A API devolve o link pronto (com o token); é ele que vai no e-mail.
      const c = await api.post("/usuarios/convite", { name: nome.trim(), email: email.trim(), role: papel });
      const assunto = encodeURIComponent("Convite de acesso — CPTM · Monitoramento Logístico de Armazém");
      const corpo = encodeURIComponent(
        `Olá, ${c.name}!\n\nVocê foi convidado(a) a acessar o sistema de Monitoramento Logístico de Armazém da CPTM, com o perfil de ${rotuloPapel(c.role)}.\n\nAcesse pelo link abaixo para criar sua senha (válido até ${new Date(c.expires_at).toLocaleString("pt-BR")}):\n${c.link}\n\nSe você não esperava este convite, pode ignorar esta mensagem.`,
      );
      window.open(`mailto:${c.email}?subject=${assunto}&body=${corpo}`, "_self");
      setConvites((l) => [{ ...c, quando: new Date() }, ...l]);
      onLog?.(`Convite gerado para ${c.email} (${rotuloPapel(c.role)})`);
      setNome(""); setEmail("");
    } catch (e) {
      setErro(mensagemEscrita(e));
    } finally {
      setEnviando(false);
    }
  }

  function copiar(link) {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiado(link);
    setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <Panel accent={COLOR.blue}>
      <SectionTitle icon={Mail} title="Convidar por e-mail" sub="A API gera o link de convite; o seu programa de e-mail abre com a mensagem pronta" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
        <Campo label="NOME" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        <Campo label="E-MAIL" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@cptm.sp.gov.br" type="email" />
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>PAPEL</Label>
          <select value={papel} onChange={(e) => setPapel(e.target.value)} style={selectStyle}>{OPCOES_PAPEL}</select>
        </label>
      </div>
      {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
      <Btn onClick={convidar}>{enviando ? <Loader2 size={14} className="spin" /> : <Send size={14} />} {enviando ? "Gerando…" : "Gerar convite"}</Btn>

      {convites.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {convites.map((c) => {
            const rc = roleColor(c.role);
            return (
              <div key={c.token} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 11px", background: COLOR.panelAlt, borderRadius: 4, border: `1px solid ${COLOR.line}`, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12.5 }}>
                  {c.name} <span style={{ color: COLOR.textFaint }}>· {c.email}</span>{" "}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, padding: "1px 6px", borderRadius: 99, background: rc.bg, color: rc.fg }}>{rotuloPapel(c.role).toUpperCase()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLOR.textFaint }}>gerado às {fmtShort(c.quando)}</span>
                  <button onClick={() => copiar(c.link)} title="Copiar link do convite" style={{ background: "none", border: `1px solid ${COLOR.line}`, borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: COLOR.textDim, display: "flex", alignItems: "center", gap: 4, fontSize: 10.5 }}>
                    <Link2 size={12} /> {copiado === c.link ? "copiado" : "copiar link"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function UsuariosApi({ usuario, onLog }) {
  const ehAdmin = usuario?.papel === "admin";
  const [papel, setPapel] = useState("");
  const [busca, setBusca] = useState("");
  const q = useAtrasado(busca.trim());
  const [recarga, setRecarga] = useState(0);
  const [erroPapel, setErroPapel] = useState("");
  const consulta = useMemo(() => ({ role: papel, q }), [papel, q]);

  async function mudarPapel(u, novo) {
    setErroPapel("");
    try {
      await api.patch(`/usuarios/${u.id}/papel`, { role: novo });
      onLog?.(`Papel de ${u.name}: ${rotuloPapel(u.role)} → ${rotuloPapel(novo)}`);
    } catch (e) {
      setErroPapel(mensagemEscrita(e));
    }
    setRecarga((n) => n + 1); // relê a página: mostra o papel que ficou gravado de fato
  }

  const colunas = [
    { key: "nome", label: "Nome", valor: (u) => u.name, largura: 28 },
    { key: "email", label: "E-mail", valor: (u) => u.email, largura: 30 },
    { key: "matricula", label: "Matrícula", valor: (u) => u.registration, mono: true, largura: 14 },
    {
      key: "papel", label: "Papel", valor: (u) => rotuloPapel(u.role), largura: 14,
      render: (u) => {
        const rc = roleColor(u.role);
        // Condição: só o admin troca papel (a API devolveria 403 para os outros).
        if (!ehAdmin) {
          return <span style={{ fontFamily: FONT_MONO, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: rc.bg, color: rc.fg }}>{rotuloPapel(u.role).toUpperCase()}</span>;
        }
        return (
          <select value={u.role} onChange={(e) => mudarPapel(u, e.target.value)} style={{ ...selectStyle, padding: "4px 8px", fontSize: 11.5, background: rc.bg, color: rc.fg, border: `1px solid ${rc.fg}33` }}>
            {OPCOES_PAPEL}
          </select>
        );
      },
    },
    { key: "ativo", label: "Ativo", valor: (u) => (u.active ? "Sim" : "Não"), largura: 8 },
    { key: "criado", label: "Criado em", valor: (u) => data(u.created_at), formato: "dataHora", largura: 18 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {ehAdmin && <NovoUsuario aoCriar={() => setRecarga((n) => n + 1)} onLog={onLog} />}
      {ehAdmin && <Convite onLog={onLog} />}

      <div>
        <SectionTitle
          icon={ShieldAlert}
          title="Usuários e níveis de acesso"
          sub={ehAdmin ? "Troque o papel direto na tabela; vale na próxima requisição da pessoa" : "Somente leitura: só o admin cria usuários e troca papéis"}
        />
        {erroPapel && <div role="alert" style={{ color: COLOR.red, fontSize: 12, margin: "0 0 10px 23px" }}>{erroPapel}</div>}
        <TabelaApi
          caminho="/usuarios"
          consulta={consulta}
          colunas={colunas}
          recarga={recarga}
          vazio="Nenhum usuário com esses filtros."
          nomeArquivo="usuarios"
          nomeAba="Usuários"
          onLog={onLog}
          filtros={
            <>
              <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
                <Search size={14} color={COLOR.textFaint} style={{ position: "absolute", left: 10, top: 10 }} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou matrícula" style={{ ...selectStyle, width: "100%", paddingLeft: 30 }} />
              </div>
              <select value={papel} onChange={(e) => setPapel(e.target.value)} style={{ ...selectStyle, flex: "0 1 170px" }} title="Papel">
                <option value="">Papel: todos</option>
                {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
              </select>
              {(papel || busca) && (
                <Btn variant="subtle" small onClick={() => { setPapel(""); setBusca(""); }}>
                  <X size={13} /> Limpar
                </Btn>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
