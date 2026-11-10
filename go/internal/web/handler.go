// Package web serves the existing /tools/ Web build and its generated route entries.
package web

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// NewHandler serves only embedded files. Direct tool links use Vite's generated
// <route>/index.html entries, just as on GitHub Pages; missing assets stay 404.
func NewHandler(files fs.FS) http.Handler {
	site := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "."
		}
		for segment := range strings.SplitSeq(name, "/") {
			if segment != "." && strings.HasPrefix(segment, ".") {
				http.NotFound(w, r)
				return
			}
		}
		info, err := fs.Stat(files, name)
		if err == nil && info.IsDir() {
			// Serve route entries directly so BrowserRouter URLs stay canonical.
			name = path.Join(name, "index.html")
			info, err = fs.Stat(files, name)
		}
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFileFS(w, r, files, name)
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/tools/", http.StatusTemporaryRedirect)
	})
	mux.Handle("GET /tools/", http.StripPrefix("/tools", site))
	return mux
}
