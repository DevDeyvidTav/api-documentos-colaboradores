# API de Documentação de Colaboradores

API REST para gerenciamento de documentação obrigatória de colaboradores — teste técnico Inmeta.

O sistema controla cadastro de colaboradores, tipos de documentos, vínculos obrigatórios, envio lógico com histórico de versões, pendências, estatísticas e soft delete. **Autenticação está fora do escopo.**

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + NestJS 11 |
| Banco | PostgreSQL 16 (Docker Compose) |
| ORM | TypeORM 0.3.31 |
| Validação | class-validator + Joi (env) |
| Docs | Swagger (`/docs`) |
| Health | @nestjs/terminus (`/health`) |
| Testes | Jest (unitário + integração/e2e) |

## Pré-requisitos

- Node.js **≥ 22.13** recomendado (22.0 funciona, mas gera warnings `EBADENGINE`)
- Docker Desktop em execução
- npm

## Configuração rápida

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Subir PostgreSQL
docker compose up -d

# 4. Aplicar migrations
npm run migration:run

# 5. Iniciar em modo desenvolvimento
npm run start:dev
```

A API sobe em `http://localhost:3000`. Swagger em `http://localhost:3000/docs` — inclui schema de sucesso e **respostas de erro por endpoint** (`ErrorResponseDto`: `statusCode`, `error`, `message`, `timestamp`, `path`).

### Porta do PostgreSQL

O `.env.example` usa `DB_PORT=5434` porque em ambientes com PostgreSQL local ou outros containers (5432/5433 ocupados), o mapeamento padrão conflita. Ajuste conforme sua máquina.

## Scripts úteis

| Script | Descrição |
|---|---|
| `npm run start:dev` | Desenvolvimento com hot-reload |
| `npm run build` | Compila TypeScript |
| `npm run lint` | ESLint + Prettier |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes de integração (Postgres real) |
| `npm run migration:generate -- src/database/migrations/NomeDaMigration` | Gera migration a partir das entities |
| `npm run migration:run` | Aplica migrations pendentes |
| `npm run migration:revert` | Reverte última migration |

## Endpoints implementados

### Infraestrutura

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check (inclui ping ao PostgreSQL) |
| GET | `/docs` | Swagger UI |

### Colaboradores

| Método | Rota | Descrição |
|---|---|---|
| POST | `/collaborators` | Cadastro |
| GET | `/collaborators` | Listagem paginada (`page`, `limit`, filtros `name`, `email`, `status`) |
| GET | `/collaborators/:id` | Busca por ID |
| DELETE | `/collaborators/:id` | Soft delete (204 No Content) |

**Regras atuais:**

- E-mail único entre colaboradores **ativos** (índice parcial `WHERE deleted_at IS NULL`)
- Soft-deleted retorna **404** em `GET /:id` e mutações
- E-mail de colaborador removido pode ser reutilizado em novo cadastro
- Listagem padrão (`status=active`) exclui removidos; use `status=deleted` ou `status=all` para auditoria

**Query param `status` (GET /collaborators):**

| Valor | Comportamento |
|---|---|
| `active` | Padrão — somente colaboradores ativos |
| `deleted` | Somente soft-deleted (resposta inclui `deletedAt`) |
| `all` | Ativos e removidos (`deletedAt` presente nos removidos) |

## Estrutura do projeto

```
src/
├── collaborators/          # Módulo de domínio (implementado)
├── common/                 # DTOs compartilhados, filtros, utilitários
├── config/                 # Validação de variáveis de ambiente (Joi)
├── database/               # TypeORM, data-source CLI, migrations
├── health/                 # Health check
├── app.module.ts
└── main.ts
```

### Camadas por módulo de domínio

```
Controller  → HTTP, status codes, DTOs de entrada/saída
Service     → Regras de negócio, orquestração, exceções de domínio
Repository  → Acesso a dados (QueryBuilder, soft delete explícito)
Entity      → Mapeamento ORM + constraints declarativas
Mapper      → Entity ↔ DTO de resposta
DTO         → Validação de input (class-validator)
```

---

## Decisões arquiteturais

### 1. Evolução do banco somente via migrations

**Decisão:** `synchronize: false` fixo no código (não configurável por env).

**Motivo:** Evita alteração acidental de schema em produção. Toda mudança passa por migration versionada e revisável.

### 2. TypeORM 0.3.31 (não 1.1.x)

