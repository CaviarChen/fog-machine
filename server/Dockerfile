# NOTE: currently unused

FROM rust:1.62 as build

WORKDIR /app
COPY . .

# build for release
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build 
# --release

# our final base
FROM debian:buster-slim

RUN apt-get update && apt-get install -y libssl-dev ca-certificates

# copy the build artifact from the build stage
COPY --from=build /app/target/release/fog-machine-server .

# set the startup command
ENV ROCKET_ADDRESS="0.0.0.0" ROCKET_LOG_LEVEL="normal"
CMD ["./fog-machine-server"]