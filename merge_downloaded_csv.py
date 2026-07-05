import csv
import json
import os
import glob

def main():
    downloads_dir = "/Users/mamtsunodanmisaki/Downloads"
    output_dir = "/Users/mamtsunodanmisaki/.gemini/antigravity/scratch/ielts-wordbook"
    os.makedirs(output_dir, exist_ok=True)
    
    # Configuration matching the exact downloaded file names and their level label
    files_config = [
        ("技能別IELTS頻出英単語3800 - 基本単語1000.csv", "基本単語"),
        ("技能別IELTS頻出英単語3800 - コア単語2000[レベル１].csv", "コア単語 レベル1"),
        ("技能別IELTS頻出英単語3800 - コア単語2000[レベル２].csv", "コア単語 レベル2"),
        ("技能別IELTS頻出英単語3800 - コア単語2000[レベル３].csv", "コア単語 レベル3"),
        ("技能別IELTS頻出英単語3800 - コア単語2000[レベル４].csv", "コア単語 レベル4"),
        ("技能別IELTS頻出英単語3800 - 分野別単語800.csv", "分野別単語")
    ]
    
    merged_data = []
    
    for filename, level in files_config:
        # Resolve path handling decomposed/composed Unicode in macOS file names
        filepath = os.path.join(downloads_dir, filename)
        
        # Fallback if macOS normalized string doesn't match directly
        if not os.path.exists(filepath):
            # Try searching using glob wildcard
            normalized_name = filename.replace("[レベル", "*").replace("]", "*")
            matches = glob.glob(os.path.join(downloads_dir, f"*{normalized_name}*"))
            if matches:
                filepath = matches[0]
            else:
                # If still not found, search generally for part of the name
                keyword = filename.split(" - ")[-1].replace(".csv", "")
                matches = glob.glob(os.path.join(downloads_dir, f"*{keyword}*.csv"))
                if matches:
                    filepath = matches[0]
                else:
                    print(f"Warning: File {filename} not found in Downloads.")
                    continue
                    
        print(f"Processing: {os.path.basename(filepath)} as {level}...")
        
        with open(filepath, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Clean keys and values
                cleaned_row = {k.strip() if k else "": v.strip() if v else "" for k, v in row.items()}
                
                # Format index No as 4 digits
                no_raw = cleaned_row.get("No", "")
                try:
                    if no_raw:
                        no = str(int(float(no_raw))).zfill(4)
                    else:
                        no = ""
                except ValueError:
                    no = no_raw.zfill(4)
                
                word = cleaned_row.get("Word", "")
                # Skip header repetitions or empty rows
                if not word or word.lower() == "word":
                    continue
                    
                pos = cleaned_row.get("POS", "")
                meaning = cleaned_row.get("Meaning", "")
                synonym = cleaned_row.get("Synonym", "")
                example_en = cleaned_row.get("Example_EN", "")
                example_ja = cleaned_row.get("Example_JA", "")
                category = cleaned_row.get("Category", "")
                
                merged_data.append({
                    "No": no,
                    "Category": category,
                    "Word": word,
                    "POS": pos,
                    "Meaning": meaning,
                    "Synonym": synonym,
                    "Example_EN": example_en,
                    "Example_JA": example_ja,
                    "Level": level
                })
                
    # Sort merged data by word No
    # Sort numeric values correctly, non-numeric values at the end
    def get_sort_key(item):
        try:
            return (0, int(item["No"]))
        except ValueError:
            return (1, item["No"])
            
    merged_data.sort(key=get_sort_key)
    
    # Save as CSV with UTF-8 BOM
    csv_output_path = os.path.join(output_dir, "master_vocabulary.csv")
    csv_fields = ["No", "Category", "Word", "POS", "Meaning", "Synonym", "Example_EN", "Example_JA", "Level"]
    
    with open(csv_output_path, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for item in merged_data:
            writer.writerow(item)
            
    # Save as JSON
    json_output_path = os.path.join(output_dir, "words.json")
    with open(json_output_path, mode='w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
        
    print(f"\nSuccessfully merged {len(merged_data)} words.")
    print(f"Unified CSV saved to: {csv_output_path}")
    print(f"JSON data saved to: {json_output_path}")

if __name__ == "__main__":
    main()
