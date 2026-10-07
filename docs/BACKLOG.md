# Backlog consolidado — PT2VHF Prop Tool

## Entregue na v0.2.12

- RBN regional redefinido por **posição + raio configurável em km**, sem usar prefixo de indicativo como critério geográfico.
- Campo **Raio da região (km)** exposto em Configurações; 300 km por padrão, ajustável entre 1 e 2.000 km.
- Consulta Vail ReRBN passa a ser feita por banda habilitada e Janela de observação; grids TX/RX são filtrados localmente pelo raio.
- Somente enlaces que cruzam o limite regional (um extremo dentro, outro fora) alimentam a análise DX/Heatmap.
- Enlaces totalmente locais, totalmente externos ou sem localização suficiente são excluídos da evidência geográfica.
- Testes cobrem estação com prefixo local operando fora da região e estação com outro prefixo operando dentro do raio.

## Entregue na v0.2.11

- Corrigida a comparação de fontes quando **PSK Reporter** está desligado.
- WSPR.live e Reverse Beacon Network passam a continuar alimentando observações e Heatmap de forma independente.
- Consulta RBN passa a usar o **prefixo regional do indicativo configurado** para pesquisar tanto estações transmitindo quanto skimmers da região, em vez de depender apenas dos 1.000 spots globais mais recentes.
- VOACAP passa a derivar novos alvos somente das fontes observacionais atualmente habilitadas.
- Testes de regressão adicionados para PSK desligado, WSPR-only, RBN-only e geração das consultas RBN regionais.

## Entregue na v0.2.10

- Controles rápidos de fontes na mesma linha da **Janela de observação**: PSK Reporter, WSPR.live, RBN, NOAA SWPC, VOACAP e KC2G/GIRO (MUF/foF2).
- Cada fonte pode ser ligada/desligada para comparação sem interromper a coleta nem apagar histórico; Heatmap, scores, confiança, destinos e painéis usam somente as fontes ativas.
- Estado ativo/inativo persistido no perfil e atualização imediata da análise ao alternar uma fonte.
- Novo seletor de **mapa base** com quatro estilos offline: Padrão, Claro, Escuro e Relevo; preferência persistida e sem dependência externa.
- Controles Confirmada/Previsão permanecem removidos; as duas naturezas de evidência são compostas automaticamente no Heatmap.
- Testes e documentação atualizados para filtros de fonte e mapas base.

## Entregue na v0.2.9

- Interface do mapa simplificada: removidos os controles manuais **Confirmada / Previsão**; ambas as camadas passam a ser exibidas automaticamente no Heatmap.
- MUF(3000)F2 e foF2 medidos por ionossondas via KC2G/GIRO; identificação, distância, atualização 15 min, limite de 90 min e panel Ionosfera.
- Sinalização da referência MUF junto às bandas HF, sem confundir MUF(3000) com MUF exata do circuito.
- LOGs de consulta e erros; textos nos seis idiomas; testes automatizados.

## Entregue na v0.2.8

- **VOACAP local — primeira fase:** integração do motor VOACAPW para circuitos HF calculados localmente, sem consumir automaticamente voacap.com.
- Detecção padrão em `C:\\itshfbc\\bin_win\\voacapw.exe`, com caminhos substituíveis por variáveis de ambiente.
- Destinos de cálculo derivados apenas de evidências geolocalizadas PSK Reporter/WSPR.live/RBN, com limite de 12 circuitos recentes por ciclo.
- Potência configurada aplicada ao deck; SSN provisoriamente estimado do F10.7 NOAA; confiabilidade REL da hora UTC atual fundida ao score sem virar evidência observada.
- Heatmap Previsão e LOGs passam a exibir/registrar VOACAP.
- Testes unitários para deck, parser, alvos e fusão.

## Entregue na v0.2.7

