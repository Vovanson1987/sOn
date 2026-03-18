defmodule SonGateway.Chats.Chat do
  @moduledoc "Схема чата (direct, group, secret)"
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "chats" do
    field :type, Ecto.Enum, values: [:direct, :group, :secret]
    field :name, :string
    field :description, :string
    field :avatar_url, :string
    field :created_by, :binary_id
    field :member_count, :integer, default: 0
    field :last_message_at, :utc_datetime
    field :last_message_preview, :string

    has_many :members, SonGateway.Chats.ChatMember

    timestamps()
  end

  def changeset(chat, attrs) do
    chat
    |> cast(attrs, [:type, :name, :description, :avatar_url, :created_by])
    |> validate_required([:type])
    |> validate_inclusion(:type, [:direct, :group, :secret])
  end
end
