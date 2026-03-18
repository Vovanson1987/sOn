import Config

# Конфигурация runtime — загружается при старте приложения
if config_env() == :prod do
  config :son_gateway, SonGateway.Repo,
    url: System.fetch_env!("DATABASE_URL"),
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10")

  config :son_gateway, SonGatewayWeb.Endpoint,
    secret_key_base: System.fetch_env!("SECRET_KEY_BASE")
end
