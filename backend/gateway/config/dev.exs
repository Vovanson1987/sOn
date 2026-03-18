import Config

# Конфигурация для разработки
config :son_gateway, SonGateway.Repo,
  stacktrace: true,
  show_sensitive_data_on_connection_error: true

config :son_gateway, SonGatewayWeb.Endpoint,
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  watchers: []

config :logger, :console, format: "[$level] $message\n"
