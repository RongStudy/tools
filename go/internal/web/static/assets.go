// Package static contains the frontend snapshot copied by scripts/build-go.mjs.
package static

import (
	"embed"
	"fmt"
	"io/fs"
)

// Include hidden assets too; .gitkeep allows Go checks before the first Web build.
//
//go:embed all:site
var content embed.FS

// Files returns a read-only filesystem rooted at the bundled Web build.
func Files() (fs.FS, error) {
	files, err := fs.Sub(content, "site")
	if err != nil {
		return nil, fmt.Errorf("open embedded frontend: %w", err)
	}
	if _, err := fs.Stat(files, "index.html"); err != nil {
		return nil, fmt.Errorf("frontend not bundled; build with npm run build:go: %w", err)
	}
	return files, nil
}
