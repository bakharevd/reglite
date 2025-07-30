// Основной класс приложения
class RegLiteApp {
    constructor() {
        this.currentRegistry = null;
        this.currentRepository = null;
        this.currentManifest = null;
        this.registriesData = [];
        this.validationInProgress = false;
        this.repositoryInfoCache = new Map(); // Кэш информации о репозиториях
    }

    async init() {
        this.initTheme();
        this.setupEventListeners();
        await this.loadRegistriesWithStatus();
        this.handleInitialRoute();
        
        // Запускаем первичную валидацию
        this.validateRegistries();
    }



    // Обработка начального маршрута из URL
    handleInitialRoute() {
        const params = new URLSearchParams(window.location.search);
        const registry = params.get('registry');
        const repository = params.get('repository');
        
        if (registry && repository) {
            // Если есть и registry, и repository, показываем теги
            this.currentRegistry = registry;
            this.currentRepository = repository;
            this.showTags(registry, repository);
        } else if (registry) {
            // Если есть только registry, показываем репозитории
            this.currentRegistry = registry;
            this.showRepositories(registry);
        } else {
            // Иначе показываем главную страницу
            this.showWelcome();
        }
    }

    // Обновление URL без перезагрузки страницы
    updateURL(registry = null, repository = null) {
        const params = new URLSearchParams();
        
        if (registry) {
            params.set('registry', registry);
        }
        if (repository) {
            params.set('repository', repository);
        }
        
        const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.pushState({registry, repository}, '', newURL);
    }

    // Инициализация темы
    initTheme() {
        const savedTheme = localStorage.getItem('reglite-theme') || 'light';
        this.setTheme(savedTheme);
    }

    // Установка темы
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeIcon = document.getElementById('theme-icon');
        
        if (theme === 'dark') {
            themeIcon.className = 'fas fa-sun';
        } else {
            themeIcon.className = 'fas fa-moon';
        }
        
