# Documento de Design — Single Video Download

## Visão Geral

Esta feature adiciona um campo de input de URL avulsa (`Campo_URL_Avulsa`) ao `app/page.tsx`, posicionado entre o `ChannelForm` e a área de resultados. O usuário cola uma URL de vídeo do TikTok, clica em "Carregar vídeo", e o app cria um `ChannelVideoRow` sintético a partir da URL, populando `channelRows` e `selectedVideoUrls`. A partir daí, toda a infraestrutura existente (barra de ações, tabela de resultados, handlers de download/transcrição) funciona sem modificações.

Nenhum endpoint de API novo é necessário. Nenhum componente novo é criado — o campo é renderizado diretamente no `page.tsx` como um bloco de JSX simples.

### Decisões de Design

1. **Inline no page.tsx, sem componente separado**: A complexidade é mínima (um input, um botão, um handler). Criar um componente separado seria over-engineering.
2. **Regex para validação**: Usamos `/tiktok\.com\/@[\w.-]+\/video\/(\d+)/` para extrair o videoId e validar a URL simultaneamente.
3. **ChannelVideoRow sintético**: Como não temos metadados do vídeo (título, views, etc.), criamos uma entrada com valores padrão (título = `Video {videoId}`, views/likes = 0). Isso é suficiente porque os handlers de download e transcrição operam sobre `videoUrl`, não sobre metadados.
4. **Limpeza bidirecional**: Submeter URL avulsa limpa resultados de busca; iniciar busca por canal limpa o campo de URL avulsa. Isso evita conflitos de estado.

## Arquitetura

A mudança é contida inteiramente no frontend (`app/page.tsx` e opcionalmente `app/globals.css`).

```mermaid
flowchart TD
    A[ChannelForm - busca por canal] --> C[channelRows / selectedVideoUrls]
    B[Campo_URL_Avulsa - URL direta] --> C
    C --> D[Barra de Ações]
    C --> E[VideoResultsTable]
    D --> F[/api/download-video]
    D --> G[/api/transcribe-videos]
```

Ambos os pontos de entrada (A e B) alimentam o mesmo estado (C), que por sua vez alimenta a mesma UI (D, E) e os mesmos endpoints (F, G).

### Fluxo de Dados

1. Usuário cola URL no `Campo_URL_Avulsa`
2. Clica em "Carregar vídeo" (ou pressiona Enter)
3. Handler `handleSingleVideoSubmit`:
   - Valida URL com regex
   - Extrai `videoId`
   - Limpa estado anterior (`channelRows`, `transcriptRows`, status messages)
   - Cria `ChannelVideoRow` sintético
   - Define `channelRows = [row]` e `selectedVideoUrls = [url]`
4. A barra de ações aparece automaticamente (condição `channelRows.length > 0`)
5. Usuário clica em qualquer botão de ação — handlers existentes operam normalmente

## Componentes e Interfaces

### Modificações em `app/page.tsx`

**Novo estado:**
```typescript
const [singleVideoUrl, setSingleVideoUrl] = useState("");
const [singleVideoError, setSingleVideoError] = useState<string | null>(null);
```

**Nova função:**
```typescript
const TIKTOK_VIDEO_REGEX = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/;

const handleSingleVideoSubmit = () => {
  setSingleVideoError(null);
  const match = singleVideoUrl.trim().match(TIKTOK_VIDEO_REGEX);
  if (!match) {
    setSingleVideoError("URL inválida. Use o formato: https://www.tiktok.com/@usuario/video/1234567890");
    return;
  }
  const videoId = match[1];
  const url = singleVideoUrl.trim();

  // Limpa estado anterior
  setTranscriptRows([]);
  setTranscriptStatus(null);
  setDownloadStatus(null);
  setDetailLogs([]);
  setError(null);

  // Cria ChannelVideoRow sintético
  const row: ChannelVideoRow = {
    videoId,
    title: `Video ${videoId}`,
    description: "",
    views: 0,
    likes: 0,
    hashtags: [],
    videoUrl: url,
  };

  setChannelRows([row]);
  setSelectedVideoUrls([url]);
};
```

**Novo JSX** (entre `<ChannelForm>` e o bloco de loading):
```tsx
<div className="single-video-section">
  <div className="single-video-row">
    <input
      type="text"
      placeholder="Cole aqui a URL de um vídeo do TikTok"
      value={singleVideoUrl}
      onChange={(e) => { setSingleVideoUrl(e.target.value); setSingleVideoError(null); }}
      disabled={isFetchingChannel}
      onKeyDown={(e) => { if (e.key === "Enter") handleSingleVideoSubmit(); }}
    />
    <button
      className="btn btn-primary"
      onClick={handleSingleVideoSubmit}
      disabled={!singleVideoUrl.trim() || isFetchingChannel}
    >
      🎬 Carregar vídeo
    </button>
  </div>
  {singleVideoError && <div className="single-video-error">{singleVideoError}</div>}
</div>
```

**Modificação no `handleFetchChannel`** (limpeza bidirecional):
```typescript
// Adicionar no início de handleFetchChannel:
setSingleVideoUrl("");
setSingleVideoError(null);
```

### Modificações em `app/globals.css`

Estilos mínimos para o novo bloco:
```css
.single-video-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.single-video-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.single-video-row input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  color: var(--text);
  font-size: 0.9rem;
  outline: none;
}

.single-video-row input:focus {
  border-color: var(--primary);
}

.single-video-error {
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: var(--danger);
}
```

