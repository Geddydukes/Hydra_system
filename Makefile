# Use a login shell so PATH from your profile is loaded (fixes Docker not found in Make)
SHELL := /bin/zsh
.SHELLFLAGS := -lc

# Detect compose command at runtime: prefer "docker compose", fallback to "docker-compose"
COMPOSE := $(shell (docker compose version >/dev/null 2>&1 && echo "docker compose") || (docker-compose version >/dev/null 2>&1 && echo "docker-compose") || echo "")

COMPOSE_FILE := infra/docker-compose.yml

.PHONY: up down logs rebuild doctor

up:
	@if [ -z "$(COMPOSE)" ]; then echo "❌ Docker Compose not found in PATH (inside make). Try opening a NEW terminal or ensure Docker Desktop is running."; exit 127; fi
	@$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

down:
	@if [ -z "$(COMPOSE)" ]; then echo "❌ Docker Compose not found in PATH (inside make)."; exit 127; fi
	@$(COMPOSE) -f $(COMPOSE_FILE) down

logs:
	@if [ -z "$(COMPOSE)" ]; then echo "❌ Docker Compose not found in PATH (inside make)."; exit 127; fi
	@$(COMPOSE) -f $(COMPOSE_FILE) logs -f

rebuild:
	@if [ -z "$(COMPOSE)" ]; then echo "❌ Docker Compose not found in PATH (inside make)."; exit 127; fi
	@$(COMPOSE) -f $(COMPOSE_FILE) build --no-cache

# Debug helper: see what Make sees for PATH and docker
doctor:
	@echo "SHELL           = $(SHELL)"
	@echo ".SHELLFLAGS     = $(.SHELLFLAGS)"
	@echo "PATH            = $$PATH"
	@echo "docker path     = $$(command -v docker || echo 'not found')"
	@echo "compose command = $(COMPOSE)"
	@echo "docker version  = $$(docker version --format '{{.Client.Version}}' 2>/dev/null || echo 'not available')"
	@echo "compose version = $$($(COMPOSE) version 2>/dev/null || echo 'not available')"