        localStorage.setItem('reglite-theme', theme);
    }

    // Переключение темы
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setupEventListeners() {
        // Переключатель темы
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Клик на заголовок - возврат на главную
        document.getElementById('header-title').addEventListener('click', () => {
            this.showWelcome();
            this.updateURL(); // Очищаем URL параметры
        });

        // Кнопка "Назад к репозиториям"
        document.getElementById('back-to-repos').addEventListener('click', () => {
            this.showRepositories(this.currentRegistry);
        });

        // Кнопка обновления репозиториев
        document.getElementById('refresh-repositories').addEventListener('click', () => {
            this.refreshRepositories();
        });

        // Кнопка обновления тегов
        document.getElementById('refresh-tags').addEventListener('click', () => {
            this.refreshTags();
        });

        // Кнопка валидации реестров
        document.getElementById('validate-registries').addEventListener('click', () => {
            this.validateRegistries();
        });

        // Настройка поисковых элементов
        this.setupSearchListeners();

        // Обработка браузерной навигации (кнопка "назад")
        window.addEventListener('popstate', (event) => {
            if (event.state) {
                const {registry, repository} = event.state;
                this.currentRegistry = registry;
                this.currentRepository = repository;
                
                if (registry && repository) {
                    this.showTags(registry, repository, false); // false = не обновлять URL
                } else if (registry) {
                    this.showRepositories(registry, false);
                } else {
                    this.showWelcome();
                }
            } else {
                // Если нет состояния в истории, показываем главную
                this.showWelcome();
            }
        });

        // Модальное окно тегов
        const tagModal = document.getElementById('tag-modal');
        const tagCloseButtons = tagModal.querySelectorAll('.close, #close-modal');
        
        tagCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.closeTagModal();
            });
        });

        // Удаление тега
        document.getElementById('delete-tag').addEventListener('click', () => {
            this.deleteTag();
        });

        // Модальное окно репозитория
        const repositoryModal = document.getElementById('repository-modal');
        const repositoryCloseButtons = repositoryModal.querySelectorAll('.close, #close-repository-modal');
        
        repositoryCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.closeRepositoryModal();
            });
        });

        // Просмотр тегов репозитория
        document.getElementById('view-repository-tags').addEventListener('click', () => {
            this.viewRepositoryTags();
        });

        // Закрытие модальных окон при клике вне их
        window.addEventListener('click', (event) => {
            if (event.target === tagModal) {
                this.closeTagModal();
            }
            if (event.target === repositoryModal) {
                this.closeRepositoryModal();
            }
        });

        // Горячие клавиши
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeAllModals();
            }
            
            // Активация поиска в текущей секции
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                this.focusCurrentSearch();
            }
            
            // Альтернативный способ активации поиска клавишей /
            if (event.key === '/' && !event.target.matches('input')) {
                event.preventDefault();
                this.focusCurrentSearch();
            }
        });
    }

    // Настройка поисковых элементов
    setupSearchListeners() {
        // Массив всех поисковых элементов
        const searchElements = [
            { input: 'registries-search', clear: 'registries-clear' },
            { input: 'repositories-search', clear: 'repositories-clear' },
            { input: 'tags-search', clear: 'tags-clear' }
        ];

        searchElements.forEach(({ input, clear }) => {
            const inputElement = document.getElementById(input);
            const clearButton = document.getElementById(clear);

            if (inputElement && clearButton) {
                // Показываем/скрываем кнопку очистки
                inputElement.addEventListener('input', (e) => {
                    if (e.target.value.trim()) {
                        clearButton.style.display = 'flex';
                    } else {
                        clearButton.style.display = 'none';
                    }
                    
                    // Здесь будет логика фильтрации (пока заглушка)
                    this.handleSearch(input, e.target.value);
                });

                // Очистка поиска
                clearButton.addEventListener('click', () => {
                    inputElement.value = '';
                    clearButton.style.display = 'none';
                    inputElement.focus();
                    
                    // Сбрасываем фильтрацию
                    this.handleSearch(input, '');
                });

                // Обработка клавиши Escape
                inputElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        inputElement.value = '';
                        clearButton.style.display = 'none';
                        inputElement.blur();
                        this.handleSearch(input, '');
                    }
                });
            }
        });
    }

    // Обработка поиска
    handleSearch(searchType, query) {
        const searchQuery = query.toLowerCase().trim();
        
        switch (searchType) {
            case 'registries-search':
                this.filterRegistries(searchQuery);
                break;
            case 'repositories-search':
                this.filterRepositories(searchQuery);
                break;
            case 'tags-search':
                this.filterTags(searchQuery);
                break;
            default:
                console.warn('Неизвестный тип поиска:', searchType);
        }
    }

    // Фильтрация реестров
    filterRegistries(searchQuery) {
        const registryItems = document.querySelectorAll('#registries-list .registry-item');
        const registryGroups = document.querySelectorAll('#registries-list .registry-group');
        const registriesCount = document.getElementById('registries-count');
        
        let visibleCount = 0;
        let totalCount = 0;

        // Фильтруем элементы реестров
        registryItems.forEach(item => {
            const registryName = item.getAttribute('data-registry');
            if (!registryName) return;

            totalCount++;
            
            const isVisible = searchQuery === '' || registryName.toLowerCase().includes(searchQuery);
            item.style.display = isVisible ? 'flex' : 'none';
            
            if (isVisible) {
                visibleCount++;
            }
        });

        // Обновляем видимость групп и их счетчики
        registryGroups.forEach(group => {
            const groupItems = group.querySelectorAll('.registry-item');
            const visibleGroupItems = Array.from(groupItems).filter(item => 
                item.style.display !== 'none'
            );
            
            const groupHeader = group.querySelector('.registry-group-header');
            const groupCount = group.querySelector('.registry-group-count');
            
            if (visibleGroupItems.length === 0) {
                group.style.display = 'none';
            } else {
                group.style.display = 'block';
                if (groupCount) {
                    if (searchQuery) {
                        // При поиске показываем количество найденных
                        groupCount.textContent = visibleGroupItems.length;
                    } else {
                        // При сбросе поиска восстанавливаем оригинальный счетчик
                        groupCount.textContent = groupItems.length;
                    }
                }
                
                // Разворачиваем группу если есть поиск
                if (searchQuery && groupHeader) {
                    const groupContent = group.querySelector('.registry-group-content');
                    if (groupContent && groupContent.classList.contains('collapsed')) {
                        groupHeader.classList.remove('collapsed');
                        groupContent.classList.remove('collapsed');
                    }
                }
            }
        });

        // Обновляем счетчик
        if (registriesCount) {
            if (searchQuery) {
                registriesCount.textContent = `Найдено: ${visibleCount} из ${totalCount}`;
                registriesCount.style.display = 'block';
            } else {
                registriesCount.textContent = '';
                registriesCount.style.display = 'none';
            }
        }
    }

    // Фильтрация репозиториев
    filterRepositories(searchQuery) {
        const repositoryCards = document.querySelectorAll('#repositories-list .card');
        const repositoriesCount = document.getElementById('repositories-count');
        
        let visibleCount = 0;
        let totalCount = 0;

        repositoryCards.forEach(card => {
            const repoName = card.querySelector('h4');
            if (!repoName) return;

            const repositoryName = repoName.textContent.trim().replace(/^\s*\S+\s+/, ''); // убираем иконку
            totalCount++;
            
            const isVisible = searchQuery === '' || repositoryName.toLowerCase().includes(searchQuery);
            card.style.display = isVisible ? 'block' : 'none';
            
            if (isVisible) {
                visibleCount++;
            }
        });

        // Обновляем счетчик
        if (repositoriesCount) {
            if (searchQuery) {
                repositoriesCount.textContent = `Найдено: ${visibleCount} из ${totalCount}`;
                repositoriesCount.style.display = 'block';
            } else {
                repositoriesCount.textContent = '';
                repositoriesCount.style.display = 'none';
            }
        }
    }

    // Фильтрация тегов
    filterTags(searchQuery) {
        const tagCards = document.querySelectorAll('#tags-list .card');
        const tagsCount = document.getElementById('tags-count');
        
        let visibleCount = 0;
        let totalCount = 0;

        tagCards.forEach(card => {
            const tagName = card.querySelector('h4');
            if (!tagName) return;

            const tagNameText = tagName.textContent.trim().replace(/^\s*\S+\s+/, ''); // убираем иконку
            totalCount++;
            
            const isVisible = searchQuery === '' || tagNameText.toLowerCase().includes(searchQuery);
            card.style.display = isVisible ? 'block' : 'none';
            
            if (isVisible) {
                visibleCount++;
            }
        });

        // Обновляем счетчик
        if (tagsCount) {
            if (searchQuery) {
                tagsCount.textContent = `Найдено: ${visibleCount} из ${totalCount}`;
                tagsCount.style.display = 'block';
            } else {
                tagsCount.textContent = '';
                tagsCount.style.display = 'none';
            }
        }
    }

    // Очистка всех поисковых полей
    clearAllSearches() {
        const searchInputs = ['registries-search', 'repositories-search', 'tags-search'];
        const clearButtons = ['registries-clear', 'repositories-clear', 'tags-clear'];
        
        searchInputs.forEach((inputId, index) => {
            const input = document.getElementById(inputId);
            const clearBtn = document.getElementById(clearButtons[index]);
            
            if (input) {
                input.value = '';
                // Сбрасываем фильтрацию
                this.handleSearch(inputId, '');
            }
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
        });
    }

    // Очистка конкретного поискового поля
    clearSearch(searchType) {
        const input = document.getElementById(`${searchType}-search`);
        const clearBtn = document.getElementById(`${searchType}-clear`);
        
        if (input) {
            input.value = '';
            // Сбрасываем фильтрацию
            this.handleSearch(`${searchType}-search`, '');
        }
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
    }

    // Фокус на поисковом поле текущей активной секции
    focusCurrentSearch() {
        if (document.getElementById('tags-section').style.display === 'block') {
            const input = document.getElementById('tags-search');
            if (input) input.focus();
        } else if (document.getElementById('repositories-section').style.display === 'block') {
            const input = document.getElementById('repositories-search');
            if (input) input.focus();
        } else {
            const input = document.getElementById('registries-search');
            if (input) input.focus();
        }
    }

    // Закрытие всех модальных окон
    closeAllModals() {
        this.closeTagModal();
        this.closeRepositoryModal();
    }

    // Закрытие модального окна тега
    closeTagModal() {
        const modal = document.getElementById('tag-modal');
        modal.style.display = 'none';
    }

    // Закрытие модального окна репозитория
    closeRepositoryModal() {
        const modal = document.getElementById('repository-modal');
        modal.style.display = 'none';
    }

    // Старый метод для обратной совместимости
    closeModal() {
        this.closeAllModals();
    }

    async loadRegistriesWithStatus() {
        try {
            const response = await fetch('/api/v1/registries/status');
            const data = await response.json();
            
            this.registriesData = data.registries || [];
            this.renderRegistriesWithStatus(this.registriesData);
            return this.registriesData;
        } catch (error) {
            this.showToast('Ошибка загрузки реестров: ' + error.message, 'error');
            // Fallback к старому API
            return await this.loadRegistriesFallback();
        }
    }

    async loadRegistriesFallback() {
        try {
            const response = await fetch('/api/v1/registries');
            const data = await response.json();
            
            // Конвертируем в новый формат
            this.registriesData = data.registries.map(name => ({
                name: name,
                url: '',
                status: 'checking',
                lastChecked: new Date(),
                responseTime: 0,
                errorMessage: ''
            }));
            
            this.renderRegistriesWithStatus(this.registriesData);
            return this.registriesData;
        } catch (error) {
            this.showToast('Ошибка загрузки реестров: ' + error.message, 'error');
            return [];
        }
    }

    async validateRegistries() {
        if (this.validationInProgress) {
            this.showToast('Валидация уже выполняется', 'warning');
            return;
        }

        this.validationInProgress = true;
        const button = document.getElementById('validate-registries');
        const icon = button.querySelector('i');
        const text = button.querySelector('span');
        
        // Обновляем UI кнопки
        button.classList.add('validating');
        button.disabled = true;
        icon.className = 'fas fa-spinner';
        icon.classList.add('checking');
        text.textContent = 'Проверяем...';

        try {
            // Запускаем валидацию
            const response = await fetch('/api/v1/registries/validate', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Ошибка запуска валидации');
            }

            this.showToast('Проверка реестров запущена', 'info');

            // Периодически обновляем статусы
            this.startStatusPolling();

        } catch (error) {
            this.showToast('Ошибка валидации: ' + error.message, 'error');
        } finally {
            // Восстанавливаем кнопку через небольшую задержку
            setTimeout(() => {
                button.classList.remove('validating');
                button.disabled = false;
                icon.className = 'fas fa-sync-alt';
                icon.classList.remove('checking');
                text.textContent = 'Проверить реестры';
                this.validationInProgress = false;
            }, 2000);
        }
    }

    startStatusPolling() {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/v1/registries/status');
                const data = await response.json();
                
                this.registriesData = data.registries || [];
                this.renderRegistriesWithStatus(this.registriesData);

                // Проверяем, закончилась ли валидация
                const hasChecking = this.registriesData.some(reg => reg.status === 'checking');
                if (!hasChecking) {
                    clearInterval(pollInterval);
                    this.showToast('Проверка реестров завершена', 'success');
                }
            } catch (error) {
                console.error('Ошибка опроса статусов:', error);
                clearInterval(pollInterval);
            }
        }, 1000); // Опрашиваем каждую секунду

        // Останавливаем опрос через 30 секунд в любом случае
        setTimeout(() => {
            clearInterval(pollInterval);
        }, 30000);
    }

    renderRegistriesWithStatus(registries) {
        const container = document.getElementById('registries-list');
        const statusCount = document.getElementById('registries-status-count');
        
        if (!registries || registries.length === 0) {
            container.innerHTML = `
                <div class="registry-item" style="cursor: default; opacity: 0.7;" title="Реестры не найдены">
                    <i class="fas fa-info-circle"></i>
                    <span>Реестры не найдены</span>
                </div>
            `;
            statusCount.textContent = '';
            return;
        }

        // Группируем реестры по статусу
        const groupedRegistries = registries.reduce((acc, registry) => {
            const status = registry.status || 'unknown';
            if (!acc[status]) {
                acc[status] = [];
            }
            acc[status].push(registry);
            return acc;
        }, {});

        // Сортировка внутри каждой группы по имени
        Object.keys(groupedRegistries).forEach(status => {
            groupedRegistries[status].sort((a, b) => a.name.localeCompare(b.name));
        });

        // Подсчитываем статистику
        const stats = registries.reduce((acc, reg) => {
            acc[reg.status] = (acc[reg.status] || 0) + 1;
            return acc;
        }, {});

        // Обновляем счетчик статусов
        const statusParts = [];
        if (stats.online) statusParts.push(`${stats.online} доступно`);
        if (stats.offline) statusParts.push(`${stats.offline} недоступно`);
        if (stats.checking) statusParts.push(`${stats.checking} проверяется`);
        statusCount.textContent = statusParts.join(', ');

        // Функция для экранирования HTML
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        // Функция для получения иконки статуса
        const getStatusIcon = (status) => {
            switch (status) {
                case 'online': return 'fas fa-check-circle';
                case 'offline': return 'fas fa-times-circle';
                case 'checking': return 'fas fa-spinner';
                default: return 'fas fa-question-circle';
            }
        };

        // Функция для форматирования времени ответа
        const formatResponseTime = (time) => {
            if (!time || time === 0) return '';
            return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(1)}s`;
        };

        // Функция для рендеринга одного реестра
        const renderRegistry = (registry) => {
            const escapedName = escapeHtml(registry.name);
            const escapedForJs = registry.name.replace(/'/g, "\\'");
            const isDisabled = registry.status === 'offline';
            const isActive = this.currentRegistry === registry.name;
            
            // Создаем информативный tooltip
            const tooltipText = isDisabled && registry.errorMessage ? 
                `${registry.name}\n\nОшибка: ${registry.errorMessage}` : 
                registry.name;
            
            return `
                <div class="registry-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}" 
                     onclick="app.selectRegistry('${escapedForJs}')" 
                     data-registry="${registry.name}" 
                     title="${escapeHtml(tooltipText)}">
                    <div class="registry-status">
                        <i class="registry-status-icon ${registry.status} ${getStatusIcon(registry.status)}"></i>
                        <div class="registry-info">
                            <div class="registry-name">${escapedName}</div>
                            <div class="registry-meta">
                                ${formatResponseTime(registry.responseTime) ? 
                                    `<span class="registry-response-time">${formatResponseTime(registry.responseTime)}</span>` : ''}
                                ${registry.status === 'online' ? '<span>✓ Доступен</span>' : 
                                  registry.status === 'offline' ? '<span>✗ Недоступен</span>' : 
                                  '<span>⏳ Проверяется</span>'}
                            </div>
                            ${registry.errorMessage ? 
                                `<div class="registry-error" title="${escapeHtml(registry.errorMessage)}">${escapeHtml(registry.errorMessage)}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        };

        // Функция для получения названия группы и иконки
        const getGroupInfo = (status) => {
            switch (status) {
                case 'online': return { title: 'Доступные реестры', icon: 'fas fa-check-circle' };
                case 'offline': return { title: 'Недоступные реестры', icon: 'fas fa-times-circle' };
                case 'checking': return { title: 'Проверяемые реестры', icon: 'fas fa-spinner' };
                default: return { title: 'Неизвестные реестры', icon: 'fas fa-question-circle' };
            }
        };

        // Порядок отображения групп
        const statusOrder = ['online', 'checking', 'offline'];
        const groupsHtml = statusOrder
            .filter(status => groupedRegistries[status] && groupedRegistries[status].length > 0)
            .map(status => {
                const group = groupedRegistries[status];
                const groupInfo = getGroupInfo(status);
                // По умолчанию оффлайн реестры свернуты, остальные развернуты
                const defaultCollapsed = status === 'offline';
                const isCollapsed = localStorage.getItem(`registry-group-${status}-collapsed`) === 'true' || 
                                  (localStorage.getItem(`registry-group-${status}-collapsed`) === null && defaultCollapsed);
                
                return `
                    <div class="registry-group">
                        <div class="registry-group-header ${status} ${isCollapsed ? 'collapsed' : ''}" 
                             onclick="app.toggleRegistryGroup('${status}')">
                            <div class="registry-group-title">
                                <i class="${groupInfo.icon}"></i>
                                <span>${groupInfo.title}</span>
                                <div class="registry-group-count">${group.length}</div>
                            </div>
                            <i class="fas fa-chevron-down registry-group-toggle"></i>
                        </div>
                        <div class="registry-group-content ${isCollapsed ? 'collapsed' : ''}" id="registry-group-${status}">
                            ${group.map(renderRegistry).join('')}
                        </div>
                    </div>
                `;
            }).join('');

        container.innerHTML = groupsHtml;
        
        // Применяем текущий поисковый фильтр если есть
        const searchInput = document.getElementById('registries-search');
        if (searchInput && searchInput.value.trim()) {
            this.filterRegistries(searchInput.value.toLowerCase().trim());
        }
    }

    // Переключение видимости группы реестров
    toggleRegistryGroup(status) {
        const header = document.querySelector(`.registry-group-header.${status}`);
        const content = document.getElementById(`registry-group-${status}`);
        
        if (!header || !content) return;
        
        const isCurrentlyCollapsed = header.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            // Разворачиваем группу
            header.classList.remove('collapsed');
            content.classList.remove('collapsed');
            localStorage.setItem(`registry-group-${status}-collapsed`, 'false');
        } else {
            // Сворачиваем группу
            header.classList.add('collapsed');
            content.classList.add('collapsed');
            localStorage.setItem(`registry-group-${status}-collapsed`, 'true');
        }
    }

    // Оставляем старый метод для обратной совместимости
    renderRegistries(registries) {
        // Конвертируем в новый формат и используем новый рендер
        const registriesWithStatus = registries.map(name => ({
            name: name,
            url: '',
            status: 'checking',
            lastChecked: new Date(),
            responseTime: 0,
            errorMessage: ''
        }));
        this.renderRegistriesWithStatus(registriesWithStatus);
    }

    // Показать главную страницу
    showWelcome() {
        document.getElementById('welcome-section').style.display = 'block';
        document.getElementById('repositories-section').style.display = 'none';
        document.getElementById('tags-section').style.display = 'none';
        
        this.currentRegistry = null;
        this.currentRepository = null;
        
        // Очищаем активные элементы
        document.querySelectorAll('#registries-list .registry-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Очищаем поисковые поля
        this.clearAllSearches();
    }

    async selectRegistry(registryName) {
        // Проверяем статус реестра
        const registry = this.registriesData.find(r => r.name === registryName);
        if (registry && registry.status === 'offline') {
            this.showToast(`Реестр "${registryName}" недоступен: ${registry.errorMessage || 'нет соединения'}`, 'error');
            return;
        }

        // Обновляем активный элемент
        document.querySelectorAll('#registries-list .registry-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const selectedItem = document.querySelector(`[data-registry="${registryName}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }
        
        // Очищаем кэш при смене реестра
        if (this.currentRegistry && this.currentRegistry !== registryName) {
            this.clearAllCache();
        }
        
        this.currentRegistry = registryName;
        this.showRepositories(registryName);
    }

    async showRepositories(registryName, updateURL = true) {
        // Показываем секцию репозиториев с плавным переходом
        document.getElementById('welcome-section').style.display = 'none';
        document.getElementById('tags-section').style.display = 'none';
        document.getElementById('repositories-section').style.display = 'block';
        
        // Обновляем URL, если нужно
        if (updateURL) {
            this.updateURL(registryName);
        }
        
        // Обновляем заголовок
        document.getElementById('current-registry').textContent = registryName;
        
        // Очищаем поисковые поля тегов и репозиториев
        this.clearSearch('repositories');
        this.clearSearch('tags');
        
        // Показываем загрузку
        const repositoriesList = document.getElementById('repositories-list');
        repositoriesList.innerHTML = '<div class="loading">Загружаем репозитории...</div>';
        
        try {
            const url = `/api/v1/repositories?registry=${encodeURIComponent(registryName)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки репозиториев');
            }
            
            this.renderRepositories(data.repositories);
        } catch (error) {
            this.showToast('Ошибка загрузки репозиториев: ' + error.message, 'error');
            repositoriesList.innerHTML = `
                <div class="card" style="border-color: var(--danger); background-color: rgba(239, 68, 68, 0.05);">
                    <h4 style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Ошибка</h4>
                    <p>${error.message}</p>
                    <div class="card-meta">
                        <button class="btn btn-danger" onclick="app.showRepositories('${registryName}', true)">
                            <i class="fas fa-redo"></i> Повторить
                        </button>
                    </div>
                </div>
            `;
        }
    }

    renderRepositories(repositories) {
        const container = document.getElementById('repositories-list');
        
        if (!repositories || repositories.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <h4><i class="fas fa-info-circle"></i> Репозитории не найдены</h4>
                    <p>В этом реестре нет доступных репозиториев</p>
                </div>
            `;
            return;
        }

        container.innerHTML = repositories.map(repo => `
            <div class="card repository-card" onclick="app.selectRepository('${repo}')" role="button" tabindex="0" data-repo="${repo}">
                <h4><i class="fas fa-folder"></i> ${repo}</h4>
                <div class="repository-stats loading" id="repo-stats-${repo.replace(/[^a-zA-Z0-9]/g, '_')}">
                    <div class="single-loader">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Загружаем информацию...</span>
                    </div>
                </div>
                <div class="card-meta">
                    <span class="badge badge-primary">Репозиторий</span>
                    <button class="repository-info-btn" onclick="event.stopPropagation(); app.showRepositoryInfo('${repo}')" title="Информация о репозитории">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Добавляем поддержку навигации с клавиатуры
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
        
        // Применяем текущий поисковый фильтр если есть
        const searchInput = document.getElementById('repositories-search');
        if (searchInput && searchInput.value.trim()) {
            this.filterRepositories(searchInput.value.toLowerCase().trim());
        }

        // Асинхронно загружаем информацию о каждом репозитории
        this.loadRepositoriesStats(repositories);
    }

    // Асинхронная загрузка статистики репозиториев
    async loadRepositoriesStats(repositories) {
        const promises = repositories.map(repo => this.loadRepositoryStats(repo));
        
        // Загружаем параллельно, но ограничиваем количество одновременных запросов
        const batchSize = 3;
        for (let i = 0; i < promises.length; i += batchSize) {
            const batch = promises.slice(i, i + batchSize);
            await Promise.allSettled(batch);
        }
    }

    async loadRepositoryStats(repositoryName) {
        try {
            // Сначала получаем только количество тегов
            const tagsCountUrl = `/api/v1/tags?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(repositoryName)}`;
            const tagsResponse = await fetch(tagsCountUrl);
            
            if (!tagsResponse.ok) {
                this.showRepositoryCardError(repositoryName);
                return;
            }
            
            const tagsData = await tagsResponse.json();
            const tagsCount = tagsData.tags ? tagsData.tags.length : 0;
            
            // Если тегов больше 10, показываем только количество тегов с индикатором
            if (tagsCount > 10) {
                this.showRepositoryCardManyTags(repositoryName, tagsCount);
                // Сохраняем в кэш информацию о том, что тегов много
                this.repositoryInfoCache.set(`${this.currentRegistry}/${repositoryName}`, {
                    name: repositoryName,
                    tagsCount: tagsCount,
                    tags: tagsData.tags,
                    manyTags: true
                });
            } else {
                // Если тегов <= 10, получаем полную информацию включая размер
                const infoUrl = `/api/v1/repository/info?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(repositoryName)}`;
                const infoResponse = await fetch(infoUrl);
                
                if (infoResponse.ok) {
                    const data = await infoResponse.json();
                    this.showRepositoryCardComplete(repositoryName, data);
                    // Сохраняем в кэш
                    this.repositoryInfoCache.set(`${this.currentRegistry}/${repositoryName}`, data);
                } else {
                    this.showRepositoryCardError(repositoryName);
                }
            }
        } catch (error) {
            console.error(`Ошибка загрузки статистики для ${repositoryName}:`, error);
            this.showRepositoryCardError(repositoryName);
        }
    }

    // Показывает полную информацию о репозитории (теги + размер)
    showRepositoryCardComplete(repositoryName, repositoryInfo) {
        const repoId = repositoryName.replace(/[^a-zA-Z0-9]/g, '_');
        const statsContainer = document.getElementById(`repo-stats-${repoId}`);
        
        if (statsContainer) {
            const sizeText = this.formatSize(repositoryInfo.totalSize);
            const estimateText = repositoryInfo.isEstimate ? '<small>~</small>' : '';
            
            statsContainer.className = 'repository-stats';
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <i class="fas fa-tags"></i>
                    <span class="stat-label">Теги:</span>
                    <span class="stat-value">${repositoryInfo.tagsCount}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-hdd"></i>
                    <span class="stat-label">Размер:</span>
                    <span class="stat-value">${estimateText}${sizeText}</span>
                </div>
            `;
        }
    }

    // Показывает информацию о репозитории с большим количеством тегов
    showRepositoryCardManyTags(repositoryName, tagsCount) {
        const repoId = repositoryName.replace(/[^a-zA-Z0-9]/g, '_');
        const statsContainer = document.getElementById(`repo-stats-${repoId}`);
        
        if (statsContainer) {
            statsContainer.className = 'repository-stats';
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <i class="fas fa-tags"></i>
                    <span class="stat-label">Теги:</span>
                    <span class="stat-value">${tagsCount}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-hdd"></i>
                    <span class="stat-label">Размер:</span>
                    <span class="stat-value many-tags">
                        <i class="fas fa-info-circle" title="Много тегов - нажмите для подробной информации"></i>
                    </span>
                </div>
            `;
        }
    }

    // Показывает ошибку загрузки информации о репозитории
    showRepositoryCardError(repositoryName) {
        const repoId = repositoryName.replace(/[^a-zA-Z0-9]/g, '_');
        const statsContainer = document.getElementById(`repo-stats-${repoId}`);
        
        if (statsContainer) {
            statsContainer.className = 'repository-stats error';
            statsContainer.innerHTML = `
                <div class="single-loader error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Ошибка загрузки информации</span>
                </div>
            `;
        }
    }

    // Для обратной совместимости
    updateRepositoryCard(repositoryName, repositoryInfo) {
        this.showRepositoryCardComplete(repositoryName, repositoryInfo);
    }

    updateRepositoryCardError(repositoryName) {
        this.showRepositoryCardError(repositoryName);
    }

    updateRepositoryCardManyTags(repositoryName, tagsCount) {
        this.showRepositoryCardManyTags(repositoryName, tagsCount);
    }

    // Асинхронная загрузка статистики тегов
    async loadTagsStats(tags) {
        const promises = tags.map(tag => this.loadTagStats(tag));
        
        // Загружаем параллельно, но ограничиваем количество одновременных запросов
        const batchSize = 4;
        for (let i = 0; i < promises.length; i += batchSize) {
            const batch = promises.slice(i, i + batchSize);
            await Promise.allSettled(batch);
        }
    }

    async loadTagStats(tagName) {
        try {
            const url = `/api/v1/manifest?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(this.currentRepository)}&tag=${encodeURIComponent(tagName)}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (response.ok) {
                this.updateTagCard(tagName, data);
            } else {
                this.updateTagCardError(tagName);
            }
        } catch (error) {
            console.error(`Ошибка загрузки статистики для тега ${tagName}:`, error);
            this.updateTagCardError(tagName);
        }
    }

    updateTagCard(tagName, manifestInfo) {
        const tagId = tagName.replace(/[^a-zA-Z0-9]/g, '_');
        const sizeElement = document.getElementById(`tag-size-${tagId}`);
        const archElement = document.getElementById(`tag-arch-${tagId}`);
        const createdElement = document.getElementById(`tag-created-${tagId}`);
        
        if (sizeElement) {
            sizeElement.className = 'stat-value';
            sizeElement.innerHTML = this.formatSize(manifestInfo.size);
        }
        
        if (archElement) {
            archElement.className = 'stat-value';
            archElement.innerHTML = manifestInfo.architecture || 'N/A';
        }
        
        if (createdElement) {
            createdElement.className = 'stat-value';
            if (manifestInfo.created) {
                try {
                    const date = new Date(manifestInfo.created);
                    createdElement.innerHTML = date.toLocaleDateString('ru-RU');
                } catch {
                    createdElement.innerHTML = 'N/A';
                }
            } else {
                createdElement.innerHTML = 'N/A';
            }
        }
    }

    updateTagCardError(tagName) {
        const tagId = tagName.replace(/[^a-zA-Z0-9]/g, '_');
        const sizeElement = document.getElementById(`tag-size-${tagId}`);
        const archElement = document.getElementById(`tag-arch-${tagId}`);
        const createdElement = document.getElementById(`tag-created-${tagId}`);
        
        [sizeElement, archElement, createdElement].forEach(element => {
            if (element) {
                element.className = 'stat-value error';
                element.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            }
        });
    }

    // Очистка кэша для конкретного реестра
    clearRegistryCache(registryName) {
        const keysToDelete = [];
        for (const key of this.repositoryInfoCache.keys()) {
            if (key.startsWith(`${registryName}/`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.repositoryInfoCache.delete(key));
    }

    // Очистка всего кэша
    clearAllCache() {
        this.repositoryInfoCache.clear();
    }

    // Вспомогательная функция для форматирования размера
    formatSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async selectRepository(repositoryName) {
        this.currentRepository = repositoryName;
        await this.showTags(this.currentRegistry, repositoryName);
    }

    async showRepositoryInfo(repositoryName) {
        const cacheKey = `${this.currentRegistry}/${repositoryName}`;
        let repositoryInfo = this.repositoryInfoCache.get(cacheKey);
        
        // Если данные есть в кэше, но это "manyTags" репозиторий, нужно получить размер
        if (repositoryInfo && repositoryInfo.manyTags) {
            // Показываем индикатор загрузки для получения размера
            const loadingToast = this.showToast('Загружаем размер репозитория...', 'info');
            
            try {
                const url = `/api/v1/repository/info?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(repositoryName)}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (response.ok) {
                    // Обновляем кэшированные данные
                    repositoryInfo = { ...repositoryInfo, ...data, manyTags: false };
                    this.repositoryInfoCache.set(cacheKey, repositoryInfo);
                } else {
                    throw new Error(data.error || 'Ошибка загрузки размера репозитория');
                }
                
                // Убираем toast загрузки
                if (loadingToast && loadingToast.parentNode) {
                    loadingToast.parentNode.removeChild(loadingToast);
                }
            } catch (error) {
                this.showToast('Ошибка загрузки размера: ' + error.message, 'error');
                
                // Убираем toast загрузки при ошибке
                if (loadingToast && loadingToast.parentNode) {
                    loadingToast.parentNode.removeChild(loadingToast);
                }
                
                // Показываем модалку с доступными данными
                this.currentRepository = repositoryName;
                this.showRepositoryModal(repositoryName, repositoryInfo);
                return;
            }
        }
        
        // Если данных нет в кэше, загружаем
        if (!repositoryInfo) {
            const loadingToast = this.showToast('Загружаем информацию о репозитории...', 'info');
            
            try {
                const url = `/api/v1/repository/info?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(repositoryName)}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Ошибка загрузки информации о репозитории');
                }
                
                repositoryInfo = data;
                this.repositoryInfoCache.set(cacheKey, repositoryInfo);
                
                // Убираем toast загрузки
                if (loadingToast && loadingToast.parentNode) {
                    loadingToast.parentNode.removeChild(loadingToast);
                }
            } catch (error) {
                this.showToast('Ошибка загрузки информации о репозитории: ' + error.message, 'error');
                
                // Убираем toast загрузки при ошибке
                if (loadingToast && loadingToast.parentNode) {
                    loadingToast.parentNode.removeChild(loadingToast);
                }
                return;
            }
        }
        
        this.currentRepository = repositoryName;
        this.showRepositoryModal(repositoryName, repositoryInfo);
    }

    showRepositoryModal(repositoryName, repositoryInfo) {
        const modal = document.getElementById('repository-modal');
        const infoContainer = document.getElementById('repository-info');
        
        // Форматируем список тегов (показываем первые несколько и "... ещё X")
        const formatTags = (tags) => {
            if (!tags || tags.length === 0) return 'Нет тегов';
            if (tags.length <= 5) return tags.join(', ');
            return tags.slice(0, 5).join(', ') + ` ... ещё ${tags.length - 5}`;
        };

        // Форматируем размер заранее
        const formattedSize = repositoryInfo.totalSize ? this.formatSize(repositoryInfo.totalSize) : '';
        
        infoContainer.innerHTML = `
            <div class="repository-info">
                <h5><i class="fas fa-folder-open"></i> Информация о репозитории: ${repositoryName}</h5>
                <div class="repository-info-item">
                    <span class="repository-info-label">Имя:</span>
                    <span class="repository-info-value" style="font-family: monospace;">${repositoryInfo.name}</span>
                </div>
                <div class="repository-info-item">
                    <span class="repository-info-label">Количество тегов:</span>
                    <span class="repository-info-value">${repositoryInfo.tagsCount}</span>
                </div>
                <div class="repository-info-item">
                    <span class="repository-info-label">Теги:</span>
                    <span class="repository-info-value">${formatTags(repositoryInfo.tags)}</span>
                </div>
                ${repositoryInfo.totalSize ? `
                <div class="repository-info-item">
                    <span class="repository-info-label">Общий размер:</span>
                    <span class="repository-info-value">
                        ${repositoryInfo.isEstimate ? '<i class="fas fa-tilde" title="Приблизительно"></i> ' : ''}${formattedSize}
                        ${repositoryInfo.isEstimate ? `<br><small style="color: var(--text-muted); font-size: 0.75rem;">(оценка на основе ${repositoryInfo.sampleTagsCount} тегов)</small>` : ''}
                    </span>
                </div>
                ` : ''}
                ${repositoryInfo.description ? `
                <div class="repository-info-item">
                    <span class="repository-info-label">Описание:</span>
                    <span class="repository-info-value">${repositoryInfo.description}</span>
                </div>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'block';
        
        // Фокус на модальном окне для доступности
        const closeButton = modal.querySelector('.close');
        if (closeButton) {
            closeButton.focus();
        }
    }

    viewRepositoryTags() {
        if (this.currentRepository) {
            this.closeRepositoryModal();
            this.selectRepository(this.currentRepository);
        }
    }

    // Обновление списка репозиториев
    async refreshRepositories() {
        if (!this.currentRegistry) {
            this.showToast('Нет активного реестра для обновления', 'warning');
            return;
        }

        const button = document.getElementById('refresh-repositories');
        const icon = button.querySelector('i');
        const originalIcon = icon.className;
        
        // Показываем индикатор обновления
        icon.className = 'fas fa-spinner fa-spin';
        button.disabled = true;

        try {
            // Очищаем кэш для текущего реестра
            this.clearRegistryCache(this.currentRegistry);
            
            this.showToast('Обновляем список репозиториев...', 'info');
            await this.showRepositories(this.currentRegistry, false);
            this.showToast('Список репозиториев обновлен', 'success');
        } catch (error) {
            this.showToast('Ошибка обновления репозиториев: ' + error.message, 'error');
        } finally {
            // Восстанавливаем кнопку
            icon.className = originalIcon;
            button.disabled = false;
        }
    }

    // Обновление списка тегов
    async refreshTags() {
        if (!this.currentRegistry || !this.currentRepository) {
            this.showToast('Нет активного репозитория для обновления', 'warning');
            return;
        }

        const button = document.getElementById('refresh-tags');
        const icon = button.querySelector('i');
        const originalIcon = icon.className;
        
        // Показываем индикатор обновления
        icon.className = 'fas fa-spinner fa-spin';
        button.disabled = true;

        try {
            this.showToast('Обновляем список тегов...', 'info');
            await this.showTags(this.currentRegistry, this.currentRepository, false);
            this.showToast('Список тегов обновлен', 'success');
        } catch (error) {
            this.showToast('Ошибка обновления тегов: ' + error.message, 'error');
        } finally {
            // Восстанавливаем кнопку
            icon.className = originalIcon;
            button.disabled = false;
        }
    }

    async showTags(registryName, repositoryName, updateURL = true) {
        // Показываем секцию тегов
        document.getElementById('repositories-section').style.display = 'none';
        document.getElementById('tags-section').style.display = 'block';
        
        // Обновляем URL, если нужно
        if (updateURL) {
            this.updateURL(registryName, repositoryName);
        }
        
        // Обновляем заголовок
        document.getElementById('current-repository').textContent = repositoryName;
        
        // Очищаем поисковое поле тегов
        this.clearSearch('tags');
        
        // Показываем загрузку
        const tagsList = document.getElementById('tags-list');
        tagsList.innerHTML = '<div class="loading">Загружаем теги...</div>';
        
        try {
            // Используем query параметр для repository для корректной обработки имен с слешами
            const encodedRepo = encodeURIComponent(repositoryName);
            const url = `/api/v1/tags?registry=${encodeURIComponent(registryName)}&repository=${encodedRepo}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки тегов');
            }
            
            this.renderTags(data.tags);
        } catch (error) {
            this.showToast('Ошибка загрузки тегов: ' + error.message, 'error');
            tagsList.innerHTML = `
                <div class="card" style="border-color: var(--danger); background-color: rgba(239, 68, 68, 0.05);">
                    <h4 style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Ошибка</h4>
                    <p>${error.message}</p>
                    <div class="card-meta">
                        <button class="btn btn-danger" onclick="app.showTags('${registryName}', '${repositoryName}', true)">
                            <i class="fas fa-redo"></i> Повторить
                        </button>
                    </div>
                </div>
            `;
        }
    }

    renderTags(tags) {
        const container = document.getElementById('tags-list');
        
        if (!tags || tags.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <h4><i class="fas fa-info-circle"></i> Теги не найдены</h4>
                    <p>В этом репозитории нет доступных тегов</p>
                </div>
            `;
            return;
        }

        // Сортируем теги по времени (новые сначала, если есть информация о времени)
        const sortedTags = [...tags].sort().reverse();

        container.innerHTML = sortedTags.map(tag => `
            <div class="card tag-card" onclick="app.selectTag('${tag}')" role="button" tabindex="0" data-tag="${tag}">
                <h4><i class="fas fa-tag"></i> ${tag}</h4>
                <div class="tag-stats">
                    <div class="stat-item">
                        <i class="fas fa-hdd"></i>
                        <span class="stat-label">Размер:</span>
                        <span class="stat-value loading" id="tag-size-${tag.replace(/[^a-zA-Z0-9]/g, '_')}">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-microchip"></i>
                        <span class="stat-label">Архитектура:</span>
                        <span class="stat-value loading" id="tag-arch-${tag.replace(/[^a-zA-Z0-9]/g, '_')}">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span class="stat-label">Создан:</span>
                        <span class="stat-value loading" id="tag-created-${tag.replace(/[^a-zA-Z0-9]/g, '_')}">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                </div>
                <div class="card-meta">
                    <span class="badge badge-success">Тег</span>
                    <button class="tag-copy-btn" onclick="event.stopPropagation(); app.copyDockerPullCommand('${tag.replace(/'/g, "\\'")}')" title="Скопировать команду docker pull">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Добавляем поддержку навигации с клавиатуры
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
        
        // Применяем текущий поисковый фильтр если есть
        const searchInput = document.getElementById('tags-search');
        if (searchInput && searchInput.value.trim()) {
            this.filterTags(searchInput.value.toLowerCase().trim());
        }

        // Асинхронно загружаем информацию о каждом теге
        this.loadTagsStats(sortedTags);
    }

    async selectTag(tagName) {
        // Показываем индикатор загрузки в toast
        const loadingToast = this.showToast('Загружаем манифест...', 'info');
        
        try {
            // Используем query параметры для registry, repository и tag
            const url = `/api/v1/manifest?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(this.currentRepository)}&tag=${encodeURIComponent(tagName)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки манифеста');
            }
            
            this.currentManifest = data;
            this.showTagModal(tagName, data);
            
            // Убираем toast загрузки
            if (loadingToast && loadingToast.parentNode) {
                loadingToast.parentNode.removeChild(loadingToast);
            }
        } catch (error) {
            this.showToast('Ошибка загрузки манифеста: ' + error.message, 'error');
            
            // Убираем toast загрузки при ошибке
            if (loadingToast && loadingToast.parentNode) {
                loadingToast.parentNode.removeChild(loadingToast);
            }
        }
    }

    showTagModal(tagName, manifest) {
        const modal = document.getElementById('tag-modal');
        const infoContainer = document.getElementById('tag-info');
        
        // Форматируем размер
        const formatSize = (bytes) => {
            if (!bytes) return '0 B';
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        // Форматируем дату (если есть)
        const formatDate = (dateStr) => {
            if (!dateStr) return 'Не указана';
            try {
                return new Date(dateStr).toLocaleString('ru-RU');
            } catch {
                return dateStr;
            }
        };

        // Получаем digest в правильном формате
        const digest = manifest.digest || manifest.Digest;
        
        // Отладочная информация для digest
        console.log('Manifest digest:', digest);
        console.log('Full manifest:', manifest);
        
        // Формируем команду docker pull
        const dockerPullCommand = `docker pull ${this.currentRegistry}/${this.currentRepository}:${tagName}`;
        
        infoContainer.innerHTML = `
            <div class="tag-info">
                <h5><i class="fas fa-info-circle"></i> Информация о теге: ${tagName}</h5>
                
                <!-- Docker Pull Command -->
                <div class="docker-pull-section">
                    <div class="docker-pull-header">
                        <i class="fab fa-docker"></i>
                        <span class="docker-pull-title">Команда для загрузки:</span>
                    </div>
                    <div class="docker-pull-command-container">
                        <code class="docker-pull-command" id="docker-pull-${tagName.replace(/[^a-zA-Z0-9]/g, '_')}">${dockerPullCommand}</code>
                        <button class="copy-button" onclick="app.copyToClipboard('${dockerPullCommand.replace(/'/g, "\\'")}')" title="Скопировать команду">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                <div class="tag-info-item">
                    <span class="tag-info-label">Digest:</span>
                    <span class="tag-info-value" style="font-family: monospace; word-break: break-all;">${digest || 'Недоступен'}</span>
                </div>
                <div class="tag-info-item">
                    <span class="tag-info-label">Media Type:</span>
                    <span class="tag-info-value">${manifest.mediaType || 'Не указан'}</span>
                </div>
                <div class="tag-info-item">
                    <span class="tag-info-label">Schema Version:</span>
                    <span class="tag-info-value">${manifest.schemaVersion || 'Не указана'}</span>
                </div>
                <div class="tag-info-item">
                    <span class="tag-info-label">Размер:</span>
                    <span class="tag-info-value">${formatSize(manifest.size || manifest.Size)}</span>
                </div>
                <div class="tag-info-item">
                    <span class="tag-info-label">Архитектура:</span>
                    <span class="tag-info-value">${manifest.architecture || 'Не указана'}</span>
                </div>
                ${manifest.created ? `
                <div class="tag-info-item">
                    <span class="tag-info-label">Создан:</span>
                    <span class="tag-info-value">${formatDate(manifest.created)}</span>
                </div>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'block';
        
        // Фокус на модальном окне для доступности
        const closeButton = modal.querySelector('.close');
        if (closeButton) {
            closeButton.focus();
        }
    }

    // Функция копирования команды docker pull для тега
    async copyDockerPullCommand(tagName) {
        const dockerPullCommand = `docker pull ${this.currentRegistry}/${this.currentRepository}:${tagName}`;
        await this.copyToClipboard(dockerPullCommand);
    }

    // Функция копирования в буфер обмена
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Команда скопирована в буфер обмена', 'success');
        } catch (err) {
            console.error('Ошибка при копировании в буфер обмена:', err);
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('Команда скопирована в буфер обмена', 'success');
            } catch (err2) {
                this.showToast('Не удалось скопировать команду', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    async deleteTag() {
        if (!this.currentManifest) {
            this.showToast('Невозможно удалить тег: информация о манифесте не найдена', 'error');
            return;
        }
        
        // Проверяем digest в разных форматах (для обратной совместимости)
        const digest = this.currentManifest.digest || this.currentManifest.Digest;
        
        if (!digest) {
            console.error('Digest не найден в манифесте:', this.currentManifest);
            this.showToast('Невозможно удалить тег: digest не найден в манифесте. Возможно, registry не поддерживает удаление или требует особых настроек.', 'error');
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить этот тег? Это действие нельзя отменить.')) {
            return;
        }

        // Показываем индикатор удаления
        const deleteButton = document.getElementById('delete-tag');
        const originalText = deleteButton.innerHTML;
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
        deleteButton.disabled = true;

        try {
            // Используем query параметры для registry, repository и digest
            const url = `/api/v1/manifest?registry=${encodeURIComponent(this.currentRegistry)}&repository=${encodeURIComponent(this.currentRepository)}&digest=${encodeURIComponent(digest)}`;
            
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка удаления тега');
            }
            
            this.showToast('Тег успешно удален', 'success');
            this.closeModal();
            
            // Обновляем список тегов
            await this.showTags(this.currentRegistry, this.currentRepository);
        } catch (error) {
            this.showToast('Ошибка удаления тега: ' + error.message, 'error');
        } finally {
            // Восстанавливаем кнопку
            deleteButton.innerHTML = originalText;
            deleteButton.disabled = false;
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        
        const icon = iconMap[type] || iconMap.info;
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Автоматически удаляем toast через 5 секунд
        const timeoutId = setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
        
        // Добавляем возможность закрыть toast по клику
        toast.addEventListener('click', () => {
            clearTimeout(timeoutId);
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
        
        return toast;
    }


}

// Инициализируем приложение
let app;
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new RegLiteApp();
        await app.init();
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        document.body.innerHTML = `
            <div style="padding: 2rem; text-align: center; font-family: system-ui, -apple-system, sans-serif;">
                <h2>Ошибка загрузки приложения</h2>
                <p>Попробуйте обновить страницу.</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                    Перезагрузить страницу
                </button>
            </div>
        `;
    }
});

