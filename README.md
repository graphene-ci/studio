# Graphene Studio

Graphene Studio — самостоятельное веб-приложение для работы с Graphene CI.
Оно подключается к одному или нескольким Graphene Server через именованные
контексты и даёт оператору единое пространство для пайплайнов, прогонов,
ресурсов, переменных, секретов и наблюдаемости.

Studio не встраивается в сервер и не требует соседнего checkout для сборки.
Подключение выбирается в самом приложении; адрес сервера, namespace и токен
хранятся локально в браузере.

## Устройство

- `src/pages/` — тонкие route-композиции;
- `src/components/` — UI и продуктовые компоненты;
- `src/hooks/` — React-слой над состоянием и API;
- `src/stores/` — состояние приложения на nanostores;
- `src/lib/` — ConnectRPC-клиенты и инфраструктура;
- `src/proto/` — зафиксированные TypeScript bindings Management API;
- `public/` — статические ресурсы приложения;
- `bin/` — инструменты репозитория, устанавливаемые `make configure`.

Подробные архитектурные и UI-правила находятся в `AGENTS.md`.

## Начало работы

Нужны `make`, `curl` и Node.js `26.7.x`. Остальные инструменты и зависимости
ставятся локально в репозиторий:

```bash
make configure
make dev
```

Dev-сервер доступен на `http://localhost:5173`. ConnectRPC-запросы по
умолчанию проксируются в `http://localhost:7233`; другой адрес задаётся так:

```bash
VITE_PROXY_TARGET=http://graphene.example.com:7233 make dev
```

### Desktop

Для локальной разработки в нативном окне Electron:

```bash
make dev-desktop
```

Быстрая unpacked-сборка для проверки без установщика и полная упаковка:

```bash
node bin/yarn.cjs package:dir
make package-desktop
```

Платформенные команды: `package:linux`, `package:win`, `package:mac`.
Desktop runtime находится в `electron/`; продуктовые IPC и нативные расширения
в него не входят.

## Проверка

```bash
make test
make lint
make build
```

`make test` проверяет TypeScript, `make lint` валидирует `easyp.yaml` и запускает
Biome, а `make build` собирает production bundle в `dist/`. Форматирование
выполняет `make format`; версия Biome зафиксирована в `package.json` и
`yarn.lock`.

## Контракты сервера

Источником Management API остаются `.proto` в репозитории
`graphene-ci/graphene`. Сгенерированные bindings коммитятся в `src/proto/`,
поэтому обычные `configure`, `test` и `build` не зависят от соседнего
репозитория. Изменение wire-контракта проводится согласованными изменениями
server и Studio; сгенерированные файлы вручную не редактируются.

Bindings перегенерируются из каталога `proto` зафиксированной ревизии
`graphene-ci/graphene` напрямую с GitHub:

```bash
make generate
```

Источник и параметры `protoc-gen-es` описаны в `easyp.yaml`. EasyP и плагин
устанавливаются локально командами репозитория и имеют зафиксированные версии;
соседний checkout `graphene` для генерации не используется.
