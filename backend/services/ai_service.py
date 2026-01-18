"""
Servicio de Inteligencia Artificial para Analista al Instante.
=============================================================
Este módulo implementa la ingeniería de prompts avanzada para generar
insights de nivel consultor profesional.
"""
import google.generativeai as genai
import pandas as pd
import numpy as np
import json
import re
from typing import List, Dict, Any, Tuple
from config.settings import settings


# ============================================
# CONFIGURACIÓN DE GEMINI
# ============================================
genai.configure(api_key=settings.gemini_api_key)
MODEL_NAME = "gemini-2.0-flash"  # Modelo actualizado disponible en la API


# ============================================
# ANÁLISIS ESTADÍSTICO AVANZADO
# ============================================

def analyze_dataset_deeply(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Realiza un análisis estadístico profundo del dataset.
    Esto alimenta tanto el prompt como el fallback inteligente.
    """
    analysis = {
        "total_rows": len(df),
        "total_cols": len(df.columns),
        "numeric_cols": [],
        "categorical_cols": [],
        "correlations": [],
        "top_performers": [],
        "outliers": [],
        "trends": []
    }
    
    # Identificar tipos de columnas (ignorando Unnamed)
    for col in df.columns:
        if col.lower().startswith('unnamed') or col == '':
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            analysis["numeric_cols"].append(col)
        else:
            analysis["categorical_cols"].append(col)
    
    numeric = analysis["numeric_cols"]
    categorical = analysis["categorical_cols"]
    
    # Análisis de correlaciones (las más fuertes)
    if len(numeric) >= 2:
        for i, col1 in enumerate(numeric[:5]):
            for col2 in numeric[i+1:5]:
                try:
                    corr = df[col1].corr(df[col2])
                    if abs(corr) > 0.3:  # Solo correlaciones significativas
                        analysis["correlations"].append({
                            "col1": col1,
                            "col2": col2,
                            "value": round(corr, 2),
                            "strength": "fuerte" if abs(corr) > 0.7 else "moderada" if abs(corr) > 0.5 else "débil",
                            "direction": "positiva" if corr > 0 else "negativa"
                        })
                except:
                    pass
    
    # Ordenar por fuerza de correlación
    analysis["correlations"].sort(key=lambda x: abs(x["value"]), reverse=True)
    
    # Top performers por categoría (TOP 15 ordenados por promedio)
    if categorical and numeric:
        cat_col = categorical[0]
        num_col = numeric[0]
        try:
            # Agrupar y ordenar por promedio (igual que el backend)
            grouped = df.groupby(cat_col)[num_col].mean().sort_values(ascending=False)
            
            # Tomar top 15 (lo que se muestra en el gráfico)
            top_15 = grouped.head(15)
            
            if len(top_15) >= 2:
                top = top_15.index[0]  # El primero del top 15
                second = top_15.index[1]  # El segundo
                
                analysis["top_performers"].append({
                    "category_col": cat_col,
                    "metric_col": num_col,
                    "top": {"name": str(top), "value": round(top_15.iloc[0], 2)},
                    "second": {"name": str(second), "value": round(top_15.iloc[1], 2)},
                    "difference_pct": round((top_15.iloc[0] / top_15.iloc[1] - 1) * 100, 1) if top_15.iloc[1] != 0 else 0,
                    "total_categories": len(grouped),
                    "showing": min(15, len(grouped))
                })
        except:
            pass
    
    # Análisis de distribución y outliers
    for col in numeric[:3]:
        try:
            mean = df[col].mean()
            std = df[col].std()
            median = df[col].median()
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            
            # Detectar outliers
            outlier_count = len(df[(df[col] < q1 - 1.5*iqr) | (df[col] > q3 + 1.5*iqr)])
            outlier_pct = round(outlier_count / len(df) * 100, 1)
            
            # Asimetría
            skewness = df[col].skew()
            skew_type = "simétrica" if abs(skewness) < 0.5 else "asimétrica positiva" if skewness > 0 else "asimétrica negativa"
            
            analysis["outliers"].append({
                "column": col,
                "mean": round(mean, 2),
                "median": round(median, 2),
                "std": round(std, 2),
                "cv": round(std/mean * 100, 1) if mean != 0 else 0,  # Coef. variación
                "outlier_pct": outlier_pct,
                "distribution": skew_type
            })
        except:
            pass
    
    return analysis


def clean_name(col: str) -> str:
    """Limpia nombres de columnas para presentación."""
    if col.lower().startswith('unnamed'):
        return 'Índice'
    return col.replace('_', ' ').title()


# ============================================
# GENERACIÓN DE INSIGHTS PROFESIONALES
# ============================================

def generate_professional_insights(df: pd.DataFrame, analysis: Dict) -> List[Dict[str, Any]]:
    """
    Genera 4 insights de nivel consultor basados en análisis estadístico real.
    Cada insight tiene título atractivo y análisis accionable.
    """
    insights = []
    numeric = analysis["numeric_cols"]
    categorical = analysis["categorical_cols"]
    correlations = analysis["correlations"]
    top_performers = analysis["top_performers"]
    outliers = analysis["outliers"]
    
    # ============================================
    # INSIGHT 1: TOP PERFORMER (siempre el primero - impacta)
    # ============================================
    if top_performers:
        tp = top_performers[0]
        top_name = tp["top"]["name"]
        top_val = tp["top"]["value"]
        second_name = tp.get("second", {}).get("name", "otros")
        second_val = tp.get("second", {}).get("value", 0)
        diff = tp["difference_pct"]
        metric = clean_name(tp["metric_col"])
        total_cats = tp.get("total_categories", 0)
        
        if diff > 100:
            title = f"🏆 {top_name} supera {int(diff/100)}x al segundo en {metric}"
        elif diff > 50:
            title = f"📈 {top_name} domina con +{int(diff)}% en {metric}"
        else:
            title = f"🎯 {top_name} lidera en {metric} (prom. {top_val})"
        
        insight_text = (
            f"'{top_name}' alcanza un promedio de {top_val} en {metric}, "
            f"superando a '{second_name}' ({second_val}) por un {diff}%. "
            f"El gráfico muestra todos los datos en su orden original."
        )
        
        insights.append({
            "title": title,
            "chart_type": "bar",
            "parameters": {"x": tp["category_col"], "y": tp["metric_col"]},
            "insight": insight_text
        })
    
    # ============================================
    # INSIGHT 2: CORRELACIÓN MÁS FUERTE
    # ============================================
    if correlations:
        corr = correlations[0]  # La más fuerte
        col1, col2 = clean_name(corr["col1"]), clean_name(corr["col2"])
        val = corr["value"]
        strength = corr["strength"]
        direction = corr["direction"]
        
        if abs(val) > 0.7:
            emoji = "🔗" if val > 0 else "⚡"
            title = f"{emoji} Alta correlación {direction} ({val}) entre {col1} y {col2}"
            recommendation = "Considere usar una para predecir la otra."
        elif abs(val) > 0.5:
            emoji = "📊"
            title = f"{emoji} Relación {strength} entre {col1} y {col2} (r={val})"
            recommendation = "Esta relación merece investigación más profunda."
        else:
            title = f"📉 Correlación {direction} {strength}: {col1} vs {col2}"
            recommendation = "La relación existe pero es sutil."
        
        insight_text = (
            f"El coeficiente de Pearson de {val} indica una correlación {direction} {strength} "
            f"entre estas variables. {recommendation}"
        )
        
        insights.append({
            "title": title,
            "chart_type": "scatter",
            "parameters": {"x": corr["col1"], "y": corr["col2"]},
            "insight": insight_text
        })
    elif len(numeric) >= 2:
        # Fallback si no hay correlaciones significativas
        col1, col2 = numeric[0], numeric[1]
        try:
            corr_val = df[col1].corr(df[col2])
            insights.append({
                "title": f"📊 Explorando relación entre {clean_name(col1)} y {clean_name(col2)}",
                "chart_type": "scatter",
                "parameters": {"x": col1, "y": col2},
                "insight": f"Con r={corr_val:.2f}, no hay correlación lineal significativa. Los datos pueden tener una relación no lineal que requiere análisis adicional."
            })
        except:
            pass
    
    # ============================================
    # INSIGHT 3: ANÁLISIS DE VOLATILIDAD/DISTRIBUCIÓN
    # ============================================
    if outliers:
        out = outliers[0]
        col = clean_name(out["column"])
        cv = out["cv"]
        outlier_pct = out["outlier_pct"]
        distribution = out["distribution"]
        mean = out["mean"]
        median = out["median"]
        
        if cv > 50:
            emoji = "⚠️"
            title = f"{emoji} Alta variabilidad en {col} (CV={cv}%)"
            risk_level = "alta"
        elif cv > 25:
            emoji = "📈"
            title = f"{emoji} Variabilidad moderada en {col}"
            risk_level = "moderada"
        else:
            emoji = "✅"
            title = f"{emoji} {col} muestra estabilidad consistente"
            risk_level = "baja"
        
        # Insight sobre asimetría
        if abs(mean - median) / mean > 0.1:
            skew_insight = f"La diferencia entre media ({mean}) y mediana ({median}) indica distribución {distribution}. "
        else:
            skew_insight = ""
        
        insight_text = (
            f"{col} presenta variabilidad {risk_level} (CV={cv}%). {skew_insight}"
            f"{'Se detectaron ' + str(outlier_pct) + '% de valores atípicos que podrían requerir investigación.' if outlier_pct > 5 else 'Los datos son consistentes sin outliers significativos.'}"
        )
        
        insights.append({
            "title": title,
            "chart_type": "area",
            "parameters": {"x": categorical[0] if categorical else numeric[0], "y": out["column"]},
            "insight": insight_text
        })
    
    # ============================================
    # INSIGHT 4: COMPOSICIÓN O TENDENCIA SECUNDARIA
    # ============================================
    if len(numeric) >= 2 and categorical:
        # Buscar segunda métrica interesante
        metric = numeric[1] if len(numeric) > 1 else numeric[0]
        cat = categorical[0]
        
        try:
            # Calcular estadísticas
            total = df[metric].sum()
            mean = df[metric].mean()
            max_val = df[metric].max()
            min_val = df[metric].min()
            range_val = max_val - min_val
            
            title = f"📊 Panorama de {clean_name(metric)}: rango de {min_val:.0f} a {max_val:.0f}"
            
            insight_text = (
                f"Los valores de {clean_name(metric)} oscilan entre {min_val:.2f} y {max_val:.2f}, "
                f"con una media de {mean:.2f}. Este rango de {range_val:.2f} sugiere "
                f"{'alta diversidad en los datos' if range_val/mean > 1 else 'relativa homogeneidad'}."
            )
            
            insights.append({
                "title": title,
                "chart_type": "line",
                "parameters": {"x": cat, "y": metric},
                "insight": insight_text
            })
        except:
            pass
    
    # Asegurar 4 insights
    while len(insights) < 4:
        if numeric:
            col = numeric[len(insights) % len(numeric)]
            x_col = categorical[0] if categorical else col
            
            try:
                mean = df[col].mean()
                insights.append({
                    "title": f"📈 Vista general de {clean_name(col)}",
                    "chart_type": ["bar", "line", "area", "pie"][len(insights) % 4],
                    "parameters": {"x": x_col, "y": col},
                    "insight": f"Exploración de {clean_name(col)} con promedio de {mean:.2f}. Ideal para identificar patrones iniciales."
                })
            except:
                break
        else:
            break
    
    return insights[:4]


# ============================================
# PROMPT ENGINEERING AVANZADO
# ============================================

def build_expert_prompt(df: pd.DataFrame, analysis: Dict) -> str:
    """
    Construye un prompt de nivel experto para Gemini.
    """
    columns = df.columns.tolist()
    sample = df.head(3).to_dict(orient='records')
    
    # Preparar resumen de hallazgos
    findings = []
    if analysis["correlations"]:
        c = analysis["correlations"][0]
        findings.append(f"- Correlación {c['strength']} {c['direction']} ({c['value']}) entre {c['col1']} y {c['col2']}")
    if analysis["top_performers"]:
        tp = analysis["top_performers"][0]
        findings.append(f"- {tp['top']['name']} lidera en {tp['metric_col']} con {tp['top']['value']}")
    if analysis["outliers"]:
        o = analysis["outliers"][0]
        findings.append(f"- {o['column']} tiene CV={o['cv']}% y {o['outlier_pct']}% de outliers")
    
    prompt = f"""Eres un consultor de Business Intelligence senior presentando a ejecutivos C-level.

# DATASET ANALIZADO
- **Filas**: {analysis['total_rows']:,} registros
- **Columnas**: {columns}
- **Numéricas**: {analysis['numeric_cols']}
- **Categóricas**: {analysis['categorical_cols']}

# HALLAZGOS PRELIMINARES (ya calculados)
{chr(10).join(findings) if findings else "Análisis inicial pendiente"}

# MUESTRA DE DATOS
{json.dumps(sample, indent=2, default=str, ensure_ascii=False)}

# TU MISIÓN
Genera 4 visualizaciones con insights ACCIONABLES para la toma de decisiones ejecutivas.

# ESTILO DE COMUNICACIÓN
- **Títulos**: Impactantes y ejecutivos. Usa emojis estratégicamente.
  ✅ "🏆 Región Norte genera 3x más revenue"
  ✅ "⚠️ Alta volatilidad en costos operativos (riesgo)"
  ✅ "📈 Correlación fuerte (r=0.85) entre satisfacción y retención"
  ❌ "Análisis de ventas por región" (muy genérico)
  ❌ "Gráfico de barras de X" (describe formato, no insight)

- **Insights**: Como un consultor de McKinsey:
  ✅ "El análisis revela que los clientes premium contribuyen el 67% del revenue total, sugiriendo oportunidades de upselling en el segmento medio."
  ❌ "Este gráfico muestra la distribución de ventas."

# FORMATO OBLIGATORIO
Responde SOLO con JSON válido:
```json
[
  {{
    "title": "Emoji + Hallazgo específico con número",
    "chart_type": "bar|line|pie|scatter|area",
    "parameters": {{"x": "columna_exacta", "y": "columna_exacta"}},
    "insight": "Análisis ejecutivo de 2-3 oraciones con recomendación accionable."
  }}
]
```

COLUMNAS VÁLIDAS: {columns}
"""
    return prompt


async def analyze_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Función principal: analiza DataFrame y genera insights profesionales.
    Combina Gemini AI con análisis estadístico local para máxima calidad.
    """
    # Paso 1: Análisis estadístico profundo
    analysis = analyze_dataset_deeply(df)
    
    try:
        # Paso 2: Intentar con Gemini
        prompt = build_expert_prompt(df, analysis)
        model = genai.GenerativeModel(MODEL_NAME)
        response = model.generate_content(prompt)
        
        # Parsear respuesta
        text = response.text.strip()
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'^```\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        
        suggestions = json.loads(text)
        
        if isinstance(suggestions, list) and len(suggestions) >= 3:
            # Validar columnas
            valid_cols = df.columns.tolist()
            validated = []
            for s in suggestions:
                x = s.get('parameters', {}).get('x')
                y = s.get('parameters', {}).get('y')
                if x in valid_cols and (y is None or y in valid_cols):
                    validated.append(s)
            
            if len(validated) >= 3:
                return validated[:4]
    
    except Exception as e:
        print(f"Gemini error (usando fallback profesional): {e}")
    
    # Paso 3: Fallback con insights profesionales calculados localmente
    return generate_professional_insights(df, analysis)
