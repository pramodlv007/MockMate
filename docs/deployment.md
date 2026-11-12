# Deployment: k3s on Oracle Cloud (not in production)

> **Production runs on AWS EC2 behind nginx**, deployed by `.github/workflows/deploy.yml`; see the README. This
> document covers the alternative Kubernetes setup in `deploy/` and `infra/`, which is not what serves
> mockmate.site today. Its CI/CD description below is for the k3s workflow (Helm over Tailscale), which is in git
> history at commit `31d62d7` and is not the current `deploy.yml`.

| Piece | Where | Notes |
|---|---|---|
| Cluster | k3s v1.31.4 on one OCI `VM.Standard.A1.Flex` | Terraform: `infra/terraform/oci/` |
| App | Helm chart `deploy/helm/mockmate/` | api (HPA 1-3), eval-worker, frontend, redis (PVC) |
| TLS | cert-manager + Let's Encrypt HTTP-01 | HTTP redirects to HTTPS (`deploy/k3s/traefik-config.yaml`) |
| Monitoring | kube-prometheus-stack, 7-day retention | Dashboard: `deploy/helm/mockmate/dashboards/mockmate.json` |
| Cluster access | Tailscale | The k3s API (6443) is never opened to the internet |
| AWS | S3 videos, least-privilege IAM user, $20 budget alert | Terraform: `infra/terraform/aws/` |

## CI/CD for the k3s setup (workflow from commit `31d62d7`)

```
every push / PR
  ├── test    — backend pytest + frontend build + helm lint
  └── images  — backend image smoke-tested against Postgres (health, /metrics, signup, worker import),
                then backend + frontend built for linux/amd64 + linux/arm64, pushed to GHCR tagged with the SHA
push to main, once repo variable DOMAIN is set
  └── deploy  — runner joins the tailnet, helm upgrade --atomic to that SHA (auto-rollback), HTTPS smoke test
```

## Metrics

`GET /metrics/` on the api (not routed by the Ingress, so not public) and `:9100/metrics` on the worker:
per-route latency histogram, interviews created, eval job duration and outcomes (success / retry / failure),
LLM latency and errors by provider and operation, eval queue depth. `make grafana` opens the dashboard.

## Deploy from scratch

Prerequisites: an OCI account (Always Free), the OCI CLI config (`~/.oci/config`), a Tailscale account,
terraform, helm, kubectl, a domain you can point at an IP.

```bash
# 1. VM + k3s. Tailscale: create a one-off auth key, and add tags tag:k3s / tag:ci to your ACL.
cp infra/terraform/oci/terraform.tfvars.example infra/terraform/oci/terraform.tfvars   # fill it in
export TF_VAR_tailscale_auth_key=tskey-auth-...
make infra-up                      # prints the public IP and the kubeconfig command

# 2. DNS: A record for your domain -> that IP. Kubeconfig as printed by step 1.

# 3. AWS: IAM user + 30-day expiry + budget alert, then a key for the user straight into the cluster
terraform -chdir=infra/terraform/aws apply -var bucket_name=mockmate-videos-pramod -var budget_email=you@example.com
kubectl create namespace mockmate
aws iam create-access-key --user-name mockmate-k8s   # copy the two values into the Secret below

# 4. App secrets (never in git)
kubectl -n mockmate create secret generic mockmate-secrets   --from-literal=SECRET_KEY=$(openssl rand -hex 32) --from-literal=REFRESH_SECRET_KEY=$(openssl rand -hex 32)   --from-literal=INTERNAL_API_TOKEN=$(openssl rand -hex 32)   --from-literal=POSTGRES_USER=... --from-literal=POSTGRES_PASSWORD=... --from-literal=POSTGRES_SERVER=...   --from-literal=POSTGRES_PORT=6543 --from-literal=POSTGRES_DB=postgres   --from-literal=GOOGLE_API_KEY=... --from-literal=GOOGLE_CLIENT_ID=...   --from-literal=AWS_ACCESS_KEY_ID=... --from-literal=AWS_SECRET_ACCESS_KEY=...
kubectl create namespace monitoring
kubectl -n monitoring create secret generic grafana-admin   --from-literal=admin-user=admin --from-literal=admin-password=$(openssl rand -hex 12)

# 5. cert-manager, monitoring, app
make deploy DOMAIN=mockmate.example.com EMAIL=you@example.com

# 6. CI: secrets KUBECONFIG_B64, TS_OAUTH_CLIENT_ID, TS_OAUTH_SECRET; variables DOMAIN, LETSENCRYPT_EMAIL
make status
```

If the node can't pull `ghcr.io/pramodlv007/mockmate-frontend`, set that package's visibility to public in
GitHub (Packages → package settings). The backend package already pulls anonymously.

Teardown: `make infra-down` (VM, network, reserved IP; prints the remaining Terraform state, which should be empty).

## Cost

The "Expected" column comes from the providers' published free allowances. **None of it has been checked against a
real bill yet.** After the first full month, read each figure from the place in the last column and replace the
expected value.

| Service | What we use | Expected | Where to read the real figure |
|---|---|---|---|
| OCI Compute, storage, IP | 1x A1.Flex (2 OCPU / 12 GB), 100 GB boot volume, 1 reserved IP | $0 (Always Free) | OCI Console, Billing and Cost Management, Cost Analysis; also *Limits, Quotas and Usage* for the IP |
| AWS S3 | Interview videos, deleted after 30 days | Free tier for 12 months, then per-GB storage and requests | AWS Console, Billing, Cost Explorer. The $20 budget alert from `infra/terraform/aws/` emails you if it goes over |
| Supabase | Postgres | Free plan | Supabase dashboard, Settings, Usage (database size, egress) |
| GHCR, GitHub Actions | Public repo | $0 | GitHub, Settings, Billing and plans, Usage |
| Tailscale | Personal plan | $0 | Tailscale admin console, Billing |
| Gemini API | Questions, transcription, scoring | Depends on plan and usage | Google AI Studio, Usage and billing. Call counts per task, from our own metrics: `sum by (provider, op) (increase(mockmate_llm_call_duration_seconds_count[30d]))` in Grafana Explore |

Gemini is the one line that can grow with usage. Multiply the call counts above by the price per call in the AI
Studio pricing page to see what a month of real traffic costs.
