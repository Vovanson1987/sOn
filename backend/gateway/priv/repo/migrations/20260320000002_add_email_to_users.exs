defmodule SonGateway.Repo.Migrations.AddEmailToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :email, :string
    end

    create unique_index(:users, [:email])

    # Сделать phone опциональным (убрать NOT NULL)
    alter table(:users) do
      modify :phone, :string, null: true
    end
  end
end
