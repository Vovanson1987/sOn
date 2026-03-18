FROM elixir:1.16-alpine AS build

RUN apk add --no-cache build-base git

WORKDIR /app

COPY mix.exs mix.lock ./
RUN mix local.hex --force && mix local.rebar --force
RUN MIX_ENV=prod mix deps.get --only prod
RUN MIX_ENV=prod mix deps.compile

COPY config config
COPY lib lib
COPY priv priv

RUN MIX_ENV=prod mix release

FROM alpine:3.19 AS app
RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app
COPY --from=build /app/_build/prod/rel/son_gateway ./

ENV PORT=4000
EXPOSE 4000

CMD ["bin/son_gateway", "start"]
