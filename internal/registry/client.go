package registry

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/reglite/reglite/internal/config"
)

type Client struct {
	registry config.Registry
	client   *http.Client
}

type CatalogResponse struct {
	Repositories []string `json:"repositories"`
}

type TagsResponse struct {
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

type ManifestResponse struct {
	MediaType     string `json:"mediaType"`
	SchemaVersion int    `json:"schemaVersion"`
	Tag           string `json:"tag"`
	Architecture  string `json:"architecture"`
	Digest        string
	Size          int64
}

func NewClient(registry config.Registry) *Client {
	return &Client{
		registry: registry,
		client:   &http.Client{},
	}
}

func (c *Client) makeRequest(method, path string) (*http.Response, error) {
	url := strings.TrimSuffix(c.registry.URL, "/") + path

	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}

	// Получаем credentials из конфигурации
	username, password, err := c.registry.GetCredentials()
	if err != nil {
		return nil, fmt.Errorf("failed to get credentials: %w", err)
	}

	// Добавляем Basic Auth если есть credentials
	if username != "" && password != "" {
		auth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		req.Header.Set("Authorization", "Basic "+auth)
	}

	// Для манифестов нужно указать Accept header
	if strings.Contains(path, "/manifests/") {
		req.Header.Set("Accept", "application/vnd.docker.distribution.manifest.v2+json")
	}

	return c.client.Do(req)
}

func (c *Client) GetCatalog() (*CatalogResponse, error) {
	resp, err := c.makeRequest("GET", "/v2/_catalog")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	var catalog CatalogResponse
	if err := json.NewDecoder(resp.Body).Decode(&catalog); err != nil {
		return nil, err
	}

	return &catalog, nil
}

func (c *Client) GetTags(repository string) (*TagsResponse, error) {
	path := fmt.Sprintf("/v2/%s/tags/list", repository)
	resp, err := c.makeRequest("GET", path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	var tags TagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
		return nil, err
	}

	return &tags, nil
}

func (c *Client) GetManifest(repository, tag string) (*ManifestResponse, error) {
	path := fmt.Sprintf("/v2/%s/manifests/%s", repository, tag)
	resp, err := c.makeRequest("GET", path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	// Получаем digest из заголовка
	digest := resp.Header.Get("Docker-Content-Digest")

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var manifest ManifestResponse
	if err := json.Unmarshal(body, &manifest); err != nil {
		return nil, err
	}

	manifest.Digest = digest
	manifest.Size = int64(len(body))
	manifest.Tag = tag

	return &manifest, nil
}

func (c *Client) DeleteManifest(repository, digest string) error {
	path := fmt.Sprintf("/v2/%s/manifests/%s", repository, digest)
	resp, err := c.makeRequest("DELETE", path)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	return nil
}
