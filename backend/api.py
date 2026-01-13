from types import SimpleNamespace
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shutil
import uuid

from .run import run_poligras

# Increase multipart limits for large folder uploads
try:
    import python_multipart
    python_multipart.multipart.MAX_MULTIPART_COUNT = 65536  # Allow 64k files/fields
    python_multipart.multipart.MAX_MULTIPART_HEADER_SIZE = 1024 * 1024  # 1MB headers
except ImportError:
    pass


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

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation error: {exc}")
    return await request.app.default_exception_handler(request, exc)

@app.exception_handler(400)
async def bad_request_handler(request, exc):
    print(f"Bad Request: {exc}")
    # Return the original response
    return await request.app.default_exception_handler(request, exc)



@app.post("/upload-multiple")
async def upload_multiple_files(files: list[UploadFile] = File(...)):
    try:
        dataset_id = str(uuid.uuid4())
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)

        uploaded_files = []
        print(f"Received {len(files)} files")
        for file in files:
            original_filename = file.filename
            print(f"Processing file: {original_filename}")
            
            # Rename files to match expected pattern
            filename_lower = original_filename.lower()
            if any(x in filename_lower for x in ['_feat', 'features', 'feature', 'feats']):
                new_filename = f"{dataset_id}_feat"
            elif any(x in filename_lower for x in ['_graph', 'graph', 'adj', 'structure', 'adjacency']):
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


@app.post("/upload-json")
async def upload_json(file: UploadFile = File(...)):
    try:
        dataset_id = str(uuid.uuid4())
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = dataset_dir / "output.json"
        
        # Stream copy directly to file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"dataset_id": dataset_id, "message": "JSON uploaded successfully"}
    except Exception as e:
        raise HTTPException(500, f"Upload error: {str(e)}")


@app.get("/datasets/{dataset_id}/output")
async def get_dataset_output(dataset_id: str):
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        output_path = dataset_dir / "output.json"
        
        if not output_path.exists():
            raise HTTPException(404, "Output not found for this dataset")
            
        import json
        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error reading output: {str(e)}")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "poligras"}