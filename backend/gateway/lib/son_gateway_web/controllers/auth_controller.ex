defmodule SonGatewayWeb.AuthController do
  @moduledoc "Контроллер аутентификации: регистрация, вход, refresh, logout"
  use Phoenix.Controller, formats: [:json]

  alias SonGateway.Accounts
  alias SonGateway.Auth.Guardian

  action_fallback SonGatewayWeb.FallbackController

  ## POST /api/auth/register (поддержка email и phone)
  def register(conn, %{"display_name" => _name, "password" => _pass} = params) do
    case Accounts.register_user(params) do
      {:ok, user} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(user)

        conn
        |> put_status(:created)
        |> json(%{
          token: token,
          user: user_json(user)
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_error", details: format_errors(changeset)})
    end
  end

  ## POST /api/auth/login (поддержка email и phone)
  def login(conn, %{"password" => password} = params) do
    # Принимаем email или phone
    identifier = params["email"] || params["phone"]

    unless identifier do
      conn
      |> put_status(:bad_request)
      |> json(%{error: "Укажите email или phone"})
    else
      case Accounts.authenticate(identifier, password) do
        {:ok, user} ->
          {:ok, token, _claims} = Guardian.encode_and_sign(user)
          Accounts.set_online(user.id, true)

          conn
          |> json(%{
            token: token,
            user: user_json(user)
          })

        {:error, _reason} ->
          conn
          |> put_status(:unauthorized)
          |> json(%{error: "Неверный email или пароль"})
      end
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
        |> json(%{error: "Невалидный токен"})
    end
  end

  ## POST /api/auth/logout
  def logout(conn, _params) do
    token = Guardian.Plug.current_token(conn)

    case Guardian.revoke(token) do
      {:ok, _} -> send_resp(conn, :no_content, "")
      {:error, _} -> send_resp(conn, :no_content, "")
    end
  end

  ## GET /api/auth/sessions
  def sessions(conn, _params) do
    json(conn, %{sessions: []})
  end

  ## DELETE /api/auth/sessions/:device_id
  def revoke_session(conn, %{"device_id" => _device_id}) do
    send_resp(conn, :no_content, "")
  end

  defp user_json(user) do
    %{
      id: user.id,
      email: user.email,
      phone: user.phone,
      display_name: user.display_name,
      username: user.username,
      avatar_url: user.avatar_url
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
