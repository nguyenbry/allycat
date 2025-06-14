package main

import (
	"fmt"
	"os"

	server "github.com/nguyen/allycat/internal/http_server"
	"github.com/nguyen/allycat/internal/http_server/handlers"
)

func main() {
	key, ok := os.LookupEnv("MAPS_API_KEY")

	if !ok {
		panic("MAPS_API_KEY required")
	}

	pw, ok := os.LookupEnv("API_PW")

	if !ok {
		panic("API_PW required")
	}

	if len(pw) < 5 {
		panic("API_PW must be at least 5 characters")
	}

	fmt.Println("hash is", pw)

	origin, ok := os.LookupEnv("ALLOWED_ORIGIN")

	if !ok || origin == "" {
		panic("ALLOWED_ORIGIN required")
	}

	port, ok := os.LookupEnv("PORT")

	if !ok || port == "" {
		panic("PORT required")
	}

	srv := server.NewServer()

	placesHandler, err := handlers.NewPlacesHandler(key)

	if err != nil {
		panic(err)
	}

	handlers := handlers.Handlers{
		Places: placesHandler,
	}

	srv.RegisterRoutes(handlers, pw)

	fmt.Println("starting server on port", port)

	err = srv.Start(":"+port, origin)

	if err != nil {
		fmt.Printf("Error starting server: %v\n", err)
	}
}
