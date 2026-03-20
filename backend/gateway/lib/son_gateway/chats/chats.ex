defmodule SonGateway.Chats do
  @moduledoc "Контекст управления чатами и сообщениями"
  alias SonGateway.Repo
  alias SonGateway.Chats.{Chat, ChatMember, Message}
  alias SonGateway.Accounts.User

  import Ecto.Query

  # ==================== Чаты ====================

  @doc "Список чатов пользователя с последним сообщением и участниками"
  def list_user_chats(user_id) do
    from(cm in ChatMember,
      where: cm.user_id == ^user_id,
      join: c in Chat, on: c.id == cm.chat_id,
      preload: [chat: {c, members: ^members_with_users_query()}],
      select: %{chat: c, unread_count: cm.unread_count},
      order_by: [desc: c.last_message_at, desc: c.inserted_at]
    )
    |> Repo.all()
    |> Enum.map(fn %{chat: chat, unread_count: unread} ->
      last_msg = get_last_message(chat.id)
      Map.merge(chat_to_map(chat), %{
        unread_count: unread,
        last_message: last_msg && message_preview(last_msg)
      })
    end)
  end

  defp members_with_users_query do
    from(cm in ChatMember,
      join: u in User, on: u.id == cm.user_id,
      select: %{id: u.id, display_name: u.display_name, avatar_url: u.avatar_url, is_online: u.is_online}
    )
  end

  defp get_last_message(chat_id) do
    from(m in Message,
      where: m.chat_id == ^chat_id,
      order_by: [desc: m.inserted_at],
      limit: 1
    )
    |> Repo.one()
  end

  defp message_preview(msg) do
    %{content: msg.content, created_at: msg.inserted_at, sender_id: msg.sender_id}
  end

  defp chat_to_map(chat) do
    %{
      id: chat.id,
      type: chat.type,
      name: chat.name,
      avatar_url: chat.avatar_url,
      created_by: chat.created_by,
      member_count: chat.member_count,
      members: Enum.map(chat.members || [], & &1)
    }
  end

  @doc "Получить чат по ID"
  def get_chat(id), do: Repo.get(Chat, id)

  @doc "Проверить является ли пользователь участником чата"
  def is_member?(chat_id, user_id) do
    from(cm in ChatMember,
      where: cm.chat_id == ^chat_id and cm.user_id == ^user_id
    )
    |> Repo.exists?()
  end

  @doc "Создать чат и добавить участников"
  def create_chat(attrs, creator_id, member_ids \\ []) do
    Repo.transaction(fn ->
      chat_attrs = Map.merge(attrs, %{"created_by" => creator_id})

      {:ok, chat} =
        %Chat{}
        |> Chat.changeset(chat_attrs)
        |> Repo.insert()

      # Добавить создателя
      {:ok, _} =
        %ChatMember{}
        |> ChatMember.changeset(%{chat_id: chat.id, user_id: creator_id, role: :admin})
        |> Repo.insert()

      # Добавить участников
      for member_id <- member_ids, member_id != creator_id do
        %ChatMember{}
        |> ChatMember.changeset(%{chat_id: chat.id, user_id: member_id})
        |> Repo.insert()
      end

      # Обновить счётчик
      member_count = 1 + length(Enum.reject(member_ids, &(&1 == creator_id)))
      chat |> Ecto.Changeset.change(member_count: member_count) |> Repo.update!()
    end)
  end

  # ==================== Сообщения ====================

  @doc "Список сообщений чата с пагинацией"
  def list_messages(chat_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 100)
    before = Keyword.get(opts, :before)

    query =
      from(m in Message,
        where: m.chat_id == ^chat_id,
        join: u in User, on: u.id == m.sender_id,
        select: %{
          id: m.id,
          chat_id: m.chat_id,
          sender_id: m.sender_id,
          sender_name: u.display_name,
          content: m.content,
          type: m.type,
          reply_to: m.reply_to,
          created_at: m.inserted_at
        },
        order_by: [asc: m.inserted_at],
        limit: ^limit
      )

    query =
      if before do
        from(m in query, where: m.inserted_at < ^before)
      else
        query
      end

    Repo.all(query)
  end

  @doc "Создать сообщение и обновить чат"
  def create_message(attrs) do
    Repo.transaction(fn ->
      {:ok, message} =
        %Message{}
        |> Message.changeset(attrs)
        |> Repo.insert()

      # Обновить last_message_at и preview в чате
      from(c in Chat, where: c.id == ^message.chat_id)
      |> Repo.update_all(set: [
        last_message_at: DateTime.utc_now(),
        last_message_preview: String.slice(message.content || "", 0, 100)
      ])

      # Инкремент unread для всех кроме отправителя
      from(cm in ChatMember,
        where: cm.chat_id == ^message.chat_id and cm.user_id != ^message.sender_id
      )
      |> Repo.update_all(inc: [unread_count: 1])

      message
    end)
  end

  @doc "Удалить сообщение (только автор)"
  def delete_message(message_id, user_id) do
    case Repo.get(Message, message_id) do
      nil -> {:error, :not_found}
      %{sender_id: ^user_id} = msg -> Repo.delete(msg)
      _ -> {:error, :forbidden}
    end
  end
end
