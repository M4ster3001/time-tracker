# Personalização

O projeto parte de uma identidade neutra. Adapte os pontos abaixo para seu nome, cores, idioma e ativos — use somente marcas e imagens que você tenha direito de publicar.

## Nome e descrição

- `frontend/src/config/branding.ts`: nome exibido no shell e na tela de login, além da tagline.
- `frontend/index.html`: título da aba, descrição, tema do navegador e título para iOS.
- `frontend/vite.config.ts`: `name`, `short_name`, `description` e `theme_color` do manifesto PWA.

Depois de editar, rode `npm run build --workspace=frontend` e confira tanto o navegador quanto o manifesto gerado.

## Logo e ícones

- `frontend/src/components/shell/AppBrandMark.tsx`: marca vetorial neutra usada no shell e na tela de login. Substitua o desenho ou adapte o componente para importar seu próprio SVG.
- `frontend/public/favicon.svg`, `apple-touch-icon.png` e `pwa-*.png`: ícones de navegador e PWA. Substitua cada tamanho com arquivos derivados do seu ativo autorizado.
- O utilitário `node scripts/generate-pwa-icons.mjs` gera ícones de relógio simples; edite as cores/fonte desse script se quiser usá-lo para sua própria variante.

Não copie logotipos, ícones ou screenshots de outros serviços para demonstrar uma personalização.

## Cores e tipografia

Edite os tokens semânticos no início de `frontend/src/index.css`, principalmente `--tt-action`, `--tt-action-hover`, `--tt-link`, `--tt-focus`, `--tt-page`, `--tt-surface`, `--tt-text` e `--tt-border`. Para o modo escuro, ajuste também o bloco `html.dark`.

Confira estados de foco, contraste de texto, alertas e gráficos em ambos os temas. Evite trocar somente a cor do botão principal: links, foco, estados de sucesso/erro e elementos ativos também dependem dos tokens.

As fontes são carregadas de Google Fonts em `frontend/index.html`. Para ambientes privados/offline, selecione uma alternativa e revise sua licença antes de empacotá-la.

## Idioma e textos

O frontend inclui catálogos em `frontend/src/i18n/`. Ao alterar uma frase de interface, procure as versões em português e inglês e atualize testes que dependam do texto. A documentação deste repositório está em português; contribuições de tradução são bem-vindas.

## Ajustes para equipes

Regras de clientes, projetos, alocação, fechamento, permissões e exportação vivem principalmente no backend (`backend/src/modules/`) e no schema/migrações (`backend/prisma/`). Leia [regras de negócio](../product/business-rules.md) e [arquitetura](../development/architecture.md) antes de alterar o modelo. Não transforme uma regra de autorização em simples ocultação de botão no frontend.
