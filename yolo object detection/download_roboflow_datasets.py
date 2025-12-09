"""
Download snake datasets from Roboflow using API
"""
import os
from roboflow import Roboflow

if __name__ == '__main__':
    print("=" * 70)
    print("📥 DOWNLOADING SNAKE DATASETS FROM ROBOFLOW")
    print("=" * 70)
    
    # You need a Roboflow API key
    # Get it from: https://app.roboflow.com/settings/api
    
    api_key = input("\n🔑 Enter your Roboflow API key: ").strip()
    
    if not api_key:
        print("\n❌ API key is required!")
        print("Get your key from: https://app.roboflow.com/settings/api")
        exit(1)
    
    rf = Roboflow(api_key=api_key)
    
    datasets = [
        {
            'workspace': 'amir-pdcee',
            'project': 'snake-detection-gat5j',
            'version': 1,
            'folder': 'Snake-Detection-1'
        },
        {
            'workspace': 'final-boss',
            'project': 'snake-detect-slnkl',
            'version': 3,  # Check the website for correct version
            'folder': 'Snake-Detect-2'
        },
        {
            'workspace': '4ce-q5znk',
            'project': 'snake-classifier',
            'version': 1,
            'folder': 'Snake-Classifier-3'
        }
    ]
    
    print(f"\n📦 Will download {len(datasets)} datasets...")
    
    for i, ds in enumerate(datasets, 1):
        print(f"\n[{i}/{len(datasets)}] Downloading {ds['folder']}...")
        print(f"   Project: {ds['workspace']}/{ds['project']}")
        
        try:
            project = rf.workspace(ds['workspace']).project(ds['project'])
            dataset = project.version(ds['version']).download("yolov8", location=ds['folder'])
            print(f"   ✅ Downloaded to: {ds['folder']}/")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            print(f"   💡 Visit https://universe.roboflow.com/{ds['workspace']}/{ds['project']}")
            print(f"      to check the correct version number")
    
    print("\n" + "=" * 70)
    print("✅ DOWNLOAD COMPLETE!")
    print("=" * 70)
    print("\n🎯 Next step: Merge datasets")
    print("   Run: python merge_snake_datasets.py")
