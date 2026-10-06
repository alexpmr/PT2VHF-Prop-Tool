# Changelog

## v0.2.1 — 2026-10-06

- Corrigido o fluxo de coleta da v0.2.0 para tornar falhas de consulta visíveis e permitir atualização efetiva do mapa e do painel lateral.
- PSK Reporter passa a aceitar redirecionamentos HTTPS somente entre destinos autorizados, com limite de redirecionamentos e validação de tamanho/resposta.
- Nova aba **LOGs** com tráfego TX/RX, fonte, endpoint, status, duração, volume, erros, prévia limitada do payload, filtros, busca, pausa, limpeza e exportação JSONL.
- LEDs na barra superior: **RX verde** e **TX vermelho**, pulsando somente quando há tráfego real.
- Navegação reorganizada para **Mapa / LOGs / Configurações / Ajuda / Sobre**.
- Configurações agora identifica as fontes efetivamente utilizadas: PSK Reporter, NOAA SWPC, Natural Earth e GitHub.
- Atualização automática dos dados do mapa a cada **5 minutos por padrão**, configurável separadamente da verificação de novas versões.
- Legenda do mapa mostra dinamicamente **direção cardinal, azimute e distância** entre a estação configurada e o ponto sob o cursor.
- Estado interno atualizado para schema 3, preservando configurações anteriores por migração.

## v0.2.0 — 2026-10-06

- Seis idiomas com bandeiras SVG e tradução da interface, Ajuda, Sobre, mensagens, alertas e assistente local.
- Temas claro/escuro persistidos; versão imediatamente após o nome.
- Configurações como penúltima aba e Sobre como última, com apresentação e contato pelo GitHub.
- Banda de 11 metros; 14 bandas habilitadas inicialmente, antenas verticais, 100 W e verificação de versões a cada cinco minutos. Migração preserva escolhas anteriores.
- Estado vazio do mapa corrigido: sem convite repetido de configuração nem bloco central após configurar.
- Indicador de atualização verde/laranja, download, validação de integridade e reinício. Portable recebe substituição segura e recuperação da versão anterior quando a inicialização não é confirmada.
- README com downloads diretos e manual ilustrado em PDF.
- Testes ampliados para migração, traduções, integridade, estados da interface e pacotes nativos Windows.

## 0.1.0 — 2026-10-06

- Base inicial Windows x64 com instalador e portátil.
- Mapa-múndi offline, painel de treze bandas, configuração da estação e antenas por banda.
- Adapters PSK Reporter e NOAA Kp, timestamps, limites de consulta e cache local.
- Direção TX/RX, seleção regional identificada como indireta, zonas conservadoras e alertas configuráveis.
- Índice inicial de evidências experimental; estado sem evidências separado de banda fechada.
- Assistente local por regras, com IA generativa e novas fontes registradas no backlog.
- Versão, notas e controles de atualização; workflow de build/release Windows.
- Testes do motor e interface. Validação nativa Windows e OTA entre releases pendentes.
