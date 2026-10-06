# Backlog consolidado — PT2VHF Prop Tool

## Prioridade imediata: validar v0.1 em Windows

- Criar repositório `alexpmr/PT2VHF-Prop-Tool`, publicar código e executar o workflow Windows.
- Testar instalador, desinstalação, preservação de configurações e portátil em pasta gravável/USB.
- Confirmar consultas reais do indicativo PT2VHF e de seu Grid; verificar ausência de registros, limite de consulta e recuperação após erro/429.
- Validar localização automática, precisão e recusa da permissão.
- Testar alertas com transmissões realmente recebidas, diferentes receptores e múltiplos ciclos de atualização.
- Validar atualização instalada v0.1 → próxima versão, notas, checksum, cancelamento e reinício. Portátil: substituição manual segura; OTA próprio fica pendente.
- Assinatura Authenticode e ícone próprio.
- Escolher licença de distribuição.

## Motor e novas fontes

- Adapters WSPR, RBN, DX Cluster/HamQTH, GIRO/KC2G e NOAA completo.
- Confirmar acesso, condições de uso, quotas e disponibilidade antes de ativar cada fonte. Não redistribuir mapas DXMaps sem autorização.
- MUF/foF2, fluxo F10.7, vento solar/Bz, raios X, prótons, D-RAP e aurora.
- VOACAP para circuitos HF: considerar potência, antena, altura, ganho, polarização e azimute por banda.
- Prop Score calibrado por banda/região; separar força de evidência, cobertura amostral, qualidade do enlace e probabilidade modelada.
- Separar recepção unilateral de QSO confirmado. Analisar modos sem converter automaticamente FT8 em SSB/CW.
- Motor específico VHF/UHF: Es, TEP, F2, tropo/ductos, aurora, meteor scatter e outros mecanismos, explicitando hipóteses.
- Corrigir viés de atividade e cobertura de receptores; ausência de spots não é ausência de propagação.
- Baselines por horário, bandas, região, modos e quantidade de observadores ativos.

## Mapa e operação

- Seletor de idioma na barra superior: Português (Brasil), inglês, espanhol, francês, alemão e italiano.
- Cada idioma deve ter bandeira própria (Brasil, Reino Unido, Espanha, França, Alemanha e Itália), usando imagens/SVG para funcionar também no Windows, sem depender de emojis de bandeiras.
- Tradução integral de toda a aplicação: abas, menus, botões, configurações, tooltips, validações, mensagens de estado/erro, alertas, notas exibidas pela interface e aba Ajuda. Evitar textos fixos que permaneçam em português ao mudar o idioma.
- Persistir o idioma escolhido, iniciar em Português (Brasil) por padrão e atualizar a interface inteira ao trocar o idioma. Revisar as seis traduções e testar Ajuda e mensagens dinâmicas.

- Visão global com fontes próprias, separada das evidências relativas à estação.
- MapLibre, camadas independentes e legenda Observado / Medido / Previsto.
- Polígonos amorfos por densidade/contornos, com limite de interpolação e indicação de incerteza geográfica. As células da v0.1 são implementação conservadora inicial.
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