## Modelos de Dados

Nenhum modelo novo é criado. A feature reutiliza o tipo existente `ChannelVideoRow` de `types/index.ts`:

```typescript
export type ChannelVideoRow = {
  videoId: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  hashtags: string[];
  videoUrl: string;
  comments?: number;
  publishDate?: string;
};
```

Para o vídeo avulso, criamos uma instância com valores padrão:
- `videoId`: extraído da URL via regex
- `title`: `"Video {videoId}"`
- `description`: `""`
- `views`, `likes`: `0`
- `hashtags`: `[]`
- `videoUrl`: a URL inserida pelo usuário


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Propriedade 1: Validação de URL aceita somente URLs válidas do TikTok

*Para qualquer* string de entrada, a função de validação deve aceitá-la se e somente se ela contiver o padrão `tiktok.com/@{usuario}/video/{id_numérico}`. Strings que não correspondem ao padrão devem resultar em erro de validação, e strings que correspondem devem ser aceitas.

**Valida: Requisitos 2.1, 2.2**

### Propriedade 2: Criação correta de ChannelVideoRow a partir de URL válida

*Para qualquer* URL válida do TikTok, a função de criação de `ChannelVideoRow` deve produzir uma entrada onde: (a) `videoId` é igual ao ID numérico extraído da URL, (b) `videoUrl` é igual à URL de entrada, e (c) `title` contém o `videoId`.

**Valida: Requisitos 3.1, 3.2**

### Propriedade 3: Limpeza de estado ao submeter vídeo avulso

*Para qualquer* estado anterior da aplicação (com channelRows, transcriptRows e mensagens de status preenchidos), ao submeter uma URL válida no Campo_URL_Avulsa, `transcriptRows` deve estar vazio, `transcriptStatus` e `downloadStatus` devem ser nulos, e `channelRows` deve conter exatamente uma entrada.

**Valida: Requisitos 3.5, 5.2**

### Propriedade 4: Limpeza bidirecional — busca por canal limpa URL avulsa

*Para qualquer* valor preenchido no Campo_URL_Avulsa, ao iniciar uma busca pelo Formulário_Busca, o valor de `singleVideoUrl` deve ser redefinido para string vazia.

**Valida: Requisito 5.3**

### Propriedade 5: Estado desabilitado durante carregamento

*Para qualquer* estado onde `isFetchingChannel` é verdadeiro, o Campo_URL_Avulsa e seu botão devem estar desabilitados. Reciprocamente, o Formulário_Busca não precisa de desabilitação adicional pois o carregamento de vídeo avulso é síncrono (sem chamada de API).

**Valida: Requisito 5.4**

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| URL vazia / só espaços | Botão "Carregar vídeo" fica desabilitado (`disabled={!singleVideoUrl.trim()}`) |
| URL não corresponde ao padrão TikTok | Exibe mensagem de erro abaixo do campo: "URL inválida. Use o formato: https://www.tiktok.com/@usuario/video/1234567890" |
| Erro na transcrição/download após carregar vídeo avulso | Tratado pelos handlers existentes (`handleTranscribe`, `handleDownloadVideos`) — sem mudança |
| Usuário submete URL avulsa enquanto busca está em andamento | Campo desabilitado — não é possível submeter |

Não há novos cenários de erro de API, pois nenhum endpoint novo é criado.

## Estratégia de Testes

### Testes Unitários

Testes de exemplo e edge cases específicos:

1. **Renderização do campo**: Verificar que o input e o botão "Carregar vídeo" existem no DOM
2. **Placeholder**: Verificar que o input tem o placeholder correto
3. **Botão desabilitado com input vazio**: Verificar que o botão está desabilitado quando o input está vazio
4. **Integração com barra de ações**: Após submeter URL válida, verificar que a barra de ações é renderizada
5. **Vídeo aparece na tabela**: Após submeter URL válida, verificar que VideoResultsTable recebe a row correta

### Testes de Propriedade (Property-Based)

Biblioteca: **fast-check** (já compatível com o ecossistema Next.js/TypeScript)

Configuração: mínimo de 100 iterações por teste.

Cada teste deve ser anotado com um comentário referenciando a propriedade do design:

- **Feature: single-video-download, Property 1: Validação de URL aceita somente URLs válidas do TikTok**
  - Gerar strings aleatórias e URLs válidas do TikTok, verificar que a regex aceita/rejeita corretamente
  
- **Feature: single-video-download, Property 2: Criação correta de ChannelVideoRow a partir de URL válida**
  - Gerar URLs válidas aleatórias com usernames e videoIds variados, verificar que o ChannelVideoRow resultante tem os campos corretos

- **Feature: single-video-download, Property 3: Limpeza de estado ao submeter vídeo avulso**
  - Gerar estados anteriores aleatórios, submeter URL válida, verificar que o estado é limpo corretamente

- **Feature: single-video-download, Property 4: Limpeza bidirecional — busca por canal limpa URL avulsa**
  - Gerar valores aleatórios para singleVideoUrl, simular busca por canal, verificar que singleVideoUrl é limpo

- **Feature: single-video-download, Property 5: Estado desabilitado durante carregamento**
  - Para qualquer estado com isFetchingChannel=true, verificar que o campo e botão estão desabilitados

Cada propriedade de corretude DEVE ser implementada por um ÚNICO teste de propriedade.