**Decisão:** Manter a linha `0.3.31` (dist-tag `legacy` no npm).

**Alternativa descartada:** `typeorm@1.1.0` ("latest") — CLI quebrado (`ERR_REQUIRE_ESM` no `yargs`), impossibilitando `migration:generate` e `migration:run`.

**Trade-off:** Versão estável e comprovada vs. features mais novas da 1.x. Para este projeto, CLI funcional é requisito inegociável.

### 3. UUID via `gen_random_uuid()` (pgcrypto)

**Decisão:** `uuidExtension: 'pgcrypto'` no TypeORM.

**Alternativa descartada:** `uuid-ossp` / `uuid_generate_v4()` — exige extensão extra; PostgreSQL 13+ já possui `gen_random_uuid()` nativamente.

### 4. Soft delete com índice único parcial

**Decisão:** `@DeleteDateColumn` + `UNIQUE (email) WHERE deleted_at IS NULL`.

**Motivo:** Permite reutilizar e-mail de colaborador removido sem perder histórico. Consultas operacionais filtram `deleted_at IS NULL` explicitamente no repository (não dependem de comportamento implícito do ORM).

### 5. Unicidade de e-mail: check + constraint

**Decisão:** Service verifica e-mail antes de inserir **e** captura violação de unique (`23505`) do PostgreSQL.

**Motivo:** A checagem prévia dá resposta rápida no caso comum; a constraint garante consistência sob concorrência (duas requisições simultâneas).

### 6. Filtro global de exceções padronizado

**Decisão:** `AllExceptionsFilter` com shape fixo:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "...",
  "timestamp": "2026-07-27T...",
  "path": "/collaborators/..."
}
```

**Motivo:** Respostas uniformes independentemente da origem (validação, domínio, erro inesperado). Stack trace não vaza em produção.

### 7. Paginação offset/limit

**Decisão:** `page` + `limit` (máximo 100), ordenação estável `created_at DESC, id DESC`.

**Alternativa descartada:** Cursor-based — mais complexo sem requisito de deep-pagination neste volume.

### 8. Estatísticas derivadas (não implementadas ainda)

**Decisão planejada:** Dashboard calculado por queries agregadas, sem tabela/materialized view de snapshot.

**Motivo:** Poucas tabelas, volume baixo, sempre consistente com soft delete. Evita invalidação de cache.

### 9. Envio lógico de documentos (domínio futuro)

**Decisão planejada:** `DocumentVersion` como evento de negócio, sem storage de arquivo (S3/upload).

**Motivo:** Escopo do teste é versionamento e regras, não gestão de arquivos.

### 10. Sem autenticação

**Decisão:** Nenhum middleware de auth.

**Motivo:** Restrição explícita do enunciado.

### 11. Repository concreto (sem contratos / ports)

**Decisão:** O Service injeta a **classe concreta** do Repository (ex.: `CollaboratorsRepository`), sem interface `ICollaboratorsRepository` + token de injeção.

**Alternativa considerada:** Inversão de dependência com contratos, para “desacoplar a API do TypeORM” e facilitar troca de ORM ou banco.

**Por que descartamos a abstração neste projeto:**

| Camada | Acoplamento real |
|---|---|
| Migrations | CLI e formato TypeORM (`data-source.ts`, `migration:run`) |
| Entities | Decorators TypeORM (`@Entity`, `@DeleteDateColumn`, `@Index`) |
| Repository | `QueryBuilder`, `withDeleted()`, `softDelete()`, SQL Postgres (`ILIKE`) |
| Banco | Índices parciais, `gen_random_uuid()`, constraints específicas de PostgreSQL |

Enquanto migrations e entities forem TypeORM, **trocar de ORM exige reescrever persistência inteira** — uma interface no repository não elimina esse custo; apenas move o acoplamento para a implementação concreta (onde ele já está de forma explícita).

**O que mantemos (e consideramos suficiente):**

- Separação **Controller → Service → Repository** — regras de negócio não usam `QueryBuilder`
- Injeção de dependência via NestJS (container resolve providers)
- Testes unitários com mock do repository
- Acoplamento TypeORM/Postgres **contido** em Entity + Repository + migrations (fronteira consciente de infraestrutura)

**Trade-off:** Menos boilerplate (sem interface + symbol + `useClass` por módulo) e decisão arquitetural honesta (“TypeORM é a stack de persistência escolhida”) vs. portabilidade teórica de ORM que o escopo do teste não exige.

---

## Modelagem de domínio (visão geral)

Entidades planejadas — **apenas `Collaborator` está implementada**:

```
Collaborator 1 ── N DocumentRequirement N ── 1 DocumentType
                              │
                              1
                              │
                              N
                       DocumentVersion
