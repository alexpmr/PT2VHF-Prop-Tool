# Arquitetura v0.1 e direção de evolução

O renderer desenha o mapa e os controles. Não tem acesso a Node.js, ao sistema de arquivos ou a URLs arbitrárias. O preload expõe operações limitadas de configuração, consulta e atualização. O processo principal valida a origem do IPC, controla as fontes e persiste o estado local atomicamente.

`src/domain.mjs` normaliza recepções, converte Grid/coordenadas, calcula distância/azimute, seleciona evidências, remove duplicatas e constrói zonas. O código é puro e permite testes sem Electron. `src/sources.mjs` define adapters e limites de acesso. O processo principal impede consultas PSK antes de cinco minutos, persistindo a tentativa antes da operação de rede.

O armazenamento inicial é JSON com retenção de até 24 horas e limite de 20.000 recepções. SQLite/DuckDB são evolução necessária antes de ampliar coleta, replay e análise histórica. Um banco ou modelo ainda não implementado não é apresentado como ativo.

O índice de evidências é experimental: quantidade de enlaces distintos, quantidade de recepções e idade da evidência. Seu valor 0–100 não é percentual de sucesso e não tem calibração operacional. Kp não entra nesse índice; sua presença não estabelece MUF ou mecanismo de propagação. Potência e antenas são armazenadas como configuração, sem efeito fictício no resultado.

Recepções da própria estação têm direção explícita. Na visão regional, transmissores conhecidos a até 300 km são identificados como evidência de estações próximas. Isso não confirma condições equivalentes da estação do usuário. No filtro de Grid, a coleta é limitada à área retornada pelo serviço; a aplicação não declara cobertura completa de um raio.

Zonas iniciais unem somente células adjacentes de 2° que contêm observações, com mínimo de três enlaces e duas células. Bordas compartilhadas são removidas; não se preenche um continente usando pontos distantes. Mesmo dentro de uma célula, os pontos não comprovam propagação em toda a superfície. A resolução será refinada conforme a incerteza do Grid e a densidade de receptores.

Alertas exigem pelo menos três enlaces diferentes da própria transmissão em uma zona, evidência recente, distância e limiar configurados. Dados regionais ou falha de fonte não criam automaticamente alertas de alcance pessoal. Histerese e intervalo impedem repetição a cada consulta. A evolução será uma máquina de estados por zona/banda e mecanismo, com estado desconhecido próprio.

O assistente inicial usa regras locais e explica os dados disponíveis. A futura IA generativa não determinará abertura autonomamente; receberá um snapshot do motor e dará uma interpretação rastreável. Modos digitais, medições e previsões serão camadas distintas.

O projeto usa Electron para esta primeira distribuição; o baseline funcional continua voltado a adaptadores independentes, motor separado, mapa e painel. A pilha inicialmente sugerida com React/Tauri/MapLibre não era uma implementação existente. Mudanças futuras de frontend não devem alterar o modelo das evidências.

Os dois pacotes são produzidos com NSIS. O portátil extrai em diretório temporário e usa uma pasta de dados ao lado do lançador. O instalador registra apenas no perfil atual e seu desinstalador enumera arquivos próprios. Releases futuras alimentam electron-updater na edição instalada. A atualização entre duas versões ainda requer teste em Windows e publicação remota.

por Alex, PT2VHF


## Evolução v0.2.0

- Catálogo compartilhado em `src/i18n.mjs`: seis idiomas, parâmetros de mensagens verificados, bandeiras SVG e localidade para horários.
- Esquema de estado 2: migração de perfis da v0.1 preserva personalizações e acrescenta 11 m aos perfis que exibiam todas as bandas. Não reativa uma banda desabilitada depois da migração.
- Escritas de estado serializadas e atômicas; mudanças de idioma/tema não reiniciam a máquina de alertas.
- Atualização instalada mantém electron-updater, SHA-512 e instalador NSIS. Handoff externo aguarda saída do processo antes de aplicar e exige confirmação de inicialização.
- Portátil verifica asset do repositório esperado, SHA-256, tamanho e cabeçalho PE. Redirecionamentos ficam limitados aos hosts GitHub previstos. O worker PowerShell espera a aplicação e o lançador encerrarem, mantém backup do lançador e estado, confirma versão do novo renderer e recupera ambos se necessário.
- Renderer continua sem acesso direto ao sistema de arquivos. Links externos usam destinos fixos no processo principal.
- O PDF é artefato da release, reproduzido a partir de capturas reais do renderer em prévia local, sem evidências fictícias.
