package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/reglite/reglite/internal/config"
	"github.com/reglite/reglite/internal/registry"
)

type Handler struct {
	config *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{config: cfg}
}

func (h *Handler) GetRegistries(c *gin.Context) {
	names := h.config.GetRegistryNames()
	c.JSON(http.StatusOK, gin.H{"registries": names})
}

func (h *Handler) GetRepositories(c *gin.Context) {
	registryName := c.Param("registry")

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

func (h *Handler) GetTags(c *gin.Context) {
	registryName := c.Param("registry")
	repository := c.Param("repository")

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
	registryName := c.Param("registry")
	repository := c.Param("repository")
	tag := c.Param("tag")

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
	registryName := c.Param("registry")
	repository := c.Param("repository")
	digest := c.Param("digest")

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

