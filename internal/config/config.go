package config

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Registry struct {
	URL      string `yaml:"url"`
	Username string `yaml:"username,omitempty"`
	Password string `yaml:"password,omitempty"`
	Auth     string `yaml:"auth,omitempty"` // base64 encoded username:password
}

type Config struct {
	Inventory map[string]Registry `yaml:"inventory"`
}

// DockerConfig represents the structure of ~/.docker/config.json
type DockerConfig struct {
	Auths map[string]DockerAuth `json:"auths"`
}

type DockerAuth struct {
	Auth string `json:"auth"`
}

func LoadConfig(filename string) (*Config, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Попробуем загрузить и объединить с Docker config.json
	if dockerConfig, err := LoadDockerConfig(); err == nil {
		mergeDockerConfig(&config, dockerConfig)
	}

	return &config, nil
}

// LoadDockerConfig загружает ~/.docker/config.json
func LoadDockerConfig() (*DockerConfig, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	dockerConfigPath := filepath.Join(homeDir, ".docker", "config.json")
	data, err := os.ReadFile(dockerConfigPath)
	if err != nil {
		return nil, err
	}

	var dockerConfig DockerConfig
	if err := json.Unmarshal(data, &dockerConfig); err != nil {
		return nil, err
	}

	return &dockerConfig, nil
}

// mergeDockerConfig объединяет Docker config с основной конфигурацией
func mergeDockerConfig(config *Config, dockerConfig *DockerConfig) {
	for registryURL, auth := range dockerConfig.Auths {
		// Извлекаем хост из URL если есть схема
		host := strings.TrimPrefix(strings.TrimPrefix(registryURL, "https://"), "http://")

		// Проверяем, есть ли уже такой реестр в конфигурации
		if _, exists := config.Inventory[host]; !exists {
			// Определяем схему (по умолчанию http для локальных, https для остальных)
			scheme := "http"
			if !strings.Contains(host, "localhost") && !strings.Contains(host, "127.0.0.1") && !isPrivateIP(host) {
				scheme = "https"
			}
			config.Inventory[host] = Registry{
				URL:  fmt.Sprintf("%s://%s", scheme, host),
				Auth: auth.Auth,
			}
		} else {
			existing := config.Inventory[host]
			if existing.Username == "" && existing.Password == "" && existing.Auth == "" {
				existing.Auth = auth.Auth
				config.Inventory[host] = existing
			}
		}
	}
}

// isPrivateIP проверяет, является ли IP приватным
func isPrivateIP(host string) bool {
	privateRanges := []string{
		"10.", "172.16.", "172.17.", "172.18.", "172.19.",
		"172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
		"172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
		"172.30.", "172.31.", "192.168.",
	}
	for _, prefix := range privateRanges {
		if strings.HasPrefix(host, prefix) {
			return true
		}
	}
	return false
}

func (c *Config) GetRegistry(name string) (Registry, bool) {
	registry, exists := c.Inventory[name]
	return registry, exists
}

func (c *Config) GetRegistryNames() []string {
	names := make([]string, 0, len(c.Inventory))
	for name := range c.Inventory {
		names = append(names, name)
	}
	return names
}

// DecodeAuth декодирует base64 строку авторизации в username:password
func (r *Registry) DecodeAuth() (username, password string, err error) {
	if r.Auth == "" {
		return r.Username, r.Password, nil
	}

	decoded, err := base64.StdEncoding.DecodeString(r.Auth)
	if err != nil {
		return "", "", fmt.Errorf("failed to decode auth: %w", err)
	}

	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid auth format")
	}

	return parts[0], parts[1], nil
}

// GetCredentials возвращает username и password, приоритет у явно указанных
func (r *Registry) GetCredentials() (username, password string, err error) {
	if r.Username != "" && r.Password != "" {
		return r.Username, r.Password, nil
	}
	return r.DecodeAuth()
}
