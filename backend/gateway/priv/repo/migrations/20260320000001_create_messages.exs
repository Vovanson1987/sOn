defmodule SonGateway.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def change do
    create table(:messages, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :chat_id, references(:chats, type: :binary_id, on_delete: :delete_all), null: false
      add :sender_id, references(:users, type: :binary_id, on_delete: :nilify_all), null: false
      add :content, :text
      add :type, :string, default: "text"
      add :reply_to, :binary_id

      timestamps()
    end

    create index(:messages, [:chat_id, :inserted_at])
    create index(:messages, [:sender_id])
  end
end
