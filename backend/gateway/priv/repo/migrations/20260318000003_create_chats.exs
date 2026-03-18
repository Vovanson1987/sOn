defmodule SonGateway.Repo.Migrations.CreateChats do
  use Ecto.Migration

  def change do
    create table(:chats, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :type, :string, null: false  # direct, group, secret
      add :name, :string
      add :description, :string
      add :avatar_url, :string
      add :created_by, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :member_count, :integer, default: 0
      add :last_message_at, :utc_datetime
      add :last_message_preview, :string

      timestamps()
    end

    create index(:chats, [:created_by])
  end
end
