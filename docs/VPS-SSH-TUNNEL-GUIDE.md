# Обратный SSH-туннель к VPS — Инструкция

## Обзор

Обратный SSH-туннель позволяет подключаться **с VPS к вашему компьютеру**, даже если компьютер находится за NAT/роутером.

### Схема работы

```
┌──────────────┐                          ┌──────────────┐
│  Ваш ПК      │───── постоянный SSH ────▶│  VPS         │
│  (за NAT)    │                          │  213.165.39.215
│              │◀──── через туннель ──────│              │
└──────────────┘     (localhost:PORT)      └──────────────┘
```

**Принцип:** ваш ПК держит постоянное SSH-соединение к VPS и «пробрасывает» свой порт 22 на порт VPS. VPS подключается к `localhost:PORT` и попадает на ваш ПК.

### Карта портов

| Устройство | Порт туннеля | Алиас на VPS |
|------------|-------------|-------------|
| MacBook    | 2222        | `ssh mac`     |
| Windows    | 2223        | `ssh windows` |
| Linux      | 2224        | `ssh linux`   |

---

## MacOS

### 1. Включить SSH на Mac

```bash
sudo systemsetup -setremotelogin on
```

Или: **Системные настройки → Основные → Общий доступ → Удалённый вход**

### 2. Настроить SSH-конфиг для подключения к VPS

```bash
cat >> ~/.ssh/config << 'EOF'

# --- VPS Aeza ---
Host vps
	HostName 213.165.39.215
	User son
	IdentityFile ~/.ssh/id_ed25519
	AddKeysToAgent yes
	UseKeychain yes
# ----------------
EOF
```

### 3. Сгенерировать ключ (если нет)

```bash
ssh-keygen -t ed25519
```

### 4. Скопировать ключ на VPS

```bash
ssh-copy-id son@213.165.39.215
```

### 5. Скопировать ключ VPS на Mac

```bash
ssh son@213.165.39.215 "cat ~/.ssh/id_ed25519.pub" >> ~/.ssh/authorized_keys
```

### 6. Проверить туннель вручную

```bash
# Запустить туннель
ssh -f -N -R 2222:localhost:22 vps

# Проверить с VPS
ssh vps "ssh -p 2222 vovanson@localhost 'hostname'"
```

### 7. Автозапуск через launchd

```bash
cat > ~/Library/LaunchAgents/com.ssh.reverse-tunnel.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ssh.reverse-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>-R</string>
        <string>2222:localhost:22</string>
        <string>-o</string>
        <string>ServerAliveInterval=60</string>
        <string>-o</string>
        <string>ServerAliveCountMax=3</string>
        <string>-o</string>
        <string>ExitOnForwardFailure=yes</string>
        <string>vps</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/ssh-tunnel.err</string>
</dict>
</plist>
EOF

# Активировать
launchctl load ~/Library/LaunchAgents/com.ssh.reverse-tunnel.plist
```

### 8. Добавить алиас на VPS

```bash
# Выполнить на VPS:
cat >> ~/.ssh/config << 'EOF'

Host mac
	HostName localhost
	Port 2222
	User vovanson
	StrictHostKeyChecking no
EOF
```

Теперь на VPS: `ssh mac`

### Управление туннелем

```bash
# Остановить
launchctl unload ~/Library/LaunchAgents/com.ssh.reverse-tunnel.plist

# Запустить
launchctl load ~/Library/LaunchAgents/com.ssh.reverse-tunnel.plist

# Проверить логи ошибок
cat /tmp/ssh-tunnel.err
```

---

## Windows

### 1. Установить OpenSSH

```powershell
# PowerShell от администратора
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

### 2. Запустить SSH-сервер

```powershell
# PowerShell от администратора
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

### 3. Сгенерировать SSH-ключ

```powershell
ssh-keygen -t ed25519
```

### 4. Скопировать ключ на VPS

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh son@213.165.39.215 "cat >> ~/.ssh/authorized_keys"
```

### 5. Скопировать ключ VPS на Windows

```powershell
# Обычный пользователь:
ssh son@213.165.39.215 "cat ~/.ssh/id_ed25519.pub" >> $env:USERPROFILE\.ssh\authorized_keys

# Если пользователь — администратор, также добавить в:
ssh son@213.165.39.215 "cat ~/.ssh/id_ed25519.pub" >> C:\ProgramData\ssh\administrators_authorized_keys
```

### 6. Настроить SSH-конфиг

Создать/дополнить файл `C:\Users\ИМЯ\.ssh\config`:

```
Host vps
	HostName 213.165.39.215
	User son
	IdentityFile C:\Users\ИМЯ\.ssh\id_ed25519
```

### 7. Проверить туннель вручную

```powershell
ssh -N -R 2223:localhost:22 -o ServerAliveInterval=60 vps
```

В отдельном терминале или с VPS:
```bash
ssh -p 2223 ИМЯ@localhost "hostname"
```

### 8. Автозапуск через Планировщик задач

```powershell
# PowerShell от администратора
$action = New-ScheduledTaskAction `
  -Execute "C:\Windows\System32\OpenSSH\ssh.exe" `
  -Argument "-N -R 2223:localhost:22 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -i $env:USERPROFILE\.ssh\id_ed25519 son@213.165.39.215"

