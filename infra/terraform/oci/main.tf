# One Always Free Ampere A1 VM (2 OCPU / 12 GB — the full free allowance, never more) running k3s.
#
#   internet ──80/443──▶ reserved public IP ──▶ VM: Traefik ──▶ pods
#   your IP ───22──────▶ (SSH)
#   CI / laptop ─Tailscale─▶ k3s API :6443 (never opened publicly)

terraform {
  required_version = ">= 1.6"
  required_providers {
    oci = { source = "oracle/oci", version = "~> 7.0" }
  }
}

provider "oci" {
  region              = var.region
  config_file_profile = var.oci_profile # API key lives in ~/.oci/config, not in this repo
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# Latest Canonical Ubuntu 24.04 build for the Arm A1 shape
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# ── Network ──────────────────────────────────────────────────────────────────
resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "mockmate"
  dns_label      = "mockmate"
}

resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "mockmate"
}

resource "oci_core_route_table" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "mockmate"
  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.main.id
  }
}

# This is the real firewall (the VM's own iptables REJECT rules are removed in cloud-init).
resource "oci_core_security_list" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "mockmate"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules { # SSH from your IP only
    source   = var.admin_cidr
    protocol = "6"
    tcp_options {
      min = 22
      max = 22
    }
  }

  dynamic "ingress_security_rules" { # HTTP (ACME challenge + redirect) and HTTPS, public
    for_each = [80, 443]
    content {
      source   = "0.0.0.0/0"
      protocol = "6"
      tcp_options {
        min = ingress_security_rules.value
        max = ingress_security_rules.value
      }
    }
  }

  ingress_security_rules { # ICMP "fragmentation needed", so path-MTU discovery works
    source   = "0.0.0.0/0"
    protocol = "1"
    icmp_options {
      type = 3
      code = 4
    }
  }
}

resource "oci_core_subnet" "public" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.main.id
  cidr_block        = "10.0.1.0/24"
  display_name      = "mockmate-public"
  dns_label         = "public"
  route_table_id    = oci_core_route_table.main.id
  security_list_ids = [oci_core_security_list.main.id]
}

# ── VM ───────────────────────────────────────────────────────────────────────
resource "oci_core_instance" "k3s" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.ad_index].name
  display_name        = "mockmate-k3s"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = 2  # Always Free A1 allowance since Aug 2026: 2 OCPU / 12 GB total.
    memory_in_gbs = 12 # Going over gets instances terminated, so these are not variables.
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = 100 # Always Free block storage is 200 GB total
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = false # the reserved IP below is attached instead, so it survives VM rebuilds
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
      k3s_version        = var.k3s_version
      tailscale_auth_key = var.tailscale_auth_key
      traefik_config     = file("${path.module}/../../../deploy/k3s/traefik-config.yaml")
    }))
  }

  # Changing cloud-init would otherwise rebuild the VM and wipe the cluster.
  lifecycle {
    ignore_changes = [metadata, source_details[0].source_id]
  }
}

# ── Reserved public IP (stable DNS target across VM rebuilds) ────────────────
data "oci_core_vnic_attachments" "k3s" {
  compartment_id = var.compartment_ocid
  instance_id    = oci_core_instance.k3s.id
}

data "oci_core_private_ips" "k3s" {
  vnic_id = data.oci_core_vnic_attachments.k3s.vnic_attachments[0].vnic_id
}

resource "oci_core_public_ip" "k3s" {
  compartment_id = var.compartment_ocid
  lifetime       = "RESERVED"
  display_name   = "mockmate-k3s"
  private_ip_id  = data.oci_core_private_ips.k3s.private_ips[0].id
}
