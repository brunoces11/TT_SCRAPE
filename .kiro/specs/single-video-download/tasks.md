# Plano de Implementação: Single Video Download

## Visão Geral

Adicionar o campo de URL avulsa ao `page.tsx`, com validação via regex, criação de `ChannelVideoRow` sintético, limpeza bidirecional de estado, e estilos CSS mínimos. Testes de propriedade com fast-check para validar a lógica pura.

## Tarefas

- [x] 1. Adicionar seção de URL avulsa ao `app/page.tsx`
  - [x] 1.1 Adicionar estado e handler `handleSingleVideoSubmit`
    - Criar estados `singleVideoUrl` e `singleVideoError`
    - Implementar a constante `TIKTOK_VIDEO_REGEX`
    - Implementar `handleSingleVideoSubmit`: validação com regex, extração do `videoId`, limpeza de estado anterior (`transcriptRows`, `transcriptStatus`, `downloadStatus`, `detailLogs`, `error`), criação do `ChannelVideoRow` sintético, e atualização de `channelRows` e `selectedVideoUrls`
    - _Requisitos: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Adicionar JSX do campo de URL avulsa
    - Renderizar `<div className="single-video-section">` entre `<ChannelForm>` e o bloco de loading
    - Input com placeholder "Cole aqui a URL de um vídeo do TikTok", bind ao estado `singleVideoUrl`
    - Botão "🎬 Carregar vídeo" com `disabled` quando input vazio ou `isFetchingChannel`
    - Suporte a Enter via `onKeyDown`
    - Exibir `singleVideoError` quando presente
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 5.4_

  - [x] 1.3 Adicionar limpeza bidirecional no `handleFetchChannel`
    - Inserir `setSingleVideoUrl("")` e `setSingleVideoError(null)` no início de `handleFetchChannel`
    - _Requisitos: 5.2, 5.3_

- [x] 2. Adicionar estilos CSS para a seção de URL avulsa
  - [x] 2.1 Adicionar classes em `app/globals.css`
    - `.single-video-section`: background, border, border-radius, padding, margin-bottom (mesmo padrão do `.channel-form`)
    - `.single-video-row`: flex layout com gap
    - `.single-video-row input`: flex: 1, estilos consistentes com inputs existentes
    - `.single-video-error`: cor de erro, font-size menor
    - _Requisitos: 1.4_

- [x] 3. Checkpoint — Verificar funcionamento manual
  - Garantir que o campo aparece, valida URLs, popula a tabela e a barra de ações funciona. Perguntar ao usuário se há dúvidas.

- [ ] 4. Testes de propriedade com fast-check
  - [ ]* 4.1 Escrever teste de propriedade para validação de URL
    - **Propriedade 1: Validação de URL aceita somente URLs válidas do TikTok**
    - Gerar strings aleatórias e URLs válidas, verificar que a regex aceita/rejeita corretamente
    - **Valida: Requisitos 2.1, 2.2**

  - [ ]* 4.2 Escrever teste de propriedade para criação de ChannelVideoRow
    - **Propriedade 2: Criação correta de ChannelVideoRow a partir de URL válida**
    - Gerar URLs válidas com usernames e videoIds variados, verificar campos do row resultante
    - **Valida: Requisitos 3.1, 3.2**

  - [ ]* 4.3 Escrever teste de propriedade para limpeza de estado
    - **Propriedade 3: Limpeza de estado ao submeter vídeo avulso**
    - Gerar estados anteriores aleatórios, submeter URL válida, verificar que estado é limpo e `channelRows` tem exatamente 1 entrada
    - **Valida: Requisitos 3.5, 5.2**

  - [ ]* 4.4 Escrever teste de propriedade para limpeza bidirecional
    - **Propriedade 4: Limpeza bidirecional — busca por canal limpa URL avulsa**
    - Gerar valores aleatórios para `singleVideoUrl`, simular busca por canal, verificar que `singleVideoUrl` é limpo
    - **Valida: Requisito 5.3**

  - [ ]* 4.5 Escrever teste de propriedade para estado desabilitado
    - **Propriedade 5: Estado desabilitado durante carregamento**
    - Para qualquer estado com `isFetchingChannel=true`, verificar que campo e botão estão desabilitados
    - **Valida: Requisito 5.4**

- [x] 5. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se há dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Testes de propriedade validam a lógica pura extraída do handler (regex, criação de row, limpeza de estado)
- Nenhum endpoint de API novo é necessário — toda a mudança é no frontend
