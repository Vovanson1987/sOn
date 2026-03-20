defmodule SonGatewayWeb.MessageController do
  @moduledoc "Контроллер сообщений — реальные запросы к PostgreSQL"
  use Phoenix.Controller, formats: [:json]

  alias SonGateway.Chats
  alias SonGateway.Auth.Guardian

  action_fallback SonGatewayWeb.FallbackController

  ## GET /api/chats/:chat_id/messages — список сообщений чата
  def index(conn, %{"chat_id" => chat_id} = params) do
    user_id = Guardian.Plug.current_resource(conn).id

    unless Chats.is_member?(chat_id, user_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Нет доступа к чату"})
    else
      opts = [
        limit: min(String.to_integer(Map.get(params, "limit", "100")), 200)
      ]

      opts =
        case Map.get(params, "before") do
          nil -> opts
          before -> [{:before, before} | opts]
        end

      messages = Chats.list_messages(chat_id, opts)
      json(conn, %{messages: messages})
    end
  end

  ## POST /api/chats/:chat_id/messages — отправить сообщение
  def create(conn, %{"chat_id" => chat_id} = params) do
    user_id = Guardian.Plug.current_resource(conn).id

    unless Chats.is_member?(chat_id, user_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Нет доступа к чату"})
    else
      attrs = %{
        "chat_id" => chat_id,
        "sender_id" => user_id,
        "content" => params["content"],
        "type" => Map.get(params, "type", "text"),
        "reply_to" => params["reply_to"]
      }

      case Chats.create_message(attrs) do
        {:ok, message} ->
          # Бродкаст через Phoenix PubSub
          SonGatewayWeb.Endpoint.broadcast!("chat:#{chat_id}", "new_message", %{
            id: message.id,
            chat_id: chat_id,
            sender_id: user_id,
            content: message.content,
            type: message.type,
            reply_to: message.reply_to,
            created_at: message.inserted_at
          })

          conn |> put_status(:created) |> json(%{message: message})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  ## DELETE /api/chats/:chat_id/messages/:id — удалить сообщение
  def delete(conn, %{"id" => id}) do
    user_id = Guardian.Plug.current_resource(conn).id

    case Chats.delete_message(id, user_id) do
      {:ok, _} -> send_resp(conn, :no_content, "")
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "Сообщение не найдено"})
      {:error, :forbidden} -> conn |> put_status(:forbidden) |> json(%{error: "Нельзя удалить чужое сообщение"})
    end
  end
end
