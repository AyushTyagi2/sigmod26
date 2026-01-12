from types import SimpleNamespace
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shutil
import uuid

from .run import run_poligras

ALLOWED_EXTS = (
    ".csv",
    ".zip",
    ".tar",
    ".tar.gz",
    ".tgz",
    ".pkl",
    ".pt",
    ".pth",
)

class PoligrasRequest(BaseModel):
    dataset: str = Field(..., description="Folder under backend/dataset")
    counts: int = 100
    group_size: int = 200
    hidden_size1: int = 64
    hidden_size2: int = 32
    lr: float = 0.001
    dropout: float = 0.0
    weight_decay: float = 0.0
    bad_counter: int = 0


app = FastAPI(title="Poligras Service", version="1.0.0")

# Enhanced CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/upload-multiple")
async def upload_multiple_files(files: list[UploadFile] = File(...)):
    try:
        dataset_id = str(uuid.uuid4())
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)

        uploaded_files = []
        for file in files:
            original_filename = file.filename
            
            # Rename files to match expected pattern
            if '_feat' in original_filename.lower():
                new_filename = f"{dataset_id}_feat"
            elif '_graph' in original_filename.lower():
                new_filename = f"{dataset_id}_graph"
            else:
                new_filename = original_filename
            
            file_path = dataset_dir / new_filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uploaded_files.append(new_filename)

        return {
            "dataset_id": dataset_id,
            "files_uploaded": len(files),
            "files": uploaded_files
        }
    except Exception as e:
        raise HTTPException(500, f"Upload error: {str(e)}")


@app.post("/poligras")
def run_poligras_endpoint(payload: PoligrasRequest):
    try:
        dataset_dir = Path(__file__).parent / "dataset" / payload.dataset
        
        if not dataset_dir.exists():
            raise HTTPException(404, f"Dataset '{payload.dataset}' not found")
        
        args = SimpleNamespace(**payload.dict())
        result = run_poligras(args)
        
        if result is None:
            raise HTTPException(500, "Analysis completed but returned no results")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Processing error: {str(e)}")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "poligras"}