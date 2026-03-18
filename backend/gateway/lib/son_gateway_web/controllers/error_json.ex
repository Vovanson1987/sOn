defmodule SonGatewayWeb.ErrorJSON do
  @moduledoc "Форматирование ошибок в JSON"

  def render("404.json", _assigns) do
    %{error: "not_found", message: "Ресурс не найден"}
  end

  def render("500.json", _assigns) do
    %{error: "internal_server_error", message: "Внутренняя ошибка сервера"}
  end

  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end
