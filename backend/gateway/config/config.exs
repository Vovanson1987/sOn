# Основная конфигурация sOn Gateway
import Config

config :son_gateway, SonGateway.Repo,
  database: "son_dev",
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  port: 5432,
  pool_size: 10

config :son_gateway, SonGatewayWeb.Endpoint,
  url: [host: "localhost"],
  http: [port: 4000],
  secret_key_base: System.get_env("SECRET_KEY_BASE") || "dev-secret-key-base-must-be-at-least-64-bytes-long-for-security-purposes",
  render_errors: [formats: [json: SonGatewayWeb.ErrorJSON]],
  pubsub_server: SonGateway.PubSub,
  live_view: [signing_salt: "son_salt"]

# Guardian (JWT)
config :son_gateway, SonGateway.Auth.Guardian,
  issuer: "son_gateway",
  secret_key: System.get_env("GUARDIAN_SECRET") || "dev-guardian-secret-key-change-in-production",
  ttl: {15, :minutes}

# Redis
config :son_gateway, :redis_url,
  System.get_env("REDIS_URL") || "redis://localhost:6379"

# Логирование
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :user_id]

config :son_gateway, ecto_repos: [SonGateway.Repo]
config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
