# PT2VHF Prop Tool — v0.1.0

Aplicativo experimental para Windows 10/11 x64. Reúne evidências de recepção da estação, mapa-múndi offline e painel de bandas. Esta primeira entrega implementa uma parte do conceito acordado, com limites explicitados na interface.

## O que funciona nesta versão

- Configuração de indicativo, coordenadas, Grid Maidenhead, potência e tipo de antena por banda.
- Preenchimento automático da localização, quando autorizado e disponível no Windows; entrada manual e por Grid.
- Treze bandas, de 160 m a 70 cm, selecionadas para exibição por padrão.
- Consulta ao PSK Reporter por indicativo ou Grid de quatro caracteres; intervalo mínimo de cinco minutos, inclusive após reiniciar.
- Distinção entre sua transmissão recebida, recepções pela sua estação e transmissores próximos.
- Recepção não é tratada como QSO concluído. FT8 não é convertido em garantia de SSB/CW.
- Mapa offline com pontos, zonas irregulares conservadoras sobre células observadas, zoom e movimentação.
- Zonas só aparecem com pelo menos três enlaces distintos e duas células adjacentes; pontos esparsos não são unidos artificialmente.
- Painel de bandas com quantidade de recepções/enlaces, horário e índice de força das evidências.
- Kp da NOAA com horário da medição separado do horário da consulta.
- Alertas por banda, com limite, distância, histerese e intervalo entre repetições. Exigem múltiplos receptores da sua própria transmissão.
- Histórico local de até 24 h; análise nos últimos 15, 30 ou 60 minutos.
- Assistente local baseado em regras, identificado como tal. IA generativa ainda não está integrada.
- Versão na barra superior, consulta de atualizações, notas da versão e download. Instalação OTA preparada para a edição instalada, condicionada à publicação de releases e validação do fluxo entre duas versões. A edição portátil abre a página de download para substituição manual.

## Como usar

**Instalada:** execute `PT2VHF-Prop-Tool-0.1.0-x64-setup.exe`. O instalador usa a conta atual, cria atalhos e oferece desinstalação. Não remove as configurações ao desinstalar.

**Portátil:** execute `PT2VHF-Prop-Tool-0.1.0-x64-portable.exe` em uma pasta onde você tenha permissão de escrita. O executável extrai temporariamente seu runtime e mantém configurações/histórico na pasta `data`, ao lado dele. Não exige Python, Node.js ou Electron instalados.

Abra **Minha estação**, informe indicativo e posição da antena e salve. A consulta começa automaticamente quando houver configuração válida. O botão Atualizar respeita os limites das fontes. Mudanças de visão podem aguardar a próxima consulta permitida.

Sem dados recentes, a interface mostra **Sem evidências**; isso não significa banda fechada. Algumas recepções não informam Grid e não podem ser posicionadas. Uma consulta limitada a 3.000 registros e a receptores participantes não representa cobertura mundial completa.

## Limites de validação

Os testes de motor e interface passam no ambiente Linux. Os executáveis Windows são compilados por NSIS; instalação, execução nativa, localização do Windows, notificações e atualização entre releases precisam ser verificados em Windows. As consultas ao PSK Reporter e NOAA estão implementadas conforme interfaces documentadas; a disponibilidade em produção depende dos serviços e deve ser confirmada no teste da estação. Não há dados de demonstração misturados ao mapa.

Os executáveis iniciais não têm certificado Authenticode; o Windows pode mostrar aviso de editor desconhecido. Os SHA-256 estão em `SHA256SUMS.txt`.

## Desenvolvimento e compilação

Requer Node.js 24 e acesso à internet para baixar dependências/runtime. O código usa Electron com módulos JavaScript, HTML/CSS e SVG, sem servidor local exposto. Esta escolha simplifica a primeira distribuição Windows; MapLibre e banco analítico permanecem opções futuras.

```powershell
npm ci
npm run check
npm test
npm start
npm run dist:win
```

`dist:win` monta o runtime Windows com electron-builder e compila dois lançadores NSIS com o compilador nativo. Funciona também em Linux, sem precisar executar o instalador intermediário no Wine. O instalador preserva arquivos externos ao aplicativo ao desinstalar. O portátil mantém seus dados fora da extração temporária.

O workflow `.github/workflows/windows.yml` testa o motor, executa um smoke test real do Electron no Windows, compila os pacotes e guarda artefatos. Após um build bem-sucedido em `main`, publica a release correspondente à versão do aplicativo, como `v0.1.0`, com executáveis, `latest.yml` e checksums. Uma release já existente é preservada; para uma nova distribuição, deve-se incrementar a versão. Tags também são aceitas e precisam corresponder à versão. O repositório remoto é `alexpmr/PT2VHF-Prop-Tool`; o sucesso de cada publicação pode ser consultado no GitHub Actions.

## Próximas etapas

Veja [docs/BACKLOG.md](docs/BACKLOG.md) e [docs/ARQUITETURA.md](docs/ARQUITETURA.md). O objetivo final permanece reunir observações, medições físicas e modelos, com mecanismos separados para HF e VHF/UHF. O índice inicial ainda não é o Prop Score final calibrado.

## Fontes e atribuição

- [PSK Reporter — interface documentada](https://www.pskreporter.info/pskdev.html).
- [NOAA SWPC — Kp planetário](https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json).
- Mapa de terra: [Natural Earth, resolução 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), domínio público. Não é adequado à navegação ou a fronteiras políticas.
- [Electron](https://www.electronjs.org/) e [NSIS](https://nsis.sourceforge.io/).

Licença do projeto a definir antes da distribuição pública definitiva. As licenças das dependências e do runtime são preservadas.

por Alex, PT2VHF
