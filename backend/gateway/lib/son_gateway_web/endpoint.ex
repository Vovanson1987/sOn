defmodule SonGatewayWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :son_gateway

  socket "/socket", SonGatewayWeb.UserSocket,
    websocket: true,
    longpoll: false

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug CORSPlug
  plug SonGatewayWeb.Router
end
