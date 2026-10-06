# Backlog consolidado — PT2VHF Prop Tool

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

As descrições abaixo preservam os critérios acordados. Esses itens recentes estão implementados; fontes adicionais, modelos físicos, IA generativa, MapLibre, Alexa e demais evoluções continuam no roteiro.

## Prioridade imediata: validar v0.1 em Windows

- [x] Criar repositório `alexpmr/PT2VHF-Prop-Tool`, publicar código e executar o workflow Windows.
- Testar instalador, desinstalação, preservação de configurações e portátil em pasta gravável/USB.
- Confirmar consultas reais do indicativo PT2VHF e de seu Grid; verificar ausência de registros, limite de consulta e recuperação após erro/429.
- Validar localização automática, precisão e recusa da permissão.
- Testar alertas com transmissões realmente recebidas, diferentes receptores e múltiplos ciclos de atualização.
- Validar atualização instalada e portátil v0.1 → próxima versão, notas, checksum, cancelamento, preservação de dados e reinício. O fluxo automático está implementado a partir da v0.2.0; na v0.1.0 o portátil ainda exige download manual.
- Assinatura Authenticode e ícone próprio.
- Escolher licença de distribuição.

## Página do projeto e downloads

- Manter o `README.md` exibido na página inicial do repositório GitHub atualizado com a finalidade do software, recursos disponíveis, fontes de dados, requisitos, instruções de instalação/uso e limitações da versão publicada.
- Exibir em destaque a versão mais recente e links diretos para baixar o instalador e o portátil do Windows, além do link para a página da release e suas notas.
- Atualizar a versão e os links a cada publicação, preservando o nome versionado dos executáveis e conferindo que os downloads apontam para os arquivos da release mais recente.
- Separar os recursos já implementados dos itens planejados; não apresentar funcionalidades do backlog como disponíveis.

## Navegação, Sobre e atualização

- Verificar automaticamente a disponibilidade de novas versões da aplicação a cada `30 minutos` por padrão. Manter o intervalo configurável em `Configurações`, adequar a validação para aceitar 5 minutos e preservar intervalos personalizados salvos pelo usuário. Esse intervalo se refere à atualização do software; consultas às fontes de propagação continuam respeitando seus próprios limites.
- Na barra superior, manter a ordem `Mapa`, `Configurações`, `LOGs`, `Ajuda` e `Sobre`. Manter os seletores de contexto do mapa como controles independentes da navegação principal.
- A aba `Sobre` deve apresentar uma breve descrição da aplicação, finalidade, recursos e limitações da versão, autoria `Alex, PT2VHF`, link do projeto e formas de contato fornecidas pelo autor. Traduzir seu conteúdo nos seis idiomas previstos.
- Na mesma barra, exibir um botão de atualização separado do número da versão exibido após o nome da aplicação. Usar `Última versão` em verde quando uma checagem bem-sucedida confirmar que a versão atual é a mais recente, ou `Nova versão disponível` em laranja piscando quando houver uma versão mais nova. Não apresentar falha de consulta como confirmação de versão atualizada.
- Ao clicar em `Nova versão disponível`, iniciar o download e a atualização pelo aplicativo, reproduzindo o fluxo solicitado do PT2VHF APRS Client: informar a versão de destino e as novidades, mostrar andamento, validar integridade, atualizar e reiniciar preservando configurações e dados. Impedir downloads concorrentes e informar erros com possibilidade de nova tentativa. O botão verde pode verificar novamente a disponibilidade.
- Prever esse fluxo para Windows instalado e portátil. Para o portátil, implementar substituição segura do executável após encerrar o processo, preservando a pasta de dados e permitindo recuperar a versão anterior em caso de falha. Implementado na v0.2.0; o mecanismo de download manual permanece apenas na v0.1.0.

## Motor e novas fontes

