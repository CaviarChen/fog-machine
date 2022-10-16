#!/bin/bash
set -e
yarn install && yarn cicheck && export PUBLIC_URL=$CDN_URL && export REACT_APP_BACKEND_URL=$API_URL && yarn build
# mkdir -p build/frontend/
# rm -rf build/frontend/*
# (cd frontend && yarn install && yarn cicheck && export PUBLIC_URL=$CDN_URL && export REACT_APP_BACKEND_URL=$API_URL && yarn build)
# (cd editor && yarn install && yarn cicheck && export PUBLIC_URL="${CDN_URL}editor/" && export REACT_APP_MAPBOX_TOKEN=$REACT_APP_MAPBOX_TOKEN && export REACT_APP_BACKEND_URL=$API_URL && yarn build)
# cp -r frontend/build/* build/frontend/
# mkdir build/frontend/editor/
# cp -r editor/build/* build/frontend/editor/