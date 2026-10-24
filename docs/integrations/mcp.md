# Integração MCP

O servidor MCP é opcional e deve permanecer desligado até que a organização avalie quais ferramentas pode expor e quais usuários terão acesso. O protocolo não substitui as regras de autorização existentes: as chamadas usam as permissões da identidade autenticada.

## Modos de uso

A implementação expõe descoberta de ferramentas por HTTP (`GET /api/mcp/tools`) e execução (`POST /api/mcp/tools/call`), autenticadas por JWT ou Personal Access Token (PAT). Há também um modo local por entrada/saída padrão, iniciado com `npm run mcp:stdio --workspace=backend` e configurado com `TIME_TRACKER_MCP_USER_ID`.

Consulte `backend/src/modules/mcp/` para o catálogo atual e os contratos completos. O catálogo pode mudar conforme os recursos e permissões habilitados no backend; confirme a lista retornada pelo servidor antes de configurar um cliente MCP externo.

## OAuth e limites

A metadata de OAuth protegida disponível no código é discovery, não um provedor de identidade. O Time Tracker **não emite tokens OAuth**. Preencher valores `MCP_OAUTH_*` não cria um IdP, não implementa consentimento nem habilita um fluxo de login OAuth completo.

Não exponha um endpoint MCP publicamente sem HTTPS, autenticação forte, autorização mínima, rate limits e observabilidade. Prefira PATs com menor escopo e expiração curta quando esse modo for aceito pela política da organização; trate o token como senha e revogue-o após o uso.
