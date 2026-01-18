# 🚀 Analista al Instante

> **Convierte tus datos en insights con Inteligencia Artificial.**  
> Sube un archivo Excel o CSV y obtén visualizaciones profesionales en segundos.

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4.svg)](https://ai.google.dev)

---

## 📋 Tabla de Contenidos

- [Visión General](#-visión-general)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Ingeniería de Prompts](#-ingeniería-de-prompts)
- [Estructura del Proyecto](#-estructura-del-proyecto)

---

## 🎯 Visión General

**Analista al Instante** es una aplicación web full-stack que democratiza el análisis de datos. Permite a cualquier usuario, sin importar su experiencia técnica, obtener insights valiosos de sus datos simplemente subiendo un archivo.

### Características Principales

- ✅ **Drag & Drop** - Sube archivos arrastrándolos a la interfaz
- ✅ **Análisis con IA** - Google Gemini analiza tus datos y sugiere visualizaciones
- ✅ **4 Tipos de Gráficos** - Barras, líneas, circular, dispersión
- ✅ **Dashboard Interactivo** - Construye tu dashboard agregando gráficos
- ✅ **Insights Profesionales** - Cada gráfico incluye un análisis escrito por IA

---

## 🛠 Stack Tecnológico

### Frontend
| Tecnología | Propósito |
|------------|-----------|
| **React 19** | Framework de UI con hooks modernos |
| **Vite** | Build tool ultra-rápido |
| **Tailwind CSS** | Estilos utility-first |
| **Recharts** | Biblioteca de gráficos para React |
| **Axios** | Cliente HTTP |
| **Lucide React** | Iconos modernos |

### Backend
| Tecnología | Propósito |
|------------|-----------|
| **FastAPI** | Framework web async de alto rendimiento |
| **Pandas** | Procesamiento y análisis de datos |
| **Google Gemini** | Modelo de lenguaje para análisis |
| **Pydantic** | Validación de datos y configuración |
| **Uvicorn** | Servidor ASGI |

---

## 🏗 Arquitectura

```
┌─────────────────┐     HTTP      ┌─────────────────┐     API      ┌─────────────────┐
│                 │    Request    │                 │    Call      │                 │
│    Frontend     │──────────────▶│     Backend     │─────────────▶│   Google Gemini │
│    (React)      │◀──────────────│    (FastAPI)    │◀─────────────│       IA        │
│                 │   JSON/Charts │                 │    Analysis  │                 │
└─────────────────┘               └─────────────────┘               └─────────────────┘
        │                                 │
        │                                 │
    Recharts                          Pandas
   (Visualización)                (Procesamiento)
```

### Flujo de Datos

1. Usuario sube archivo CSV/Excel via drag-and-drop
2. Frontend envía archivo al endpoint `/upload`
3. Backend procesa archivo con Pandas
4. Backend envía resumen de datos a Gemini AI
5. Gemini analiza y retorna 4 sugerencias de gráficos
6. Frontend muestra tarjetas de "Insights"
7. Usuario hace clic en "Agregar al Dashboard"
8. Frontend solicita datos formateados a `/chart-data`
9. Recharts renderiza el gráfico interactivo

---

## 📦 Instalación

### Prerrequisitos

- Python 3.11+
- Node.js 18+
- API Key de Google Gemini ([obtener aquí](https://makersuite.google.com/app/apikey))

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/analista-al-instante.git
cd analista-al-instante
```

### 2. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env y agregar tu GEMINI_API_KEY
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno (opcional)
cp .env.example .env
```

### 4. Ejecutar la aplicación

**Terminal 1 - Backend:**
```bash
cd backend
.\venv\Scripts\Activate.ps1  # Windows
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Abrir en el navegador

Visita: **http://localhost:5173**

---

## 🎮 Uso

1. **Arrastra un archivo** CSV o Excel a la zona de carga
2. **Espera el análisis** de IA (5-10 segundos)
3. **Revisa los insights** en las tarjetas
4. **Haz clic en "Agregar al Dashboard"** en las visualizaciones que te interesen
5. **Explora tu dashboard** interactivo

### Formatos Soportados

- `.csv` - Archivos de valores separados por comas
- `.xlsx` - Excel moderno
- `.xls` - Excel clásico

---

## 🧠 Ingeniería de Prompts

El corazón de esta aplicación es el **prompt engineering** para obtener análisis de calidad profesional.

### Estrategia

1. **Contexto Rico**: Enviamos a Gemini no solo los datos, sino estadísticas descriptivas, tipos de datos, y valores únicos.

2. **Rol Específico**: El prompt establece que la IA actúe como "Analista de Datos Senior experto en visualización".

3. **Instrucciones Estructuradas**: Pedimos un formato JSON específico con campos obligatorios.

4. **Calidad de Insights**: Instruimos a la IA a ser específica y hacer observaciones basadas en los datos reales.

### Ejemplo de Prompt

```
Eres un Analista de Datos Senior experto en visualización...

# DATOS A ANALIZAR
- Columnas: [lista]
- Tipos: [tipos]
- Estadísticas: [describe()]
- Muestra: [primeras 5 filas]

# TU MISIÓN
Genera EXACTAMENTE 4 visualizaciones que revelen insights valiosos...

# REGLAS
1. Sé específico: di "65% de ventas en 3 regiones"
2. Identifica patrones reales
3. Usa lenguaje profesional
4. Varía los tipos de gráfico
```

### Validación de Respuestas

- Parseamos el JSON con manejo de errores
- Validamos que todas las columnas referenciadas existan
- Sistema de fallback si la IA falla

---

## 📁 Estructura del Proyecto

```
analista-al-instante/
├── backend/
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py      # Configuración con pydantic-settings
│   ├── services/
│   │   ├── __init__.py
│   │   └── ai_service.py    # Lógica de IA y prompts
│   ├── main.py              # Endpoints FastAPI
│   ├── requirements.txt     # Dependencias Python
│   ├── .env.example         # Template de variables
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Componente principal
│   │   ├── main.jsx         # Entry point
│   │   └── index.css        # Estilos Tailwind
│   ├── index.html           # HTML con SEO
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
│
└── README.md
```

---

## 🔒 Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `GEMINI_API_KEY` | API Key de Google Gemini | `AIzaSy...` |
| `CORS_ORIGINS` | Orígenes permitidos | `http://localhost:5173` |
| `ENVIRONMENT` | Entorno de ejecución | `development` |

### Frontend (`.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_URL` | URL del backend | `http://localhost:8000` |

---

## 📄 Licencia

MIT License - Ver archivo [LICENSE](LICENSE) para más detalles.

---

## 👨‍💻 Autor

**German**

---

<p align="center">
  <strong>Hecho con ❤️ y mucha IA</strong>
</p>
