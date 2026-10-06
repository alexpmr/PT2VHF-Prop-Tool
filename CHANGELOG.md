# Changelog

## v0.2.4 — 2026-10-06

- Heatmap refeito como **mapa de densidade multicolor**: azul/ciano/verde representam menor a média concentração e amarelo/laranja/vermelho representam hotspots mais intensos.
- Removida a composição por círculos SVG borrados; o heatmap agora é desenhado em **camada de tela própria**, recalculada para o viewport atual.
- O raio/kernel diminui conforme o zoom aumenta, permitindo revelar detalhes locais em vez de ampliar as manchas.
- A intensidade é normalizada por viewport para reduzir saturação e evitar grandes áreas brancas.
- Marcador e rótulo da estação foram movidos para overlay em coordenadas de tela, mantendo tamanho visual constante durante zoom e pan.
- Linhas vetoriais preservam espessura visual com `vector-effect` no modo Polígonos.
- Atualizador passa a exibir **barra de progresso real**, percentual, bytes baixados/total e velocidade quando disponível.
- Após download e validação, a aplicação entra em estado de instalação, fecha automaticamente, instala/substitui a nova versão **sem perguntas** e reabre ao final.
- O fluxo silencioso vale para edição instalada e Portable; falhas preservam a versão atual e mantêm os mecanismos de recuperação existentes.
- Testes ampliados para gradiente multicolor, kernel dependente do zoom, agregação de densidade, progresso do Portable e tamanho constante do marcador.

## v0.2.3 — 2026-10-06

- **Mapa de calor** passa a ser a visualização padrão, com intensidade acumulada das evidências e cores preservadas por banda.
- **Polígonos** permanece como visualização técnica alternativa; a preferência Heatmap/Polígonos é salva nas configurações.
- O mapa passa a operar exclusivamente em **Minha região**; o botão/modo **Minha estação** foi removido.
- O painel **Bandas agora** deixa de ser clicável e passa a ser somente informativo. A seleção da banda é feita exclusivamente no seletor superior.
- Camadas **Confirmada** e **Previsão** continuam independentes no heatmap e no modo Polígonos.
- O popup de novidades agora sanitiza/converte notas de release em HTML, Markdown ou texto simples para conteúdo seguro e legível, sem exibir tags, atributos internos ou scripts.
- Notas HTML escapadas também são tratadas antes da exibição.
- Testes de regressão cobrem o popup de novidades, Heatmap como padrão, persistência da visualização, remoção do modo Minha estação e painel Bandas agora não clicável.
- Manual, README, Ajuda e traduções nos seis idiomas atualizados.

## v0.2.2 — 2026-10-06

- A visão padrão passa a ser **Propagação da região**, usando a posição configurada como referência geográfica em vez de depender dos contatos de PT2VHF.
- PSK Reporter passa a consultar a região por Grid e classificar enlaces como saída da região ou entrada na região; **Minha estação** permanece disponível como diagnóstico.
- **Bandas agora** foi simplificado para apresentar chance operacional por banda: **Grande chance**, **Boa chance**, **Possível** ou **Chance baixa**, sem expor a lista de fontes no bloco.
- Novo motor combina evidência regional observada com clima espacial para produzir uma **chance estimada**, mantendo separada a força da evidência bruta.
- Adicionada segunda fonte observacional: **Reverse Beacon Network**, consumida pela API pública Vail ReRBN e normalizada no mesmo modelo de enlaces do PSK Reporter.
- NOAA SWPC ampliado: além de Kp, passam a ser consultados **F10.7/SFI, Bz/Bt, velocidade do vento solar e classe de raios X GOES**.
- Mapa ganha dois tipos de polígonos por banda: **Confirmada** (sólido) e **Previsão** (tracejado/translúcido), com controles independentes na legenda.
- As cores continuam específicas por banda. Polígonos previstos são conservadores e só ocupam regiões sustentadas por geometria observacional; o clima espacial ajusta a chance, sem inventar uma área geográfica onde não há base espacial.
- Painel de clima espacial passa a mostrar Kp, SFI, Bz, velocidade do vento solar e raios X.
- Status e LOGs passam a distinguir atividade de PSK Reporter, RBN e NOAA, preservando os LEDs RX/TX baseados em tráfego real.
- Traduções, Ajuda, Sobre, testes e manual atualizados para o novo modelo regional.

## v0.2.1 — 2026-10-06

- Corrigido o fluxo de coleta da v0.2.0 para tornar falhas de consulta visíveis e permitir atualização efetiva do mapa e do painel lateral.
- PSK Reporter passa a aceitar redirecionamentos HTTPS somente entre destinos autorizados, com limite de redirecionamentos e validação de tamanho/resposta.
- Nova aba **LOGs** com tráfego TX/RX, fonte, endpoint, status, duração, volume, erros, prévia limitada do payload, filtros, busca, pausa, limpeza e exportação JSONL.
- LEDs na barra superior: **RX verde** e **TX vermelho**, pulsando somente quando há tráfego real.
- Navegação reorganizada para **Mapa / Configurações / LOGs / Ajuda / Sobre**.
- Configurações agora identifica as fontes efetivamente utilizadas: PSK Reporter, NOAA SWPC, Natural Earth e GitHub.
- Atualização automática dos dados do mapa a cada **5 minutos por padrão**, configurável separadamente da verificação de novas versões.
- Legenda do mapa mostra dinamicamente **direção cardinal, azimute e distância** entre a estação configurada e o ponto sob o cursor.
- Botão de versão passa a fazer checagem imediata em um único fluxo: sem nova versão, retorna à aplicação; com nova versão, baixa e instala automaticamente. Na primeira abertura da nova versão, exibe as novidades uma única vez.
- Verificação automática de versão alterada para **30 minutos por padrão**, configurável; o refresh dos dados do mapa permanece em 5 minutos.
- Estado interno atualizado para schema 4, migrando o antigo padrão de 5 minutos para 30 e preservando intervalos personalizados.

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