- **Mapa exclusivamente Heatmap:** removido o seletor Heatmap/Polígonos, a preferência persistida e o renderer de polígonos. Perfis antigos com `mapView=polygons` migram automaticamente sem intervenção.
- **Fusão com confiança própria:** chance e confiança passam a ser métricas distintas. A confiança considera diversidade de PSK Reporter/WSPR.live/RBN, qualidade geográfica do Grid/posição, freshness, quantidade de enlaces e convergência entre fontes.
- **Deduplicação lógica multifuente:** o mesmo enlace/banda observado na mesma janela curta por mais de uma fonte conta como convergência, sem ser multiplicado como vários eventos independentes completos.
- **Destinos observados:** painel lateral mostra os principais países do filtro atual a partir das coordenadas reais das evidências.
- **Geografia offline:** incorporada base Natural Earth Admin 0 1:110m com 177 países e nomes em PT-BR, EN, ES, FR, DE e IT.
- **Assistente geográfico:** perguntas sobre países/regiões favorecidos retornam nomes geográficos reais, direção predominante, fontes e confiança; não inferem país apenas por azimute.
- **README com downloads primeiro:** Instalador Windows, Portable e Manual PDF passam a ser o primeiro bloco útil do README na página do GitHub.
- Ajuda, manual, traduções, testes, validação da base geográfica e documentação atualizados.
- Backlog consolidado limpo para remover requisitos já entregues e contradições históricas.

## Entregue na v0.2.6

- Seleção de bandas por botões compactos na barra superior, incluindo **Todas as bandas**; removido o pull-down de banda.
- O botão ativo passa a ser a única indicação da banda corrente; removidas a indicação textual duplicada e o subtítulo descritivo do mapa.
- Janela de observação passa a usar botões diretos de 15, 30 e 60 minutos, eliminando o dropdown problemático no tema escuro; demais selects recebem contraste explícito por tema.
- **WSPR.live** integrado como nova fonte observacional independente, consultada por Grid, tempo e bandas habilitadas e fundida com PSK Reporter/RBN sem perder origem/timestamp.
- 11 m / PX passa a usar uma **estimativa solar/ionosférica** conservadora com NOAA quando não há observação compatível, claramente identificada como estimativa e sem criar confirmação geográfica.
- “Bandas agora” informa a base do resultado: observado, observado + condições físicas, estimativa solar/ionosférica ou base insuficiente.
- Assistente local passa a reconhecer intenções diferentes: melhor banda, banda específica, direção/azimute, tráfego, última evidência, fontes, Heatmap, Janela de observação, score e limitações.
- Perguntas não reconhecidas deixam de cair automaticamente em “Maior chance agora”.
- Configurações ganha **Reiniciar de fábrica**, com confirmação, limpeza dos dados locais/cache/LOGs e reabertura automática.
- Intervalo padrão de checagem de nova versão passa para **15 minutos**, mantendo campo configurável.
- Ajuda, manual, README, seis idiomas e testes atualizados.

## Entregue na v0.2.5

- O seletor de período do mapa passa a ser identificado explicitamente como **Janela de observação**.
- A primeira consulta do PSK Reporter usa a Janela de observação selecionada como carga retroativa inicial, evitando esperar o Heatmap se formar apenas com dados futuros.
- Quando a Janela de observação aumenta e o histórico local não cobre o novo período, a aplicação dispara carga retroativa imediata; consultas seguintes usam sobreposição incremental para evitar downloads repetidos.
- O LOG/status do PSK informa se a consulta foi carga retroativa ou incremental, o período solicitado e quando o limite de reports foi atingido.
- A banda corrente é exibida em letras grandes laranja logo abaixo do indicativo no mapa; sem filtro, mostra **Todas as bandas** no idioma ativo.
- Ajuda, manual, traduções e testes atualizados para a nova nomenclatura e comportamento.

## Entregue na v0.2.4

- Heatmap multicolor por densidade/intensidade, com escala perceptual frio → quente e normalização para evitar saturação em branco.
- Heatmap recalculado por viewport/zoom em camada própria, sem ampliar geometricamente a composição anterior.
- Kernel/raio reduzido progressivamente em zoom alto para revelar hotspots locais e maior detalhe espacial.
- Marcador e rótulo da estação mantêm tamanho visual constante durante zoom/pan.
- Atualização com barra de progresso real, percentual, bytes baixados/total e velocidade quando disponível.
- Instalação/substituição automática após validação, sem perguntas intermediárias, com fechamento e reabertura automáticos.
- Fluxo aplicado à edição instalada e Portable, preservando versão anterior/rollback em caso de falha.
- Testes de regressão para gradiente, densidade, zoom, marcador e progresso de atualização.

