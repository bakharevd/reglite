.PHONY: help build run test clean docker docker-build docker-run dev fmt lint deps update-deps

# Основные переменные
BINARY_NAME=reglite
DOCKER_IMAGE=reglite
DOCKER_TAG=latest
CONFIG_FILE=inventory.yaml
PORT=8080
DIST_DIR=dist

# Docker Hub настройки
DOCKERHUB_USER=sbakharevd
DOCKER_REPO=$(DOCKERHUB_USER)/$(DOCKER_IMAGE)

# GitHub Container Registry настройки
GITHUB_USER=bakharevd
GITHUB_REPO=ghcr.io/$(GITHUB_USER)/$(DOCKER_IMAGE)

# Git информация
GIT_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
GIT_COMMIT := $(shell git rev-parse --short HEAD)

# Платформы для сборки
PLATFORMS=linux/amd64,linux/arm64

help: ## Показать это сообщение помощи
	@echo "RegLite - Docker Registry Web UI"
	@echo ""
	@echo "Доступные команды:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# === РАЗРАБОТКА ===

dev: ## Запустить в режиме разработки с авто-перезагрузкой
	@echo "Запуск RegLite в режиме разработки..."
	go run cmd/reglite/main.go -config=$(CONFIG_FILE) -port=$(PORT) -debug

run: ## Запустить приложение
	@echo "Запуск RegLite на порту $(PORT)..."
	go run cmd/reglite/main.go -config=$(CONFIG_FILE) -port=$(PORT)

# === СБОРКА ===

build: ## Собрать приложение
	@echo "Сборка RegLite..."
	go build -ldflags "-X main.version=$(GIT_TAG) -X main.commit=$(GIT_COMMIT)" -o $(BINARY_NAME) cmd/reglite/main.go

build-all: ## Собрать для всех платформ
	@echo "Сборка для всех платформ..."
	@mkdir -p $(DIST_DIR)
	GOOS=linux GOARCH=amd64 go build -ldflags "-X main.version=$(GIT_TAG) -X main.commit=$(GIT_COMMIT)" -o $(DIST_DIR)/$(BINARY_NAME)-linux-amd64 cmd/reglite/main.go
	GOOS=linux GOARCH=arm64 go build -ldflags "-X main.version=$(GIT_TAG) -X main.commit=$(GIT_COMMIT)" -o $(DIST_DIR)/$(BINARY_NAME)-linux-arm64 cmd/reglite/main.go
	GOOS=darwin GOARCH=amd64 go build -ldflags "-X main.version=$(GIT_TAG) -X main.commit=$(GIT_COMMIT)" -o $(DIST_DIR)/$(BINARY_NAME)-darwin-amd64 cmd/reglite/main.go
	GOOS=darwin GOARCH=arm64 go build -ldflags "-X main.version=$(GIT_TAG) -X main.commit=$(GIT_COMMIT)" -o $(DIST_DIR)/$(BINARY_NAME)-darwin-arm64 cmd/reglite/main.go
	GOOS=windows GOARCH=amd64 go build -ldflags "-X main.version=$(GIT_TAG) -X main.commit=$(GIT_COMMIT)" -o $(DIST_DIR)/$(BINARY_NAME)-windows-amd64.exe cmd/reglite/main.go

install: build ## Установить бинарник в GOPATH/bin
	@echo "Установка $(BINARY_NAME)..."
	go install cmd/reglite/main.go

# === ТЕСТИРОВАНИЕ И КАЧЕСТВО КОДА ===

test: ## Запустить тесты
	@echo "Запуск тестов..."
	go test -v ./...

test-coverage: ## Запустить тесты с покрытием
	@echo "Запуск тестов с покрытием..."
	go test -v -cover -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Отчет о покрытии создан: coverage.html"

benchmark: ## Запустить бенчмарки
	@echo "Запуск бенчмарков..."
	go test -bench=. -benchmem ./...

fmt: ## Форматировать код
	@echo "Форматирование кода..."
	go fmt ./...
	gofmt -s -w .

lint: ## Запустить линтер
	@echo "Запуск линтера..."
	golangci-lint run

vet: ## Запустить go vet
	@echo "Запуск go vet..."
	go vet ./...

check: fmt vet lint test ## Запустить все проверки

# === DOCKER ===

docker-build: ## Собрать Docker образ
	@echo "Сборка Docker образа..."
	docker build -t $(DOCKER_REPO):$(DOCKER_TAG) -t $(DOCKER_REPO):$(GIT_TAG) .

docker-build-multiarch: ## Собрать мультиплатформенный Docker образ
	@echo "Сборка мультиплатформенного Docker образа..."
	docker buildx build --platform $(PLATFORMS) -t $(DOCKER_REPO):$(DOCKER_TAG) -t $(DOCKER_REPO):$(GIT_TAG) .

docker-push: docker-build ## Собрать и отправить Docker образ в DockerHub
	@echo "Отправка Docker образа в DockerHub..."
	docker push $(DOCKER_REPO):$(DOCKER_TAG)
	docker push $(DOCKER_REPO):$(GIT_TAG)

docker-push-multiarch: docker-build-multiarch ## Собрать и отправить мультиплатформенный образ
	@echo "Отправка мультиплатформенного Docker образа..."
	docker buildx build --platform $(PLATFORMS) --push -t $(DOCKER_REPO):$(DOCKER_TAG) -t $(DOCKER_REPO):$(GIT_TAG) .

