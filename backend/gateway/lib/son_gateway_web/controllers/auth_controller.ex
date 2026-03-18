defmodule SonGatewayWeb.AuthController do
  @moduledoc "Контроллер аутентификации: регистрация, вход, refresh"
  use Phoenix.Controller, formats: [:json]

  alias SonGateway.Accounts
  alias SonGateway.Auth.Guardian

  action_fallback SonGatewayWeb.FallbackController

  ## POST /api/auth/register
  def register(conn, %{"phone" => _phone, "display_name" => _name, "password" => _pass} = params) do
    case Accounts.register_user(params) do
      {:ok, user} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(user)

        conn
        |> put_status(:created)
        |> json(%{
          token: token,
          user: %{
            id: user.id,
            phone: user.phone,
            display_name: user.display_name,
            username: user.username
          }
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_error", details: format_errors(changeset)})
    end
  end

  ## POST /api/auth/login
  def login(conn, %{"phone" => phone, "password" => password}) do
    case Accounts.authenticate(phone, password) do
      {:ok, user} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(user)

        conn
        |> json(%{
          token: token,
          user: %{
            id: user.id,
            phone: user.phone,
            display_name: user.display_name,
            username: user.username,
            avatar_url: user.avatar_url
          }
        })

      {:error, _reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "unauthorized", message: "Неверный телефон или пароль"})
    end
  end

  ## POST /api/auth/refresh
  def refresh(conn, _params) do
    old_token = Guardian.Plug.current_token(conn)

    case Guardian.refresh(old_token) do
      {:ok, _old, {new_token, _claims}} ->
        json(conn, %{token: new_token})

      {:error, _reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "unauthorized", message: "Невалидный токен"})
    end
  end

  ## POST /api/auth/logout
  def logout(conn, _params) do
    token = Guardian.Plug.current_token(conn)
    Guardian.revoke(token)
    send_resp(conn, :no_content, "")
  end

  ## GET /api/auth/sessions
  def sessions(conn, _params) do
    json(conn, %{sessions: []})
  end

  ## DELETE /api/auth/sessions/:device_id
  def revoke_session(conn, %{"device_id" => _device_id}) do
    send_resp(conn, :no_content, "")
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