```

| Entidade | Soft delete | Status |
|---|---|---|
| Collaborator | Sim | Implementado |
| DocumentType | Sim | Pendente |
| DocumentRequirement | Sim (desvínculo) | Pendente |
| DocumentVersion | Não (append-only) | Pendente |

---

## Trade-offs enfrentados

### PostgreSQL: porta 5434 vs 5432

**Problema:** PostgreSQL local (v17) ocupava 5432; outro container usava 5433.

**Solução:** Mapear Docker Compose na porta **5434** e documentar no `.env.example`.

**Lição:** Em dev com múltiplos Postgres, a porta não pode ser assumida como 5432.

### Connection pool explícito

**Problema:** Pool do `node-postgres` existia implicitamente (`max: 10`), mas não era configurável.

**Solução:** `DB_POOL_SIZE`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS` via env.

**Trade-off:** Mais variáveis vs. controle previsível em produção.

### npm audit: overrides vs `--force`

**Problema:** 28 vulnerabilidades high reportadas; `npm audit fix --force` sugeria instalar `typeorm@1.1.0`, `@nestjs/cli@6`, downgrades incompatíveis.

**Solução:** `overrides` pontuais no `package.json`:

```json
{
  "@nestjs/swagger": { "js-yaml": "5.2.2" },
  "typeorm": { "glob": "^11.0.0" },
  "jest": { "glob": "^11.0.0" }
}
```

**Resultado:**

| Escopo | Antes | Depois |
|---|---|---|
| Produção (`npm audit --omit=dev`) | 6 high | **0** |
| Total (incl. dev) | 28 high | **24 high** |

**Trade-off:** ~24 vulnerabilidades restantes são transitivas de **ESLint**, **@nestjs/cli** e **test-exclude** (tooling de dev, não runtime). Forçar `minimatch@10` globalmente quebraria ESLint (API incompatível com v3). Aceito conscientemente.

### Testes e2e no mesmo banco de desenvolvimento

**Problema:** Não há banco de teste isolado configurado. Suites e2e compartilham o mesmo Postgres.

**Solução:**
- `TRUNCATE` de `document_version`, `document_requirement`, `collaborator` e `document_type` antes/depois de cada suite
- `maxWorkers: 1` no `jest-e2e.json` (execução serial)

**Motivo:** Workers paralelos no mesmo banco causam deadlock em `TRUNCATE` e contaminação de dados entre suites (409/404 flaky).

**Trade-off:** Suite e2e mais lenta vs. estabilidade. Evolução futura: `.env.test` + Postgres dedicado ou Testcontainers.

### TypeScript: entidades e DTOs decorados

**Problema:** Erros TS2564 (`Property has no initializer`) e TS2593 (`Cannot find name 'describe'`) no editor.

**Solução no `tsconfig.json`:**

```json
{
  "strictPropertyInitialization": false,
  "useDefineForClassFields": false,
  "types": ["node", "jest"]
}
```

**Motivo:** Entidades TypeORM e DTOs são populados pelo framework/ORM, não por construtor. `useDefineForClassFields: false` é recomendação oficial do TypeORM para targets ES2022+.

### Check-then-act no cadastro de colaborador

**Problema:** Verificar e-mail antes de salvar é redundante quando existe unique parcial no banco.

**Solução:** Manter ambos — check para UX (409 rápido) + constraint para corrida.

**Trade-off:** Duas camadas de proteção vs. simplicidade de uma única fonte de verdade. Escolhemos defesa em profundidade.

### Concorrência no envio de Document Versions

**Problema (race condition):** Uma transação simples (desativar + inserir) **não serializa** leituras concorrentes do mesmo requisito. Duas requisições podem ler o mesmo `MAX(version_number)`, calcular o mesmo próximo número e tentar criar duas versões `4` — ou deixar mais de uma `is_active = true` por um instante até a constraint falhar.

**Solução:** Lock pessimista no **agregado** `DocumentRequirement` (`SELECT ... FOR UPDATE` via TypeORM `pessimistic_write`), **dentro** da mesma transação que:

