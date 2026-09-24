# Connitor deploy automation

Backend → **EC2** at [https://connitor.bengalurutechcommunity.com](https://connitor.bengalurutechcommunity.com)  
Frontend → **AWS Amplify** static hosting (e.g. `staging.<appId>.amplifyapp.com`)

## One-time setup

### 1. Local config

```powershell
cd C:\Users\Ditto\Desktop\connitor\connitor-main
Copy-Item .\scripts\deploy\config.example.env .\scripts\deploy\config.env
notepad .\scripts\deploy\config.env
```

Fill in:

| Key | Purpose |
| --- | --- |
| `AMPLIFY_APP_ID` | From Amplify console. **Note:** `d3cmxbitwiyeim` is not in AWS account `mohangola` — use an app in the active profile (e.g. `d1asvelid8ysbt`) or switch credentials. |
| `EC2_PPK_KEY` | Optional PuTTY `.ppk`; scripts convert to OpenSSH PEM automatically |
| `EC2_REMOTE_DIR` | `/home/ubuntu/connitor/connitor` on the current EC2 |
| `EC2_SYSTEMD_SERVICE` | `conni` |
| `EC2_VENV_DIR` | `conni` (venv folder under `python_backend/`) |

### 2. AWS CLI

```powershell
aws sts get-caller-identity
```

Use the account that owns the **Connitor Amplify app**. Manual zip deploy needs `amplify:CreateDeployment`, `StartDeployment`, `GetJob`.

### 3. EC2: systemd unit (recommended)

On the instance:

```bash
sudo cp /home/ubuntu/connitor/scripts/deploy/connitor-api.service.example /etc/systemd/system/connitor-api.service
# Edit paths/user if needed
sudo systemctl daemon-reload
sudo systemctl enable --now connitor-api
curl -s http://127.0.0.1:8000/ | head
```

Put nginx/Caddy in front for HTTPS on `connitor.bengalurutechcommunity.com` → `127.0.0.1:8000`.

### 4. EC2: first clone

```bash
cd /home/ubuntu
git clone https://github.com/dittocodes/connitor.git connitor
cd connitor/python_backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# copy production .env onto the server (never commit it)
```

For `EC2_DEPLOY_METHOD=git`, merge/push to `main` (or set `EC2_GIT_BRANCH`) before deploying.

---

## Deploy commands (from Windows)

```powershell
# Backend only (SSH → git pull / rsync → restart)
.\scripts\deploy\deploy-backend.ps1

# Frontend only (build + Amplify zip upload)
.\scripts\deploy\deploy-frontend.ps1

# Both
.\scripts\deploy\deploy-all.ps1
```

Options:

```powershell
.\scripts\deploy\deploy-backend.ps1 -Method rsync   # push local tree (keeps server .env)
.\scripts\deploy\deploy-frontend.ps1 -SkipBuild     # re-upload existing frontend/dist
.\scripts\deploy\deploy-all.ps1 -BackendOnly
.\scripts\deploy\deploy-all.ps1 -FrontendOnly
```

---

## Amplify Git-connected builds (optional)

`frontend/amplify.yml` is included. In Amplify Console:

1. Connect GitHub repo `dittocodes/connitor`
2. Set **app root** to `frontend` (or use the monorepo amplify.yml at repo root if you prefer)
3. Env var: `NEXT_PUBLIC_BACKEND_API_URL=https://connitor.bengalurutechcommunity.com`
4. Artifact dir: `dist`

Then pushes to the connected branch auto-build. Manual `deploy-frontend.ps1` still works for hotfixes.

---

## Flow

```text
deploy-all.ps1
 ├─ deploy-backend.ps1
 │   ├─ scp remote-backend-update.sh
 │   ├─ git pull  OR  rsync python_backend/
 │   ├─ pip install + optional migrations
 │   └─ systemctl restart connitor-api
 └─ deploy-frontend.ps1
     ├─ NEXT_PUBLIC_BACKEND_API_URL=… npm run build → dist/
     ├─ zip dist
     └─ Amplify create-deployment → PUT zip → start-deployment → poll SUCCEED
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `create-deployment` AccessDenied | Wrong AWS account/profile for the Amplify app |
| SSH Permission denied | Fix `EC2_SSH_KEY` / security group port 22 / user |
| Health check fails after restart | Check `journalctl -u connitor-api -n 100`; nginx upstream port |
| Frontend still hits old API | Rebuild with correct `NEXT_PUBLIC_BACKEND_API_URL` (baked at build time) |
| CORS errors | On EC2 `.env` set `CORS_ALLOWED_ORIGINS` to your Amplify URL |
