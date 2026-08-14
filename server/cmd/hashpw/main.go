// Command hashpw prints an argon2id hash for a plaintext password.
//
// API_PW holds the *hash* that incoming x-app-password headers are compared
// against, not the password itself, so use this to produce that value:
//
//	go run ./cmd/hashpw 'my-password' >> .env
package main

import (
	"fmt"
	"os"

	"github.com/alexedwards/argon2id"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: hashpw <password>")
		os.Exit(1)
	}

	hash, err := argon2id.CreateHash(os.Args[1], argon2id.DefaultParams)
	if err != nil {
		fmt.Fprintf(os.Stderr, "hashing password: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(hash)
}
