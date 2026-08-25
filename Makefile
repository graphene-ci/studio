.DEFAULT_GOAL := help

BIN := $(CURDIR)/bin
YARN_JS := $(BIN)/yarn.cjs
YARN := node $(YARN_JS)

export PATH := $(BIN):$(PATH)

NODE_VERSION := v26.7.0
YARN_VERSION := 1.22.22
YARN_SHA256 := 1ba910c84256998c4bf4b925857c2693adebdc962a2e3075f4f8b67045f45105
YARN_URL := https://github.com/yarnpkg/yarn/releases/download/v$(YARN_VERSION)/yarn-$(YARN_VERSION).js
EASYP_VERSION := 0.16.6

.PHONY: configure
configure: verify-node $(YARN_JS) $(BIN)/easyp ## Подготовить локальное окружение с нуля
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

$(BIN)/easyp:
	@set -eu; \
	os="$$(uname -s)"; \
	arch="$$(uname -m)"; \
	case "$$os/$$arch" in \
		Linux/x86_64) platform=linux-amd64; sha256=d6ac38f8e1faedde43b72ce41b3b9c18df2f0286035c0f2a23777344cc857bab ;; \
		Linux/aarch64|Linux/arm64) platform=linux-arm64; sha256=2c9e135665482f2678a99ffafb9c19048c5d6aac66271c3d7459b9e9fb27a276 ;; \
		Darwin/x86_64) platform=darwin-amd64; sha256=7fa98cf0d0d7d3a981fbb405c730be8c725290cada1da43f8f1c895d4d730195 ;; \
		Darwin/arm64) platform=darwin-arm64; sha256=6823d0c84ea334acd130686830022c516f679fe0d4e44c134d07928fd0569fc7 ;; \
		*) echo "EasyP $(EASYP_VERSION) не поддерживает платформу $$os/$$arch в этом репозитории" >&2; exit 1 ;; \
	esac; \
	archive="easyp-$(EASYP_VERSION)-$$platform.tar.gz"; \
	url="https://github.com/easyp-tech/easyp/releases/download/v$(EASYP_VERSION)/$$archive"; \
	curl --fail --location --silent --show-error "$$url" --output "$@.tmp"; \
	echo "$$sha256  $@.tmp" | sha256sum --check -; \
	tar -xzf "$@.tmp" -C $(BIN) --strip-components=1 "easyp-$(EASYP_VERSION)-$$platform/easyp"; \
	rm "$@.tmp"; \
	chmod +x $@

.PHONY: dev
dev: $(YARN_JS) ## Запустить dev-сервер с hot reload
	$(YARN) dev

.PHONY: test
test: $(YARN_JS) ## Проверить типы TypeScript
	$(YARN) test

.PHONY: lint
lint: $(YARN_JS) $(BIN)/easyp ## Проверить EasyP-конфигурацию и запустить Biome
	$(BIN)/easyp validate-config
	$(YARN) lint

.PHONY: format
format: $(YARN_JS) ## Отформатировать исходники через Biome
	$(YARN) format

.PHONY: generate
generate: $(BIN)/easyp $(YARN_JS) ## Перегенерировать TypeScript-контракты из graphene-ci/graphene
	$(YARN) install --frozen-lockfile --non-interactive
	$(BIN)/easyp generate

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
