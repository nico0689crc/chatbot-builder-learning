# ============================================================
# Chatbot Builder — comandos de desarrollo
# ============================================================

.PHONY: help test test-unit test-integration test-watch test-multi-campo \
        migrate migrate-test db-push dev build

# ── Valores por defecto ──────────────────────────────────────
ENV_FILE     ?= .env
ENV_TEST_FILE ?= .env.test

# ── Ayuda ────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Comandos disponibles:"
	@echo ""
	@echo "  make dev               Inicia el servidor en modo desarrollo"
	@echo "  make build             Compila el proyecto"
	@echo ""
	@echo "  make test              Corre todos los tests de integración"
	@echo "  make test-integration  Alias de test"
	@echo "  make test-unit         Tests unitarios (sin LLM ni BD)"
	@echo "  make test-multi-campo  Unit + e2e de los nuevos features multi-campo"
	@echo "  make test-watch        Corre tests en modo watch"
	@echo ""
	@echo "  make migrate           Aplica migraciones en la BD de desarrollo"
	@echo "  make migrate-test      Aplica migraciones en la BD de testing"
	@echo ""

# ── Desarrollo ───────────────────────────────────────────────
dev:
	npm run start:dev

build:
	npm run build

# ── Tests ────────────────────────────────────────────────────

# Tests de integración — usan .env.test si existe, sino .env
test:
	npx jest --config ./test/jest-e2e.json \
		--testPathPatterns="flujo-dinamico|flujo-react-bd|graph-interpreter|graph-complejo|multi-campo" \
		--verbose --forceExit

test-integration: test

# Tests unitarios — sin LLM real ni BD, mocks de ChatGoogleGenerativeAI y fetch
test-unit:
	npx jest --testPathPatterns="graph-interpreter.spec" \
		--verbose --forceExit

# Tests de los tres nuevos features multi-campo: unit + e2e
test-multi-campo:
	@echo "=== Unit tests (sin LLM) ==="
	npx jest --testPathPatterns="graph-interpreter.spec" --verbose --forceExit
	@echo "=== E2E tests (LLM real + BD) ==="
	npx jest --config ./test/jest-e2e.json \
		--testPathPatterns="multi-campo" --verbose --forceExit

test-watch:
	npx jest --config ./test/jest-e2e.json \
		--testPathPatterns="flujo-dinamico|flujo-react-bd|graph-interpreter|graph-complejo|multi-campo" \
		--verbose --watch

# Correr un suite específico: make test-suite SUITE=graph-complejo
test-suite:
	npx jest --config ./test/jest-e2e.json \
		--testPathPatterns="$(SUITE)" \
		--verbose --forceExit

# ── Base de datos ────────────────────────────────────────────
migrate:
	npx prisma migrate deploy

migrate-test:
	@if [ ! -f $(ENV_TEST_FILE) ]; then \
		echo "Error: no existe $(ENV_TEST_FILE)"; exit 1; \
	fi
	@export $$(grep -v '^#' $(ENV_TEST_FILE) | xargs) && \
		npx prisma migrate deploy

db-generate:
	npx prisma generate

seed-clinica:
	npx ts-node prisma/seed-clinica.ts

seed-clinica-clean:
	npx ts-node prisma/seed-clinica.ts --clean
