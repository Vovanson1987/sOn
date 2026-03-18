defmodule SonGateway.Repo.Migrations.CreateContacts do
  use Ecto.Migration

  def change do
    create table(:contacts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :contact_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :nickname, :string
      add :is_blocked, :boolean, default: false

      timestamps()
    end

    create unique_index(:contacts, [:user_id, :contact_id])
    create index(:contacts, [:contact_id])
  end
end
