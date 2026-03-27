# Documento de Requisitos

## Introdução

Esta funcionalidade adiciona um novo botão "Baixar tudo x5" à barra de ações da aplicação TikTok Scraper. Ao ser clicado, o botão executa o download de transcrições (quando disponíveis), salva o vídeo original sem processamento, e gera 5 variantes únicas de cada vídeo selecionado usando parâmetros ffmpeg sutilmente randomizados. Cada variante possui fingerprint de mídia distinto, porém visualmente imperceptível ao olho humano. O processamento é feito um vídeo por vez (uma requisição por vídeo) para evitar timeouts em ambientes locais e VPS com proxy Traefik.

## Glossário

- **Sistema_Frontend**: A interface web Next.js (app/page.tsx) que exibe a barra de ações e gerencia o estado da aplicação
- **Endpoint_Download**: A rota API `/api/download-video` (app/api/download-video/route.ts) responsável por baixar e processar vídeos via yt-dlp e ffmpeg
- **Variante**: Um arquivo de vídeo MP4 gerado a partir do vídeo original com parâmetros ffmpeg randomizados, resultando em fingerprint de mídia único
- **Vídeo_Original**: O arquivo MP4 baixado via yt-dlp sem nenhum processamento ffmpeg, salvo com sufixo `_ORIG`
- **Modo_x5**: Parâmetro `mode: "x5"` enviado ao Endpoint_Download que ativa a geração do vídeo original e das 5 variantes
- **Parâmetros_Randomizados**: Conjunto de valores ffmpeg (CRF, scale/crop, noise, speed, pitch) gerados aleatoriamente dentro de faixas pré-definidas para cada variante

## Requisitos

### Requisito 1: Botão "Baixar tudo x5" na Interface

**User Story:** Como um usuário, eu quero ter um botão "Baixar tudo x5" ao lado do botão "Baixar tudo" existente, para que eu possa gerar múltiplas variantes únicas dos vídeos selecionados com um único clique.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir um botão "Baixar tudo x5" na barra de ações, posicionado ao lado do botão "Baixar tudo" existente
2. WHILE nenhum vídeo estiver selecionado, THE Sistema_Frontend SHALL manter o botão "Baixar tudo x5" desabilitado
3. WHILE uma operação de download x5 estiver em andamento, THE Sistema_Frontend SHALL manter o botão "Baixar tudo x5" desabilitado e exibir o texto "Baixando x5..."
4. WHILE uma operação de download x5 estiver em andamento, THE Sistema_Frontend SHALL desabilitar os botões "Baixar tudo", "Baixar Transcrição" e "Baixar vídeos selecionados"

### Requisito 2: Fluxo Sequencial de Download x5

**User Story:** Como um usuário, eu quero que o download x5 processe um vídeo por vez, para que cada requisição termine dentro do limite de timeout do servidor.

#### Critérios de Aceitação

1. WHEN o botão "Baixar tudo x5" for clicado, THE Sistema_Frontend SHALL primeiro executar a função de transcrição (handleTranscribe) para os vídeos selecionados
2. WHEN a etapa de transcrição finalizar, THE Sistema_Frontend SHALL iterar sobre os vídeos selecionados e enviar uma requisição POST ao Endpoint_Download para cada vídeo individualmente, de forma sequencial
3. THE Sistema_Frontend SHALL enviar cada requisição POST com o parâmetro `mode` definido como `"x5"` e um array `videoUrls` contendo uma única URL
4. WHEN cada requisição individual for concluída, THE Sistema_Frontend SHALL atualizar os logs de execução em tempo real com o resultado daquele vídeo

### Requisito 3: Processamento Backend no Modo x5

**User Story:** Como um usuário, eu quero que o backend gere o vídeo original e 5 variantes únicas, para que eu tenha 6 arquivos por vídeo com fingerprints distintos.

#### Critérios de Aceitação

1. WHEN o Endpoint_Download receber uma requisição com `mode` igual a `"x5"`, THE Endpoint_Download SHALL baixar o vídeo via yt-dlp e salvar o arquivo original sem processamento ffmpeg como `{nome_do_video}_ORIG.mp4`
2. WHEN o vídeo original for salvo, THE Endpoint_Download SHALL processar o vídeo original 5 vezes com ffmpeg, gerando os arquivos `{nome_do_video}_v01.mp4` até `{nome_do_video}_v05.mp4`
3. WHEN o Endpoint_Download receber uma requisição sem o parâmetro `mode` ou com `mode` diferente de `"x5"`, THE Endpoint_Download SHALL manter o comportamento atual inalterado
4. THE Endpoint_Download SHALL remover o arquivo temporário do yt-dlp após concluir o processamento de todas as variantes

