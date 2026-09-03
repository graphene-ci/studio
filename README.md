# Graphene Studio

Самостоятельное операторское веб-приложение Graphene. Studio поставляется
отдельно от сервера, подключается к одной или нескольким инсталляциям через
публичный Management API и имеет web- и Electron-сборки.

Возможности пользователя, модель рабочей области и текущие ограничения описаны
в [документации Graphene](https://graphene-ci.github.io/docs/studio). Этот
README относится только к разработке репозитория.

## Устройство

- `src/pages/` — route-композиции;
- `src/components/` — UI и продуктовые компоненты;
- `src/hooks/` — React-слой над состоянием и API;
- `src/stores/` — состояние приложения на nanostores;
- `src/lib/` — ConnectRPC-клиенты и инфраструктура;
- `src/proto/` — зафиксированные TypeScript bindings Management API;
- `electron/` — main/preload desktop-оболочки;
- `public/` — статические ресурсы;
- `bin/` — локальные инструменты репозитория.

Архитектурные правила и границы компонентов находятся в `AGENTS.md`.

## Web-разработка

Нужны `make`, `curl` и Node.js `22.23.x`. Остальные инструменты и
зависимости устанавливаются внутри репозитория:

```bash
make configure
make dev
```

Dev-сервер доступен на `http://localhost:5173`; запросы по умолчанию
проксируются в `http://localhost:7233`. Другой сервер задаётся так:

```bash
VITE_PROXY_TARGET=http://graphene.example.com:7233 make dev
```

## Desktop-разработка

```bash
make dev-desktop
make build-desktop
make package-desktop
```

Платформенные yarn-команды: `package:linux`, `package:win`,
`package:mac`. Desktop использует тот же renderer и не добавляет отдельный
протокол к серверу.

## Проверка

```bash
make test
make lint
make build
```

`make test` проверяет TypeScript, `make lint` валидирует `easyp.yaml` и
запускает Biome. Форматирование выполняет `make format`.

## Контракты сервера

Источником Management API служат `.proto` из репозитория
`graphene-ci/graphene`. Сгенерированные bindings коммитятся в `src/proto/`,
поэтому обычная сборка не зависит от соседнего checkout.

```bash
make generate
```

Команда обновляет `easyp.lock` до указанной Git-ревизии и полностью
пересоздаёт bindings. Сгенерированные файлы вручную не редактируются.
