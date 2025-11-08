# Integração COI — Frontend

Este repositório contém duas páginas estáticas:

- `entrada.html` — formulário para inserir o planejamento operacional (página de origem).
- `integracao.html` — dashboard público que exibe os dados em tempo real.

O projeto usa Tailwind via CDN e pequenos scripts que podem usar Firebase Firestore ou um modo *mock* local (via `localStorage` ou `planning_public.json`) para testes locais.

Como publicar no GitHub Pages (passo a passo):

1) Inicialize git localmente (já feito aqui):

   git init
   git add .
   git commit -m "Initial commit - prepare for GitHub Pages"

2) Crie um repositório no GitHub (via UI) e copie o remote (ex: `git@github.com:usuario/repo.git` ou `https://github.com/usuario/repo.git`).

3) Adicione o remoto e envie o branch principal:

   git remote add origin <URL-DO-REPO>
   git push -u origin main

4) Criar a branch `gh-pages` (opcional - usada para deploy do site):

   git checkout -b gh-pages
   git push -u origin gh-pages

5) No GitHub, em Settings → Pages, escolha a branch `gh-pages` (ou `main`/`docs/` conforme preferir) e salve. O site ficará disponível em `https://<usuario>.github.io/<repo>/`.

Notas sobre Firebase:
- Para usar Firebase em produção, defina `__firebase_config` no ambiente (por exemplo, injetando via script ou substituindo no HTML) com o JSON de configuração. O código já usa fallback para modo mock quando a configuração não existe.

Testes locais rápidos:
- Rode um servidor local (python -m http.server 5500) e acesse:
  - http://127.0.0.1:5500/entrada.html
  - http://127.0.0.1:5500/integracao.html

Sugestões finais:
- Para publicar no GitHub Pages recomendo usar a branch `gh-pages` contendo apenas os arquivos estáticos (neste caso a raiz do repositório funciona bem).
- Se quiser, eu crio o repositório remoto e faço o push por você — você precisa fornecer um token de acesso (ou executar os comandos localmente).