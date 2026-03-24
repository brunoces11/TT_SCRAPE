# Documento de Requisitos

## Introdução

Esta feature adiciona um campo de input para URL direta de vídeo do TikTok, posicionado abaixo do formulário de busca existente (ChannelForm). Ao inserir uma URL válida e confirmar, o app popula o estado existente (`channelRows` e `selectedVideoUrls`) com uma única entrada, fazendo com que a barra de ações já existente (📝 Baixar Transcrição, ⬇️ Baixar vídeos selecionados, 📦 Baixar tudo, 🗑️ Deletar selecionados) apareça e funcione normalmente para aquele vídeo. O app passa a ter dois pontos de entrada que alimentam os mesmos botões e as mesmas funções: (1) busca por canal/palavra-chave/hashtag e (2) URL direta de vídeo avulso.

## Glossário

- **Aplicação**: A aplicação web Next.js (TikTok Scraper & Transcript Tool) que orquestra busca, download e transcrição de vídeos do TikTok.
- **Campo_URL_Avulsa**: O novo campo de input de texto onde o usuário insere a URL direta de um vídeo avulso do TikTok.
- **Barra_Ações**: A barra de ações já existente na Aplicação, contendo os botões "📝 Baixar Transcrição", "⬇️ Baixar vídeos selecionados", "📦 Baixar tudo" e "🗑️ Deletar selecionados". Exibida quando `channelRows.length > 0`.
- **API_Download**: O endpoint `/api/download-video` que recebe `{ videoUrls: string[], titles: string[] }` e baixa vídeos via yt-dlp + ffmpeg.
- **API_Transcrição**: O endpoint `/api/transcribe-videos` que recebe `{ videoUrls: string[], videosMeta: VideoMeta[] }` e transcreve vídeos via Apify.
- **URL_TikTok_Válida**: Uma URL que corresponde ao padrão de vídeo do TikTok (contendo `/video/` seguido de um ID numérico, ex: `https://www.tiktok.com/@usuario/video/1234567890`).
- **Formulário_Busca**: O formulário de busca existente (ChannelForm) com campos de Região, URL do Canal, Palavra-chave, Hashtag e Máx.
- **Estado_Principal**: O estado compartilhado da Aplicação composto por `channelRows` (lista de vídeos) e `selectedVideoUrls` (URLs selecionadas), que alimenta a Barra_Ações e a tabela de resultados.

## Requisitos

### Requisito 1: Exibição do Campo de URL Avulsa

**User Story:** Como usuário, eu quero ver um campo de input abaixo do formulário de busca existente, para que eu possa inserir a URL direta de um vídeo do TikTok como ponto de entrada alternativo.

#### Critérios de Aceitação

1. A Aplicação DEVE exibir o Campo_URL_Avulsa posicionado visualmente abaixo do Formulário_Busca e acima da área de resultados.
2. O Campo_URL_Avulsa DEVE conter um placeholder descritivo (ex: "Cole aqui a URL de um vídeo do TikTok").
3. O Campo_URL_Avulsa DEVE incluir um botão de confirmação (ex: "Carregar vídeo") para que o usuário submeta a URL.
4. O Campo_URL_Avulsa DEVE seguir o mesmo estilo visual (cores, bordas, tipografia) dos campos de input existentes no Formulário_Busca.

### Requisito 2: Validação da URL Inserida

**User Story:** Como usuário, eu quero que a aplicação valide a URL que inseri, para que eu saiba se posso prosseguir.

#### Critérios de Aceitação

1. QUANDO o usuário clicar no botão de confirmação do Campo_URL_Avulsa, A Aplicação DEVE verificar se a URL corresponde ao padrão de URL_TikTok_Válida.
2. QUANDO a URL inserida não for uma URL_TikTok_Válida, A Aplicação DEVE exibir uma mensagem de erro informando que a URL é inválida.
3. QUANDO o Campo_URL_Avulsa estiver vazio e o usuário clicar no botão de confirmação, A Aplicação DEVE manter o botão desabilitado ou exibir uma mensagem solicitando o preenchimento.

