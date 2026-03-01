"""
AI Inference & Control Backend for IoT Monitoring System
=========================================================

Architecture:
- Process A: RTSP Consumer + YOLOv8n NCNN Inference (10 FPS)
- Process B: FastAPI Server with WebSocket alerts + IoT control endpoints

Author: Senior Backend Engineer
Python: 3.11+
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from multiprocessing import Manager, Process
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# NCNN for optimized inference
try:
    import ncnn
except ImportError:
    print("Warning: ncnn-python not installed. Install with: pip install ncnn")
    ncnn = None

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS (Type-Safe API Schemas)
# ============================================================================

class DetectionPayload(BaseModel):
    """AI detection result payload"""
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    class_name: str = Field(..., description="Detected object class")
    class_id: int = Field(..., description="YOLO class ID")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bbox: Dict[str, float] = Field(..., description="Bounding box coordinates (x, y, width, height)")
    frame_width: int = Field(..., description="Original frame width")
    frame_height: int = Field(..., description="Original frame height")


class IoTControlRequest(BaseModel):
    """Generic IoT device control request"""
    device_id: str = Field(..., description="Device identifier")
    action: str = Field(..., description="Action to perform")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="Additional parameters")


class IoTControlResponse(BaseModel):
    """IoT control operation response"""
    success: bool
    message: str
    device_id: str
    timestamp: str


# ============================================================================
# YOLO NCNN INFERENCE ENGINE
# ============================================================================

class YOLOv8NCNN:
    """YOLOv8n NCNN optimized inference engine"""
    
    # COCO dataset classes (adjust for your trained model)
    COCO_CLASSES = [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
        'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
        'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
        'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
        'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
        'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
        'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
        'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
        'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
        'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ]
    
    # Define predator classes (customize based on your use case)
    PREDATOR_CLASSES = {'cat', 'dog', 'bear', 'bird'}  # Example predators
    
    def __init__(
        self,
        model_param: str = "yolov8n_ncnn_model/model.param",
        model_bin: str = "yolov8n_ncnn_model/model.bin",
        input_size: int = 640,
        conf_threshold: float = 0.5,
        nms_threshold: float = 0.45
    ):
        """Initialize NCNN model"""
        if ncnn is None:
            raise RuntimeError("NCNN not available. Install with: pip install ncnn")
        
        self.input_size = input_size
        self.conf_threshold = conf_threshold
        self.nms_threshold = nms_threshold
        
        # Initialize NCNN network
        self.net = ncnn.Net()
        self.net.opt.use_vulkan_compute = True  # GPU acceleration if available
        self.net.opt.num_threads = 4  # CPU threads
        
        # Load model
        self.net.load_param(model_param)
        self.net.load_model(model_bin)
        
        logger.info(f"YOLOv8 NCNN model loaded: {model_param}")
    
    def preprocess(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for YOLO inference"""
        # Resize to input size
        img = cv2.resize(image, (self.input_size, self.input_size))
        
        # Convert BGR to RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Normalize to [0, 1]
        img = img.astype(np.float32) / 255.0
        
        return img
    
    def postprocess(
        self,
        outputs: np.ndarray,
        orig_width: int,
        orig_height: int
    ) -> List[Dict[str, Any]]:
        """Post-process YOLO outputs and filter for predators"""
        detections = []
        
        # Parse YOLO output format
        # Output shape: [1, 84, 8400] for YOLOv8
        # First 4 values: bbox (x, y, w, h)
        # Remaining 80 values: class confidences
        
        if outputs is None or len(outputs) == 0:
            return detections
        
        # Implement NMS and confidence filtering
        # (Simplified - adjust based on your NCNN output format)
        
        for detection in outputs:
            # Extract bbox and class scores
            x, y, w, h = detection[:4]
            class_scores = detection[4:]
            
            # Get best class
            class_id = int(np.argmax(class_scores))
            confidence = float(class_scores[class_id])
            
            if confidence < self.conf_threshold:
                continue
            
            # Check if it's a predator class
            class_name = self.COCO_CLASSES[class_id] if class_id < len(self.COCO_CLASSES) else "unknown"
            
            if class_name not in self.PREDATOR_CLASSES:
                continue
            
            # Scale bbox to original image size
            scale_x = orig_width / self.input_size
            scale_y = orig_height / self.input_size
            
            bbox = {
                "x": float(x * scale_x),
                "y": float(y * scale_y),
                "width": float(w * scale_x),
                "height": float(h * scale_y)
            }
            
            detections.append({
                "class_name": class_name,
                "class_id": class_id,
                "confidence": confidence,
                "bbox": bbox
            })
        
        return detections
    
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Run inference on a single frame"""
        orig_height, orig_width = frame.shape[:2]
        
        # Preprocess
        img = self.preprocess(frame)
        
        # Create NCNN Mat
        mat_in = ncnn.Mat.from_pixels(
            img,
            ncnn.Mat.PixelType.PIXEL_RGB,
            self.input_size,
            self.input_size
        )
        
        # Normalize
        mean_vals = [0.0, 0.0, 0.0]
        norm_vals = [1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0]
        mat_in.substract_mean_normalize(mean_vals, norm_vals)
        
        # Run inference
        ex = self.net.create_extractor()
        ex.input("in0", mat_in)  # Adjust input name based on your model
        
        ret, mat_out = ex.extract("out0")  # Adjust output name
        
        if ret != 0:
            logger.error("NCNN inference failed")
            return []
        
        # Convert to numpy
        outputs = np.array(mat_out)
        
        # Post-process
        detections = self.postprocess(outputs, orig_width, orig_height)
        
        return detections


# ============================================================================
# PROCESS A: RTSP CONSUMER + AI INFERENCE
# ============================================================================

def inference_process(shared_dict: Dict[str, Any], config: Dict[str, Any]) -> None:
    """
    Background process for AI inference
    
    Args:
        shared_dict: Multiprocessing shared dictionary for inter-process communication
        config: Configuration dictionary
    """
    logger.info("Starting AI inference process...")
    
    rtsp_url = config.get("rtsp_url", "rtsp://localhost:8554/cam")
    target_fps = config.get("target_fps", 10)
    frame_interval = 1.0 / target_fps
    
    # Initialize YOLO model
    try:
        yolo = YOLOv8NCNN(
            model_param=config.get("model_param", "yolov8n_ncnn_model/model.param"),
            model_bin=config.get("model_bin", "yolov8n_ncnn_model/model.bin"),
            conf_threshold=config.get("conf_threshold", 0.5)
        )
    except Exception as e:
        logger.error(f"Failed to initialize YOLO model: {e}")
        return
    
    # Connect to RTSP stream
    cap = cv2.VideoCapture(rtsp_url)
    
    if not cap.isOpened():
        logger.error(f"Failed to open RTSP stream: {rtsp_url}")
        return
    
    logger.info(f"Connected to RTSP stream: {rtsp_url}")
    logger.info(f"Processing at {target_fps} FPS")
    
    last_process_time = time.time()
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            
            if not ret:
                logger.warning("Failed to read frame, reconnecting...")
                cap.release()
                time.sleep(2)
                cap = cv2.VideoCapture(rtsp_url)
                continue
            
            frame_count += 1
            current_time = time.time()
            
            # Throttle to target FPS
            if current_time - last_process_time < frame_interval:
                continue
            
            last_process_time = current_time
            
            # Run inference
            try:
                detections = yolo.detect(frame)
                
                if detections:
                    # Update shared memory with latest detection
                    for detection in detections:
                        payload = {
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "class_name": detection["class_name"],
                            "class_id": detection["class_id"],
                            "confidence": detection["confidence"],
                            "bbox": detection["bbox"],
                            "frame_width": frame.shape[1],
                            "frame_height": frame.shape[0]
                        }
                        
                        # Store in shared dict with unique key
                        shared_dict[f"detection_{current_time}"] = json.dumps(payload)
                        
                        logger.info(
                            f"Predator detected: {detection['class_name']} "
                            f"(confidence: {detection['confidence']:.2f})"
                        )
                
            except Exception as e:
                logger.error(f"Inference error: {e}")
            
            # Clean up old detections (keep last 100)
            if len(shared_dict) > 100:
                oldest_keys = sorted(shared_dict.keys())[:50]
                for key in oldest_keys:
                    if key.startswith("detection_"):
                        del shared_dict[key]
    
    except KeyboardInterrupt:
        logger.info("Inference process stopped by user")
    finally:
        cap.release()
        logger.info("Inference process terminated")


# ============================================================================
# PROCESS B: FASTAPI SERVER
# ============================================================================

class AIBackendServer:
    """FastAPI server for WebSocket alerts and IoT control"""
    
    def __init__(self, shared_dict: Dict[str, Any]):
        self.shared_dict = shared_dict
        self.app = FastAPI(
            title="IoT AI Monitoring Backend",
            description="WebRTC AI Inference & Control API",
            version="1.0.0"
        )
        
        # CORS middleware for mobile clients
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure for production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Active WebSocket connections
        self.active_connections: List[WebSocket] = []
        
        # Register routes
        self._register_routes()
    
    def _register_routes(self) -> None:
        """Register all API routes"""
        
        @self.app.get("/", response_class=JSONResponse)
        async def root() -> Dict[str, str]:
            """Health check endpoint"""
            return {
                "status": "online",
                "service": "IoT AI Monitoring Backend",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        
        @self.app.get("/api/health", response_class=JSONResponse)
        async def health_check() -> Dict[str, Any]:
            """Detailed health check"""
            return {
                "status": "healthy",
                "active_websockets": len(self.active_connections),
                "total_detections": len([k for k in self.shared_dict.keys() if k.startswith("detection_")]),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        
        @self.app.websocket("/ws/alerts")
        async def websocket_alerts(websocket: WebSocket) -> None:
            """
            WebSocket endpoint for real-time AI detection alerts
            
            Client receives JSON payloads when predators are detected
            """
            await websocket.accept()
            self.active_connections.append(websocket)
            logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")
            
            try:
                # Track sent detections to avoid duplicates
                sent_detections = set()
                
                while True:
                    # Check for new detections in shared memory
                    current_detections = {
                        k: v for k, v in self.shared_dict.items()
                        if k.startswith("detection_")
                    }
                    
                    for key, payload_json in current_detections.items():
                        if key not in sent_detections:
                            try:
                                # Send detection to client
                                await websocket.send_text(payload_json)
                                sent_detections.add(key)
                                logger.debug(f"Sent detection to WebSocket client: {key}")
                            except Exception as e:
                                logger.error(f"Failed to send WebSocket message: {e}")
                                break
                    
                    # Clean up old sent detection tracking (keep last 100)
                    if len(sent_detections) > 100:
                        sorted_keys = sorted(sent_detections)
                        sent_detections = set(sorted_keys[-100:])
                    
                    # Small delay to prevent busy loop
                    await asyncio.sleep(0.1)
                    
            except WebSocketDisconnect:
                logger.info("WebSocket client disconnected")
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
            finally:
                if websocket in self.active_connections:
                    self.active_connections.remove(websocket)
        
        @self.app.post("/api/heater/on", response_model=IoTControlResponse)
        async def heater_on(request: IoTControlRequest) -> IoTControlResponse:
            """Turn heater ON"""
            try:
                # Implement your IoT control logic here
                # Example: GPIO control, MQTT publish, HTTP request to ESP32, etc.
                logger.info(f"Heater ON request: {request.device_id}")
                
                # Simulate control operation
                await asyncio.sleep(0.1)
                
                return IoTControlResponse(
                    success=True,
                    message="Heater turned ON successfully",
                    device_id=request.device_id,
                    timestamp=datetime.utcnow().isoformat() + "Z"
                )
            except Exception as e:
                logger.error(f"Heater control error: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/heater/off", response_model=IoTControlResponse)
        async def heater_off(request: IoTControlRequest) -> IoTControlResponse:
            """Turn heater OFF"""
            try:
                logger.info(f"Heater OFF request: {request.device_id}")
                await asyncio.sleep(0.1)
                
                return IoTControlResponse(
                    success=True,
                    message="Heater turned OFF successfully",
                    device_id=request.device_id,
                    timestamp=datetime.utcnow().isoformat() + "Z"
                )
            except Exception as e:
                logger.error(f"Heater control error: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/pump/activate", response_model=IoTControlResponse)
        async def pump_activate(request: IoTControlRequest) -> IoTControlResponse:
            """Activate water pump"""
            try:
                duration = request.parameters.get("duration", 5) if request.parameters else 5
                logger.info(f"Pump activation request: {request.device_id} for {duration}s")
                
                return IoTControlResponse(
                    success=True,
                    message=f"Water pump activated for {duration} seconds",
                    device_id=request.device_id,
                    timestamp=datetime.utcnow().isoformat() + "Z"
                )
            except Exception as e:
                logger.error(f"Pump control error: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/servo/position", response_model=IoTControlResponse)
        async def servo_position(request: IoTControlRequest) -> IoTControlResponse:
            """Set servo motor position"""
            try:
                angle = request.parameters.get("angle", 90) if request.parameters else 90
                logger.info(f"Servo position request: {request.device_id} to {angle}°")
                
                if not 0 <= angle <= 180:
                    raise HTTPException(status_code=400, detail="Angle must be between 0 and 180")
                
                return IoTControlResponse(
                    success=True,
                    message=f"Servo positioned to {angle}°",
                    device_id=request.device_id,
                    timestamp=datetime.utcnow().isoformat() + "Z"
                )
            except Exception as e:
                logger.error(f"Servo control error: {e}")
                raise HTTPException(status_code=500, detail=str(e))
    
    def run(self, host: str = "0.0.0.0", port: int = 8000) -> None:
        """Run FastAPI server"""
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="info",
            access_log=True
        )


# ============================================================================
# MAIN ORCHESTRATOR
# ============================================================================

def main() -> None:
    """Main entry point - orchestrates both processes"""
    
    logger.info("=" * 70)
    logger.info("IoT AI Monitoring Backend - Starting")
    logger.info("=" * 70)
    
    # Configuration
    config = {
        "rtsp_url": "rtsp://localhost:8554/cam",
        "target_fps": 10,
        "model_param": "yolov8n_ncnn_model/model.param",
        "model_bin": "yolov8n_ncnn_model/model.bin",
        "conf_threshold": 0.5,
        "api_host": "0.0.0.0",
        "api_port": 8000
    }
    
    # Create shared memory for inter-process communication
    with Manager() as manager:
        shared_dict = manager.dict()
        
        # Start Process A: AI Inference
        inference_proc = Process(
            target=inference_process,
            args=(shared_dict, config),
            name="InferenceProcess"
        )
        inference_proc.start()
        logger.info(f"Process A started: AI Inference (PID: {inference_proc.pid})")
        
        # Small delay to ensure inference process initializes
        time.sleep(2)
        
        # Start Process B: FastAPI Server (runs in main process)
        try:
            logger.info("Process B starting: FastAPI Server")
            server = AIBackendServer(shared_dict)
            server.run(host=config["api_host"], port=config["api_port"])
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            # Cleanup
            inference_proc.terminate()
            inference_proc.join(timeout=5)
            if inference_proc.is_alive():
                inference_proc.kill()
            logger.info("All processes terminated")


if __name__ == "__main__":
    main()
