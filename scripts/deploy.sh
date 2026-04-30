#!/usr/bin/env bash
set -euo pipefail

# End-to-end deploy for Storypointless. Run from repo root: ./scripts/deploy.sh
# Idempotent — safe to re-run.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PRIMARY_REGION="eu-west-2"
CERT_REGION="us-east-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

step() { printf "\n\033[1;36m==>\033[0m %s\n" "$*"; }

# --- 1. Bootstrap CDK environments (idempotent) -----------------------------
step "Bootstrapping CDK in $PRIMARY_REGION and $CERT_REGION"
npx --workspace @storypointless/infra cdk bootstrap \
  "aws://$ACCOUNT_ID/$PRIMARY_REGION" \
  "aws://$ACCOUNT_ID/$CERT_REGION"

# --- 2. Cert (us-east-1) + Backend (WS API + Lambdas + DDB) + Frontend -----
step "Deploying CertStack (us-east-1)"
npm run --workspace @storypointless/infra deploy:cert

step "Deploying BackendStack (WS API + Lambdas + DynamoDB)"
npm run --workspace @storypointless/infra deploy:backend

WS_URL="$(aws cloudformation describe-stacks \
  --region "$PRIMARY_REGION" --stack-name StorypointlessBackend \
  --query "Stacks[0].Outputs[?OutputKey=='WsUrl'].OutputValue" \
  --output text)"
echo "WebSocket URL: $WS_URL"

step "Deploying FrontendStack (S3 + CloudFront)"
npm run --workspace @storypointless/infra deploy:frontend

BUCKET="$(aws cloudformation describe-stacks \
  --region "$PRIMARY_REGION" --stack-name StorypointlessFrontend \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)"
DIST_ID="$(aws cloudformation describe-stacks \
  --region "$PRIMARY_REGION" --stack-name StorypointlessFrontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)"

# --- 3. Build the frontend with the right WS URL ----------------------------
step "Building web app with VITE_WS_URL=$WS_URL"
VITE_WS_URL="$WS_URL" npm run --workspace @storypointless/web build

# --- 4. Sync to S3 and invalidate CloudFront --------------------------------
step "Syncing build to s3://$BUCKET"
aws s3 sync apps/web/dist/ "s3://$BUCKET/" --delete

step "Invalidating CloudFront ($DIST_ID)"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text

step "Activating Project cost-allocation tag (idempotent)"
aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status TagKey=Project,Status=Active \
  >/dev/null 2>&1 || echo "  (already active or not yet propagated; ignore)"

step "Done."
echo "Frontend: https://storypointless.com"
echo "Backend:  $WS_URL"