1. valida requisito / colaborador / tipo ativos;
2. desativa a versão ativa;
3. calcula o próximo `versionNumber`;
4. cria a nova versão ativa.

Assim, envios do **mesmo** requisito enfileiram; requisitos **diferentes** continuam em paralelo (sem lock global, sem mutex em memória, sem Redis/fila).

**Por que no requisito (e não na versão):** o requisito é a unidade de consistência da sequência. Travar só a versão ativa falharia no primeiro envio (ainda não existe versão) e não cobriria bem o cálculo do próximo número.

**Por que as constraints continuam necessárias:**

| Constraint | Proteção |
|---|---|
| `UNIQUE (requirement_id, version_number)` | impede duplicidade de número mesmo sob bug/race residual |
| `UNIQUE (requirement_id) WHERE is_active = true` | garante no máximo uma versão ativa |

São a **última camada**; o lock é a camada de ordenação/prevenção.

**Múltiplas instâncias da API:** o lock é no PostgreSQL (linha), então funciona entre pods/processos. Mutex em memória só protegeria uma instância.

**Soft delete concorrente com envio:** o `FOR UPDATE` na linha do requisito serializa com o soft delete (que atualiza `deleted_at`). O resultado pode ser envio concluído antes da remoção **ou** 404 por requisito inativo — nunca duas ativas, nunca número duplicado, nunca versão “órfã ativa” criada **depois** do soft delete na mesma linha bloqueada.

**Concorrência ≠ idempotência:**

- **Concorrência (etapa 6):** operações **distintas** simultâneas geram versões **distintas** e ordenadas (4, 5, 6).
- **Idempotência (etapa 7):** retries da **mesma** operação não devem criar versões extras.

### Idempotência no envio de Document Versions

**Por que retries acontecem:** timeouts de rede, proxies, clients HTTP com retry automático e falhas transitórias fazem o cliente reenviar a **mesma** intenção de operação.

**Diferença:**

| Conceito | Entrada | Saída |
|---|---|---|
| Concorrência | 3 operações distintas | versões 4, 5 e 6 |
| Idempotência | 3 retries da mesma operação | apenas a versão 4 |

**Estratégia:** header obrigatório `Idempotency-Key` (UUID) + colunas `idempotency_key` / `request_hash` em `document_version` + `UNIQUE (requirement_id, idempotency_key)`.

**Por que `requestHash`:** a mesma chave com payload diferente é erro do cliente → **409**. Só a chave não basta (evitaria detectar reuso indevido).

**Por que não só hash:** hashes iguais de payloads distintos são colisões teóricas; a chave é o identificador da operação lógica escolhido pelo cliente. Hash valida **compatibilidade** do retry.

**Por que não Redis / cache / fila / mutex:** o desafio exige persistência no PostgreSQL junto do agregado; funciona entre múltiplas instâncias sem store extra; o `FOR UPDATE` no requisito já serializa a checagem/criação.

**Reutilização da resposta:**

```text
Client
  └─ POST /document-requirements/:id/versions
       Header: Idempotency-Key
       Body: { documentReference }
            │
            ▼
       BEGIN + FOR UPDATE no requisito
            │
            ▼
       Existe (requirementId, key)?
         ├─ Sim ─ mesmo hash? ─ Sim → 200 (versão existente)
         │                    └─ Não → 409 Conflict
         └─ Não → cria versão + persiste key/hash → 201
```

**Importante:** o lock pessimista continua ativo. Idempotência não substitui concorrência — complementa.

---

## Segurança (escopo atual)

- Queries parametrizadas via QueryBuilder (sem concatenação SQL)
- `ValidationPipe` com `whitelist` e `forbidNonWhitelisted` (proteção contra mass assignment)
- `ParseUUIDPipe` em rotas com `:id`
- Soft-deleted tratado como inexistente (404, sem vazamento)
- Swagger exposto sem auth — aceitável em dev; em produção, restringir por ambiente ou rede

---

## Próximos módulos (planejados)

1. **Document Types** — catálogo mestre de tipos de documento
2. **Requirements** — vinculação/desvinculação colaborador ↔ tipo
3. **Document Versions** — envio lógico, reenvio, histórico, idempotência
4. **Statistics** — dashboard (% completude, tipos pendentes, últimos envios)

---

## Licença

UNLICENSED — uso privado (teste técnico).
