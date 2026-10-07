# Changelog

## v0.2.12 — 2026-10-07

- **RBN deixa de usar prefixo de indicativo como definição de região.**
- A região passa a ser definida pela posição configurada da estação e pelo **raio regional em km**.
- O raio é configurável em Configurações, com padrão de 300 km e faixa de 1 a 2.000 km.
- Vail ReRBN passa a ser consultado por banda habilitada e Janela de observação, sem filtros `call`/`spotter` usados como localização.
- Grids TX e RX/skimmer são convertidos em coordenadas e o aplicativo mantém apenas enlaces em que exatamente um extremo esteja dentro do raio e o outro fora.
- Enlaces com os dois extremos dentro do raio são tratados como locais e não alimentam o Heatmap DX; enlaces com ambos fora são descartados.
- Spots sem localização suficiente dos dois extremos não são usados como evidência geográfica.
- Paginação adicional é usada quando uma consulta por banda ultrapassa 1.000 spots.
- Testes cobrem estação de prefixo local operando longe, estação de outro prefixo dentro do raio, ambos extremos dentro/fora do raio e URLs RBN sem filtro de indicativo.

## v0.2.11 — 2026-10-07

- Corrigido o cenário em que desligar **PSK Reporter** podia deixar o mapa sem evidências úteis mesmo com outras fontes ativas.
- A filtragem de fontes observacionais foi centralizada e passa a manter WSPR.live e RBN independentes do PSK.
- RBN agora consulta o prefixo regional do indicativo configurado nos dois sentidos: estações DX da região (`call`) e skimmers da região (`spotter`), respeitando a Janela de observação.
- A consulta RBN global de 1.000 spots deixa de ser a única base para a análise regional.
- VOACAP deixa de criar novos circuitos a partir de fontes observacionais desativadas.
- Testes cobrem PSK desligado, WSPR isolado, RBN isolado e URLs RBN regionais.

## v0.2.10 — 2026-10-07

- Fontes **PSK / WSPR / RBN / NOAA / VOACAP / MUF** ganham botões rápidos ao lado da Janela de observação.
- Desativar uma fonte retira apenas sua contribuição do snapshot analítico atual; coleta, cache e histórico permanecem intactos.
- Heatmap, Bandas agora, confiança, destinos observados, clima espacial e MUF passam a refletir imediatamente a combinação de fontes ativas.
- Preferência das fontes é persistida no perfil.
- Novo seletor de mapa base: **Padrão, Claro, Escuro e Relevo**, todos offline e compatíveis com o Heatmap.
- Preferência de mapa base persistida sem criar dependência de provedores externos.
- Painéis NOAA/MUF deixam claro quando a fonte correspondente está desativada.
- Testes de configuração atualizados para filtros de fonte e mapa base.

## v0.2.9 — 2026-10-06

- Nova fonte **KC2G/GIRO** de medições de ionossondas, consumida via HTTPS de `prop.kc2g.com/api/stations.json`.
- Parser validado de **foF2**, **MUF(3000)F2**, coordenadas, hora da leitura, identificação da ionossonda e indicador de confiança quando fornecido.
- Seleção da ionossonda mais próxima a até 1.800 km, com medição de no máximo 90 minutos; não são exibidas medições vencidas.
- Painel **Ionosfera** mostra MUF(3000), foF2, distância e data/hora do dado.
- O contexto MUF aparece junto às bandas HF, sem modificar artificialmente o score/VOACAP nem converter MUF(3000) em limite absoluto de um circuito.
- Atualização automática da fonte a cada 15 minutos, LOGs completos e estados de indisponibilidade sem bloquear demais fontes.
- Tradução PT-BR, EN, ES, FR, DE, IT; testes para parsing e seleção.

## v0.2.8 — 2026-10-06

- **VOACAP local** integrado como primeira camada física de previsão HF, sem automatizar o site voacap.com.
- O aplicativo detecta o motor oficial Windows em `C:\\itshfbc\\bin_win\\voacapw.exe` ou pelos overrides `PT2VHF_VOACAP_ROOT` / `PT2VHF_VOACAP_BIN`.
- Os destinos VOACAP são derivados exclusivamente de endpoints geolocalizados realmente observados por PSK Reporter, WSPR.live ou RBN; nenhum país/região é inventado apenas pelo modelo.
- Até 12 circuitos recentes são calculados a cada 15 minutos, usando todas as bandas HF suportadas de 80 m a 10 m, incluindo 11 m.
- A potência configurada da estação entra no deck VOACAP. O SSN inicial é estimado a partir do F10.7 medido pelo NOAA SWPC enquanto uma fonte direta de SSN não é incorporada.
- A confiabilidade VOACAP da hora UTC atual é fundida ao score operacional sem ser contada como evidência observada.
- A camada **Previsão** do Heatmap passa a incluir os destinos calculados pelo VOACAP com intensidade proporcional à confiabilidade.
- LOGs registram execução local, duração, saída limitada para diagnóstico, quantidade de circuitos e indisponibilidade do motor.
- Testes adicionados para geração do deck, parser REL, seleção de destinos e fusão no score.

