defmodule SonGateway.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :phone, :string, null: false
      add :username, :string
      add :display_name, :string, null: false
      add :avatar_url, :string
      add :status_text, :string
      add :password_hash, :string, null: false
      add :is_online, :boolean, default: false
      add :last_seen_at, :utc_datetime
      add :show_online, :string, default: "everyone"

      timestamps()
    end

    create unique_index(:users, [:phone])
    create unique_index(:users, [:username])
  end
end