# === GITHUB PACKAGES ===

github-build: ## Собрать Docker образ для GitHub Packages
	@echo "Сборка Docker образа для GitHub Packages..."
	docker build -t $(GITHUB_REPO):$(DOCKER_TAG) -t $(GITHUB_REPO):$(GIT_TAG) .

github-build-multiarch: ## Собрать мультиплатформенный Docker образ для GitHub Packages
	@echo "Сборка мультиплатформенного Docker образа для GitHub Packages..."
	docker buildx build --platform $(PLATFORMS) -t $(GITHUB_REPO):$(DOCKER_TAG) -t $(GITHUB_REPO):$(GIT_TAG) .

github-push: github-build ## Собрать и отправить Docker образ в GitHub Packages
	@echo "Отправка Docker образа в GitHub Packages..."
	@echo "Убедитесь что вы авторизованы: docker login ghcr.io -u $(GITHUB_USER)"
	docker push $(GITHUB_REPO):$(DOCKER_TAG)
	docker push $(GITHUB_REPO):$(GIT_TAG)

github-push-multiarch: github-build-multiarch ## Собрать и отправить мультиплатформенный образ в GitHub Packages
	@echo "Отправка мультиплатформенного Docker образа в GitHub Packages..."
	@echo "Убедитесь что вы авторизованы: docker login ghcr.io -u $(GITHUB_USER)"
	docker buildx build --platform $(PLATFORMS) --push -t $(GITHUB_REPO):$(DOCKER_TAG) -t $(GITHUB_REPO):$(GIT_TAG) .

github-login: ## Авторизация в GitHub Container Registry
	@echo "Авторизация в GitHub Container Registry..."
	@echo "Потребуется GitHub Personal Access Token с правами write:packages"
	@docker login ghcr.io -u $(GITHUB_USER)

publish-all: docker-push-multiarch github-push-multiarch ## Опубликовать в Docker Hub и GitHub Packages

docker-run: ## Запустить Docker контейнер
	@echo "Запуск Docker контейнера..."
	docker run -d \
		--name $(BINARY_NAME) \
		-p $(PORT):8080 \
		-v $(PWD)/$(CONFIG_FILE):/app/inventory.yaml \
		-v $$HOME/.docker:/root/.docker:ro \
		$(DOCKER_REPO):$(DOCKER_TAG)

docker-stop: ## Остановить Docker контейнер
	@echo "Остановка Docker контейнера..."
	docker stop $(BINARY_NAME) || true
	docker rm $(BINARY_NAME) || true

docker-logs: ## Показать логи Docker контейнера
	docker logs -f $(BINARY_NAME)

docker-shell: ## Открыть shell в Docker контейнере
	docker exec -it $(BINARY_NAME) sh

# === ЗАВИСИМОСТИ ===

deps: ## Скачать зависимости
	@echo "Скачивание зависимостей..."
	go mod download

tidy: ## Очистить зависимости
	@echo "Очистка зависимостей..."
	go mod tidy

update-deps: ## Обновить зависимости
	@echo "Обновление зависимостей..."
	go get -u ./...
	go mod tidy

# === РЕЛИЗ ===

release: clean build-all ## Создать релизную сборку
	@echo "Создание релиза..."
	@mkdir -p $(DIST_DIR)
	cp README.md $(DIST_DIR)/
	cp inventory.example.yaml $(DIST_DIR)/inventory.example.yaml
	cd $(DIST_DIR) && \
	tar -czf $(BINARY_NAME)-linux-amd64.tar.gz $(BINARY_NAME)-linux-amd64 README.md inventory.example.yaml && \
	tar -czf $(BINARY_NAME)-linux-arm64.tar.gz $(BINARY_NAME)-linux-arm64 README.md inventory.example.yaml && \
	tar -czf $(BINARY_NAME)-darwin-amd64.tar.gz $(BINARY_NAME)-darwin-amd64 README.md inventory.example.yaml && \
	tar -czf $(BINARY_NAME)-darwin-arm64.tar.gz $(BINARY_NAME)-darwin-arm64 README.md inventory.example.yaml && \
	zip $(BINARY_NAME)-windows-amd64.zip $(BINARY_NAME)-windows-amd64.exe README.md inventory.example.yaml
	@echo "Релиз создан в директории $(DIST_DIR)/"

# === УТИЛИТЫ ===

health: ## Проверить работает ли приложение
	@curl -f http://localhost:$(PORT)/api/v1/health || echo "Приложение не запущено"

generate: ## Генерировать код (если нужно)
	@echo "Генерация кода..."
	go generate ./...

clean: ## Очистить артефакты сборки
	@echo "Очистка..."
	rm -f $(BINARY_NAME)
	rm -rf $(DIST_DIR)/
	rm -f coverage.out coverage.html
	rm -f *.prof

clean-docker: ## Очистить Docker образы и контейнеры
	@echo "Очистка Docker артефактов..."
	docker stop $(BINARY_NAME) || true
	docker rm $(BINARY_NAME) || true
	docker rmi $(DOCKER_REPO):$(DOCKER_TAG) || true
	docker rmi $(DOCKER_REPO):$(GIT_TAG) || true

.DEFAULT_GOAL := help 