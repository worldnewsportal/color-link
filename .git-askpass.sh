#!/bin/sh
# temporary askpass helper: reads the token from the environment, never from disk
case "$1" in
  *Username*) echo "x-access-token" ;;
  *) echo "${GITHUB_TOKEN}" ;;
esac
