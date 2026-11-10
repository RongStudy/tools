package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestNewHandler(t *testing.T) {
	files := fstest.MapFS{
		"index.html":      {Data: []byte("home")},
		"json/index.html": {Data: []byte("json tool")},
		"assets/app.js":   {Data: []byte("console.log('ok')")},
		".hidden":         {Data: []byte("secret")},
	}
	handler := NewHandler(files)

	tests := []struct {
		name     string
		path     string
		status   int
		body     string
		location string
		cache    string
		nosniff  string
	}{
		{name: "root redirects", path: "/", status: http.StatusTemporaryRedirect, location: "/tools/"},
		{name: "home", path: "/tools/", status: http.StatusOK, body: "home", cache: "no-cache", nosniff: "nosniff"},
		{name: "route entry", path: "/tools/json", status: http.StatusOK, body: "json tool"},
		{name: "route with slash", path: "/tools/json/", status: http.StatusOK, body: "json tool"},
		{name: "asset", path: "/tools/assets/app.js", status: http.StatusOK, body: "console.log('ok')"},
		{name: "no directory listing", path: "/tools/assets/", status: http.StatusNotFound},
		{name: "unknown route", path: "/tools/missing", status: http.StatusNotFound},
		{name: "missing asset", path: "/tools/assets/missing.js", status: http.StatusNotFound},
		{name: "hidden file", path: "/tools/.hidden", status: http.StatusNotFound},
		{name: "outside base path", path: "/elsewhere/", status: http.StatusNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			handler.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d", response.Code, test.status)
			}
			if test.location != "" && response.Header().Get("Location") != test.location {
				t.Errorf("Location = %q, want %q", response.Header().Get("Location"), test.location)
			}
			if test.body != "" && !strings.Contains(response.Body.String(), test.body) {
				t.Errorf("body %q does not contain %q", response.Body.String(), test.body)
			}
			if test.cache != "" && response.Header().Get("Cache-Control") != test.cache {
				t.Errorf("Cache-Control = %q, want %q", response.Header().Get("Cache-Control"), test.cache)
			}
			if test.nosniff != "" && response.Header().Get("X-Content-Type-Options") != test.nosniff {
				t.Errorf("X-Content-Type-Options = %q, want %q", response.Header().Get("X-Content-Type-Options"), test.nosniff)
			}
		})
	}
}

func TestMethodsAndContentTypes(t *testing.T) {
	handler := NewHandler(fstest.MapFS{
		"index.html":       {Data: []byte("<html>home</html>")},
		"assets/worker.js": {Data: []byte("self.onmessage = () => {}")},
	})
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		t.Run(method, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(method, "/tools/assets/worker.js", nil))
			if response.Code != http.StatusOK || !strings.Contains(response.Header().Get("Content-Type"), "javascript") {
				t.Fatalf("worker response = %d, %q", response.Code, response.Header().Get("Content-Type"))
			}
			if method == http.MethodHead && response.Body.Len() != 0 {
				t.Fatal("HEAD response must not include a body")
			}
		})
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/tools/", nil))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST status = %d, want 405", response.Code)
	}
}
