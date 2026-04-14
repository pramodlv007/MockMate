# MockMate — GitHub Actions Secrets Setup

Add all of these in your GitHub repo:
**Settings → Secrets and variables → Actions → New repository secret**

---

## Required Secrets

### Vercel (Frontend)
| Secret Name | How to Get |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | `vercel whoami` or vercel.com → Settings → Team ID |
| `VERCEL_PROJECT_ID` | vercel.com → Project → Settings → Project ID |
| `VITE_API_URL` | Your Render gateway URL, e.g. `https://mockmate-gateway.onrender.com` |

**How to get Vercel IDs quickly:**
```bash
npm i -g vercel
vercel login
cd frontend && vercel link   # creates .vercel/project.json with both IDs
cat frontend/.vercel/project.json
```

---

### Render (Backend)
| Secret Name | How to Get |
|---|---|
| `RENDER_DEPLOY_HOOK_GATEWAY` | Render → mockmate-gateway → Settings → Deploy Hook → Copy URL |
| `RENDER_DEPLOY_HOOK_AUTH` | Render → mockmate-auth → Settings → Deploy Hook → Copy URL |
| `RENDER_DEPLOY_HOOK_PROFILE` | Render → mockmate-profile → Settings → Deploy Hook → Copy URL |
| `RENDER_DEPLOY_HOOK_QUESTION` | Render → mockmate-question → Settings → Deploy Hook → Copy URL |
| `RENDER_DEPLOY_HOOK_INTERVIEW` | Render → mockmate-interview → Settings → Deploy Hook → Copy URL |
| `RENDER_DEPLOY_HOOK_EVALUATION` | Render → mockmate-evaluation → Settings → Deploy Hook → Copy URL |

**Deploy hook format:** `https://api.render.com/deploy/srv-XXXX?key=YYYY`

---

### AWS (Lambda + SAM)
| Secret Name | How to Get |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS Console → IAM → Users → Create User → Access Keys |
| `AWS_SECRET_ACCESS_KEY` | Same — shown only once, copy immediately |
| `AWS_REGION` | `us-east-1` (or your preferred region) |
| `INTERVIEW_SERVICE_URL` | Your Render interview service URL |

**IAM Policy needed** (attach to the deploy user):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["cloudformation:*", "lambda:*",
      "apigateway:*", "iam:*", "s3:*", "logs:*",
      "secretsmanager:GetSecretValue"], "Resource": "*" }
  ]
}
```

> 🔒 **Best Practice**: Use `AWSPowerUserAccess` managed policy for simplicity,
> or the minimal policy above for production.

---

## Quick Verification

After adding all secrets, trigger a deploy:
```bash
git commit --allow-empty -m "test: trigger CI/CD pipeline"
git push origin main
```

Then watch: **github.com/YOUR_USERNAME/MockMate/actions**

You should see 5 jobs run:
1. ✅ `🧪 Test & Build`
2. ✅ `🚀 Deploy Frontend → Vercel`
3. ✅ `🐳 Deploy Backend → Render`
4. ✅ `☁️ Deploy Lambda → AWS`
5. ✅ `🔥 Smoke Test`
