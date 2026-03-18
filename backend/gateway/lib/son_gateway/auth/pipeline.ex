defmodule SonGateway.Auth.Pipeline do
  @moduledoc "Plug pipeline для JWT аутентификации"
  use Guardian.Plug.Pipeline,
    otp_app: :son_gateway,
    module: SonGateway.Auth.Guardian,
    error_handler: SonGateway.Auth.ErrorHandler

  plug Guardian.Plug.VerifyHeader, scheme: "Bearer"
  plug Guardian.Plug.EnsureAuthenticated
  plug Guardian.Plug.LoadResource
end

defmodule SonGateway.Auth.ErrorHandler do
  @moduledoc "Обработчик ошибок аутентификации"
  import Plug.Conn

  @behaviour Guardian.Plug.ErrorHandler

  @impl true
  def auth_error(conn, {type, _reason}, _opts) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, Jason.encode!(%{error: "unauthorized", message: to_string(type)}))
  end
end
