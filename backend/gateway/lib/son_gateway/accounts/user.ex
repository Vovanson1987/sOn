defmodule SonGateway.Accounts.User do
  @moduledoc "Схема пользователя"
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field :email, :string
    field :phone, :string
    field :username, :string
    field :display_name, :string
    field :avatar_url, :string
    field :status_text, :string
    field :password_hash, :string
    field :password, :string, virtual: true
    field :is_online, :boolean, default: false
    field :last_seen_at, :utc_datetime

    timestamps()
  end

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :phone, :username, :display_name, :password])
    |> validate_required([:display_name, :password])
    |> validate_email_or_phone()
    |> validate_length(:password, min: 6, max: 72)
    |> validate_length(:display_name, min: 1, max: 100)
    |> unique_constraint(:email)
    |> unique_constraint(:phone)
    |> unique_constraint(:username)
    |> hash_password()
  end

  defp validate_email_or_phone(changeset) do
    email = get_change(changeset, :email)
    phone = get_change(changeset, :phone)

    cond do
      email && email != "" ->
        changeset |> validate_format(:email, ~r/@/)
      phone && phone != "" ->
        changeset |> validate_length(:phone, min: 10, max: 15)
      true ->
        add_error(changeset, :email, "email или телефон обязателен")
    end
  end

  def profile_changeset(user, attrs) do
    user
    |> cast(attrs, [:display_name, :username, :avatar_url, :status_text])
    |> validate_length(:display_name, min: 1, max: 100)
    |> unique_constraint(:username)
  end

  defp hash_password(%Ecto.Changeset{valid?: true, changes: %{password: password}} = changeset) do
    put_change(changeset, :password_hash, Argon2.hash_pwd_salt(password))
  end

  defp hash_password(changeset), do: changeset
end
