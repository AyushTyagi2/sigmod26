import json
from types import SimpleNamespace
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
import tempfile
import csv
import networkx as nx
from pydantic import BaseModel, Field
from .node_feature_generation import feature_generator
import shutil
from fastapi import BackgroundTasks
import uuid

from .run import run_poligras
from .dynamic_updates import apply_edge_updates, parse_update_stream, UpdateStreamError

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
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)}
    )

@app.exception_handler(400)
async def bad_request_handler(request, exc):
    print(f"Bad Request: {exc}")
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )



@app.post("/upload-multiple")
async def upload_multiple_files(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...)
):
    try:
        dataset_id = str(uuid.uuid4())
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)

        uploaded_files = []
        has_graph = False
        has_feat = False

        for file in files:
            filename = file.filename.lower()

            if "_graph" in filename:
                has_graph = True
                new_filename = f"{dataset_id}_graph"
            elif "_feat" in filename:
                has_feat = True
                new_filename = f"{dataset_id}_feat"
            else:
                new_filename = file.filename

            file_path = dataset_dir / new_filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            uploaded_files.append(new_filename)

        # Run feature generation in background
        if has_graph and not has_feat:
            background_tasks.add_task(feature_generator, dataset_id)

        return {
            "dataset_id": dataset_id,
            "files_uploaded": len(files),
            "files": uploaded_files,
            "features_generation_started": has_graph and not has_feat
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
    """Always returns the ORIGINAL output.json (never dynamic updates)."""
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        output_path = dataset_dir / "output.json"

        # If output.json is missing but the uploaded graph exists, run Poligras
        # synchronously so the first visualization request can obtain the
        # generated output. This covers the common case where a user uploads
        # graph files and is immediately routed to the visualization page.
        if not output_path.exists():
            # graph file uploaded by `upload_multiple_files` is saved as
            # `{dataset_id}_graph` (pickle). If it's present, we can run Poligras.
            graph_path = dataset_dir / f"{dataset_id}_graph"
            feat_path = dataset_dir / f"{dataset_id}_feat"

            if graph_path.exists():
                # Build default args (matches defaults in run.parse_args)
                args = SimpleNamespace(
                    dataset=dataset_id,
                    counts=100,
                    group_size=200,
                    hidden_size1=64,
                    hidden_size2=32,
                    lr=0.001,
                    dropout=0.0,
                    weight_decay=0.0,
                    bad_counter=0,
                )

                # Run Poligras synchronously and write output.json
                result = run_poligras(args)
                if result is None:
                    raise HTTPException(500, "Poligras completed but returned no output")

                # After run_poligras, output.json should exist; fall through to read it
            else:
                raise HTTPException(404, "Output not found for this dataset")

        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error reading output: {str(e)}")


@app.post("/datasets/{dataset_id}/apply-updates")
async def apply_updates_to_summary(dataset_id: str, updates_file: UploadFile = File(...)):
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        output_path = dataset_dir / "output.json"

        # If the exact dataset folder doesn't contain output.json, try to
        # locate an output.json whose internal meta.dataset matches the
        # requested dataset_id. This covers cases where the frontend stores
        # a different identifier than the folder name (e.g. original meta id).
        if not output_path.exists():
            datasets_root = Path(__file__).parent / "dataset"
            found = None
            if datasets_root.exists():
                for child in datasets_root.iterdir():
                    candidate = child / "output.json"
                    if candidate.exists():
                        try:
                            with candidate.open("r", encoding="utf-8") as f:
                                jd = json.load(f)
                            meta_id = jd.get("meta", {}).get("dataset")
                            if meta_id == dataset_id:
                                found = candidate
                                break
                        except Exception:
                            continue

            if found:
                output_path = found
            else:
                raise HTTPException(404, "Output not found for this dataset")

        with output_path.open("r", encoding="utf-8") as f:
            summary_payload = json.load(f)

        update_bytes = await updates_file.read()
        try:
            update_records = parse_update_stream(update_bytes)
        except UpdateStreamError as exc:
            raise HTTPException(400, f"Invalid update stream file: {exc}") from exc

        updated_summary = apply_edge_updates(summary_payload, update_records)

        updated_output_path = dataset_dir / "output_dynamic.json"
        with updated_output_path.open("w", encoding="utf-8") as f:
            json.dump(updated_summary, f, indent=2)

        # Also persist the updated summary at the workspace root for quick inspection/debugging
        project_root = Path(__file__).resolve().parent.parent
        root_summary_path = project_root / f"{dataset_id}_output_dynamic.json"
        with root_summary_path.open("w", encoding="utf-8") as f:
            json.dump(updated_summary, f, indent=2)

        return updated_summary
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to apply updates: {str(e)}")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "poligras"}


@app.get("/datasets/{dataset_id}/download-graph")
def download_initial_graph_gpickle(dataset_id: str):
    """Download the initial graph as a Poligras-compatible gpickle file.
    
    Returns a pickle file containing {'G': NetworkX graph} which can be
    directly used as input for Poligras.
    """
    try:
        import io
        import pickle as pkl
        
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        output_path = dataset_dir / "output.json"
        
        # Fallback: search for output.json by meta.dataset
        if not output_path.exists():
            datasets_root = Path(__file__).parent / "dataset"
            found = None
            if datasets_root.exists():
                for child in datasets_root.iterdir():
                    candidate = child / "output.json"
                    if candidate.exists():
                        try:
                            with candidate.open("r", encoding="utf-8") as f:
                                jd = json.load(f)
                            meta_id = jd.get("meta", {}).get("dataset")
                            if meta_id == dataset_id:
                                found = candidate
                                break
                        except Exception:
                            continue

            if found:
                output_path = found
            else:
                raise HTTPException(404, "Output not found for this dataset")
        
        with output_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Extract initial graph from output.json
        initial = data.get("graphs", {}).get("initial", {}) or {}
        
        if not initial:
            raise HTTPException(400, "No initial graph found in output.json")
        
        directed = bool(initial.get("directed", False))
        G = nx.DiGraph() if directed else nx.Graph()
        
        # Add nodes with their attributes
        for node in initial.get("nodes", []) or []:
            nid = node.get("id")
            attrs: dict = {}
            if "degree" in node:
                attrs["degree"] = node.get("degree")
            if "label" in node:
                attrs["label"] = node.get("label")
            G.add_node(nid, **attrs)
        
        # Add edges with their attributes
        for edge in initial.get("edges", []) or []:
            src = edge.get("source")
            tgt = edge.get("target")
            edge_attrs: dict = {}
            if "weight" in edge:
                edge_attrs["weight"] = edge.get("weight")
            G.add_edge(src, tgt, **edge_attrs)
        
        # Create pickle with {'G': graph} structure (Poligras input format)
        graph_payload = {'G': G}
        
        buf = io.BytesIO()
        pkl.dump(graph_payload, buf)
        buf.seek(0)
        
        return StreamingResponse(
            buf,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=\"{dataset_id}_graph.gpickle\""},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error preparing graph download: {str(e)}")


@app.get("/datasets/{dataset_id}/download-summary")
def download_summary_pickle(dataset_id: str):
    """Return the pickled summary file written by Poligras (binary).

    The file is created in `backend/dataset/{dataset_id}/{dataset_id}_graph_summary`.
    """
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        summary_path = dataset_dir / f"{dataset_id}_graph_summary"

        # If a precomputed binary summary exists, return it directly.
        if summary_path.exists():
            return FileResponse(
                path=summary_path,
                media_type="application/octet-stream",
                filename=f"{dataset_id}_graph_summary.gpickle",
            )

        # Otherwise, synthesize a true NetworkX gpickle from output.json
        output_path = dataset_dir / "output.json"
        if not output_path.exists():
            raise HTTPException(404, "Summary pickle not found and output.json not available for this dataset")

        with output_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        summary = data.get("graphs", {}).get("summary", {}) or {}
        artifacts = data.get("artifacts", {}) or {}

        directed = bool(summary.get("directed", False))
        G = nx.DiGraph() if directed else nx.Graph()

        # Add summary nodes (supernodes) with attributes (size and members if available)
        members_map = (artifacts.get("supernodes", {}) or {}).get("members", {})
        for node in summary.get("nodes", []) or []:
            nid = node.get("id")
            attrs: dict = {}
            if "size" in node:
                attrs["size"] = node.get("size")
            # include members list when available
            if members_map and nid in members_map:
                attrs["members"] = members_map.get(nid)
            G.add_node(nid, **attrs)

        # Add summary edges with attributes
        for edge in summary.get("edges", []) or []:
            src = edge.get("source")
            tgt = edge.get("target")
            edge_attrs: dict = {}
            if "weight" in edge:
                edge_attrs["weight"] = edge.get("weight")
            if "density" in edge:
                edge_attrs["density"] = edge.get("density")
            G.add_edge(src, tgt, **edge_attrs)

        # Optionally attach correction counts as graph-level attributes
        corrections = artifacts.get("corrections", {}) or {}
        G.graph["correction_positive_count"] = len(corrections.get("positive", []))
        G.graph["correction_negative_count"] = len(corrections.get("negative", []))

        import io
        import pickle as pkl

        buf = io.BytesIO()
        # Use Poligras input format: {'G': graph}
        pkl.dump({'G': G}, buf)
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=\"{dataset_id}_graph_summary.gpickle\""},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error preparing summary download: {str(e)}")


