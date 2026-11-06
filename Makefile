.PHONY: install dev api web test build benchmark docker

install:            ## install backend and frontend dependencies
	pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

api:                ## API with auto-reload on :8000
	cd backend && uvicorn app.main:app --reload --port 8000

web:                ## Vite dev server on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

dev:                ## run both
	$(MAKE) -j2 api web

test:               ## backend tests, frontend type check
	cd backend && pytest -q
	cd frontend && npm run typecheck

build:              ## production build of the frontend (served by the API)
	cd frontend && npm run build

benchmark:          ## regenerate research/results/benchmark.json (about 10 minutes)
	python research/run_benchmark.py 12

docker:             ## one container with API and UI on :8000
	docker compose up --build
