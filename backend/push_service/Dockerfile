FROM golang:1.22-alpine AS build

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY cmd cmd
COPY internal internal

RUN CGO_ENABLED=0 GOOS=linux go build -o push-service ./cmd

FROM alpine:3.19
WORKDIR /app
COPY --from=build /app/push-service .

EXPOSE 9090
CMD ["./push-service"]
