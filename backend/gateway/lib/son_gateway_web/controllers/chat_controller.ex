defmodule SonGatewayWeb.ChatController do
  @moduledoc "Контроллер чатов"
  use Phoenix.Controller, formats: [:json]

  action_fallback SonGatewayWeb.FallbackController

  def index(conn, _params), do: json(conn, %{chats: []})
  def show(conn, %{"id" => _id}), do: json(conn, %{chat: nil})
  def create(conn, _params), do: conn |> put_status(:created) |> json(%{status: "created"})
  def update(conn, _params), do: json(conn, %{status: "updated"})
  def delete(conn, _params), do: send_resp(conn, :no_content, "")
end
