#!/usr/bin/env python3
"""
Export YOLOv8s Custom Model to NCNN Format
Optimized for Raspberry Pi 5 ARM64 architecture
"""

from ultralytics import YOLO
import os

def export_to_ncnn():
    """Export custom YOLO model to NCNN format"""
    
    model_path = "models/yolov8s-custom.pt"
    
    print("=" * 60)
    print("🔄 YOLOv8s Custom Model → NCNN Conversion")
    print("=" * 60)
    
    # Check if model exists
    if not os.path.exists(model_path):
        print(f"❌ Error: Model not found at {model_path}")
        return False
    
    print(f"\n📦 Loading model: {model_path}")
    try:
        model = YOLO(model_path)
        print(f"✅ Model loaded successfully")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False
    
    print(f"\n🔧 Exporting to NCNN format (416x416 input size)...")
    print("   This may take 2-3 minutes...")
    
    try:
        # Export to NCNN with 416x416 input size
        model.export(
            format='ncnn',
            imgsz=416,
            half=False,  # Use FP32 for better compatibility
            simplify=True,  # Simplify the model
        )
        print(f"✅ Export successful!")
        
        # Check output directory
        output_dir = "models/yolov8s-custom_ncnn_model"
        if os.path.exists(output_dir):
            print(f"\n📁 NCNN model saved to: {output_dir}/")
            
            # List files
            files = os.listdir(output_dir)
            print(f"   Generated files:")
            for f in files:
                size = os.path.getsize(os.path.join(output_dir, f)) / 1024
                print(f"     - {f} ({size:.1f} KB)")
        
        print("\n" + "=" * 60)
        print("✅ CONVERSION COMPLETE")
        print("=" * 60)
        print("\n💡 Next steps:")
        print("   1. Transfer files to Raspberry Pi 5")
        print("   2. Run: python stream_server_optimized.py")
        print("   3. Expected FPS: 25-30 (vs current 5-6)")
        print("\n")
        
        return True
        
    except Exception as e:
        print(f"❌ Export failed: {e}")
        print("\n💡 Troubleshooting:")
        print("   - Ensure 'ncnn' is installed: pip install ncnn")
        print("   - Check if model is compatible with NCNN export")
        return False

if __name__ == "__main__":
    success = export_to_ncnn()
    exit(0 if success else 1)
