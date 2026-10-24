# Integracoes com OpenAI, Gemini ou Anthropic - Detalhamento

Este documento detalha **especificacao funcional**, **arquitetura tecnica** e **roadmap** para integrar IA ao Time Tracker System.

---

## FEATURE IMPLEMENTADA: Auto-Resumo de Atividades

### Status: ✅ Implementado

### Descricao

Quando o usuario salva um lancamento de horas com descricao longa (50+ caracteres), o sistema:
1. Salva a descricao completa normalmente
2. Envia a descricao para AI em background (nao-bloqueante)
3. AI gera uma versao resumida (tag curta de ate 40 chars)
4. A tag resumida e salva na tabela `activity_tags`
5. A tag aparece nos lancamentos rapidos para uso futuro

### Configuracao

```env
AI_SUGGESTIONS_ENABLED=true
AI_PROVIDER=openai  # ou gemini ou anthropic
OPENAI_API_KEY=sk-proj-xxxxx
```

### Arquivos

- `backend/src/services/ai.service.ts` - Orquestracao e funcao `summarizeActivity()`
- `backend/src/services/ai-provider.service.ts` - Adapters para OpenAI/Gemini/Anthropic
- `backend/src/services/ai-context.service.ts` - Construcao de contexto
- `backend/src/controllers/ai.controller.ts` - Endpoints `/api/ai/status` e `/api/ai/suggestions`
- `backend/src/services/timeentry.service.ts` - Integracao automatica ao salvar

### Exemplo de Fluxo

1. Usuario digita: "Reuniao com equipe de desenvolvimento para discutir arquitetura do novo sistema de pagamentos"
2. Sistema salva a descricao completa no time entry
3. AI gera tag: "Reuniao arquitetura pagamentos"
4. Tag aparece nos lancamentos rapidos do usuario

