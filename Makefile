.PHONY: up down fmt lint
up:
\tdocker compose -f infra/docker-compose.yml up --build
down:
\tdocker compose -f infra/docker-compose.yml down