@app.get("/datasets/{dataset_id}/download-corrections")
def download_corrections_csv(dataset_id: str):
    """Return a CSV containing the correction edges (positive/negative) from output.json

    CSV columns: type,source,target  where type is 'positive' or 'negative'.
    """
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        output_path = dataset_dir / "output.json"

        # If output.json not found in the expected folder, try to locate an
        # output.json whose internal `meta.dataset` matches the requested id.
        if not output_path.exists():
            datasets_root = Path(__file__).parent / "dataset"
            found = None
            if datasets_root.exists():
                for child in datasets_root.iterdir():
                    candidate = child / "output.json"
                    if candidate.exists():
                        try:
                            with candidate.open("r", encoding="utf-8") as f:
                                jd = json.load(f)
                            meta_id = jd.get("meta", {}).get("dataset")
                            if meta_id == dataset_id:
                                found = candidate
                                break
                        except Exception:
                            continue

            if found:
                output_path = found
            else:
                raise HTTPException(404, "Output not found for this dataset")

        with output_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        # Support older exports where corrections live at top-level or under artifacts
        corrections = data.get("artifacts", {}).get("corrections") or data.get("corrections") or {}
        positive = corrections.get("positive", [])
        negative = corrections.get("negative", [])

        import io

        # Build CSV in-memory as text, then encode to bytes for robust streaming
        text_buf = io.StringIO()
        writer = csv.writer(text_buf)
        writer.writerow(["type", "source", "target"])

        # Each correction entry may be a dict or list depending on export
        def normalize_pair(p):
            if isinstance(p, dict):
                return p.get("source"), p.get("target")
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                return p[0], p[1]
            return None, None

        for entry in positive:
            s, t = normalize_pair(entry)
            if s is not None:
                writer.writerow(["positive", s, t])

        for entry in negative:
            s, t = normalize_pair(entry)
            if s is not None:
                writer.writerow(["negative", s, t])

        csv_bytes = text_buf.getvalue().encode("utf-8")
        byte_buf = io.BytesIO(csv_bytes)
        byte_buf.seek(0)

        return StreamingResponse(
            byte_buf,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=\"{dataset_id}_corrections.csv\""},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error preparing corrections CSV: {str(e)}")


