from types import SimpleNamespace
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging
import json
import shutil
import uuid

from .run import run_poligras

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# In-memory cache for results
results_cache = {}

# Directory for storing temporary chunks
CHUNK_DIR = Path(__file__).parent / "chunks"
CHUNK_DIR.mkdir(parents=True, exist_ok=True)


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


# ============================================================================
# UPLOAD ENDPOINTS
# ============================================================================

@app.post("/upload-chunk")
async def upload_chunk(
    chunk: UploadFile = File(...),
    fileName: str = Form(...),
    chunkIndex: int = Form(...),
    totalChunks: int = Form(...),
    datasetId: str = Form(None)
):
    """Upload a single chunk of a large file"""
    logger.info(f"Receiving chunk {chunkIndex}/{totalChunks} for file: {fileName}")
    
    if not datasetId:
        datasetId = str(uuid.uuid4())
    
    # Create directory for this file's chunks
    file_chunk_dir = CHUNK_DIR / datasetId / fileName
    file_chunk_dir.mkdir(parents=True, exist_ok=True)
    
    # Save chunk with zero-padded index for proper sorting
    chunk_path = file_chunk_dir / f"chunk_{chunkIndex:06d}"
    
    try:
        with open(chunk_path, "wb") as f:
            content = await chunk.read()
            f.write(content)
        
        chunk_size = chunk_path.stat().st_size
        logger.debug(f"Saved chunk {chunkIndex}: {chunk_size} bytes")
        
        return {
            "status": "success",
            "chunkIndex": chunkIndex,
            "datasetId": datasetId,
            "chunkSize": chunk_size
        }
    except Exception as e:
        logger.error(f"Error saving chunk {chunkIndex}: {e}")
        raise HTTPException(500, f"Failed to save chunk: {str(e)}")


@app.post("/finalize-upload")
async def finalize_upload(data: dict):
    """Combine all chunks into final file"""
    fileName = data["fileName"]
    datasetId = data.get("datasetId")
    
    if not datasetId:
        raise HTTPException(400, "datasetId is required")
    
    logger.info(f"Finalizing upload for file: {fileName}, dataset: {datasetId}")
    
    file_chunk_dir = CHUNK_DIR / datasetId / fileName
    
    if not file_chunk_dir.exists():
        raise HTTPException(404, f"Chunks not found for file: {fileName}")
    
    # Create dataset directory
    dataset_dir = Path(__file__).parent / "dataset" / datasetId
    dataset_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine output filename based on content
    if '_feat' in fileName.lower() or 'feat' in fileName.lower():
        output_filename = f"{datasetId}_feat"
    elif '_graph' in fileName.lower() or 'graph' in fileName.lower():
        output_filename = f"{datasetId}_graph"
    else:
        output_filename = fileName
    
    final_path = dataset_dir / output_filename
    
    logger.info(f"Combining chunks into: {final_path}")
    
    try:
        # Get all chunk files and sort them
        chunk_files = sorted(file_chunk_dir.glob("chunk_*"))
        
        if not chunk_files:
            raise HTTPException(404, "No chunks found to combine")
        
        # Combine all chunks into final file
        with open(final_path, "wb") as final_file:
            for chunk_path in chunk_files:
                with open(chunk_path, "rb") as chunk_file:
                    shutil.copyfileobj(chunk_file, final_file)
        
        final_size = final_path.stat().st_size
        logger.info(f"✓ Created final file: {final_path} ({final_size / (1024**3):.2f} GB)")
        
        # Clean up chunks
        shutil.rmtree(file_chunk_dir)
        logger.info(f"✓ Cleaned up chunks for: {fileName}")
        
        # Check if chunk directory for dataset is empty and remove it
        dataset_chunk_dir = CHUNK_DIR / datasetId
        if dataset_chunk_dir.exists() and not any(dataset_chunk_dir.iterdir()):
            dataset_chunk_dir.rmdir()
            logger.info(f"✓ Removed empty chunk directory")
        
        return {
            "status": "success",
            "dataset_id": datasetId,
            "fileName": output_filename,
            "size": final_size,
            "size_mb": round(final_size / (1024**2), 2)
        }
        
    except Exception as e:
        logger.error(f"Error finalizing upload: {e}")
        raise HTTPException(500, f"Failed to finalize upload: {str(e)}")


