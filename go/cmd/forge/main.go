// Command forge serves the bundled frontend without external runtime dependencies.
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"

	"forge.local/launcher/internal/app"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "HTTP listen address (host:port)")
	flag.Parse()
	if flag.NArg() != 0 {
		log.Fatal("unexpected arguments; use -help for usage")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	if err := app.Run(ctx, *addr, os.Stdout); err != nil {
		log.Fatal(err)
	}
}
