# PT2VHF Prop Tool — v0.2.6

Aplicativo experimental para Windows 10/11 x64 que estima **onde há possibilidade de contato a partir da região da estação**, combinando observações reais de propagação, clima espacial e visualização geográfica.

## Downloads da versão atual

| Arquivo | Download direto |
| --- | --- |
| Instalador Windows x64 | [Baixar instalador v0.2.6](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.6/PT2VHF-Prop-Tool-0.2.6-x64-setup.exe) |
| Portátil Windows x64 | [Baixar portátil v0.2.6](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.6/PT2VHF-Prop-Tool-0.2.6-x64-portable.exe) |
| Manual ilustrado em PDF | [Baixar manual v0.2.6](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.6/PT2VHF-Prop-Tool-0.2.6-Manual.pdf) |
| SHA-256 | [Baixar checksums](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.6/SHA256SUMS.txt) |

[Última release publicada](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/latest) · [Notas da versão](CHANGELOG.md) · [Relatar problema ou sugestão](https://github.com/alexpmr/PT2VHF-Prop-Tool/issues)

## O que funciona

- Indicativo, coordenadas, Grid Maidenhead e localização automática quando disponível/autorizada no Windows.
- 14 bandas, de 160 m a 70 cm, incluindo **11 metros**, habilitadas inicialmente com antena **vertical**. Potência inicial **100 W**. Preferências anteriores são preservadas.
- Português, inglês, espanhol, francês, alemão e italiano, com bandeiras SVG, Ajuda e interface traduzidas. Tema claro/escuro persistente.
- Barra superior com versão, menu **Mapa / Configurações / LOGs / Ajuda / Sobre** e LEDs reais de tráfego **RX verde / TX vermelho**.
- **Minha região** é o único contexto operacional do mapa. A posição configurada é a referência; o aplicativo procura enlaces observados envolvendo estações da região, sem depender de transmissões da própria PT2VHF. Atividade diretamente ligada ao indicativo continua acessível pelos LOGs/diagnóstico, sem um modo de mapa separado.
- **PSK Reporter regional por Grid**, incluindo os modos reportados pela rede, com classificação de enlaces de saída e entrada da região.
- **Reverse Beacon Network (RBN)** como fonte observacional de spots automáticos, consultada por meio da API pública Vail ReRBN. Spots com Grid conhecido são normalizados no mesmo modelo geográfico.
- **WSPR.live** como fonte observacional independente de WSPR/WSPRnet. As consultas são limitadas por tempo, bandas habilitadas e Grid regional; os reports entram no mesmo modelo geográfico sem perder a identificação da fonte.
- **NOAA SWPC ampliado:** Kp, F10.7/SFI, Bz/Bt, velocidade do vento solar e classe de raios X GOES entram no contexto da estimativa.
- **Bandas agora** mostra somente a leitura operacional: **Grande chance**, **Boa chance**, **Possível** ou **Chance baixa**, indicando também se a base é observada, fundida ou apenas estimada. O bloco é informativo e não altera filtros.
- A seleção de banda usa **botões compactos na barra superior**, um por banda habilitada, mais **Todas as bandas**. O botão ativo é a única indicação da banda corrente; o nome não é duplicado dentro do mapa.
- **Janela de observação** usa botões diretos de 15, 30 ou 60 minutos. Na primeira carga, ou quando a janela aumenta além do histórico local disponível, PSK Reporter e WSPR.live tentam recuperar retroativamente o período necessário; depois usam consultas incrementais/limitadas para reduzir repetição.
- O motor mantém separados **observado**, **medido** e **estimado**. PSK Reporter, RBN e WSPR.live contribuem como observações; NOAA SWPC contribui como condição física. Convergência entre fontes pode aumentar a confiança, mas uma medição global nunca é convertida automaticamente em confirmação geográfica.
- **11 m / PX:** quando não há fonte observacional compatível, a banda continua recebendo uma estimativa solar/ionosférica conservadora a partir dos dados NOAA, claramente marcada como estimativa e sem inventar regiões no Heatmap.
- **Mapa de calor** é a visualização padrão e usa um **gradiente multicolor de densidade**: tons frios indicam menor concentração e tons quentes maior concentração. A camada é recalculada conforme zoom e deslocamento, em vez de simplesmente ampliar uma mancha já composta. **Polígonos** permanece disponível como visualização técnica alternativa e a preferência é persistida.
- **Confirmada** e **Previsão** continuam como camadas independentes. O heatmap agrega pontos por viewport/zoom e normaliza a intensidade para evitar saturação em branco; ao aproximar, o kernel diminui e revela hotspots mais locais. No modo Polígonos, mantêm contornos sólido e tracejado.
- As áreas previstas permanecem geograficamente conservadoras: dependem de geometria observacional disponível e não inventam continentes/regiões apenas a partir de índices globais. O cursor mostra direção/azimute e distância desde a estação configurada.
- Painel de clima espacial exibe **Kp, SFI, Bz, Vsw e X-Ray**.
- Histórico local de até 24 h; análise nos últimos 15, 30 ou 60 minutos. Refresh automático do mapa a cada **5 minutos por padrão**, configurável.
- Aba **LOGs** registra TX, RX, fonte, endpoint, status, latência, bytes, erros e prévia limitada do payload, incluindo PSK Reporter, WSPR.live, RBN, NOAA e GitHub.
- Verificação de versões a cada **15 minutos** por padrão, configurável. O botão de versão verifica imediatamente e, havendo release nova, inicia o fluxo automático de atualização.
- Na primeira abertura após atualizar, um popup mostra as novidades uma única vez. HTML/Markdown recebido do GitHub é convertido para texto seguro e legível, sem exibir tags ou atributos internos.
- Atualização instalada por electron-updater/NSIS e atualização portátil com substituição segura e recuperação da versão anterior. Ao iniciar a atualização, a aplicação mostra **percentual, bytes transferidos/total e velocidade quando disponíveis**; depois de validar o pacote, fecha, instala/substitui a nova versão **sem perguntas** e abre novamente automaticamente.
- **Reiniciar de fábrica** em Configurações apaga configurações, estação, preferências, histórico, cache, LOGs e dados locais, preserva a versão instalada e reabre o aplicativo como primeira execução.

## Instalar e começar

**Instalador:** execute o setup e siga o assistente. A instalação é feita para a conta atual e as configurações são preservadas na desinstalação.

**Portátil:** coloque o executável em uma pasta gravável, inclusive USB. A pasta `data` fica ao lado do executável e contém configurações e histórico.

Abra **Configurações**, informe indicativo e posição da antena, ajuste bandas/antenas/potência e salve. A tela **Mapa** opera somente em **Minha região** e abre em **Mapa de calor**. Selecione a banda diretamente pelos botões compactos da barra superior ou use **Todas as bandas**. O painel **Bandas agora** não é clicável.

## Como interpretar

- **Confirmada:** há enlaces observados que sustentam aquela região para a banda selecionada.
- **Previsão:** estimativa conservadora derivada da geometria observada e das condições disponíveis; não é garantia de QSO.
- **Grande chance / Boa chance / Possível / Chance baixa:** síntese operacional do motor, não uma promessa estatística de contato.
- Recepção digital não comprova QSO bidirecional e não deve ser convertida automaticamente em garantia para SSB/CW.
- Ausência de spots não significa banda fechada.
- Em **11 m**, a indicação pode ser uma **estimativa solar/ionosférica**, não uma confirmação por spots. A interface sinaliza essa diferença.
- Kp, SFI, Bz, vento solar e raios X são contexto físico global; confirmação geográfica exige dados espaciais/observacionais.

## Limites e roteiro

A v0.2.6 ainda não possui modelo físico completo que use potência, ganho, altura, polarização e azimute da antena. **MUF/foF2, VOACAP, D-RAP, GloTEC/TEC, aurora espacial, DX Cluster e outras fontes** continuam no [roteiro](docs/BACKLOG.md). O WSPR independente já é consultado por meio do WSPR.live.

Os dados RBN chegam por uma API pública de agregação e podem ter Grid ausente, especialmente para alguns indicativos internacionais. PSK Reporter e WSPR.live também dependem de participantes e localização reportada. O aplicativo rejeita evidências sem posição quando ela é necessária para inferência geográfica e mantém a origem de cada fonte para evitar dupla interpretação.

Executáveis ainda sem assinatura Authenticode. Confirme sempre a origem e os hashes SHA-256 publicados.

## Desenvolvimento

Node.js 24, Electron, HTML/CSS, módulos JavaScript e SVG. O workflow Windows executa validação de sintaxe, testes do motor, QA da interface, geração do manual, smoke test Electron, build do instalador/portátil, validação nativa dos pacotes e checksums antes de publicar.

```powershell
npm ci
node node_modules/electron/install.js
python -m pip install pillow reportlab pypdf
python scripts/make-manual.py
npm run check
npm test
npm start
npm run dist:win
```

## Fontes e contato

- [PSK Reporter — API](https://www.pskreporter.info/pskdev.html)
- [NOAA Space Weather Prediction Center](https://services.swpc.noaa.gov/)
- [WSPR.live — banco público WSPR](https://wspr.live/)
- [Reverse Beacon Network](https://www.reversebeacon.net/)
- [Vail ReRBN — API pública de spots RBN](https://vailrerbn.com/docs)
- [Natural Earth — mapa 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)
- [Projeto](https://github.com/alexpmr/PT2VHF-Prop-Tool) · [Problemas e sugestões](https://github.com/alexpmr/PT2VHF-Prop-Tool/issues) · [Perfil do autor](https://github.com/alexpmr)

Licença do projeto a definir antes da distribuição pública definitiva. As licenças das dependências/runtime são preservadas.

por Alex, PT2VHF