- Adapters WSPR independente, DX Cluster/HamQTH, GIRO/KC2G e complementos NOAA (D-RAP, GloTEC/TEC, aurora e demais produtos espaciais).
- Confirmar acesso, condições de uso, quotas e disponibilidade antes de ativar cada fonte. Não redistribuir mapas DXMaps sem autorização.
- MUF/foF2, prótons, D-RAP, GloTEC/TEC, aurora e demais camadas espaciais. F10.7, vento solar/Bz e raios X já entram no motor desde a v0.2.2.
- VOACAP para circuitos HF: considerar potência, antena, altura, ganho, polarização e azimute por banda.
- Prop Score calibrado por banda/região; separar força de evidência, cobertura amostral, qualidade do enlace e probabilidade modelada.
- Separar recepção unilateral de QSO confirmado. Analisar modos sem converter automaticamente FT8 em SSB/CW.
- Motor específico VHF/UHF: Es, TEP, F2, tropo/ductos, aurora, meteor scatter e outros mecanismos, explicitando hipóteses.
- Corrigir viés de atividade e cobertura de receptores; ausência de spots não é ausência de propagação.
- Baselines por horário, bandas, região, modos e quantidade de observadores ativos.

## Mapa e operação

- **Mapa — banda corrente em destaque:** exibir, logo abaixo do indicativo da estação no cabeçalho interno do mapa, a **banda atualmente selecionada** em letras grandes e **cor laranja**. Exemplo: `PU2AMR` e, imediatamente abaixo, `20 m`. O texto deve atualizar instantaneamente ao trocar a banda pelo seletor superior. Quando estiver selecionado `Todas as bandas`, exibir `Todas as bandas` (traduzido conforme o idioma) ou uma indicação equivalente, mantendo hierarquia visual clara: indicativo como identificação principal e banda corrente como contexto operacional destacado.
- **Janela de observação — carga retroativa inicial:** na primeira execução com posição válida, ou quando o histórico local ainda não cobrir a janela selecionada, a consulta inicial às fontes observacionais deve tentar buscar dados retroativos correspondentes à **Janela de observação** configurada, em vez de usar uma janela fixa de 1 hora. Exemplo: 15 min busca aproximadamente 15 min; 30 min busca 30 min; 60 min busca 60 min; se forem adicionadas opções futuras de 2 h, 3 h ou 6 h, tentar buscar o mesmo período quando a fonte suportar. **Objetivo operacional:** evitar que uma estação recém-instalada precise aguardar 15–30 minutos para começar a formar o Heatmap; o aplicativo deve iniciar já com dados recentes anteriores à abertura. Assim, se no futuro a Janela de observação estiver em 3 horas, a primeira carga deve tentar recuperar as 3 horas anteriores, quando a fonte permitir, em vez de permanecer limitada à janela fixa atual de 1 hora. Respeitar limites, paginação, quotas e janelas máximas de cada fonte; quando uma fonte não permitir cobrir todo o período solicitado, usar o máximo disponível e indicar no diagnóstico/LOG a cobertura efetivamente obtida. Evitar repetir download de períodos já presentes no histórico local e deduplicar os reports antes de alimentar o Heatmap e o motor de chance.
- **Mapa — “Janela de observação”:** identificar explicitamente o seletor de período do mapa como **Janela de observação**. Esse controle define por quanto tempo as evidências recentes entram na análise/Heatmap exibido (atualmente 15, 30 ou 60 minutos). Usar a mesma nomenclatura em Ajuda, manual, tooltips e demais textos da interface para evitar confusão com intervalo de atualização/coleta.
- Potência padrão de `100 W` na configuração inicial da estação. Manter o valor editável e preservar a potência escolhida pelo usuário entre sessões e atualizações. Esse valor inicial já existe na v0.1.0 e deve ser mantido como requisito.
- Na configuração inicial, habilitar todas as bandas para monitoramento e exibição, incluindo 11 metros quando adicionada, com antena `Vertical` atribuída a cada banda. Permitir alterar posteriormente o tipo de antena por banda e habilitar/desabilitar bandas. Aplicar esses valores somente na inicialização ou a novos campos sem preferência salva, preservando as escolhas existentes do usuário após reiniciar ou atualizar.
- Corrigir o estado vazio do mapa relatado na v0.1.0: o bloco `Sem evidências para este filtro` mantém o botão `Configurar estação` após salvar a configuração. Exibir esse convite somente quando a configuração da estação estiver incompleta. Com a estação configurada e sem recepções, substituir o bloco central por uma indicação discreta que não cubra o mapa.
- Diferenciar visualmente configuração pendente, consulta em andamento, fonte indisponível e ausência de evidências para o período/bandas selecionados. Configuração salva não garante spots disponíveis; continuar indicando que ausência de dados não significa banda fechada.
- Exibir a versão atual imediatamente após o nome da aplicação na barra superior, por exemplo: `PT2VHF Prop Tool v0.1.0`. Obter o número dos metadados da versão em execução para mantê-lo correto após cada atualização.
- Adicionar seletor de tema claro/escuro e persistir a escolha do usuário entre sessões. Aplicar o tema a toda a interface, incluindo abas, painéis, configurações, Ajuda e mapa, garantindo legibilidade e preservando o significado das cores das evidências e da legenda.
- Adicionar a banda de 11 metros à tabela de bandas, aos seletores e filtros, às configurações por banda e às análises do mapa e alertas. Verificar a cobertura das fontes; quando não houver evidências disponíveis, indicar ausência de dados, sem gerar atividade ou conclusões artificiais.
- Seletor de idioma na barra superior: Português (Brasil), inglês, espanhol, francês, alemão e italiano.
- Cada idioma deve ter bandeira própria (Brasil, Reino Unido, Espanha, França, Alemanha e Itália), usando imagens/SVG para funcionar também no Windows, sem depender de emojis de bandeiras.
- Tradução integral de toda a aplicação: abas, menus, botões, configurações, tooltips, validações, mensagens de estado/erro, alertas, notas exibidas pela interface e aba Ajuda. Evitar textos fixos que permaneçam em português ao mudar o idioma.
- Persistir o idioma escolhido, iniciar em Português (Brasil) por padrão e atualizar a interface inteira ao trocar o idioma. Revisar as seis traduções e testar Ajuda e mensagens dinâmicas.

