# 🐳 RegLite

**RegLite** — это легковесный веб-интерфейс для взаимодействия с Docker Registry v2 API. Создан для упрощения управления реестрами, особенно self-hosted и internal, через удобный минималистичный UI.

![Go Version](https://img.shields.io/badge/go-1.24-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker Registry API](https://img.shields.io/badge/Docker%20Registry%20API-v2-orange)

## ✨ Функционал

- 📂 **Просмотр репозиториев** - GET `/v2/_catalog`
- 🏷️ **Просмотр тегов** - GET `/v2/<repo>/tags/list`
- 📋 **Просмотр манифестов** и получения digest
- 🗑️ **Удаление тегов** по digest - DELETE `/v2/<repo>/manifests/<digest>`
- 🔐 **Поддержка авторизации** (Basic Auth)
- 🐳 **Автоматическая загрузка** из `~/.docker/config.json`
- 🌐 **Поддержка нескольких реестров** через YAML конфигурацию
- 📱 **Адаптивный интерфейс**
- ⚡ **Быстрая работа** благодаря минималистичной архитектуре

## 🏗️ Архитектура

- **Backend**: Go 1.24 + Gin framework
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Конфигурация**: YAML файл (`inventory.yaml`) + Docker config.json
- **API**: RESTful API с поддержкой Docker Registry v2

## 🚀 Быстрый старт

### Установка и запуск

1. **Клонируйте репозиторий**:
   ```bash
   git clone git@github.com:bakharevd/reglite.git
   cd reglite
   ```

2. **Создайте свою конфигурацию** на основе примера:
   ```bash
   make config-example
   # отредактируйте inventory.yaml под свои реестры
   ```

3. **Или используйте существующую Docker авторизацию** — RegLite автоматически загрузит реестры из `~/.docker/config.json`!

4. **Установите зависимости**:
   ```bash
   go mod tidy
   ```

5. **Запустите приложение**:
   ```bash
   go run cmd/reglite/main.go -config=inventory.yaml
   ```

6. **Откройте в браузере**: http://localhost:8080

### Опции запуска

```bash
# Основные параметры
go run cmd/reglite/main.go \
  -config="inventory.yaml" \
  -port="8080" \
  -debug

# Или собранный бинарь
./reglite -config=inventory.yaml -port=8080
```

## ⚙️ Конфигурация

### 🐳 Автоматическая загрузка из Docker

RegLite автоматически читает `~/.docker/config.json` и добавляет все авторизованные реестры:

```json
{
  "auths": {
    "88.88.88.88:5000": {
      "auth": "ZG9ja2VyLWtleTog..."
    },
    "registry.company.com": {
      "auth": "dXNlcjpwYXNzd29yZA=="
    }
  }
}
```

### Формат inventory.yaml

```yaml
inventory:
  # Реестр без авторизации
  local-registry:
    url: http://localhost:5000
    
  # Реестр с Basic Auth (username/password)
  secure-registry:
    url: https://registry.example.com
    username: user
    password: pass
    
  # Реестр с Docker auth токеном
  docker-registry:
    url: http://registry.local:5000
    auth: ZG9ja2VyLWtleTo5RDBuWjdwZlh5...==
    
  # Docker Hub (публичные образы)
  docker-hub:
    url: https://registry-1.docker.io
    # username и password опциональны для публичных образов
```

### Приоритет авторизации

1. **Явно указанные** `username` и `password` в YAML
2. **Docker auth токен** из поля `auth` в YAML
3. **Автоматически загруженные** из `~/.docker/config.json`

### Переменные окружения

```bash
# Альтернативная конфигурация через ENV
export REGLITE_CONFIG_FILE=inventory.yaml
export REGLITE_PORT=8080
export REGLITE_DEBUG=false
```

## 📋 API Документация

### Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/v1/health` | Проверка здоровья сервиса |
| `GET` | `/api/v1/registries` | Список доступных реестров |
| `GET` | `/api/v1/registries/{registry}/repositories` | Список репозиториев в реестре |
| `GET` | `/api/v1/registries/{registry}/repositories/{repo}/tags` | Список тегов репозитория |
| `GET` | `/api/v1/registries/{registry}/repositories/{repo}/tags/{tag}/manifest` | Манифест тега |
| `DELETE` | `/api/v1/registries/{registry}/repositories/{repo}/manifests/{digest}` | Удаление по digest |

### Примеры использования

```bash
# Получить список реестров
curl http://localhost:8080/api/v1/registries

# Получить репозитории
curl http://localhost:8080/api/v1/registries/88.88.88.88:5000/repositories

# Получить теги репозитория
curl http://localhost:8080/api/v1/registries/88.88.88.88:5000/repositories/my-app/tags

# Получить манифест тега
curl http://localhost:8080/api/v1/registries/88.88.88.88:5000/repositories/my-app/tags/latest/manifest

# Удалить тег по digest
curl -X DELETE http://localhost:8080/api/v1/registries/88.88.88.88:5000/repositories/my-app/manifests/sha256:abc123...
```

## 🐳 Docker

### Использование готового образца

```bash
# Запуск с volume для конфигурации и Docker credentials
docker run -d \
  --name reglite \
  -p 8080:8080 \
  -v $(pwd)/inventory.yaml:/app/inventory.yaml \
  -v ~/.docker:/root/.docker:ro \
  reglite:latest
```

### Сборка собственного образа

```bash
# Сборка и запуск
docker build -t reglite .
docker run -p 8080:8080 -v ~/.docker:/root/.docker:ro reglite
```

## 🔧 Разработка

### Структура проекта

```
reglite/
├── cmd/reglite/           # Точка входа приложения
│   └── main.go
├── internal/              # Внутренняя логика
│   ├── config/           # Конфигурация + Docker config.json
│   ├── handlers/         # HTTP handlers
│   └── registry/         # Docker Registry клиент
├── web/                  # Веб-интерфейс
│   ├── static/           # CSS, JS, изображения
│   └── templates/        # HTML шаблоны
├── go.mod                # Go модуль
├── inventory.yaml        # Конфигурация реестров (в .gitignore)
├── inventory.example.yaml # Пример для пользователей
└── README.md
```

### Требования для разработки

- Go 1.24+
- Доступ к Docker Registry для тестирования

### Сборка

```bash
# Сборка для текущей платформы
go build -o reglite cmd/reglite/main.go

# Сборка для разных платформ
GOOS=linux GOARCH=amd64 go build -o reglite-linux-amd64 cmd/reglite/main.go
GOOS=windows GOARCH=amd64 go build -o reglite-windows-amd64.exe cmd/reglite/main.go
GOOS=darwin GOARCH=amd64 go build -o reglite-darwin-amd64 cmd/reglite/main.go
```

### Тестирование

```bash
# Запуск тестов
go test ./...

# Тесты с покрытием
go test -cover ./...

# Benchmark тесты
go test -bench=. ./...
```

## 🛡️ Безопасность

### Рекомендации

1. **HTTPS**: Используйте HTTPS для продакшена
2. **Авторизация**: Настройте Basic Auth для доступа к реестрам
3. **Сетевая изоляция**: Ограничьте доступ к RegLite через firewall
4. **Credentials**: Используйте Docker config.json или переменные окружения

### Пример безопасной конфигурации

```yaml
inventory:
  production-registry:
    url: https://registry.company.com
    username: ${REGISTRY_USER}     # Используйте переменные окружения
    password: ${REGISTRY_PASSWORD} # для чувствительных данных
```

### Работа с Docker credentials

```bash
# Авторизация в реестре через Docker CLI
docker login 88.88.88.88:5000

# RegLite автоматически подхватит авторизацию
./reglite

# Проверить что RegLite видит авторизованные реестры
curl http://localhost:8080/api/v1/registries
```

## 🤝 Участие в разработке

1. Форкните репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

**RegLite** - сделано с ❤️ для Docker сообщества 