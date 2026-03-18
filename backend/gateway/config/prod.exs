import Config

# Конфигурация для продакшена — секреты через переменные окружения
config :son_gateway, SonGatewayWeb.Endpoint,
  url: [host: System.get_env("PHX_HOST") || "son-messenger.com", port: 443, scheme: "https"],
  http: [port: String.to_integer(System.get_env("PORT") || "4000")],
  secret_key_base: System.fetch_env!("SECRET_KEY_BASE"),
  server: true

config :son_gateway, SonGateway.Repo,
  url: System.fetch_env!("DATABASE_URL"),
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
  ssl: true

config :son_gateway, SonGateway.Auth.Guardian,
  secret_key: System.fetch_env!("GUARDIAN_SECRET")

config :son_gateway, :redis_url, System.fetch_env!("REDIS_URL")
