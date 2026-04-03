# 🌾 Harvest Box — AI-Powered Crop Health Monitoring System

<div align="center">

![Harvest Box](https://img.shields.io/badge/Harvest%20Box-Production%20Grade-green?style=for-the-badge)
![Java](https://img.shields.io/badge/Java-21-orange?style=flat-square&logo=java)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.1-brightgreen?style=flat-square&logo=springboot)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?style=flat-square&logo=fastapi)
![PyTorch](https://img.shields.io/badge/PyTorch-2.2+-EE4C2C?style=flat-square&logo=pytorch)
![AWS S3](https://img.shields.io/badge/AWS-S3-FF9900?style=flat-square&logo=amazon-aws)

**A full-stack, production-grade agricultural intelligence platform for grape disease detection, weather-aware risk assessment, and AI-generated crop health reports.**

[Live Demo](#) · [API Docs](#api-documentation) · [Report Bug](#) · [Request Feature](#)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
  - [Backend (Spring Boot)](#backend-spring-boot)
  - [ML Service (FastAPI)](#ml-service-fastapi)
  - [Frontend (React + Vite)](#frontend-react--vite)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [ML Model](#ml-model)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Harvest Box** is an end-to-end crop health intelligence platform built for Indian agriculture. A farmer uploads a photograph of a grape leaf, and within seconds the platform:

1. **Classifies** the disease using a fine-tuned DenseNet121 model (Black Rot · Downy Mildew · Powdery Mildew · Healthy)
2. **Fetches live weather** from Open-Meteo and assesses fungal disease pressure
3. **Generates a structured agronomic report** via Gemini 2.5 Flash (with Qwen 72B fallback)
4. **Produces a downloadable PDF** with confidence charts, disease heatmaps, historical trends, and a 14-day treatment plan
5. **Stores results** in AWS S3 and PostgreSQL for a persistent, searchable analysis history

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│    React 19 + Vite · Zustand · Recharts · Vercel             │
│    Dashboard · FieldSetup · Reports · User Profile           │
└──────────────────────┬──────────────────────────────────────┘
                       │  REST (JWT Bearer)
┌──────────────────────▼──────────────────────────────────────┐
│                  BACKEND  (Spring Boot 3.2)                  │
│  AuthController · ImageController · PlantController          │
│  WeatherController · UserController                          │
│  ─────────────────────────────────────────────               │
│  AuthService · PlantService · MLClientService                │
│  ImageStorageService · JwtService · EmailService             │
│  ─────────────────────────────────────────────               │
│  H2 (dev) / PostgreSQL (prod) · Flyway · AWS SDK v2          │
└────────┬────────────────────────┬───────────────────────────┘
         │  S3 (images/PDFs)      │  HTTP POST /api/v1/analyze-field
         ▼                        ▼
     ┌────────┐        ┌──────────────────────────┐
     │  AWS   │        │    ML SERVICE  (FastAPI)  │
     │   S3   │        │  DenseNet121 Inference    │
     └────────┘        │  Weather (Open-Meteo)     │
                       │  Report Gen (Gemini/HF)   │
                       │  PDF (fpdf2 + Matplotlib) │
                       │  Forecast Store (JSON)    │
                       └──────────────────────────┘
```

---

## Features

### 🔐 Authentication
- JWT-based stateless authentication
- Email + OTP verification on registration (5-minute expiry)
- BCrypt password hashing with `SecureRandom` OTP generation
- Rate limiting via Bucket4j
- CORS-safe preflight handling

### 🌿 Field Analysis
- Upload grape leaf images (JPEG/PNG/WEBP, max 5 MB)
- Grid-based field mapping (row × column coordinate system)
- Named field blocks (e.g., "Vineyard Block A")
- GPS coordinate capture for accurate weather lookup
- Multi-image support with confidence-weighted aggregation

### 🤖 ML Pipeline
- **DenseNet121** fine-tuned on grape disease dataset
- 4 classes: `Black_Rot`, `Downy_Mildew`, `Healthy`, `Powdery_Mildew`
- Softmax probability output → confidence percentages
- Per-cell heatmap with severity mapping (`none` / `medium` / `high`)
- Persistent per-user analysis history (JSON forecast store)

### 🌤 Weather Intelligence
- Live weather via **Open-Meteo** (no API key required)
- Agronomic disease-risk heuristics (Low / Moderate / High)
- 30-minute server-side cache per location
- Weather-disease interaction analysis in reports

### 📄 Report Generation
- **Gemini 2.5 Flash** primary LLM (fallback: **Qwen 72B via HuggingFace**)
- 9-section structured reports: diagnosis, treatment plan, spatial analysis, 14-day forecast, IPM calendar
- ASCII confidence bar charts embedded in prompt
- PDF with matplotlib confidence charts, disease pie charts, historical trend lines
- Reports uploaded to AWS S3 and linked in the database

### 📊 Dashboard & Analytics
- Live weather widget with 7-day forecast
- Scan trend cards with disease breakdown bars
- Smart field alerts combining weather + scan data
- Analytics tab: confidence rating graph, disease distribution pie, trend line chart
- Zustand store with 60-second client-side cache

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Zustand, Recharts, React Router 7 |
| Backend | Java 21, Spring Boot 3.2.1, Spring Security, Flyway, Bucket4j |
| ML Service | Python 3.11+, FastAPI, PyTorch 2.2, DenseNet121, fpdf2, Matplotlib |
| Database | H2 (dev), PostgreSQL (prod) |
| Storage | AWS S3 (ap-south-1) |
| AI/LLM | Google Gemini 2.5 Flash, Qwen 2.5 72B via HuggingFace |
| Weather | Open-Meteo (ML), OpenWeatherMap (frontend proxy) |
| Auth | JWT (JJWT 0.12.3), BCrypt |
| Docs | SpringDoc OpenAPI 2.3 (Swagger UI) |
| CI | GitHub Actions |
| Deploy | Render (backend), Vercel (frontend), Docker |

---

## Project Structure

```
harvest-box/
├── backend/                      # Spring Boot API
│   ├── src/main/java/com/capstone/project/
│   │   ├── config/               # Security, CORS, JWT filter, S3, rate limiting
│   │   ├── controller/           # AuthController, ImageController, PlantController,
│   │   │                         # UserController, WeatherController
│   │   ├── dto/                  # Request/Response DTOs
│   │   ├── exception/            # ApiException, GlobalExceptionHandler
│   │   ├── model/                # User, Plant, VerificationToken entities
│   │   ├── repository/           # JPA repositories
│   │   └── service/              # AuthService, PlantService, MLClientService,
│   │                             # ImageStorageService, JwtService, EmailService, UserService
│   ├── src/main/resources/
│   │   ├── db/migration/         # Flyway SQL migrations (V1, V2)
│   │   ├── application.yml       # Base config
│   │   ├── application-dev.yml   # Dev profile (H2)
│   │   └── application-prod.yml  # Prod profile (PostgreSQL)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── pom.xml
│
├── frontend/                     # React SPA
│   ├── src/
│   │   ├── api/client.js         # Authenticated fetch wrapper, ApiError
│   │   ├── components/           # Charts, ChatBot, ErrorBoundary, Navbar, OtpInput
│   │   ├── context/              # AuthContext, AuthProvider, useAuth hook
│   │   ├── pages/                # Auth, Dashboard, FieldSetup, Reports, User
│   │   ├── services/weatherService.js  # GPS + IP fallback, OWM proxy calls
│   │   ├── store/useAppStore.js  # Zustand stores (reports, upload, forecast)
│   │   └── App.jsx               # Router + lazy loading + AuthProvider
│   ├── vercel.json
│   └── vite.config.js
│
└── ml_service/                   # FastAPI ML microservice
    ├── app.py                    # FastAPI app, lifespan, middleware
    ├── config/settings.py        # All env vars in one place
    ├── routes/v1/
    │   ├── analyze.py            # POST /api/v1/analyze-field
    │   └── health.py             # GET /api/v1/health
    ├── services/
    │   ├── inference.py          # DenseNet121 loader + predictor
    │   ├── weather.py            # Open-Meteo client + disease risk heuristics
    │   ├── report.py             # LLM report generation (Gemini / HF)
    │   ├── pdf.py                # PDF generation with charts
    │   ├── storage.py            # S3 download/upload
    │   ├── aggregation.py        # Multi-image confidence voting
    │   ├── heatmap.py            # Grid heatmap builder
    │   └── forecast_store.py     # Per-user JSON persistence
    ├── middleware/error_handler.py
    ├── utils/logger.py
    ├── model/best_grape_model.pth
    └── requirements.txt
```

---

## Quick Start

### Prerequisites

- Java 21+
- Python 3.11+
- Node.js 20+
- AWS account with S3 bucket
- (Optional) Google Gemini API key, HuggingFace API key, OpenWeatherMap API key

---

### Backend (Spring Boot)

```bash
cd backend

# Copy and fill in environment variables
cp .env.example .env

# Run with dev profile (H2 in-memory database)
SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run

# Or with Docker
docker-compose up
```

The backend starts on **http://localhost:8080**. Swagger UI is at `/swagger-ui.html`.

---

### ML Service (FastAPI)

```bash
cd "ml service"

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Place model file
# Download best_grape_model.pth and place it in model/

# Copy and fill env vars
cp .env.example .env

# Start service
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The ML service starts on **http://localhost:8000**.

---

### Frontend (React + Vite)

```bash
cd frontend

npm install

# Set the backend URL
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8080

npm run dev
```

The frontend starts on **http://localhost:5173**.

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Database (dev uses H2 automatically; prod needs these)
DB_URL=jdbc:postgresql://localhost:5432/harvestbox
DB_USERNAME=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-256-bit-secret-key-minimum-32-characters
JWT_EXPIRY_MS=604800000   # 7 days

# AWS S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET=your-bucket-name

# Email (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=app-password

# Weather (OpenWeatherMap — used by WeatherController proxy)
WEATHER_API_KEY=your_owm_key

# ML Service URL
ML_BASE_URL=http://localhost:8000
```

### ML Service (`ml service/.env`)

```env
# AWS
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=ap-south-1
S3_BUCKET=your-bucket-name

# AI (optional — enables hybrid Gemini inference + Gemini report generation)
GEMINI_API_KEY=your_gemini_key
HF_API_KEY=your_hf_key

# Feature flags
ENABLE_GEMINI=false       # true = use Gemini for both vision and report generation
ENABLE_FORECAST=true      # persist scan history for trend charts

# Default field GPS (Bengaluru — overridden per-request by lat/lon params)
DEFAULT_LAT=12.9716
DEFAULT_LON=77.5946

ENV=development
LOG_LEVEL=INFO
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8080
```

---

## API Reference

Full interactive docs available at `/swagger-ui.html` when the backend is running.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Register new user, sends OTP |
| POST | `/api/v1/auth/login` | Public | Login, returns JWT |
| POST | `/api/v1/auth/verify-otp` | Public | Verify email OTP, returns JWT |
| POST | `/api/v1/auth/resend-otp` | Public | Resend verification OTP |

### Images & Analysis

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/images/upload` | Bearer | Upload leaf image, trigger ML analysis |

**Upload form fields:** `file`, `row` (int), `col` (int), `fieldName` (optional), `lat` (optional), `lon` (optional)

### Plants / Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/plants?page=0&size=20` | Bearer | Paginated reports for current user |
| POST | `/api/v1/plants` | Bearer | Manually create plant record |

### User

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/user/summary` | Bearer | Dashboard summary (counts, profile) |
| PUT | `/api/v1/user/profile` | Bearer | Update name/location |

### Weather

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/weather?lat=&lon=` | Bearer | Current weather (OWM proxy) |
| GET | `/api/v1/weather/forecast?lat=&lon=` | Bearer | 5-day forecast (OWM proxy) |

### ML Service (internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analyze-field` | Run inference + generate report |
| GET | `/api/v1/health` | Health check with feature flags |

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| email | VARCHAR(255) UNIQUE | Lowercased |
| password_hash | VARCHAR(255) | BCrypt |
| name | VARCHAR(255) | |
| location | VARCHAR(255) | |
| verified | BOOLEAN | Email OTP required |
| created_at | TIMESTAMP | |

### `plant`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| user_id | BIGINT FK → users | Cascade delete |
| row_index | INT | Grid row |
| col_index | INT | Grid column |
| image_url | TEXT | S3 URL |
| health | VARCHAR(50) | `Healthy`, `Black_Rot`, etc. |
| severity | DOUBLE PRECISION | 0.0 / 0.5 / 1.0 |
| confidence | DOUBLE PRECISION | 0–100 % |
| fusion_method | VARCHAR(50) | `local_only` or `hybrid_geometric_mean` |
| field_name | VARCHAR(255) | Human-readable block name |
| weather_risk | VARCHAR(20) | `Low` / `Moderate` / `High` / `Unknown` |
| report_pdf_url | TEXT | S3 PDF link |
| analyzed_at | TIMESTAMP | |

### `verification_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| user_id | BIGINT FK → users | Cascade delete |
| otp | VARCHAR(10) | 6-digit numeric |
| expiry_date | TIMESTAMP | 5 minutes TTL |

Migrations are managed by **Flyway** (`V1__init_schema.sql`, `V2__add_hybrid_ml_columns.sql`).

---

## ML Model

- **Architecture:** DenseNet121 (ImageNet pre-trained, classifier head replaced)
- **Classes:** `Black_Rot`, `Downy_Mildew`, `Healthy`, `Powdery_Mildew`
- **Input:** 224×224 RGB, ImageNet normalisation
- **Output:** Softmax probabilities → confidence percentage
- **Device:** CPU (no GPU required)
- **File:** `ml_service/model/best_grape_model.pth`

> ⚠️ **Scope:** The model is trained exclusively on grape leaves. Results for other crops are not reliable.

---

## Deployment

### Docker (Backend)

```bash
cd backend
docker build -t harvest-box-backend .
docker run -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_URL=... \
  -e JWT_SECRET=... \
  harvest-box-backend
```

### Docker (ML Service)

```bash
cd "ml service"
docker build -t harvest-box-ml .
docker run -p 8000:8000 \
  -e AWS_ACCESS_KEY_ID=... \
  -e S3_BUCKET=... \
  harvest-box-ml
```

### Render (Backend)

Set `JAVA_OPTS=-Dspring.profiles.active=prod` in Render environment variables along with all required secrets.

### Vercel (Frontend)

```bash
cd frontend
vercel deploy --prod
```

Set `VITE_API_BASE_URL` in the Vercel project environment settings.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please ensure tests pass: `./mvnw test` (backend) and `pytest` (ML service).

---

## License

This project is licensed under the terms found in [LICENSE](./LICENSE).

---

<div align="center">
Made with ❤️ for Indian farmers · Powered by DenseNet121, Gemini, and Spring Boot
</div>
