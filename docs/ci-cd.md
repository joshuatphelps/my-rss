# CI/CD — GitHub Actions + GCP

Four workflows deploy each service independently when their files change on `main`:

| Workflow | Trigger path | Deploys |
|---|---|---|
| `deploy-web.yml` | `web/**` | Cloud Run: `web` |
| `deploy-feed-fetcher.yml` | `services/feed-fetcher/**` | Cloud Run: `feed-fetcher` |
| `deploy-article-processor.yml` | `services/article-processor/**` | Cloud Run: `article-processor` |
| `deploy-functions.yml` | `functions/**`, `firebase.json` | Cloud Function: `onFeedAdded` |

Cloud Run images are tagged with the Git SHA and `latest`, pushed to Artifact Registry, then deployed. The functions workflow uses Firebase CLI to deploy.

Auth uses **Workload Identity Federation** — no service account key files are stored anywhere.

The functions workflow also supports `workflow_dispatch` for manual triggering:
```bash
gh workflow run deploy-functions.yml --repo joshuatphelps/my-rss --ref main
```

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

# 4. Grant all roles needed to build, deploy, and manage functions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"

# 5. Grant the compute service account the Eventarc receiver role (required for Firestore-triggered functions)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/eventarc.eventReceiver"

# 6. Grant the Eventarc service agent its role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/eventarc.serviceAgent"

# 7. Enable required APIs
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  eventarc.googleapis.com \
  cloudbilling.googleapis.com

# 8. Allow the GitHub repo to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/iam.workloadIdentityUser"

# 9. Print the values you'll need for GitHub secrets
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
| `WIF_PROVIDER` | Output from step 9 above |
| `WIF_SERVICE_ACCOUNT` | Output from step 9 above |
| `GCP_PROJECT_ID` | `my-rss-prod` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase Console |

Firebase config values are in **Firebase Console → Project Settings → Your apps → Web app → SDK setup and configuration**.

> **Note:** Firebase secrets must be repository secrets (not environment secrets) — they are baked into the Next.js Docker image at build time via `--build-arg`.

---

## Firebase setup

Firestore security rules and indexes are in `firestore.rules` and `firestore.indexes.json`. Deploy them with:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project my-rss-prod
```

Firebase Auth requires:
- **Google** sign-in provider enabled (Firebase Console → Authentication → Sign-in method)
- The Cloud Run web service URL added to authorized domains (Firebase Console → Authentication → Settings → Authorized domains)
