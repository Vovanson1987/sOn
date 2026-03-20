defmodule SonGatewayWeb.ChatChannel do
  @moduledoc """
  Phoenix Channel для чата.
  Обрабатывает: отправку сообщений, typing, read receipts.
  """
  use Phoenix.Channel

  alias SonGateway.Presence

  @impl true
  def join("chat:" <> chat_id, _params, socket) do
    user_id = socket.assigns.user_id

    # Проверяем что пользователь — участник чата
    case SonGateway.Repo.get_by(SonGateway.Chats.ChatMember, chat_id: chat_id, user_id: user_id) do
      nil ->
        {:error, %{reason: "unauthorized"}}

      _member ->
        send(self(), :after_join)
        {:ok, assign(socket, :chat_id, chat_id)}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    user_id = socket.assigns.user_id
    {:ok, _} = Presence.track(socket, user_id, %{
      online_at: inspect(System.system_time(:second))
    })
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  ## Отправка сообщения
  @impl true
  def handle_in("send_message", %{"content" => content, "type" => type} = payload, socket) do
    user_id = socket.assigns.user_id
    chat_id = socket.assigns.chat_id

    message = %{
      id: Ecto.UUID.generate(),
      chat_id: chat_id,
      sender_id: user_id,
      content: content,
      type: type,
      reply_to: Map.get(payload, "reply_to"),
      created_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    broadcast!(socket, "new_message", message)
    {:reply, {:ok, message}, socket}
  end

  ## Индикатор "печатает..."
  def handle_in("user_typing", _payload, socket) do
    broadcast_from!(socket, "user_typing", %{
      user_id: socket.assigns.user_id
    })
    {:noreply, socket}
  end

  ## Остановка "печатает..."
  def handle_in("user_stop_typing", _payload, socket) do
    broadcast_from!(socket, "user_stop_typing", %{
      user_id: socket.assigns.user_id
    })
    {:noreply, socket}
  end

  ## Подтверждение доставки
  def handle_in("message_delivered", %{"message_id" => msg_id}, socket) do
    broadcast_from!(socket, "message_delivered", %{
      message_id: msg_id,
      user_id: socket.assigns.user_id,
      delivered_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })
    {:noreply, socket}
  end

  ## Подтверждение прочтения
  def handle_in("message_read", %{"message_id" => msg_id}, socket) do
    broadcast_from!(socket, "message_read", %{
      message_id: msg_id,
      user_id: socket.assigns.user_id,
      read_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })
    {:noreply, socket}
  end

  ## Реакция
  def handle_in("reaction_added", %{"message_id" => msg_id, "emoji" => emoji}, socket) do
    broadcast!(socket, "reaction_added", %{
      message_id: msg_id,
      user_id: socket.assigns.user_id,
      emoji: emoji
    })
    {:noreply, socket}
  end
end
