"""
Download and integrate additional snake datasets from Roboflow
"""
import os
import shutil
from pathlib import Path

print("=" * 70)
print("📥 DOWNLOADING ADDITIONAL SNAKE DATASETS")
print("=" * 70)

# You'll need to get API keys from each Roboflow dataset
# Go to each URL, click "Download", select "YOLOv8", and copy the code snippet

datasets = [
    {
        'name': 'Snake-Detection-1',
        'url': 'https://universe.roboflow.com/amir-pdcee/snake-detection-gat5j',
        'folder': 'Snake-Detection-1'
    },
    {
        'name': 'Snake-Detect-2', 
        'url': 'https://universe.roboflow.com/final-boss/snake-detect-slnkl',
        'folder': 'Snake-Detect-2'
    },
    {
        'name': 'Snake-Classifier-3',
        'url': 'https://universe.roboflow.com/4ce-q5znk/snake-classifier',
        'folder': 'Snake-Classifier-3'
    }
]

print("\n📋 INSTRUCTIONS:")
print("=" * 70)
print("\nFor each dataset, you need to:")
print("1. Visit the URL in your browser")
print("2. Click 'Download' button")
print("3. Select 'YOLOv8' format")
print("4. Choose 'show download code'")
print("5. Copy the download code snippet")
print("\nThen paste each code block below:\n")

for i, dataset in enumerate(datasets, 1):
    print(f"\n{i}. {dataset['name']}")
    print(f"   URL: {dataset['url']}")
    print(f"   Download format: YOLOv8")
    print("-" * 70)

print("\n" + "=" * 70)
print("MANUAL DOWNLOAD ALTERNATIVE:")
print("=" * 70)
print("""
If you prefer to download manually:

1. Go to each URL above
2. Click 'Download Dataset'
3. Select format: YOLOv8
4. Download the ZIP file
5. Extract to: yolo object detection/[folder-name]
6. Run the merge script after all are downloaded

Folders should be:
- Snake-Detection-1/
- Snake-Detect-2/
- Snake-Classifier-3/
""")

print("\n✅ After downloading, run: python merge_snake_datasets.py")
