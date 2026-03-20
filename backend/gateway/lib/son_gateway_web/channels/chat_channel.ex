defmodule SonGatewayWeb.ChatChannel do
  @moduledoc """
  Phoenix Channel для чата.
  Обрабатывает: отправку сообщений, typing, read receipts.
  Сообщения сохраняются в PostgreSQL.
  """
  use Phoenix.Channel

  alias SonGateway.Presence
  alias SonGateway.Chats

  @impl true
  def join("chat:" <> chat_id, _params, socket) do
    user_id = socket.assigns.user_id

    # Проверяем что пользователь — участник чата
    if Chats.is_member?(chat_id, user_id) do
      send(self(), :after_join)
      {:ok, assign(socket, :chat_id, chat_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    user_id = socket.assigns.user_id
    {:ok, _} = Presence.track(socket, user_id, %{
      online_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  ## Отправка сообщения — сохранение в БД + broadcast
  @impl true
  def handle_in("send_message", %{"content" => content} = payload, socket) do
    user_id = socket.assigns.user_id
    chat_id = socket.assigns.chat_id

    attrs = %{
      "chat_id" => chat_id,
      "sender_id" => user_id,
      "content" => content,
      "type" => Map.get(payload, "type", "text"),
      "reply_to" => Map.get(payload, "reply_to")
    }

    case Chats.create_message(attrs) do
      {:ok, message} ->
        msg_data = %{
          id: message.id,
          chat_id: chat_id,
          sender_id: user_id,
          content: message.content,
          type: message.type,
          reply_to: message.reply_to,
          created_at: message.inserted_at
        }

        broadcast!(socket, "new_message", msg_data)
        {:reply, {:ok, msg_data}, socket}

      {:error, _reason} ->
        {:reply, {:error, %{reason: "Ошибка сохранения сообщения"}}, socket}
    end
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
