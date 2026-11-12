variable "region" {
  description = "OCI region of your tenancy's home region (Always Free A1 is only in the home region), e.g. us-ashburn-1"
  type        = string
}

variable "oci_profile" {
  description = "Profile in ~/.oci/config holding the API signing key"
  type        = string
  default     = "DEFAULT"
}

variable "tenancy_ocid" {
  type = string
}

variable "compartment_ocid" {
  description = "Compartment for all resources (the tenancy OCID = root compartment is fine)"
  type        = string
}

variable "ad_index" {
  description = "Availability domain index. A1 capacity varies by AD; try 1 or 2 on 'Out of host capacity'."
  type        = number
  default     = 0
}

variable "ssh_public_key" {
  description = "Contents of your SSH public key (e.g. ~/.ssh/id_ed25519.pub)"
  type        = string
}

variable "admin_cidr" {
  description = "Your public IP as /32; the only source allowed to SSH in"
  type        = string
  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && var.admin_cidr != "0.0.0.0/0"
    error_message = "admin_cidr must be a CIDR such as 203.0.113.7/32, not 0.0.0.0/0."
  }
}

variable "tailscale_auth_key" {
  description = "One-off Tailscale auth key (tag:k3s). Lets CI and your laptop reach the k3s API without opening 6443."
  type        = string
  sensitive   = true
}

variable "k3s_version" {
  description = "Pinned so prod matches what the chart was tested on (bundles Traefik 2.11 / chart 27)"
  type        = string
  default     = "v1.31.4+k3s1"
}

variable "fault_domain" {
  description = "Pin a fault domain (FAULT-DOMAIN-1..3) when Oracle reports out of host capacity; null lets Oracle pick"
  type        = string
  default     = null
}
