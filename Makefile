.PHONY: up down check env-check

up:
	docker compose up --build -d

down:
	docker compose down

check:
	bash bin/check

env-check:
	docker compose exec web php bin/console env:check
