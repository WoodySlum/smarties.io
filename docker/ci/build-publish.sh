# Update node engine procedure
# 1. Update package.json node-engines
# 2. Modify this script (IMG-TAG) and run script (enable docker experimental feature first)
# 3. Under gitlab go to core-node project, settings, CI/CD, Variables and update NODE_VERSION
# 4. Under gitlab, go to CI/CD, Pipelines and click on Clear Runner Caches button
# 5. Update libraries if necessary and run lint, test and build
# 6. Push

#!/bin/sh
docker login
DOCKER_ACC="woodyslum"
DOCKER_REPO="smarties-ci"
IMG_TAG="14.15-{dist}-2"

# Kill Containers
docker kill $(docker ps -q)
# Clean images
docker image rm -f $(docker image ls -a -q "*/smarties-ci")
docker system prune --all -f
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker buildx create --use --append --name smarties-ci
docker buildx build --platform linux/amd64,linux/arm/v7 --push -t $DOCKER_ACC/$DOCKER_REPO:$(echo $IMG_TAG | sed -e s@{dist}@stretch@) -f Dockerfile-stretch .
docker buildx build --platform linux/amd64,linux/arm/v7 --push -t $DOCKER_ACC/$DOCKER_REPO:$(echo $IMG_TAG | sed -e s@{dist}@buster@) -f Dockerfile-buster .
docker system prune --all -f
