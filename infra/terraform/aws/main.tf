# AWS pieces the OCI cluster needs: a least-privilege IAM user for the videos bucket,
# 30-day video expiry, and a $20/month budget alert. All three are free.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "us-east-2"
}

variable "bucket_name" {
  description = "Existing videos bucket (not created or destroyed here)"
  type        = string
}

variable "budget_email" {
  description = "Where the budget alert goes"
  type        = string
}

variable "monthly_budget_usd" {
  type    = string
  default = "20"
}

# ── IAM user the k3s pods use (keys go into the mockmate-secrets Secret) ────
resource "aws_iam_user" "k8s" {
  name = "mockmate-k8s"
}

# Only the three object operations the app performs, only under videos/.
resource "aws_iam_user_policy" "videos" {
  name = "mockmate-videos"
  user = aws_iam_user.k8s.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
      Resource = "arn:aws:s3:::${var.bucket_name}/videos/*"
    }]
  })
}
# The access key is deliberately NOT a Terraform resource: its secret would sit in plain text in
# terraform.tfstate. Create it with the AWS CLI straight into the k8s Secret (see README).

# ── 30-day retention for interview recordings ───────────────────────────────
# Note: this REPLACES any lifecycle configuration already on the bucket.
resource "aws_s3_bucket_lifecycle_configuration" "videos" {
  bucket = var.bucket_name
  rule {
    id     = "expire-interview-videos"
    status = "Enabled"
    filter {
      prefix = "videos/"
    }
    expiration {
      days = 30
    }
  }
}

# ── Budget alert ─────────────────────────────────────────────────────────────
resource "aws_budgets_budget" "monthly" {
  name         = "mockmate-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification { # already spent the budget
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }

  notification { # on track to exceed it this month
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}

output "iam_user" {
  value = aws_iam_user.k8s.name
}
