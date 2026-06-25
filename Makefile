pw-generic:
	docker compose run --rm playwright \
		npx playwright test \
		--project=generic

pw-generic-clear-dialog:
	docker compose run --rm playwright \
		npx playwright test \
		--project=generic \
		tests/playwright/features/clear-form-confirmation.spec.ts

pw-report:
	npx playwright show-report