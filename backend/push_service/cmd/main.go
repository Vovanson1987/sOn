package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// HealthResponse — ответ проверки здоровья
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}

// PushRequest — запрос на отправку push-уведомления
type PushRequest struct {
	UserID  string `json:"user_id"`
	Title   string `json:"title"`
	Body    string `json:"body"`
	ChatID  string `json:"chat_id,omitempty"`
	Type    string `json:"type"` // message, call, system
}

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Heartbeat("/health"))

	// Проверка здоровья
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(HealthResponse{
			Status:  "ok",
			Service: "son-push-service",
			Version: "0.1.0",
		})
	})

	// Отправка push-уведомления
	r.Post("/api/push/send", func(w http.ResponseWriter, r *http.Request) {
		var req PushRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "invalid_body"}`, http.StatusBadRequest)
			return
		}

		log.Printf("📱 Push для %s: %s — %s", req.UserID, req.Title, req.Body)

		// TODO: отправить через FCM / APNs / Web Push
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "queued"})
	})

	// Регистрация push-токена
	r.Post("/api/devices/push-token", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)

		log.Printf("📱 Регистрация push-токена: platform=%s", body["platform"])

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "registered"})
	})

	log.Println("🔔 sOn Push Service запущен на :9090")
	if err := http.ListenAndServe(":9090", r); err != nil {
		log.Fatal(err)
	}
}
