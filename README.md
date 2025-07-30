# RegLite

Веб-интерфейс для управления Docker Registry.

![License](https://img.shields.io/badge/license-MIT-green)

## Описание

RegLite предоставляет простой веб-интерфейс для работы с Docker Registry вместо команд `curl`. Поддерживает работу с несколькими реестрами одновременно.

**Возможности:**
- Просмотр списка реестров с проверкой доступности
- Просмотр репозиториев и тегов
- Получение информации о размере репозиториев
- Просмотр манифестов образов
- Удаление образов по digest
- Автоматическая интеграция с Docker CLI
- Поддержка приватных и публичных реестров

## Быстрый старт

### Вариант 1: Готовый бинарь

1. **Скачайте под вашу платформу**: [Releases](https://github.com/bakharevd/reglite/releases)

2. **Создайте конфигурацию** `inventory.yaml`:
   ```yaml
   inventory:
     my-registry:
       url: http://localhost:5000
       # username/password опциональны если уже авторизованы через docker login
   ```

3. **Запустите**:
   ```bash
   ./reglite -config=inventory.yaml -port=8080
   ```

### Вариант 2: Docker

**Docker Hub:**
```bash
docker run -d \
  --name reglite \
  -p 8080:8080 \
  -v ~/.docker:/root/.docker:ro \
  -v $(pwd)/inventory.yaml:/app/inventory.yaml \
  sbakharevd/reglite:latest
```

**GitHub Packages:**
```bash
docker run -d \
  --name reglite \
  -p 8080:8080 \
  -v ~/.docker:/root/.docker:ro \
  -v $(pwd)/inventory.yaml:/app/inventory.yaml \
  ghcr.io/bakharevd/reglite:latest
```

После запуска откройте: http://localhost:8080

## Настройка реестров

### Простой случай

Если вы уже авторизованы через `docker login`, то RegLite автоматически найдет ваши реестры:

```bash
docker login your-registry.com
./reglite  # inventory.yaml даже не нужен!
```

### Ручная настройка

Создайте `inventory.yaml`:

```yaml
inventory:
  # Локальный реестр без авторизации
  local:
    url: http://localhost:5000
    
  # Приватный реестр с логином/паролем  
  company:
    url: https://registry.company.com
    username: myuser
    password: mypass
    
  # Docker Hub (для приватных образов)
  dockerhub:
    url: https://registry-1.docker.io
    username: dockeruser
    password: dockerpass
```

### Приоритет авторизации

1. Логин/пароль из `inventory.yaml`
2. Токены из `~/.docker/config.json`
3. Без авторизации (для публичных реестров)

## API

Доступные эндпоинты для программного доступа:

```bash
# Проверка работоспособности
GET /api/v1/health

# Список реестров
GET /api/v1/registries

# Реестры с информацией о статусе
GET /api/v1/registries/status

# Валидация доступности реестров
POST /api/v1/registries/validate

# Репозитории реестра
GET /api/v1/repositories?registry={registry}

# Информация о репозитории (включая размер)
GET /api/v1/repository/info?registry={registry}&repository={repo}

# Теги репозитория
GET /api/v1/tags?registry={registry}&repository={repo}

# Манифест образа
GET /api/v1/manifest?registry={registry}&repository={repo}&tag={tag}

# Удаление образа
DELETE /api/v1/manifest?registry={registry}&repository={repo}&digest={digest}
```

## Разработка

Хотите что-то улучшить? Читайте [CONTRIBUTING.md](CONTRIBUTING.md)

---

Инструмент для работы с Docker Registry через веб-интерфейс 