# ============================================================
# SaaS API — comandos de desarrollo
# ============================================================

.PHONY: help dev reset schema seed

ENV_FILE ?= .env

# Carga DATABASE_URL del .env y corre psql
PSQL = export $$(grep -v '^\#' $(ENV_FILE) | xargs) && psql "$$DATABASE_URL" --no-psqlrc -v ON_ERROR_STOP=1

# ── Ayuda ─────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Comandos disponibles:"
	@echo ""
	@echo "  make dev      Inicia el servidor en modo desarrollo"
	@echo ""
	@echo "  make reset    Elimina y recrea las tablas, luego carga el seed"
	@echo "  make schema   Solo aplica el schema (con DROP previo)"
	@echo "  make seed     Solo carga el seed (sin tocar la estructura)"
	@echo ""
	@echo "Variables:"
	@echo "  ENV_FILE=.env (por defecto)"
	@echo ""

# ── Desarrollo ────────────────────────────────────────────────────────────────

dev:
	npm run dev

# ── Base de datos ─────────────────────────────────────────────────────────────

schema:
	@echo "→ Aplicando schema..."
	@$(PSQL) -f sql/schema.sql
	@echo "✓ Schema aplicado"

seed:
	@echo "→ Cargando seed..."
	@$(PSQL) -f sql/seed.sql
	@echo "✓ Seed cargado"

reset: schema seed
	@echo "✓ Base de datos reseteada"
