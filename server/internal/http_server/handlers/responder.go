package handlers

import (
	"encoding/json"
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

func WriteJSONResponse(w http.ResponseWriter, r response, statusCode int) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	return json.NewEncoder(w).Encode(r)
}

func writeServerError(w http.ResponseWriter) error {
	return WriteJSONResponse(w, NewResponse().WithMessage("An internal server error has occurred"), http.StatusInternalServerError)
}