@app.post("/upload-multiple")
async def upload_multiple_files(files: list[UploadFile] = File(...)):
    """Direct upload for small files (backward compatibility)"""
    logger.info(f"=== UPLOAD START: Received {len(files)} files ===")
    
    dataset_id = str(uuid.uuid4())
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    dataset_dir.mkdir(parents=True, exist_ok=True)

    for idx, file in enumerate(files):
        original_filename = file.filename
        
        # Rename files to match expected pattern
        if '_feat' in original_filename.lower():
            new_filename = f"{dataset_id}_feat"
        elif '_graph' in original_filename.lower():
            new_filename = f"{dataset_id}_graph"
        else:
            new_filename = original_filename
        
        file_path = dataset_dir / new_filename
        logger.debug(f"Uploading file {idx+1}/{len(files)}: {original_filename} -> {new_filename}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.debug(f"Saved: {file_path} ({file_path.stat().st_size / (1024**2):.2f} MB)")

    logger.info(f"=== UPLOAD COMPLETE: dataset_id={dataset_id} ===")
    return {"dataset_id": dataset_id, "files_uploaded": len(files)}


@app.get("/dataset/{dataset_id}/status")
async def get_dataset_status(dataset_id: str):
    """Check the status of a dataset upload"""
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    
    if not dataset_dir.exists():
        # Check if chunks exist (upload in progress)
        chunk_dir = CHUNK_DIR / dataset_id
        if chunk_dir.exists():
            return {
                "status": "uploading",
                "dataset_id": dataset_id,
                "message": "Upload in progress"
            }
        return {"status": "not_found", "dataset_id": dataset_id}
    
    files = list(dataset_dir.glob("*"))
    file_info = [
        {
            "name": f.name,
            "size": f.stat().st_size,
            "size_mb": round(f.stat().st_size / (1024**2), 2)
        }
        for f in files if f.is_file()
    ]
    
    return {
        "status": "ready",
        "dataset_id": dataset_id,
        "files": file_info,
        "total_files": len(file_info),
        "total_size_mb": sum(f["size_mb"] for f in file_info)
    }


@app.delete("/chunks/{dataset_id}")
async def cleanup_chunks(dataset_id: str):
    """Clean up chunks if upload is cancelled or failed"""
    chunk_dir = CHUNK_DIR / dataset_id
    
    if chunk_dir.exists():
        try:
            shutil.rmtree(chunk_dir)
            logger.info(f"✓ Cleaned up chunks for dataset: {dataset_id}")
            return {"status": "success", "message": "Chunks cleaned up"}
        except Exception as e:
            logger.error(f"Error cleaning up chunks: {e}")
            raise HTTPException(500, f"Failed to clean up chunks: {str(e)}")
    
    return {"status": "not_found", "message": "No chunks found"}


@app.get("/get-latest-dataset")
async def get_latest_dataset():
    """Get the most recently created dataset ID"""
    dataset_dir = Path(__file__).parent / "dataset"
    
    if not dataset_dir.exists():
        raise HTTPException(404, "No datasets found")
    
    # Get all dataset directories
    datasets = [d for d in dataset_dir.iterdir() if d.is_dir()]
    
    if not datasets:
        raise HTTPException(404, "No datasets found")
    
    # Sort by creation time and get the most recent
    latest_dataset = max(datasets, key=lambda d: d.stat().st_ctime)
    
    logger.info(f"Latest dataset: {latest_dataset.name}")
    
    return {"dataset_id": latest_dataset.name}


# ============================================================================
# PROCESSING ENDPOINTS
# ============================================================================

@app.post("/poligras")
def run_poligras_endpoint(payload: PoligrasRequest):
    """Run Poligras analysis on uploaded dataset"""
    logger.info("=" * 60)
    logger.info("=== POLIGRAS ENDPOINT CALLED ===")
    logger.info(f"Payload: {payload.dict()}")
    
    dataset_dir = Path(__file__).parent / "dataset" / payload.dataset
    
    if not dataset_dir.exists():
        logger.error(f"Dataset not found: {dataset_dir}")
        raise HTTPException(404, "Dataset not found")
    
    # Log files in dataset
    try:
        files_in_dir = list(dataset_dir.iterdir())
        logger.info(f"Files in dataset ({len(files_in_dir)}):")
        for f in files_in_dir:
            if f.is_file():
                size_mb = f.stat().st_size / (1024**2)
                logger.info(f"  - {f.name} ({size_mb:.2f} MB)")
    except Exception as e:
        logger.error(f"Error listing directory: {e}")
    
    # Create args and run processing
    args = SimpleNamespace(**payload.dict())
    logger.info("Calling run_poligras...")
    
    try:
        result = run_poligras(args)
        
        if result is None:
            logger.warning("⚠️  run_poligras returned None!")
            raise HTTPException(500, "Processing returned no results")
        
        logger.info("=== RUN_POLIGRAS COMPLETED ===")
        
        # Save full result to file
        results_file = dataset_dir / "results.json"
        with open(results_file, 'w') as f:
            json.dump(result, f, indent=2)
        logger.info(f"✓ Saved results: {results_file.stat().st_size / (1024**2):.2f} MB")
        
        # Create and cache lightweight metadata
        metadata = {
            "dataset_id": payload.dataset,
            "meta": result.get("meta", {}),
            "stats": result.get("stats", {})
        }
        
        results_cache[payload.dataset] = metadata
        
        # Save metadata separately for fast loading
        metadata_file = dataset_dir / "metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✓ Saved metadata")
        
        return metadata
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"=== ERROR IN RUN_POLIGRAS ===")
        logger.error(f"Exception: {type(e).__name__}: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(500, f"Error running poligras: {str(e)}")


# ============================================================================
# RESULTS ENDPOINTS
# ============================================================================

@app.get("/results/{dataset_id}/metadata")
def get_results_metadata(dataset_id: str):
    """Get metadata without loading full graph data"""
    logger.info(f"GET metadata for dataset: {dataset_id}")
    
    # Check cache first
    if dataset_id in results_cache:
        logger.info("✓ Found in cache")
        return results_cache[dataset_id]
    
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    metadata_file = dataset_dir / "metadata.json"
    
    # Try metadata file (fast)
    if metadata_file.exists():
        logger.info("✓ Loading from metadata file")
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        results_cache[dataset_id] = metadata
        return metadata
    
    # Fallback: extract from full results
    results_file = dataset_dir / "results.json"
    if results_file.exists():
        logger.info("⚠️  Extracting metadata from full results")
        with open(results_file, 'r') as f:
            result = json.load(f)
        
        metadata = {
            "dataset_id": dataset_id,
            "meta": result.get("meta", {}),
            "stats": result.get("stats", {})
        }
        results_cache[dataset_id] = metadata
        
        # Save for next time
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return metadata
    
    logger.error(f"✗ Results not found for: {dataset_id}")
    raise HTTPException(404, "Results not found")


@app.get("/results/{dataset_id}/graphs/initial")
def get_initial_graph(dataset_id: str, sample_size: int = 500):
    """Get the initial graph data (sampled for performance)"""
    logger.info(f"GET initial graph for: {dataset_id}, sample: {sample_size}")
    
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    results_file = dataset_dir / "results.json"
    
    if not results_file.exists():
        raise HTTPException(404, "Results not found")
    
    with open(results_file, 'r') as f:
        result = json.load(f)
    
    initial_graph = result.get("graphs", {}).get("initial", {})
    
    if not initial_graph:
        raise HTTPException(404, "Initial graph not found")
    
    # Apply sampling for large graphs
    if initial_graph.get("node_count", 0) > sample_size:
        logger.info(f"Sampling {sample_size} nodes from {initial_graph.get('node_count')} total")
        
        nodes = initial_graph.get("nodes", [])[:sample_size]
        node_ids = set(n.get("id") for n in nodes)
        
        edges = [e for e in initial_graph.get("edges", []) 
                if e.get("source") in node_ids and e.get("target") in node_ids]
        
        return {
            "directed": initial_graph.get("directed", False),
            "sampled": True,
            "original_node_count": initial_graph.get("node_count"),
            "original_edge_count": initial_graph.get("edge_count"),
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges
        }
    
    logger.info(f"Returning full graph: {len(initial_graph.get('nodes', []))} nodes")
    return initial_graph


@app.get("/results/{dataset_id}/graphs/summary")
def get_summary_graph(dataset_id: str):
    """Get the summary graph data"""
    logger.info(f"GET summary graph for: {dataset_id}")
    
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    results_file = dataset_dir / "results.json"
    
    if not results_file.exists():
        raise HTTPException(404, "Results not found")
    
    with open(results_file, 'r') as f:
        result = json.load(f)
    
    return result.get("graphs", {}).get("summary", {})


@app.get("/results/{dataset_id}")
def get_results(dataset_id: str, include_graphs: bool = False):
    """Get processing results (metadata only by default)"""
    logger.info(f"GET results for: {dataset_id}, include_graphs: {include_graphs}")
    
    if not include_graphs:
        return get_results_metadata(dataset_id)
    
    # Load full results (slow for large graphs)
    dataset_dir = Path(__file__).parent / "dataset" / dataset_id
    results_file = dataset_dir / "results.json"
    
    if not results_file.exists():
        raise HTTPException(404, "Results not found")
    
    logger.warning("⚠️  Loading full results with graphs - may be slow!")
    with open(results_file, 'r') as f:
        return json.load(f)


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cached_results": len(results_cache),
        "service": "Poligras Service",
        "chunk_storage": str(CHUNK_DIR)
    }