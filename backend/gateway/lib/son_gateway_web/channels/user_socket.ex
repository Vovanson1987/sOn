defmodule SonGatewayWeb.UserSocket do
  @moduledoc """
  WebSocket точка входа.
  Аутентификация через JWT токен в параметрах подключения.
  """
  use Phoenix.Socket

  channel "chat:*", SonGatewayWeb.ChatChannel
  channel "presence:lobby", SonGatewayWeb.PresenceChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case SonGateway.Auth.Guardian.resource_from_token(token) do
      {:ok, user, _claims} ->
        {:ok, assign(socket, :user_id, user.id)}

      {:error, _reason} ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
