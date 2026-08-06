#!/bin/bash

INPUT="translations.csv"
[ ! -f $INPUT ] && { echo "$INPUT file not found"; exit 99; }

# Read the entire file into a variable
content=$(<"$INPUT")

# Process the content in memory
IFS=""
newline=$'\n'

startUp() {
    languagesLength=${#HEADER[@]}
    for (( j=0; j<${languagesLength}; j++ )); do
        # Remove trailing newline
        HEADER[$j]="${HEADER[$j]//$'\n'/}"
        if [ "$j" -ne 0 ]; then
            # Overwrite old file and start json document
            echo  "{" > "${HEADER[$j]}.json"
            FIRSTUSE[$j]=0
        fi
    done
    let languagesLength--
}

i=0
while read LINE; do
    let i++
    if [ "$i" -eq 1 ]; then
        # Process header. This always adds a newline for all fields
        readarray HEADER < <(echo -n "$LINE" | awk -F'","|^"|"$|",|,"|,$' '{for(i=2; i<=NF; i++){printf("%s\n", $i)}}')
        startUp
        continue
    fi

    # Transform empty field in quoted empty fields
    PRELINE="${LINE//,,/,\"\",}"
    READYLINE="${PRELINE//,,/,\"\",}"
    # Read fields. This always adds a newline for all fields
    readarray FIELDS < <(echo -n "$READYLINE" | awk -F'","|^"|"$|",|,"|,$' '{for(i=2; i<=NF; i++){printf("%s\n", $i)}}')
    for (( j=0; j<${languagesLength}; j++ )); do
        # Remove trailing newline
        FIELDS[$j]="${FIELDS[$j]//$'\n'/}"
        if [ "$j" -eq 0 ] || [ -z "${FIELDS[$j]}" ]; then
            # First column not processed, also if field is empty
            continue
        fi
        output=""
        if [ "${FIRSTUSE[$j]}" -eq 1 ]; then
            # Only adds a comma if is not first record
            output=",${newline}"
        fi
        FIRSTUSE[$j]=1
        output="${output}    \"${FIELDS[0]}\": \"${FIELDS[$j]}\""
        # Append transalation file
        echo -n -E "${output}" >> "${HEADER[$j]}.json"
    done
done <<< "$content"

# Append the ending } to translation file
for (( j=1; j<${languagesLength}; j++ )); do
    echo "${newline}}" >> "${HEADER[$j]}.json"
done

# Delete this files that was generated in startUp()
rm .json

let i--

echo "${languagesLength} translation files generated. ${i} expressions processed"

rm -Rf ../dist/locales
mkdir -p ../dist/locales/
mv *.json ../dist/locales
