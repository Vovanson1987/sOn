defmodule SonGateway.Chats.ChatMember do
  @moduledoc "Участник чата"
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "chat_members" do
    belongs_to :chat, SonGateway.Chats.Chat
    belongs_to :user, SonGateway.Accounts.User
    field :role, Ecto.Enum, values: [:admin, :member], default: :member
    field :unread_count, :integer, default: 0
    field :is_muted, :boolean, default: false
    field :is_archived, :boolean, default: false

    timestamps()
  end

  def changeset(member, attrs) do
    member
    |> cast(attrs, [:chat_id, :user_id, :role])
    |> validate_required([:chat_id, :user_id])
    |> unique_constraint([:chat_id, :user_id])
  end
end