## Entregue na v0.2.3

- Mapa de calor como visualização padrão, usando manchas graduais por banda em vez da aparência quadriculada dos polígonos/células.
- Alternância Heatmap / Polígonos no menu do mapa, com preferência persistida; Heatmap é o default de novos perfis e perfis antigos sem preferência.
- Camadas Confirmada e Previsão disponíveis nos dois modos de visualização.
- Removido o botão/modo Minha estação; o mapa opera somente em Minha região.
- Bandas agora passa a ser somente informativo; clique nas linhas não altera mais a banda.
- Seleção da banda exibida exclusivamente pelo seletor do menu superior do mapa.
- Popup de novidades sanitiza HTML/Markdown/texto simples e não exibe mais tags, atributos ou código bruto do GitHub.
- Testes de regressão para HTML normal/escapado, Markdown, Heatmap padrão/persistido e interações de banda.

## Entregue na v0.2.2

- Propagação da região como visão padrão; a estação configurada define a origem geográfica, sem exigir atividade própria para alimentar a análise.
- PSK Reporter regional por Grid, separando enlaces de saída e de entrada da região.
- Reverse Beacon Network como segunda fonte observacional, via Vail ReRBN.
- NOAA SWPC ampliado com Kp, F10.7/SFI, Bz/Bt, vento solar e raios X GOES.
- “Bandas agora” simplificado para Grande chance / Boa chance / Possível / Chance baixa.
- Motor de chance multifuente, separando evidência observada da estimativa operacional.
- Polígonos por banda em dois estados: Confirmada (sólido) e Previsão (tracejado/translúcido).
- Controles independentes para exibir/ocultar Confirmada e Previsão.
- Painel de clima espacial com Kp, SFI, Bz, vento solar e raios X.
- Minha estação mantida como visão diagnóstica opcional.
- LOGs e indicadores RX/TX passam a registrar também o tráfego RBN e as consultas NOAA adicionais.

## Entregue na v0.2.1

- Corrigido o fluxo de coleta/atualização que podia deixar a v0.2.0 sem dados visíveis no mapa e no painel lateral.
- Nova aba **LOGs** com diagnóstico fim a fim: TX/RX, fonte, endpoint, status, duração, volume, erros, prévia limitada do payload, filtros, busca, pausa, limpeza e exportação.
- LEDs de atividade **RX verde** e **TX vermelho**, acionados somente por tráfego real.
- Navegação: **Mapa / Configurações / LOGs / Ajuda / Sobre**.
- Configurações lista PSK Reporter, NOAA SWPC, Natural Earth e GitHub e seus papéis.
- Refresh dos dados do mapa a cada **5 minutos por padrão**, configurável separadamente da verificação de versão.
- Mapa exibe **direção/azimute e distância** da estação até o ponto sob o cursor.
- Redirecionamentos da API PSK Reporter tratados com validação HTTPS, hosts autorizados e limite de saltos.
- Botão de versão com checagem imediata e fluxo automático de download/instalação quando houver atualização; sem nova versão, nenhuma janela intermediária permanece aberta.
- Popup de novidades exibido uma única vez na primeira abertura após atualização.
- Checagem automática de versão a cada **30 minutos por padrão**, configurável; refresh do mapa permanece em 5 minutos.

## Entregue na v0.2.0

- Idiomas PT-BR / EN / ES / FR / DE / IT com bandeiras, Ajuda e Sobre traduzidos.
- Temas claro/escuro, versão junto ao nome, Configurações penúltima e Sobre última.
- Padrões: 14 bandas com 11 m, antenas verticais, 100 W e verificação de versões a cada 5 minutos; preferências existentes preservadas.
- Aviso discreto sem cobrir o mapa após configurar a estação.
- Atualização instalada e portátil com integridade, reinício e recuperação do portátil.
- README com downloads diretos; manual PDF com telas.

## Validações de campo ainda pendentes

