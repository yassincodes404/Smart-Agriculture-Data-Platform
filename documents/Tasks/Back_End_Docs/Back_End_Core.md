
---

#  `core/` FILES

Here is the **exact set of Python files you should have**:

```text
core/
├── config.py
├── security.py
├── dependencies.py
├── constants.py   (optional but useful)
```

---

# 1️⃣ `config.py`

## 🎯 Purpose

Central place for:

* environment variables
* system configuration
* service connections

This is required because:

> backend relies on `.env.backend` and `.env.db` 

---

## ✅ What it should handle

* DB connection string
* API keys (AI, search)
* file paths (`data/csv`, `data/images`)
* app settings

---

## 🔧 Example Responsibilities

```python
DATABASE_URL
SECRET_KEY
AI_API_KEY
DATA_PATH_CSV
DATA_PATH_IMAGES
```

---

## 🧠 Why it matters

Everything depends on config:

```text
db/ → uses config
ai/ → uses config
ingestion/ → uses config
```

👉 This is the **center of your system**

---

# 2️⃣ `security.py` → 🔐 AUTH SYSTEM

## 🎯 Purpose

Implements authentication logic required by:

* `users/`
* `api/auth.py`

---

## ✅ What it should handle

From your features:

* user system
* protected APIs
* possibly admin roles

---

## 🔧 Responsibilities

```python
hash_password()
verify_password()
create_access_token()
decode_token()
```

---

## 🧠 Why needed

From your plan:

> user management + secure APIs are core features 

---

# 3️⃣ `dependencies.py` → 🔗 FASTAPI INTEGRATION

## 🎯 Purpose

This is the **bridge between FastAPI and your core logic**

---

## ✅ What it should handle

* reusable dependencies
* auth guards
* common request logic

---

## 🔧 Example

```python
def get_current_user():
    ...

def require_admin():
    ...
```

---

## 🧠 Why important

Used in:

```text
api/users.py
api/analytics.py
api/upload.py
```

---

## Example usage:

```python
@router.get("/protected")
def endpoint(user = Depends(get_current_user)):
    ...
```

---

# 4️⃣ `constants.py` → ⚙️ GLOBAL CONSTANTS (Optional)

## 🎯 Purpose

Store fixed values used across system

---

## ✅ Examples

```python
DEFAULT_PAGE_SIZE = 20
MAX_UPLOAD_SIZE_MB = 10

IMAGE_FOLDER = "data/images"
CSV_FOLDER = "data/csv"
```

---

## 🧠 Why useful

Because your system deals with:

* uploads
* CSV ingestion
* images (CV module)

👉 avoids hardcoding everywhere

---

# 🔄 How `core/` Connects to Your System

---

## 🔗 Example 1: DB

```text
db/session.py
   ↓
core/config.py
```

---

## 🔗 Example 2: Auth

```text
api/auth.py
   ↓
core/security.py
```

---

## 🔗 Example 3: Protected APIs

```text
api/users.py
   ↓
core/dependencies.py
```

---

## 🔗 Example 4: File Handling

```text
ingestion/
cv/
upload/
   ↓
core/constants.py
```

---

# ⚠️ What You Should NOT Add (Important)

Even though docs mention more advanced systems:

* ❌ no logging system here (you didn’t include `log/`)
* ❌ no Celery config (removed in your version) 
* ❌ no storage adapters (keep simple for now)

---

# 🧠 Final Mental Model

Your `core/` is:

```text
🧠 System Brain (global rules)
⚙️ Configuration Center
🔐 Security Engine
🔗 FastAPI glue layer
```

---

# ✅ FINAL ANSWER

👉 The correct Python files for your `core/` folder are:

```text
core/
├── config.py        # environment + settings (REQUIRED)
├── security.py      # auth + hashing + tokens (REQUIRED)
├── dependencies.py  # FastAPI shared dependencies (REQUIRED)
├── constants.py     # global constants (OPTIONAL but recommended)
```

---

# 🚀 Best Next Step

Now you’re at the **perfect point to start implementation**

👉 Start with:

1. `config.py`
2. `db/session.py` (connect using config)
3. then `security.py`

---
