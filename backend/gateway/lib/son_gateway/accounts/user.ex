defmodule SonGateway.Accounts.User do
  @moduledoc "Схема пользователя"
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
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
    |> cast(attrs, [:phone, :username, :display_name, :password])
    |> validate_required([:phone, :display_name, :password])
    |> validate_length(:phone, min: 10, max: 15)
    |> validate_length(:password, min: 8, max: 72)
    |> validate_length(:display_name, min: 1, max: 100)
    |> unique_constraint(:phone)
    |> unique_constraint(:username)
    |> hash_password()
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
