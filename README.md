# PT2VHF Prop Tool — v0.2.3

Aplicativo experimental para Windows 10/11 x64 que estima **onde há possibilidade de contato a partir da região da estação**, combinando observações reais de propagação, clima espacial e visualização geográfica.

## Downloads da versão atual

| Arquivo | Download direto |
| --- | --- |
| Instalador Windows x64 | [Baixar instalador v0.2.3](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.3/PT2VHF-Prop-Tool-0.2.3-x64-setup.exe) |
| Portátil Windows x64 | [Baixar portátil v0.2.3](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.3/PT2VHF-Prop-Tool-0.2.3-x64-portable.exe) |
| Manual ilustrado em PDF | [Baixar manual v0.2.3](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.3/PT2VHF-Prop-Tool-0.2.3-Manual.pdf) |
| SHA-256 | [Baixar checksums](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.3/SHA256SUMS.txt) |

[Última release publicada](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/latest) · [Notas da versão](CHANGELOG.md) · [Relatar problema ou sugestão](https://github.com/alexpmr/PT2VHF-Prop-Tool/issues)

## O que funciona

- Indicativo, coordenadas, Grid Maidenhead e localização automática quando disponível/autorizada no Windows.
- 14 bandas, de 160 m a 70 cm, incluindo **11 metros**, habilitadas inicialmente com antena **vertical**. Potência inicial **100 W**. Preferências anteriores são preservadas.
- Português, inglês, espanhol, francês, alemão e italiano, com bandeiras SVG, Ajuda e interface traduzidas. Tema claro/escuro persistente.
- Barra superior com versão, menu **Mapa / Configurações / LOGs / Ajuda / Sobre** e LEDs reais de tráfego **RX verde / TX vermelho**.
- **Minha região** é o único contexto operacional do mapa. A posição configurada é a referência; o aplicativo procura enlaces observados envolvendo estações da região, sem depender de transmissões da própria PT2VHF. Atividade diretamente ligada ao indicativo continua acessível pelos LOGs/diagnóstico, sem um modo de mapa separado.
- **PSK Reporter regional por Grid**, incluindo os modos reportados pela rede, com classificação de enlaces de saída e entrada da região.
- **Reverse Beacon Network (RBN)** como segunda fonte observacional, consultada por meio da API pública Vail ReRBN. Spots com Grid conhecido são normalizados no mesmo modelo geográfico do PSK Reporter.
- **NOAA SWPC ampliado:** Kp, F10.7/SFI, Bz/Bt, velocidade do vento solar e classe de raios X GOES entram no contexto da estimativa.
- **Bandas agora** mostra somente a leitura operacional: **Grande chance**, **Boa chance**, **Possível** ou **Chance baixa**. O bloco é apenas informativo e não altera filtros; a banda exibida é escolhida exclusivamente no seletor superior.
- O motor mantém separados o índice de evidência observada e a **chance estimada**. O clima espacial ajusta a chance de forma conservadora; não transforma automaticamente uma medição global em confirmação local.
- **Mapa de calor** é a visualização padrão. A densidade/intensidade das recepções forma manchas graduais por banda, eliminando a aparência quadriculada das células. **Polígonos** permanece disponível como visualização técnica alternativa e a preferência é persistida.
- **Confirmada** e **Previsão** continuam como camadas independentes. No heatmap, Confirmada usa focos menores/mais intensos e Previsão áreas mais amplas/suaves; no modo Polígonos, mantêm contornos sólido e tracejado.
- As áreas previstas permanecem geograficamente conservadoras: dependem de geometria observacional disponível e não inventam continentes/regiões apenas a partir de índices globais. O cursor mostra direção/azimute e distância desde a estação configurada.
- Painel de clima espacial exibe **Kp, SFI, Bz, Vsw e X-Ray**.
- Histórico local de até 24 h; análise nos últimos 15, 30 ou 60 minutos. Refresh automático do mapa a cada **5 minutos por padrão**, configurável.
- Aba **LOGs** registra TX, RX, fonte, endpoint, status, latência, bytes, erros e prévia limitada do payload, incluindo PSK Reporter, RBN, NOAA e GitHub.
- Verificação de versões a cada **30 minutos** por padrão, configurável. O botão de versão verifica imediatamente e, havendo release nova, inicia o fluxo automático de atualização.
- Na primeira abertura após atualizar, um popup mostra as novidades uma única vez. HTML/Markdown recebido do GitHub é convertido para texto seguro e legível, sem exibir tags ou atributos internos.
- Atualização instalada por electron-updater/NSIS e atualização portátil com substituição segura e recuperação da versão anterior.

## Instalar e começar

**Instalador:** execute o setup e siga o assistente. A instalação é feita para a conta atual e as configurações são preservadas na desinstalação.

**Portátil:** coloque o executável em uma pasta gravável, inclusive USB. A pasta `data` fica ao lado do executável e contém configurações e histórico.

Abra **Configurações**, informe indicativo e posição da antena, ajuste bandas/antenas/potência e salve. A tela **Mapa** opera somente em **Minha região** e abre em **Mapa de calor**. Selecione uma banda exclusivamente pelo seletor superior ou mantenha **Todas as bandas**. O painel **Bandas agora** não é clicável.

## Como interpretar

- **Confirmada:** há enlaces observados que sustentam aquela região para a banda selecionada.
- **Previsão:** estimativa conservadora derivada da geometria observada e das condições disponíveis; não é garantia de QSO.
- **Grande chance / Boa chance / Possível / Chance baixa:** síntese operacional do motor, não uma promessa estatística de contato.
- Recepção digital não comprova QSO bidirecional e não deve ser convertida automaticamente em garantia para SSB/CW.
- Ausência de spots não significa banda fechada.
- Kp, SFI, Bz, vento solar e raios X são contexto físico global; confirmação geográfica exige dados espaciais/observacionais.

## Limites e roteiro

A v0.2.3 ainda não possui modelo físico completo que use potência, ganho, altura, polarização e azimute da antena. **MUF/foF2, VOACAP, D-RAP, GloTEC/TEC, aurora espacial, WSPR independente, DX Cluster e outras fontes** continuam no [roteiro](docs/BACKLOG.md).

Os dados RBN chegam por uma API pública de agregação e podem ter Grid ausente, especialmente para alguns indicativos internacionais. O PSK Reporter também depende de participantes, modos e localização fornecida. O aplicativo rejeita dados sem posição quando ela é necessária para inferência geográfica.

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
- [Reverse Beacon Network](https://www.reversebeacon.net/)
- [Vail ReRBN — API pública de spots RBN](https://vailrerbn.com/docs)
- [Natural Earth — mapa 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)
- [Projeto](https://github.com/alexpmr/PT2VHF-Prop-Tool) · [Problemas e sugestões](https://github.com/alexpmr/PT2VHF-Prop-Tool/issues) · [Perfil do autor](https://github.com/alexpmr)

Licença do projeto a definir antes da distribuição pública definitiva. As licenças das dependências/runtime são preservadas.

por Alex, PT2VHF
