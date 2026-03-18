defmodule SonGateway.Repo do
  use Ecto.Repo,
    otp_app: :son_gateway,
    adapter: Ecto.Adapters.Postgres
end
