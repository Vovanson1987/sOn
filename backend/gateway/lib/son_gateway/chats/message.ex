defmodule SonGateway.Chats.Message do
  @moduledoc "Схема сообщения"
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "messages" do
    belongs_to :chat, SonGateway.Chats.Chat
    belongs_to :sender, SonGateway.Accounts.User, foreign_key: :sender_id
    field :content, :string
    field :type, :string, default: "text"
    field :reply_to, :binary_id

    timestamps()
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:chat_id, :sender_id, :content, :type, :reply_to])
    |> validate_required([:chat_id, :sender_id, :content])
  end
end
