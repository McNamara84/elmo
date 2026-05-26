# Contributing to ELMO

Thank you for your interest in contributing to ELMO! We welcome contributions of all kinds.

## Branching Strategy

We follow a structured branching workflow to maintain code quality and stability. Please follow these guidelines when creating branches and pull requests.

### Main Branches

- **`main`**: Production-ready code. Deployments to production happen manually from this branch.
- **`dev`**: Development branch. Deployments to staging happen automatically every 5 minutes from this branch.

### Branch Types

#### Hotfixes
- **Purpose**: Critical bug fixes that need to go to production immediately
- **Created from**: `main`
- **Merged into**: `main` (then `main` must be merged back into `dev`)
- **Naming convention**: `hotfix/description-of-fix`

**Example workflow:**
```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-login-bug
# Make your changes
git add .
git commit -m "hotfix: fix login validation"
git push origin hotfix/fix-login-bug
# Create PR targeting main
# After merge into main, merge main into dev
```

#### Features
- **Purpose**: New features or enhancements
- **Created from**: `dev`
- **Merged into**: `dev`
- **Naming convention**: `feature/description-of-feature`

**Important**: Before creating a PR, ensure your feature branch contains the latest changes from `main`:
```bash
git checkout feature/your-feature
git fetch origin
git merge origin/main
# Resolve conflicts if any
git push origin feature/your-feature
```