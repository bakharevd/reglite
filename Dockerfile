FROM golang:1.24-alpine AS builder

# Переменные для мультиплатформенной сборки
ARG TARGETOS
ARG TARGETARCH

RUN apk --no-cache add git ca-certificates tzdata

WORKDIR /app

# Кэширование зависимостей
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o reglite cmd/reglite/main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates

RUN addgroup -g 1001 reglite && \
    adduser -D -s /bin/sh -u 1001 -G reglite reglite

WORKDIR /app

COPY --from=builder /app/reglite .
COPY --from=builder /app/web ./web

RUN chown -R reglite:reglite /app
USER reglite

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["./reglite"]