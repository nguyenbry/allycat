package routes

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPw(t *testing.T) {
	p := "zzz@$oneP7655"

	pw, err := newPassword(p)

	assert.Nil(t, err, "should not error")

	hash, err := pw.HashPassword()
	assert.Nil(t, err, "should not error")

	ok, err := pw.ComparePasswordAndHash(hash)

	assert.Nil(t, err, "should not error hash")

	assert.True(t, ok, "should be good")

	fmt.Println("hash", hash)
}
