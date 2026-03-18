defmodule SonGatewayWeb.UserController do
  @moduledoc "Контроллер профиля и поиска пользователей"
  use Phoenix.Controller, formats: [:json]

  alias SonGateway.Accounts
  alias SonGateway.Auth.Guardian

  action_fallback SonGatewayWeb.FallbackController

  ## GET /api/users/me
  def me(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    json(conn, %{
      id: user.id,
      phone: user.phone,
      display_name: user.display_name,
      username: user.username,
      avatar_url: user.avatar_url,
      status_text: user.status_text,
      is_online: user.is_online
    })
  end

  ## PATCH /api/users/me
  def update(conn, params) do
    user = Guardian.Plug.current_resource(conn)

    case Accounts.update_profile(user, params) do
      {:ok, updated} ->
        json(conn, %{
          id: updated.id,
          display_name: updated.display_name,
          username: updated.username,
          avatar_url: updated.avatar_url,
          status_text: updated.status_text
        })

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  ## GET /api/users/search?q=
  def search(conn, %{"q" => query}) do
    users = Accounts.search_users(query)
    json(conn, %{users: users})
  end

  def search(conn, _params) do
    json(conn, %{users: []})
  end
end
