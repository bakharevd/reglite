package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/reglite/reglite/internal/config"
	"github.com/reglite/reglite/internal/handlers"
)

func main() {
	var (
		configFile = flag.String("config", "inventory.yaml", "Path to config file")
		port       = flag.String("port", "8080", "Port to listen on")
		debug      = flag.Bool("debug", false, "Enable debug mode")
	)
	flag.Parse()

	// Загружаем конфигурацию
	cfg, err := config.LoadConfig(*configFile)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Настраиваем Gin
	if !*debug {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Используем middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// Настраиваем статические файлы
	router.Static("/static", "./web/static")
	router.LoadHTMLGlob("web/templates/*")

	// Создаем handlers
	h := handlers.NewHandler(cfg)

	// Web UI routes
	router.GET("/", h.ServeIndex)

	// API routes
	api := router.Group("/api/v1")
	{
		api.GET("/health", h.GetHealthCheck)
		api.GET("/registries", h.GetRegistries)
		api.GET("/registries/:registry/repositories", h.GetRepositories)
		api.GET("/registries/:registry/repositories/:repository/tags", h.GetTags)
		api.GET("/registries/:registry/repositories/:repository/tags/:tag/manifest", h.GetManifest)
		api.DELETE("/registries/:registry/repositories/:repository/manifests/:digest", h.DeleteTag)
	}

	// Настраиваем сервер с таймаутами
	server := &http.Server{
		Addr:           ":" + *port,
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	log.Printf("🚀 RegLite starting on :%s", *port)
	log.Printf("📖 Loaded %d registries from %s", len(cfg.Inventory), *configFile)
	for name, registry := range cfg.Inventory {
		username, _, err := registry.GetCredentials()
		authInfo := "no auth"
		if err == nil && username != "" {
			authInfo = fmt.Sprintf("auth: %s", username)
		}
		log.Printf("   • %s → %s (%s)", name, registry.URL, authInfo)
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}
