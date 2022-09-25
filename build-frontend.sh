#!/bin/bash
# echo "REACT_APP_MAPBOX_TOKEN:" $REACT_APP_MAPBOX_TOKEN
# echo "CDN_URL:" $CDN_URL
# echo "API_URL:" $API_URL
# echo "----------"
mkdir -p build/frontend/
rm -rf build/frontend/*
(cd frontend && yarn install && export PUBLIC_URL=$CDN_URL && export REACT_APP_BACKEND_URL=$API_URL && yarn build)
(cd editor && yarn install && export PUBLIC_URL="${CDN_URL}editor/" && export REACT_APP_MAPBOX_TOKEN=$REACT_APP_MAPBOX_TOKEN && export REACT_APP_BACKEND_URL=$API_URL && yarn build)
cp -r frontend/build/ build/frontend/
mkdir build/frontend/editor/
cp -r editor/build/ build/frontend/editor/