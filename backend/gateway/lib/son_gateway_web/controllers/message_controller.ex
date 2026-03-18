defmodule SonGatewayWeb.MessageController do
  @moduledoc "Контроллер сообщений"
  use Phoenix.Controller, formats: [:json]

  action_fallback SonGatewayWeb.FallbackController

  def index(conn, %{"chat_id" => _chat_id}), do: json(conn, %{messages: []})
  def create(conn, _params), do: conn |> put_status(:created) |> json(%{status: "sent"})
  def delete(conn, _params), do: send_resp(conn, :no_content, "")
end
