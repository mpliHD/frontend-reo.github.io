// ACEITE DO CONVITE
// Aberta pelo link do e-mail (#/convite/<token>). A pessoa define a senha (e a
// matrícula, se o convite não trouxe) e a conta é criada em
// POST /auth/convite/aceitar, que já devolve os tokens: entra direto no site.
import { useState } from "react";
import { ChevronRight, Loader2, Mail } from "lucide-react";
import { MODO_DEMO } from "../config.js";
import { api } from "../api/index.js";
import { lerConvite } from "../convite.js";
import { rotuloPapel, usuarioDaApi } from "../papeis.js";
import { BrandMark, Btn, COLOR, FONT_BODY, FONT_DISPLAY, FONT_MONO, Field, FontLoader, Label, Panel } from "../ui.jsx";

function mensagemErro(erro) {
  if (erro.code === "token_expired") return "Este convite expirou. Peça um novo convite ao administrador.";
  if (erro.code === "invalid_token") return "Este link de convite não é válido. Confira se ele foi copiado inteiro.";
  if (erro.code === "email_taken") return "Este convite já foi usado: já existe uma conta com este e-mail. Entre pelo login.";
  if (erro.code === "registration_taken") return "Essa matrícula já está em uso por outra conta.";
  if (erro.code === "registration_required") return "Informe a sua matrícula.";
  if (erro.status === 422) return "A senha precisa ter pelo menos 8 caracteres.";
  return erro.detail;
}

export function AceiteConvite({ token, onAceito, onIrParaLogin }) {
  const convite = lerConvite(token);
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const vencido = convite?.expiraEm && convite.expiraEm < new Date();

  async function aceitar(e) {
    e?.preventDefault?.();
    if (enviando) return;
    setErro("");
    if (!convite?.matricula && matricula.trim().length < 2) return setErro("Informe a sua matrícula.");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmacao) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    try {
      const u = await api.aceitarConvite(token, senha, convite?.matricula ? "" : matricula.trim());
      onAceito(usuarioDaApi(u));
    } catch (erroApi) {
      setErro(mensagemErro(erroApi));
      setEnviando(false);
    }
  }

  let conteudo;
  if (MODO_DEMO) {
    conteudo = <div style={{ fontSize: 13, lineHeight: 1.6, color: COLOR.textDim }}>Convites só funcionam com a API ligada. Este site está em modo demonstração.</div>;
  } else if (!convite) {
    conteudo = <div role="alert" style={{ fontSize: 13, color: COLOR.red }}>Este link de convite não é válido. Confira se ele foi copiado inteiro.</div>;
  } else {
    conteudo = (
      <div onKeyDown={(e) => e.key === "Enter" && aceitar(e)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.line}`, borderRadius: 4, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.7 }}>
          <div><b>{convite.nome || convite.email}</b></div>
          <div style={{ color: COLOR.textDim }}>{convite.email}</div>
          <div style={{ color: COLOR.textDim }}>Perfil: {rotuloPapel(convite.papel)}{convite.matricula ? ` · matrícula ${convite.matricula}` : ""}</div>
          {convite.expiraEm && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: vencido ? COLOR.red : COLOR.textFaint }}>
              {vencido ? "venceu em" : "válido até"} {convite.expiraEm.toLocaleString("pt-BR")}
            </div>
          )}
        </div>
        {!convite.matricula && <Field label="Sua matrícula" value={matricula} onChange={setMatricula} placeholder="RL-8842" />}
        <Field label="Crie uma senha" value={senha} onChange={setSenha} placeholder="mínimo 8 caracteres" type="password" />
        <Field label="Repita a senha" value={confirmacao} onChange={setConfirmacao} placeholder="a mesma senha" type="password" />
        {erro && <div role="alert" style={{ color: COLOR.red, fontSize: 12.5 }}>{erro}</div>}
        <Btn onClick={aceitar} full>
          {enviando ? <><Loader2 size={15} className="spin" />Criando conta…</> : <>Criar conta e entrar<ChevronRight size={15} /></>}
        </Btn>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ background: COLOR.bg, color: COLOR.text, fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <FontLoader />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <BrandMark />
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>CPTM · ARMAZÉM</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.textDim, letterSpacing: 0.5 }}>MONITORAMENTO LOGÍSTICO</div>
          </div>
        </div>
        <Panel style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Mail size={15} color={COLOR.red} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>Aceitar convite</span>
          </div>
          {conteudo}
        </Panel>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={onIrParaLogin} style={{ background: "none", border: "none", color: COLOR.blue, cursor: "pointer", fontSize: 12.5, fontFamily: FONT_BODY }}>
            Já tenho conta: ir para o login
          </button>
        </div>
        <div style={{ marginTop: 6, textAlign: "center" }}><Label>O CONVITE CRIA SUA CONTA COM O PERFIL DEFINIDO PELO ADMINISTRADOR</Label></div>
      </div>
    </div>
  );
}
