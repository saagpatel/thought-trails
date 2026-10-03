.PHONY: dev build test clean install

# npm project (package-lock.json). There is no lint script in package.json.
install:
	npm ci --ignore-scripts

dev:
	npm run tauri dev

build:
	npm run build

test:
	npm test

clean:
	rm -rf node_modules dist