- Testar instalador, desinstalação e preservação de configurações em máquinas Windows reais.
- Testar Portable em pasta gravável e USB, incluindo atualização e rollback.
- Confirmar consultas reais por Grid/indicativo, cenários sem registros, limites das fontes e recuperação após erro/429.
- Validar localização automática, precisão e recusa da permissão.
- Testar alertas com eventos reais, múltiplas fontes e vários ciclos de atualização.
- Validar OTA instalada e Portable entre versões publicadas, preservando dados.
- Assinatura Authenticode e ícone próprio.
- Escolher licença de distribuição do projeto.

## Motor, fontes e modelagem

- Integrar novas fontes somente após validar acesso, termos de uso, quotas e estabilidade: **DX Cluster/HamQTH**, **GIRO/KC2G**, **D-RAP**, **GloTEC/TEC**, aurora, prótons e outros produtos NOAA/SWPC. Não redistribuir mapas de terceiros sem autorização.
- Evoluir MUF/foF2 já integrados: campo ionosférico interpolado, estimativa de MUF por trajetória/caminho real, integração opcional GloTEC/TEC, dados históricos e calibração para 11 m, sem confundir MUF(3000) com MUF de circuito.
- Evoluir a integração **VOACAP** já implantada: adicionar SSN observado direto, modelos reais de antena por banda (ganho, altura, polarização e azimute), modo/RSN configurável, long path, cache mais sofisticado e eventualmente VOAAREA para cobertura independente de spots.
- Calibrar o Prop Score/confiança com dados históricos e validação real por banda/região; os pesos operacionais atuais ainda não são probabilidades científicas de QSO.
- Separar recepção unilateral de QSO confirmado e evitar converter automaticamente evidência FT8/WSPR em garantia equivalente para SSB/CW.
- Criar motor específico VHF/UHF para **Es, TEP, F2, tropo/ducting, aurora e meteor scatter**, explicitando mecanismo provável e nível de confiança.
- Corrigir vieses de cobertura/atividade por quantidade de receptores e construir baselines por horário, banda, região, modo e observadores ativos.
- Evoluir 11 m/PX com MUF/foF2, TEC/GloTEC e modelos F2/Es/TEP; manter estimativa solar sempre separada de confirmação geográfica.

## Mapa e análise operacional

- Evoluir o seletor de mapa base já entregue com provedores **online opcionais** (ex.: satélite/topográfico de terceiros) somente após validar licença, termos de uso, atribuição e estratégia de fallback/cache; manter sempre as quatro bases offline atuais disponíveis.

- Criar visão global separada da análise regional padrão, sem reintroduzir o antigo modo Minha estação.
- Avaliar MapLibre e camadas independentes **Observado / Medido / Previsto**.
- Evoluir o Heatmap com interpolação/contornos mais sofisticados, incerteza espacial explícita e suavização configurável.
- Adicionar terminador dia/noite e gray line; avaliar camadas de MUF, absorção, aurora e meteorologia.
- Ampliar o painel lateral além dos destinos/confiança já entregues: mecanismo provável, tendência, intensidade, azimute e freshness individual de cada fonte.
- Histórico/replay do nascimento, expansão, deslocamento e desaparecimento das zonas.
- Máquina de estados por banda/região: surgindo, aberta, forte, enfraquecendo, encerrada e desconhecida.
- Alertas: silenciar por uma hora, horários silenciosos, eventos relevantes e canais independentes.
- Antenas por banda com altura, ganho, polarização e azimute, além do tipo já cadastrado.
- Importação ADIF e integração WSJT-X/JTDX.

## Assistente e integrações futuras

- IA generativa opcional consumindo snapshots auditáveis do motor, com fontes, horários, justificativa e limitações.
- Diagnóstico mais avançado: melhor banda, direção de antena, tendência, causa provável e saúde da própria estação.
- Credenciais opcionais protegidas e consentimento explícito antes de enviar localização/dados a qualquer provedor externo.
- Amazon Alexa apenas em fase madura; considerar também voz local, Telegram e Discord se houver demanda.
- Canais Stable e Beta/Nightly, com atualização por canal, integridade e recuperação de falhas.

por Alex, PT2VHF
