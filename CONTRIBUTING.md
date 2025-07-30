# Участие в разработке RegLite

Любой вклад в развитие проекта приветствуется.

## Как начать

### Настройка окружения

```bash
# Клонируйте репозиторий
git clone https://github.com/bakharevd/reglite.git
cd reglite

# Установите зависимости
make deps

# Запустите в режиме разработки
make dev
```

### Полезные команды

```bash
# Запуск с автоперезагрузкой (с флагом -debug)
make dev

# Обычный запуск
make run

# Проверки кода (форматирование, линтинг)
make check

# Форматирование кода  
make fmt

# Линтинг
make lint

# Сборка под все платформы
make build-all

# Сборка Docker образа
make docker-build
```

## Структура проекта

```
reglite/
├── cmd/reglite/
│   └── main.go                # Точка входа, настройка Gin, роутинг
├── internal/                  # Приватная логика приложения
│   ├── config/
│   │   └── config.go         # Загрузка YAML + Docker config.json
│   ├── handlers/
│   │   └── handlers.go       # HTTP обработчики API + веб-интерфейс
│   └── registry/
│       └── client.go         # HTTP клиент для Docker Registry API v2
├── web/                      # Веб-интерфейс
│   ├── static/
│   │   ├── app.js           # JavaScript (SPA логика)
│   │   └── style.css        # CSS стили
│   └── templates/
│       └── index.html       # HTML шаблон (один файл)
├── go.mod                   # Go 1.24, Gin, YAML зависимости
├── go.sum
├── Dockerfile               # Multi-stage build, Alpine-based
├── Makefile                 # Команды разработки и сборки
├── inventory.example.yaml   # Пример конфигурации реестров
├── README.md
└── .gitignore
```

## Технологический стек

### Backend
- **Go 1.24** - основной язык
- **Gin Web Framework** - HTTP роутер и middleware
- **YAML v3** - парсинг конфигурации
- **Docker Registry API v2** - взаимодействие с реестрами

### Frontend  
- **Vanilla JavaScript** - SPA без фреймворков
- **CSS Grid/Flexbox** - адаптивная верстка
- **Font Awesome** - иконки

### API Endpoints

```
GET  /                                                     # Веб-интерфейс
GET  /api/v1/health                                        # Healthcheck
GET  /api/v1/registries                                    # Список реестров
GET  /api/v1/registries/status                             # Реестры со статусом
POST /api/v1/registries/validate                           # Валидация реестров
GET  /api/v1/repositories?registry={registry}              # Репозитории
GET  /api/v1/repository/info?registry={registry}&repo={repo} # Информация о репозитории
GET  /api/v1/tags?registry={registry}&repo={repo}          # Теги
GET  /api/v1/manifest?registry={registry}&repo={repo}&tag={tag} # Манифест
DELETE /api/v1/manifest?registry={registry}&repo={repo}&digest={digest} # Удаление
```

## Что можно улучшить

### Основные недостатки
- Отсутствуют тесты
- Нет валидации конфигурации `inventory.yaml`
- Простая обработка ошибок без retry логики
- Отсутствует CI/CD

### Новые возможности
- Поиск по репозиториям и тегам
- Массовое удаление старых тегов
- Просмотр слоев образа
- Экспорт/импорт конфигурации реестров

### Техническое улучшение
- Unit и integration тесты
- Graceful shutdown HTTP сервера
- Кэширование запросов к реестрам
- Метрики Prometheus
- Structured logging
- OpenAPI документация

## Процесс разработки

### Создание PR

1. **Форк** репозитория
2. **Создайте ветку**: `git checkout -b feature/my-feature`
3. **Сделайте изменения** с понятными коммитами
4. **Запустите проверки**: `make check` (сейчас только форматирование и линтинг)
5. **Протестируйте вручную** с локальным реестром
6. **Создайте Pull Request** с описанием изменений

### Стиль кода

- **Go форматирование**: `make fmt` (обязательно)
- **Линтинг**: `make lint` через `golangci-lint`
- **Комментарии**: все экспортируемые функции должны иметь doc-комментарии
- **Ошибки**: всегда оборачивайте ошибки с контекстом через `fmt.Errorf`

### Коммиты

Используем conventional commits:
```
feat: добавить поиск по репозиториям в веб-интерфейсе
fix: исправить обработку ошибок авторизации Docker Hub  
docs: обновить README с примерами конфигурации
refactor: вынести Docker auth логику в отдельную функцию
test: добавить unit тесты для config пакета
```

## Требования для разработки

- **Go 1.24+** (как в go.mod)
- **Docker** для тестирования с реальными реестрами
- **make** для команд сборки
- **golangci-lint** для линтинга (устанавливается автоматически)

## Локальное тестирование

### Настройка тестового реестра

```bash
# Запустите локальный Docker Registry
docker run -d -p 5000:5000 --name test-registry registry:2

# Добавьте тестовые образы
docker tag alpine localhost:5000/test/alpine:latest
docker tag alpine localhost:5000/test/alpine:v1.0
docker push localhost:5000/test/alpine:latest
docker push localhost:5000/test/alpine:v1.0

# Создайте тестовую конфигурацию
cp inventory.example.yaml inventory.yaml
# Отредактируйте под ваш локальный реестр
```

### Тестирование функций

```bash
# Запустите RegLite
make dev

# Откройте http://localhost:8080
# Протестируйте:
# 1. Список реестров
# 2. Просмотр репозиториев  
# 3. Просмотр тегов
# 4. Получение манифеста
# 5. Удаление тега (осторожно!)
```

### API тестирование

```bash
# Проверьте все endpoints
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/registries
curl http://localhost:8080/api/v1/registries/localhost:5000/repositories
curl http://localhost:8080/api/v1/registries/localhost:5000/repositories/test/alpine/tags
```

## Приоритетные задачи

1. **Добавить тесты** - начните с `internal/config` пакета
2. **CI/CD pipeline** - GitHub Actions для проверки PR
3. **Улучшить error handling** - structured errors, retry логика
4. **Валидация конфигурации** - проверка URL, схем авторизации
5. **Документация API** - OpenAPI/Swagger спецификация

## Вопросы и поддержка

- **GitHub Issues** - для багов и feature requests
- **GitHub Discussions** - для общих вопросов
- **Pull Request** - просто создавайте, обсудим в процессе

---

Спасибо за участие в развитии проекта! 