defmodule SonGatewayWeb.Router do
  use Phoenix.Router

  import Plug.Conn
  import Phoenix.Controller

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :authenticated do
    plug SonGateway.Auth.Pipeline
  end

  # Публичные маршруты (без авторизации)
  scope "/api", SonGatewayWeb do
    pipe_through :api

    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
    post "/auth/refresh", AuthController, :refresh
  end

  # Защищённые маршруты (JWT)
  scope "/api", SonGatewayWeb do
    pipe_through [:api, :authenticated]

    # Профиль
    get "/users/me", UserController, :me
    patch "/users/me", UserController, :update
    get "/users/search", UserController, :search

    # Контакты
    get "/contacts", ContactController, :index
    post "/contacts", ContactController, :create
    delete "/contacts/:id", ContactController, :delete

    # Чаты
    get "/chats", ChatController, :index
    get "/chats/:id", ChatController, :show
    post "/chats", ChatController, :create
    patch "/chats/:id", ChatController, :update
    delete "/chats/:id", ChatController, :delete

    # Сообщения
    get "/chats/:chat_id/messages", MessageController, :index
    post "/chats/:chat_id/messages", MessageController, :create
    delete "/chats/:chat_id/messages/:id", MessageController, :delete

    # Сессии
    post "/auth/logout", AuthController, :logout
    get "/auth/sessions", AuthController, :sessions
    delete "/auth/sessions/:device_id", AuthController, :revoke_session
  end

  # Мониторинг
  if Mix.env() in [:dev, :test] do
    import Phoenix.LiveDashboard.Router

    scope "/" do
      pipe_through [:fetch_session, :protect_from_forgery]
      live_dashboard "/dashboard", metrics: SonGatewayWeb.Telemetry
    end
  end
end
