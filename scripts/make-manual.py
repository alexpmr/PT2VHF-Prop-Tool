"""Generate the Portuguese illustrated manual from real renderer captures."""
import json,hashlib,os
from pathlib import Path
from io import BytesIO
from PIL import Image as PILImage
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Image,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.pagesizes import landscape,A4
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
out=root/f'docs/PT2VHF-Prop-Tool-{version}-Manual.pdf'
font_pairs=[
 (Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')),
 (Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/'arial.ttf',Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/'arialbd.ttf')
]
regular,bold=next(((r,b) for r,b in font_pairs if r.exists() and b.exists()),(None,None))
if not regular: raise RuntimeError('Fonte TrueType compatível não encontrada')
pdfmetrics.registerFont(TTFont('DV',str(regular)));pdfmetrics.registerFont(TTFont('DV-Bold',str(bold)))
pdfmetrics.registerFontFamily('DV',normal='DV',bold='DV-Bold',italic='DV',boldItalic='DV-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyManual',fontName='DV',fontSize=10,leading=15,textColor=colors.HexColor('#24394b'),spaceAfter=7))
styles.add(ParagraphStyle(name='TitleManual',fontName='DV-Bold',fontSize=22,leading=27,textColor=colors.HexColor('#123c4d'),spaceAfter=11))
styles.add(ParagraphStyle(name='SubManual',fontName='DV-Bold',fontSize=12,leading=17,textColor=colors.HexColor('#08755b'),spaceAfter=7))
styles.add(ParagraphStyle(name='CaptionManual',fontName='DV',fontSize=8,leading=11,textColor=colors.HexColor('#506579'),spaceAfter=8))
styles.add(ParagraphStyle(name='CellManual',fontName='DV',fontSize=9,leading=13,textColor=colors.HexColor('#24394b')))
story=[]
def p(text,style='BodyManual'):story.append(Paragraph(text,styles[style]))
def title(text):p(text,'TitleManual')
def new(text):story.append(PageBreak());title(text)
def bullet(text):p('• '+text)
def picture(name,maxw=265,maxh=112,crop=None):
 im=PILImage.open(root/'docs/screenshots'/name)
 if crop:im=im.crop(crop)
 buf=BytesIO();im.save(buf,format='PNG');buf.seek(0)
 ratio=min(maxw*mm/im.width,maxh*mm/im.height)
 pic=Image(buf,width=im.width*ratio,height=im.height*ratio);pic.hAlign='LEFT';story.append(pic);story.append(Spacer(1,3*mm))
def table(rows,widths):
 data=[[Paragraph(str(c),styles['CellManual']) for c in row] for row in rows]
 t=Table(data,colWidths=[w*mm for w in widths],hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e0eee9')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#c1ccd5')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(t);story.append(Spacer(1,4*mm))
