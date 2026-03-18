defmodule SonGatewayWeb.FallbackController do
  @moduledoc "Обработка ошибок контроллеров"
  use Phoenix.Controller

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> json(%{error: "not_found", message: "Ресурс не найден"})
  end

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)

    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "validation_error", details: errors})
  end

  def call(conn, {:error, :unauthorized}) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "unauthorized", message: "Нет доступа"})
  end
end