## v0.2.7 — 2026-10-06

- O mapa passa a operar **exclusivamente em Heatmap**. O seletor Heatmap/Polígonos, a preferência persistida e o renderer alternativo foram removidos; perfis antigos migram automaticamente.
- O motor passa a expor **confiança separada da chance**, considerando diversidade de PSK Reporter/WSPR.live/RBN, qualidade geográfica, freshness, quantidade de enlaces e convergência.
- Evidências do mesmo enlace/banda na mesma janela curta, vistas por mais de uma fonte, são tratadas como **convergência multifuente**, evitando multiplicação integral do mesmo evento.
- Nova base geográfica offline **Natural Earth Admin 0 1:110m**, com 177 países e nomes nos seis idiomas da aplicação.
- Novo painel **Destinos observados** mostra os países mais presentes nas evidências geolocalizadas do filtro atual.
- O Assistente passa a responder perguntas sobre **países/regiões favorecidos** usando fronteiras reais, além de informar direção predominante, fontes e confiança.
- O README do GitHub passa a exibir **Instalador, Portable e Manual PDF logo no topo** da área de documentação.
- Ajuda, manual, traduções, testes e validações atualizados.
- Backlog consolidado limpo: requisitos já entregues e contradições históricas deixam de aparecer como pendências atuais.

## v0.2.6 — 2026-10-06

- **WSPR.live** integrado como nova fonte observacional independente, consultada por Grid, bandas habilitadas e Janela de observação.
- O motor passa a considerar convergência entre PSK Reporter, WSPR.live e RBN sem simplesmente duplicar a mesma evidência; origem, timestamp e tipo da fonte permanecem identificáveis.
- Resultados passam a indicar a base usada: observado, observado + condições físicas, estimativa solar/ionosférica ou base insuficiente.
- **11 m / PX** deixa de depender de spots para apresentar estado operacional: quando não há observação compatível, usa estimativa conservadora baseada em SFI/F10.7, Kp, Bz, vento solar e raios X, sem inventar confirmação geográfica.
- Seletor pull-down de bandas substituído por **botões compactos** na barra superior, incluindo **Todas as bandas**; somente bandas habilitadas são mostradas.
- Removidas do mapa a indicação textual duplicada da banda e o subtítulo descritivo.
- **Janela de observação** passa a usar botões diretos de 15, 30 e 60 minutos; controles `select` restantes recebem contraste explícito nos temas claro/escuro.
- Assistente local passa a interpretar diferentes intenções — melhor banda, banda específica, direção/azimute, tráfego, última evidência, fontes, Heatmap, Janela de observação, score e limitações — em vez de responder sempre com a mesma mensagem.
- Configurações ganha **Reiniciar de fábrica**, com confirmação, remoção de configurações/histórico/cache/LOGs/dados locais e reabertura automática sem remover a versão instalada.
- Verificação automática de novas versões passa a **15 minutos por padrão**, permanecendo configurável.
- Manual, Ajuda, README, traduções e testes atualizados.

## v0.2.5 — 2026-10-06

- O período do mapa passa a ser identificado como **Janela de observação**, separando claramente duração da análise e intervalo de atualização das fontes.
- A consulta inicial do PSK Reporter deixa de usar 1 hora fixa e passa a solicitar o período correspondente à Janela de observação: 15, 30 ou 60 minutos.
- Se a Janela de observação for ampliada e o histórico local não cobrir o novo período, a aplicação executa **carga retroativa imediata**.
- Depois da cobertura inicial, as consultas PSK usam janela incremental com pequena sobreposição, reduzindo downloads repetidos e preservando deduplicação.
- Status e LOGs registram carga retroativa/incremental, período consultado e atingimento do limite de reports quando aplicável.
- A banda selecionada passa a aparecer em **letras grandes laranja** logo abaixo do indicativo no mapa; sem filtro, aparece Todas as bandas no idioma ativo.
- Ajuda, manual, README, traduções e testes atualizados.

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