$trigger = New-ScheduledTaskTrigger -AtLogon

$settings = New-ScheduledTaskSettingsSet `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -RestartCount 999 `
  -ExecutionTimeLimit 0

Register-ScheduledTask `
  -TaskName "SSH-Reverse-Tunnel" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Обратный SSH-туннель к VPS"
```

### 9. Добавить алиас на VPS

```bash
# Выполнить на VPS:
cat >> ~/.ssh/config << 'EOF'

Host windows
	HostName localhost
	Port 2223
	User ИМЯ_ПОЛЬЗОВАТЕЛЯ_WINDOWS
	StrictHostKeyChecking no
EOF
```

Теперь на VPS: `ssh windows`

### Управление туннелем

```powershell
# Остановить
Stop-ScheduledTask -TaskName "SSH-Reverse-Tunnel"

# Запустить
Start-ScheduledTask -TaskName "SSH-Reverse-Tunnel"

# Удалить
Unregister-ScheduledTask -TaskName "SSH-Reverse-Tunnel" -Confirm:$false
```

---

## Linux

### 1. Установить SSH-сервер

```bash
sudo apt install openssh-server -y
sudo systemctl enable ssh
sudo systemctl start ssh
```

### 2. Сгенерировать SSH-ключ

```bash
ssh-keygen -t ed25519
```

### 3. Скопировать ключ на VPS

```bash
ssh-copy-id son@213.165.39.215
```

### 4. Скопировать ключ VPS на Linux

```bash
ssh son@213.165.39.215 "cat ~/.ssh/id_ed25519.pub" >> ~/.ssh/authorized_keys
```

### 5. Настроить SSH-конфиг

```bash
cat >> ~/.ssh/config << 'EOF'

Host vps
	HostName 213.165.39.215
	User son
	IdentityFile ~/.ssh/id_ed25519
EOF
```

### 6. Проверить туннель вручную

```bash
# Запустить
ssh -f -N -R 2224:localhost:22 vps

# Проверить с VPS
ssh vps "ssh -p 2224 ИМЯ@localhost 'hostname'"
```

### 7. Автозапуск через systemd

```bash
sudo tee /etc/systemd/system/ssh-tunnel.service << 'EOF'
[Unit]
Description=Reverse SSH Tunnel to VPS
After=network-online.target
Wants=network-online.target

[Service]
User=ИМЯ_ПОЛЬЗОВАТЕЛЯ
ExecStart=/usr/bin/ssh -N -R 2224:localhost:22 \
  -o ServerAliveInterval=60 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -i /home/ИМЯ_ПОЛЬЗОВАТЕЛЯ/.ssh/id_ed25519 \
  son@213.165.39.215
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ssh-tunnel
sudo systemctl start ssh-tunnel
```

### 8. Добавить алиас на VPS

```bash
# Выполнить на VPS:
cat >> ~/.ssh/config << 'EOF'

Host linux
	HostName localhost
	Port 2224
	User ИМЯ_ПОЛЬЗОВАТЕЛЯ_LINUX
	StrictHostKeyChecking no
EOF
```

Теперь на VPS: `ssh linux`

### Управление туннелем

```bash
# Статус
sudo systemctl status ssh-tunnel

# Остановить
sudo systemctl stop ssh-tunnel

# Перезапустить
sudo systemctl restart ssh-tunnel

# Логи
journalctl -u ssh-tunnel -f
```

---

## Устранение неполадок

### Туннель не подключается

```bash
# Проверить, занят ли порт на VPS
ssh vps "ss -tlnp | grep 222"

# Убить старые туннели
ssh vps "pkill -f 'sshd.*222'"
```

### Порт на VPS не открывается

Проверить, что в `/etc/ssh/sshd_config` на VPS есть:
```
GatewayPorts clientspecified
```

Если нет — добавить и перезапустить SSH:
```bash
sudo systemctl restart ssh
```

### Туннель отваливается

Убедиться, что настроены keepalive:
- `ServerAliveInterval=60` — пинг каждые 60 секунд
- `ServerAliveCountMax=3` — отключение после 3 пропущенных пингов
- Автоперезапуск через launchd/systemd/Планировщик задач

### Проверка работоспособности

```bash
# С VPS проверить все туннели:
echo "=== Mac ===" && ssh -o ConnectTimeout=3 mac "hostname" 2>/dev/null || echo "Недоступен"
echo "=== Windows ===" && ssh -o ConnectTimeout=3 windows "hostname" 2>/dev/null || echo "Недоступен"
echo "=== Linux ===" && ssh -o ConnectTimeout=3 linux "hostname" 2>/dev/null || echo "Недоступен"
```

---

## Безопасность

- Все соединения через SSH (шифрованы)
- Авторизация только по ключам (без паролей)
- Туннели доступны только на `localhost` VPS (не извне)
- Рекомендуется периодически менять SSH-ключи