### Requisito 3: Populando o Estado Existente a Partir da URL Avulsa

**User Story:** Como usuário, eu quero que ao inserir uma URL válida de vídeo, o app carregue esse vídeo na mesma tabela e barra de ações usadas pela busca por canal, para que eu possa usar os mesmos botões de download e transcrição.

#### Critérios de Aceitação

1. QUANDO o usuário submeter uma URL_TikTok_Válida no Campo_URL_Avulsa, A Aplicação DEVE criar uma entrada do tipo `ChannelVideoRow` com o `videoId` extraído da URL, o `videoUrl` igual à URL inserida e um `title` derivado do ID do vídeo.
2. QUANDO o usuário submeter uma URL_TikTok_Válida no Campo_URL_Avulsa, A Aplicação DEVE atualizar o Estado_Principal definindo `channelRows` com a entrada criada e `selectedVideoUrls` com a URL do vídeo.
3. QUANDO o Estado_Principal for atualizado com a entrada do vídeo avulso, A Aplicação DEVE exibir a Barra_Ações automaticamente (pois `channelRows.length > 0`).
4. QUANDO o Estado_Principal for atualizado com a entrada do vídeo avulso, A Aplicação DEVE exibir o vídeo na tabela de resultados (VideoResultsTable) como uma linha selecionada.
5. A Aplicação DEVE limpar resultados anteriores (channelRows, transcriptRows, mensagens de status) antes de popular o Estado_Principal com o vídeo avulso.

### Requisito 4: Compatibilidade com os Handlers Existentes

**User Story:** Como usuário, eu quero que os botões de ação existentes funcionem corretamente para o vídeo avulso carregado, sem necessidade de lógica separada.

#### Critérios de Aceitação

1. QUANDO o usuário clicar em "📝 Baixar Transcrição" na Barra_Ações após carregar um vídeo avulso, A Aplicação DEVE executar o handler `handleTranscribe` existente, enviando a URL do vídeo avulso para a API_Transcrição.
2. QUANDO o usuário clicar em "⬇️ Baixar vídeos selecionados" na Barra_Ações após carregar um vídeo avulso, A Aplicação DEVE executar o handler `handleDownloadVideos` existente, enviando a URL do vídeo avulso para a API_Download.
3. QUANDO o usuário clicar em "📦 Baixar tudo" na Barra_Ações após carregar um vídeo avulso, A Aplicação DEVE executar o handler `handleDownloadAll` existente, realizando transcrição e download sequencialmente.
4. Os handlers existentes (handleTranscribe, handleDownloadVideos, handleDownloadAll) DEVEM funcionar sem modificações, pois operam sobre `selectedVideoUrls` e `channelRows` que já estarão populados com os dados do vídeo avulso.

### Requisito 5: Isolamento entre Pontos de Entrada

**User Story:** Como usuário, eu quero que o campo de URL avulsa e o formulário de busca por canal sejam pontos de entrada independentes que alimentam o mesmo fluxo, para que eu possa usar qualquer um sem conflitos.

#### Critérios de Aceitação

1. A Aplicação DEVE manter o Formulário_Busca e todas as funcionalidades de busca por canal inalterados.
2. QUANDO o usuário submeter uma URL no Campo_URL_Avulsa, A Aplicação DEVE limpar qualquer resultado anterior de busca por canal antes de popular o Estado_Principal com o vídeo avulso.
3. QUANDO o usuário realizar uma busca pelo Formulário_Busca, A Aplicação DEVE limpar o Campo_URL_Avulsa.
4. O Campo_URL_Avulsa DEVE ser desabilitado enquanto uma busca por canal estiver em andamento, e o Formulário_Busca DEVE ser desabilitado enquanto o carregamento de um vídeo avulso estiver em andamento.
