package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/reglite/reglite/internal/config"
	"github.com/reglite/reglite/internal/registry"
)

type RegistryStatus struct {
	Name         string    `json:"name"`
	URL          string    `json:"url"`
	Status       string    `json:"status"`
	LastChecked  time.Time `json:"lastChecked"`
	ResponseTime int64     `json:"responseTime"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
}

type RegistriesResponse struct {
	Registries []RegistryStatus `json:"registries"`
	LastUpdate time.Time        `json:"lastUpdate"`
}

type Handler struct {
	config           *config.Config
	registryStatuses map[string]*RegistryStatus
	statusMutex      sync.RWMutex
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{
		config:           cfg,
		registryStatuses: make(map[string]*RegistryStatus),
	}
}

func (h *Handler) validateRegistry(name string, reg config.Registry) *RegistryStatus {
	startTime := time.Now()

	status := &RegistryStatus{
		Name:        name,
		URL:         reg.URL,
		Status:      "checking",
		LastChecked: startTime,
	}

	client := registry.NewClient(reg)
	_, err := client.GetCatalog()

	responseTime := time.Since(startTime).Milliseconds()
	status.ResponseTime = responseTime

	if err != nil {
		status.Status = "offline"
		status.ErrorMessage = err.Error()
	} else {
		status.Status = "online"
		status.ErrorMessage = ""
	}

	return status
}

// validateAllRegistries проверяет все реестры параллельно
func (h *Handler) validateAllRegistries() {
	registries := h.config.Inventory
	var wg sync.WaitGroup

	for name, reg := range registries {
		wg.Add(1)
		go func(name string, reg config.Registry) {
			defer wg.Done()
			status := h.validateRegistry(name, reg)

			h.statusMutex.Lock()
			h.registryStatuses[name] = status
			h.statusMutex.Unlock()
		}(name, reg)
	}

	wg.Wait()
}

// GetRegistriesWithStatus возвращает реестры с их статусом
func (h *Handler) GetRegistriesWithStatus(c *gin.Context) {
	h.statusMutex.RLock()

	var registries []RegistryStatus
	lastUpdate := time.Now()

	// Собираем статусы всех реестров
	for name, reg := range h.config.Inventory {
		if status, exists := h.registryStatuses[name]; exists {
			registries = append(registries, *status)
			if status.LastChecked.Before(lastUpdate) {
				lastUpdate = status.LastChecked
			}
		} else {
			// Если статуса нет, добавляем как "checking"
			registries = append(registries, RegistryStatus{
				Name:        name,
				URL:         reg.URL,
				Status:      "checking",
				LastChecked: time.Now(),
			})
		}
	}

	h.statusMutex.RUnlock()

	c.JSON(http.StatusOK, RegistriesResponse{
		Registries: registries,
		LastUpdate: lastUpdate,
	})
}

// ValidateRegistries запускает валидацию всех реестров
func (h *Handler) ValidateRegistries(c *gin.Context) {
	// Запускаем валидацию в горутине чтобы не блокировать запрос
	go h.validateAllRegistries()

	c.JSON(http.StatusOK, gin.H{
		"message": "Validation started",
		"status":  "running",
	})
}

// GetRegistries оставляем для обратной совместимости
func (h *Handler) GetRegistries(c *gin.Context) {
	names := h.config.GetRegistryNames()
	c.JSON(http.StatusOK, gin.H{"registries": names})
}

// extractRepositoryParam извлекает repository из query параметров
func extractRepositoryParam(c *gin.Context) string {
	repository := c.Query("repository")
	if repository == "" {
		repository = c.Query("repo") // поддерживаем оба варианта
	}

	return repository
}

// extractRegistryParam извлекает registry из query параметров
func extractRegistryParam(c *gin.Context) string {
	registry := c.Query("registry")

	return registry
}

func (h *Handler) GetRepositories(c *gin.Context) {
	registryName := extractRegistryParam(c)

	if registryName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry parameter is required"})
		return
	}

	reg, exists := h.config.GetRegistry(registryName)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	client := registry.NewClient(reg)
	catalog, err := client.GetCatalog()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, catalog)
}

func (h *Handler) GetRepositoryInfo(c *gin.Context) {
	registryName := extractRegistryParam(c)
	repository := extractRepositoryParam(c)

	if registryName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry parameter is required"})
		return
	}

	if repository == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Repository parameter is required"})
		return
	}

	reg, exists := h.config.GetRegistry(registryName)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	client := registry.NewClient(reg)
	info, err := client.GetRepositoryInfo(repository)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, info)
}

func (h *Handler) GetTags(c *gin.Context) {
	registryName := extractRegistryParam(c)
	repository := extractRepositoryParam(c)

	if registryName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry parameter is required"})
		return
	}

	if repository == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Repository parameter is required"})
		return
	}

	reg, exists := h.config.GetRegistry(registryName)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	client := registry.NewClient(reg)
	tags, err := client.GetTags(repository)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tags)
}

func (h *Handler) GetManifest(c *gin.Context) {
	registryName := extractRegistryParam(c)
	repository := extractRepositoryParam(c)
	tag := c.Query("tag")

	if registryName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry parameter is required"})
		return
	}

	if repository == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Repository parameter is required"})
		return
	}

	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag parameter is required"})
		return
	}

	reg, exists := h.config.GetRegistry(registryName)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	client := registry.NewClient(reg)
	manifest, err := client.GetManifest(repository, tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, manifest)
}

func (h *Handler) DeleteTag(c *gin.Context) {
	registryName := extractRegistryParam(c)
	repository := extractRepositoryParam(c)
	digest := c.Query("digest")

	if registryName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry parameter is required"})
		return
	}

	if repository == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Repository parameter is required"})
		return
	}

	if digest == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Digest parameter is required"})
		return
	}

	reg, exists := h.config.GetRegistry(registryName)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	client := registry.NewClient(reg)
	err := client.DeleteManifest(repository, digest)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag deleted successfully"})
}

func (h *Handler) ServeIndex(c *gin.Context) {
	c.HTML(http.StatusOK, "index.html", gin.H{
		"title": "RegLite - Docker Registry UI",
	})
}

func (h *Handler) GetHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "reglite",
		"version": "1.0.0",
	})
}
