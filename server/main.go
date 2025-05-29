package main

import (
	"fmt"

	server "github.com/nguyen/allycat/internal/http_server"
	"github.com/nguyen/allycat/internal/http_server/handlers"
)

func main() {

	srv := server.NewServer()

	placesHandler, err := handlers.NewPlacesHandler("AIzaSyC8RFGiTgOWsQKv-OGTMZsqNhjSTsEng5s")

	if err != nil {
		panic(err)
	}

	handlers := handlers.Handlers{
		Places: placesHandler,
	}

	srv.RegisterRoutes(handlers)

	err = srv.Start(":3001")

	if err != nil {
		fmt.Printf("Error starting server: %v\n", err)
	}
}
