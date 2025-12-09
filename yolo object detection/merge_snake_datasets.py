"""
Merge all snake datasets into the Combined-Predator-Dataset
"""
from pathlib import Path
import shutil
import os

if __name__ == '__main__':
    print("=" * 70)
    print("🔄 MERGING SNAKE DATASETS")
    print("=" * 70)

    current_dir = Path(__file__).parent
    combined_dataset = current_dir / "Combined-Predator-Dataset"
    
    # List of snake datasets (add new ones here)
    snake_datasets = [
        current_dir / "Snake-detect-8",
        current_dir / "Snake-Detection-1",
        current_dir / "Snake-Detect-2",
        current_dir / "Snake-Classifier-3"
    ]
    
    # Check which datasets exist
    existing_datasets = []
    for dataset in snake_datasets:
        if dataset.exists():
            existing_datasets.append(dataset)
            print(f"✅ Found: {dataset.name}")
        else:
            print(f"⚠️  Missing: {dataset.name} (skipping)")
    
    if not existing_datasets:
        print("\n❌ No snake datasets found!")
        exit(1)
    
    print(f"\n📊 Will merge {len(existing_datasets)} snake datasets")
    
    # Count existing images
    existing_train = len(list((combined_dataset / "train" / "images").glob("snake_*")))
    existing_valid = len(list((combined_dataset / "valid" / "images").glob("snake_*")))
    
    print(f"\n📸 Current snake images:")
    print(f"   Training: {existing_train}")
    print(f"   Validation: {existing_valid}")
    
    # Process each snake dataset
    total_added_train = 0
    total_added_valid = 0
    
    for dataset in existing_datasets:
        print(f"\n📋 Processing {dataset.name}...")
        
        for split in ['train', 'valid']:
            split_path = dataset / split
            if not split_path.exists():
                print(f"   ⚠️  No {split} folder found")
                continue
            
            # Copy images
            images_path = split_path / "images"
            if images_path.exists():
                image_files = list(images_path.glob("*"))
                for img in image_files:
                    if img.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                        dest_name = f"snake_{dataset.name}_{img.name}"
                        dest_path = combined_dataset / split / "images" / dest_name
                        shutil.copy(img, dest_path)
                        
                        if split == 'train':
                            total_added_train += 1
                        else:
                            total_added_valid += 1
            
            # Copy and normalize labels
            labels_path = split_path / "labels"
            if labels_path.exists():
                label_files = list(labels_path.glob("*.txt"))
                for lbl in label_files:
                    with open(lbl, 'r') as f:
                        lines = f.readlines()
                    
                    # Normalize all to class 0 (snake)
                    normalized_lines = []
                    for line in lines:
                        parts = line.strip().split()
                        if parts:
                            parts[0] = '0'  # Set to snake class
                            normalized_lines.append(' '.join(parts) + '\n')
                    
                    dest_name = f"snake_{dataset.name}_{lbl.name}"
                    dest_path = combined_dataset / split / "labels" / dest_name
                    with open(dest_path, 'w') as f:
                        f.writelines(normalized_lines)
        
        print(f"   ✅ Added images from {dataset.name}")
    
    # Final counts
    final_train = len(list((combined_dataset / "train" / "images").glob("snake_*")))
    final_valid = len(list((combined_dataset / "valid" / "images").glob("snake_*")))
    
    print("\n" + "=" * 70)
    print("📊 FINAL DATASET STATISTICS")
    print("=" * 70)
    print(f"\n🐍 Snake images:")
    print(f"   Training: {final_train} (+{total_added_train})")
    print(f"   Validation: {final_valid} (+{total_added_valid})")
    
    # Count rats
    rat_train = len(list((combined_dataset / "train" / "images").glob("rat_*")))
    rat_valid = len(list((combined_dataset / "valid" / "images").glob("rat_*")))
    
    print(f"\n🐀 Rat images:")
    print(f"   Training: {rat_train}")
    print(f"   Validation: {rat_valid}")
    
    print(f"\n📊 Total dataset:")
    print(f"   Training: {final_train + rat_train}")
    print(f"   Validation: {final_valid + rat_valid}")
    print(f"   TOTAL: {final_train + rat_train + final_valid + rat_valid}")
    
    # Check balance
    snake_total = final_train + final_valid
    rat_total = rat_train + rat_valid
    ratio = snake_total / rat_total if rat_total > 0 else 0
    
    print(f"\n⚖️  Snake:Rat ratio: {ratio:.1f}:1")
    if ratio > 3:
        print(f"   ⚠️  Consider adding more rat images (need ~{snake_total - rat_total} more)")
    else:
        print("   ✅ Dataset is reasonably balanced")
    
    print("\n✅ Dataset merge complete!")
    print(f"📁 Location: {combined_dataset}")
    print("\n🎯 Next step: Retrain model with expanded dataset")
    print("   Run: python train_combined_predators.py")
