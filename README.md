# PT2VHF Prop Tool — v0.2.1

Aplicativo experimental para Windows 10/11 x64 que reúne evidências de propagação relacionadas à estação, PSK Reporter, Kp da NOAA e mapa offline.

## Downloads da versão atual

| Arquivo | Download direto |
| --- | --- |
| Instalador Windows x64 | [Baixar instalador v0.2.1](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.1/PT2VHF-Prop-Tool-0.2.1-x64-setup.exe) |
| Portátil Windows x64 | [Baixar portátil v0.2.1](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.1/PT2VHF-Prop-Tool-0.2.1-x64-portable.exe) |
| Manual ilustrado em PDF | [Baixar manual v0.2.1](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.1/PT2VHF-Prop-Tool-0.2.1-Manual.pdf) |
| SHA-256 | [Baixar checksums](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.2.1/SHA256SUMS.txt) |

[Última release publicada](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/latest) · [Notas da versão](CHANGELOG.md) · [Relatar problema ou sugestão](https://github.com/alexpmr/PT2VHF-Prop-Tool/issues)

## O que funciona

- Indicativo, coordenadas, Grid Maidenhead e localização automática quando disponível/autorizada no Windows.
- 14 bandas, de 160 m a 70 cm, incluindo **11 metros**, habilitadas inicialmente com antena **vertical**. Potência inicial **100 W**. Configurações anteriores e valores personalizados são preservados.
- Português, inglês, espanhol, francês, alemão e italiano, com bandeiras SVG, textos da interface, mensagens, assistente e **Ajuda traduzidos**. Idioma e tema claro/escuro ficam salvos.
- Barra superior com versão após o nome, navegação **Mapa / LOGs / Configurações / Ajuda / Sobre**, LEDs de atividade **RX verde / TX vermelho**, apresentação do software e contato pelo GitHub.
- Consulta PSK Reporter por indicativo ou Grid; intervalo mínimo de cinco minutos, inclusive após reiniciar. Redirecionamentos da API são aceitos somente entre destinos HTTPS autorizados. Ausência de dados, especialmente em 11 m, não é interpretada como banda fechada.
- Separação entre TX recebido por terceiros, RX pela estação e observações de transmissores próximos, sem confundir evidência regional com alcance confirmado da própria estação.
- Mapa offline com pontos, zoom, movimentação e zonas irregulares conservadoras. Ao mover o cursor, a legenda mostra **azimute/direção e distância** desde a estação configurada. Zonas exigem pelo menos três enlaces e duas células adjacentes; pontos esparsos não são unidos artificialmente.
- Painel de bandas, contagem de recepções/enlaces, horário e índice de evidências 0–100. **Não é probabilidade de contato** e não equivale a QSO confirmado.
- Kp NOAA com horário da medição. Alertas por banda exigem múltiplos receptores da própria transmissão, dados recentes, limiar, distância e intervalo de repetição.
- Histórico local de até 24 h; análise nos últimos 15, 30 ou 60 minutos. **Refresh automático do mapa a cada 5 minutos por padrão**, configurável e respeitando o limite das fontes. Assistente local por regras, sem dados inventados.
- Após configurar a estação, um aviso discreto de ausência de evidências substitui o bloco central; o botão de configuração não continua cobrindo o mapa.
- Nova aba **LOGs** para diagnóstico do tráfego real: TX das consultas, RX das respostas, fonte, endpoint, status, latência, volume, erros e prévia limitada do payload; inclui filtros, busca, pausa, limpeza e exportação JSONL.
- **Configurações → Fontes de consulta** identifica PSK Reporter, NOAA SWPC, Natural Earth e GitHub e separa o intervalo de atualização dos dados do mapa do intervalo de verificação de versões.
- Verificação de novas versões a cada **cinco minutos** por padrão, configurável. Botão **Última versão** verde após confirmação; **Nova versão disponível** laranja piscando. Download com integridade verificada e atualização/reinício pela aplicação.
- Atualização instalada com electron-updater e instalador NSIS. A partir da v0.2.0, o portátil usa substituição do lançador em sua pasta, preserva `data` e mantém o executável anterior como `.previous`, com recuperação automática se a nova versão não confirmar inicialização.

## Instalar e começar

**Instalador:** execute o setup e siga o assistente. Instala para a conta atual e oferece atalhos e desinstalação. Os dados ficam no perfil do usuário e não são removidos pelo desinstalador.

**Portátil:** coloque o executável em uma pasta gravável, inclusive em USB. Ele extrai temporariamente o runtime e mantém configurações/histórico na pasta `data`, ao lado do lançador. Mantenha ambos juntos. Não requer Python, Node.js ou Electron instalados.

Abra **Configurações**, preencha indicativo e posição da antena, confira as fontes de consulta, ajuste bandas/antenas/potência e salve. No mapa, escolha contexto, banda e período. O refresh automático inicia em **5 minutos** e **Atualizar dados** respeita os limites das fontes. Informar um Grid usa o centro da célula, não a posição exata da antena. Para diagnóstico, abra **LOGs** e confira TX/RX.

A edição portátil **v0.1.0** ainda não tem o novo mecanismo: baixe a v0.2.0 manualmente para a mesma pasta, preservando `data`. As próximas atualizações podem ser iniciadas pela interface da v0.2.0.

## Limites e validação

Executáveis sem assinatura Authenticode. Não há dados de demonstração misturados ao mapa. O PSK Reporter depende dos participantes, modos e localização informados; até 3.000 relatórios por consulta não representam cobertura mundial completa.

Antena e potência são registradas e ainda não entram em um modelo físico. IA generativa, VOACAP, MapLibre e fontes adicionais permanecem no [roteiro de desenvolvimento](docs/BACKLOG.md). FT8 não é extrapolado para garantia de contato em SSB/CW. Kp global não confirma abertura local.

A publicação é condicionada a testes do motor, traduções e integridade de downloads, inicialização real do Electron no Windows, instalação/desinstalação, execução dos dois pacotes e cenários de substituição/recuperação do portátil. O fluxo entre releases futuras deve continuar sendo verificado; disponibilidade de localização e notificações depende do computador. Consulte o [resultado dos testes nativos](https://github.com/alexpmr/PT2VHF-Prop-Tool/actions) da release.

As telas do manual são capturas do mesmo renderer em prévia local, identificada na interface; os campos da estação são exemplos. Não representam recepções ao vivo nem a localização exata da antena do autor.

## Desenvolvimento

Node.js 24, dependências fixadas no lockfile. Electron com HTML/CSS, módulos JavaScript e SVG; sem servidor local exposto na edição desktop.

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

`npm run check` sincroniza README e metadados com a versão do pacote e valida as fontes. O manual da versão corrente deve ser gerado antes do check; o workflow Windows faz essa etapa automaticamente. O template é `docs/README.template.md`. `dist:win` usa electron-builder para o runtime e o compilador nativo NSIS, sem Wine. O workflow publica os executáveis, manual, `latest.yml` e checksums somente depois dos testes. Releases existentes não são sobrescritas; uma distribuição nova exige versão nova. O manual é produzido por `scripts/make-manual.py` a partir das capturas em `docs/screenshots`.

## Fontes e contato

- [PSK Reporter — API](https://www.pskreporter.info/pskdev.html).
- [NOAA SWPC — Kp](https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json).
- [Natural Earth — mapa 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), domínio público.
- [Projeto](https://github.com/alexpmr/PT2VHF-Prop-Tool) · [Problemas e sugestões](https://github.com/alexpmr/PT2VHF-Prop-Tool/issues) · [Perfil do autor](https://github.com/alexpmr).

Licença do projeto a definir antes da distribuição pública definitiva. As licenças das dependências/runtime são preservadas.

por Alex, PT2VHF
