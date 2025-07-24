.PHONY: help build run test clean docker docker-build docker-run dev fmt lint deps update-deps

BINARY_NAME=reglite
DOCKER_IMAGE=reglite
DOCKER_TAG=latest
CONFIG_FILE=inventory.yaml
PORT=8080

help: ## Show this help message
	@echo "RegLite - Docker Registry Web UI"
	@echo ""
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	@echo "Building RegLite..."
	go build -o $(BINARY_NAME) cmd/reglite/main.go

build-all: ## Build for all platforms
	@echo "Building for all platforms..."
	GOOS=linux GOARCH=amd64 go build -o dist/$(BINARY_NAME)-linux-amd64 cmd/reglite/main.go
	GOOS=linux GOARCH=arm64 go build -o dist/$(BINARY_NAME)-linux-arm64 cmd/reglite/main.go
	GOOS=darwin GOARCH=amd64 go build -o dist/$(BINARY_NAME)-darwin-amd64 cmd/reglite/main.go
	GOOS=darwin GOARCH=arm64 go build -o dist/$(BINARY_NAME)-darwin-arm64 cmd/reglite/main.go
	GOOS=windows GOARCH=amd64 go build -o dist/$(BINARY_NAME)-windows-amd64.exe cmd/reglite/main.go

run: ## Run the application
	@echo "Starting RegLite on port $(PORT)..."
	go run cmd/reglite/main.go -config=$(CONFIG_FILE) -port=$(PORT)

dev: ## Run in development mode with auto-reload
	@echo "Starting RegLite in development mode..."
	go run cmd/reglite/main.go -config=$(CONFIG_FILE) -port=$(PORT) -debug

test: ## Run tests
	@echo "Running tests..."
	go test -v ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	go test -v -cover -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

benchmark: ## Run benchmark tests
	@echo "Running benchmarks..."
	go test -bench=. -benchmem ./...

fmt: ## Format code
	@echo "Formatting code..."
	go fmt ./...
	gofmt -s -w .

lint: ## Run linter
	@echo "Running linter..."
	golangci-lint run

vet: ## Run go vet
	@echo "Running go vet..."
	go vet ./...

check: fmt vet lint test ## Run all checks

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	go mod download

tidy: ## Clean up dependencies
	@echo "Tidying up dependencies..."
	go mod tidy

update-deps: ## Update dependencies
	@echo "Updating dependencies..."
	go get -u ./...
	go mod tidy

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

docker-run: ## Run Docker container
	@echo "Running Docker container..."
	docker run -d \
		--name $(BINARY_NAME) \
		-p $(PORT):8080 \
		-v $(PWD)/$(CONFIG_FILE):/app/inventory.yaml \
		-v $$HOME/.docker:/root/.docker:ro \
		$(DOCKER_IMAGE):$(DOCKER_TAG)

docker-stop: ## Stop Docker container
	@echo "Stopping Docker container..."
	docker stop $(BINARY_NAME) || true
	docker rm $(BINARY_NAME) || true

docker-logs: ## Show Docker container logs
	docker logs -f $(BINARY_NAME)

docker-shell: ## Open shell in Docker container
	docker exec -it $(BINARY_NAME) sh

clean: ## Clean build artifacts
	@echo "Cleaning up..."
	rm -f $(BINARY_NAME)
	rm -rf dist/
	rm -f coverage.out coverage.html
	rm -f *.prof

clean-docker: ## Clean Docker images and containers
	@echo "Cleaning Docker artifacts..."
	docker stop $(BINARY_NAME) || true
	docker rm $(BINARY_NAME) || true
	docker rmi $(DOCKER_IMAGE):$(DOCKER_TAG) || true

release: clean build-all ## Create release builds
	@echo "Creating release..."
	mkdir -p dist
	cp README.md dist/
	cp inventory.example.yaml dist/inventory.example.yaml
	tar -czf dist/$(BINARY_NAME)-linux-amd64.tar.gz -C dist $(BINARY_NAME)-linux-amd64 README.md inventory.example.yaml
	tar -czf dist/$(BINARY_NAME)-linux-arm64.tar.gz -C dist $(BINARY_NAME)-linux-arm64 README.md inventory.example.yaml
	tar -czf dist/$(BINARY_NAME)-darwin-amd64.tar.gz -C dist $(BINARY_NAME)-darwin-amd64 README.md inventory.example.yaml
	tar -czf dist/$(BINARY_NAME)-darwin-arm64.tar.gz -C dist $(BINARY_NAME)-darwin-arm64 README.md inventory.example.yaml
	zip -j dist/$(BINARY_NAME)-windows-amd64.zip dist/$(BINARY_NAME)-windows-amd64.exe dist/README.md dist/inventory.example.yaml

install: build ## Install binary to GOPATH/bin
	@echo "Installing $(BINARY_NAME)..."
	go install cmd/reglite/main.go

uninstall: ## Remove binary from GOPATH/bin
	@echo "Uninstalling $(BINARY_NAME)..."
	rm -f $(GOPATH)/bin/$(BINARY_NAME)

watch: ## Watch for changes and restart (requires entr)
	@echo "Watching for changes..."
	find . -name "*.go" | entr -r make run

serve-docs: ## Serve documentation locally
	@echo "Starting documentation server..."
	@if command -v python3 > /dev/null; then \
		python3 -m http.server 8000; \
	elif command -v python > /dev/null; then \
		python -m SimpleHTTPServer 8000; \
	else \
		echo "Python not found. Install Python to serve docs."; \
	fi

config-example: ## Create example configuration
	@echo "Creating example configuration..."
	cp inventory.example.yaml inventory.yaml

health: ## Check if the application is running
	@curl -f http://localhost:$(PORT)/api/v1/health || echo "Application not running"

generate: ## Generate code (if needed)
	@echo "Generating code..."
	go generate ./... 