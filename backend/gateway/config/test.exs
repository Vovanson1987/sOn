import Config

# Конфигурация для тестов
config :son_gateway, SonGateway.Repo,
  database: "son_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

config :son_gateway, SonGatewayWeb.Endpoint,
  http: [port: 4002],
  server: false

config :logger, level: :warning
config :argon2_elixir, t_cost: 1, m_cost: 8
