import csv
import json
import os

def load_existing_phonetics(csv_path):
    phonetics = {}
    if os.path.exists(csv_path):
        try:
            with open(csv_path, mode='r', encoding='utf-8-sig') as f:
                import csv
                reader = csv.DictReader(f)
                for row in reader:
                    word = row.get("Word")
                    phonetic = row.get("Phonetic")
                    if word and phonetic:
                        phonetics[word.strip().lower()] = phonetic.strip()
        except Exception as e:
            print(f"Warning: Could not load existing phonetics from {csv_path}: {e}")
    return phonetics

def main():
    # Base paths
    desktop_dir = "/Users/mamtsunodanmisaki/Desktop"
    output_dir = "/Users/mamtsunodanmisaki/.gemini/antigravity/scratch/ielts-wordbook"
    os.makedirs(output_dir, exist_ok=True)
    
    master_csv_path = "/Users/mamtsunodanmisaki/Desktop/ielts-wordbook/master_vocabulary.csv"
    existing_phonetics = load_existing_phonetics(master_csv_path)
    
    # Files configuration
    # (Filename, Level name)
    files_config = [
        ("kindle_vocabulary_list.csv", "基本単語"),
        ("kindle_vocabulary_list_2.csv", "コア単語 レベル1"),
        ("kindle_vocabulary_list_3.csv", "コア単語 レベル2"),
        ("kindle_vocabulary_list_4.csv", "コア単語 レベル3"),
        ("kindle_vocabulary_list_5.csv", "コア単語 レベル4"),
        ("kindle_vocabulary_list_6.csv", "分野別単語")
    ]
    
    merged_data = []
    
    # We want a unified set of columns:
    # No, Category, Word, POS, Meaning, Synonym, Example_EN, Example_JA, Level
    
    for filename, level in files_config:
        filepath = os.path.join(desktop_dir, filename)
        if not os.path.exists(filepath):
            print(f"Warning: File {filepath} not found.")
            continue
            
        print(f"Processing {filename} as {level}...")
        
        # Read using utf-8-sig to automatically strip UTF-8 BOM if present
        with open(filepath, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            # Clean up field names (sometimes trailing spaces exist)
            fieldnames = [field.strip() for field in reader.fieldnames]
            # Recreate reader with cleaned fieldnames mapping
            f.seek(0)
            next(f) # Skip header line
            
            for row in reader:
                # Clean keys & values
                cleaned_row = {k.strip() if k else "": v.strip() if v else "" for k, v in row.items()}
                
                # Extract fields with fallbacks
                no = cleaned_row.get("No", "").zfill(4) # Standardize index to 4 digits (e.g. 0001)
                word = cleaned_row.get("Word", "")
                pos = cleaned_row.get("POS", "")
                meaning = cleaned_row.get("Meaning", "")
                synonym = cleaned_row.get("Synonym", "")
                example_en = cleaned_row.get("Example_EN", "")
                example_ja = cleaned_row.get("Example_JA", "")
                category = cleaned_row.get("Category", "")
                
                # If Synonym is not present, default to empty
                # If Example_EN/JA is not present, default to empty
                # If Category is empty, we can keep it empty
                
                merged_data.append({
                    "No": no,
                    "Category": category,
                    "Word": word,
                    "POS": pos,
                    "Phonetic": existing_phonetics.get(word.lower(), cleaned_row.get("Phonetic", "")),
                    "Meaning": meaning,
                    "Synonym": synonym,
                    "Example_EN": example_en,
                    "Example_JA": example_ja,
                    "Level": level
                })
                
    # Sort merged data by word No
    merged_data.sort(key=lambda x: x["No"])
    
    # Output unified CSV (with utf-8-sig BOM so Excel and Google Sheets open it correctly)
    csv_output_path = os.path.join(output_dir, "master_vocabulary.csv")
    csv_fields = ["No", "Category", "Word", "POS", "Phonetic", "Meaning", "Synonym", "Example_EN", "Example_JA", "Level"]
    
    with open(csv_output_path, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for item in merged_data:
            writer.writerow(item)
            
    # Output unified JSON for the web app
    json_output_path = os.path.join(output_dir, "words.json")
    with open(json_output_path, mode='w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully merged {len(merged_data)} words.")
    print(f"CSV saved to: {csv_output_path}")
    print(f"JSON saved to: {json_output_path}")

if __name__ == "__main__":
    main()
