defmodule SonGateway.Repo.Migrations.CreateDevices do
  use Ecto.Migration

  def change do
    create table(:devices, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :device_name, :string
      add :platform, :string  # web, android, ios
      add :push_token, :string
      add :last_active_at, :utc_datetime

      timestamps()
    end

    create index(:devices, [:user_id])
    create unique_index(:devices, [:push_token], where: "push_token IS NOT NULL")
  end
end
