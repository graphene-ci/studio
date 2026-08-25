.DEFAULT_GOAL := help

BIN := $(CURDIR)/bin
YARN_JS := $(BIN)/yarn.cjs
YARN := node $(YARN_JS)

export PATH := $(BIN):$(PATH)

NODE_VERSION := v26.7.0
YARN_VERSION := 1.22.22
YARN_SHA256 := 1ba910c84256998c4bf4b925857c2693adebdc962a2e3075f4f8b67045f45105
YARN_URL := https://github.com/yarnpkg/yarn/releases/download/v$(YARN_VERSION)/yarn-$(YARN_VERSION).js

.PHONY: configure
configure: verify-node $(YARN_JS) ## Подготовить локальное окружение с нуля
	$(YARN) install --frozen-lockfile --non-interactive

.PHONY: verify-node
verify-node:
	@test "$$(node --version)" = "$(NODE_VERSION)" || { \
		echo "нужен Node.js $(NODE_VERSION), найден $$(node --version 2>/dev/null || echo 'не найден')" >&2; \
		exit 1; \
	}

$(YARN_JS):
	curl --fail --location --silent --show-error $(YARN_URL) --output $@.tmp
	echo "$(YARN_SHA256)  $@.tmp" | sha256sum --check -
	mv $@.tmp $@
	chmod +x $@

.PHONY: dev
dev: $(YARN_JS) ## Запустить dev-сервер с hot reload
	$(YARN) dev

.PHONY: test
test: $(YARN_JS) ## Проверить типы TypeScript
	$(YARN) test

.PHONY: lint
lint: $(YARN_JS) ## Запустить Biome
	$(YARN) lint

.PHONY: format
format: $(YARN_JS) ## Отформатировать исходники через Biome
	$(YARN) format

.PHONY: build
build: $(YARN_JS) ## Собрать production bundle
	$(YARN) build

.PHONY: preview
preview: $(YARN_JS) ## Локально показать production bundle
	$(YARN) preview

.PHONY: clean
clean: ## Удалить результаты сборки
	rm -rf dist

.PHONY: help
help: ## Показать цели Makefile
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'