- Visão global com fontes próprias, separada da análise regional padrão; não reintroduzir o antigo modo Minha estação no mapa.
- MapLibre, camadas independentes e legenda Observado / Medido / Previsto.
- Evoluir o heatmap atual com interpolação espacial/contornos mais sofisticados, indicação explícita de incerteza geográfica e suavização configurável. Manter Polígonos como modo técnico alternativo.
- Terminação dia/noite e gray line; MUF, absorção, aurora e meteorologia.
- Painel lateral: regiões favorecidas, azimute, intensidade, evidências, mecanismo provável, confiança qualificada, tendência e última atualização de cada fonte.
- Histórico e reprodução de nascimento, expansão, deslocamento e desaparecimento das zonas.
- Máquinas de estados completas para aberturas por banda/região: surgindo, aberta, forte, enfraquecendo, encerrada; estado desconhecido separado.
- Silenciar alerta por uma hora, horários silenciosos, preferência por eventos relevantes e canais independentes.
- Antenas por banda com altura, ganho, polarização e azimute, além do tipo já implementado.
- Importação ADIF e integração WSJT-X/JTDX.

## IA e integrações futuras

- IA generativa abaixo do mapa, consumindo snapshots auditáveis do motor, com fontes, horários, justificativa e limites.
- Perguntas sobre melhor banda, direção da antena, tendência, causa provável e diagnóstico da própria estação.
- Credenciais opcionais protegidas e consentimento específico para o envio de localização/dados ao provedor escolhido.
- Amazon Alexa somente em fase madura: consultas por voz e notificações oficiais; emissão imediata de fala depende do canal suportado. Integração consumirá eventos do motor, sem acoplamento.
- Canais futuros como voz local, Telegram e Discord, se solicitados.
- Stable e Beta/Nightly; atualização por canal, verificação de integridade e recuperação de falhas.

por Alex, PT2VHF
