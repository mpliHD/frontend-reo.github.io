# CPTM · Monitoramento Logístico de Armazém

Protótipo de frontend (React + Vite) baseado nos fluxogramas do projeto:
login com MFA (online/offline), operação de campo do técnico (leitura de
RFID/NFC/QR, registros de movimentação/inventário/localização/ocorrência),
painel de monitoramento, sincronização com credenciais de 48h e logs de
auditoria. Os dados são fictícios (mock), prontos para depois ligar ao
Firebase de verdade.

## Rodar no computador

```bash
npm ci          # instala as dependências (node_modules não vai para o git)
npm run dev     # abre http://localhost:5173/app.html, já com as abas de desenvolvedor
npm test        # testes do cliente da API (test runner do Node, sem backend)
npm run publicar  # gera a versão publicada em dist/ e atualiza o index.html da raiz
```

## API e modo demonstração

O site está sendo ligado à [API REO](https://github.com/Legalso/cptm-reo-api)
(FastAPI + Postgres). A configuração vem de variáveis do build, lidas em
`src/config.js`:

| Variável | Para que serve |
|---|---|
| `VITE_API_URL` | URL base da API, sem barra no fim. Em `npm run dev` o padrão é `http://localhost:4000`. |
| `VITE_MODO_DEMO=true` | Força o modo demonstração mesmo com API configurada. |
| `VITE_MOSTRAR_ABAS_DEV=true` | Mostra as abas de desenvolvedor no site publicado. |

**Modo demonstração:** sem `VITE_API_URL` (é o caso do site publicado hoje,
porque a API ainda não tem endereço público), o site usa os dados fictícios
e mostra uma faixa avisando. Nada com prefixo `VITE_` é segredo: tudo vai
para o JavaScript público.

Todas as chamadas à API passam por `src/api/cliente.js`, que manda o token,
renova a sessão quando o access token vence (15 min) e converte os erros da
API (`{detail, code}`) em `ErroApi`. Os tokens ficam no `sessionStorage`
(somem ao fechar a aba).

### Telas com a API (`src/telas/`)

| Aba | Rota da API | Quem vê |
|---|---|---|
| Dormentes | `GET /dormentes` (um por tag RFID; filtros de status, espécie, local e busca por tag/ata) | todos |
| Detalhe do dormente (clique na linha) | `GET /dormentes/{id}/historico` (movimentações, inspeções e ocorrências) | todos |
| Retiradas (RM) | `GET /estoque/movimentacoes?kind=withdrawal` + nomes de `/locais`, `/dormentes/{id}` e `/usuarios` | todos (responsável só para supervisor/admin) |
| Inspeções | `GET /inspecoes` (checklist e resultado; filtros de resultado e período) | todos (inspetor só para supervisor/admin) |
| Espécies de Madeira | `GET /especies`; `POST/PATCH /especies` | todos; edição por especialista e admin |
| Locais | `GET /locais`; `POST/PATCH /locais` | todos; edição por supervisor e admin |
| Painel de Monitoramento | `GET /indicadores` e `GET /monitoramento/status` | supervisor, admin |
| Usuários & Permissões | `GET/POST /usuarios`, `PATCH /usuarios/{id}/papel`, `POST /usuarios/convite` | supervisor (leitura), admin |
| Logs e Auditoria | `GET /logs` | supervisor, admin |

A paginação é feita pela API (50 por página) e o "Exportar para Excel" baixa
todas as páginas do filtro atual. "Dormentes a Chegar" e "Suporte / Chamados"
não têm dados na API e só aparecem no modo demonstração; Inspeções, Espécies
e Locais só aparecem com a API. No modo demonstração todas as abas continuam
com os dados fictícios. Espécies e locais não são apagados, são desativados.

## Login de teste (modo demonstração)

- Usuário: `Admin`
- Senha: `Senha123`
- Código de MFA: qualquer sequência com 4 ou mais dígitos (ex.: `123456`)

## Perfis de acesso (governança)

Os mesmos 5 papéis da API (`src/papeis.js`): `operador`, `tecnico`,
`especialista`, `supervisor` e `admin`. Com a API, o login é por matrícula ou
e-mail e o papel vem do servidor; Painel, Logs e Usuários só aparecem para
supervisor e admin. Esconder a aba é só conveniência: quem barra de verdade é
a API (403). Em **Usuários & Permissões** a troca de papel ainda é local
(modo demonstração) e será ligada a `PATCH /usuarios/{id}/papel`.

## Convite por e-mail

Em **Usuários & Permissões → Convidar por e-mail**: preenche nome, e-mail e
papel e clica em enviar. Como o domínio final do projeto ainda não foi
decidido, o comportamento é:

1. Se a aba **APIs & Integrações** tiver uma URL preenchida, tenta enviar o
   convite para `SEU_BACKEND/usuarios/convite` primeiro.
2. Se não tiver backend (ou a chamada falhar, que é o caso hoje), abre o
   cliente de e-mail padrão do usuário (Outlook, Gmail etc.) com o
   assunto e corpo já prontos, isso funciona em qualquer computador, sem
   depender de domínio, servidor de e-mail ou chave de API nenhuma.

Cada convite gera também um link (`/convite/<token>?papel=...`) que pode ser
copiado manualmente com o botão "copiar link", usando como base o domínio
onde o site estiver hospedado no momento, trocaremos a lógica de
`gerarLinkConvite()` em `App.jsx` quando o domínio final existir.

## Estrutura

```
frontend-reo.github.io/
├── index.html          # página publicada no GitHub Pages (aponta para dist/)
├── app.html            # entrada do código-fonte para o Vite (npm run dev / build)
├── package.json        # dependências (react, recharts, lucide-react, write-excel-file)
├── vite.config.js      # configuração do Vite
├── dist/               # versão compilada que o Pages serve (gerada por npm run publicar)
├── scripts/            # atualizar-index.mjs, usado pelo npm run publicar
├── src/
│   ├── main.jsx        # ponto de entrada React
│   ├── config.js       # URL da API e modo demonstração
│   ├── api/            # cliente HTTP, sessão (tokens) e testes
│   └── App.jsx         # telas, dados mock e lógica
└── README.md
```

Todo o app está em `src/App.jsx` num único arquivo para facilitar a leitura;
os blocos de cor (objeto `COLOR` no topo do arquivo) e os dados fictícios
(constantes `ITENS`, `TECNICO`, `LOGIN_DEMO`) ficam separados no início do
arquivo para você editar facilmente.

## Segurança: o que já foi tratado e o que está pendente

Este projeto é um protótipo 100% frontend (sem servidor), no entanto eu fiz algumas verificações:

**Já corrigido nesta versão:**
- Campo de Client ID / API Key (aba APIs) agora fica mascarado por padrão,
  com botão para revelar, evita exibir a chave em prints/compartilhamento
  de tela por descuido.
- Nenhum dado sensível é gravado em `localStorage`/`sessionStorage` tudo
  vive só em memória da aba e some ao recarregar a página, o que é bom por agora mas ruim pra produção...
- Não há `dangerouslySetInnerHTML` em nenhum lugar do código: todo texto
  digitado pelo usuário (chamados, nomes, observações) é renderizado pelo
  React, que escapa HTML automaticamente, não há XSS óbvio pelos
  formulários atuais.
- O convite por e-mail não depende de nenhuma chave de API exposta no
  front-end, o que evita vazar credenciais de um provedor
  de e-mail no bundle público do GitHub Pages.

**COISAS PARA MODIFICAR CONFORME FORMOS TESTANDO**
- **Login e MFA são só de interface.** `Admin`/`Senha123` está escrito no
  código-fonte; qualquer pessoa que abrir o repositório no GitHub ou o
  código-fonte da página vê essa "senha". Isso é aceitável só enquanto for
  protótipo/demonstração. Antes de qualquer uso real, a autenticação
  precisa acontecer em um backend (Firebase Auth, por exemplo), nunca só no
  React.
- **Os papéis (Operador/Analista/Admin) hoje só escondem/mostram elementos
  na tela.** Isso não é controle de acesso de verdade: alguém com
  conhecimento técnico pode forçar o estado do app e ver tudo. Quando
  houver backend, cada rota da API precisa checar o papel do usuário no
  servidor (ex.: Firebase Security Rules, ou um middleware que valida o
  token em cada requisição), a interface pode continuar escondendo botões
  por conveniência, mas isso nunca substitui a checagem no servidor.
- **Nunca comite chaves reais no GitHub.** Se um dia usar variáveis de
  ambiente (`.env`) com o Vite, qualquer variável com prefixo
  `VITE_` é embutida no JavaScript público gerado pelo build então basicamente... é
  "secreta" só no nome. Segredos de verdade (senha de SMTP, chave privada
  de API) só podem existir em um servidor, nunca no código que roda no
  navegador (mas aí precisamos do servidor né)
- **Upload de imagem do QR Code** aceita qualquer arquivo escolhido pelo
  usuário (o atributo `accept="image/*"` é só uma sugestão visual do
  navegador, não uma trava de segurança). Hoje isso é inofensivo porque a
  imagem só vira uma pré-visualização local. Se um dia esse arquivo for
  enviado a um servidor, valide tipo e tamanho no backend também, nunca só
  no frontend.
- **GitHub Pages é hospedagem estática**: ótima para este frontend, mas
  não hospeda nada que precise manter segredo (login real, e-mail real,
  chaves de API). Essas partes vão precisar de um serviço à parte
  (Firebase Functions, um pequeno backend Node/Python/Java, etc.) mas até aí precisamos
  validar o custo

## Sobre linguagem: por que React/JavaScript e não Python/Java

O frontend roda dentro do navegador, e a única linguagem que o navegador
executa nativamente é JavaScript, por isso dashboards web (mesmo em
ferramentas como Power BI, Grafana ou qualquer site que testei antes) são construídos com
HTML/CSS/JS por baixo, ainda que o back-end seja em outra linguagem depois.
Python e Java não rodam no navegador.Quando formos fazer a camada de back-end/API seguiremos em Python (Flask/FastAPI) que pode ser feito com o Caio, ou Java (Spring Boot) que eu posso desenrolar aqui,
mas como já alterei algumas questões da API no código, talvez nem seja necessário pro protótipo


## Próximos passos:

- Trocar os dados mock por chamadas reais ao Firebase (Auth + Firestore).
- Implementar MFA real (ex.: Firebase Auth com segundo fator).
- Persistir a fila de sincronização offline com IndexedDB.
- Mover a autenticação e a checagem de papéis para o backend.
- Decidir o domínio final e plugar um serviço de e-mail (backend próprio
  ou algo como EmailJS, que usa chave pública em vez de segredo de SMTP).
- Validar o funcionamento das APIs (precisamos mexer no backend ou consegui?)

