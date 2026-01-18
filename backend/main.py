"""
Analista al Instante - Backend API
===================================
API REST para análisis de datos con Inteligencia Artificial.

Endpoints:
    POST /upload      - Subir archivo y obtener sugerencias de gráficos
    POST /chart-data  - Obtener datos formateados para un gráfico específico
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import io
from typing import Optional

# Importar configuración y servicios
from config.settings import settings
from services.ai_service import analyze_dataframe


# ============================================
# CONFIGURACIÓN DE LA APLICACIÓN
# ============================================

app = FastAPI(
    title="Analista al Instante API",
    description="API para análisis de datos con IA",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado global para el DataFrame (en producción usaríamos Redis/DB)
uploaded_df: Optional[pd.DataFrame] = None


# ============================================
# MODELOS DE DATOS
# ============================================

class ChartDataRequest(BaseModel):
    """Request para obtener datos de un gráfico."""
    chart_type: str
    x: str
    y: Optional[str] = None


class HealthResponse(BaseModel):
    """Response del health check."""
    status: str
    environment: str


# ============================================
# ENDPOINTS
# ============================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    Útil para verificar que el servidor está funcionando.
    """
    return HealthResponse(
        status="healthy",
        environment=settings.environment
    )


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Sube un archivo CSV o Excel y obtiene sugerencias de visualización.
    
    Args:
        file: Archivo .csv o .xlsx/.xls
        
    Returns:
        Lista de sugerencias de gráficos generadas por IA
    """
    global uploaded_df
    
    # Validar extensión del archivo
    filename = file.filename.lower()
    valid_extensions = ('.csv', '.xlsx', '.xls')
    
    if not any(filename.endswith(ext) for ext in valid_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado. Use: {', '.join(valid_extensions)}"
        )
    
    try:
        # Leer contenido del archivo
        contents = await file.read()
        
        # Parsear según el tipo de archivo
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:  # Excel
            df = pd.read_excel(io.BytesIO(contents))
        
        # Limpiar nombres de columnas
        df.columns = [str(col).strip() for col in df.columns]
        
        # Guardar el DataFrame para uso posterior
        uploaded_df = df
        
        # Analizar con IA y obtener sugerencias
        suggestions = await analyze_dataframe(df)
        
        return {
            "success": True,
            "filename": file.filename,
            "rows": len(df),
            "columns": df.columns.tolist(),
            "chart_suggestions": suggestions
        }
        
    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="El archivo está vacío o no tiene datos válidos"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando archivo: {str(e)}"
        )


@app.post("/chart-data")
async def get_chart_data(request: ChartDataRequest):
    """
    Obtiene los datos formateados para renderizar un gráfico específico.
    
    Args:
        request: Tipo de gráfico y columnas a usar
        
    Returns:
        Datos formateados para Recharts
    """
    global uploaded_df
    
    if uploaded_df is None:
        raise HTTPException(
            status_code=400,
            detail="No hay datos cargados. Por favor sube un archivo primero."
        )
    
    df = uploaded_df.copy()
    
    # Validar que las columnas existan
    if request.x not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"La columna '{request.x}' no existe en los datos"
        )
    
    if request.y and request.y not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"La columna '{request.y}' no existe en los datos"
        )
    
    try:
        if request.chart_type == 'scatter':
            # Para scatter, necesitamos ambas columnas
            if not request.y:
                raise HTTPException(
                    status_code=400,
                    detail="El gráfico de dispersión requiere dos columnas"
                )
            
            # Filtrar valores no numéricos y NaN
            scatter_data = df[[request.x, request.y]].dropna()
            
            # OPTIMIZACIÓN: Limitar a 500 puntos para mejor performance
            # En datasets grandes, muestreamos aleatoriamente
            MAX_SCATTER_POINTS = 500
            if len(scatter_data) > MAX_SCATTER_POINTS:
                scatter_data = scatter_data.sample(n=MAX_SCATTER_POINTS, random_state=42)
            
            return {
                "data": scatter_data.to_dict(orient='records'),
                "x": request.x,
                "y": request.y,
                "sampled": len(df) > MAX_SCATTER_POINTS,
                "original_count": len(df),
                "displayed_count": len(scatter_data)
            }
        
        else:  # bar, line, pie, area
            labels = []
            values = []
            
            # Caso 1: Tenemos columna Y numérica - agrupar y promediar (SIN REORDENAR)
            if request.y and request.y in df.columns and pd.api.types.is_numeric_dtype(df[request.y]):
                try:
                    # Agrupar por X y calcular PROMEDIO, manteniendo orden original
                    # sort=False preserva el orden en que aparecen en el dataset
                    grouped = df.groupby(request.x, sort=False)[request.y].mean()
                    labels = [str(x) for x in grouped.index.tolist()]
                    values = [round(v, 2) for v in grouped.values.tolist()]
                except Exception as e:
                    print(f"Error en groupby: {e}, usando fallback")
                    # Fallback: mantener orden de aparición
                    counts = df[request.x].value_counts()
                    labels = [str(x) for x in counts.index.tolist()]
                    values = counts.values.tolist()
            
            # Caso 2: No hay Y o no es numérica - contar frecuencias (mantener orden de aparición)
            else:
                # Usar drop_duplicates para mantener orden de primera aparición
                unique_values = df[request.x].drop_duplicates().tolist()
                counts = df[request.x].value_counts()
                labels = [str(x) for x in unique_values]
                values = [int(counts.get(x, 0)) for x in unique_values]
            
            # NO LIMITAR - mostrar todos los datos
            values = [int(v) if isinstance(v, int) else round(float(v), 2) for v in values]
            
            return {
                "labels": labels,
                "values": values,
                "aggregation": "mean" if request.y else "count",
                "total_items": len(labels)
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generando datos del gráfico: {str(e)}"
        )


# ============================================
# MANEJO DE ERRORES GLOBAL
# ============================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Manejador global de excepciones no capturadas."""
    return {
        "success": False,
        "error": "Error interno del servidor",
        "detail": str(exc) if not settings.is_production else None
    }