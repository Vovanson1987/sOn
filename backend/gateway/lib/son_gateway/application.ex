defmodule SonGateway.Application do
  @moduledoc """
  Главный модуль приложения sOn Gateway.
  Запускает Endpoint, PubSub, Repo, Presence и Redis.
  """
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Репозиторий PostgreSQL
      SonGateway.Repo,
      # PubSub для Phoenix Channels
      {Phoenix.PubSub, name: SonGateway.PubSub},
      # Presence для отслеживания онлайн-статусов
      SonGateway.Presence,
      # Redis для сессий и кэша
      {Redix, name: :redix, host: redis_host(), port: redis_port()},
      # Телеметрия
      SonGatewayWeb.Telemetry,
      # HTTP Endpoint
      SonGatewayWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: SonGateway.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    SonGatewayWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp redis_host do
    redis_url = Application.get_env(:son_gateway, :redis_url, "redis://localhost:6379")
    URI.parse(redis_url).host || "localhost"
  end

  defp redis_port do
    redis_url = Application.get_env(:son_gateway, :redis_url, "redis://localhost:6379")
    URI.parse(redis_url).port || 6379
  end
end
