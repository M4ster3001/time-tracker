# Acessibilidade (A11y) — Guia e Checklist

Este documento descreve **opcoes de acessibilidade** recomendadas para o sistema e um **checklist pratico** para garantir conformidade basica com WCAG 2.1 (AA). O foco e utilidade real para usuarios.

## Objetivos
- Garantir uso por teclado, leitores de tela e alto contraste.
- Minimizar barreiras em formularios, tabelas e dashboards.
- Padronizar componentes com comportamento acessivel.

## 1) Preferencias do Usuario (Opcoes na UI)
Crie um painel de acessibilidade no rodape (ou perfil) com:

- **Contraste elevado** (toggle): aumenta contraste de texto, bordas e fundos.
- **Tamanho de fonte**: normal / grande / extra grande.
- **Reducao de movimento**: respeita `prefers-reduced-motion` e desativa animacoes.
- **Densidade**: compacta / confortavel (espacamento entre linhas e cards).
- **Tema**: claro / escuro / sistema.
- **Foco visivel reforcado**: borda de foco grossa e colorida.

Requisitos:
- Persistir em `localStorage` por usuario.
- Sempre permitir **resetar** para padrao.

## 2) Navegacao e Teclado
- Todo elemento interativo precisa ser acessivel por teclado.
- Ordem de tab consistente e logica.
- Atalhos para areas criticas (ex.: `g d` para dashboard, `g t` para lancar horas).
- `Escape` fecha modais/overlays.
- `Enter` ou `Space` ativam botoes e controles.

Checklist:
- [ ] Sem armadilhas de foco em modais.
- [ ] `tabindex` apenas quando necessario.
- [ ] Botoes e links com `aria-label` quando o texto nao e suficiente.

## 3) Leitores de Tela e Semantica
- Usar elementos semanticos (`header`, `main`, `nav`, `section`).
- Campos de formulario com `label` explicito.
- Texto alternativo em icones informativos.
- Tabelas com `thead`, `tbody`, `th` e `scope`.

Checklist:
- [ ] Inputs com `aria-describedby` para erro e ajuda.
- [ ] Notificacoes com `role="status"`.
- [ ] Erros com `role="alert"`.

## 4) Contraste e Cores
- Contraste minimo **4.5:1** para texto normal.
- Contraste **3:1** para texto grande.
- Cores nao devem ser o unico indicador (ex.: erro/ok tambem com icone ou texto).

Checklist:
- [ ] Badges e tags com texto legivel no modo escuro.
- [ ] Estados `hover/focus/active` visiveis.

## 5) Formularios
- Erros sempre exibidos perto do campo.
- Mensagens claras, sem termos tecnicos.
- Placeholder nunca substitui `label`.

Checklist:
- [ ] Validacao inline e resumo de erros no topo (opcional).
- [ ] Modo de leitura por teclado sem salto inesperado.

## 6) Tabelas e Listas
- Tabelas com cabecalhos e navegacao por teclado.
- Ordenacao acessivel com `aria-sort`.
- Linhas com foco visivel.

Checklist:
- [ ] Tooltip acessivel (texto duplicado em `aria-label` ou `title`).

## 7) Modais e Dialogs
- Foco preso no modal.
- Botao de fechar sempre presente.
- Fundo com `aria-hidden`.

Checklist:
- [ ] Titulo do modal com `aria-labelledby`.
- [ ] Texto principal com `aria-describedby`.

## 8) Grafos e Dashboards
- Mostrar valores numericos junto aos graficos.
- Tooltips com alternativa de leitura (ex.: lista abaixo).
- Modo de alto contraste.

Checklist:
- [ ] Valores acessiveis sem depender de cores.

## 9) Preferencias do Sistema (CSS)
- Respeitar `prefers-reduced-motion`.
- Respeitar `prefers-color-scheme`.

Exemplo:
```
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

## 10) Testes Recomendados
- Lighthouse Accessibility.
- Axe DevTools (Chrome).
- NVDA (Windows) / VoiceOver (macOS).
- Teste manual com teclado.

Checklist minimo por release:
- [ ] Navegacao completa via teclado.
- [ ] Contraste validado nas telas principais.
- [ ] Formularios com erros anunciados.
- [ ] Modais com foco correto.

## 11) Acessibilidade por Role
- Consultor: rotas criticas acessiveis (lancar horas / historico / dashboard).
- Manager: filtros acessiveis por teclado.
- Admin: telas complexas com tabelas e filtros com foco e labels corretos.

## 12) Proximos Passos (Roadmap)
- Configurar painel de acessibilidade no frontend.
- Criar tokens de contraste no Tailwind.
- Padronizar todos os componentes (inputs, botoes, modais).
- Adicionar testes de acessibilidade no CI.

