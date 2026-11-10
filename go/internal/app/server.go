// Package app owns the HTTP server lifecycle, independently of the command entrypoint.
package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"forge.local/launcher/internal/web"
	"forge.local/launcher/internal/web/static"
)

// Run serves the embedded site until ctx is canceled or the server fails.
func Run(ctx context.Context, addr string, output io.Writer) error {
	files, err := static.Files()
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", addr, err)
	}
	defer listener.Close()

	server := new(http.Server{
		Handler:           web.NewHandler(files),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	})
	defer server.Close()
	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()
	fmt.Fprintf(output, "Forge: http://%s/tools/\nPress Ctrl+C to stop.\n", listener.Addr())

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve frontend: %w", err)
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown frontend: %w", err)
		}
		if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("stop frontend: %w", err)
		}
		return nil
	}
}
