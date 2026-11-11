# MockMate infrastructure. Needs: terraform, helm, kubectl (and KUBECONFIG pointing at the cluster).
#   make infra-up            create the Oracle Always Free VM + k3s           ($0)
#   make deploy DOMAIN=... EMAIL=...   cert-manager, monitoring, app       ($0)
#   make infra-down          destroy the VM, network and reserved IP
#   make status | logs | grafana

SHELL      := bash
TAG        ?= $(shell git rev-parse HEAD)
NS         ?= mockmate
DOMAIN     ?= mockmate.site
OCI_DIR    := infra/terraform/oci
AWS_DIR    := infra/terraform/aws
CHART      := deploy/helm/mockmate
CERT_MANAGER_VERSION := v1.21.3
KPS_VERSION          := 93.1.1

.PHONY: infra-up infra-down aws-up aws-down deploy cert-manager monitoring app status logs grafana

# ── Infrastructure ───────────────────────────────────────────────────────────
infra-up:
	terraform -chdir=$(OCI_DIR) init -input=false
	terraform -chdir=$(OCI_DIR) apply

infra-down:
	terraform -chdir=$(OCI_DIR) destroy
	@echo "Remaining Terraform-managed resources (should be empty):"
	terraform -chdir=$(OCI_DIR) state list

aws-up:      # IAM user, 30-day video expiry, $20 budget alert (all free)
	terraform -chdir=$(AWS_DIR) init -input=false
	terraform -chdir=$(AWS_DIR) apply

aws-down:
	terraform -chdir=$(AWS_DIR) destroy
	terraform -chdir=$(AWS_DIR) state list

# ── Cluster add-ons + app ────────────────────────────────────────────────────
deploy: cert-manager monitoring app

cert-manager:
	kubectl apply -f deploy/k3s/traefik-config.yaml
	helm upgrade --install cert-manager cert-manager --repo https://charts.jetstack.io \
	  --version $(CERT_MANAGER_VERSION) -n cert-manager --create-namespace \
	  --set crds.enabled=true --wait

monitoring:
	helm upgrade --install kps kube-prometheus-stack --repo https://prometheus-community.github.io/helm-charts \
	  --version $(KPS_VERSION) -n monitoring --create-namespace \
	  -f deploy/monitoring/kube-prometheus-stack-values.yaml --wait --timeout 10m

app:
	@test -n "$(DOMAIN)" || (echo "DOMAIN=your.domain is required"; exit 1)
	@test -n "$(EMAIL)"  || (echo "EMAIL=you@example.com is required (Let's Encrypt)"; exit 1)
	helm upgrade --install mockmate $(CHART) -n $(NS) --create-namespace \
	  -f $(CHART)/values.yaml -f $(CHART)/values-prod.yaml \
	  --set image.tag=$(TAG) --set ingress.host=$(DOMAIN) --set certManager.email=$(EMAIL) \
	  --wait --timeout 10m

# ── Day-2 ────────────────────────────────────────────────────────────────────
status:
	kubectl get nodes -o wide
	kubectl top nodes
	kubectl -n $(NS) get pods,hpa,ingress,certificate
	kubectl top pods -A --sort-by=memory | head -20

logs:
	kubectl -n $(NS) logs deploy/mockmate-api --tail=100
	kubectl -n $(NS) logs deploy/mockmate-eval-worker --tail=100

grafana:     # http://localhost:3000 — user/password in the monitoring/grafana-admin Secret
	kubectl -n monitoring port-forward svc/kps-grafana 3000:80
