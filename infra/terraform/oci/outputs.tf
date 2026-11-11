output "public_ip" {
  description = "Point your domain's A record here"
  value       = oci_core_public_ip.k3s.ip_address
}

output "next_steps" {
  value = <<-EOT
    1. DNS: A record  <your domain>  ->  ${oci_core_public_ip.k3s.ip_address}
    2. Wait ~3 min for cloud-init, then check:  ssh ubuntu@${oci_core_public_ip.k3s.ip_address} 'cloud-init status --wait && sudo k3s kubectl get nodes'
    3. Kubeconfig over Tailscale (your laptop must be on the same tailnet):
         ssh ubuntu@${oci_core_public_ip.k3s.ip_address} sudo cat /etc/rancher/k3s/k3s.yaml \
           | sed 's#https://127.0.0.1:6443#https://mockmate-k3s:6443#' > ~/.kube/mockmate.yaml
         export KUBECONFIG=~/.kube/mockmate.yaml && kubectl get nodes
    4. For CI: base64 -w0 ~/.kube/mockmate.yaml  ->  GitHub secret KUBECONFIG_B64
  EOT
}
