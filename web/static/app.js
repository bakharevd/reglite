// Основной класс приложения
class RegLiteApp {
    constructor() {
        this.currentRegistry = null;
        this.currentRepository = null;
        this.currentManifest = null;
        this.init();
    }

    init() {
        this.loadRegistries();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Кнопка "Назад к репозиториям"
        document.getElementById('back-to-repos').addEventListener('click', () => {
            this.showRepositories(this.currentRegistry);
        });

        // Модальное окно
        const modal = document.getElementById('tag-modal');
        const closeButtons = modal.querySelectorAll('.close, #close-modal');
        
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });

        // Удаление тега
        document.getElementById('delete-tag').addEventListener('click', () => {
            this.deleteTag();
        });

        // Закрытие модального окна при клике вне его
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    async loadRegistries() {
        try {
            const response = await fetch('/api/v1/registries');
            const data = await response.json();
            
            this.renderRegistries(data.registries);
        } catch (error) {
            this.showToast('Ошибка загрузки реестров: ' + error.message, 'error');
        }
    }

    renderRegistries(registries) {
        const container = document.getElementById('registries-list');
        
        if (!registries || registries.length === 0) {
            container.innerHTML = '<div class="list-item">Реестры не найдены</div>';
            return;
        }

        container.innerHTML = registries.map(registry => `
            <div class="list-item" onclick="app.selectRegistry('${registry}')">
                <i class="fas fa-server"></i>
                <span>${registry}</span>
            </div>
        `).join('');
    }

    async selectRegistry(registryName) {
        // Обновляем активный элемент
        document.querySelectorAll('#registries-list .list-item').forEach(item => {
            item.classList.remove('active');
        });
        
        event.target.closest('.list-item').classList.add('active');
        
        this.currentRegistry = registryName;
        this.showRepositories(registryName);
    }

    async showRepositories(registryName) {
        // Показываем секцию репозиториев
        document.getElementById('welcome-section').style.display = 'none';
        document.getElementById('tags-section').style.display = 'none';
        document.getElementById('repositories-section').style.display = 'block';
        
        // Обновляем заголовок
        document.getElementById('current-registry').textContent = registryName;
        
        // Показываем загрузку
        document.getElementById('repositories-list').innerHTML = '<div class="loading">Загружаем репозитории...</div>';
        
        try {
            const response = await fetch(`/api/v1/registries/${encodeURIComponent(registryName)}/repositories`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки репозиториев');
            }
            
            this.renderRepositories(data.repositories);
        } catch (error) {
            this.showToast('Ошибка загрузки репозиториев: ' + error.message, 'error');
            document.getElementById('repositories-list').innerHTML = `
                <div class="card" style="border-color: #dc3545;">
                    <h4 style="color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Ошибка</h4>
                    <p>${error.message}</p>
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
            <div class="card" onclick="app.selectRepository('${repo}')">
                <h4><i class="fas fa-folder"></i> ${repo}</h4>
                <p>Нажмите для просмотра тегов</p>
                <div class="card-meta">
                    <span class="badge badge-primary">Репозиторий</span>
                </div>
            </div>
        `).join('');
    }

    async selectRepository(repositoryName) {
        this.currentRepository = repositoryName;
        await this.showTags(this.currentRegistry, repositoryName);
    }

    async showTags(registryName, repositoryName) {
        // Показываем секцию тегов
        document.getElementById('repositories-section').style.display = 'none';
        document.getElementById('tags-section').style.display = 'block';
        
        // Обновляем заголовок
        document.getElementById('current-repository').textContent = repositoryName;
        
        // Показываем загрузку
        document.getElementById('tags-list').innerHTML = '<div class="loading">Загружаем теги...</div>';
        
        try {
            const response = await fetch(`/api/v1/registries/${encodeURIComponent(registryName)}/repositories/${encodeURIComponent(repositoryName)}/tags`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки тегов');
            }
            
            this.renderTags(data.tags);
        } catch (error) {
            this.showToast('Ошибка загрузки тегов: ' + error.message, 'error');
            document.getElementById('tags-list').innerHTML = `
                <div class="card" style="border-color: #dc3545;">
                    <h4 style="color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Ошибка</h4>
                    <p>${error.message}</p>
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

        container.innerHTML = tags.map(tag => `
            <div class="card" onclick="app.selectTag('${tag}')">
                <h4><i class="fas fa-tag"></i> ${tag}</h4>
                <p>Нажмите для просмотра информации о теге</p>
                <div class="card-meta">
                    <span class="badge badge-success">Тег</span>
                </div>
            </div>
        `).join('');
    }

    async selectTag(tagName) {
        try {
            const response = await fetch(`/api/v1/registries/${encodeURIComponent(this.currentRegistry)}/repositories/${encodeURIComponent(this.currentRepository)}/tags/${encodeURIComponent(tagName)}/manifest`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки манифеста');
            }
            
            this.currentManifest = data;
            this.showTagModal(tagName, data);
        } catch (error) {
            this.showToast('Ошибка загрузки манифеста: ' + error.message, 'error');
        }
    }

    showTagModal(tagName, manifest) {
        const modal = document.getElementById('tag-modal');
        const infoContainer = document.getElementById('tag-info');
        
        // Форматируем размер
        const formatSize = (bytes) => {
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            if (bytes === 0) return '0 Bytes';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        infoContainer.innerHTML = `
            <div class="tag-info">
                <h5><i class="fas fa-info-circle"></i> Информация о теге: ${tagName}</h5>
                <div class="tag-info-item">
                    <span class="tag-info-label">Digest:</span>
                    <span class="tag-info-value">${manifest.digest || 'Не доступен'}</span>
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
                    <span class="tag-info-value">${formatSize(manifest.size || 0)}</span>
                </div>
                <div class="tag-info-item">
                    <span class="tag-info-label">Архитектура:</span>
                    <span class="tag-info-value">${manifest.architecture || 'Не указана'}</span>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async deleteTag() {
        if (!this.currentManifest || !this.currentManifest.digest) {
            this.showToast('Невозможно удалить тег: digest не найден', 'error');
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить этот тег?')) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/registries/${encodeURIComponent(this.currentRegistry)}/repositories/${encodeURIComponent(this.currentRepository)}/manifests/${encodeURIComponent(this.currentManifest.digest)}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка удаления тега');
            }
            
            this.showToast('Тег успешно удален', 'success');
            document.getElementById('tag-modal').style.display = 'none';
            
            // Обновляем список тегов
            await this.showTags(this.currentRegistry, this.currentRepository);
        } catch (error) {
            this.showToast('Ошибка удаления тега: ' + error.message, 'error');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        }[type] || 'fas fa-info-circle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Автоматически удаляем toast через 5 секунд
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Инициализируем приложение
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new RegLiteApp();
});