### Requisito 4: Randomização de Parâmetros ffmpeg

**User Story:** Como um usuário, eu quero que cada variante tenha parâmetros ffmpeg sutilmente diferentes, para que cada arquivo possua um fingerprint de mídia único enquanto permanece visualmente idêntico ao original.

#### Critérios de Aceitação

1. THE Endpoint_Download SHALL gerar um valor de CRF aleatório entre 20 e 26 (inclusive) para cada variante
2. THE Endpoint_Download SHALL gerar um fator de scale/crop aleatório entre 1.005 e 1.02 para cada variante
3. THE Endpoint_Download SHALL gerar um nível de noise aleatório entre 2 e 5 (inclusive) para cada variante
4. THE Endpoint_Download SHALL gerar um fator de velocidade aleatório entre 0.98 e 1.02 para setpts e atempo de cada variante
5. THE Endpoint_Download SHALL gerar um fator de pitch de áudio aleatório entre 0.99 e 1.02 para cada variante
6. THE Endpoint_Download SHALL garantir que os 5 conjuntos de parâmetros sejam gerados independentemente, resultando em combinações distintas para cada variante

### Requisito 5: Convenção de Nomenclatura de Arquivos

**User Story:** Como um usuário, eu quero que os arquivos sigam uma convenção de nomenclatura clara, para que eu possa identificar facilmente o original, as variantes e as transcrições.

#### Critérios de Aceitação

1. WHEN o modo x5 estiver ativo, THE Endpoint_Download SHALL salvar o vídeo original com o nome `{safeName}_ORIG.mp4`
2. WHEN o modo x5 estiver ativo, THE Endpoint_Download SHALL salvar cada variante com o nome `{safeName}_v{NN}.mp4`, onde NN é o número da variante com zero à esquerda (01 a 05)
3. THE Endpoint_Download SHALL utilizar a mesma função `sanitizeFilename` existente para gerar o `safeName` a partir do título do vídeo

### Requisito 6: Feedback Visual e Estados de Loading

**User Story:** Como um usuário, eu quero ver o progresso do download x5 em tempo real, para que eu saiba quais vídeos já foram processados e quantos faltam.

#### Critérios de Aceitação

1. WHEN o download x5 estiver em andamento, THE Sistema_Frontend SHALL exibir um indicador de loading com spinner e mensagem de status
2. WHEN cada vídeo individual for processado com sucesso, THE Sistema_Frontend SHALL adicionar uma entrada de log com ícone de sucesso e os nomes dos arquivos gerados
3. IF um vídeo individual falhar durante o processamento, THEN THE Sistema_Frontend SHALL adicionar uma entrada de log com ícone de erro e a mensagem de falha, e continuar processando os vídeos restantes
4. WHEN todos os vídeos forem processados, THE Sistema_Frontend SHALL exibir um resumo final com a contagem de sucessos e falhas

### Requisito 7: Resposta do Endpoint no Modo x5

**User Story:** Como um desenvolvedor, eu quero que o endpoint retorne informações detalhadas sobre todos os arquivos gerados no modo x5, para que o frontend possa exibir logs precisos.

#### Critérios de Aceitação

1. WHEN o processamento no modo x5 for concluído com sucesso, THE Endpoint_Download SHALL retornar na resposta a lista de todos os arquivos gerados (original + 5 variantes) no campo `results`
2. IF ocorrer um erro durante a geração de uma variante específica, THEN THE Endpoint_Download SHALL incluir a informação do erro no campo `results` e continuar gerando as variantes restantes
3. THE Endpoint_Download SHALL retornar o caminho do diretório de downloads no campo `downloadDir`

### Requisito 8: Estilização do Botão x5

**User Story:** Como um usuário, eu quero que o botão "Baixar tudo x5" tenha uma aparência visual distinta, para que eu possa diferenciá-lo facilmente do botão "Baixar tudo" existente.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL aplicar ao botão "Baixar tudo x5" um estilo com gradiente visual distinto do botão "Baixar tudo" existente
2. WHEN o cursor passar sobre o botão "Baixar tudo x5" (hover), THE Sistema_Frontend SHALL aplicar um efeito de elevação (translateY) e sombra, consistente com os demais botões da barra de ações
