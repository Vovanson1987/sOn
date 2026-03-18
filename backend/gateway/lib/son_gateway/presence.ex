defmodule SonGateway.Presence do
  @moduledoc """
  Phoenix Presence для отслеживания онлайн-статусов пользователей.
  Использует CRDT для распределённого консенсуса.
  """
  use Phoenix.Presence,
    otp_app: :son_gateway,
    pubsub_server: SonGateway.PubSub
end
