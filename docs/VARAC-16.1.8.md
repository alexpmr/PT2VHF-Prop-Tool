# VarAC 16.1.8: avaliação para PT2VHF Prop Tool

Fonte oficial: https://www.varac-hamradio.com/varac-releases (11/10/2026). O pedido inicial nomeia Prop Tool; a referência a APRS Client no texto colado foi tratada como contexto, sem modificar esse outro projeto.

| Ideia | Situação no Prop Tool | Decisão |
| --- | --- | --- |
| Mapa de atividade | Heatmap regional, bandas, janelas e fontes já existiam | Marcadores experimentados na v0.2.14 e removidos na v0.2.16 a pedido do usuário; manter Heatmap |
| Histórico de seis meses e atividade global | Coleta regional e retenção local limitada | Backlog: cobertura, quotas, armazenamento e replay; não prometer visão global completa |
| Ações sobre estação | Rumo ao cursor já existia | Painel por estação removido na v0.2.16; mantém rumo/distância ao cursor |
| Sempre no topo | Ausente | v0.2.14: preferência desktop persistente |
| Controle de rotor | Ausente | Backlog opcional PstRotator/Hamlib com validação de protocolo e hardware |
| Personalização de IA | Assistente determinístico já existia | v0.2.14: foco do resumo local; IA generativa continua separada no backlog |
| Diagnóstico e indicadores de erro | LOGs e RX/TX já existiam | v0.2.14: saúde individual de seis fontes, idade e cobertura incompleta |
| VMail, anexos e BBS | Não fazem parte da análise de propagação | Fora do escopo; anexos não aparecem como novidade na lista oficial 16.1.8 |
| Gateway de e-mail, clusters e mensagens automáticas | Recursos de comunicação do VarAC | Fora do escopo desta aplicação |
| Scanner de frequência e CAT/PTT | Prop Tool observa dados e não transmite | Não implementar sem um projeto específico de controle de estação |
| Tema sci-fi e sons | Temas claro/escuro já existem | Sem prioridade: estabilidade e clareza operacional primeiro |
| EmComm | Sem fonte validada de emergência | Não inferir emergência a partir de spots ou indicativos |

## Limites da adaptação

A v0.2.16 remove marcadores e detalhes por estação, preservando a visualização Heatmap solicitada. O motor continua usando recepções geolocalizadas regionais; elas não indicam estação online nem QSO confirmado. Não há consulta nova a VarAC nem redistribuição de dados do VarAC.

O perfil do assistente escolhe o critério do resumo; não muda pesos ou transforma índices operacionais em probabilidades científicas. Rumo é geométrico desde o centro regional até locator aproximado, sem comandar antena.
