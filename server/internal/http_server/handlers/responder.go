package handlers

import (
	"encoding/json"
	"net/http"
)

type response struct {
	Message *string     `json:"message"`
	Data    interface{} `json:"data"`
}

func newResponse() response {
	return response{}
}

func (r response) message(msg string) response {
	r.Message = &msg
	return r
}

func (r response) data(data interface{}) response {
	r.Data = data
	return r
}

func writeJSONResponse(w http.ResponseWriter, r response, statusCode int) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	return json.NewEncoder(w).Encode(r)
}
