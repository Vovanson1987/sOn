defmodule SonGateway.Accounts do
  @moduledoc "Контекст управления пользователями"
  alias SonGateway.Repo
  alias SonGateway.Accounts.User

  import Ecto.Query

  ## Регистрация

  def register_user(attrs) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  ## Аутентификация (поддержка email и phone)

  def authenticate(identifier, password) do
    user = find_user_by_identifier(identifier)

    case user do
      nil -> {:error, :not_found}
      user ->
        if Argon2.verify_pass(password, user.password_hash) do
          {:ok, user}
        else
          {:error, :invalid_password}
        end
    end
  end

  defp find_user_by_identifier(identifier) do
    if String.contains?(identifier, "@") do
      Repo.get_by(User, email: identifier)
    else
      Repo.get_by(User, phone: identifier)
    end
  end

  ## Профиль

  def get_user(id), do: Repo.get(User, id)

  def get_user_by_email(email), do: Repo.get_by(User, email: email)
  def get_user_by_phone(phone), do: Repo.get_by(User, phone: phone)

  def update_profile(user, attrs) do
    user
    |> User.profile_changeset(attrs)
    |> Repo.update()
  end

  ## Поиск

  def search_users(query_string) do
    pattern = "%#{query_string}%"

    from(u in User,
      where: ilike(u.display_name, ^pattern) or ilike(u.username, ^pattern) or ilike(u.phone, ^pattern),
      limit: 20,
      select: [:id, :display_name, :username, :phone, :avatar_url, :is_online]
    )
    |> Repo.all()
  end

  ## Онлайн-статус

  def set_online(user_id, online?) do
    from(u in User, where: u.id == ^user_id)
    |> Repo.update_all(set: [
      is_online: online?,
      last_seen_at: if(online?, do: nil, else: DateTime.utc_now())
    ])
  end
end
