# NOTE: This is only for github action, and the main binary is built there,
# so don't use this directly.

FROM debian:buster-slim

RUN apt-get update && apt-get install -y libssl-dev ca-certificates

# copy the build artifact from the build stage
COPY ./target/release/fog-machine-server .

# set the startup command to run your binary
ENV ROCKET_ADDRESS="0.0.0.0" ROCKET_LOG_LEVEL="normal"
CMD ["./fog-machine-server"]