# sOn Messenger — Infrastructure & DevOps

## 1. Среды развёртывания

| Среда | Назначение | URL |
|-------|-----------|-----|
| **Local** | Разработка | localhost:5173 (frontend), localhost:4000 (backend) |
| **Staging** | Тестирование | staging.son-messenger.com |
| **Production** | Продакшн | son-messenger.com |

---

## 2. Docker — Локальная разработка

### 2.1 docker-compose.yml

```yaml
version: '3.9'

services:
  # ── Frontend ──
  web:
    build: ./webApp
    ports:
      - "5173:5173"
    volumes:
      - ./webApp/src:/app/src
    environment:
      - VITE_API_URL=http://localhost:4000
      - VITE_WS_URL=ws://localhost:4000

  # ── Backend Gateway ──
  gateway:
    build: ./backend/gateway
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=ecto://postgres:postgres@postgres:5432/son_dev
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
      - SECRET_KEY_BASE=${SECRET_KEY_BASE}
    depends_on:
      - postgres
      - redis
      - kafka

  # ── Crypto Service ──
  crypto:
    build: ./backend/crypto-service
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/son_dev
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - KAFKA_BROKERS=kafka:9092

  # ── Push Service ──
  push:
    build: ./backend/push-service
    ports:
      - "9090:9090"
    environment:
      - KAFKA_BROKERS=kafka:9092
      - REDIS_URL=redis://redis:6379

  # ── Databases ──
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=son_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d

  scylladb:
    image: scylladb/scylla:5.4
    ports:
      - "9042:9042"
    volumes:
      - scylla_data:/var/lib/scylla
    command: --smp 2 --memory 1G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # ── Object Storage ──
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY:-minioadmin}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  # ── Message Bus ──
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      - ZOOKEEPER_CLIENT_PORT=2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports:
      - "9092:9092"
    environment:
      - KAFKA_BROKER_ID=1
      - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
      - KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
    depends_on:
      - zookeeper

volumes:
  postgres_data:
  scylla_data:
  redis_data:
  minio_data:
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
son-production/
├── gateway/          # Elixir/Phoenix pods
├── crypto/           # Rust crypto service pods
├── push/             # Go push service pods
├── databases/        # StatefulSets (PostgreSQL, ScyllaDB, Redis)
├── storage/          # MinIO
├── messaging/        # Kafka + Zookeeper
├── monitoring/       # Prometheus, Grafana, Jaeger
└── security/         # Vault, cert-manager
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

### 5.2 Алерты

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

### 6.2 Network Policies

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

### 6.3 mTLS (Istio)

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

| Данные | Частота | Хранение | Метод |
|--------|---------|----------|-------|
| PostgreSQL | Каждые 6 часов | 30 дней | pg_dump + S3 |
| ScyllaDB | Ежедневно | 14 дней | Snapshot + S3 |
| MinIO | Ежедневно (инкрементально) | 90 дней | mc mirror |
| Redis | RDB каждые 15 мин | 7 дней | redis-cli bgsave |
| Vault | Ежедневно | 90 дней | vault operator raft snapshot |
