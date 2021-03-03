#!/bin/sh

APPS=$(find src/internal-plugins -name app)

echo "Package iot apps"
for APP in $APPS
do
    ID=$(echo $APP | sed -e "s/\\//-/g")
    zip -r ./iot-packages/$ID.zip $APP
done

echo "Package iot apps done."
