package handlers

import (
	"encoding/json"
	"log"
	"net/http"
)

type response struct {
	Message *string     `json:"message"`
	Data    interface{} `json:"data"`
}

func NewResponse() response {
	return response{}
}

func (r response) WithMessage(msg string) response {
	r.Message = &msg
	return r
}

func (r response) WithData(data interface{}) response {
	r.Data = data
	return r
}

// WriteJSONResponse writes the shared {message, data} envelope.
//
// It deliberately returns nothing: the status line and headers are already on
// the wire by the time encoding could fail, so no caller can recover. Log it
// and move on rather than making every call site discard an error.
func WriteJSONResponse(w http.ResponseWriter, r response, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(r); err != nil {
		log.Printf("writing json response: %v", err)
	}
}
