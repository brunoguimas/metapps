FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY . .

RUN go mod download

RUN go build -o api ./cmd/api

FROM scratch

WORKDIR /app

COPY --from=builder /app/api ./

CMD ["./api"]
