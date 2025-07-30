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
	Digest        string `json:"digest"`
	Size          int64  `json:"size"`
	Created       string `json:"created,omitempty"`
}

type RepositoryInfo struct {
	Name            string   `json:"name"`
	TagsCount       int      `json:"tagsCount"`
	Tags            []string `json:"tags"`
	LastModified    string   `json:"lastModified,omitempty"`
	Description     string   `json:"description,omitempty"`
	TotalSize       int64    `json:"totalSize,omitempty"`       // Общий размер репозитория
	SampleSize      int64    `json:"sampleSize,omitempty"`      // Размер образца для оценки
	SampleTagsCount int      `json:"sampleTagsCount,omitempty"` // Количество тегов в образце
	IsEstimate      bool     `json:"isEstimate,omitempty"`      // Является ли размер оценкой
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

	username, password, err := c.registry.GetCredentials()
	if err != nil {
		return nil, fmt.Errorf("failed to get credentials: %w", err)
	}

	if username != "" && password != "" {
		auth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		req.Header.Set("Authorization", "Basic "+auth)
	}

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
	defer func() { _ = resp.Body.Close() }()

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
	defer func() { _ = resp.Body.Close() }()

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
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	digest := resp.Header.Get("Docker-Content-Digest")
	if digest == "" {
		digest = resp.Header.Get("Docker-Digest")
	}
	if digest == "" {
		digest = resp.Header.Get("ETag")
		if len(digest) > 2 && digest[0] == '"' && digest[len(digest)-1] == '"' {
			digest = digest[1 : len(digest)-1]
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var manifest ManifestResponse
	if err := json.Unmarshal(body, &manifest); err != nil {
		return nil, err
	}

	manifest.Digest = digest
	manifest.Tag = tag

	extractManifestInfo(body, &manifest)
	c.enrichWithConfigBlob(repository, body, &manifest)

	return &manifest, nil
}

// extractManifestInfo извлекает дополнительную информацию из манифеста
func extractManifestInfo(manifestBody []byte, manifest *ManifestResponse) {
	var manifestData map[string]interface{}
	if err := json.Unmarshal(manifestBody, &manifestData); err != nil {
		manifest.Size = int64(len(manifestBody))
		return
	}

	var totalSize int64

	if config, ok := manifestData["config"].(map[string]interface{}); ok {
		if size, ok := config["size"].(float64); ok {
			totalSize += int64(size)
		}
	}

	if layers, ok := manifestData["layers"].([]interface{}); ok {
		for _, layer := range layers {
			if layerMap, ok := layer.(map[string]interface{}); ok {
				if size, ok := layerMap["size"].(float64); ok {
					totalSize += int64(size)
				}
			}
		}
	}

	if totalSize == 0 {
		totalSize = int64(len(manifestBody))
	}
	manifest.Size = totalSize

	if architecture, ok := manifestData["architecture"].(string); ok {
		manifest.Architecture = architecture
	}

	if history, ok := manifestData["history"].([]interface{}); ok {
		if len(history) > 0 {
			if firstHistory, ok := history[0].(map[string]interface{}); ok {
				if created, ok := firstHistory["created"].(string); ok {
					manifest.Created = created
				}
			}
		}
	}

	if history, ok := manifestData["history"].([]interface{}); ok {
		for _, item := range history {
			if historyItem, ok := item.(map[string]interface{}); ok {
				if v1Compatibility, ok := historyItem["v1Compatibility"].(string); ok {
					var v1Data map[string]interface{}
					if err := json.Unmarshal([]byte(v1Compatibility), &v1Data); err == nil {
						if created, ok := v1Data["created"].(string); ok {
							manifest.Created = created
							break
						}
					}
				}
			}
		}
	}
}

// enrichWithConfigBlob получает дополнительную информацию из config blob
func (c *Client) enrichWithConfigBlob(repository string, manifestBody []byte, manifest *ManifestResponse) {
	var manifestData map[string]interface{}
	if err := json.Unmarshal(manifestBody, &manifestData); err != nil {
		return
	}

	if config, ok := manifestData["config"].(map[string]interface{}); ok {
		if digest, ok := config["digest"].(string); ok {
			configBlob, err := c.getBlob(repository, digest)
			if err == nil {
				c.extractFromConfigBlob(configBlob, manifest)
			}
		}
	}
}

// getBlob получает blob по digest
func (c *Client) getBlob(repository, digest string) ([]byte, error) {
	path := fmt.Sprintf("/v2/%s/blobs/%s", repository, digest)
	resp, err := c.makeRequest("GET", path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// extractFromConfigBlob извлекает информацию из config blob
func (c *Client) extractFromConfigBlob(configBlob []byte, manifest *ManifestResponse) {
	var configData map[string]interface{}
	if err := json.Unmarshal(configBlob, &configData); err != nil {
		return
	}

	if created, ok := configData["created"].(string); ok {
		manifest.Created = created
	}

	if architecture, ok := configData["architecture"].(string); ok {
		manifest.Architecture = architecture
	}
}

func (c *Client) GetRepositoryInfo(repository string) (*RepositoryInfo, error) {
	tagsResp, err := c.GetTags(repository)
	if err != nil {
		return nil, err
	}

	info := &RepositoryInfo{
		Name:      repository,
		Tags:      tagsResp.Tags,
		TagsCount: len(tagsResp.Tags),
	}

	if len(tagsResp.Tags) > 0 {
		totalSize, isEstimate, sampleCount := c.calculateRepositorySize(repository, tagsResp.Tags)
		info.TotalSize = totalSize
		info.IsEstimate = isEstimate
		info.SampleTagsCount = sampleCount
	}

	return info, nil
}

// calculateRepositorySize вычисляет общий размер репозитория
func (c *Client) calculateRepositorySize(repository string, tags []string) (int64, bool, int) {
	const maxTagsForExactSize = 35
	const sampleSizeForEstimate = 10

	tagCount := len(tags)

	if tagCount <= maxTagsForExactSize {
		return c.getExactRepositorySize(repository, tags), false, tagCount
	} else {
		return c.getEstimatedRepositorySize(repository, tags, sampleSizeForEstimate), true, sampleSizeForEstimate
	}
}

// getExactRepositorySize получает точный размер всех тегов
func (c *Client) getExactRepositorySize(repository string, tags []string) int64 {
	var totalSize int64
	uniqueSizes := make(map[string]int64)

	for _, tag := range tags {
		manifest, err := c.GetManifest(repository, tag)
		if err == nil {
			if manifest.Digest != "" {
				if _, exists := uniqueSizes[manifest.Digest]; !exists {
					uniqueSizes[manifest.Digest] = manifest.Size
					totalSize += manifest.Size
				}
			} else {
				totalSize += manifest.Size
			}
		}
	}

	return totalSize
}

// getEstimatedRepositorySize получает приблизительный размер репозитория
func (c *Client) getEstimatedRepositorySize(repository string, tags []string, sampleSize int) int64 {
	if sampleSize > len(tags) {
		sampleSize = len(tags)
	}

	sampleTags := make([]string, sampleSize)

	for i := 0; i < sampleSize; i++ {
		index := i * len(tags) / sampleSize
		sampleTags[i] = tags[index]
	}

	sampleTotalSize := c.getExactRepositorySize(repository, sampleTags)

	estimationFactor := float64(len(tags)) / float64(sampleSize)
	deduplicationFactor := 0.3 + (0.7 * float64(sampleSize) / float64(len(tags)))
	estimatedSize := int64(float64(sampleTotalSize) * estimationFactor * deduplicationFactor)

	return estimatedSize
}

func (c *Client) DeleteManifest(repository, digest string) error {
	path := fmt.Sprintf("/v2/%s/manifests/%s", repository, digest)
	resp, err := c.makeRequest("DELETE", path)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	return nil
}