### Endpoints

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/ai/status` | GET | Retorna se AI esta habilitado e qual provider |
| `/api/ai/suggestions` | POST | Gera sugestoes de atividades |

---

## 1) ESPECIFICACAO FUNCIONAL POR FEATURE

### 1.1 Quick Log Inteligente (sugestoes por usuario)

**Objetivo**: reduzir tempo de lancamento e padronizar descricoes.

**Fluxo (UI)**

1. Usuario abre Quick Log.
2. Sistema mostra: atividades recentes + sugestoes geradas por IA.
3. Usuario escolhe uma sugestao ou edita antes de salvar.

**Inputs para IA**

- Historico recente do usuario (ultimos 30-90 dias): descricao, cliente, duracao.
- Cliente atual (se selecionado).

**Outputs**

- Lista de sugestoes: {label, descricao, duracaoSugeridaMin, tags}.

**Exemplo de resultado**

- "Reuniao semanal com cliente" (30m)
- "Planejamento de sprint" (60m)

**Regras**

- Nunca inserir automaticamente, apenas sugerir.
- Exibir explicacao curta: "Baseado no seu historico".

---

### 1.2 Classificacao automatica de atividades

**Objetivo**: categorizar descricoes sem exigir campos extras.

**Fluxo**

- Ao salvar/editar um lancamento, IA classifica (categoria + subtipo).
- Categoria fica visivel em dashboards e export.

**Categorias sugeridas**

- Reuniao, Planejamento, Desenvolvimento, Suporte, Documentacao, Gestao.

**Output esperado**

```json
{
  "category": "Reuniao",
  "confidence": 0.92
}
```

**Fallback**

- Se confidence < 0.6, manter como "Nao classificado".

---

### 1.3 Resumo semanal/mensal para consultor

**Objetivo**: dar feedback rapido do periodo.

**Fluxo**

- No dashboard pessoal, botao "Gerar resumo".
- IA gera 3-5 bullets com: principais clientes, atividades, alertas.

**Output esperado**

- "Voce registrou 38h neste mes, 52% em Cliente A."
- "Atividades mais comuns: reunioes e planejamento."

**Regras**

- Nunca alterar dados reais, apenas resumo textual.

---

### 1.4 Insights para managers

**Objetivo**: destacar riscos e oportunidades.

**Fluxo**

- No dashboard do time, botao "Insights do time".
- IA gera insights agregados.

**Exemplos**

- "Consultor X acima da meta ha 3 semanas."
- "Cliente Y concentrou 60% do tempo do time."

---

### 1.5 Auditoria inteligente

**Objetivo**: identificar inconsistencias.

**Fluxo**

- Rodar diariamente (job) ou sob demanda.
- Gerar alertas em painel de auditoria.

**Exemplos de alertas**

- Dias com > 10h lancadas.
- Mesmas descricoes repetidas em muitos dias.
- Alteracoes apos periodo fechado.

---

### 1.6 Conversao de linguagem natural para duracao (avancada)

**Objetivo**: permitir input flexivel.

**Fluxo**

- Campo de duracao aceita frases: "duas horas e meia".
- IA converte para minutos.

**Output**

```json
{ "minutes": 150 }
```

---

### 1.7 Assistente de preenchimento (copilot)

**Objetivo**: preencher com base em contexto.

**Fluxo**

- Botao "Sugerir lancamento".
- IA usa historico e calendario (futuro).

**Resultado**

- Data, cliente sugerido, descricao e duracao.

---

### 1.8 Padronizacao para exportacao

**Objetivo**: melhorar comunicacao com clientes.

**Fluxo**

- No export, opcao "Padronizar descricoes".
- IA gera descricoes profissionais.

---

### 1.9 Compliance/alertas internos

**Objetivo**: enforce regras internas.

**Fluxo**

- IA avalia regras (ex: max 8h/dia).
- Se violacao, alerta admin/manager.

---

## 2) ARQUITETURA TECNICA

### 2.1 Estrutura de servicos

- Criar modulo dedicado: `backend/src/services/ai/`.
- Criar endpoints:
  - `POST /api/ai/suggestions`
  - `POST /api/ai/classify`
  - `POST /api/ai/summary`
  - `POST /api/ai/insights`
  - `POST /api/ai/normalize`

### 2.2 Armazenamento

**Tabela recomendada**: `ai_interactions`

```sql
id, userId, feature, inputHash, output, createdAt, model, tokensUsed
```

**Motivos**

- Auditoria
- Cache
- Troubleshooting

### 2.3 Cache

- Cache por usuario + feature + periodo.
- TTL curto (1h para sugestoes, 24h para insights).

### 2.4 Segurança

- Nunca enviar dados sensiveis sem mascaramento.
- Remover email e nomes completos do prompt.
- Restringir features por role.

### 2.5 Custos e rate limit

- Limitar requests por usuario (ex: 20/dia).
- Usar batch quando possivel.

### 2.6 Modelos Suportados

| Provider | Modelo Padrao | Uso Recomendado |
|----------|---------------|-----------------|
| OpenAI | `gpt-4o-mini` | Classificacao, sugestoes, resumos |
| Google Gemini | `gemini-1.5-flash` | Tarefas leves e rapidas |
| Anthropic Claude | `claude-3-haiku-20240307` | Alta qualidade, baixo custo |

**Configuracao via variaveis de ambiente:**
- `AI_PROVIDER`: Seleciona o provider (`openai`, `gemini`, `anthropic`)
- `OPENAI_MODEL`, `GEMINI_MODEL`, `ANTHROPIC_MODEL`: Personaliza o modelo

---

## 3) ROADMAP

### Fase 1 (MVP IA - 2 a 3 semanas)

- Quick Log inteligente
- Conversao de linguagem natural (duracao)
- Classificacao automatica de atividades

**Criterios de aceite**

- Sugestoes aparecem em <2s
- Preciso >70% em categoria
- 90% dos usuarios conseguem usar duracao livre

---

### Fase 2 (Insights e Auditoria - 3 a 4 semanas)

- Resumo semanal/mensal
- Insights para managers
- Auditoria inteligente

**Criterios de aceite**

- Resumo mensal gerado em <5s
- Alertas validos em 80% dos casos

---

### Fase 3 (Copilot completo - 4 a 6 semanas)

- Assistente de preenchimento
- Padronizacao de descricao no export
- Compliance automatizado

**Criterios de aceite**

- Reducao de 30% no tempo de lancamento
- Reducao de 40% em erros de descricao

---

## Observacoes finais

- Implementar feature flags por role.
- Comecar com dataset minimo e ajustar prompts com feedback.
- Manter logs e auditoria de todas as respostas.

Se quiser, posso transformar esse roadmap em backlog tecnico detalhado com tarefas e estimativas por sprint.
