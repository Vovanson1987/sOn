defmodule SonGateway.Auth.Guardian do
  @moduledoc "Guardian: JWT аутентификация"
  use Guardian, otp_app: :son_gateway

  alias SonGateway.Accounts

  def subject_for_token(%{id: id}, _claims), do: {:ok, id}
  def subject_for_token(_, _), do: {:error, :invalid_resource}

  def resource_from_claims(%{"sub" => user_id}) do
    case Accounts.get_user(user_id) do
      nil -> {:error, :not_found}
      user -> {:ok, user}
    end
  end

  def resource_from_claims(_), do: {:error, :invalid_claims}
end