repo='https://github.com/alexpmr/PT2VHF-Prop-Tool'
def link(label,url):return f'<link href="{url}" color="#08755b"><u>{label}</u></link>'
title('PT2VHF Prop Tool')
p(f'Manual ilustrado • versão {version} • Windows 10/11 x64','SubManual')
p('Evidências de propagação da sua estação, mapa offline e acompanhamento de bandas. Guia da edição instalada e portátil.')
picture('01-inicio-escuro.png',maxh=108)
p('Capturas reais do renderer em prévia local. Sem recepções inventadas; campos de localização são exemplos. As consultas de produção funcionam no aplicativo Windows.','CaptionManual')
p('por Alex, PT2VHF','SubManual')
new('1. Instalar e começar')
p('Escolha uma das duas edições. Nenhuma exige Python, Node.js ou Electron instalados no computador.')
table([['Edição','Procedimento e localização dos dados'],['Instalada','Execute o arquivo setup, escolha o idioma do instalador e siga o assistente. Instala para sua conta e cria atalhos. Dados ficam no perfil do usuário. A desinstalação preserva as configurações.'],['Portátil','Coloque o executável em uma pasta gravável e execute. A pasta data fica ao lado dele e contém configurações e histórico. Mantenha o executável e a pasta juntos; podem ser usados em USB.']],[35,229])
p('Downloads oficiais','SubManual')
for label,name in [('Instalador',f'PT2VHF-Prop-Tool-{version}-x64-setup.exe'),('Portátil',f'PT2VHF-Prop-Tool-{version}-x64-portable.exe'),('Checksums SHA-256','SHA256SUMS.txt')]:p(link(label,repo+f'/releases/download/v{version}/'+name))
bullet('Abra Configurações, informe indicativo e posição da antena e salve. Use coordenadas reais ou um Grid Maidenhead de 4, 6 ou 8 caracteres.')
bullet('Padrões de um perfil novo: 100 W, 14 bandas habilitadas, antena vertical por banda e verificação de versões a cada 30 minutos.')
bullet('Executáveis ainda sem assinatura digital. Confirme a origem pelo repositório e os hashes publicados; não desative a proteção do Windows.')
new('2. Barra superior, idiomas e temas')
picture('03-mapa-claro.png',maxw=264,maxh=29,crop=(0,0,1440,134))
bullet('O número da versão aparece logo após PT2VHF Prop Tool e corresponde à versão executada.')
bullet('A navegação principal é Mapa, LOGs, Configurações, Ajuda e Sobre. LOGs fica próximo ao mapa para diagnóstico rápido do tráfego.')
bullet('Escolha Português (Brasil), English, Español, Français, Deutsch ou Italiano. As bandeiras são imagens SVG, compatíveis com o Windows.')
bullet('Na barra superior, RX verde pulsa quando chegam dados e TX vermelho pulsa quando uma consulta é enviada. Apagados significam ausência de tráfego naquele instante.')
bullet('O idioma traduz abas, controles, Ajuda, Sobre, validações, estados, alertas e respostas do assistente local. Dados de terceiros, nomes de estações e os textos externos das releases mantêm sua forma original.')
bullet('O botão de tema alterna claro e escuro. Idioma e tema são salvos automaticamente. Ajustes da estação são salvos pelo botão Salvar configuração.')
picture('05-idiomas.png',maxw=95,maxh=75,crop=(1030,0,1430,345))
new('3. Configurar a estação')
picture('02-configuracoes.png',maxw=180,maxh=83,crop=(0,0,780,396))
bullet('Indicativo: informe a estação cujas transmissões e recepções deseja consultar. A posição deve corresponder à antena, não apenas à cidade.')
bullet('Grid: ao informar GH64, por exemplo, as coordenadas recebem o centro dessa célula. Neste exemplo o centro é aproximado; confira a posição da sua antena.')
bullet('Preencher automaticamente depende da permissão e disponibilidade da localização do Windows. Caso falhe ou fique impreciso, digite coordenadas ou Grid.')
bullet('Potência máxima: começa em 100 W e pode ser alterada. Antena e potência são registradas; ainda não alimentam um modelo físico de propagação.')
p('Fontes de consulta','SubManual')
bullet('Configurações identifica PSK Reporter para recepções, NOAA SWPC para Kp, Natural Earth para o mapa offline e GitHub para versões/atualizações.')
bullet('O refresh dos dados do mapa é de 5 minutos por padrão e pode ser alterado. Ele é independente do intervalo de verificação de novas versões.')
p('Clique em Salvar configuração. O mapa fica livre do convite Configurar estação quando indicativo e posição estão válidos. Um aviso discreto pode continuar mostrando ausência de recepções.','SubManual')
new('4. Bandas, antenas e critérios')
picture('02b-bandas.png',maxw=180,maxh=90)
p('Bandas: 160 m, 80 m, 60 m, 40 m, 30 m, 20 m, 17 m, 15 m, 12 m, 11 m, 10 m, 6 m, 2 m e 70 cm. Role a lista para acessar todas.')
bullet('A caixa à esquerda controla a exibição e o monitoramento. O tipo de antena é independente por banda; Vertical é o valor inicial.')
bullet('Alertar é uma escolha separada e começa desativada. Ative apenas nas bandas desejadas. A fonte pode não oferecer dados em 11 metros.')
new('4.1. Limites de alerta e verificação de versões')
p('Critérios iniciais: índice 65/100, distância mínima 800 km, intervalo de 30 minutos entre alertas e consulta de novas versões a cada 30 minutos. Personalizações anteriores são preservadas.','CaptionManual')
new('5. Ler o mapa')
picture('03-mapa-claro.png',maxw=264,maxh=105,crop=(0,130,1440,762))
p('Minha estação mostra TX recebido por terceiros e RX pela sua estação. Estações próximas reúne transmissores a até 300 km; isso é evidência regional e não comprova o alcance da sua própria estação.')
bullet('Escolha banda e período de 15 minutos, 30 minutos ou 1 hora. Clique no painel de bandas para filtrar. Atualizar dados respeita os limites das fontes.')
bullet('Use a roda ou +/− para zoom, arraste o mapa e use ◎ para retornar à visão mundial. Passe o mouse sobre pontos e zonas para consultar horário, modo, indicativos, distância e azimute.')
bullet('Ao mover o cursor sobre o mapa, a legenda mostra em tempo real direção cardinal, azimute em graus e distância desde a estação principal configurada até aquele ponto.')
new('6. Interpretar os dados sem tirar conclusões falsas')
table([['Indicação','Interpretação correta'],['Sem evidências','Faltam relatórios recentes com localização para a estação, período ou bandas escolhidos. Não equivale a banda fechada.'],['Índice 0–100','Força experimental das evidências disponíveis. Não é probabilidade de contato e ainda não considera antena e potência.'],['Ponto de recepção','Um relatório observado. Não comprova QSO concluído nem contato bidirecional. FT8 não garante SSB ou CW.'],['Zona irregular','Grupo conservador de células observadas de 2°, com ao menos três enlaces e duas células adjacentes. Não confirma propagação em toda a área entre pontos.'],['Kp NOAA','Medição global de atividade geomagnética, com horário próprio. Não confirma abertura local de uma banda.'],['Medido / Previsto','A legenda distingue conceitos. Kp é medido; as camadas preditivas e modelos físicos ainda estão em desenvolvimento.']],[43,221])
p('O PSK Reporter depende de participantes e modos informados. Relatórios sem localização não entram no mapa. A consulta é limitada a até 3.000 registros e respeita pelo menos cinco minutos, inclusive após reiniciar. Não representa uma amostra completa de toda a atividade mundial.')
new('7. Alertas e assistente')
p('Alertas de evidência','SubManual')
bullet('Escolha Alertar nas bandas desejadas e ajuste os critérios. O alerta exige pelo menos três enlaces distintos da sua própria transmissão, distância mínima, dados recentes e índice suficiente.')
bullet('O motor reduz notificações repetidas com intervalo e histerese. Fonte indisponível não inventa fechamento nem reabertura. Notificações dependem das permissões e configurações do Windows.')
bullet('Ao receber um alerta, confira a banda, o modo, a direção e as recepções no mapa; não interprete como garantia de contato.')
p('Assistente local','SubManual')
picture('03-mapa-claro.png',maxw=264,maxh=41,crop=(0,775,1440,979))
p('Digite uma pergunta sobre as evidências. As respostas usam regras locais e os dados presentes; não há IA generativa integrada. Sem relatórios, o assistente explica a insuficiência. Ele não determina MUF, mecanismos de VHF, horários futuros nem equivalência entre modos.')
new('8. Atualizar a aplicação')
table([['Estado do botão','Comportamento'],['Última versão — verde','A checagem confirmou que a versão executada é a mais recente. Ao clicar, uma nova checagem é feita e a aplicação continua normalmente se não houver versão nova.'],['Nova versão disponível — laranja piscando','Ao clicar, a aplicação inicia automaticamente o download e a instalação, sem exigir uma sequência adicional de botões.'],['Baixando atualização','O progresso aparece no próprio estado da aplicação. Downloads concorrentes são bloqueados e a integridade é verificada antes da instalação.'],['Primeira abertura após atualizar','Um popup mostra as novidades da versão uma única vez.'],['Falha ao verificar atualização','A falha não é tratada como confirmação de versão atualizada. Tente novamente.']],[70,194])
p('O padrão é verificar novas versões a cada trinta minutos; ajuste em Configurações → Critérios de alerta e atualização. Esta verificação é independente do refresh dos dados do mapa, que permanece em cinco minutos por padrão.')
p('Portátil: o worker aguarda a aplicação e o lançador encerrarem, verifica o arquivo, guarda o lançador antigo como .previous e exige confirmação da versão nova. Se a inicialização não for confirmada, recupera o lançador e o estado anteriores. Reabra pelo executável com o novo número de versão após uma atualização concluída.')
p('<b>Se você usa a portátil v0.1.0:</b> esta transição exige baixar manualmente a v0.2.0 para a mesma pasta, mantendo data. O mecanismo automático passa a funcionar na v0.2.0 para atualizações posteriores.')
new('9. Ajuda, Sobre e contato')
picture('06-sobre.png',maxw=234,maxh=89)
p('Ajuda contém instruções traduzidas nos seis idiomas e um link para este manual. Sobre apresenta a finalidade da aplicação, a versão, a autoria e as limitações atuais.')
p('Os botões da aba Sobre abrem o repositório, a área de problemas/sugestões e o perfil do autor. Nenhum contato privado foi presumido ou incluído.')
p(link('Projeto e downloads',repo)+' • '+link('Relatar problema ou sugerir melhoria',repo+'/issues')+' • '+link('Perfil de Alex Rodrigues', 'https://github.com/alexpmr'))
p('Ao relatar uma falha, informe versão, edição instalada/portátil, idioma, banda, período, estado da fonte e os passos para reproduzir. Inclua uma captura da tela e o erro, evitando dados privados.')
new('10. LOGs e diagnóstico')
p('A aba LOGs registra o tráfego de rede da sessão. TX representa consultas enviadas; RX representa respostas recebidas; INFO registra etapas como redirecionamento validado e parsing. Cada evento pode mostrar fonte, endpoint, status, duração, bytes, erro e uma prévia limitada do payload.')
bullet('Use filtros de direção e fonte, busca textual, Pausar/Retomar, Limpar e Exportar. A exportação usa JSON Lines para facilitar análise técnica.')
bullet('Se o mapa não mudar, confirme primeiro se houve TX; depois verifique RX/status e, por fim, eventos de parsing. Isso separa falha de consulta, resposta inválida e ausência real de evidências.')
p('Os LEDs RX/TX da barra superior usam os mesmos eventos de tráfego registrados no LOG, portanto não são animações decorativas.')
new('11. Preservação de dados e solução de problemas')
table([['Problema','O que verificar'],['Estação configurada, sem pontos','Indicativo, posição, período, bandas, participação nos modos digitais e disponibilidade PSK. Aguarde a próxima consulta permitida. O aviso não significa configuração perdida.'],['Localização incorreta','Confira a posição da antena. GPS/Windows podem ser aproximados; Grid usa centro da célula. Prefira coordenadas confiáveis.'],['11 m sem recepções','A banda está disponível no filtro, mas depende de relatórios reais oferecidos pela fonte. A aplicação não cria atividade artificial.'],['Tema/idioma/potência não persistem','Use uma pasta portátil gravável e mantenha data junto do lançador. Salve os campos da estação. Verifique se executou uma cópia em outra pasta.'],['Atualização portátil falhou','Consulte data/updates/update-result.json para o diagnóstico técnico. A recuperação preserva a versão anterior; não apague data. Confira espaço, permissões e arquivos em uso.'],['Dados antigos incompatíveis','O arquivo original é preservado com sufixo .invalid e data/hora. Relate a falha e faça uma cópia de segurança antes de editar o estado.']],[70,194])
p('Antes de mover uma instalação, editar arquivos ou fazer testes, mantenha uma cópia de state.json e da pasta data do portátil. O histórico local é limitado a 24 horas e 20.000 registros; não substitui um log de contatos.')
p('Modelos físicos, VOACAP, fontes adicionais, MapLibre, IA generativa e integrações futuras continuam no roteiro de desenvolvimento. Este manual descreve apenas os recursos implementados na v'+version+'.')
def footer(canvas,doc):
 canvas.saveState();w,h=landscape(A4);canvas.setStrokeColor(colors.HexColor('#bccbd4'));canvas.line(16*mm,13*mm,w-16*mm,13*mm);canvas.setFont('DV',8);canvas.setFillColor(colors.HexColor('#506579'));canvas.drawString(16*mm,8*mm,f'PT2VHF Prop Tool • v{version} • por Alex, PT2VHF');canvas.drawRightString(w-16*mm,8*mm,str(doc.page));canvas.restoreState()
doc=SimpleDocTemplate(str(out),pagesize=landscape(A4),rightMargin=16*mm,leftMargin=16*mm,topMargin=13*mm,bottomMargin=19*mm,title=f'PT2VHF Prop Tool {version} — Manual ilustrado',author='Alex Rodrigues, PT2VHF')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
from pypdf import PdfReader
pages=len(PdfReader(out).pages)
(root/'docs/manual.json').write_text(json.dumps({'version':version,'filename':out.name,'pages':pages,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},indent=2)+'\n')
print(out, 'pages:',pages, 'bytes:',out.stat().st_size)
