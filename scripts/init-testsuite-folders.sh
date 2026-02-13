#!/bin/bash
# Creates the TEST_SUITE folder structure under data/
# Run once to initialize, then commit the .gitkeep files

BASE="data/TEST_SUITE"

declare -A COUNTRIES
COUNTRIES[at-AT]="consumer tagger"
COUNTRIES[nl-BE]="consumer business"
COUNTRIES[cs-CZ]="consumer business"
COUNTRIES[de-DE]="consumer tagger"
COUNTRIES[es-ES]="consumer business tagger"
COUNTRIES[fr-FR]="consumer business tagger"
COUNTRIES[en-GB]="consumer business tagger"
COUNTRIES[en-IN]="consumer business tagger"
COUNTRIES[en-IE]="consumer business"
COUNTRIES[it-IT]="consumer business tagger"
COUNTRIES[es-MX]="tagger"
COUNTRIES[pl-PL]="consumer"
COUNTRIES[pt-PT]="consumer"

for country in "${!COUNTRIES[@]}"; do
  for segment in ${COUNTRIES[$country]}; do
    for sub in sample model/develop model/expertrules model/prod output; do
      dir="$BASE/$country/$segment/$sub"
      mkdir -p "$dir"
      touch "$dir/.gitkeep"
    done
  done
done

echo "✅ Folder structure created under $BASE"
