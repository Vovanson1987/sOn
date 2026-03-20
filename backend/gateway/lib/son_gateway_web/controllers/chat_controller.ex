defmodule SonGatewayWeb.ChatController do
  @moduledoc "Контроллер чатов — реальные запросы к PostgreSQL"
  use Phoenix.Controller, formats: [:json]

  alias SonGateway.Chats
  alias SonGateway.Auth.Guardian

  action_fallback SonGatewayWeb.FallbackController

  ## GET /api/chats — список чатов текущего пользователя
  def index(conn, _params) do
    user_id = Guardian.Plug.current_resource(conn).id
    chats = Chats.list_user_chats(user_id)
    json(conn, %{chats: chats})
  end

  ## GET /api/chats/:id — конкретный чат
  def show(conn, %{"id" => id}) do
    user_id = Guardian.Plug.current_resource(conn).id

    unless Chats.is_member?(id, user_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Нет доступа"})
    else
      case Chats.get_chat(id) do
        nil -> conn |> put_status(:not_found) |> json(%{error: "Чат не найден"})
        chat -> json(conn, %{chat: chat})
      end
    end
  end

  ## POST /api/chats — создать чат
  def create(conn, params) do
    user_id = Guardian.Plug.current_resource(conn).id
    member_ids = Map.get(params, "member_ids", [])
    chat_attrs = Map.take(params, ["type", "name", "description"])

    case Chats.create_chat(chat_attrs, user_id, member_ids) do
      {:ok, chat} ->
        conn |> put_status(:created) |> json(%{chat: chat})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  ## PATCH /api/chats/:id — обновить чат (название, описание)
  def update(conn, %{"id" => id} = params) do
    user_id = Guardian.Plug.current_resource(conn).id

    unless Chats.is_member?(id, user_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Нет доступа"})
    else
      case Chats.get_chat(id) do
        nil ->
          conn |> put_status(:not_found) |> json(%{error: "Чат не найден"})

        chat ->
          attrs = Map.take(params, ["name", "description", "avatar_url"])
          changeset = SonGateway.Chats.Chat.changeset(chat, attrs)
          case SonGateway.Repo.update(changeset) do
            {:ok, updated} -> json(conn, %{chat: updated})
            {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
          end
      end
    end
  end

  ## DELETE /api/chats/:id — удалить чат (только создатель)
  def delete(conn, %{"id" => id}) do
    user_id = Guardian.Plug.current_resource(conn).id

    case Chats.get_chat(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "Чат не найден"})
      %{created_by: ^user_id} = chat ->
        SonGateway.Repo.delete(chat)
        send_resp(conn, :no_content, "")
      _ ->
        conn |> put_status(:forbidden) |> json(%{error: "Только создатель может удалить чат"})
    end
  end
end