@app.get("/datasets/{dataset_id}/download-updated-summary")
def download_updated_summary_pickle(dataset_id: str):
    """Return a pickled NetworkX graph synthesized from `output_dynamic.json`.

    Falls back to `output.json` if `output_dynamic.json` doesn't exist.
    """
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        dynamic_path = dataset_dir / "output_dynamic.json"

        # Prefer the dynamic updated output; fall back to original output.json
        if dynamic_path.exists():
            source_path = dynamic_path
        else:
            source_path = dataset_dir / "output.json"

        # If neither exist, try the meta.dataset fallback search
        if not source_path.exists():
            datasets_root = Path(__file__).parent / "dataset"
            found = None
            if datasets_root.exists():
                for child in datasets_root.iterdir():
                    candidate = child / ("output_dynamic.json" if (child / "output_dynamic.json").exists() else "output.json")
                    if candidate.exists():
                        try:
                            with candidate.open("r", encoding="utf-8") as f:
                                jd = json.load(f)
                            meta_id = jd.get("meta", {}).get("dataset")
                            if meta_id == dataset_id:
                                found = candidate
                                break
                        except Exception:
                            continue

            if found:
                source_path = found
            else:
                raise HTTPException(404, "Updated summary not found for this dataset")

        with source_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        summary = data.get("graphs", {}).get("summary", {}) or {}
        artifacts = data.get("artifacts", {}) or {}

        directed = bool(summary.get("directed", False))
        G = nx.DiGraph() if directed else nx.Graph()

        members_map = (artifacts.get("supernodes", {}) or {}).get("members", {})
        for node in summary.get("nodes", []) or []:
            nid = node.get("id")
            attrs: dict = {}
            if "size" in node:
                attrs["size"] = node.get("size")
            if members_map and nid in members_map:
                attrs["members"] = members_map.get(nid)
            G.add_node(nid, **attrs)

        for edge in summary.get("edges", []) or []:
            src = edge.get("source")
            tgt = edge.get("target")
            edge_attrs: dict = {}
            if "weight" in edge:
                edge_attrs["weight"] = edge.get("weight")
            if "density" in edge:
                edge_attrs["density"] = edge.get("density")
            G.add_edge(src, tgt, **edge_attrs)

        corrections = artifacts.get("corrections", {}) or {}
        G.graph["correction_positive_count"] = len(corrections.get("positive", []))
        G.graph["correction_negative_count"] = len(corrections.get("negative", []))

        import io
        import pickle as pkl

        buf = io.BytesIO()
        # Use Poligras input format: {'G': graph}
        pkl.dump({'G': G}, buf)
        buf.seek(0)

        filename = f"{dataset_id}_graph_summary_dynamic.gpickle"
        return StreamingResponse(
            buf,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error preparing updated summary download: {str(e)}")


@app.get("/datasets/{dataset_id}/download-updated-corrections")
def download_updated_corrections_csv(dataset_id: str):
    """Return the corrections CSV from `output_dynamic.json` (or fallback to `output.json`)."""
    try:
        dataset_dir = Path(__file__).parent / "dataset" / dataset_id
        dynamic_path = dataset_dir / "output_dynamic.json"

        if dynamic_path.exists():
            source_path = dynamic_path
        else:
            source_path = dataset_dir / "output.json"

        # Fallback search by meta.dataset if necessary
        if not source_path.exists():
            datasets_root = Path(__file__).parent / "dataset"
            found = None
            if datasets_root.exists():
                for child in datasets_root.iterdir():
                    candidate = child / ("output_dynamic.json" if (child / "output_dynamic.json").exists() else "output.json")
                    if candidate.exists():
                        try:
                            with candidate.open("r", encoding="utf-8") as f:
                                jd = json.load(f)
                            meta_id = jd.get("meta", {}).get("dataset")
                            if meta_id == dataset_id:
                                found = candidate
                                break
                        except Exception:
                            continue

            if found:
                source_path = found
            else:
                raise HTTPException(404, "Corrections not found for this dataset")

        with source_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        corrections = data.get("artifacts", {}).get("corrections") or data.get("corrections") or {}
        positive = corrections.get("positive", [])
        negative = corrections.get("negative", [])

        import io

        text_buf = io.StringIO()
        writer = csv.writer(text_buf)
        writer.writerow(["type", "source", "target"])

        def normalize_pair(p):
            if isinstance(p, dict):
                return p.get("source"), p.get("target")
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                return p[0], p[1]
            return None, None

        for entry in positive:
            s, t = normalize_pair(entry)
            if s is not None:
                writer.writerow(["positive", s, t])

        for entry in negative:
            s, t = normalize_pair(entry)
            if s is not None:
                writer.writerow(["negative", s, t])

        csv_bytes = text_buf.getvalue().encode("utf-8")
        byte_buf = io.BytesIO(csv_bytes)
        byte_buf.seek(0)

        filename = f"{dataset_id}_corrections_dynamic.csv"
        return StreamingResponse(
            byte_buf,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error preparing updated corrections CSV: {str(e)}")