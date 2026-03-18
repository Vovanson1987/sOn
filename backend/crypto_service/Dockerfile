FROM rust:1.77-alpine AS build

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src src

RUN cargo build --release

FROM alpine:3.19
RUN apk add --no-cache libgcc

WORKDIR /app
COPY --from=build /app/target/release/son-crypto-service .

EXPOSE 8080
CMD ["./son-crypto-service"]
