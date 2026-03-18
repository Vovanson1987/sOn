# sOn Messenger — Infrastructure & DevOps

## 1. Среды развёртывания

| Среда | Назначение | URL |
|-------|-----------|-----|
| **Local** | Разработка | localhost:5173 (frontend), localhost:4000 (backend) |
| **Staging** | Тестирование | staging.son-messenger.com |
| **Production** | Продакшн | son-messenger.com |

### 1.1 Staging

- **1 replica** каждого сервиса (gateway, crypto, push)
- Синтетические тестовые данные (seed-скрипты)
- Отдельный Vault path: `secret/son/staging/`
- Отдельный Kubernetes namespace: `son-staging-*`
- Автоматический деплой при push в ветку `dev`

### 1.2 Production

- **Multi-replica** для всех сервисов (gateway: 3+, crypto: 2+, push: 2+)
- **Auto-scaling** через HPA (см. раздел 3.3)
- Vault path: `secret/son/production/`
- Деплой только после merge в `master` и ручного approve

### 1.3 Конфигурация через Kustomize

```
k8s/
├── base/                     # Общие манифесты (Deployments, Services, ConfigMaps)
│   ├── kustomization.yaml
│   ├── gateway-deployment.yaml
│   ├── crypto-deployment.yaml
│   └── push-deployment.yaml
├── overlays/
│   ├── staging/              # replicas: 1, resource limits снижены
│   │   ├── kustomization.yaml
│   │   └── patch-replicas.yaml
│   └── production/           # replicas: 3+, HPA, PDB, полные resource limits
│       ├── kustomization.yaml
│       ├── patch-replicas.yaml
│       └── patch-hpa.yaml
```

---

## 2. Docker — Локальная разработка

### 2.1 docker-compose.yml

```yaml
version: '3.9'

services:
  # ── Frontend ──
  web:
    build: ./webApp
    restart: unless-stopped
    ports:
      - "5173:5173"
    volumes:
      - ./webApp/src:/app/src
    environment:
      - VITE_API_URL=http://localhost:4000
      - VITE_WS_URL=ws://localhost:4000
    networks: [son-network]

  # ── Backend Gateway ──
  gateway:
    build: ./backend/gateway
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=ecto://postgres:postgres@postgres:5432/son_dev
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
      - SECRET_KEY_BASE=${SECRET_KEY_BASE}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    networks: [son-network]

  # ── Crypto Service ──
  crypto:
    build: ./backend/crypto-service
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/son_dev
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      postgres:
        condition: service_healthy
      scylladb:
        condition: service_healthy
      minio:
        condition: service_started
      kafka:
        condition: service_healthy
    networks: [son-network]

  # ── Push Service ──
  push:
    build: ./backend/push-service
    restart: unless-stopped
    ports:
      - "9090:9090"
    environment:
      - KAFKA_BROKERS=kafka:9092
      - REDIS_URL=redis://redis:6379
    networks: [son-network]

  # ── Databases ──
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=son_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks: [son-network]

  scylladb:
    image: scylladb/scylla:5.4
    restart: unless-stopped
    ports:
      - "9042:9042"
    volumes:
      - scylla_data:/var/lib/scylla
    command: --smp 2 --memory 1G
    healthcheck:
      test: ["CMD-SHELL", "nodetool status | grep -q UN"]
      interval: 10s
      timeout: 10s
      retries: 10
    networks: [son-network]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks: [son-network]

  # ── Object Storage ──
  minio:
    image: minio/minio:RELEASE.2024-11-07T00-52-20Z
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY:-minioadmin}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks: [son-network]

  # ── Message Bus ──
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    restart: unless-stopped
    environment:
      - ZOOKEEPER_CLIENT_PORT=2181
    networks: [son-network]

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    restart: unless-stopped
    ports:
      - "9092:9092"
    environment:
      - KAFKA_BROKER_ID=1
      - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
      - KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
    depends_on:
      - zookeeper
    healthcheck:
      test: ["CMD-SHELL", "kafka-broker-api-versions --bootstrap-server localhost:9092"]
      interval: 10s
      timeout: 10s
      retries: 5
    networks: [son-network]

  # ── TURN/STUN Server ──
  coturn:
    image: coturn/coturn:4.6
    restart: unless-stopped
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "5349:5349/udp"
      - "5349:5349/tcp"
      - "49152-49252:49152-49252/udp"
    environment:
      - TURN_REALM=son-messenger.com
      - TURN_SECRET=${TURN_SECRET}
    command: >
      -n --log-file=stdout
      --realm=son-messenger.com
      --use-auth-secret
      --static-auth-secret=${TURN_SECRET}
      --min-port=49152 --max-port=49252
    networks: [son-network]

volumes:
  postgres_data:
  scylla_data:
  redis_data:
  minio_data:

networks:
  son-network:
    driver: bridge
```

