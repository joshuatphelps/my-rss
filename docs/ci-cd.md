# CI/CD — GitHub Actions + GCP

Three workflows deploy each service independently when their files change on `main`:

| Workflow | Trigger path | Cloud Run service |
|---|---|---|
| `deploy-web.yml` | `web/**` | `web` |
| `deploy-feed-fetcher.yml` | `services/feed-fetcher/**` | `feed-fetcher` |
| `deploy-article-processor.yml` | `services/article-processor/**` | `article-processor` |

Images are tagged with the Git SHA and `latest`, pushed to Artifact Registry, then deployed to Cloud Run.

Auth uses **Workload Identity Federation** — no service account key files are stored anywhere.

---

## One-time GCP setup

Run these once from Cloud Shell or any machine with `gcloud` configured.

```bash
export PROJECT_ID=my-rss-prod
export REGION=us-central1
export REPO=joshuatphelps/my-rss
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# 1. Create a Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions"

# 2. Create an OIDC provider scoped to this repo only
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --attribute-condition="assertion.repository=='$REPO'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Create a CI/CD service account
gcloud iam service-accounts create github-actions-sa \
  --display-name="GitHub Actions CI/CD"

# 4. Grant it the minimum roles needed to build and deploy
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Needed so the SA can assign service accounts to Cloud Run services at deploy time
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 5. Allow the GitHub repo to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/iam.workloadIdentityUser"

# 6. Print the values you'll need for GitHub secrets
echo ""
echo "--- GitHub Secrets ---"
echo "WIF_PROVIDER: projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT: github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com"
echo "GCP_PROJECT_ID: $PROJECT_ID"
```

---

## GitHub Secrets

Go to **github.com/joshuatphelps/my-rss → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `WIF_PROVIDER` | Output from step 6 above |
| `WIF_SERVICE_ACCOUNT` | Output from step 6 above |
| `GCP_PROJECT_ID` | `my-rss-prod` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase Console |

Firebase config values are in **Firebase Console → Project Settings → Your apps → Web app → SDK setup and configuration**.
