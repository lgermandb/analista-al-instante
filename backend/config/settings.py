"""
Configuración centralizada del backend.
Carga variables de entorno desde .env y las valida.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import List
import os


class Settings(BaseSettings):
    """Configuración de la aplicación cargada desde variables de entorno."""
    
    # API Keys
    gemini_api_key: str = Field(..., description="Google Gemini API Key")
    
    # CORS Configuration
    cors_origins: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed origins"
    )
    
    # Environment
    environment: str = Field(
        default="development",
        description="Application environment"
    )
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment.lower() == "production"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """
    Singleton pattern para cargar la configuración una sola vez.
    Usa @lru_cache para evitar leer el .env múltiples veces.
    """
    return Settings()


# Exportar instancia global
settings = get_settings()
