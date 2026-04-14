# MockMate — AWS Showcase Layer

This directory contains the **AWS Lambda showcase** that demonstrates cloud-native deployment patterns alongside the main Render/Vercel stack.

---

## What's in Here

```
aws/
├── template.yaml                    ← AWS SAM infrastructure template
├── samconfig.toml                   ← SAM deploy defaults (region, stack name)
└── lambda/
    ├── question_generate/
    │   ├── handler.py               ← FastAPI + Mangum Lambda handler
    │   └── requirements.txt
    └── evaluation_trigger/
        ├── handler.py               ← Async 4-agent pipeline trigger
        └── requirements.txt
```

---

## What Each Lambda Demonstrates

| Lambda | Route | Showcases |
|---|---|---|
| `question_generate` | `POST /questions/generate` | Secrets Manager, rate limiting, stateless LLM |
| `evaluation_trigger` | `POST /evaluate/trigger` | Async long-running AI, CloudWatch structured logs |

Both functions:
- ✅ Pull API keys from **AWS Secrets Manager** (not env vars)
- ✅ Log every step to **AWS CloudWatch** automatically
- ✅ Use **Graviton2 (ARM64)** — 20% cheaper than x86
- ✅ Are fronted by **API Gateway** (auto HTTPS)
- ✅ Have **rate limiting** (SlowAPI) to cap LLM costs

---

## Prerequisites

```powershell
# Install AWS CLI
winget install Amazon.AWSCLI

# Install AWS SAM CLI
winget install Amazon.SAM-CLI

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Key, Region (us-east-1), Output (json)
```

---

## Step 1 — Create Secrets in AWS Secrets Manager

In the AWS Console → Secrets Manager → Store a new secret:

1. Choose **"Other type of secret"**
2. Key/value pairs:
   ```
   GOOGLE_API_KEY   →  AIza-your-gemini-key
   OPENAI_API_KEY   →  sk-proj-your-openai-key
   ```
3. Secret name: **`mockmate/api-keys`**
4. Click Store

> Or via CLI:
> ```bash
> aws secretsmanager create-secret \
>   --name "mockmate/api-keys" \
>   --secret-string '{"GOOGLE_API_KEY":"AIza...","OPENAI_API_KEY":"sk-proj-..."}'
> ```

---

## Step 2 — Build & Deploy

```powershell
cd aws

# Build Lambda packages (uses Docker to match Lambda runtime)
sam build --use-container

# First-time deploy (saves config to samconfig.toml)
sam deploy --guided

# Subsequent deploys (uses samconfig.toml defaults)
sam deploy
```

After deploy, SAM prints the **API Gateway URLs**:

```
Outputs:
  QuestionGenerateUrl  = https://abc123.execute-api.us-east-1.amazonaws.com/prod/questions/generate
  EvaluationTriggerUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/evaluate/trigger
  CloudWatchDashboard  = https://us-east-1.console.aws.amazon.com/cloudwatch/home#dashboards:name=MockMate-prod
```

---

## Step 3 — Test the Lambda Endpoints

```powershell
# Test question generation
$LAMBDA_URL = "https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod"

Invoke-RestMethod -Uri "$LAMBDA_URL/questions/generate" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "company": "Google",
    "target_role": "Senior Software Engineer",
    "skills": "Python, distributed systems",
    "job_description": "Build scalable backend services...",
    "count": 3,
    "persona": "tough",
    "strictness": "strict"
  }'
```

Expected response:
```json
{
  "questions": ["...", "...", "..."],
  "count": 3,
  "source": "lambda"
}
```

---

## Step 4 — View Logs in CloudWatch

```bash
# Stream logs in real-time
aws logs tail /aws/lambda/mockmate-question-generate-prod --follow

# View evaluation pipeline logs (structured JSON)
aws logs tail /aws/lambda/mockmate-evaluation-trigger-prod --follow
```

Or open the **CloudWatch Dashboard** printed by SAM:
- Invocation count graph
- Error rate graph
- P99 latency graph

---

## Step 5 — Tear Down (to stop all charges)

```bash
# Delete the entire CloudFormation stack
cd aws
sam delete --stack-name mockmate
```

This removes all Lambda functions, API Gateway, IAM roles, and CloudWatch log groups.
> ⚠️ The Secrets Manager secret is NOT deleted by default — delete it manually if needed.

---

## Rate Limits

| Endpoint | Limit | Why |
|---|---|---|
| `POST /questions/generate` | 10 req/min per IP | Each call uses Gemini/GPT-4o tokens |
| `POST /evaluate/trigger` | 3 req/hour per IP | Each call uses Whisper + Vision + LLM |

Exceeding limits returns `HTTP 429 Too Many Requests`.

---

## Cost (Lambda-specific)

| Resource | Free Tier | Paid After |
|---|---|---|
| Lambda invocations | 1M/month free | $0.20 per 1M |
| Lambda duration | 400K GB-seconds/month | $0.0000167/GB-sec |
| API Gateway | 1M calls/month free | $3.50 per 1M |
| Secrets Manager | $0.40/secret/month | (6 key-values = ~$0.24/mo) |
| CloudWatch Logs | 5GB/month free | $0.50/GB after |
| **Total (typical usage)** | **~$0 – $0.50/month** | |

---

## Architecture Reference

```
GitHub Actions (sam deploy)
        │
        ▼
AWS CloudFormation Stack: mockmate
        │
        ├── API Gateway (HTTPS)
        │       ├── POST /questions/generate  ──→ Lambda: question_generate
        │       └── POST /evaluate/trigger    ──→ Lambda: evaluation_trigger
        │
        ├── AWS Secrets Manager
        │       └── mockmate/api-keys (GOOGLE_API_KEY, OPENAI_API_KEY)
        │
        └── CloudWatch
                ├── Log Group: /aws/lambda/mockmate-question-generate-prod
                ├── Log Group: /aws/lambda/mockmate-evaluation-trigger-prod
                └── Dashboard: MockMate-prod
```
