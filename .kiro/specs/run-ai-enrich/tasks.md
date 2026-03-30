# Plano de Implementação: Run AI — Enriquecimento de Metadados via LLM

## Visão Geral

Adicionar botão "Run AI" que envia metadados + transcrições dos vídeos selecionados ao LLM da OpenAI para gerar versões enriquecidas de título, descrição, hashtags e transcrição. Os dados enriquecidos são salvos em .txt junto com os originais usando um template específico.

## Tarefas

- [x] 0. Corrigir `handleSingleVideoSubmit` para buscar metadados reais via `/api/fetch-videos`
  - Já concluído. Removidos dados sintéticos, agora chama o actor do Apify para buscar metadados reais.

- [x] 1. Modificar `handleTranscribe` para suportar transcrição seletiva
  - [x] 1.1 Adicionar parâmetro opcional `urlsOverride?: string[]` em `handleTranscribe`
    - Quando passado, transcreve apenas essas URLs em vez de `selectedVideoUrls`
    - Quando não passado, comportamento atual inalterado
  - [x] 1.2 Fazer `handleTranscribe` retornar `TranscriptRow[]` como valor da Promise
    - Adicionar `return normalized` no final da função
    - Permite que `handleRunAI` capture dados em memória sem depender do React state

- [x] 2. Criar rota backend `/api/enrich-metadata/route.ts`
  - [x] 2.1 Criar o arquivo da rota com handler POST
    - Recebe `{ videos: [...], videosMeta: [...] }` do frontend
    - `videos` = payload para o LLM (videoId, title, description, hashtags, transcription)
    - `videosMeta` = metadados completos para gerar o .txt (inclui views, likes, videoUrl, publishDate)
  - [x] 2.2 Implementar chamada à OpenAI
    - Usar `response_format: { type: "json_object" }`
    - Modelo: gpt-4o-mini (custo-efetivo)
    - Prompt do sistema: será definido pelo usuário
    - Retry 1x se JSON malformado
  - [x] 2.3 Implementar parse da resposta e salvamento dos .txt
    - Mapear cada item retornado pelo LLM ao videosMeta correspondente usando `videoId`
    - Gerar .txt com template enriquecido (LLM_ + originais)
    - Sobrescrever .txt existente com mesmo nome
    - Itens não retornados pelo LLM são ignorados
    - Usar `sanitizeFilename` para nome do arquivo (copiar da rota de transcrição)
  - [x] 2.4 Definir template enriquecido `buildEnrichedTxtContent`
    - Template: LLM_Title, LLM_Description, LLM_Hashtags, LLM_Transcription, separador "-----", depois metadados originais completos

- [x] 3. Criar `handleRunAI` no frontend (`app/page.tsx`)
  - [x] 3.1 Adicionar estados `isRunningAI` e `runAIStatus`
  - [x] 3.2 Implementar lógica de verificação de transcrições existentes
    - Para cada URL selecionada, verificar se já existe em `transcriptRows`
    - Separar em `jaTranscritos[]` e `faltantes[]`
    - Se `faltantes.length > 0`, chamar `handleTranscribe(faltantes)` e capturar retorno
    - Combinar todos os dados de transcrição em memória
  - [x] 3.3 Implementar montagem do payload e chamada ao backend
    - Extrair `videoId` de `channelRows` (já disponível no campo `videoId`)
    - Montar array `videos` (para LLM) e `videosMeta` (para .txt)
    - Chamar `POST /api/enrich-metadata`
    - Atualizar `detailLogs` e `runAIStatus` com resultado

- [x] 4. Adicionar botão "🤖 Run AI" e CSS
  - [x] 4.1 Adicionar botão no JSX entre "Download selected videos" e "📦 Download all"
    - Desabilitado quando: nenhum vídeo selecionado ou qualquer operação em andamento
    - Texto: "🤖 Run AI" (normal) / "Running AI..." (durante execução)
  - [x] 4.2 Desabilitar todos os outros botões quando `isRunningAI === true`
  - [x] 4.3 Adicionar seção de status/loading do Run AI no JSX
  - [x] 4.4 Adicionar classe `.btn-run-ai` em `app/globals.css`
    - Gradiente visual distinto dos demais botões

- [x] 5. Definir prompt do sistema para o LLM
  - Será fornecido pelo usuário
  - Armazenar como constante ou variável de ambiente

- [ ] 6. Teste manual e validação
  - Testar com 1 vídeo selecionado
  - Testar com múltiplos vídeos selecionados
  - Testar com transcrições já baixadas (não deve re-baixar)
  - Testar com transcrições parciais (deve baixar apenas faltantes)
  - Verificar que .txt é sobrescrito corretamente
  - Verificar que botões existentes continuam funcionando

## Modelo JSON — Contrato LLM

### Envio (payload para o LLM):
```json
{
  "videos": [
    {
      "videoId": "7488736374602927402",
      "title": "Original title",
      "description": "Original description",
      "hashtags": "#tag1, #tag2",
      "transcription": "Transcript text or ERRO message"
    }
  ]
}
```

### Resposta esperada do LLM:
```json
{
  "videos": [
    {
      "videoId": "7488736374602927402",
      "title": "Enriched title",
      "description": "Enriched description",
      "hashtags": "#newtag1, #newtag2",
      "transcription": "Rewritten transcript"
    }
  ]
}
```

## Template .txt Enriquecido

```
LLM_Title: {título gerado pelo LLM}

LLM_Description: {descrição gerada pelo LLM}

LLM_Hashtags: {hashtags geradas pelo LLM}

LLM_Transcription: {transcrição reescrita pelo LLM}

-----

Title: {meta.title original}

Description: {meta.description original}

Hashtags: {meta.hashtags original}

Transcription: {transcript original ou ERRO}

Views: {meta.views}

Likes: {meta.likes}

Link: {meta.videoUrl}

Date: {meta.publishDate}
```

## Notas

- Etapa 0 já concluída
- Etapa 5 depende do usuário fornecer o prompt
- Nenhuma função existente é modificada exceto `handleTranscribe` (etapa 1)
- Todo o resto é código novo e aditivo
