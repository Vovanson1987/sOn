defmodule SonGatewayWeb.ContactController do
  @moduledoc "Контроллер контактов"
  use Phoenix.Controller, formats: [:json]

  action_fallback SonGatewayWeb.FallbackController

  ## GET /api/contacts
  def index(conn, _params) do
    # TODO: получить контакты из БД
    json(conn, %{contacts: []})
  end

  ## POST /api/contacts
  def create(conn, _params) do
    # TODO: создать контакт
    conn
    |> put_status(:created)
    |> json(%{status: "created"})
  end

  ## DELETE /api/contacts/:id
  def delete(conn, %{"id" => _id}) do
    send_resp(conn, :no_content, "")
  end
end