### 2.2 Переменные окружения (.env.example)

Для запуска `docker-compose` необходим файл `.env`. Шаблон — `.env.example`:

```env
# .env.example — скопировать в .env и заполнить

# Gateway
SECRET_KEY_BASE=generate-with-mix-phx-gen-secret

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# TURN/STUN (coturn)
TURN_SECRET=generate-strong-random-secret

# Vault (production)
VAULT_TOKEN=
VAULT_ADDR=https://vault.son-messenger.com
```

---

## 3. Kubernetes — Production

### 3.1 Архитектура кластера

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Istio Service Mesh                  │   │
│  │                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ Gateway  │  │  Crypto  │  │   Push   │           │   │
│  │  │ 3 pods   │  │  2 pods  │  │  2 pods  │           │   │
│  │  │ Elixir   │  │   Rust   │  │    Go    │           │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘           │   │
│  │       │              │              │                 │   │
│  │  ┌────┴──────────────┴──────────────┘                │   │
│  │  │            Kafka Cluster (3 brokers)              │   │
│  │  └──────────────────┬────────────────┘               │   │
│  │                     │                                 │   │
│  └─────────────────────┼─────────────────────────────────┘   │
│                        │                                     │
│  ┌─────────┐  ┌───────┴───┐  ┌─────────┐  ┌─────────┐     │
│  │ScyllaDB │  │PostgreSQL │  │  Redis  │  │  MinIO  │     │
│  │ 3 nodes │  │ Primary + │  │ Cluster │  │ 4 nodes │     │
│  │         │  │ 2 Replica │  │ 3 nodes │  │         │     │
│  └─────────┘  └───────────┘  └─────────┘  └─────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Monitoring: Prometheus + Grafana + Jaeger             │   │
│  │ Secrets:    HashiCorp Vault                           │   │
│  │ Ingress:    Envoy + Cert-Manager (Let's Encrypt)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Namespace Structure

```
son-apps/             # gateway, crypto, push pods
son-databases/        # PostgreSQL, ScyllaDB, Redis StatefulSets
son-storage/          # MinIO
son-messaging/        # Kafka + Zookeeper
son-monitoring/       # Prometheus, Grafana, Jaeger, Loki
son-security/         # Vault, cert-manager
son-media/            # coturn (TURN/STUN)
```

### 3.3 Autoscaling

```yaml
# Gateway — HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: websocket_connections
      target:
        type: AverageValue
        averageValue: "5000"    # Scale at 5000 WS per pod
```

```yaml
# Crypto Service — HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crypto-hpa
  namespace: son-apps
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crypto
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75
```

```yaml
# Push Service — HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: push-hpa
  namespace: son-apps
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: push
  minReplicas: 2
  maxReplicas: 15
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 3.4 PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: gateway-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: gateway
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: crypto-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: crypto
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: push-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: push
```

---

## 4. CI/CD Pipeline

### 4.1 GitHub Actions

```
Push to dev → Lint + Test → Build Docker → Deploy Staging
                                                  ↓
                                          E2E Tests (Playwright)
                                                  ↓
                                          PR to master
                                                  ↓
                                          Review + Approve
                                                  ↓
                                          Merge → Deploy Production
```

### 4.2 Workflow — Frontend

```yaml
# .github/workflows/frontend.yml
name: Frontend CI

on:
  push:
    branches: [dev]
    paths: ['webApp/**']
  pull_request:
    branches: [master]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: webApp/package-lock.json
      - run: cd webApp && npm ci
      - run: cd webApp && npm run lint
      - run: cd webApp && npm run type-check
      - run: cd webApp && npm run test -- --coverage

  build:
    needs: lint-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd webApp && npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: webApp/dist/

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/dev'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          # kubectl apply or docker push to staging registry
```

### 4.3 Workflow — Backend Gateway (Elixir)

```yaml
# .github/workflows/backend-gateway.yml
name: Backend Gateway CI
on:
  push:
    branches: [dev]
    paths: ['backend/gateway/**']
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: son_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          elixir-version: '1.16'
          otp-version: '26'
      - run: cd backend/gateway && mix deps.get
      - run: cd backend/gateway && mix compile --warnings-as-errors
      - run: cd backend/gateway && mix credo --strict
      - run: cd backend/gateway && mix dialyzer
      - run: cd backend/gateway && mix test --cover
```

### 4.4 Workflow — Backend Crypto (Rust)

```yaml
# .github/workflows/backend-crypto.yml
name: Backend Crypto CI
on:
  push:
    branches: [dev]
    paths: ['backend/crypto-service/**']
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - run: cd backend/crypto-service && cargo fmt -- --check
      - run: cd backend/crypto-service && cargo clippy -- -D warnings
      - run: cd backend/crypto-service && cargo test
```

### 4.5 Workflow — Backend Push (Go)

```yaml
# .github/workflows/backend-push.yml
name: Backend Push CI
on:
  push:
    branches: [dev]
    paths: ['backend/push-service/**']
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: cd backend/push-service && go vet ./...
      - run: cd backend/push-service && golangci-lint run
      - run: cd backend/push-service && go test -race ./...
```

### 4.6 Workflow — Docker Build & Security Scan

```yaml
# .github/workflows/docker-security.yml
name: Docker Build & Security Scan
on:
  push:
    branches: [dev]
jobs:
  build-scan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [gateway, crypto-service, push-service]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: ./backend/${{ matrix.service }}
          push: false
          tags: son/${{ matrix.service }}:${{ github.sha }}
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: son/${{ matrix.service }}:${{ github.sha }}
          severity: CRITICAL,HIGH
```

---

## 5. Мониторинг

### 5.1 Метрики (Prometheus)

| Метрика | Тип | Описание |
|---------|-----|----------|
| `ws_connections_total` | Gauge | Активные WebSocket-соединения |
| `messages_sent_total` | Counter | Всего отправленных сообщений |
| `messages_delivered_total` | Counter | Доставленных сообщений |
| `message_latency_ms` | Histogram | Задержка доставки сообщений |
| `api_request_duration_ms` | Histogram | Время ответа REST API |
| `api_errors_total` | Counter | Ошибки API по кодам |
| `crypto_operations_total` | Counter | Криптографические операции |
| `media_upload_size_bytes` | Histogram | Размер загружаемых файлов |
| `push_sent_total` | Counter | Отправленные push-уведомления |
| `push_errors_total` | Counter | Ошибки push |
| `db_query_duration_ms` | Histogram | Задержка запросов PostgreSQL/ScyllaDB |
| `kafka_consumer_lag` | Gauge | Отставание consumer'ов Kafka |
| `redis_memory_usage_bytes` | Gauge | Использование памяти Redis |
| `redis_eviction_total` | Counter | Вытеснения ключей Redis |
| `scylla_write_latency_ms` | Histogram | Задержка записи ScyllaDB |

### 5.2 Log Aggregation (Loki + Promtail)

Все логи сервисов собираются через **Promtail** и отправляются в **Loki**:
- Promtail работает как DaemonSet на каждом узле кластера
- Loki хранит логи с retention 30 дней
- **Grafana** используется как единый UI для метрик (Prometheus) и логов (Loki)

```yaml
# Promtail DaemonSet — собирает stdout/stderr всех подов
# Loki StatefulSet — хранение логов с индексированием по labels
# Grafana — unified dashboard для метрик и логов
```

### 5.3 Blackbox Monitoring

```yaml
# Prometheus Blackbox Exporter
# HTTP probe на production endpoint
- module: http_2xx
  targets:
    - https://son-messenger.com/health
    - https://son-messenger.com/api/v1/status
  interval: 30s
  timeout: 10s
```

Алерт при недоступности endpoint более 2 минут.

### 5.4 Алерты

```yaml
# Critical
- ws_connections_total > 50000     → Scale gateway pods
- message_latency_ms p99 > 5000   → Investigate ScyllaDB
- api_errors_total rate > 10/min   → Page on-call
- cpu_usage > 85%                  → Scale pods

# Warning
- ws_connections_total > 30000     → Prepare to scale
- disk_usage > 70%                 → Plan storage expansion
- push_errors_total rate > 5/min   → Check FCM/APNs credentials
```

---

## 6. Безопасность инфраструктуры

### 6.1 HashiCorp Vault

Хранение секретов:
```
secret/son/production/
├── database/
│   ├── postgres_url
│   └── scylla_hosts
├── redis/
│   └── url
├── minio/
│   ├── access_key
│   └── secret_key
├── jwt/
│   ├── private_key
│   └── public_key
├── push/
│   ├── fcm_key
│   └── apns_key
└── kafka/
    └── brokers
```

### 6.2 Vault Auth Method

```
Метод: Kubernetes Auth
Каждый сервис получает ServiceAccount → Vault role → read-only access к своим секретам
Vault Agent Sidecar injector — автоматическое монтирование секретов в pods
```

Пример конфигурации:
```bash
# Включить Kubernetes auth backend
vault auth enable kubernetes

# Создать роль для gateway-сервиса
vault write auth/kubernetes/role/gateway \
  bound_service_account_names=gateway-sa \
  bound_service_account_namespaces=son-apps \
  policies=gateway-policy \
  ttl=1h

# Policy — read-only доступ к секретам gateway
vault policy write gateway-policy - <<EOF
path "secret/data/son/production/database/*" {
  capabilities = ["read"]
}
path "secret/data/son/production/redis/*" {
  capabilities = ["read"]
}
path "secret/data/son/production/jwt/*" {
  capabilities = ["read"]
}
EOF
```

### 6.3 Network Policies

```yaml
# Разрешить только Gateway → Databases
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-access
spec:
  podSelector:
    matchLabels:
      tier: database
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: backend
```

### 6.4 mTLS (Istio)

Все inter-service коммуникации зашифрованы через Istio mTLS.

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: son-production
spec:
  mtls:
    mode: STRICT
```

---

## 7. Бэкапы

### 7.1 Расписание и методы

| Данные | Частота | Хранение | Метод |
|--------|---------|----------|-------|
| PostgreSQL | WAL archiving continuous + full daily | 30 дней | WAL-G → S3 (PITR, RPO ~5 мин) |
| ScyllaDB | Ежедневно | 14 дней | Snapshot + S3 |
| MinIO | Ежедневно (инкрементально) | 90 дней | mc mirror |
| Redis | RDB каждые 15 мин | 7 дней | redis-cli bgsave |
| Vault | Ежедневно | 90 дней | vault operator raft snapshot |

### 7.2 PostgreSQL: WAL-G Continuous Backup

```
PostgreSQL: WAL-G continuous backup
- WAL archiving → S3 (RPO: ~5 минут)
- Full backup: ежедневно
- Retention: 30 дней
- PITR: восстановление на любой момент в пределах retention
```

### 7.3 Шифрование бэкапов

- Все бэкапы шифруются **AES-256** перед отправкой в S3
- Ключи шифрования хранятся в **HashiCorp Vault** (`secret/son/production/backup/encryption_key`)
- MinIO Server-Side Encryption (SSE-S3) включён для bucket'ов с бэкапами

### 7.4 Процедуры восстановления (Restore)

| Компонент | Процедура |
|-----------|-----------|
| **PostgreSQL** | `wal-g backup-fetch LATEST && wal-g wal-fetch` — PITR на нужный момент времени, затем `pg_ctl promote` |
| **ScyllaDB** | `nodetool refresh` из snapshot'а, загруженного из S3; при полном восстановлении — пересоздание кластера из snapshot |
| **Redis** | Остановить Redis, заменить `dump.rdb` из S3-бэкапа, запустить Redis |
| **MinIO** | `mc mirror` обратно из S3-бэкапа в кластер MinIO |
| **Vault** | `vault operator raft snapshot restore` из зашифрованного snapshot'а в S3 |
