import os
import time
import logging
import threading
import numpy as np
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from database import engine, Base
import models  # to ensure tables are created
from auth_utils import AuthException

# Router imports
from auth.routes import auth_router
from admin.routes import admin_router
from student.registration import student_registration_router
from student.updatedetails import student_update_router
from student.demo_session import demo_session_router
from student.view_attendance import attendance_router
from teacher.attendance_records import attendance_session_router

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()
THRESHOLD = float(os.getenv("THRESHOLD", "0.6"))

# Ensure tables are created
Base.metadata.create_all(bind=engine)
logger.info("PostgreSQL tables ensured (create_all)")

# OPTIMIZED MODEL MANAGER CLASS
class ModelManager:
    """
    Singleton class to manage face recognition models
    Ensures models are loaded only once and shared across all requests
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance.models_ready = False
                    cls._instance.detector = None
                    cls._instance.deepface_ready = False
        return cls._instance

    def initialize_models(self):
        """Initialize all face recognition models with proper error handling"""
        if self.models_ready:
            return

        logger.info("🤖 Starting model initialization...")
        start_time = time.time()

        try:
            # 1. Initialize MTCNN detector with optimized parameters
            from mtcnn import MTCNN
            logger.info("Loading MTCNN detector...")
            self.detector = MTCNN()
            logger.info("✅ MTCNN detector loaded successfully")

            # 2. Preload DeepFace model properly
            from deepface import DeepFace
            logger.info("Warming up DeepFace Facenet512 model...")

            # Force model download and initialization with dummy prediction
            dummy_img = np.zeros((160, 160, 3), dtype=np.uint8)

            # This forces the model to be downloaded and cached
            _ = DeepFace.represent(
                dummy_img, 
                model_name='Facenet512', 
                detector_backend='skip',
                enforce_detection=False
            )

            # Additional warm-up with different image size
            dummy_img_2 = np.ones((224, 224, 3), dtype=np.uint8) * 128
            _ = DeepFace.represent(
                dummy_img_2, 
                model_name='Facenet512', 
                detector_backend='skip',
                enforce_detection=False
            )

            self.deepface_ready = True
            logger.info("✅ DeepFace Facenet512 model warmed up successfully")
            self.models_ready = True

            initialization_time = time.time() - start_time
            logger.info(f"🎉 All models initialized successfully in {initialization_time:.2f} seconds")

        except Exception as e:
            logger.error(f"❌ Model initialization failed: {e}")
            self.models_ready = False
            raise e

    def get_detector(self):
        """Get the MTCNN detector instance"""
        if not self.models_ready:
            raise RuntimeError("Models not properly initialized")
        return self.detector

    def is_ready(self):
        """Check if all models are ready"""
        return self.models_ready and self.deepface_ready

    def health_check(self):
        """Perform model health check"""
        try:
            if not self.models_ready:
                return False

            # Test MTCNN
            test_img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
            _ = self.detector.detect_faces(test_img)

            # Test DeepFace
            from deepface import DeepFace
            test_face = np.random.randint(0, 255, (160, 160, 3), dtype=np.uint8)
            _ = DeepFace.represent(
                test_face, 
                model_name='Facenet512', 
                detector_backend='skip',
                enforce_detection=False
            )

            return True

        except Exception as e:
            logger.error(f"Model health check failed: {e}")
            return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize models on startup
    logger.info("Initializing Model Manager...")
    model_manager = ModelManager()
    model_manager.initialize_models()
    
    app.state.model_manager = model_manager
    app.state.threshold = THRESHOLD
    
    if not model_manager.is_ready():
        logger.error("❌ Cannot start server - models not ready")
        # In a real scenario we might exit here, but we let it start and fail healthchecks
        
    logger.info("🎯 All systems ready!")
    yield
    # Shutdown logic if any
    logger.info("Shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(AuthException)
async def auth_exception_handler(request: Request, exc: AuthException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.error}
    )

# Health check endpoint
@app.get('/health')
async def health_check(request: Request):
    """Health check endpoint to verify model status"""
    model_manager = getattr(request.app.state, "model_manager", None)
    if not model_manager:
        return {"status": "unhealthy", "error": "Model manager not found"}
        
    model_status = model_manager.is_ready()
    model_health = model_manager.health_check()

    return {
        "status": "healthy" if model_status and model_health else "unhealthy",
        "models_ready": model_status,
        "models_healthy": model_health,
        "timestamp": time.time()
    }

# Register routers
app.include_router(auth_router)
app.include_router(student_registration_router)
app.include_router(student_update_router)
app.include_router(demo_session_router)
app.include_router(attendance_router)
app.include_router(attendance_session_router)
app.include_router(admin_router)

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Starting FastAPI server...")
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)