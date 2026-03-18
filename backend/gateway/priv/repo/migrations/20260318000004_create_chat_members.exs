defmodule SonGateway.Repo.Migrations.CreateChatMembers do
  use Ecto.Migration

  def change do
    create table(:chat_members, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :chat_id, references(:chats, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :role, :string, default: "member"  # admin, member
      add :unread_count, :integer, default: 0
      add :is_muted, :boolean, default: false
      add :is_archived, :boolean, default: false

      timestamps()
    end

    create unique_index(:chat_members, [:chat_id, :user_id])
    create index(:chat_members, [:user_id])
  end
end
