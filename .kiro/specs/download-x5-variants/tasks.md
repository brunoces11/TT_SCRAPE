# Plano de Implementação: Download x5 Variantes

## Visão Geral

Implementação incremental da funcionalidade de download x5 variantes, estendendo o endpoint existente `/api/download-video` e adicionando o botão "Baixar tudo x5" ao frontend. Cada tarefa constrói sobre a anterior, finalizando com a integração completa.

## Tarefas

- [x] 1. Implementar a função `generateRandomParams` e estender o backend com modo x5
  - [x] 1.1 Adicionar a função `generateRandomParams` em `app/api/download-video/route.ts`
    - Criar a função que retorna `{ crf, scaleFactor, noise, speed, pitch }` com valores aleatórios dentro das faixas definidas
    - CRF: 20–26 (inteiro), scaleFactor: 1.005–1.02, noise: 2–5 (inteiro), speed: 0.98–1.02, pitch: 0.99–1.02
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 1.2 Escrever teste de propriedade para faixas de parâmetros randomizados
    - **Propriedade 1: Faixas de parâmetros randomizados**
    - Usar `fast-check` com mínimo de 100 iterações para verificar que todos os valores gerados estão dentro das faixas
    - **Valida: Requisitos 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ]* 1.3 Escrever teste de propriedade para independência dos parâmetros
    - **Propriedade 2: Independência dos parâmetros entre variantes**
    - Gerar lotes de 5 conjuntos e verificar que nem todos são idênticos
    - **Valida: Requisito 4.6**

  - [x] 1.4 Estender o handler POST em `app/api/download-video/route.ts` para suportar `mode: "x5"`
    - Extrair `mode` do body da requisição
    - Quando `mode === "x5"`: salvar original como `{safeName}_ORIG.mp4` (cópia sem ffmpeg), gerar 5 variantes `{safeName}_v01.mp4` a `{safeName}_v05.mp4` usando `generateRandomParams` para cada
    - Quando `mode` ausente ou diferente de `"x5"`: manter comportamento atual inalterado
    - Remover arquivo temporário do yt-dlp após concluir todas as variantes
    - Incluir campo `variant` ("ORIG", "v01"–"v05") em cada item do array `results`
    - Em caso de falha em uma variante, registrar erro e continuar com as demais
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3_

  - [ ]* 1.5 Escrever teste de propriedade para convenção de nomenclatura
    - **Propriedade 3: Convenção de nomenclatura de arquivos x5**
    - Gerar títulos aleatórios e verificar que os nomes seguem `{sanitizeFilename(titulo)}_ORIG.mp4` e `{sanitizeFilename(titulo)}_v{NN}.mp4`
    - **Valida: Requisitos 5.1, 5.2, 3.1, 3.2, 7.1**

  - [ ]* 1.6 Escrever teste de propriedade para compatibilidade retroativa
    - **Propriedade 4: Compatibilidade retroativa do endpoint**
    - Verificar que requisições sem `mode` ou com `mode` diferente de `"x5"` mantêm o fluxo atual
    - **Valida: Requisito 3.3**

- [x] 2. Checkpoint — Verificar backend
  - Garantir que todos os testes passam e que o endpoint funciona corretamente nos dois modos. Perguntar ao usuário se há dúvidas.

- [x] 3. Implementar o botão "Baixar tudo x5" e o fluxo sequencial no frontend
  - [x] 3.1 Adicionar estados `isDownloadingX5` e `downloadX5Status` em `app/page.tsx`
    - `const [isDownloadingX5, setIsDownloadingX5] = useState(false);`
    - `const [downloadX5Status, setDownloadX5Status] = useState<string | null>(null);`
    - _Requisitos: 1.3, 6.1_

  - [x] 3.2 Implementar a função `handleDownloadX5` em `app/page.tsx`
    - Validar que há vídeos selecionados
    - Executar `handleTranscribe()` primeiro (mesmo padrão do `handleDownloadAll`)
    - Iterar sequencialmente sobre `selectedVideoUrls`, enviando uma requisição POST por vídeo com `{ videoUrls: [url], titles: [title], mode: "x5" }`
    - Atualizar `detailLogs` após cada requisição com ícone de sucesso/erro e nomes dos arquivos
    - Em caso de falha de um vídeo, adicionar log de erro e continuar com os restantes
    - Ao final, exibir resumo com contagem de sucessos e falhas em `downloadX5Status`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.3 Escrever teste de propriedade para requisições sequenciais
    - **Propriedade 5: Requisições sequenciais com corpo correto**
    - Verificar que para N vídeos, são enviadas N requisições com `mode: "x5"` e 1 URL cada
    - **Valida: Requisitos 2.2, 2.3**

  - [ ]* 3.4 Escrever teste de propriedade para resiliência a falhas no frontend
    - **Propriedade 7: Resiliência a falhas parciais no frontend**
    - Gerar sequências com falhas em posições aleatórias e verificar que o processamento continua
    - **Valida: Requisito 6.3**

  - [ ]* 3.5 Escrever teste de propriedade para resumo final
    - **Propriedade 9: Resumo final com contagens corretas**
    - Gerar listas de resultados mistos e verificar que S + F = total
    - **Valida: Requisito 6.4**

  - [x] 3.6 Adicionar o botão "Baixar tudo x5" na barra de ações em `app/page.tsx`
    - Posicionar ao lado do botão "Baixar tudo" existente
    - Usar classe CSS `btn-download-x5`
    - Texto: "🔥 Baixar tudo x5" (normal) / "Baixando x5..." (durante download)
    - Desabilitar quando `selectedVideoUrls.length === 0` ou `isDownloadingX5`
    - Desabilitar botões "Baixar tudo", "Baixar Transcrição" e "Baixar vídeos selecionados" quando `isDownloadingX5` é `true`
    - Conectar ao handler `handleDownloadX5`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 3.7 Escrever teste de propriedade para desabilitação de botões
    - **Propriedade 6: Desabilitação de botões durante download x5**
    - Verificar que quando `isDownloadingX5` é `true`, todos os botões relevantes estão desabilitados
    - **Valida: Requisitos 1.3, 1.4**

- [x] 4. Adicionar feedback visual e status de loading para download x5
  - [x] 4.1 Adicionar seção de loading/status do download x5 em `app/page.tsx`
    - Exibir spinner + mensagem quando `isDownloadingX5` é `true`
    - Exibir resumo final em `downloadX5Status` quando concluído
    - Seguir o mesmo padrão visual do `downloadStatus` existente
    - _Requisitos: 6.1, 6.2, 6.4_

- [x] 5. Adicionar estilo CSS do botão "Baixar tudo x5"
  - [x] 5.1 Criar classe `.btn-download-x5` em `app/globals.css`
    - Gradiente laranja/dourado: `linear-gradient(135deg, #e17055, #fdcb6e)`
    - Efeito hover com `translateY(-1px)` e `box-shadow`
    - Padding e font-size consistentes com os demais botões da barra de ações
    - _Requisitos: 8.1, 8.2_

- [x] 6. Checkpoint final — Validação completa
  - Garantir que todos os testes passam. Verificar que o botão aparece corretamente, o fluxo sequencial funciona, e o comportamento existente não foi alterado. Perguntar ao usuário se há dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e edge cases
