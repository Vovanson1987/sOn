defmodule SonGatewayWeb.PresenceChannel do
  @moduledoc """
  Канал для глобального отслеживания онлайн-статусов.
  Пользователи подключаются к presence:lobby.
  """
  use Phoenix.Channel

  alias SonGateway.Presence

  @impl true
  def join("presence:lobby", _params, socket) do
    send(self(), :after_join)
    {:ok, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    user_id = socket.assigns.user_id

    {:ok, _} = Presence.track(socket, user_id, %{
      online_at: inspect(System.system_time(:second)),
      status: "online"
    })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end
end
