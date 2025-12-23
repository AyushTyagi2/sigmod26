from types import SimpleNamespace
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging

from .run import run_poligras

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import UploadFile, File
import shutil, uuid, zipfile, tarfile

@app.post("/upload-multiple")
async def upload_multiple_files(files: list[UploadFile] = File(...)):
    logger.info(f"=== UPLOAD START: Received {len(files)} files ===")
    
    dataset_id = str(uuid.uuid4())
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    dataset_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Created dataset directory: {dataset_dir}")

    for idx, file in enumerate(files):
        original_filename = file.filename
        
        # Rename files to match expected pattern: {dataset_id}_feat and {dataset_id}_graph
        if '_feat' in original_filename.lower():
            new_filename = f"{dataset_id}_feat"
            logger.info(f"Renaming {original_filename} -> {new_filename}")
        elif '_graph' in original_filename.lower():
            new_filename = f"{dataset_id}_graph"
            logger.info(f"Renaming {original_filename} -> {new_filename}")
        else:
            new_filename = original_filename
            logger.info(f"Keeping original filename: {original_filename}")
        
        file_path = dataset_dir / new_filename
        logger.debug(f"Uploading file {idx+1}/{len(files)}: {original_filename} -> {new_filename} ({file.content_type})")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.debug(f"Saved: {file_path} (size: {file_path.stat().st_size} bytes)")

    logger.info(f"=== UPLOAD COMPLETE: dataset_id={dataset_id} ===")
    return {"dataset_id": dataset_id, "files_uploaded": len(files)}


@app.post("/poligras")
def run_poligras_endpoint(payload: PoligrasRequest):
    logger.info("=" * 60)
    logger.info("=== POLIGRAS ENDPOINT CALLED ===")
    logger.info(f"Payload received: {payload.dict()}")
    
    dataset_dir = Path(__file__).parent / "dataset" / payload.dataset
    logger.info(f"Dataset directory path: {dataset_dir}")
    logger.info(f"Dataset directory exists: {dataset_dir.exists()}")
    
    if not dataset_dir.exists():
        logger.error(f"Dataset not found: {dataset_dir}")
        raise HTTPException(404, "Dataset not found")
    
    # List files in dataset directory
    try:
        files_in_dir = list(dataset_dir.iterdir())
        logger.info(f"Files in dataset directory ({len(files_in_dir)}):")
        for f in files_in_dir:
            logger.info(f"  - {f.name} ({'dir' if f.is_dir() else 'file'})")
    except Exception as e:
        logger.error(f"Error listing directory contents: {e}")
    
    # Create args namespace
    args = SimpleNamespace(**payload.dict())
    logger.info(f"Created args namespace: {vars(args)}")
    
    # Call run_poligras
    logger.info("Calling run_poligras function...")
    try:
        result = run_poligras(args)
        
        logger.info("=" * 60)
        logger.info("=== RUN_POLIGRAS COMPLETED ===")
        logger.info(f"Result type: {type(result)}")
        logger.info(f"Result value: {result}")
        logger.info("=" * 60)
        
        if result is None:
            logger.warning("⚠️  run_poligras returned None!")
        
        return result
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error("=== ERROR IN RUN_POLIGRAS ===")
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Exception message: {str(e)}")
        logger.exception("Full traceback:")
        logger.error("=" * 60)
        raise HTTPException(500, f"Error running poligras: {str(e)}")