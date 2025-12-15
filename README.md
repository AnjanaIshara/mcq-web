docker builder prune --all


docker build -t mcq-web .

docker run --rm -p 4173:4173 mcq-web